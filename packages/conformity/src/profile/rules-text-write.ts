// A profile written back as a plain-text rules file: the template an institution downloads,
// edits and imports. Every key is shown with its current value and a comment, so the file
// documents itself; `parseRulesText` reads it back to the same profile.

import { normalize } from '../analysis/text.ts';
import type { PageNumberFormat } from '../model/types.ts';
import type { ConformityProfile, CustomRuleSpec, PartSpec, Severity } from './types.ts';

const FORMAT: Readonly<Record<PageNumberFormat, string>> = {
  decimal: 'arabe',
  lowerRoman: 'romain',
  upperRoman: 'romain majuscule',
  lowerLetter: 'lettre',
  upperLetter: 'lettre majuscule',
  other: 'arabe',
};
const POSITION = { left: 'gauche', center: 'centre', right: 'droite' } as const;
const PLACE = { above: 'dessus', below: 'dessous' } as const;
const SEVERITY: Readonly<Record<Severity, string>> = {
  error: 'erreur',
  warning: 'avertissement',
  info: 'conseil',
};
const KIND: Readonly<Record<CustomRuleSpec['kind'], string>> = {
  'forbidden-text': 'texte interdit',
  'required-text': 'texte obligatoire',
  'required-part': 'partie obligatoire',
  'part-length': 'longueur de partie',
  'document-length': 'longueur du document',
};
const ZONE = { body: 'corps', cover: 'page de garde', document: 'document' } as const;

const n = (value: number): string => String(value).replace('.', ',');

function partList(specs: readonly PartSpec[]): string {
  return specs
    .map((spec) => {
      // Parentheses introduce the other accepted titles in this format, so a label that
      // carries its own (« Méthodologie (méthodes et techniques) ») hands them over.
      const own = /\(([^)]*)\)/.exec(spec.label)?.[1];
      const label = spec.label.replace(/\s*\([^)]*\)/, '').trim();
      const extra = [...(own ? [own] : []), ...spec.aliases].filter(
        (alias, i, all) =>
          normalize(alias) !== normalize(label) &&
          all.findIndex((other) => normalize(other) === normalize(alias)) === i
      );
      return `${label}${spec.required ? '' : '?'}${extra.length ? ` (${extra.join('; ')})` : ''}`;
    })
    .join(',\n    ');
}

function headingLine(spec: ConformityProfile['headings'][number]): string {
  return [
    spec.bold ? 'gras' : null,
    spec.italic ? 'italique' : null,
    spec.textCase === 'upper' ? 'majuscules' : spec.textCase === 'lower' ? 'minuscules' : null,
    `${n(spec.sizePt)} pt`,
  ]
    .filter(Boolean)
    .join(', ');
}

function customRule(spec: CustomRuleSpec): string {
  return [
    `[regle] ${spec.title}`,
    `identifiant = ${spec.id}`,
    `type = ${KIND[spec.kind]}`,
    ...(spec.values.length ? [`valeurs = ${spec.values.join(', ')}`] : []),
    ...(spec.kind === 'forbidden-text' || spec.kind === 'required-text'
      ? [`zone = ${ZONE[spec.zone]}`]
      : []),
    ...(spec.minWords !== undefined ? [`min mots = ${spec.minWords}`] : []),
    ...(spec.maxWords !== undefined ? [`max mots = ${spec.maxWords}`] : []),
    ...(spec.minPages !== undefined ? [`min pages = ${spec.minPages}`] : []),
    ...(spec.maxPages !== undefined ? [`max pages = ${spec.maxPages}`] : []),
    `gravite = ${SEVERITY[spec.severity]}`,
    `explication = ${spec.reference}`,
  ].join('\n');
}

