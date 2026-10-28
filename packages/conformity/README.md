# @intellieditor/conformity

Moteur de conformité d'IntelliEditor : il vérifie qu'un document Word (.docx) respecte la norme
de rédaction d'un TFC — par défaut celle de la Faculté des Sciences Informatiques de l'UDBL — et
dit précisément où et pourquoi il ne la respecte pas.

Le moteur ne dépend ni de React ni de l'éditeur : il lit des octets DOCX et rend un rapport. Le
même code tourne dans l'éditeur (panneau « Conformité ») et en ligne de commande.

## Architecture

```mermaid
flowchart LR
  A[Octets .docx] --> B[xml/ — lecture bornée<br/>readZip + readXml du moteur]
  B --> C[reader/ — modèle du document<br/>cascade des styles, sections, champs]
  C --> D[analysis/ — structure du TFC<br/>parties, chapitres, introduction]
  P[profile/ — la norme en données<br/>UDBL intégré, fichier de règles .txt ou JSON] --> E
  D --> E[rules/ — une règle = une fonction pure]
  E --> F[engine — rapport<br/>score, 🟢🟠🔴, constats localisés]
  P --> T[template/ — « Nouveau TFC »<br/>document conforme au même profil]
```

| Couche      | Rôle                                                                                                                                  | Dépend de                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| `xml/`      | Frontière de confiance : zip et XML lus par les lecteurs bornés du moteur (anti zip-bomb, pas de DTD/entités), noms d'espaces résolus | `@docx-editor.dev/core/store`     |
| `model/`    | Ce que les règles voient : paragraphes, sections, mise en forme résolue                                                               | —                                 |
| `reader/`   | XML → modèle, en appliquant la cascade de styles de Word                                                                              | `xml/`, `model/`                  |
| `analysis/` | Retrouve le squelette du TFC (liminaires, introduction, chapitres…)                                                                   | `model/`, `profile/`              |
| `profile/`  | Toutes les valeurs de la norme ; aucune règle ne contient de constante                                                                | `model/`                          |
| `rules/`    | Une fonction pure par exigence ; `pass`, `fail` (avec constats) ou `skip` (avec raison)                                               | `analysis/`, `model/`, `profile/` |
| `engine.ts` | Orchestration, isolation des règles, score                                                                                            | tout ce qui précède               |
| `template/` | Génère un TFC vierge conforme au profil actif                                                                                         | `profile/`, `core/store`          |

Principes : le moteur est en **lecture seule** (une correction est _décrite_, l'éditeur l'applique
en une étape annulable) ; une règle qui ne peut pas conclure dit **« non vérifiable »** plutôt que
de deviner ; une règle qui plante n'arrête pas les autres.

## Règles (profil UDBL)

| Catégorie           | Règle                                                                                                                                                                                                             | Source           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Mise en page        | Format A4 · marges 3,5/2,5/3,5/2,5 cm (correction automatique) · pages numérotées · numéro au coin droit · numérotation séparée liminaires / corps                                                                | Norme §1.2.1     |
| Typographie         | Times New Roman · 12 pt · interligne 1,25                                                                                                                                                                         | §1.3.1           |
| Titres              | Style par niveau (T1 majuscule gras…) · numérotation des sections (doublons, sauts, mauvais chapitre)                                                                                                             | §1.3.1, §1.1     |
| Structure           | Page de garde · parties obligatoires · ordre · sections de l'introduction · ≤ 4 chapitres · introduction/conclusion partielles · parties vides · table des matières **automatique** · listes des figures/tableaux | §1.1, grille MRS |
| Tableaux et figures | Légende au-dessus des tableaux, sous les figures · numérotation « chapitre.ordre »                                                                                                                                | §1.3.1           |
| Références          | Intitulé « Références » · ≥ 10 sources · citations IEEE `[n]` cohérentes avec la liste                                                                                                                            | §1.4, §1.5       |
| Intégrité           | Aucun « Erreur ! Signet non défini. »                                                                                                                                                                             | —                |
| Longueur            | Introduction ≤ 6 pages · chapitres ≤ 20 pages (estimation)                                                                                                                                                        | §1.1             |

## Utilisation

```bash
# Vérifier un ou plusieurs fichiers (code de sortie 1 si non conforme)
bun packages/conformity/src/cli.ts mon-tfc.docx
bun packages/conformity/src/cli.ts *.docx --json > rapport.json

# Avec une autre norme (fichier de règles .txt ou .json, superposé à la norme UDBL)
bun packages/conformity/src/cli.ts mon-tfc.docx --profil packages/conformity/regles/exemple-faculte-de-droit.txt

# Régénérer les documents de démonstration de l'application
# (le preload fournit le DOM minimal dont la mise en page de l'éditeur a besoin)
bun --preload ./scripts/test/preload-dom.ts packages/conformity/scripts/make-samples.ts

# Redessiner les figures de l'exemple conforme (Pillow + polices DejaVu)
python3 packages/conformity/scripts/assets/make-figures.py

# Tests
bun test packages/conformity
```

```ts
import { checkDocx, createTfcTemplate, parseProfile } from '@intellieditor/conformity';

const run = checkDocx(bytes); // profil UDBL par défaut
if (run.ok) console.log(run.report.summary); // { level: 'non-conforme', score: 23, … }
```

## Documents de démonstration

`make-samples` écrit dans `examples/vite/public/intellieditor/` :

