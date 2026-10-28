// Structure du travail: cover page, required parts and their order, introduction sections,
// chapters, empty parts, and whether the table of contents and the lists are GENERATED
// (the MRS grid grades "gestion automatique de la table des matières").

import { excerpt, normalize } from '../analysis/text.ts';
import { at, capFindings, fail, pass, skip, type Finding, type Rule } from './types.ts';

const isFieldList = (instr: string, kind: RegExp) => /^TOC\b/i.test(instr) && kind.test(instr);

export const coverRule: Rule = {
  id: 'structure.page-de-garde',
  title: 'Page de garde',
  category: 'structure',
  severity: 'error',
  reference:
    'Feuille de garde selon le modèle UDBL : institution, faculté, thème, « Travail présenté et défendu… », auteur, directeur.',
  check(ctx) {
    if (ctx.structure.cover.length === 0) {
      return fail([
        {
          message:
            'Aucune page de garde : le document commence directement par une partie du travail.',
        },
      ]);
    }
    const text = normalize(ctx.structure.cover.map((p) => p.text).join(' '));
    const missing = ctx.profile.cover.requiredMentions.filter((m) => !text.includes(normalize(m)));
    return fail(
      missing.map((m) => ({ message: `Mention absente de la page de garde : « ${m} ».` }))
    );
  },
};

export const requiredPartsRule: Rule = {
  id: 'structure.parties-obligatoires',
  title: 'Parties obligatoires',
  category: 'structure',
  severity: 'error',
  reference: 'Liminaires, introduction, chapitres, conclusion générale, références (§1.1).',
  check(ctx) {
    const missing = ctx.profile.structure.parts.filter(
      (spec) => spec.required && !ctx.structure.part(spec.id)
    );
    return fail(missing.map((spec) => ({ message: `Partie manquante : « ${spec.label} ».` })));
  },
};

export const partOrderRule: Rule = {
  id: 'structure.ordre',
  title: 'Ordre des parties',
  category: 'structure',
  severity: 'warning',
  reference:
    'Ordre imposé : garde, épigraphe, dédicace, remerciements, listes, table des matières, avant-propos, introduction… (§1.1).',
  check(ctx) {
    const order = new Map(ctx.profile.structure.parts.map((spec, i) => [spec.id, i]));
    const found = [...ctx.structure.parts].sort((a, b) => a.title.index - b.title.index);
    const findings: Finding[] = [];
    for (let i = 1; i < found.length; i++) {
      const before = found[i - 1]!;
      const current = found[i]!;
      if ((order.get(current.spec.id) ?? 0) < (order.get(before.spec.id) ?? 0)) {
        findings.push({
          message: `« ${current.spec.label} » devrait venir avant « ${before.spec.label} ».`,
          location: at(current.title),
        });
      }
    }
    return found.length < 2
      ? skip('trop peu de parties reconnues pour juger l’ordre')
      : fail(findings);
  },
};

export const introductionSectionsRule: Rule = {
  id: 'structure.introduction',
  title: "Contenu de l'introduction générale",
  category: 'structure',
  severity: 'error',
  reference:
    'Problématique, hypothèses, choix et intérêt, méthodologie, état de l’art, délimitation, subdivision (§1.1 ; MRS).',
  check(ctx) {
    const intro = ctx.structure.part('introduction');
    if (!intro) return skip('introduction générale introuvable');
    const missing = ctx.profile.structure.introductionSections.filter(
      (spec) => spec.required && !ctx.structure.introductionSections.has(spec.id)
    );
    return fail(
      missing.map((spec) => ({
        message: `Section absente de l'introduction : « ${spec.label} ».`,
        location: at(intro.title),
      }))
    );
  },
};

export const chapterCountRule: Rule = {
  id: 'structure.chapitres',
  title: 'Nombre de chapitres',
  category: 'structure',
  severity: 'warning',
  reference: 'Au maximum 4 chapitres (§1.1).',
  check(ctx) {
    const { minChapters, maxChapters } = ctx.profile.structure;
    const count = ctx.structure.chapters.length;
    const summary = `${count} chapitre(s) détecté(s)`;
    if (count < minChapters)
      return fail(
        [
          {
            message: `Aucun chapitre détecté entre l'introduction et la conclusion (minimum ${minChapters}).`,
          },
        ],
        summary
      );
    if (count > maxChapters) {
      return fail(
        [
          {
            message: `${count} chapitres : la norme en recommande ${maxChapters} au maximum.`,
            location: at(ctx.structure.chapters[maxChapters]!.title),
          },
        ],
        summary
      );
    }
    return pass(summary);
  },
};

