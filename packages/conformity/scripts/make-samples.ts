#!/usr/bin/env bun
/* eslint-disable no-console -- a command-line tool: printing the report IS its output. */
// Generates the demonstration documents served by the app:
//   - tfc-exemple-erreurs.docx: a short TFC carrying, anonymized, the form errors observed in
//     real deposited TFC (stale "Erreur ! Signet non défini", hand-typed TOC, duplicated and
//     skipped section numbers, captions on the wrong side, too few references…);
//   - tfc-exemple-conforme.docx: a complete fictional TFC (3 chapters, tables, figures, 12 IEEE
//     references, UDBL logo) that satisfies every rule, TOC and lists paginated by the editor;
//   - tfc-modele-udbl.docx: the « Nouveau TFC » template, for comparison.
//
// Usage: bun --preload ./scripts/test/preload-dom.ts packages/conformity/scripts/make-samples.ts [outputDir]

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { writeZip } from '@docx-editor.dev/core/store';
import { UDBL_TFC_PROFILE } from '../src/profile/udbl-tfc.ts';
import {
  contentTypesXml,
  documentRelsXml,
  DOCUMENT_CLOSE,
  DOCUMENT_OPEN,
  FOOTER_RELATIONSHIP_ID,
  footerXml,
  PACKAGE_RELS,
  SETTINGS_XML,
} from '../src/template/parts.ts';
import { createTfcDocument, DEFAULT_COVER } from '../src/template/tfc-template.ts';
import { BLANK_CONTENT } from '../src/template/default-content.ts';
import { EXAMPLE_CONTENT, EXAMPLE_COVER } from './samples/exemple-conforme.ts';
import { pageLabels } from './samples/paginate.ts';
import { paragraph, run, sectionProperties } from '../src/template/wml.ts';

const out = process.argv[2] ?? join(import.meta.dir, '../../../examples/vite/public/intellieditor');
const encode = (text: string) => new TextEncoder().encode(text);

