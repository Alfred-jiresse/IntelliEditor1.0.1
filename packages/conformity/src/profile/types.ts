// A conformity profile: one institution's norm, as data.
//
// Every number and name a rule compares against lives HERE, never in a rule. That is what
// makes the engine reusable beyond one faculty: a different university is a different
// profile, not different code. The UDBL profile is the built-in default; a rules file — plain
// text (`rules-text.ts`) or JSON (`parse-profile.ts`) — can override any part of it and add
// requirements of its own (`customRules`).

import type { PageNumberFormat } from '../model/types.ts';

export type Severity = 'error' | 'warning' | 'info';

export type TextCase = 'upper' | 'lower' | 'any';

export interface HeadingSpec {
  readonly bold: boolean;
  readonly italic: boolean;
  readonly textCase: TextCase;
  readonly sizePt: number;
}

/** A named part of the thesis (e.g. "Dédicace") and the titles that identify it. */
export interface PartSpec {
  readonly id: string;
  readonly label: string;
  /** Normalized titles (lower case, no accents) that identify the part. */
  readonly aliases: readonly string[];
  readonly required: boolean;
}

export interface RuleOverride {
  readonly enabled?: boolean;
  readonly severity?: Severity;
}

/**
 * The kinds of rule an institution can declare in its rules file, without code. Each one is a
 * fixed, tested check parameterized by data — never a pattern or an expression read from the
 * file, so a rules file cannot make the checker run anything it was not built to run.
 */
export type CustomRuleKind =
  /** None of `values` may appear (whole words, accents and case ignored). */
  | 'forbidden-text'
  /** Every one of `values` must appear somewhere in the zone. */
  | 'required-text'
  /** A titled part whose title is one of `values` must exist. */
  | 'required-part'
  /** The part titled one of `values` must stay within the word/page bounds. */
  | 'part-length'
  /** The whole work (after the cover) must stay within the word/page bounds. */
  | 'document-length';

/** Where a text rule looks: the running text, the cover page, or everything. */
export type TextZone = 'body' | 'cover' | 'document';

export interface CustomRuleSpec {
  /** `perso.<slug>`: how the report and the `rules` overrides address it. */
  readonly id: string;
  readonly kind: CustomRuleKind;
  readonly title: string;
  readonly severity: Severity;
  /** The institution's wording, shown to the student as the reason. */
  readonly reference: string;
  /** Texts (forbidden/required) or part titles (required-part, part-length). */
  readonly values: readonly string[];
  readonly zone: TextZone;
  readonly minWords?: number;
  readonly maxWords?: number;
  readonly minPages?: number;
  readonly maxPages?: number;
}

export interface ConformityProfile {
  readonly id: string;
  readonly name: string;
  readonly institution: string;
  /** Where the norm comes from — shown to the student next to each rule. */
  readonly source: string;
  readonly page: {
    readonly widthMm: number;
    readonly heightMm: number;
    /** Margins in centimetres. */
    readonly marginsCm: {
      readonly top: number;
      readonly right: number;
      readonly bottom: number;
      readonly left: number;
    };
    readonly marginToleranceMm: number;
    readonly numberAlignment: 'left' | 'center' | 'right';
    readonly liminaryNumberFormat: PageNumberFormat;
    readonly bodyNumberFormat: PageNumberFormat;
  };
  readonly typography: {
    readonly bodyFonts: readonly string[];
    readonly bodySizePt: number;
    readonly lineSpacing: number;
    readonly lineSpacingTolerance: number;
    /** Share of body paragraphs allowed to deviate before the rule fails (0–1). */
    readonly deviationTolerance: number;
  };
  /** Heading styles by level, index 0 = level 1. */
  readonly headings: readonly HeadingSpec[];
  readonly cover: {
    /** Normalized mentions the cover page must carry (institution, "travail présenté", …). */
    readonly requiredMentions: readonly string[];
  };
  readonly structure: {
    /** Parts in the order the norm imposes. */
    readonly parts: readonly PartSpec[];
    /** Sections the general introduction must contain. */
    readonly introductionSections: readonly PartSpec[];
    readonly minChapters: number;
    readonly maxChapters: number;
    readonly requirePartialIntroAndConclusion: boolean;
  };
  readonly captions: {
    readonly tableCaptionPosition: 'above' | 'below';
    readonly figureCaptionPosition: 'above' | 'below';
    /** Captions numbered "chapitre.ordre" (Tableau 1.2). */
    readonly chapterNumbering: boolean;
  };
  readonly references: {
    readonly sectionAliases: readonly string[];
    readonly preferredTitle: string;
    readonly minimumCount: number;
    readonly style: 'ieee';
  };
  readonly lengths: {
    readonly wordsPerPage: number;
    readonly introductionMaxPages: number;
    readonly chapterMaxPages: number;
  };
  readonly rules: Readonly<Record<string, RuleOverride>>;
  /** Requirements the institution declared in its rules file, on top of the built-in rules. */
  readonly customRules: readonly CustomRuleSpec[];
}
