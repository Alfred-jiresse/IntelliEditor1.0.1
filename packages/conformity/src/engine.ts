// The engine: read → analyze → run every enabled rule → report.
//
// Rules are isolated from one another: one that throws on an unforeseen document shape is
// reported as "not verified" instead of taking the whole report down — a checker that goes
// silent on a strange file would be worse than one that admits a blind spot.

import { analyzeStructure } from './analysis/structure.ts';
import type { DocumentModel } from './model/types.ts';
import type { ConformityProfile, Severity } from './profile/types.ts';
import { UDBL_TFC_PROFILE } from './profile/udbl-tfc.ts';
import { readDocumentModel } from './reader/index.ts';
import { customRules } from './rules/custom.ts';
import { ALL_RULES } from './rules/index.ts';
import type { Finding, Rule, RuleCategory, RuleContext } from './rules/types.ts';

export type RuleStatus = 'pass' | 'fail' | 'skip';

export interface RuleResult {
  readonly id: string;
  readonly title: string;
  readonly category: RuleCategory;
  readonly severity: Severity;
  readonly reference: string;
  readonly status: RuleStatus;
  readonly summary?: string;
  /** Why the rule could not be verified (status `skip`). */
  readonly reason?: string;
  readonly findings: readonly Finding[];
}

/** 🟢 conforme · 🟠 à revoir (warnings only) · 🔴 non conforme (at least one error). */
export type ConformityLevel = 'conforme' | 'a-revoir' | 'non-conforme';

export interface ConformitySummary {
  readonly level: ConformityLevel;
  /** 0–100, severity-weighted share of verified rules that pass. */
  readonly score: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
}

export interface ConformityReport {
  readonly profile: { readonly id: string; readonly name: string; readonly source: string };
  readonly results: readonly RuleResult[];
  readonly summary: ConformitySummary;
  readonly stats: {
    readonly paragraphs: number;
    readonly sections: number;
    readonly words: number;
    readonly chapters: number;
  };
}

export type ConformityRun =
  | { readonly ok: true; readonly report: ConformityReport }
  | { readonly ok: false; readonly reason: string };

const WEIGHT: Readonly<Record<Severity, number>> = { error: 3, warning: 2, info: 1 };

function runRule(rule: Rule, context: RuleContext, severity: Severity): RuleResult {
  const base = {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity,
    reference: rule.reference,
  };
  try {
    const outcome = rule.check(context);
    switch (outcome.status) {
      case 'pass':
        return {
          ...base,
          status: 'pass',
          findings: [],
          ...(outcome.summary ? { summary: outcome.summary } : {}),
        };
      case 'fail':
        return {
          ...base,
          status: 'fail',
          findings: outcome.findings,
          ...(outcome.summary ? { summary: outcome.summary } : {}),
        };
      case 'skip':
        return { ...base, status: 'skip', reason: outcome.reason, findings: [] };
    }
  } catch (error) {
    return {
      ...base,
      status: 'skip',
      reason: `vérification impossible (${error instanceof Error ? error.message : 'erreur interne'})`,
      findings: [],
    };
  }
}

function summarize(results: readonly RuleResult[]): ConformitySummary {
  const failed = results.filter((r) => r.status === 'fail');
  const verified = results.filter((r) => r.status !== 'skip');
  const total = verified.reduce((sum, r) => sum + WEIGHT[r.severity], 0);
  const lost = failed.reduce((sum, r) => sum + WEIGHT[r.severity], 0);
  const errors = failed.filter((r) => r.severity === 'error').length;
  const warnings = failed.filter((r) => r.severity === 'warning').length;
  return {
    level: errors > 0 ? 'non-conforme' : warnings > 0 ? 'a-revoir' : 'conforme',
    score: total === 0 ? 0 : Math.round(((total - lost) / total) * 100),
    passed: results.filter((r) => r.status === 'pass').length,
    failed: failed.length,
    skipped: results.length - verified.length,
    errors,
    warnings,
    infos: failed.length - errors - warnings,
  };
}

/**
 * Check an already-read document model against a profile. Pure and synchronous. By default the
 * built-in rules run, then the requirements the profile declares (`customRules`).
 */
export function checkDocument(
  document: DocumentModel,
  profile: ConformityProfile = UDBL_TFC_PROFILE,
  rules: readonly Rule[] = [...ALL_RULES, ...customRules(profile)]
): ConformityReport {
  const structure = analyzeStructure(document, profile);
  const context: RuleContext = { document, structure, profile };
  const results: RuleResult[] = [];
  for (const rule of rules) {
    const override = profile.rules[rule.id];
    if (override?.enabled === false) continue;
    results.push(runRule(rule, context, override?.severity ?? rule.severity));
  }
  return {
    profile: { id: profile.id, name: profile.name, source: profile.source },
    results,
    summary: summarize(results),
    stats: {
      paragraphs: document.paragraphs.length,
      sections: document.sections.length,
      words: document.wordCount,
      chapters: structure.chapters.length,
    },
  };
}

/** Check DOCX bytes. Never throws: an unreadable file is a typed refusal. */
export function checkDocx(
  bytes: Uint8Array,
  profile: ConformityProfile = UDBL_TFC_PROFILE
): ConformityRun {
  const read = readDocumentModel(bytes);
  if (!read.ok) return read;
  return { ok: true, report: checkDocument(read.document, profile) };
}
