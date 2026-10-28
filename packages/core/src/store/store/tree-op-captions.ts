// Caption TreeDocOps — insert a `SEQ`-numbered caption, rewrite caption numbers.
//
// The numbers themselves are planned outside (`planCaptionNumbers`, which needs to know
// which paragraphs open chapters); these ops only validate and write what they are given,
// so a caption insert and the renumbering it causes commit as one transaction.

import {
  CAPTION_MAX_UPDATES,
  buildCaptionParagraph,
  isCaptionLabel,
  isCaptionText,
  rewriteCaptionNumber,
} from '../package/caption-fields.ts';
import {
  createNodeIdAllocator,
  findNode,
  insertChildren,
  replaceNode,
  type EditOptions,
} from '../package/ooxml-edit.ts';
import type { OoxmlPart } from '../package/ooxml-tree.ts';
import { effectiveContentLockAt, fromEdit, isBoundAt, ok, parentOf } from './tree-op-nodes.ts';
import type { TreeDocOp, TreeOpRejection, TreeOpResult } from './tree-op-types.ts';

export type InsertCaptionOp = Extract<TreeDocOp, { op: 'insertCaption' }>;
export type SetCaptionNumbersOp = Extract<TreeDocOp, { op: 'setCaptionNumbers' }>;

const NUMBER = /^\d{1,5}$/;
const CHAPTER_PREFIX = /^(\d{1,4}\.)?$/;
const STYLE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function validateInsertCaption(
  part: OoxmlPart,
  op: InsertCaptionOp
): TreeOpRejection | null {
  if (
    !isCaptionLabel(op.label) ||
    !isCaptionText(op.text) ||
    (op.position !== 'above' && op.position !== 'below') ||
    typeof op.number !== 'string' ||
    !NUMBER.test(op.number) ||
    typeof op.chapterPrefix !== 'string' ||
    !CHAPTER_PREFIX.test(op.chapterPrefix) ||
    (op.styleId !== undefined && (typeof op.styleId !== 'string' || !STYLE_ID.test(op.styleId)))
  ) {
    return 'invalidArgs';
  }
  if (typeof op.anchorBlockId !== 'string' || op.anchorBlockId.length === 0) return 'invalidArgs';
  const block = findNode(part, op.anchorBlockId);
  if (!block || block.kind === 'textValue') return 'unknown-block';
  // A caption is a body paragraph beside a body block: the anchor must be one.
  if (parentOf(part, block.id)?.kind !== 'body') return 'not-a-block';
  if (isBoundAt(part, block.id)) return 'bound';
  if (effectiveContentLockAt(part, block.id).content) return 'locked';
  return null;
}

export function applyInsertCaption(
  part: OoxmlPart,
  op: InsertCaptionOp,
  options?: EditOptions
): TreeOpResult {
  const block = findNode(part, op.anchorBlockId);
  const body = block ? parentOf(part, block.id) : null;
  if (!block || !body) return { ok: false, reason: 'unknown-block' };
  const index = body.children.findIndex((child) => child.id === block.id);
  if (index < 0) return { ok: false, reason: 'tree-invariant' };
  const mint = createNodeIdAllocator(part);
  const caption = buildCaptionParagraph(mint, {
    label: op.label,
    text: op.text,
    chapterPrefix: op.chapterPrefix,
    number: op.number,
    ...(op.styleId !== undefined ? { styleId: op.styleId } : {}),
    keepNext: op.position === 'above',
  });
  const at = op.position === 'above' ? index : index + 1;
  return fromEdit(insertChildren(part, body.id, at, [caption], options), {
    dirty: [body.id],
    created: [caption.id],
    deleted: [],
    dependencyKeys: [body.id],
    impact: 'flow-structural',
    caret: { paragraphId: caption.id },
  });
}

export function validateSetCaptionNumbers(
  part: OoxmlPart,
  op: SetCaptionNumbersOp
): TreeOpRejection | null {
  if (!Array.isArray(op.updates) || op.updates.length > CAPTION_MAX_UPDATES) return 'invalidArgs';
  for (const update of op.updates) {
    if (
      typeof update.paragraphId !== 'string' ||
      typeof update.number !== 'string' ||
      !NUMBER.test(update.number) ||
      (update.chapterPrefix !== null &&
        (typeof update.chapterPrefix !== 'string' || !CHAPTER_PREFIX.test(update.chapterPrefix)))
    ) {
      return 'invalidArgs';
    }
    const paragraph = findNode(part, update.paragraphId);
    if (!paragraph || paragraph.kind !== 'paragraph') return 'unknown-paragraph';
    if (isBoundAt(part, paragraph.id)) return 'bound';
    if (effectiveContentLockAt(part, paragraph.id).content) return 'locked';
  }
  return null;
}

export function applySetCaptionNumbers(
  part: OoxmlPart,
  op: SetCaptionNumbersOp,
  options?: EditOptions
): TreeOpResult {
  let current = part;
  const mint = createNodeIdAllocator(part);
  const dirty: string[] = [];
  for (const update of op.updates) {
    const paragraph = findNode(current, update.paragraphId);
    if (!paragraph) return { ok: false, reason: 'unknown-paragraph' };
    const rewritten = rewriteCaptionNumber(paragraph, update, mint);
    if (!rewritten || rewritten === paragraph) continue;
    const replaced = replaceNode(current, paragraph.id, rewritten, options);
    if (!replaced.ok) return { ok: false, reason: 'tree-invariant' };
    current = replaced.part;
    dirty.push(paragraph.id);
  }
  return ok(current, {
    dirty,
    created: [],
    deleted: [],
    dependencyKeys: dirty,
    impact: 'text-local',
  });
}
