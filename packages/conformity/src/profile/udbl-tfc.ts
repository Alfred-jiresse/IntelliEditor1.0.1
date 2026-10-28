// The built-in profile: TFC of the Faculté des Sciences Informatiques, UDBL.
//
// Source: « De la normalisation des TFC à l'ESIS » (N. Kalenga, I. Kamiba, 2015-2016 — the
// ESIS is the predecessor of the faculty), the UDBL 2025 cover template and the MRS 2026
// grading grid (Forme : pages initiales, TDM automatique, listes, titres, IEEE).
//
// Two values deliberately follow PRACTICE where the written norm and every validated TFC
// disagree, and are flagged for the director:
// - page numbering: the norm text says arabic for the preliminary pages and roman from the
//   introduction; the validated TFC do the reverse (roman, then arabic from 1). Configurable.
// - line spacing: the norm says "1.25 pts", read here as 1.25 lines.

import type { ConformityProfile, PartSpec } from './types.ts';

const part = (
  id: string,
  label: string,
  aliases: readonly string[],
  required: boolean
): PartSpec => ({
  id,
  label,
  aliases,
  required,
});

export const UDBL_TFC_PROFILE: ConformityProfile = {
  id: 'udbl-fsi-tfc',
  name: 'TFC — Faculté des Sciences Informatiques (UDBL)',
  institution: 'Université Don Bosco de Lubumbashi',
  source:
    'Normalisation des TFC (ESIS 2015-2016), modèle de page de garde UDBL 2025, grille MRS 2026',
  page: {
    widthMm: 210,
    heightMm: 297,
    marginsCm: { top: 3.5, right: 2.5, bottom: 2.5, left: 3.5 },
    marginToleranceMm: 1,
    numberAlignment: 'right',
    liminaryNumberFormat: 'lowerRoman',
    bodyNumberFormat: 'decimal',
  },
  typography: {
    bodyFonts: ['Times New Roman'],
    bodySizePt: 12,
    lineSpacing: 1.25,
    lineSpacingTolerance: 0.06,
    deviationTolerance: 0.05,
  },
  headings: [
    { bold: true, italic: false, textCase: 'upper', sizePt: 12 },
    { bold: true, italic: false, textCase: 'any', sizePt: 12 },
    { bold: true, italic: true, textCase: 'any', sizePt: 12 },
    { bold: false, italic: true, textCase: 'any', sizePt: 12 },
  ],
  cover: {
    requiredMentions: [
      'universite don bosco de lubumbashi',
      'faculte des sciences informatiques',
      'travail presente et defendu',
      'par',
      'directeur',
    ],
  },
  structure: {
    parts: [
      part('epigraphe', 'Épigraphe', ['epigraphe'], false),
      part('dedicace', 'Dédicace', ['dedicace'], false),
      part('remerciements', 'Remerciements', ['remerciements', 'remerciement'], false),
      part(
        'liste-figures',
        'Liste des figures',
        ['liste des figures', 'table des figures', 'liste des illustrations'],
        false
      ),
      part('liste-tableaux', 'Liste des tableaux', ['liste des tableaux'], false),
      part('liste-equations', 'Liste des équations', ['liste des equations'], false),
      part(
        'liste-acronymes',
        'Liste des acronymes',
        [
          'liste des acronymes',
          'acronymes',
          'sigles et abreviations',
          'liste des sigles',
          'liste des abreviations',
        ],
        false
      ),
      part(
        'table-matieres',
        'Table des matières',
        ['table des matieres', 'table de matieres', 'sommaire'],
        true
      ),
      part('avant-propos', 'Avant-propos', ['avant-propos', 'avant propos'], true),
      part(
        'introduction',
        'Introduction générale',
        ['introduction generale', 'introduction'],
        true
      ),
      part('conclusion', 'Conclusion générale', ['conclusion generale'], true),
      part(
        'references',
        'Références',
        ['references bibliographiques', 'references', 'bibliographie', 'webographie'],
        true
      ),
      part('annexes', 'Annexes', ['annexes', 'annexe'], false),
    ],
    introductionSections: [
      part('contexte', 'Contexte', ['contexte'], false),
      part('problematique', 'Problématique', ['problematique'], true),
      part('hypotheses', 'Hypothèses', ['hypotheses', 'hypothese'], true),
      part(
        'choix-interet',
        'Choix et intérêt du sujet',
        ['choix et interet du sujet', 'choix et interet', 'interet du sujet', 'choix du sujet'],
        true
      ),
      part(
        'methodologie',
        'Méthodologie (méthodes et techniques)',
        [
          'methodologie',
          'methode et techniques',
          'methodes et techniques',
          'approche methodologique',
        ],
        true
      ),
      part(
        'etat-art',
        "État de l'art",
        ["etat de l'art", 'etat de la question', 'revue de la litterature', 'revue de litterature'],
        true
      ),
      part('delimitation', 'Délimitation du travail', ['delimitation'], true),
      part('subdivision', 'Subdivision du travail', ['subdivision', 'plan du travail'], true),
      part(
        'outils',
        'Outils logiciels et équipements utilisés',
        ['outils logiciels', 'outils et equipements', 'outils'],
        false
      ),
    ],
    minChapters: 1,
    maxChapters: 4,
    requirePartialIntroAndConclusion: true,
  },
  captions: {
    tableCaptionPosition: 'above',
    figureCaptionPosition: 'below',
    chapterNumbering: true,
  },
  references: {
    sectionAliases: ['references bibliographiques', 'references', 'bibliographie'],
    preferredTitle: 'Références',
    minimumCount: 10,
    style: 'ieee',
  },
  lengths: {
    // Times New Roman 12 pt, 1.25 lines, 3.5/2.5 cm margins: about 330 words a full page.
    wordsPerPage: 330,
    introductionMaxPages: 6,
    chapterMaxPages: 20,
  },
  rules: {},
  customRules: [],
};
