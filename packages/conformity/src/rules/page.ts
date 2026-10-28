// Mise en page: paper size, margins, page numbering (presence, position, format).

import type { PageNumberFormat, SectionModel } from '../model/types.ts';
import { TWIPS_PER_MM, twipsToCm } from './scope.ts';
import { fail, pass, skip, type Finding, type Rule, type RuleContext } from './types.ts';

const FORMAT_LABEL: Readonly<Record<PageNumberFormat, string>> = {
  decimal: 'chiffres arabes (1, 2, 3)',
  lowerRoman: 'chiffres romains (i, ii, iii)',
  upperRoman: 'chiffres romains (I, II, III)',
  lowerLetter: 'lettres (a, b, c)',
  upperLetter: 'lettres (A, B, C)',
  other: 'un format particulier',
};

const ALIGN_LABEL = {
  left: 'à gauche',
  center: 'au centre',
  right: 'à droite',
  justify: 'justifié',
  other: 'autre',
};

function sectionLabel(ctx: RuleContext, section: SectionModel): string {
  return ctx.document.sections.length > 1 ? `Section ${section.index + 1}` : 'Le document';
}

function firstParagraph(ctx: RuleContext, section: SectionModel) {
  return ctx.document.paragraphs
    .slice(section.firstParagraph, section.lastParagraph + 1)
    .find((p) => p.text);
}

/** Sections that hold part of the work itself, not only the cover. */
function contentSections(ctx: RuleContext): SectionModel[] {
  const firstContent = ctx.structure.cover.length;
  return ctx.document.sections.filter((s) => s.lastParagraph >= firstContent);
}

export const paperSizeRule: Rule = {
  id: 'page.format',
  title: 'Format de page A4',
  category: 'mise-en-page',
  severity: 'warning',
  reference: 'Le TFC est imprimé sur papier A4 (21 × 29,7 cm).',
  check(ctx) {
    const { widthMm, heightMm } = ctx.profile.page;
    const findings: Finding[] = [];
    for (const section of ctx.document.sections) {
      if (section.pageWidthTwips === null || section.pageHeightTwips === null) continue;
      const w = section.pageWidthTwips / TWIPS_PER_MM;
      const h = section.pageHeightTwips / TWIPS_PER_MM;
      const portrait = Math.abs(w - widthMm) <= 2 && Math.abs(h - heightMm) <= 2;
      const landscape = Math.abs(h - widthMm) <= 2 && Math.abs(w - heightMm) <= 2;
      if (!portrait && !landscape) {
        findings.push({
          message: `${sectionLabel(ctx, section)} : page de ${Math.round(w)} × ${Math.round(h)} mm au lieu de ${widthMm} × ${heightMm} mm.`,
        });
      }
    }
    return fail(findings);
  },
};

export const marginsRule: Rule = {
  id: 'page.marges',
  title: 'Marges',
  category: 'mise-en-page',
  severity: 'error',
  reference: 'Marges : 3,5 cm à gauche, 2,5 cm à droite, 3,5 cm en haut, 2,5 cm en bas (§1.2.1).',
  check(ctx) {
    const { marginsCm, marginToleranceMm } = ctx.profile.page;
    const expected = {
      top: Math.round(marginsCm.top * 10 * TWIPS_PER_MM),
      right: Math.round(marginsCm.right * 10 * TWIPS_PER_MM),
      bottom: Math.round(marginsCm.bottom * 10 * TWIPS_PER_MM),
      left: Math.round(marginsCm.left * 10 * TWIPS_PER_MM),
    };
    const tolerance = marginToleranceMm * TWIPS_PER_MM;
    const names = { top: 'haut', right: 'droite', bottom: 'bas', left: 'gauche' } as const;
    const findings: Finding[] = [];
    for (const section of ctx.document.sections) {
      if (!section.margins) continue;
      const wrong = (Object.keys(names) as (keyof typeof names)[]).filter(
        (side) => Math.abs(section.margins![side] - expected[side]) > tolerance
      );
      if (wrong.length === 0) continue;
      const detail = wrong.map(
        (side) =>
          `${names[side]} ${twipsToCm(section.margins![side])} cm (attendu ${twipsToCm(expected[side])})`
      );
      const anchor = firstParagraph(ctx, section);
      findings.push({
        message: `${sectionLabel(ctx, section)} : ${detail.join(', ')}.`,
        ...(anchor ? { location: { paragraphIndex: anchor.index, text: anchor.text } } : {}),
        fix: {
          kind: 'set-page-margins',
          label: 'Appliquer les marges de la norme',
          marginsTwips: expected,
        },
      });
    }
    return fail(findings);
  },
};

