// « Nouveau TFC » and the worked example: TfcContent + cover → a norm-conforming DOCX.
//
// Three sections, as the norm needs them: the cover (unnumbered), the preliminary pages
// (their own numbering) and the body (restarting at 1 from the introduction). Styles come
// from the profile, so the document satisfies exactly the norm the checker applies.

import { writeZip } from '@docx-editor.dev/core/store';
import type { ConformityProfile } from '../profile/types.ts';
import { UDBL_TFC_PROFILE } from '../profile/udbl-tfc.ts';
import { BodyBuilder, type Anchor } from './body-builder.ts';
import type { TfcContent } from './content.ts';
import { BLANK_CONTENT } from './default-content.ts';
import {
  contentTypesXml,
  documentRelsXml,
  DOCUMENT_CLOSE,
  DOCUMENT_OPEN,
  FOOTER_RELATIONSHIP_ID,
  footerXml,
  PACKAGE_RELS,
  SETTINGS_XML,
  stylesXml,
} from './parts.ts';
import { inlinePicture, paragraph, run, sectionProperties } from './wml.ts';

export interface CoverLogo {
  readonly bytes: Uint8Array;
  readonly format: 'png' | 'jpeg';
}

export interface CoverMetadata {
  readonly institution: string;
  readonly faculty: string;
  readonly department: string;
  readonly city: string;
  readonly website: string;
  readonly title: string;
  readonly subtitle: string;
  readonly degree: string;
  readonly author: string;
  readonly field: string;
  readonly director: string;
  readonly coDirector: string;
  readonly date: string;
  readonly logo?: CoverLogo;
}

export const DEFAULT_COVER: CoverMetadata = {
  institution: 'Université Don Bosco de Lubumbashi',
  faculty: 'Faculté des Sciences Informatiques',
  department: 'Département de Génie Logiciel et Management des Systèmes d’Information',
  city: 'Lubumbashi',
  website: 'www.udbl.ac.cd',
  title: 'Thème de votre travail',
  subtitle: 'Cas d’application',
  degree: 'ingénieur technicien en Informatique',
  author: 'NOM POST-NOM Prénom',
  field: 'Génie Logiciel',
  director: 'Titre Prénom NOM',
  coDirector: '',
  date: 'Juillet 2026',
};

/** 4,5 cm, about the size the UDBL template prints its logo at. */
const LOGO_CM = 4.5;
const EMU_PER_CM = 360_000;

function cover(b: BodyBuilder, meta: CoverMetadata): void {
  const right = (label: string, value: string) =>
    b.raw(
      paragraph([run(`${label} : `, { bold: true, italic: true }), run(value, { bold: true })], {
        align: 'right',
        spaceAfterPt: 4,
      })
    );
  const centered = (text: string, options: Parameters<typeof paragraph>[1] = {}) =>
    b.raw(paragraph(text, { align: 'center', spaceAfterPt: 0, ...options }));

  b.raw(
    paragraph([run(meta.institution, { caps: true, sizePt: 14 })], {
      align: 'center',
      spaceAfterPt: 0,
    })
  );
  centered(meta.faculty);
  centered(meta.department);
  centered(meta.city);
  centered(meta.website, { borderBottom: true, spaceAfterPt: 18 });
  if (meta.logo) {
    const logo = b.register({ ...meta.logo, widthCm: LOGO_CM, aspect: 1 });
    const size = Math.round(LOGO_CM * EMU_PER_CM);
    b.raw(
      paragraph([inlinePicture(logo.relationshipId, size, size, 'Logo', 1000)], {
        align: 'center',
        spaceAfterPt: 18,
      })
    );
  } else {
    b.raw(
      paragraph([run('[ Logo de l’université ]', { italic: true })], {
        align: 'center',
        spaceBeforePt: 36,
        spaceAfterPt: 36,
      })
    );
  }
  b.raw(
    paragraph([run(meta.title, { caps: true, bold: true, sizePt: 16 })], {
      align: 'center',
      borderTop: true,
      spaceAfterPt: 0,
    })
  );
  b.raw(
    paragraph([run(meta.subtitle, { italic: true })], {
      align: 'center',
      borderBottom: true,
      spaceAfterPt: 36,
    })
  );
  b.raw(
    paragraph([run('Travail présenté et défendu en vue de l’obtention', { italic: true })], {
      align: 'right',
      spaceAfterPt: 0,
    })
  );
  b.raw(
    paragraph([run(`du grade d’${meta.degree}`, { italic: true })], {
      align: 'right',
      spaceAfterPt: 24,
    })
  );
  right('Par', meta.author);
  right('Filière', meta.field);
  if (meta.director) right('Directeur', meta.director);
  if (meta.coDirector) right('Co-directeur', meta.coDirector);
  b.raw(
    paragraph([run(meta.date, { bold: true, italic: true })], {
      align: 'center',
      spaceBeforePt: 48,
    })
  );
}

