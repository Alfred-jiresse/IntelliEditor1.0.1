// Légendes: tables are titled ABOVE, figures BELOW, both numbered "chapitre.ordre".

import type { BlockModel, ParagraphModel } from '../model/types.ts';
import { excerpt } from '../analysis/text.ts';
import { chapterOf } from './scope.ts';
import { at, capFindings, fail, skip, type Finding, type Rule, type RuleContext } from './types.ts';

const TABLE_CAPTION = /^(tableau|table)\s/i;
const FIGURE_CAPTION = /^figure\s/i;
const CAPTION_NUMBER = /^(figure|tableau|table)\s+(\d+)(?:\s*[.\-–]\s*(\d+))?/i;

/** Nearest non-empty paragraph before/after block `i`, skipping blank lines. */
function neighbour(blocks: readonly BlockModel[], i: number, step: -1 | 1): ParagraphModel | null {
  for (let j = i + step; j >= 0 && j < blocks.length; j += step) {
    const block = blocks[j]!;
    if (block.kind === 'table') return null;
    if (block.paragraph.role !== 'empty') return block.paragraph;
  }
  return null;
}

const isCaption = (p: ParagraphModel | null, pattern: RegExp): p is ParagraphModel =>
  p !== null && p.role === 'caption' && pattern.test(p.text);

function inCover(ctx: RuleContext, index: number): boolean {
  return index < ctx.structure.cover.length;
}

export const captionPositionRule: Rule = {
  id: 'legendes.position',
  title: 'Position des légendes',
  category: 'legendes',
  severity: 'error',
  reference:
    'Le titre d’un tableau est au-dessus du tableau ; celui d’une figure en dessous (§1.3.1).',
  check(ctx) {
    const { blocks } = ctx.document;
    const tableAbove = ctx.profile.captions.tableCaptionPosition === 'above';
    const figureBelow = ctx.profile.captions.figureCaptionPosition === 'below';
    const findings: Finding[] = [];
    let judged = 0;
    blocks.forEach((block, i) => {
      if (block.kind === 'table') {
        const before = neighbour(blocks, i, -1);
        if (before && inCover(ctx, before.index)) return;
        judged++;
        const after = neighbour(blocks, i, 1);
        const expected = tableAbove ? before : after;
        const wrongSide = tableAbove ? after : before;
        if (isCaption(expected, TABLE_CAPTION)) return;
        const anchor = before ?? after;
        if (isCaption(wrongSide, TABLE_CAPTION)) {
          findings.push({
            message: `« ${excerpt(wrongSide.text, 50)} » est ${tableAbove ? 'sous' : 'au-dessus du'} le tableau : la légende d’un tableau se place ${tableAbove ? 'au-dessus' : 'en dessous'}.`,
            location: at(wrongSide),
          });
        } else {
          findings.push({
            message: `Tableau sans légende (« Tableau N.M … ») ${tableAbove ? 'au-dessus' : 'en dessous'} — commence par « ${excerpt(block.firstCellText, 30)} ».`,
            ...(anchor ? { location: at(anchor) } : {}),
          });
        }
        return;
      }
      const p = block.paragraph;
      if (!p.hasDrawing || inCover(ctx, p.index)) return;
      judged++;
      const before = neighbour(blocks, i, -1);
      const after = neighbour(blocks, i, 1);
      const expected = figureBelow ? after : before;
      const wrongSide = figureBelow ? before : after;
      if (
        isCaption(expected, FIGURE_CAPTION) ||
        (p.role === 'caption' && FIGURE_CAPTION.test(p.text))
      )
        return;
      if (isCaption(wrongSide, FIGURE_CAPTION)) {
        findings.push({
          message: `« ${excerpt(wrongSide.text, 50)} » est ${figureBelow ? 'au-dessus de' : 'sous'} la figure : la légende d’une figure se place ${figureBelow ? 'en dessous' : 'au-dessus'}.`,
          location: at(wrongSide),
        });
      } else {
        findings.push({ message: 'Figure sans légende (« Figure N.M … »).', location: at(p) });
      }
    });
    if (judged === 0) return skip('aucun tableau ni aucune figure');
    return fail(capFindings(findings, 'légendes'));
  },
};

export const captionNumberingRule: Rule = {
  id: 'legendes.numerotation',
  title: 'Numérotation des légendes',
  category: 'legendes',
  severity: 'warning',
  reference:
    'Numéro à deux chiffres : n° du chapitre, puis rang dans le chapitre (Tableau 1.1, Figure 1.2) (§1.3.1).',
  check(ctx) {
    const captions = ctx.document.paragraphs.filter(
      (p) => p.role === 'caption' && p.index >= ctx.structure.cover.length
    );
    if (captions.length === 0) return skip('aucune légende');
    const findings: Finding[] = [];
    const lastByKind = new Map<string, { chapter: number; order: number }>();
    const seen = new Set<string>();
    for (const caption of captions) {
      const match = CAPTION_NUMBER.exec(caption.text);
      if (!match) continue;
      const kind = match[1]!.toLowerCase().startsWith('fig') ? 'Figure' : 'Tableau';
      const first = Number(match[2]);
      const second = match[3] !== undefined ? Number(match[3]) : null;
      const label = second === null ? `${kind} ${first}` : `${kind} ${first}.${second}`;
      const where = { location: at(caption) };
      if (seen.has(label)) {
        findings.push({ message: `${label} est numérotée deux fois.`, ...where });
        continue;
      }
      seen.add(label);
      if (!ctx.profile.captions.chapterNumbering) continue;
      if (second === null) {
        findings.push({
          message: `« ${excerpt(caption.text, 50)} » : numérotation simple, la norme demande « chapitre.ordre ».`,
          ...where,
        });
        continue;
      }
      const chapter = chapterOf(ctx.structure, caption.index);
      if (chapter !== null && first !== chapter) {
        findings.push({
          message: `${label} se trouve dans le chapitre ${chapter} : numéro ${kind} ${chapter}.x attendu.`,
          ...where,
        });
      }
      const last = lastByKind.get(kind);
      const expectedOrder = last && last.chapter === first ? last.order + 1 : 1;
      if (second !== expectedOrder) {
        findings.push({
          message: `${label} : ${kind} ${first}.${expectedOrder} attendue à cet endroit (ordre dans le chapitre).`,
          ...where,
        });
      }
      lastByKind.set(kind, { chapter: first, order: second });
    }
    return fail(capFindings(findings, 'légendes'));
  },
};

export const CAPTION_RULES: readonly Rule[] = [captionPositionRule, captionNumberingRule];
