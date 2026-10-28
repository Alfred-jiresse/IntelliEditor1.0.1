// Test documents built in memory, so every test states exactly the XML it judges.

import { writeZip } from '@docx-editor.dev/core/store';
import type { ConformityProfile } from '../profile/types.ts';
import { UDBL_TFC_PROFILE } from '../profile/udbl-tfc.ts';
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
} from '../template/parts.ts';
import { field, paragraph, run, sectionProperties } from '../template/wml.ts';

const encode = (text: string) => new TextEncoder().encode(text);

export const A4_UDBL_MARGINS = { top: 1984, right: 1417, bottom: 1417, left: 1984 };

export interface FixtureOptions {
  readonly profile?: ConformityProfile;
  readonly finalSection?: string;
  readonly footerAlignment?: 'left' | 'center' | 'right';
  /** Replace the whole styles part (e.g. to test the cascade). */
  readonly styles?: string;
  /** Replace the main document part verbatim (e.g. to test namespace prefixes). */
  readonly documentXml?: string;
}

export function docx(bodyXml: string, options: FixtureOptions = {}): Uint8Array {
  const profile = options.profile ?? UDBL_TFC_PROFILE;
  const finalSection =
    options.finalSection ??
    sectionProperties({
      marginsTwips: A4_UDBL_MARGINS,
      footerRelationshipId: FOOTER_RELATIONSHIP_ID,
      numberFormat: 'decimal',
      numberStart: 1,
    });
  const parts = new Map<string, Uint8Array>([
    ['/[Content_Types].xml', encode(contentTypesXml())],
    ['/_rels/.rels', encode(PACKAGE_RELS)],
    [
      '/word/document.xml',
      encode(options.documentXml ?? `${DOCUMENT_OPEN}${bodyXml}${finalSection}${DOCUMENT_CLOSE}`),
    ],
    ['/word/_rels/document.xml.rels', encode(documentRelsXml())],
    ['/word/styles.xml', encode(options.styles ?? stylesXml(profile))],
    ['/word/settings.xml', encode(SETTINGS_XML)],
    ['/word/footer1.xml', encode(footerXml(options.footerAlignment ?? 'right'))],
  ]);
  return writeZip(parts);
}

export const h = (level: number, text: string) => paragraph(text, { style: `Heading${level}` });
export const p = (text: string) => paragraph(text);
export const caption = (text: string) => paragraph(text, { style: 'Caption' });
export const table = (firstCell: string) =>
  `<w:tbl><w:tblGrid><w:gridCol w:w="4000"/></w:tblGrid><w:tr><w:tc>${paragraph(firstCell)}</w:tc></w:tr></w:tbl>`;
export const tocField = () => paragraph([field('TOC \\o "1-3" \\h \\z \\u', 'table')]);
export { field, paragraph, run };
