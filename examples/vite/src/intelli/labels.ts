// Every user-facing string of the IntelliEditor layer, in one place (French product).

import type { ConformityLevel, RuleCategory, Severity } from '@intellieditor/conformity';

export const LEVEL_LABEL: Readonly<Record<ConformityLevel, string>> = {
  conforme: 'Conforme',
  'a-revoir': 'À revoir',
  'non-conforme': 'Non conforme',
};

export const CATEGORY_LABEL: Readonly<Record<RuleCategory, string>> = {
  'mise-en-page': 'Mise en page',
  typographie: 'Typographie',
  titres: 'Titres',
  structure: 'Structure du travail',
  legendes: 'Tableaux et figures',
  references: 'Références',
  integrite: 'Intégrité',
  longueur: 'Longueur',
  etablissement: 'Règles de l’établissement',
};

export const SEVERITY_LABEL: Readonly<Record<Severity, string>> = {
  error: 'Erreur',
  warning: 'Avertissement',
  info: 'Conseil',
};

export const TEXT = {
  panelTitle: 'Conformité',
  check: 'Vérifier',
  checking: 'Analyse…',
  toFix: 'À corriger',
  all: 'Toutes les règles',
  profile: 'Norme',
  importProfile: 'Importer des règles (.txt, .json)…',
  exportProfile: 'Télécharger les règles (.txt)',
  resetProfile: 'Revenir à la norme UDBL',
  noReport: 'Analyse du document en cours…',
  allGood: 'Toutes les règles vérifiables sont respectées.',
  notVerifiable: 'Non vérifiable',
  goTo: 'Aller à l’endroit',
  close: 'Fermer le panneau',
  open: 'Conformité du document',
  newTfc: 'Nouveau TFC',
  rules: 'Règles…',
  analyzedAt: (date: Date) =>
    `Vérifié à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
  summary: (passed: number, failed: number, skipped: number) =>
    `${passed} respectée(s) · ${failed} à corriger · ${skipped} non vérifiable(s)`,
} as const;

/** Captions, lists of figures/tables and page numbering — the academic writing tools. */
export const ACADEMIC_TEXT = {
  caption: 'Légende…',
  listOfFigures: 'Liste des figures',
  listOfTables: 'Liste des tableaux',
  renumber: 'Renuméroter les légendes',
  pageNumbering: 'Numérotation des pages…',
  captionTitle: 'Insérer une légende',
  captionIntro:
    'La légende est numérotée par chapitre (« Figure 2.1 ») avec un vrai champ Word ; les autres légendes sont renumérotées automatiquement.',
  captionKind: 'Type',
  captionText: 'Texte de la légende',
  captionPosition: 'Position',
  above: 'Au-dessus de l’élément',
  below: 'En dessous de l’élément',
  normHint: 'La norme : légende au-dessus d’un tableau, en dessous d’une figure.',
  numberingTitle: 'Numérotation des pages',
  numberingIntro:
    'S’applique à la section où se trouve le curseur : les pages liminaires en chiffres romains, le corps du travail en chiffres arabes à partir de 1.',
  format: 'Format',
  continuePrevious: 'Continuer la section précédente',
  restartAt: 'Recommencer à',
  wholeDocument: 'Appliquer à tout le document',
  apply: 'Appliquer',
  insert: 'Insérer',
  cancel: 'Annuler',
  refused: (reason: string) => `Action refusée par l’éditeur : ${reason}`,
} as const;

export const CAPTION_KINDS = [
  { label: 'Figure', name: 'Figure', position: 'below' },
  { label: 'Tableau', name: 'Tableau', position: 'above' },
] as const;

export const PAGE_NUMBER_FORMATS = [
  { value: 'decimal', name: '1, 2, 3…' },
  { value: 'lowerRoman', name: 'i, ii, iii…' },
  { value: 'upperRoman', name: 'I, II, III…' },
  { value: 'lowerLetter', name: 'a, b, c…' },
  { value: 'upperLetter', name: 'A, B, C…' },
] as const;

/** The « Règles… » dialog: replacing the norm without touching the code. */
export const RULES_TEXT = {
  title: 'Règles de présentation',
  intro:
    'IntelliEditor vérifie le document selon ces règles. Une autre faculté ou université peut les remplacer par son propre fichier, sans modifier le programme.',
  current: 'Norme active',
  institution: 'Établissement',
  content: 'Contenu',
  counts: (builtIn: number, custom: number) =>
    `${builtIn} règle(s) intégrée(s) active(s)${custom > 0 ? ` + ${custom} règle(s) propre(s) à l’établissement :` : ''}`,
  step1:
    'Téléchargez le modèle : c’est un fichier texte qui contient toutes les règles actuelles, commentées.',
  step2:
    'Modifiez les valeurs (marges, police, parties, chapitres…) et ajoutez vos propres règles dans des blocs [regle].',
  step3:
    'Importez le fichier : la vérification s’applique aussitôt et la norme est retenue dans ce navigateur.',
  download: 'Télécharger le modèle (.txt)',
  import: 'Importer un fichier de règles…',
  reset: 'Revenir à la norme UDBL',
  close: 'Fermer',
  refused: 'Fichier refusé — rien n’a été changé :',
  warnings: 'Remarques (le reste du fichier a été pris en compte) :',
  loaded: (name: string) => `Règles « ${name} » chargées.`,
  more: (count: number) => `… et ${count} autre(s).`,
} as const;
