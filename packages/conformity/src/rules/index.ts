// The rule registry: every rule the engine knows, in the order the report presents them.

import { CAPTION_RULES } from './captions.ts';
import { HEADING_RULES } from './headings.ts';
import { INTEGRITY_AND_LENGTH_RULES } from './integrity-and-length.ts';
import { PAGE_RULES } from './page.ts';
import { REFERENCE_RULES } from './references.ts';
import { STRUCTURE_RULES } from './structure.ts';
import { TYPOGRAPHY_RULES } from './typography.ts';
import type { Rule } from './types.ts';

export const ALL_RULES: readonly Rule[] = [
  ...PAGE_RULES,
  ...TYPOGRAPHY_RULES,
  ...HEADING_RULES,
  ...STRUCTURE_RULES,
  ...CAPTION_RULES,
  ...REFERENCE_RULES,
  ...INTEGRITY_AND_LENGTH_RULES,
];

export type {
  Finding,
  FindingLocation,
  FixSuggestion,
  Rule,
  RuleCategory,
  RuleContext,
  RuleOutcome,
} from './types.ts';
