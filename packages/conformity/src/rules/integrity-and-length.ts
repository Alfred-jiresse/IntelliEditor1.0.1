// Intégrité (broken cross-references a reader sees on paper) and longueur (page budgets).
//
// Lengths are ESTIMATES from word counts: the engine reads the file, not the laid-out pages.
// They are reported as warnings and say so.

import { countWords, excerpt } from '../analysis/text.ts';
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

/** What Word prints when a field points at something that no longer exists. */
const BROKEN_FIELD =
  /erreur\s*!\s*(signet non d[ée]fini|source du renvoi introuvable|aucune entr[ée]e de table|r[ée]f[ée]rence non valide)|error!\s*(bookmark not defined|reference source not found|no table of (contents|figures) entries found)/i;

export const brokenFieldsRule: Rule = {
  id: 'integrite.champs',
  title: 'Renvois et champs cassés',
  category: 'integrite',
  severity: 'error',
  reference:
    'Un document déposé ne doit contenir aucun message d’erreur de champ (« Erreur ! Signet non défini. »).',
  check(ctx) {
    const broken = ctx.document.paragraphs.filter((p) => BROKEN_FIELD.test(p.text));
    const findings: Finding[] = broken.map((p) => ({
      message: `Renvoi cassé : « ${excerpt(p.text, 70)} ». Mettez à jour les champs ou recréez le signet/la légende.`,
      location: at(p),
    }));
    return fail(
      capFindings(findings, 'renvois cassés'),
      broken.length ? `${broken.length} renvoi(s) cassé(s)` : undefined
    );
  },
};

function words(ctx: RuleContext, from: number, to: number): number {
  return ctx.document.paragraphs
    .slice(from, to + 1)
    .filter((p) => p.role !== 'toc' && p.role !== 'empty')
    .reduce((sum, p) => sum + countWords(p.text), 0);
}

const pages = (ctx: RuleContext, wordCount: number) =>
  Math.max(1, Math.round((wordCount / ctx.profile.lengths.wordsPerPage) * 10) / 10);

export const introductionLengthRule: Rule = {
  id: 'longueur.introduction',
  title: "Longueur de l'introduction",
  category: 'longueur',
  severity: 'warning',
  reference:
    'L’introduction doit avoir au plus 6 pages (§1.1). Estimation à partir du nombre de mots.',
  check(ctx) {
    const intro = ctx.structure.part('introduction');
    if (!intro) return skip('introduction générale introuvable');
    const estimate = pages(ctx, words(ctx, intro.contentStart, intro.contentEnd));
    const max = ctx.profile.lengths.introductionMaxPages;
    const summary = `≈ ${String(estimate).replace('.', ',')} page(s)`;
    return estimate <= max
      ? pass(summary)
      : fail(
          [
            {
              message: `Introduction d'environ ${String(estimate).replace('.', ',')} pages (maximum ${max}).`,
              location: at(intro.title),
            },
          ],
          summary
        );
  },
};

export const chapterLengthRule: Rule = {
  id: 'longueur.chapitres',
  title: 'Longueur des chapitres',
  category: 'longueur',
  severity: 'warning',
  reference:
    'Chapitres d’au plus 20 pages chacun, dans la mesure du possible (§1.1). Estimation à partir du nombre de mots.',
  check(ctx) {
    if (ctx.structure.chapters.length === 0) return skip('aucun chapitre détecté');
    const max = ctx.profile.lengths.chapterMaxPages;
    const findings: Finding[] = [];
    for (const chapter of ctx.structure.chapters) {
      const estimate = pages(ctx, words(ctx, chapter.contentStart, chapter.contentEnd));
      if (estimate > max) {
        findings.push({
          message: `Chapitre ${chapter.announcedNumber ?? chapter.ordinal} : environ ${String(estimate).replace('.', ',')} pages (maximum ${max}).`,
          location: at(chapter.title),
        });
      }
    }
    return findings.length ? fail(findings) : pass();
  },
};

export const INTEGRITY_AND_LENGTH_RULES: readonly Rule[] = [
  brokenFieldsRule,
  introductionLengthRule,
  chapterLengthRule,
];
