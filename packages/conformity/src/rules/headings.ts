// Titres: the per-level style the norm imposes, and the coherence of section numbering
// (duplicates, gaps, a "1.1.1" sitting inside chapter 4) — the errors a hand-maintained
// numbering produces and an automatic table of contents then faithfully reproduces.

import { excerpt, splitNumbering } from '../analysis/text.ts';
import { chapterOf } from './scope.ts';
import { at, capFindings, fail, skip, type Finding, type Rule } from './types.ts';

const CASE_LABEL = { upper: 'en MAJUSCULES', lower: 'en minuscules', any: '' } as const;

export const headingFormatRule: Rule = {
  id: 'titres.format',
  title: 'Mise en forme des titres',
  category: 'titres',
  severity: 'warning',
  reference:
    'Titre 1 : majuscule gras 12 pt · Titre 2 : minuscule gras · Titre 3 : minuscule italique gras · Titre 4 : minuscule italique simple (§1.3.1).',
  check(ctx) {
    const specs = ctx.profile.headings;
    const headings = ctx.document.paragraphs.filter(
      (p) =>
        p.role === 'heading' &&
        p.headingLevel !== null &&
        p.headingLevel <= specs.length &&
        p.index >= ctx.structure.cover.length
    );
    if (headings.length === 0)
      return skip('aucun titre utilisant les styles « Titre 1…4 » : utilisez les styles de titre');
    const findings: Finding[] = [];
    for (const h of headings) {
      const spec = specs[h.headingLevel! - 1]!;
      const f = h.formatting;
      const problems: string[] = [];
      if (spec.bold !== f.bold)
        problems.push(spec.bold ? 'devrait être en gras' : 'ne devrait pas être en gras');
      if (spec.italic !== f.italic)
        problems.push(spec.italic ? 'devrait être en italique' : 'ne devrait pas être en italique');
      if (spec.textCase === 'upper' && !f.caps) problems.push(`devrait être ${CASE_LABEL.upper}`);
      if (spec.textCase === 'lower' && f.caps)
        problems.push(`ne devrait pas être ${CASE_LABEL.upper}`);
      const size = f.sizesPt[0];
      if (size !== undefined && Math.abs(size - spec.sizePt) > 0.25)
        problems.push(`taille ${size} pt au lieu de ${spec.sizePt} pt`);
      if (problems.length) {
        findings.push({
          message: `Titre ${h.headingLevel} « ${excerpt(h.text, 50)} » : ${problems.join(', ')}.`,
          location: at(h),
        });
      }
    }
    return fail(capFindings(findings, 'titres'));
  },
};

interface Numbered {
  readonly parts: readonly number[];
  readonly label: string;
  readonly paragraph: { readonly index: number; readonly text: string };
}

export const headingNumberingRule: Rule = {
  id: 'titres.numerotation',
  title: 'Numérotation des sections',
  category: 'titres',
  severity: 'error',
  reference: 'La numérotation chapitre / section / sous-section suit le modèle de la norme (§1.1).',
  check(ctx) {
    const numbered: Numbered[] = [];
    for (const title of ctx.structure.titles) {
      if (title.role === 'toc') continue;
      const { number } = splitNumbering(title.text);
      if (!number || !number.includes('.') || !/^[\d.]+$/.test(number)) continue;
      numbered.push({ parts: number.split('.').map(Number), label: number, paragraph: title });
    }
    if (numbered.length === 0) return skip('aucun titre numéroté (1.1, 1.2…) trouvé');

    const findings: Finding[] = [];
    const seen = new Map<string, Numbered>();
    const lastChild = new Map<string, number>();
    for (const entry of numbered) {
      const where = { location: at(entry.paragraph) };
      const chapter = chapterOf(ctx.structure, entry.paragraph.index);
      if (chapter !== null && entry.parts[0] !== chapter) {
        findings.push({
          message: `« ${excerpt(entry.paragraph.text, 50)} » est dans le chapitre ${chapter} mais numéroté ${entry.label}.`,
          ...where,
        });
      }
      const previous = seen.get(entry.label);
      if (previous) {
        findings.push({
          message: `Numéro ${entry.label} utilisé deux fois (« ${excerpt(previous.paragraph.text, 40)} » et « ${excerpt(entry.paragraph.text, 40)} »).`,
          ...where,
        });
        continue;
      }
      seen.set(entry.label, entry);

      const parentKey = entry.parts.slice(0, -1).join('.');
      const own = entry.parts[entry.parts.length - 1]!;
      const last = lastChild.get(parentKey);
      if (last !== undefined && own !== last + 1 && own > last) {
        const missing = Array.from(
          { length: own - last - 1 },
          (_, i) => `${parentKey}.${last + 1 + i}`
        );
        findings.push({
          message: `Saut de numérotation : ${parentKey}.${last} est suivi de ${entry.label} (${missing.join(', ')} manquant).`,
          ...where,
        });
      } else if (last !== undefined && own <= last) {
        findings.push({
          message: `Ordre de numérotation incorrect : ${entry.label} vient après ${parentKey}.${last}.`,
          ...where,
        });
      } else if (last === undefined && own > 1) {
        findings.push({
          message: `${entry.label} est la première sous-section de ${parentKey} : la numérotation devrait commencer à ${parentKey}.1.`,
          ...where,
        });
      }
      lastChild.set(parentKey, Math.max(own, last ?? own));
    }
    return fail(capFindings(findings, 'problèmes de numérotation'));
  },
};

export const HEADING_RULES: readonly Rule[] = [headingFormatRule, headingNumberingRule];
