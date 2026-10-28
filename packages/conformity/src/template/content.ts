// What a TFC SAYS, independent of how it is laid out.
//
// The generator numbers everything itself — sections "n.k", sub-sections "n.k.j", tables
// and figures "n.m", partial introduction and conclusion of each chapter — so content can
// never carry a wrong number. A blank template and a full worked example are two values of
// this one type rendered by the same code.

export interface ImageContent {
  readonly bytes: Uint8Array;
  readonly format: 'png' | 'jpeg';
  /** Printed width; the height follows from the aspect ratio. */
  readonly widthCm: number;
  readonly aspect: number;
}

export type Block =
  | { readonly kind: 'paragraph'; readonly text: string }
  /** Short items, one per line, introduced by a dash (no numbering part needed). */
  | { readonly kind: 'list'; readonly items: readonly string[] }
  | {
      readonly kind: 'table';
      readonly caption: string;
      readonly header: readonly string[];
      readonly rows: readonly (readonly string[])[];
    }
  | { readonly kind: 'figure'; readonly caption: string; readonly image: ImageContent }
  /** A level-3 sub-section inside a section ("n.k.j. title"). */
  | { readonly kind: 'subsection'; readonly title: string; readonly blocks: readonly Block[] };

export interface SectionContent {
  readonly title: string;
  readonly blocks: readonly Block[];
}

export interface ChapterContent {
  readonly title: string;
  readonly introduction: readonly Block[];
  readonly sections: readonly SectionContent[];
  readonly conclusion: readonly Block[];
}

export interface TfcContent {
  readonly epigraph: { readonly quote: string; readonly author: string };
  readonly dedication: readonly string[];
  readonly acknowledgements: readonly string[];
  readonly acronyms: readonly (readonly [string, string])[];
  readonly foreword: readonly string[];
  /** Introduction sections, numbered 0.1, 0.2… in this order. */
  readonly introduction: readonly SectionContent[];
  readonly chapters: readonly ChapterContent[];
  readonly conclusion: readonly Block[];
  /** IEEE entries, without the "[n]" — the generator numbers them. */
  readonly references: readonly string[];
  readonly annexes: readonly Block[];
}

export const text = (value: string): Block => ({ kind: 'paragraph', text: value });
