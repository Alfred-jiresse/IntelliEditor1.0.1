// The document as the rules see it.
//
// A deliberately SMALL read model: only the facts a thesis norm speaks about (page setup,
// numbering, typography, headings, captions, fields), already resolved through the style
// cascade. Rules never touch XML — they read this — so a rule can be tested with a literal
// model and the reader can change without any rule noticing.

/** Page numbering format, as `w:pgNumType/@w:fmt` spells it. */
export type PageNumberFormat =
  | 'decimal'
  | 'lowerRoman'
  | 'upperRoman'
  | 'lowerLetter'
  | 'upperLetter'
  | 'other';

export type Alignment = 'left' | 'center' | 'right' | 'justify' | 'other';

export interface MarginsTwips {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Where a section prints its page number, read from its footer/header parts. */
export interface PageNumberPlacement {
  readonly where: 'header' | 'footer';
  readonly alignment: Alignment;
}

export interface SectionModel {
  readonly index: number;
  readonly pageWidthTwips: number | null;
  readonly pageHeightTwips: number | null;
  readonly margins: MarginsTwips | null;
  readonly numberFormat: PageNumberFormat;
  /** `w:pgNumType/@w:start`: numbering restarts here when set. */
  readonly numberStart: number | null;
  /** Null when no header/footer of the section carries a PAGE field. */
  readonly pageNumber: PageNumberPlacement | null;
  /** Body paragraph indexes this section covers, inclusive. */
  readonly firstParagraph: number;
  readonly lastParagraph: number;
}

/** Run formatting summarized over a paragraph's visible text. */
export interface TextFormatting {
  /** Font families used, weighted by character count, most used first. */
  readonly fonts: readonly string[];
  /** Font sizes in points, most used first. */
  readonly sizesPt: readonly number[];
  /** True only when EVERY visible character is bold (resp. italic / all caps). */
  readonly bold: boolean;
  readonly italic: boolean;
  readonly caps: boolean;
}

/** Line spacing, normalized: a multiple of single spacing, or an exact/minimum height. */
export type LineSpacing =
  | { readonly kind: 'multiple'; readonly value: number }
  | { readonly kind: 'exact' | 'atLeast'; readonly points: number };

export type ParagraphRole = 'body' | 'heading' | 'caption' | 'toc' | 'list' | 'empty';

export interface ParagraphModel {
  /**
   * Ordinal among BODY paragraphs, skipping tables — the same ordinal the editor's find
   * results carry (`TextMatch.paragraphIndex`), which is how a finding navigates back.
   */
  readonly index: number;
  readonly text: string;
  readonly styleId: string | null;
  readonly styleName: string | null;
  /** 1–9 when the paragraph is a heading (style or outline level), else null. */
  readonly headingLevel: number | null;
  readonly role: ParagraphRole;
  readonly alignment: Alignment;
  readonly lineSpacing: LineSpacing | null;
  readonly formatting: TextFormatting;
  readonly sectionIndex: number;
  /** Field instructions found in the paragraph (`TOC \o "1-3"`, `SEQ Figure`, `PAGE`…). */
  readonly fieldInstructions: readonly string[];
  /** The paragraph contains an inline or anchored picture. */
  readonly hasDrawing: boolean;
  /** Starts on a new page (explicit break before it, or `w:pageBreakBefore`). */
  readonly startsPage: boolean;
}

/** A block in body order — what caption placement is judged against. */
export type BlockModel =
  | { readonly kind: 'paragraph'; readonly paragraph: ParagraphModel }
  | { readonly kind: 'table'; readonly firstCellText: string };

export interface DocumentModel {
  readonly blocks: readonly BlockModel[];
  readonly paragraphs: readonly ParagraphModel[];
  readonly sections: readonly SectionModel[];
  /** Total visible words of the body, for length estimates. */
  readonly wordCount: number;
}
