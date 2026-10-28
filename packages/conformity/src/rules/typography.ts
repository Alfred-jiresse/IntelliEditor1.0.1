// Typographie du texte courant: police, taille, interligne.
//
// Judged over BODY paragraphs only (headings, captions and the cover have their own rules),
// and with a small tolerance: one odd paragraph in two hundred should be reported, not turn
// the whole document red.

import type { ParagraphModel } from '../model/types.ts';
import { excerpt } from '../analysis/text.ts';
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

function judge(
  ctx: RuleContext,
  isWrong: (p: ParagraphModel) => string | null,
  noun: string
): ReturnType<Rule['check']> {
  const body = bodyParagraphs(ctx.document, ctx.structure);
  if (body.length === 0) return skip('aucun texte courant à vérifier');
  const findings: Finding[] = [];
  for (const p of body) {
    const problem = isWrong(p);
    if (problem)
      findings.push({ message: `${problem} — « ${excerpt(p.text, 60)} »`, location: at(p) });
  }
  const share = findings.length / body.length;
  const summary = `${body.length - findings.length}/${body.length} paragraphes conformes`;
  if (findings.length === 0) return pass(summary);
  // Within tolerance the rule still lists what it found, but as a pass.
  if (share <= ctx.profile.typography.deviationTolerance)
    return pass(`${summary} (écarts tolérés)`);
  return fail(capFindings(findings, noun), summary);
}

export const bodyFontRule: Rule = {
  id: 'typo.police',
  title: 'Police du texte',
  category: 'typographie',
  severity: 'error',
  reference: 'Police Times New Roman (§1.3.1).',
  check(ctx) {
    const allowed = ctx.profile.typography.bodyFonts.map((f) => f.toLowerCase());
    return judge(
      ctx,
      (p) => {
        const font = p.formatting.fonts[0];
        return font && !allowed.includes(font.toLowerCase()) ? `Police « ${font} »` : null;
      },
      'paragraphes'
    );
  },
};

export const bodySizeRule: Rule = {
  id: 'typo.taille',
  title: 'Taille du texte',
  category: 'typographie',
  severity: 'error',
  reference: 'Taille de la police pour le texte normal : 12 pt (§1.3.1).',
  check(ctx) {
    const expected = ctx.profile.typography.bodySizePt;
    return judge(
      ctx,
      (p) => {
        const size = p.formatting.sizesPt[0];
        return size !== undefined && Math.abs(size - expected) > 0.25
          ? `Taille ${size} pt au lieu de ${expected} pt`
          : null;
      },
      'paragraphes'
    );
  },
};

export const lineSpacingRule: Rule = {
  id: 'typo.interligne',
  title: 'Interligne',
  category: 'typographie',
  severity: 'warning',
  reference: 'Interligne 1,25 (§1.3.1).',
  check(ctx) {
    const { lineSpacing: expected, lineSpacingTolerance: tolerance } = ctx.profile.typography;
    return judge(
      ctx,
      (p) => {
        const spacing = p.lineSpacing ?? { kind: 'multiple' as const, value: 1 };
        if (spacing.kind !== 'multiple')
          return `Interligne fixe de ${spacing.points} pt au lieu de ${expected}`;
        return Math.abs(spacing.value - expected) > tolerance
          ? `Interligne ${String(spacing.value).replace('.', ',')} au lieu de ${String(expected).replace('.', ',')}`
          : null;
      },
      'paragraphes'
    );
  },
};

export const TYPOGRAPHY_RULES: readonly Rule[] = [bodyFontRule, bodySizeRule, lineSpacingRule];
