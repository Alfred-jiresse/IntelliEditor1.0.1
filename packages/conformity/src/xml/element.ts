// A namespace-resolved view of the engine's bounded XML tree.
//
// The engine's `readXml` keeps the AUTHORED qualified names (`w:p`, but just as legally
// `ns0:p` after a round trip through a writer that allocates its own prefixes). Every reader
// in this package compares names, so it compares them in ONE canonical spelling: the prefix
// is resolved to its namespace URI and re-spelled with the alias below. A file that binds
// WordprocessingML to `x:` therefore reads exactly like one that binds it to `w:`, and a
// DrawingML `a:t` can never be mistaken for a WordprocessingML `w:t`.

import type { XmlNode } from '@docx-editor.dev/core/store';

const CANONICAL_ALIASES: Readonly<Record<string, string>> = {
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main': 'w',
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships': 'r',
  'http://schemas.openxmlformats.org/package/2006/relationships': 'pr',
  'http://schemas.openxmlformats.org/drawingml/2006/main': 'a',
  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing': 'wp',
  'http://schemas.openxmlformats.org/drawingml/2006/picture': 'pic',
  'http://schemas.microsoft.com/office/word/2010/wordml': 'w14',
  'http://schemas.openxmlformats.org/markup-compatibility/2006': 'mc',
  'urn:schemas-microsoft-com:vml': 'v',
};

/** An element whose name and attribute names are spelled with canonical aliases. */
export interface Element {
  readonly name: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly Node[];
}

export type Node = Element | { readonly text: string };

export function isElement(node: Node): node is Element {
  return 'name' in node;
}

type Scope = ReadonlyMap<string, string>;

function canonicalName(qualified: string, scope: Scope, isAttribute: boolean): string {
  const colon = qualified.indexOf(':');
  // Unprefixed attributes belong to no namespace; unprefixed elements take the default one.
  if (colon < 0) {
    if (isAttribute) return qualified;
    const uri = scope.get('');
    const alias = uri ? CANONICAL_ALIASES[uri] : undefined;
    return alias ? `${alias}:${qualified}` : qualified;
  }
  const prefix = qualified.slice(0, colon);
  const local = qualified.slice(colon + 1);
  if (prefix === 'xml' || prefix === 'xmlns') return qualified;
  const uri = scope.get(prefix);
  const alias = uri ? CANONICAL_ALIASES[uri] : undefined;
  return `${alias ?? prefix}:${local}`;
}

function extendScope(scope: Scope, attributes: Readonly<Record<string, string>>): Scope {
  let next: Map<string, string> | null = null;
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'xmlns' || key.startsWith('xmlns:')) {
      next ??= new Map(scope);
      next.set(key === 'xmlns' ? '' : key.slice(6), value);
    }
  }
  return next ?? scope;
}

function convert(node: XmlNode, scope: Scope): Node {
  if (node.type === 'text') return { text: node.value };
  const inner = extendScope(scope, node.attributes);
  const attributes = new Map<string, string>();
  for (const [key, value] of Object.entries(node.attributes)) {
    if (key === 'xmlns' || key.startsWith('xmlns:')) continue;
    attributes.set(canonicalName(key, inner, true), value);
  }
  return {
    name: canonicalName(node.name, inner, false),
    attributes,
    children: node.children.map((child) => convert(child, inner)),
  };
}

/** The first root element of a parsed part, namespace-resolved, or null when there is none. */
export function toElementTree(nodes: readonly XmlNode[]): Element | null {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    const converted = convert(node, new Map());
    return isElement(converted) ? converted : null;
  }
  return null;
}

// ─── Small query helpers, shared by every reader ─────────────────────────────

export function child(element: Element | undefined, name: string): Element | undefined {
  if (!element) return undefined;
  for (const node of element.children) {
    if (isElement(node) && node.name === name) return node;
  }
  return undefined;
}

export function children(element: Element | undefined, name: string): Element[] {
  if (!element) return [];
  return element.children.filter((node): node is Element => isElement(node) && node.name === name);
}

/** Every descendant element with `name`, depth first, in document order. */
export function descendants(element: Element, name: string): Element[] {
  const out: Element[] = [];
  const walk = (current: Element): void => {
    for (const node of current.children) {
      if (!isElement(node)) continue;
      if (node.name === name) out.push(node);
      walk(node);
    }
  };
  walk(element);
  return out;
}

export function attr(element: Element | undefined, name: string): string | undefined {
  return element?.attributes.get(name);
}

/** `w:val` of a child property element — the shape almost every WordprocessingML property has. */
export function childVal(element: Element | undefined, name: string): string | undefined {
  return attr(child(element, name), 'w:val');
}

/** An OOXML integer attribute, or undefined when absent or not a finite integer. */
export function intAttr(element: Element | undefined, name: string): number | undefined {
  const raw = attr(element, name);
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * An ST_OnOff toggle: present means on unless `w:val` says otherwise. Absent is `undefined`,
 * which callers read as "inherit" — distinct from an explicit off.
 */
export function onOff(element: Element | undefined, name: string): boolean | undefined {
  const property = child(element, name);
  if (!property) return undefined;
  const value = attr(property, 'w:val');
  return value === undefined || !['0', 'false', 'off'].includes(value);
}
