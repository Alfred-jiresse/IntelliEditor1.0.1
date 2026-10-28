// The rule contract.
//
// A rule is a pure function of (document, structure, profile) → outcome. It never reads XML,
// never touches the editor, never throws on odd input: an unverifiable rule says `skip` with a
// reason rather than guessing. Rules are independent so each can be tested, enabled or
// re-graded (via the profile) on its own.

import type { DocumentStructure } from '../analysis/structure.ts';
import type { DocumentModel, MarginsTwips } from '../model/types.ts';
import type { ConformityProfile, Severity } from '../profile/types.ts';

export type RuleCategory =
  | 'mise-en-page'
  | 'typographie'
  | 'titres'
  | 'structure'
  | 'legendes'
  | 'references'
  | 'integrite'
  | 'longueur';

/** Where a finding points: a body paragraph, identified the way the editor can find it again. */
export interface FindingLocation {
  readonly paragraphIndex: number;
  /** Visible text of the paragraph, used to search it in the editor. */
  readonly text: string;
}

/**
 * A correction the HOST can apply. Described, not performed: the engine is read-only and the
 * editor owns every write, so it stays one undoable step there.
 */
export type FixSuggestion = {
  readonly kind: 'set-page-margins';
  readonly label: string;
  readonly marginsTwips: MarginsTwips;
};

export interface Finding {
  readonly message: string;
  readonly location?: FindingLocation;
  readonly fix?: FixSuggestion;
}

export type RuleOutcome =
  | { readonly status: 'pass'; readonly summary?: string }
  | { readonly status: 'fail'; readonly findings: readonly Finding[]; readonly summary?: string }
  | { readonly status: 'skip'; readonly reason: string };

export interface RuleContext {
  readonly document: DocumentModel;
  readonly structure: DocumentStructure;
  readonly profile: ConformityProfile;
}

export interface Rule {
  /** Stable id, e.g. `page.margins`. Profiles address rules by it. */
  readonly id: string;
  readonly title: string;
  readonly category: RuleCategory;
  readonly severity: Severity;
  /** The norm's own wording or article, shown to the student as the reason. */
  readonly reference: string;
  check(context: RuleContext): RuleOutcome;
}

export const pass = (summary?: string): RuleOutcome => ({
  status: 'pass',
  ...(summary ? { summary } : {}),
});
export const skip = (reason: string): RuleOutcome => ({ status: 'skip', reason });
export const fail = (findings: readonly Finding[], summary?: string): RuleOutcome =>
  findings.length === 0
    ? pass(summary)
    : { status: 'fail', findings, ...(summary ? { summary } : {}) };

/** Most findings a rule reports individually; the rest are summarized in one line. */
export const MAX_FINDINGS_PER_RULE = 12;

export function capFindings(findings: readonly Finding[], noun: string): Finding[] {
  if (findings.length <= MAX_FINDINGS_PER_RULE) return [...findings];
  const rest = findings.length - MAX_FINDINGS_PER_RULE;
  return [
    ...findings.slice(0, MAX_FINDINGS_PER_RULE),
    { message: `… et ${rest} autre(s) ${noun}.` },
  ];
}

export function at(paragraph: { readonly index: number; readonly text: string }): FindingLocation {
  return { paragraphIndex: paragraph.index, text: paragraph.text };
}