| Fichier                     | Contenu                                                                                                                                                                                                   | Verdict attendu                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `tfc-exemple-conforme.docx` | TFC fictif complet : logo UDBL, pages liminaires, introduction en 9 points, 3 chapitres (introductions et conclusions partielles), 5 figures, 5 tableaux, 12 références IEEE citées dans l'ordre, annexes | conforme, 100/100              |
| `tfc-modele-udbl.docx`      | Le squelette de « Nouveau TFC », avec le logo                                                                                                                                                             | à revoir (une seule référence) |
| `tfc-exemple-erreurs.docx`  | Un document volontairement fautif (une section, Calibri, marges, numérotation…)                                                                                                                           | non conforme                   |
| `logo-udbl.png`             | Le logo proposé par défaut dans « Nouveau TFC »                                                                                                                                                           | —                              |

Le générateur est piloté par le contenu (`src/template/content.ts`) : `BodyBuilder` numérote
chapitres, sections, figures et tableaux, et écrit la table des matières et les listes comme de
vrais champs `TOC`. Leurs numéros de page sont calculés par le **moteur de mise en page de
l'éditeur** (`scripts/samples/paginate.ts`, mesure HarfBuzz avec Liberation Serif, métriques de
Times New Roman), en itérant jusqu'à ce qu'ils soient stables.

Les légendes sont écrites comme le fait la commande `insertCaption` de l'éditeur :
`Figure 2.` suivi d'un champ `SEQ Figure \* ARABIC \s 1`. Les listes sont des champs
`TOC \c "Figure"` / `TOC \c "Tableau"`, avec le début et la fin du champ dans des paragraphes
à part. Un document généré se met donc à jour dans l'éditeur (et dans Word) comme un document
écrit à la main.

## Outils de rédaction dans l'éditeur

Trois commandes du moteur (`packages/core`) permettent d'écrire un TFC complet en partant d'un
fichier vide. L'application les expose dans ses menus :

| Menu                                   | Commande                        | Effet                                                                                                                        |
| -------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fichier → Numérotation des pages…      | `setPageNumbering`              | Format de la section du curseur (1, i, I, a, A), recommencer à N ou continuer                                                |
| Insertion → Légende…                   | `insertCaption`                 | « Figure 2.1 … » sous l'élément, « Tableau 1.3 … » au-dessus ; les autres légendes sont renumérotées dans la même annulation |
| Insertion → Liste des figures/tableaux | `insertToc` avec `captionLabel` | Liste générée depuis les légendes, mise à jour avec « Mettre à jour la table »                                               |
| Insertion → Renuméroter les légendes   | `updateCaptionNumbers`          | Corrige les numéros après un déplacement ou une suppression                                                                  |

## Changer de norme sans modifier le code : le fichier de règles

Une autre faculté ou université remplace la norme avec un **fichier texte** (`.txt`), sans
toucher au programme. Dans l'application : bouton **« Règles… »** → _Télécharger le modèle_,
modifier, _Importer un fichier de règles_. Un fichier refusé ne change rien et chaque erreur
indique sa ligne ; la norme importée est retenue dans le navigateur.

Le fichier contient deux choses :

1. **Les valeurs des règles intégrées** (marges, police, titres, parties et leur ordre,
   chapitres, légendes, références, longueurs, et la gravité de chaque règle, qu'on peut aussi
   désactiver). Une clé absente garde la valeur UDBL.
2. **Des règles propres à l'établissement**, un bloc `[regle]` chacune, à partir de cinq types
   écrits et testés dans `src/rules/custom.ts` :

| Type                   | Ce que la règle vérifie                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `texte interdit`       | aucun des mots ou expressions de `valeurs` dans la `zone` (mots entiers) |
| `texte obligatoire`    | chacun des textes de `valeurs` apparaît dans la `zone`                   |
| `partie obligatoire`   | une partie titrée comme l'un des `valeurs` existe                        |
| `longueur de partie`   | la partie titrée `valeurs` respecte `min/max mots`, `min/max pages`      |
| `longueur du document` | le travail (hors page de garde) respecte les bornes                      |

```ini
[texte]
police = Arial
taille = 11 pt

[structure]
parties = Dédicace?, Remerciements, Sommaire, Introduction générale,
    Conclusion générale, Bibliographie (références bibliographiques), Annexes?
chapitres = 2 à 5

[regles]
references.ieee = désactivée

[regle] Rédaction impersonnelle
type = texte interdit
valeurs = nous, notre, nos
zone = corps
gravite = avertissement
explication = Le mémoire est rédigé à la forme impersonnelle.
```

Fichiers fournis dans `regles/` : `regles-udbl-fsi.txt` (la norme UDBL complète et commentée,
générée par `make-samples`) et `exemple-faculte-de-droit.txt` (une autre norme, avec quatre
règles propres).

**Sécurité.** Le fichier est une entrée non fiable : taille (256 Ko), nombre et longueur des
lignes plafonnés, clés lues dans un vocabulaire fixe, valeurs validées par `parseProfile` (le
même contrôle que pour le JSON). Rien n'est interprété comme du code ni comme une expression
régulière : les mots d'une règle sont comparés mot à mot, accents et majuscules ignorés.

Le même contenu peut être écrit en **JSON** (`parseRulesFile` reconnaît les deux formats ;
les règles propres vont dans `customRules`).

## Points à valider avec le directeur

- **Numérotation des pages** : la norme écrite dit « chiffres arabes de l'épigraphe à
  l'avant-propos, romains à partir de l'introduction », mais les TFC validés font l'inverse. Le
  profil suit la pratique (`liminaryNumberFormat: lowerRoman`, `bodyNumberFormat: decimal`) ; une
  ligne du profil suffit à changer.
- **Interligne** « 1,25 pts » lu comme 1,25 ligne.
- **Longueurs** estimées à partir du nombre de mots (≈ 330 mots par page).
