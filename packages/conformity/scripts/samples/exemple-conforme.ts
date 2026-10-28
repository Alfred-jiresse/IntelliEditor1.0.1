// The worked example: a complete, FICTIONAL TFC that satisfies every rule of the UDBL profile.
// Content only — numbering, captions, TOC and lists are produced by the generator.
// IEEE citations appear in the order of the reference list (first citation of [n] before [n+1]).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { text, type ImageContent, type TfcContent } from '../../src/template/content.ts';
import type { CoverMetadata } from '../../src/template/tfc-template.ts';

const ASSETS = join(import.meta.dir, '../assets');

function png(name: string, widthCm: number): ImageContent {
  const bytes = new Uint8Array(readFileSync(join(ASSETS, name)));
  // PNG IHDR: width and height are big-endian at offsets 16 and 20.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { bytes, format: 'png', widthCm, aspect: view.getUint32(16) / view.getUint32(20) };
}

export const EXAMPLE_COVER: CoverMetadata = {
  institution: 'Université Don Bosco de Lubumbashi',
  faculty: 'Faculté des Sciences Informatiques',
  department: 'Département de Génie Logiciel et Management des Systèmes d’Information',
  city: 'Lubumbashi',
  website: 'www.udbl.ac.cd',
  title: 'Conception et réalisation d’une application web de gestion des stages académiques',
  subtitle: 'Cas de la Faculté des Sciences Informatiques de l’UDBL',
  degree: 'ingénieur technicien en Génie Logiciel',
  author: 'EXEMPLE DÉMONSTRATION Étudiant',
  field: 'Génie Logiciel',
  director: 'CT Prénom NOM',
  coDirector: 'Ass. Prénom NOM',
  date: 'Juillet 2026',
  logo: { bytes: new Uint8Array(readFileSync(join(ASSETS, 'logo-udbl.png'))), format: 'png' },
};

const p = text;

