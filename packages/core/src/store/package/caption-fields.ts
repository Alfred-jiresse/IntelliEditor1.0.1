// Captions: `SEQ`-numbered paragraphs, the lists built from them, and their renumbering.
//
// A caption is Word's References › Insert Caption output: `<label> <chapter>.<n> <text>`,
// where `<n>` is the cached result of a `SEQ <label> \* ARABIC \s 1` field — the sequence of
// that label, restarting at every Heading 1 — and `<chapter>.` is plain text before it. The
// field is never EVALUATED here: its instruction is read through an allowlisted parse, and
// the numbers written into its cached result are computed from the document's own order.
// Bounded like every other walk over file structure.

import { WML_NAMESPACE_URI, XML_NAMESPACE_URI } from './ooxml-shared.ts';
import type { OoxmlNode, OoxmlPart } from './ooxml-tree.ts';
import { fldCharType, fldSimpleInstr, instrTextValue, isInstrTextNode } from './field-nodes.ts';
import { isValidXmlText } from './sinks.ts';
import { tocEntryText, type TocOutlineHeading } from './toc-build.ts';

/** A caption label (`Figure`, `Tableau`): letters only, so it is a field identifier as is. */
const CAPTION_LABEL = /^\p{L}{1,32}$/u;
/** Longest caption text inserted — the same bound a TOC row's text has. */
export const CAPTION_TEXT_MAX = 200;
/** Longest `SEQ` instruction read. */
const SEQ_MAX_INSTRUCTION_CHARS = 256;
/** Deepest table / content-control nesting walked for captions. */
const CAPTION_MAX_NESTING = 8;
/** Most captions one renumbering pass rewrites. */
export const CAPTION_MAX_UPDATES = 2048;

/** Whether a string can be a caption label. */
export function isCaptionLabel(label: unknown): label is string {
  return typeof label === 'string' && CAPTION_LABEL.test(label);
}

/** Whether a string can be a caption's text. */
export function isCaptionText(text: unknown): text is string {
  return typeof text === 'string' && text.length <= CAPTION_TEXT_MAX && isValidXmlText(text);
}

/** The instruction of the field a new caption numbers with. */
export function captionInstruction(label: string): string {
  return `SEQ ${label} \\* ARABIC \\s 1`;
}

/** A parsed `SEQ` instruction — only what numbering reads. */
export interface SeqInstruction {
  readonly identifier: string;
  /** `\s 1`: the sequence restarts at each Heading 1, and is shown after the chapter. */
  readonly restartsAtChapter: boolean;
  /** Arabic numerals (`\* ARABIC` or no format switch): the only format rewritten. */
  readonly arabic: boolean;
}

