/**
 * Page and caption numbering public contract types for the Editor facade.
 *
 * Separated from `editor.ts` so the facade file stays under the max-lines gate, like the
 * header/footer vocabulary beside it. Re-exported from `editor.ts`.
 */

/**
 * How a section displays its page numbers — the formats Word's Page Number Format dialog
 * offers: `1, 2, 3`, `i, ii, iii`, `I, II, III`, `a, b, c`, `A, B, C`.
 */
export type PageNumberFormat =
  | 'decimal'
  | 'lowerRoman'
  | 'upperRoman'
  | 'lowerLetter'
  | 'upperLetter';

/** A section's page numbering, as the Page Number Format dialog shows it. */
export interface PageNumbering {
  readonly format: PageNumberFormat;
  /** The number the section restarts at, or `null` when it continues the previous section. */
  readonly start: number | null;
}

/** Where a caption goes relative to the block it labels. */
export type CaptionPosition = 'above' | 'below';

/** Page-number format, captions and their renumbering. */
export interface EditorNumberingCommands {
  /**
   * Word's Insert › Page Numbers › Format: how the section displays its page numbers and
   * whether it restarts them. `scope` is `'section'` (the caret's, the default — the dialog
   * is per section) or `'document'`. `start: null` continues from the previous section.
   */
  setPageNumbering: {
    format?: PageNumberFormat;
    start?: number | null;
    scope?: 'document' | 'section';
  };
  /**
   * Word's References › Insert Caption: a new paragraph in the Caption style reading
   * `<label> <chapter>.<n> <text>`, above or below the block holding the caret (a table
   * as a whole when the caret is in one of its cells). The order within the chapter is a
   * `SEQ` field restarting at each Heading 1, so Word renumbers it too; the chapter part is
   * read from the Heading 1 before the caption. Other captions of the same label are
   * renumbered in the same undo step.
   */
  insertCaption: {
    /** `Figure`, `Tableau`, … — letters only, the identifier the `SEQ` field and lists use. */
    label: string;
    text?: string;
    /** Defaults to `'below'`. */
    position?: CaptionPosition;
  };
  /**
   * Word's Update Field over the captions: renumber every caption of `label` (every label
   * when omitted) from where it now stands. One undo step; a no-op when nothing moved.
   */
  updateCaptionNumbers: { label?: string };
}