export const EXAMPLE_CONTENT: TfcContent = {
  epigraph: {
    quote:
      'La qualité d’un logiciel se mesure à la facilité avec laquelle il se laisse comprendre, utiliser et faire évoluer.',
    author: 'D’après I. Sommerville',
  },
  dedication: [
    'À mes parents, pour leurs sacrifices.',
    'À tous les étudiants qui cherchent un stage.',
  ],
  acknowledgements: [
    'Nos remerciements s’adressent d’abord à notre directeur et à notre co-directeur, pour leur disponibilité et la rigueur de leur encadrement tout au long de ce travail.',
    'Nous remercions également le corps académique et le personnel administratif de la Faculté des Sciences Informatiques, ainsi que les responsables de stages qui ont accepté de répondre à nos questions lors des entretiens.',
    'Enfin, nous exprimons notre gratitude à notre famille et à nos camarades de promotion pour leur soutien constant.',
  ],
  acronyms: [
    ['API', 'Application Programming Interface'],
    ['FSI', 'Faculté des Sciences Informatiques'],
    ['HTTPS', 'HyperText Transfer Protocol Secure'],
    ['ORM', 'Object-Relational Mapping'],
    ['REST', 'Representational State Transfer'],
    ['RUP', 'Rational Unified Process'],
    ['SGBD', 'Système de Gestion de Base de Données'],
    ['UDBL', 'Université Don Bosco de Lubumbashi'],
    ['UML', 'Unified Modeling Language'],
  ],
  foreword: [
    'Ce travail traite de la gestion des stages académiques, une activité qui mobilise chaque année les étudiants finalistes, leurs encadreurs et le secrétariat de la faculté. Il part d’un constat simple : les échanges reposent encore sur des documents papier et des messages dispersés, ce qui allonge les délais et rend le suivi difficile.',
    'Nous proposons une application web qui centralise les demandes, l’affectation des encadreurs, le dépôt des rapports et leur évaluation. Les résultats obtenus lors des tests montrent une réduction nette du délai de traitement d’une demande et ouvrent la voie à une gestion entièrement dématérialisée des stages.',
  ],
  introduction: [
    {
      title: 'Contexte',
      blocks: [
        p(
          'Chaque année, les étudiants finalistes de la Faculté des Sciences Informatiques doivent effectuer un stage en entreprise. Ce stage suppose une série d’échanges entre l’étudiant, le secrétariat et l’encadreur : dépôt de la demande, validation, affectation, suivi puis évaluation du rapport. Le génie logiciel montre qu’un processus de ce type gagne à être outillé dès que le volume des échanges augmente [1].'
        ),
        p(
          'Or ces échanges reposent aujourd’hui sur des formulaires papier et des messages informels. Les informations sont dispersées, les délais s’allongent et aucune trace fiable ne permet de savoir à quelle étape se trouve un dossier [2, p. 45].'
        ),
      ],
    },
    {
      title: 'Problématique',
      blocks: [
        p(
          'Le traitement manuel des demandes de stage entraîne des retards, des pertes de documents et une charge importante pour le secrétariat. Les étudiants ignorent souvent l’état de leur demande et les encadreurs reçoivent les rapports par des canaux différents.'
        ),
        p(
          'Cette situation conduit à la question suivante : comment centraliser et automatiser la gestion des stages académiques afin de réduire les délais de traitement et d’assurer un suivi fiable de chaque dossier ?'
        ),
      ],
    },
    {
      title: 'Hypothèses',
      blocks: [
        p(
          'Nous formulons l’hypothèse qu’une application web, accessible aux trois acteurs du processus, permettrait de réduire le délai de traitement d’une demande, de conserver l’historique de chaque dossier et de fournir au secrétariat des statistiques fiables. La qualité d’une telle application peut être évaluée selon les caractéristiques définies par la norme ISO/IEC 25010 [3].'
        ),
      ],
    },
    {
      title: 'Choix et intérêt du sujet',
      blocks: [
        p(
          'Sur le plan social, le sujet répond à un besoin réel des étudiants et du personnel de la faculté. Sur le plan scientifique, il met en pratique les méthodes d’analyse, de conception et d’implémentation étudiées au cours du cycle. Sur le plan personnel, il nous permet de mener un projet logiciel complet, du recueil des besoins jusqu’aux tests.'
        ),
      ],
    },
    {
      title: 'Méthodologie',
      blocks: [
        p(
          'Nous avons adopté le Processus Unifié, une démarche itérative et incrémentale guidée par les cas d’utilisation [4]. La modélisation s’appuie sur le langage UML [5].'
        ),
        {
          kind: 'list',
          items: [
            'technique documentaire : consultation des règlements et des ouvrages de référence ;',
            'technique d’interview : entretiens avec le secrétariat et les encadreurs ;',
            'technique d’observation : suivi du traitement de plusieurs dossiers réels.',
          ],
        },
      ],
    },
    {
      title: 'État de l’art',
      blocks: [
        p(
          'Les plateformes de gestion de stages existantes sont généralement conçues pour de grandes universités et supposent une infrastructure et un budget dont la faculté ne dispose pas. Les travaux consultés insistent sur l’importance de partir des cas d’utilisation réels des acteurs plutôt que d’adapter une solution générique [6]. Notre apport consiste à proposer une solution légère, adaptée au processus propre à la faculté.'
        ),
      ],
    },
    {
      title: 'Délimitation du travail',
      blocks: [
        p(
          'Dans l’espace, ce travail porte sur la Faculté des Sciences Informatiques de l’UDBL. Dans le temps, il couvre l’année académique 2025-2026. Il se limite à la gestion des stages et n’aborde pas la gestion des notes des autres cours.'
        ),
      ],
    },
    {
      title: 'Subdivision du travail',
      blocks: [
        p(
          'Hormis l’introduction et la conclusion générales, ce travail comprend trois chapitres. Le premier présente les généralités et analyse l’existant. Le deuxième est consacré à l’analyse et à la conception de la solution. Le troisième décrit son implémentation et les tests réalisés.'
        ),
      ],
    },
    {
      title: 'Outils logiciels et équipements utilisés',
      blocks: [
        {
          kind: 'list',
          items: [
            'StarUML pour la modélisation ;',
            'Visual Studio Code comme environnement de développement ;',
            'PostgreSQL comme système de gestion de base de données ;',
            'un ordinateur portable (16 Go de mémoire) et une connexion Internet.',
          ],
        },
      ],
    },
  ],
  chapters: [
    {
      title: 'Généralités et analyse de l’existant',
      introduction: [
        p(
          'Ce chapitre définit les concepts utilisés dans la suite du travail, présente le cadre d’étude puis analyse le processus actuel de gestion des stages afin d’en dégager les limites.'
        ),
      ],
      sections: [
        {
          title: 'Définition des concepts de base',
          blocks: [
            {
              kind: 'subsection',
              title: 'Le stage académique',
              blocks: [
                p(
                  'Le stage académique est une période de formation en milieu professionnel au cours de laquelle l’étudiant applique les connaissances acquises. Il fait l’objet d’un rapport évalué par un encadreur.'
                ),
              ],
            },
            {
              kind: 'subsection',
              title: 'L’application web',
              blocks: [
                p(
                  'Une application web est un logiciel accessible par un navigateur, dont la logique s’exécute sur un serveur. Son architecture sépare habituellement la présentation, la logique métier et l’accès aux données [7].'
                ),
              ],
            },
          ],
        },
        {
          title: 'Présentation du cadre d’étude',
          blocks: [
            p(
              'La Faculté des Sciences Informatiques de l’UDBL forme des ingénieurs dans plusieurs filières. Le secrétariat de la faculté centralise les demandes de stage, les transmet aux responsables de filière et assure l’archivage des rapports.'
            ),
          ],
        },
        {
          title: 'Analyse de l’existant',
          blocks: [
            p(
              'Le processus actuel comporte cinq étapes, du dépôt de la demande jusqu’à l’archivage. Chacune repose sur un échange de documents papier ou de messages, comme le montre la figure ci-dessous.'
            ),
            {
              kind: 'figure',
              caption: 'Processus actuel de gestion des stages',
              image: png('figure-processus.png', 15),
            },
            p(
              'Les entretiens menés auprès des acteurs ont permis de relever les difficultés présentées dans le tableau suivant.'
            ),
            {
              kind: 'table',
              caption: 'Difficultés relevées dans le processus actuel',
              header: ['Étape', 'Difficulté', 'Conséquence'],
              rows: [
                ['Dépôt', 'Formulaire papier', 'Perte de documents'],
                ['Validation', 'Traitement manuel', 'Délai de 3 à 5 jours'],
                ['Suivi', 'Messages dispersés', 'Aucune traçabilité'],
                ['Évaluation', 'Rapports par divers canaux', 'Retard des notes'],
              ],
            },
          ],
        },
        {
          title: 'Critique de l’existant',
          blocks: [
            p(
              'Le processus actuel a le mérite d’être connu de tous les acteurs, mais il ne permet ni de suivre l’état d’un dossier, ni de produire des statistiques fiables. Ces limites justifient la mise en place d’une solution informatique centralisée.'
            ),
          ],
        },
      ],
      conclusion: [
        p(
          'L’analyse de l’existant a mis en évidence la lenteur et le manque de traçabilité du processus actuel. Le chapitre suivant traduit ces constats en besoins et propose une conception de la solution.'
        ),
      ],
    },
    {
      title: 'Analyse et conception de la solution',
      introduction: [
        p(
          'Ce chapitre identifie les besoins des acteurs, puis les modélise à l’aide des diagrammes UML : cas d’utilisation, description textuelle et modèle du domaine.'
        ),
      ],
      sections: [
        {
          title: 'Identification des besoins',
          blocks: [
            p(
              'Les besoins fonctionnels décrivent ce que le système doit permettre à chaque acteur. Ils sont résumés dans le tableau ci-dessous.'
            ),
            {
              kind: 'table',
              caption: 'Exigences fonctionnelles par acteur',
              header: ['Acteur', 'Exigence'],
              rows: [
                ['Étudiant', 'Déposer une demande et suivre son état'],
                ['Étudiant', 'Déposer le rapport de stage'],
                ['Encadreur', 'Évaluer les rapports qui lui sont confiés'],
                ['Secrétariat', 'Valider les demandes et affecter un encadreur'],
                ['Secrétariat', 'Publier les statistiques de la promotion'],
              ],
            },
            p('Les besoins non fonctionnels portent sur la qualité attendue du système :'),
            {
              kind: 'list',
              items: [
                'sécurité : authentification de chaque acteur et chiffrement des échanges ;',
                'performance : affichage d’une page en moins de deux secondes ;',
                'ergonomie : interface utilisable sans formation préalable.',
              ],
            },
          ],
        },
        {
          title: 'Diagramme de cas d’utilisation',
          blocks: [
            p(
              'Le diagramme de cas d’utilisation présente les fonctionnalités offertes à chacun des trois acteurs du système [5, p. 32].'
            ),
            {
              kind: 'figure',
              caption: 'Diagramme de cas d’utilisation du système',
              image: png('figure-cas-utilisation.png', 15),
            },
            p('Le cas d’utilisation « Déposer une demande » est décrit dans le tableau suivant.'),
            {
              kind: 'table',
              caption: 'Description textuelle du cas « Déposer une demande »',
              header: ['Rubrique', 'Description'],
              rows: [
                ['Acteur', 'Étudiant'],
                ['Précondition', 'L’étudiant est authentifié'],
                [
                  'Scénario nominal',
                  'Saisie de l’entreprise et des dates, envoi, accusé de réception',
                ],
                [
                  'Scénario alternatif',
                  'Champs incomplets : le système signale les champs manquants',
                ],
                ['Postcondition', 'La demande est enregistrée à l’état « en attente »'],
              ],
            },
          ],
        },
        {
          title: 'Modèle du domaine',
          blocks: [
            p(
              'Le modèle du domaine représente les concepts manipulés par le système et leurs associations. Un étudiant peut effectuer plusieurs stages ; chaque stage est encadré par un seul encadreur et donne lieu à un ou plusieurs rapports.'
            ),
            {
              kind: 'figure',
              caption: 'Modèle du domaine',
              image: png('figure-modele-domaine.png', 15),
            },
          ],
        },
      ],
      conclusion: [
        p(
          'La conception a permis de formaliser les besoins et la structure des données du système. Le chapitre suivant présente leur mise en œuvre et les tests réalisés.'
        ),
      ],
    },
    {
      title: 'Implémentation et tests',
      introduction: [
        p(
          'Ce chapitre présente l’architecture retenue, les technologies utilisées, les principales interfaces de l’application et les résultats des tests.'
        ),
      ],
      sections: [
        {
          title: 'Architecture de la solution',
          blocks: [
            p(
              'L’application suit une architecture en couches qui sépare les contrôleurs, les services métier et l’accès aux données, conformément aux bonnes pratiques de conception [8]. Chaque couche ne dépend que de la couche inférieure, ce qui facilite les tests et l’évolution du système [9].'
            ),
            {
              kind: 'figure',
              caption: 'Architecture de la solution',
              image: png('figure-architecture.png', 15),
            },
          ],
        },
        {
          title: 'Choix technologiques',
          blocks: [
            p(
              'Les technologies ont été retenues pour leur maturité, leur documentation et leur adéquation avec l’architecture choisie. Certains patrons de conception classiques, comme la façade et la stratégie, structurent la couche des services [10].'
            ),
            {
              kind: 'table',
              caption: 'Technologies utilisées',
              header: ['Couche', 'Technologie', 'Justification'],
              rows: [
                ['Présentation', 'HTML, CSS, JavaScript', 'Standards du web'],
                ['Logique métier', 'Node.js', 'Asynchrone, écosystème riche'],
                ['Données', 'PostgreSQL', 'SGBD relationnel libre'],
                ['Sécurité', 'HTTPS, mots de passe hachés', 'Recommandations OWASP'],
              ],
            },
          ],
        },
        {
          title: 'Présentation de l’application',
          blocks: [
            p(
              'Le tableau de bord donne à chaque acteur une vue de synthèse : nombre de demandes, stages en cours et rapports à évaluer. La sécurité des formulaires suit les recommandations de l’OWASP [11].'
            ),
            {
              kind: 'figure',
              caption: 'Tableau de bord de l’application',
              image: png('figure-interface.png', 15),
            },
          ],
        },
        {
          title: 'Tests et validation',
          blocks: [
            p(
              'Des tests fonctionnels ont été menés pour chaque cas d’utilisation, sur les navigateurs les plus utilisés par les étudiants, en s’appuyant sur la documentation de référence des technologies du web [12].'
            ),
            {
              kind: 'table',
              caption: 'Résultats des tests fonctionnels',
              header: ['Cas d’utilisation', 'Résultat attendu', 'Statut'],
              rows: [
                ['Déposer une demande', 'Demande enregistrée', 'Réussi'],
                ['Valider une demande', 'Encadreur affecté', 'Réussi'],
                ['Déposer un rapport', 'Rapport archivé', 'Réussi'],
                ['Évaluer un rapport', 'Note enregistrée', 'Réussi'],
              ],
            },
            p(
              'Le délai moyen de traitement d’une demande est passé de trois à cinq jours à moins d’une journée lors de la période de test, ce qui confirme notre hypothèse.'
            ),
          ],
        },
      ],
      conclusion: [
        p(
          'L’implémentation a permis de réaliser une application conforme à la conception, et les tests ont confirmé son bon fonctionnement pour l’ensemble des cas d’utilisation.'
        ),
      ],
    },
  ],
  conclusion: [
    p(
      'Ce travail est parti d’un constat : la gestion des stages académiques à la Faculté des Sciences Informatiques reposait sur des échanges manuels, lents et difficiles à suivre. Nous nous sommes demandé comment centraliser et automatiser ce processus.'
    ),
    p(
      'Après avoir analysé l’existant, nous avons conçu, puis réalisé une application web qui couvre l’ensemble du processus, du dépôt de la demande à l’évaluation du rapport. Les tests ont confirmé notre hypothèse : le délai de traitement d’une demande a fortement diminué et chaque dossier est désormais traçable.'
    ),
    p(
      'Comme perspectives, l’application pourrait être étendue aux autres facultés de l’université et enrichie d’un module de notifications par SMS.'
    ),
  ],
  references: [
    'I. Sommerville, Software Engineering, 10e éd. Boston : Pearson, 2016.',
    'R. S. Pressman et B. R. Maxim, Software Engineering: A Practitioner’s Approach, 9e éd. New York : McGraw-Hill, 2020.',
    'ISO/IEC 25010:2011, Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE). Genève : ISO, 2011.',
    'P. Kruchten, The Rational Unified Process: An Introduction, 3e éd. Boston : Addison-Wesley, 2003.',
    'P. Roques, UML 2.5 par la pratique, 8e éd. Paris : Eyrolles, 2018.',
    'G. Booch, J. Rumbaugh et I. Jacobson, The Unified Modeling Language User Guide, 2e éd. Boston : Addison-Wesley, 2005.',
    'C. Larman, UML 2 et les design patterns, 3e éd. Paris : Pearson Education, 2005.',
    'M. Fowler, Patterns of Enterprise Application Architecture. Boston : Addison-Wesley, 2002.',
    'R. C. Martin, Clean Architecture: A Craftsman’s Guide to Software Structure and Design. Upper Saddle River : Prentice Hall, 2017.',
    'E. Gamma, R. Helm, R. Johnson et J. Vlissides, Design Patterns: Elements of Reusable Object-Oriented Software. Reading : Addison-Wesley, 1994.',
    'OWASP Foundation, « OWASP Top 10:2021 », 2021. [En ligne]. Disponible : https://owasp.org/Top10/',
    'Mozilla, « MDN Web Docs », [En ligne]. Disponible : https://developer.mozilla.org. [Consulté le 15 juin 2026].',
  ],
  annexes: [
    p('Annexe 1 : Guide d’entretien utilisé auprès du secrétariat et des encadreurs.'),
    {
      kind: 'list',
      items: [
        'Comment une demande de stage est-elle reçue et enregistrée ?',
        'Combien de temps faut-il pour valider une demande ?',
        'Quelles difficultés rencontrez-vous dans le suivi des rapports ?',
      ],
    },
  ],
};
