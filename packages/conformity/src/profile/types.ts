// A conformity profile: one institution's norm, as data.
//
// Every number and name a rule compares against lives HERE, never in a rule. That is what
// makes the engine reusable beyond one faculty: a different university is a different
// profile, not different code. The UDBL profile is the built-in default; a JSON file with the
// same shape (see `parse-profile.ts`) can override any part of it.

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
}