export const chapterPartialsRule: Rule = {
  id: 'structure.chapitres-partiels',
  title: 'Introduction et conclusion partielles',
  category: 'structure',
  severity: 'warning',
  reference: 'Chaque chapitre : introduction partielle, sections, conclusion partielle (§1.1).',
  check(ctx) {
    if (!ctx.profile.structure.requirePartialIntroAndConclusion)
      return skip('non exigé par le profil');
    if (ctx.structure.chapters.length === 0) return skip('aucun chapitre détecté');
    const findings: Finding[] = [];
    for (const chapter of ctx.structure.chapters) {
      const name = `Chapitre ${chapter.announcedNumber ?? chapter.ordinal}`;
      if (!chapter.hasPartialIntroduction)
        findings.push({
          message: `${name} : introduction partielle absente.`,
          location: at(chapter.title),
        });
      if (!chapter.hasPartialConclusion)
        findings.push({
          message: `${name} : conclusion partielle absente.`,
          location: at(chapter.title),
        });
    }
    return fail(findings);
  },
};

export const emptyPartsRule: Rule = {
  id: 'structure.parties-vides',
  title: 'Parties sans contenu',
  category: 'structure',
  severity: 'warning',
  reference: 'Une partie annoncée doit avoir un contenu.',
  check(ctx) {
    const findings: Finding[] = [];
    for (const part of ctx.structure.parts) {
      const content = ctx.document.paragraphs.slice(part.contentStart, part.contentEnd + 1);
      const hasContent = content.some(
        (p) => p.text || p.fieldInstructions.length > 0 || p.hasDrawing
      );
      if (!hasContent && part.spec.id !== 'annexes') {
        findings.push({ message: `« ${part.spec.label} » est vide.`, location: at(part.title) });
      }
    }
    return fail(findings);
  },
};

export const automaticTocRule: Rule = {
  id: 'structure.table-automatique',
  title: 'Table des matières automatique',
  category: 'structure',
  severity: 'error',
  reference: 'Grille MRS (forme) : gestion automatique de la table des matières.',
  check(ctx) {
    const toc = ctx.structure.part('table-matieres');
    if (!toc) return skip('pas de table des matières (signalé par « Parties obligatoires »)');
    const generated = ctx.document.paragraphs.some((p) =>
      p.fieldInstructions.some((i) => /^TOC\b/i.test(i) && !/\\c\b/i.test(i))
    );
    return generated
      ? pass()
      : fail([
          {
            message:
              'La table des matières est saisie à la main : insérez une table automatique (champ TOC) basée sur les styles de titre.',
            location: at(toc.title),
          },
        ]);
  },
};

export const generatedListsRule: Rule = {
  id: 'structure.listes',
  title: 'Listes des figures et des tableaux',
  category: 'structure',
  severity: 'warning',
  reference: 'Grille MRS (forme) : liste des figures et tableaux ; liminaires (§1.1).',
  check(ctx) {
    const captions = ctx.document.paragraphs.filter(
      (p) => p.role === 'caption' && p.index >= ctx.structure.cover.length
    );
    const figures = captions.some((p) => /^figure/i.test(p.text));
    const tables = captions.some((p) => /^tableau|^table\b/i.test(p.text));
    if (!figures && !tables) return skip('aucune légende de figure ou de tableau');
    const instructions = ctx.document.paragraphs.flatMap((p) => p.fieldInstructions);
    const findings: Finding[] = [];
    const check = (needed: boolean, partId: string, label: string, kind: RegExp) => {
      if (!needed) return;
      const part = ctx.structure.part(partId);
      if (!part)
        findings.push({
          message: `Le document contient des ${label.toLowerCase().replace('liste des ', '')} mais pas de « ${label} ».`,
        });
      else if (!instructions.some((i) => isFieldList(i, kind))) {
        findings.push({
          message: `« ${label} » n'est pas générée automatiquement (champ TOC \\c à partir des légendes).`,
          location: at(part.title),
        });
      }
    };
    check(figures, 'liste-figures', 'Liste des figures', /figure/i);
    check(tables, 'liste-tableaux', 'Liste des tableaux', /tableau|table/i);
    return fail(findings);
  },
};

export const unrecognizedChapterNumberRule: Rule = {
  id: 'structure.numero-chapitres',
  title: 'Numérotation des chapitres',
  category: 'structure',
  severity: 'warning',
  reference: 'Chapitres numérotés dans l’ordre (Chapitre 1, 2, 3…).',
  check(ctx) {
    const announced = ctx.structure.chapters.filter((c) => c.announcedNumber !== null);
    if (announced.length === 0) return skip('aucun chapitre au format « Chapitre N »');
    const findings: Finding[] = [];
    announced.forEach((chapter, i) => {
      const expected = announced[0]!.announcedNumber! + i;
      if (chapter.announcedNumber !== expected) {
        findings.push({
          message: `« ${excerpt(chapter.title.text, 50)} » : chapitre ${expected} attendu.`,
          location: at(chapter.title),
        });
      }
    });
    return fail(capFindings(findings, 'chapitres'));
  },
};

export const STRUCTURE_RULES: readonly Rule[] = [
  coverRule,
  requiredPartsRule,
  partOrderRule,
  introductionSectionsRule,
  chapterCountRule,
  chapterPartialsRule,
  unrecognizedChapterNumberRule,
  emptyPartsRule,
  automaticTocRule,
  generatedListsRule,
];
