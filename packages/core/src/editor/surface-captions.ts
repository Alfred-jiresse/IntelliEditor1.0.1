// Captions at the selection (paginated-surface seam).
//
// Word's References › Insert Caption and Update Field over the captions. The numbers are
// planned from the canonical tree and the outline — which Heading 1 paragraphs open
// chapters — and written as ops, so a caption insert and the renumbering it causes are one
// transaction and one undo step.

import type { TreeApplyResult, TreeDocxSession } from '@docx-editor.dev/core/binding';
import {
  bodyBlockOfParagraph,
  isCaptionLabel,
  isCaptionText,
  planCaptionNumbers,
  validateTreeOp,
  type StoryScope,
  type TreeDocOp,
} from '@docx-editor.dev/core/store';
import type { SemanticPosition, SemanticSelection } from '@docx-editor.dev/core/layout';
import type { CaptionPosition } from '../contracts/editor-numbering.ts';

/** What the composition root lends this lane. */
export interface SurfaceCaptionDeps {
  readonly session: TreeDocxSession;
  storyScope(): StoryScope;
  /** The paragraph holding the caret. */
  caretParagraphId(): string;
  commit(
    run: () => TreeApplyResult | boolean,
    nextSelection?: () => SemanticSelection | null
  ): void;
  selectionMark(): { paragraphId: string; start: number; end: number } | null;
  collapsedAt(position: SemanticPosition): SemanticSelection;
  paragraphTextOf(paragraphId: string): string;
  /** Record why the last write was refused, for `state().lastRejection`. */
  reject(reason: string): void;
}

export interface SurfaceCaptions {
  canInsertCaption(label: string, position: CaptionPosition): boolean;
  insertCaption(label: string, text: string, position: CaptionPosition): boolean;
  updateCaptionNumbers(label?: string): boolean;
}

/** The paragraphs that open chapters: Heading 1, as the outline resolves it. */
function chapterHeadingIds(session: TreeDocxSession): ReadonlySet<string> {
  return new Set(
    session
      .documentOutline()
      .filter((entry) => entry.level === 0)
      .map((entry) => entry.blockId)
  );
}

/**
 * The document's caption paragraph style: the one named `caption` (Word's built-in, whatever
 * its id — `Caption`, `Lgende`), or none, in which case the caption takes Normal.
 */
function captionStyleId(session: TreeDocxSession): string | undefined {
  return session
    .documentStyles()
    .find((style) => style.type === 'paragraph' && style.name.toLowerCase() === 'caption')?.styleId;
}

export function createSurfaceCaptions(deps: SurfaceCaptionDeps): SurfaceCaptions {
  const { session } = deps;

  function insertOps(label: string, text: string, position: CaptionPosition): TreeDocOp[] | null {
    if (deps.storyScope().kind !== 'body' || !session.editable) return null;
    if (!isCaptionLabel(label) || !isCaptionText(text)) return null;
    const part = session.part();
    const anchorBlockId = bodyBlockOfParagraph(part, deps.caretParagraphId());
    if (!anchorBlockId) return null;
    const plan = planCaptionNumbers(part, chapterHeadingIds(session), {
      insertion: { label, anchorBlockId, position },
    });
    if (!plan.inserted) return null;
    const styleId = captionStyleId(session);
    return [
      {
        op: 'insertCaption',
        anchorBlockId,
        position,
        label,
        text,
        chapterPrefix: plan.inserted.chapterPrefix,
        number: plan.inserted.number,
        ...(styleId !== undefined ? { styleId } : {}),
      },
      ...(plan.updates.length > 0
        ? [{ op: 'setCaptionNumbers' as const, updates: plan.updates }]
        : []),
    ];
  }

  return {
    canInsertCaption(label, position) {
      const ops = insertOps(label, '', position);
      return ops !== null && validateTreeOp(session.part(), ops[0]!) === null;
    },

    insertCaption(label, text, position) {
      const ops = insertOps(label, text, position);
      if (!ops) {
        deps.reject('a caption can only be inserted beside a block of the editable document body');
        return false;
      }
      // The insert op publishes the new caption as its caret hint, read the way a table
      // insert reads its first cell: through the committed-change subscription.
      let caption: string | null = null;
      const unsubscribe = session.subscribe((change) => {
        if (change.caret) caption = change.caret.paragraphId;
      });
      let committed = false;
      try {
        deps.commit(
          () => {
            const result = session.applyTreeOps(ops, deps.selectionMark());
            committed = result.committed;
            if (!result.committed) deps.reject(result.reason ?? 'the caption was refused');
            return result;
          },
          // The caret lands at the END of the caption, where Word leaves you typing its text.
          () => {
            const id: string | null = caption;
            return id
              ? deps.collapsedAt({ paragraphId: id, offset: deps.paragraphTextOf(id).length })
              : null;
          }
        );
      } finally {
        unsubscribe();
      }
      return committed;
    },

    updateCaptionNumbers(label) {
      if (label !== undefined && !isCaptionLabel(label)) return false;
      const plan = planCaptionNumbers(session.part(), chapterHeadingIds(session), {
        ...(label !== undefined ? { label } : {}),
      });
      if (plan.updates.length === 0) return true;
      let committed = false;
      deps.commit(() => {
        const result = session.applyTreeOps(
          [{ op: 'setCaptionNumbers', updates: plan.updates }],
          deps.selectionMark()
        );
        committed = result.committed;
        if (!result.committed) deps.reject(result.reason ?? 'the captions could not be renumbered');
        return result;
      });
      return committed;
    },
  };
}