/** Word's out-of-the-box look: Calibri 11, single spacing — what a student starts from. */
const WORD_DEFAULT_STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:pageBreakBefore/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="18"/></w:rPr></w:style>
</w:styles>`;

const h = (level: number, text: string) => paragraph(text, { style: `Heading${level}` });
const p = (text: string) => paragraph(text, { align: 'both' });
const centered = (text: string, bold = false) =>
  paragraph([run(text, { bold })], { align: 'center' });
const caption = (text: string) => paragraph(text, { style: 'Caption' });
const table = (rows: readonly string[]) =>
  `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid><w:gridCol w:w="4200"/><w:gridCol w:w="4200"/></w:tblGrid>${rows
    .map(
      (row) =>
        `<w:tr>${row
          .split('|')
          .map(
            (cell) =>
              `<w:tc><w:tcPr><w:tcW w:w="4200" w:type="dxa"/></w:tcPr>${paragraph(cell.trim())}</w:tc>`
          )
          .join('')}</w:tr>`
    )
    .join('')}</w:tbl>`;

const LOREM =
  'Les exploitants de la région rencontrent des difficultés pour suivre leurs activités, faute d’outils adaptés à leur contexte. Les informations sont dispersées entre des registres papier et des messages, ce qui retarde les décisions et multiplie les erreurs de transcription.';

const LEVEL_TEXT =
  'Dans le contexte actuel, la gestion manuelle des informations pose de nombreux problèmes.';

function flawedTfc(): Uint8Array {
  const body = [
    // Cover: no faculty line, no director.
    centered('UNIVERSITÉ DON BOSCO DE LUBUMBASHI'),
    centered('Lubumbashi'),
    centered('CONCEPTION D’UNE APPLICATION DE GESTION', true),
    paragraph(
      [
        run('Travail présenté et défendu en vue de l’obtention du grade d’ingénieur technicien', {
          italic: true,
        }),
      ],
      { align: 'right' }
    ),
    paragraph([run('Par : ÉTUDIANT Exemple', { bold: true })], { align: 'right' }),
    centered('Juillet 2025', true),
    h(1, 'Dédicace'),
    p('À ma famille.'),
    h(1, 'Remerciements'),
    h(1, 'Liste des figures'),
    p('Figure 1 Architecture de la solution ........ Erreur ! Signet non défini.'),
    h(1, 'Table des matières'),
    p('INTRODUCTION GENERALE ........ 1'),
    p('CHAPITRE 1. GENERALITES ........ 4'),
    p('2.5.5. Statistiques ........ Erreur ! Signet non défini.'),
    h(1, 'Introduction générale'),
    h(2, '0.1. Problématique'),
    p(`${LEVEL_TEXT} Comme le souligne [1], la numérisation reste limitée.`),
    h(2, '0.2. Choix et intérêt du sujet'),
    p(LOREM),
    h(2, '0.3. Méthodologie'),
    p(LOREM),
    h(2, '0.4. État de l’art'),
    p(`${LOREM} Plusieurs travaux antérieurs [2] et [9] abordent ce problème.`),
    h(2, '0.5. Subdivision du travail'),
    p(LOREM),
    h(1, 'Chapitre 1. Généralités et étude de l’existant'),
    h(2, '1.1. Introduction partielle'),
    p(LOREM),
    h(2, '1.2. Présentation du cadre d’étude'),
    h(3, '1.2.1. Historique'),
    p(LOREM),
    h(3, '1.2.3. Situation géographique'),
    p(LOREM),
    h(3, '1.2.3. Organisation'),
    p(LOREM),
    table(['Désignation | Rôle', 'Secrétariat | Saisie des résultats', 'Comité | Validation']),
    caption('Tableau 1 Organisation actuelle'),
    paragraph([run('[schéma de l’existant]', { italic: true })], { align: 'center' }),
    caption('Figure 3 Schéma de l’existant'),
    h(1, 'Chapitre 2. Analyse et conception'),
    h(2, '1.1. Identification des besoins'),
    p(LOREM),
    h(2, '2.2. Diagramme de cas d’utilisation'),
    p(LOREM),
    h(1, 'Conclusion générale'),
    p(LOREM),
    h(1, 'Bibliographie'),
    p('[1] K. Auteur, « Gestion automatisée d’une ligue sportive », mémoire, 2017.'),
    p('[2] O. Autre, « Application web de gestion des licences », mémoire, 2020.'),
    p('[3] T. Troisième, « Le football comme facteur de rapprochement », mémoire, 2019.'),
    p('[4] P. Quatrième, « Gestion des paiements avec notifications », UDBL, 2024.'),
    p('[5] FECOFA, Règlements des compétitions nationales, 2023.'),
    p('[6] P. Roques, UML en action : de l’analyse à la conception, Paris : Eyrolles, 2003.'),
    p('[7] M. Nebra, Concevez votre site web avec PHP et MySQL, OpenClassrooms, 2013.'),
  ].join('');
  // One single section, Word's default 2,5 cm margins, page number centred.
  const section = sectionProperties({
    marginsTwips: { top: 1417, right: 1417, bottom: 1417, left: 1417 },
    footerRelationshipId: FOOTER_RELATIONSHIP_ID,
  });
  return writeZip(
    new Map([
      ['/[Content_Types].xml', encode(contentTypesXml())],
      ['/_rels/.rels', encode(PACKAGE_RELS)],
      ['/word/document.xml', encode(`${DOCUMENT_OPEN}${body}${section}${DOCUMENT_CLOSE}`)],
      ['/word/_rels/document.xml.rels', encode(documentRelsXml())],
      ['/word/styles.xml', encode(WORD_DEFAULT_STYLES)],
      ['/word/settings.xml', encode(SETTINGS_XML)],
      ['/word/footer1.xml', encode(footerXml('center'))],
    ])
  );
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'tfc-exemple-erreurs.docx'), flawedTfc());
/**
 * Build, paginate with the editor's layout engine, rebuild with the page numbers — until the
 * numbers stop moving (adding them can re-wrap a TOC row, so one pass is not always enough).
 */
async function paginated(
  meta: typeof DEFAULT_COVER,
  content: typeof BLANK_CONTENT
): Promise<Uint8Array> {
  // First pass: a wide placeholder so TOC rows already have their final width.
  let labels = new Map<string, string>();
  let document = createTfcDocument(meta, content, UDBL_TFC_PROFILE);
  labels = new Map(document.anchors.map((anchor) => [anchor.key, 'xxx']));
  for (let pass = 0; pass < 4; pass += 1) {
    document = createTfcDocument(meta, content, UDBL_TFC_PROFILE, { pageLabels: labels });
    const next = await pageLabels(document.bytes, document.anchors);
    const stable =
      [...next].every(([key, label]) => labels.get(key) === label) && next.size === labels.size;
    labels = next;
    if (stable) break;
  }
  return createTfcDocument(meta, content, UDBL_TFC_PROFILE, { pageLabels: labels }).bytes;
}

const logo = EXAMPLE_COVER.logo;
writeFileSync(
  join(out, 'tfc-modele-udbl.docx'),
  await paginated({ ...DEFAULT_COVER, ...(logo ? { logo } : {}) }, BLANK_CONTENT)
);
writeFileSync(
  join(out, 'tfc-exemple-conforme.docx'),
  await paginated(EXAMPLE_COVER, EXAMPLE_CONTENT)
);
// The logo « Nouveau TFC » offers by default.
copyFileSync(join(import.meta.dir, 'assets/logo-udbl.png'), join(out, 'logo-udbl.png'));
console.log(`Échantillons écrits dans ${out}`);
