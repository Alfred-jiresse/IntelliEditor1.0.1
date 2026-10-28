#!/usr/bin/env bun
/* eslint-disable no-console -- a command-line tool: printing the report IS its output. */
// Command-line checker: `bun packages/conformity/src/cli.ts fichier.docx [--profil regles.json] [--json]`
//
// The same engine the editor runs, without the editor — how a batch of deposited TFC is
// measured for the validation chapter, and how CI can gate a document.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { checkDocx, type ConformityReport } from './engine.ts';
import { parseProfile } from './profile/parse-profile.ts';
import { UDBL_TFC_PROFILE } from './profile/udbl-tfc.ts';

const LEVEL = {
  conforme: '🟢 CONFORME',
  'a-revoir': '🟠 À REVOIR',
  'non-conforme': '🔴 NON CONFORME',
} as const;
const STATUS = { pass: '✔', fail: '✘', skip: '–' } as const;

function print(file: string, report: ConformityReport): void {
  const s = report.summary;
  console.log(`\n${basename(file)} — ${LEVEL[s.level]} — score ${s.score}/100`);
  console.log(
    `  ${report.stats.paragraphs} paragraphes, ${report.stats.words} mots, ${report.stats.sections} section(s), ${report.stats.chapters} chapitre(s)`
  );
  console.log(
    `  ${s.passed} règle(s) respectée(s), ${s.failed} non respectée(s) (${s.errors} erreur(s), ${s.warnings} avertissement(s)), ${s.skipped} non vérifiable(s)\n`
  );
  for (const result of report.results) {
    const tail =
      result.status === 'skip'
        ? ` (${result.reason})`
        : result.summary
          ? ` (${result.summary})`
          : '';
    console.log(`  ${STATUS[result.status]} [${result.severity}] ${result.title}${tail}`);
    for (const finding of result.findings) console.log(`      • ${finding.message}`);
  }
}

const args = process.argv.slice(2);
const json = args.includes('--json');
const profileIndex = args.findIndex((a) => a === '--profil' || a === '--profile');
let profile = UDBL_TFC_PROFILE;
if (profileIndex >= 0) {
  const parsed = parseProfile(JSON.parse(readFileSync(args[profileIndex + 1]!, 'utf8')));
  if (!parsed.ok) {
    console.error(`Profil invalide :\n  ${parsed.errors.join('\n  ')}`);
    process.exit(2);
  }
  profile = parsed.profile;
}
const files = args.filter(
  (a, i) => a.endsWith('.docx') && (profileIndex < 0 || i !== profileIndex + 1)
);
if (files.length === 0) {
  console.error(
    'Usage : bun packages/conformity/src/cli.ts fichier.docx [...] [--profil regles.json] [--json]'
  );
  process.exit(2);
}

let failed = false;
for (const file of files) {
  const run = checkDocx(new Uint8Array(readFileSync(file)), profile);
  if (!run.ok) {
    console.error(`${file} : ${run.reason}`);
    failed = true;
    continue;
  }
  if (json) console.log(JSON.stringify({ file, ...run.report }, null, 2));
  else print(file, run.report);
  if (run.report.summary.level === 'non-conforme') failed = true;
}
process.exit(failed ? 1 : 0);