/** Parse a `SEQ` field instruction, or null when it is not one. Never evaluated. */
export function parseSeqInstruction(raw: string): SeqInstruction | null {
  if (raw.length > SEQ_MAX_INSTRUCTION_CHARS) return null;
  const match = /^\s*SEQ\s+([^\s\\"]{1,40})/i.exec(raw);
  if (!match) return null;
  const format = /\\\*\s*(\w+)/.exec(raw)?.[1];
  return {
    identifier: match[1]!,
    restartsAtChapter: /\\s\s+1\b/.test(raw),
    arabic: format === undefined || format.toUpperCase() === 'ARABIC',
  };
}

const sameLabel = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** Every paragraph of the body in reading order, with the top-level block holding it. */
function* bodyParagraphsInOrder(
  part: OoxmlPart
): Generator<{ readonly paragraph: OoxmlNode; readonly blockId: string }> {
  const body =
    part.root.kind === 'body'
      ? part.root
      : part.root.children.find((child) => child.kind === 'body');
  if (!body || body.kind === 'textValue') return;
  function* walk(
    node: OoxmlNode,
    blockId: string,
    depth: number
  ): Generator<{ readonly paragraph: OoxmlNode; readonly blockId: string }> {
    if (node.kind === 'textValue') return;
    if (node.kind === 'paragraph') {
      yield { paragraph: node, blockId };
      return;
    }
    if (depth >= CAPTION_MAX_NESTING) return;
    if (
      node.kind === 'table' ||
      node.kind === 'tableRow' ||
      node.kind === 'tableCell' ||
      node.kind === 'contentControl' ||
      node.kind === 'contentControlContent'
    ) {
      for (const child of node.children) yield* walk(child, blockId, depth + 1);
    }
  }
  for (const child of body.children) yield* walk(child, child.id, 0);
}

/**
 * The top-level body block holding a paragraph — the paragraph itself, or the table or
 * content control around it — or null when it is not in the body.
 */
export function bodyBlockOfParagraph(part: OoxmlPart, paragraphId: string): string | null {
  for (const { paragraph, blockId } of bodyParagraphsInOrder(part)) {
    if (paragraph.id === paragraphId) return blockId;
  }
  return null;
}

/** The `SEQ` field a caption numbers with: where its number and chapter prefix live. */
interface CaptionField {
  readonly instruction: SeqInstruction;
  /** `w:t` nodes of the cached result; the first carries the number. */
  readonly resultTextIds: readonly string[];
  /** The `w:t` right before the field, which carries `<label> <chapter>.`. */
  readonly prefixTextId: string | null;
  readonly prefixText: string;
}

function textOf(node: OoxmlNode): string {
  if (node.kind === 'textValue') return node.value;
  let text = '';
  for (const child of node.children) if (child.kind === 'textValue') text += child.value;
  return text;
}

/** The first `SEQ` field of a paragraph, complex or simple. */
function captionFieldOf(paragraph: OoxmlNode): CaptionField | null {
  let found: CaptionField | null = null;
  let lastText: OoxmlNode | null = null;
  // One open complex field at a time is enough: a caption's `SEQ` is not nested.
  let open: {
    chunks: string[];
    separated: boolean;
    results: string[];
    prefix: OoxmlNode | null;
  } | null = null;
  const walk = (node: OoxmlNode): void => {
    if (found || node.kind === 'textValue') return;
    const type = fldCharType(node);
    if (type === 'begin') {
      open = { chunks: [], separated: false, results: [], prefix: lastText };
      return;
    }
    if (type === 'separate') {
      if (open) open.separated = true;
      return;
    }
    if (type === 'end') {
      const field = open;
      open = null;
      if (!field) return;
      const instruction = parseSeqInstruction(field.chunks.join(''));
      if (instruction) {
        found = {
          instruction,
          resultTextIds: field.results,
          prefixTextId: field.prefix?.id ?? null,
          prefixText: field.prefix ? textOf(field.prefix) : '',
        };
      }
      return;
    }
    if (isInstrTextNode(node)) {
      if (open && !open.separated) open.chunks.push(instrTextValue(node));
      return;
    }
    if (node.kind === 'fldSimple') {
      const instruction = parseSeqInstruction(fldSimpleInstr(node) ?? '');
      if (instruction) {
        const results: string[] = [];
        const collect = (inner: OoxmlNode): void => {
          if (inner.kind === 'textValue') return;
          if (inner.kind === 'text') results.push(inner.id);
          else inner.children.forEach(collect);
        };
        collect(node);
        found = {
          instruction,
          resultTextIds: results,
          prefixTextId: lastText?.id ?? null,
          prefixText: lastText ? textOf(lastText) : '',
        };
      }
      return;
    }
    if (node.kind === 'text') {
      if (open?.separated) open.results.push(node.id);
      else lastText = node;
      return;
    }
    node.children.forEach(walk);
  };
  if (paragraph.kind !== 'textValue') paragraph.children.forEach(walk);
  return found;
}

/** What a reader sees in a paragraph: run text and cached field results, never instructions. */
export function displayedParagraphText(paragraph: OoxmlNode): string {
  let text = '';
  const walk = (node: OoxmlNode): void => {
    if (node.kind === 'textValue' || text.length > CAPTION_TEXT_MAX * 4) return;
    if (node.kind === 'text') text += textOf(node);
    else if (node.kind === 'tab' || node.localName === 'ptab') text += ' ';
    else if (node.kind !== 'instrText' && node.kind !== 'deletedText') node.children.forEach(walk);
  };
  walk(paragraph);
  return tocEntryText(text).slice(0, CAPTION_TEXT_MAX);
}

/**
 * The captions of one label, in reading order, shaped as the entries a table of figures is
 * planned from (one level).
 */
export function collectCaptionEntries(
  part: OoxmlPart,
  label: string
): readonly TocOutlineHeading[] {
  const entries: TocOutlineHeading[] = [];
  for (const { paragraph } of bodyParagraphsInOrder(part)) {
    const field = captionFieldOf(paragraph);
    if (!field || !sameLabel(field.instruction.identifier, label)) continue;
    const text = displayedParagraphText(paragraph);
    if (text.length > 0) entries.push({ text, level: 0, blockId: paragraph.id });
    if (entries.length >= CAPTION_MAX_UPDATES) break;
  }
  return entries;
}

/** One caption's number as it should read. `chapterPrefix: null` leaves the text before it. */
export interface CaptionNumberUpdate {
  readonly paragraphId: string;
  readonly chapterPrefix: string | null;
  readonly number: string;
}

/** A caption about to be inserted, numbered as part of the sequence it lands in. */
export interface PlannedCaptionInsertion {
  readonly label: string;
  readonly anchorBlockId: string;
  readonly position: 'above' | 'below';
}

/**
 * The chapter a Heading 1 opens: the first number in its text (« Chapitre 2 : … » → 2), or 0
 * for one that carries none (« Introduction générale »).
 */
function chapterNumberOf(heading: OoxmlNode): number {
  const match = /\d{1,4}/.exec(displayedParagraphText(heading));
  return match ? Number(match[0]) : 0;
}

/**
 * What every caption should read, given the Heading 1 paragraphs that open chapters.
 *
 * With `insertion`, the planned caption is numbered too and counted in the sequence, so the
 * updates already make room for it. Only captions whose text would change are returned.
 */
export function planCaptionNumbers(
  part: OoxmlPart,
  chapterHeadingIds: ReadonlySet<string>,
  options: { readonly label?: string; readonly insertion?: PlannedCaptionInsertion } = {}
): {
  readonly inserted: { readonly chapterPrefix: string; readonly number: string } | null;
  readonly updates: readonly CaptionNumberUpdate[];
} {
  let chapter: number | null = null;
  const sinceChapter = new Map<string, number>();
  const overall = new Map<string, number>();
  const next = (label: string, restarts: boolean): number => {
    const key = label.toLocaleLowerCase();
    const counter = restarts ? sinceChapter : overall;
    const value = (counter.get(key) ?? 0) + 1;
    counter.set(key, value);
    return value;
  };
  const prefix = () => (chapter === null ? '' : `${chapter}.`);
  let inserted: { chapterPrefix: string; number: string } | null = null;
  const insertVirtual = () => {
    const insertion = options.insertion!;
    const number = String(next(insertion.label, true));
    inserted = { chapterPrefix: prefix(), number };
  };
  const updates: CaptionNumberUpdate[] = [];
  let previousBlock: string | null = null;

  for (const { paragraph, blockId } of bodyParagraphsInOrder(part)) {
    const insertion = options.insertion;
    if (insertion && blockId !== previousBlock) {
      if (previousBlock === insertion.anchorBlockId && insertion.position === 'below') {
        insertVirtual();
      }
      if (blockId === insertion.anchorBlockId && insertion.position === 'above') insertVirtual();
    }
    previousBlock = blockId;

    if (chapterHeadingIds.has(paragraph.id)) {
      chapter = chapterNumberOf(paragraph);
      sinceChapter.clear();
      continue;
    }
    const field = captionFieldOf(paragraph);
    if (!field) continue;
    const label = field.instruction.identifier;
    const number = next(label, field.instruction.restartsAtChapter);
    if (options.label !== undefined && !sameLabel(label, options.label)) continue;
    if (!field.instruction.arabic || field.resultTextIds.length === 0) continue;
    const current = field.resultTextIds.map((id) => textOfId(paragraph, id)).join('');
    const chapterPrefix = field.instruction.restartsAtChapter ? prefix() : null;
    const prefixStale =
      chapterPrefix !== null &&
      !field.prefixText.endsWith(` ${chapterPrefix}`) &&
      !(chapterPrefix === '' && /\s$/.test(field.prefixText));
    if (current === String(number) && !prefixStale) continue;
    if (updates.length >= CAPTION_MAX_UPDATES) break;
    updates.push({ paragraphId: paragraph.id, chapterPrefix, number: String(number) });
  }
  if (options.insertion && !inserted && previousBlock === options.insertion.anchorBlockId) {
    insertVirtual();
  }
  return { inserted, updates };
}

function textOfId(root: OoxmlNode, id: string): string {
  if (root.kind === 'textValue') return '';
  if (root.id === id) return textOf(root);
  for (const child of root.children) {
    const found = textOfId(child, id);
    if (found) return found;
  }
  return '';
}

// ─── Node construction ──────────────────────────────────────────────────────────────

function wAttr(localName: string, value: string) {
  return {
    kind: 'genericExtension' as const,
    namespaceUri: WML_NAMESPACE_URI,
    localName,
    prefix: 'w',
    value,
  };
}

function element(
  mint: () => string,
  kind: string,
  localName: string,
  attributes: readonly unknown[],
  children: readonly OoxmlNode[]
): OoxmlNode {
  return {
    id: mint(),
    kind,
    namespaceUri: WML_NAMESPACE_URI,
    localName,
    prefix: 'w',
    namespaceBindings: [],
    attributes,
    children,
  } as unknown as OoxmlNode;
}

function textNode(mint: () => string, value: string, localName = 't', kind = 'text'): OoxmlNode {
  const preserve = /^\s|\s$/.test(value);
  return element(
    mint,
    kind,
    localName,
    preserve
      ? [
          {
            kind: 'xmlSpace',
            namespaceUri: XML_NAMESPACE_URI,
            localName: 'space',
            prefix: 'xml',
            value: 'preserve',
          },
        ]
      : [],
    [{ id: mint(), kind: 'textValue', value } as OoxmlNode]
  );
}

const run = (mint: () => string, children: readonly OoxmlNode[]) =>
  element(mint, 'run', 'r', [], children);
const fieldChar = (mint: () => string, type: 'begin' | 'separate' | 'end') =>
  element(mint, 'fldChar', 'fldChar', [wAttr('fldCharType', type)], []);

/** A new caption paragraph: `<label> <chapter>.` + `SEQ` field + ` <text>`. */
export function buildCaptionParagraph(
  mint: () => string,
  caption: {
    readonly label: string;
    readonly text: string;
    readonly chapterPrefix: string;
    readonly number: string;
    readonly styleId?: string;
    /** Keep with the next paragraph — a caption ABOVE what it labels. */
    readonly keepNext: boolean;
  }
): OoxmlNode {
  const properties = [
    ...(caption.styleId
      ? [element(mint, 'generic', 'pStyle', [wAttr('val', caption.styleId)], [])]
      : []),
    ...(caption.keepNext ? [element(mint, 'generic', 'keepNext', [], [])] : []),
  ];
  return element(
    mint,
    'paragraph',
    'p',
    [],
    [
      ...(properties.length > 0
        ? [element(mint, 'paragraphProperties', 'pPr', [], properties)]
        : []),
      run(mint, [textNode(mint, `${caption.label} ${caption.chapterPrefix}`)]),
      run(mint, [fieldChar(mint, 'begin')]),
      run(mint, [
        textNode(mint, ` ${captionInstruction(caption.label)} `, 'instrText', 'instrText'),
      ]),
      run(mint, [fieldChar(mint, 'separate')]),
      run(mint, [textNode(mint, caption.number)]),
      run(mint, [fieldChar(mint, 'end')]),
      run(mint, [textNode(mint, ` ${caption.text}`)]),
    ]
  );
}

/**
 * A caption paragraph with its number rewritten: the field's cached result reads `number`,
 * and — unless `chapterPrefix` is null — the text before the field ends with it in place of
 * the chapter it carried. Null when the paragraph holds no `SEQ` field to rewrite.
 */
export function rewriteCaptionNumber(
  paragraph: OoxmlNode,
  update: Pick<CaptionNumberUpdate, 'chapterPrefix' | 'number'>,
  mint: () => string
): OoxmlNode | null {
  const field = captionFieldOf(paragraph);
  if (!field || field.resultTextIds.length === 0) return null;
  const [first, ...rest] = field.resultTextIds;
  const replacements = new Map<string, string>([[first!, update.number]]);
  for (const id of rest) replacements.set(id, '');
  if (update.chapterPrefix !== null && field.prefixTextId) {
    // `<label> 2.` → `<label> 3.`: drop the trailing chapter the text carries, keep the rest.
    const base = field.prefixText.replace(/\d{1,4}\.$/, '');
    const spaced = /\s$/.test(base) || base.length === 0 ? base : `${base} `;
    replacements.set(field.prefixTextId, `${spaced}${update.chapterPrefix}`);
  }
  const rewrite = (node: OoxmlNode): OoxmlNode => {
    if (node.kind === 'textValue') return node;
    const value = replacements.get(node.id);
    if (value !== undefined) {
      const attributes =
        /^\s|\s$/.test(value) && !node.attributes.some((a) => a.localName === 'space')
          ? [
              ...node.attributes,
              {
                kind: 'xmlSpace',
                namespaceUri: XML_NAMESPACE_URI,
                localName: 'space',
                prefix: 'xml',
                value: 'preserve',
              },
            ]
          : node.attributes;
      return {
        ...node,
        attributes,
        children: [{ id: mint(), kind: 'textValue', value }],
      } as OoxmlNode;
    }
    const children = node.children.map(rewrite);
    return children.some((child, index) => child !== node.children[index])
      ? ({ ...node, children } as OoxmlNode)
      : node;
  };
  return rewrite(paragraph);
}
