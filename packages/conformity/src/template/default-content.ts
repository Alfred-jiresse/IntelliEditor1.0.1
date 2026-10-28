// The blank « Nouveau TFC »: every part present, each one telling the student what goes there.

import { text, type TfcContent } from './content.ts';

export const BLANK_CONTENT: TfcContent = {
  epigraph: { quote: 'Votre citation.', author: 'Auteur de la citation' },
  dedication: ['À …'],
  acknowledgements: [
    'Exprimez ici votre reconnaissance aux personnes qui ont contribué à ce travail.',
  ],
  acronyms: [['SIGLE', 'Signification du sigle']],
  foreword: [
    'Décrivez l’esprit de la recherche, ses résultats et les ouvertures qu’elle apporte (ce n’est pas un mot de remerciements).',
  ],
  introduction: [
    {
      title: 'Contexte',
      blocks: [
        text(
          'Présentez le contexte du problème : qui est concerné, quand et où il apparaît, ses causes [1].'
        ),
      ],
    },
    {
      title: 'Problématique',
      blocks: [
        text('Situation de la problématique, problème de la recherche et questions de recherche.'),
      ],
    },
    { title: 'Hypothèses', blocks: [text('Formulez les pistes de solution provisoires.')] },
    {
      title: 'Choix et intérêt du sujet',
      blocks: [text('Intérêt scientifique, social et personnel du sujet.')],
    },
    {
      title: 'Méthodologie',
      blocks: [
        text('Méthodes et techniques utilisées (collecte, analyse, modélisation, implémentation).'),
      ],
    },
    {
      title: 'État de l’art',
      blocks: [
        text('Synthèse des travaux existants : points convergents et divergents avec votre thème.'),
      ],
    },
    {
      title: 'Délimitation du travail',
      blocks: [text('Limites dans le temps, l’espace et le domaine.')],
    },
    { title: 'Subdivision du travail', blocks: [text('Présentez brièvement chaque chapitre.')] },
    {
      title: 'Outils logiciels et équipements utilisés',
      blocks: [text('Logiciels, langages et matériel employés.')],
    },
  ],
  chapters: [
    {
      title: 'Titre du premier chapitre',
      introduction: [text('Annoncez le contenu du chapitre.')],
      sections: [
        {
          title: 'Première section',
          blocks: [
            {
              kind: 'subsection',
              title: 'Première sous-section',
              blocks: [text('Rédigez ici. Citez vos sources au format IEEE : [1, p. 12].')],
            },
          ],
        },
      ],
      conclusion: [text('Résumez le chapitre et annoncez le suivant (phrase charnière).')],
    },
  ],
  conclusion: [text('Rappel de la problématique, résultats obtenus, perspectives.')],
  references: ['A. Auteur, Titre de l’ouvrage, Ville : Éditeur, année.'],
  annexes: [],
};
