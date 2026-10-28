// Rules an institution declares in its rules file, without code.
//
// Each kind is a fixed check written and tested here; the file only supplies its data (the
// words, the part titles, the bounds). Nothing read from the file is ever compiled into a
// pattern or evaluated, so a rules file cannot slow the checker down or make it do anything
// these five checks do not already do.

import { countWords, excerpt, normalize } from '../analysis/text.ts';
import { titleMatches } from '../analysis/structure.ts';
import type { ParagraphModel } from '../model/types.ts';
import type { ConformityProfile, CustomRuleSpec, TextZone } from '../profile/types.ts';
import { bodyParagraphs } from './scope.ts';
import {
  at,
  capFindings,
  fail,
  pass,
  skip,
  type Finding,
  type Rule,
  type RuleContext,
} from './types.ts';

const ZONE_LABEL: Readonly<Record<TextZone, string>> = {
  body: 'le texte du travail',
  cover: 'la page de garde',
  document: 'le document',
};

/** Words only, accents and case folded, padded so a phrase matches on word boundaries. */
function words(text: string): string {
  return ` ${normalize(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
}

function containsPhrase(haystack: string, phrase: string): boolean {
  const needle = words(phrase).trim();
  return needle.length > 0 && haystack.includes(` ${needle} `);
}

function zoneParagraphs(ctx: RuleContext, zone: TextZone): readonly ParagraphModel[] {
  if (zone === 'cover') return ctx.structure.cover;
  if (zone === 'body') return bodyParagraphs(ctx.document, ctx.structure);
  return ctx.document.paragraphs;
}

/** The paragraph titled one of `aliases`, and the paragraphs of its content. */
function findPart(
  ctx: RuleContext,
  aliases: readonly string[]
): { readonly title: ParagraphModel; readonly content: readonly ParagraphModel[] } | null {
  const titles = ctx.structure.titles;
  const index = titles.findIndex((t) => titleMatches(t.text, aliases));
  if (index === -1) return null;
  const title = titles[index]!;
  // The part runs until the next title at its level or above; a title without a heading level
  // (a bold standalone line) counts as top level.
  const level = title.headingLevel ?? 1;
  const next = titles.slice(index + 1).find((t) => (t.headingLevel ?? 1) <= level);
  const end = next ? next.index : ctx.document.paragraphs.length;
  return { title, content: ctx.document.paragraphs.slice(title.index + 1, end) };
}

function lengthFindings(
  spec: CustomRuleSpec,
  profile: ConformityProfile,
  wordCount: number,
  what: string
): string[] {
  const pages = wordCount / profile.lengths.wordsPerPage;
  const pagesLabel = pages.toFixed(1).replace('.', ',');
  const problems: string[] = [];
  if (spec.minWords !== undefined && wordCount < spec.minWords)
    problems.push(`${what} compte ${wordCount} mots, le minimum est ${spec.minWords}.`);
  if (spec.maxWords !== undefined && wordCount > spec.maxWords)
    problems.push(`${what} compte ${wordCount} mots, le maximum est ${spec.maxWords}.`);
  if (spec.minPages !== undefined && pages < spec.minPages)
    problems.push(`${what} fait environ ${pagesLabel} page(s), le minimum est ${spec.minPages}.`);
  if (spec.maxPages !== undefined && pages > spec.maxPages)
    problems.push(`${what} fait environ ${pagesLabel} page(s), le maximum est ${spec.maxPages}.`);
  return problems;
}

type Check = (spec: CustomRuleSpec, ctx: RuleContext) => ReturnType<Rule['check']>;

const CHECKS: Readonly<Record<CustomRuleSpec['kind'], Check>> = {
  'forbidden-text'(spec, ctx) {
    const paragraphs = zoneParagraphs(ctx, spec.zone);
    if (paragraphs.length === 0) return skip(`${ZONE_LABEL[spec.zone]} est vide ou introuvable`);
    const findings: Finding[] = [];
    for (const p of paragraphs) {
      const text = words(p.text);
      const found = spec.values.find((value) => containsPhrase(text, value));
      if (found)
        findings.push({ message: `« ${found} » — « ${excerpt(p.text, 60)} »`, location: at(p) });
    }
    return fail(capFindings(findings, 'paragraphes'));
  },

  'required-text'(spec, ctx) {
    const paragraphs = zoneParagraphs(ctx, spec.zone);
    if (paragraphs.length === 0) return skip(`${ZONE_LABEL[spec.zone]} est vide ou introuvable`);
    const text = words(paragraphs.map((p) => p.text).join(' '));
    const first = paragraphs[0]!;
    return fail(
      spec.values
        .filter((value) => !containsPhrase(text, value))
        .map((value) => ({
          message: `« ${value} » est absent de ${ZONE_LABEL[spec.zone]}.`,
          location: at(first),
        }))
    );
  },

  'required-part'(spec, ctx) {
    return findPart(ctx, spec.values)
      ? pass()
      : fail([{ message: `Partie « ${spec.values[0]} » introuvable : ajoutez-la avec ce titre.` }]);
  },

  'part-length'(spec, ctx) {
    const part = findPart(ctx, spec.values);
    if (!part) return skip(`partie « ${spec.values[0]} » introuvable`);
    const total = part.content.reduce((sum, p) => sum + countWords(p.text), 0);
    const problems = lengthFindings(spec, ctx.profile, total, `« ${part.title.text} »`);
    return fail(
      problems.map((message) => ({ message, location: at(part.title) })),
      `${total} mots`
    );
  },

  'document-length'(spec, ctx) {
    const after = ctx.document.paragraphs.slice(ctx.structure.cover.length);
    const total = after.reduce((sum, p) => sum + countWords(p.text), 0);
    return fail(
      lengthFindings(spec, ctx.profile, total, 'Le travail').map((message) => ({ message })),
      `${total} mots`
    );
  },
};

/** The profile's declared requirements, as rules the engine runs like the built-in ones. */
export function customRules(profile: ConformityProfile): Rule[] {
  return profile.customRules.map((spec) => ({
    id: spec.id,
    title: spec.title,
    category: 'etablissement',
    severity: spec.severity,
    reference: spec.reference,
    check: (ctx) => CHECKS[spec.kind](spec, ctx),
  }));
}