export const pageNumberPresenceRule: Rule = {
  id: 'page.numerotation',
  title: 'Pages numérotées',
  category: 'mise-en-page',
  severity: 'error',
  reference: 'Toutes les pages, sauf la page de garde, portent un numéro de page (§1.2.1).',
  check(ctx) {
    const sections = contentSections(ctx);
    if (sections.length === 0) return skip('document vide');
    const missing = sections.filter((s) => s.pageNumber === null);
    return fail(
      missing.map((section) => {
        const anchor = firstParagraph(ctx, section);
        return {
          message: `${sectionLabel(ctx, section)} : aucun numéro de page (champ PAGE absent de l'en-tête et du pied de page).`,
          ...(anchor ? { location: { paragraphIndex: anchor.index, text: anchor.text } } : {}),
        };
      })
    );
  },
};

export const pageNumberPositionRule: Rule = {
  id: 'page.position-numero',
  title: 'Position du numéro de page',
  category: 'mise-en-page',
  severity: 'warning',
  reference: 'Position des numéros de pages : au coin droit (§1.2.1).',
  check(ctx) {
    const numbered = contentSections(ctx).filter((s) => s.pageNumber !== null);
    if (numbered.length === 0) return skip('aucun numéro de page à vérifier');
    const expected = ctx.profile.page.numberAlignment;
    const wrong = numbered.filter((s) => s.pageNumber!.alignment !== expected);
    return fail(
      wrong.map((section) => ({
        message: `${sectionLabel(ctx, section)} : numéro de page aligné ${ALIGN_LABEL[section.pageNumber!.alignment]} au lieu de ${ALIGN_LABEL[expected]}.`,
      }))
    );
  },
};

export const pageNumberFormatRule: Rule = {
  id: 'page.format-numero',
  title: 'Numérotation liminaires / corps du travail',
  category: 'mise-en-page',
  severity: 'warning',
  reference:
    'Pages liminaires et corps du travail sont numérotés séparément (§1.2.1). Format retenu par le profil, à confirmer avec le directeur.',
  check(ctx) {
    const intro = ctx.structure.part('introduction');
    if (!intro)
      return skip('introduction générale introuvable : impossible de séparer liminaires et corps');
    const { liminaryNumberFormat: liminary, bodyNumberFormat: body } = ctx.profile.page;
    const sections = ctx.document.sections;
    const bodySection = sections[intro.title.sectionIndex];
    if (!bodySection) return skip('section de l’introduction introuvable');
    const introLocation = { paragraphIndex: intro.title.index, text: intro.title.text };
    // Anything but empty lines between the section start and the introduction title means the
    // preliminary pages share the introduction's section — and therefore its numbering.
    const sharesSection = ctx.document.paragraphs
      .slice(Math.max(bodySection.firstParagraph, ctx.structure.cover.length), intro.title.index)
      .some((p) => p.text);
    if (sharesSection) {
      return fail([
        {
          message:
            'Les pages liminaires et l’introduction sont dans la même section : elles ne peuvent pas avoir chacune leur numérotation. Insérez un saut de section (page suivante) juste avant l’introduction.',
          location: introLocation,
        },
      ]);
    }
    const findings: Finding[] = [];
    if (bodySection.numberFormat !== body) {
      findings.push({
        message: `Corps du travail numéroté en ${FORMAT_LABEL[bodySection.numberFormat]} au lieu de ${FORMAT_LABEL[body]}.`,
        location: { paragraphIndex: intro.title.index, text: intro.title.text },
      });
    }
    if (bodySection.numberStart !== 1) {
      findings.push({
        message: 'La numérotation du corps du travail doit recommencer à 1 à l’introduction.',
        location: introLocation,
      });
    }
    for (const section of sections.slice(0, intro.title.sectionIndex)) {
      if (section.lastParagraph < ctx.structure.cover.length) continue; // cover only
      if (section.numberFormat !== liminary) {
        findings.push({
          message: `Pages liminaires (section ${section.index + 1}) numérotées en ${FORMAT_LABEL[section.numberFormat]} au lieu de ${FORMAT_LABEL[liminary]}.`,
        });
      }
    }
    return findings.length ? fail(findings) : pass();
  },
};

export const PAGE_RULES: readonly Rule[] = [
  paperSizeRule,
  marginsRule,
  pageNumberPresenceRule,
  pageNumberPositionRule,
  pageNumberFormatRule,
];