/** The whole profile as a commented rules file. */
export function profileToRulesText(profile: ConformityProfile): string {
  const p = profile;
  const overrides = Object.entries(p.rules).map(([id, o]) =>
    o.enabled === false
      ? `${id} = désactivée`
      : o.severity
        ? `${id} = ${SEVERITY[o.severity]}`
        : `${id} = activée`
  );
  return `# Règles de présentation — fichier lu par IntelliEditor
#
# Modifiez les valeurs après le signe « = », puis importez ce fichier avec le bouton « Règles… ».
# Une ligne qui commence par # est un commentaire. Une valeur trop longue peut continuer sur
# les lignes suivantes, en les commençant par des espaces. Les nombres s'écrivent avec une
# virgule ou un point (2,5 ou 2.5). Une clé absente garde la valeur de la norme UDBL.

[norme]
nom = ${p.name}
institution = ${p.institution}
source = ${p.source}
identifiant = ${p.id}

[page]
format = ${n(p.page.widthMm)} x ${n(p.page.heightMm)}
# haut droite bas gauche, en cm
marges = ${n(p.page.marginsCm.top)} ${n(p.page.marginsCm.right)} ${n(p.page.marginsCm.bottom)} ${n(p.page.marginsCm.left)}
# écart accepté, en mm
tolerance marges = ${n(p.page.marginToleranceMm)}
# gauche, centre ou droite
position numero = ${POSITION[p.page.numberAlignment]}
# arabe, romain, romain majuscule, lettre, lettre majuscule
numerotation liminaires = ${FORMAT[p.page.liminaryNumberFormat]}
numerotation corps = ${FORMAT[p.page.bodyNumberFormat]}

[texte]
# une ou plusieurs polices acceptées, séparées par des virgules
police = ${p.typography.bodyFonts.join(', ')}
taille = ${n(p.typography.bodySizePt)} pt
interligne = ${n(p.typography.lineSpacing)}
tolerance interligne = ${n(p.typography.lineSpacingTolerance)}
# part des paragraphes qui peuvent s'écarter sans faire échouer la règle
tolerance ecarts = ${n(Math.round(p.typography.deviationTolerance * 100))} %

[titres]
# gras, italique, majuscules ou minuscules, et la taille
${p.headings.map((h, i) => `niveau ${i + 1} = ${headingLine(h)}`).join('\n')}

[page de garde]
# textes qui doivent figurer sur la page de garde
mentions = ${p.cover.requiredMentions.join(', ')}

[structure]
# Dans l'ordre imposé. « ? » = facultative. Entre parenthèses : d'autres titres acceptés,
# séparés par « ; ».
parties = ${partList(p.structure.parts)}
sections introduction = ${partList(p.structure.introductionSections)}
chapitres = ${p.structure.minChapters} à ${p.structure.maxChapters}
introduction et conclusion partielles = ${p.structure.requirePartialIntroAndConclusion ? 'oui' : 'non'}

[legendes]
# dessus ou dessous
tableaux = ${PLACE[p.captions.tableCaptionPosition]}
figures = ${PLACE[p.captions.figureCaptionPosition]}
numerotation par chapitre = ${p.captions.chapterNumbering ? 'oui' : 'non'}

[references]
titre = ${p.references.preferredTitle}
titres acceptes = ${p.references.sectionAliases.join(', ')}
minimum = ${p.references.minimumCount}
style = ${p.references.style}

[longueurs]
mots par page = ${p.lengths.wordsPerPage}
# en pages
introduction max = ${p.lengths.introductionMaxPages}
chapitre max = ${p.lengths.chapterMaxPages}

[regles]
# Changer la gravité d'une règle intégrée (erreur, avertissement, conseil) ou la désactiver.
# Exemple : references.ieee = désactivée
${overrides.join('\n')}

# ── Règles propres à l'établissement ──────────────────────────────────────────────
# Un bloc [regle] par exigence. Types possibles :
#   texte interdit       valeurs = mots ou expressions à éviter ; zone = corps, page de garde ou document
#   texte obligatoire    valeurs = textes qui doivent apparaître ; zone = corps, page de garde ou document
#   partie obligatoire   valeurs = titre de la partie (et autres titres acceptés)
#   longueur de partie   valeurs = titre de la partie ; min mots, max mots, min pages, max pages
#   longueur du document min mots, max mots, min pages, max pages
# gravite = erreur, avertissement ou conseil ; explication = le texte montré à l'étudiant.
#
# [regle] Rédaction impersonnelle
# type = texte interdit
# valeurs = nous, notre, nos
# zone = corps
# gravite = avertissement
# explication = Le TFC est rédigé à la forme impersonnelle.
${p.customRules.map(customRule).join('\n\n')}
`;
}
