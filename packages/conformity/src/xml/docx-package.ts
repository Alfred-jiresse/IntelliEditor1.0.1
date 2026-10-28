// The trust boundary of the conformity engine.
//
// A .docx is attacker-controlled. Nothing here parses it by hand: the zip goes through the
// engine's bounded `readZip` (ratio/size caps, traversal-safe names, checked before inflating)
// and every part through `readXml` (no DTD, no entities, depth and element caps). This module
// only decides WHICH parts the analysis needs and hands them on namespace-resolved.

import { readXml, readZip } from '@docx-editor.dev/core/store';
import { attr, children, toElementTree, type Element } from './element.ts';

const MAIN_DOCUMENT = '/word/document.xml';
const OFFICE_DOCUMENT_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument';

export interface DocxPackage {
  /** `w:document` of the main document part. */
  readonly document: Element;
  readonly styles: Element | null;
  readonly theme: Element | null;
  /** Relationship id → canonical part name, for the main document part. */
  readonly documentRelationships: ReadonlyMap<string, string>;
  /** Reads another XML part by canonical name (headers, footers), or null when absent/invalid. */
  readPart(partName: string): Element | null;
}

export type DocxReadResult =
  | { readonly ok: true; readonly package: DocxPackage }
  | { readonly ok: false; readonly reason: string };

const decoder = new TextDecoder('utf-8', { fatal: false });

/** Resolve a relationship target against the directory of the part that owns it. */
function resolveTarget(ownerPart: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null; // external, never followed
  const base = target.startsWith('/') ? [] : ownerPart.split('/').filter(Boolean).slice(0, -1);
  for (const segment of target.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (base.length === 0) return null; // escapes the package root
      base.pop();
    } else base.push(segment);
  }
  return `/${base.join('/')}`;
}

function relsPartFor(partName: string): string {
  const slash = partName.lastIndexOf('/');
  return `${partName.slice(0, slash)}/_rels/${partName.slice(slash + 1)}.rels`;
}

/** Open DOCX bytes for analysis. Never throws: a bad file is a typed refusal. */
export function readDocxPackage(bytes: Uint8Array): DocxReadResult {
  const zip = readZip(bytes);
  if (!zip.ok) return { ok: false, reason: `archive illisible (${zip.reason})` };
  const entries = zip.entries;
  const cache = new Map<string, Element | null>();

  const readPart = (partName: string): Element | null => {
    if (cache.has(partName)) return cache.get(partName) ?? null;
    const data = entries.get(partName);
    let tree: Element | null = null;
    if (data) {
      const parsed = readXml(decoder.decode(data));
      tree = parsed.ok ? toElementTree(parsed.nodes) : null;
    }
    cache.set(partName, tree);
    return tree;
  };

  const readRelationships = (owner: string): Map<string, { type: string; part: string }> => {
    const out = new Map<string, { type: string; part: string }>();
    const root = readPart(relsPartFor(owner));
    for (const rel of children(root ?? undefined, 'pr:Relationship')) {
      const id = attr(rel, 'Id');
      const target = attr(rel, 'Target');
      if (!id || !target || attr(rel, 'TargetMode') === 'External') continue;
      const part = resolveTarget(owner, target);
      if (part) out.set(id, { type: attr(rel, 'Type') ?? '', part });
    }
    return out;
  };

  const packageRels = readRelationships('/');
  const mainPart =
    [...packageRels.values()].find((rel) => rel.type === OFFICE_DOCUMENT_REL)?.part ??
    MAIN_DOCUMENT;
  const document = readPart(mainPart);
  if (!document || document.name !== 'w:document') {
    return { ok: false, reason: 'document Word introuvable dans le fichier' };
  }

  const rels = readRelationships(mainPart);
  const byType = (suffix: string): Element | null => {
    const rel = [...rels.values()].find((entry) => entry.type.endsWith(`/${suffix}`));
    return rel ? readPart(rel.part) : null;
  };

  return {
    ok: true,
    package: {
      document,
      styles: byType('styles'),
      theme: byType('theme'),
      documentRelationships: new Map([...rels].map(([id, rel]) => [id, rel.part])),
      readPart,
    },
  };
}