function preliminaryPages(b: BodyBuilder, content: TfcContent): void {
  b.heading(1, 'Épigraphe');
  b.raw(
    paragraph([run(`« ${content.epigraph.quote} »`, { italic: true })], {
      align: 'right',
      spaceBeforePt: 120,
    })
  );
  b.raw(paragraph(`— ${content.epigraph.author}`, { align: 'right' }));
  b.heading(1, 'Dédicace');
  for (const line of content.dedication)
    b.raw(paragraph([run(line, { italic: true })], { align: 'right' }));
  b.heading(1, 'Remerciements');
  for (const line of content.acknowledgements) b.paragraph(line);
  b.heading(1, 'Liste des figures');
  b.toc('figures');
  b.heading(1, 'Liste des tableaux');
  b.toc('tables');
  b.heading(1, 'Liste des acronymes');
  for (const [acronym, meaning] of content.acronyms) {
    b.raw(
      paragraph([run(acronym, { bold: true }), '<w:r><w:tab/></w:r>', run(meaning)], {
        align: 'left',
        hangingCm: 2.5,
        spaceAfterPt: 2,
      })
    );
  }
  b.heading(1, 'Table des matières');
  b.toc('contents');
  b.heading(1, 'Avant-propos');
  for (const line of content.foreword) b.paragraph(line);
}

export interface TfcDocumentOptions {
  /** Page labels for TOC/list rows ("iv", "12"), keyed by `Anchor.key` from a previous build. */
  readonly pageLabels?: ReadonlyMap<string, string>;
}

export interface TfcDocument {
  readonly bytes: Uint8Array;
  /** Where each heading/caption landed, for a pagination pass to number the TOC. */
  readonly anchors: readonly Anchor[];
}

const encoder = new TextEncoder();

/** Build a complete TFC document from content. */
export function createTfcDocument(
  meta: CoverMetadata,
  content: TfcContent,
  profile: ConformityProfile = UDBL_TFC_PROFILE,
  options: TfcDocumentOptions = {}
): TfcDocument {
  const cm = (value: number) => Math.round((value * 1440) / 2.54);
  const margins = {
    top: cm(profile.page.marginsCm.top),
    right: cm(profile.page.marginsCm.right),
    bottom: cm(profile.page.marginsCm.bottom),
    left: cm(profile.page.marginsCm.left),
  };
  const b = new BodyBuilder(options.pageLabels);
  cover(b, meta);
  b.raw(paragraph('', { trailing: sectionProperties({ marginsTwips: margins }) }));
  preliminaryPages(b, content);
  b.raw(
    paragraph('', {
      trailing: sectionProperties({
        marginsTwips: margins,
        footerRelationshipId: FOOTER_RELATIONSHIP_ID,
        numberFormat: profile.page.liminaryNumberFormat,
        numberStart: 1,
      }),
    })
  );
  b.content(content);
  const finalSection = sectionProperties({
    marginsTwips: margins,
    footerRelationshipId: FOOTER_RELATIONSHIP_ID,
    numberFormat: profile.page.bodyNumberFormat,
    numberStart: 1,
  });
  const body = b.build();

  const parts = new Map<string, Uint8Array>([
    ['/[Content_Types].xml', encoder.encode(contentTypesXml())],
    ['/_rels/.rels', encoder.encode(PACKAGE_RELS)],
    [
      '/word/document.xml',
      encoder.encode(`${DOCUMENT_OPEN}${body.xml}${finalSection}${DOCUMENT_CLOSE}`),
    ],
    ['/word/_rels/document.xml.rels', encoder.encode(documentRelsXml(b.images))],
    ['/word/styles.xml', encoder.encode(stylesXml(profile))],
    ['/word/settings.xml', encoder.encode(SETTINGS_XML)],
    ['/word/footer1.xml', encoder.encode(footerXml(profile.page.numberAlignment))],
  ]);
  for (const image of b.images) parts.set(`/word/${image.partName}`, image.image.bytes);
  return { bytes: writeZip(parts), anchors: body.anchors };
}

/** « Nouveau TFC » : the blank, norm-conforming skeleton. */
export function createTfcTemplate(
  meta: CoverMetadata = DEFAULT_COVER,
  profile: ConformityProfile = UDBL_TFC_PROFILE
): Uint8Array {
  return createTfcDocument(meta, BLANK_CONTENT, profile).bytes;
}
