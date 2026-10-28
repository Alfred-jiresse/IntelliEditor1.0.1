// The fixed parts of a generated TFC: content types, relationships, settings, footer and the
// styles — the styles are DERIVED from the profile, so a generated document conforms to the
// very norm the checker applies.

import type { ConformityProfile, HeadingSpec } from '../profile/types.ts';

export const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const WP_NS = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const FOOTER_RELATIONSHIP_ID = 'rIdFooter1';

/** Image types are declared unconditionally: an unused Default is harmless. */
export function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Default Extension="jpeg" ContentType="image/jpeg"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;
}

export const PACKAGE_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>
</Relationships>`;

export interface ImageRelationship {
  readonly relationshipId: string;
  /** Target relative to `/word/`, e.g. `media/image1.png`. */
  readonly partName: string;
}

export function documentRelsXml(images: readonly ImageRelationship[] = []): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rIdStyles1" Type="${REL}/styles" Target="styles.xml"/>
<Relationship Id="rIdSettings1" Type="${REL}/settings" Target="settings.xml"/>
<Relationship Id="${FOOTER_RELATIONSHIP_ID}" Type="${REL}/footer" Target="footer1.xml"/>
${images.map((image) => `<Relationship Id="${image.relationshipId}" Type="${REL}/image" Target="${image.partName}"/>`).join('\n')}
</Relationships>`;
}

/** `updateFields` makes Word refresh the TOC and lists the first time the file is opened. */
export const SETTINGS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="${W_NS}"><w:updateFields w:val="true"/><w:defaultTabStop w:val="708"/></w:settings>`;

export function footerXml(alignment: 'left' | 'center' | 'right'): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="${alignment}"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
}

export const DOCUMENT_OPEN = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}" xmlns:wp="${WP_NS}"><w:body>`;
export const DOCUMENT_CLOSE = '</w:body></w:document>';

function headingStyle(level: number, spec: HeadingSpec, centered: boolean): string {
  const rPr = [
    spec.bold ? '<w:b/>' : '<w:b w:val="0"/>',
    spec.italic ? '<w:i/>' : '<w:i w:val="0"/>',
    spec.textCase === 'upper' ? '<w:caps/>' : '',
    `<w:sz w:val="${Math.round(spec.sizePt * 2)}"/>`,
  ].join('');
  return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/>${level === 1 ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="${level === 1 ? 0 : 240}" w:after="240"/>${centered ? '<w:jc w:val="center"/>' : '<w:jc w:val="left"/>'}<w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr>${rPr}</w:rPr></w:style>`;
}

export function stylesXml(profile: ConformityProfile): string {
  const t = profile.typography;
  const font = t.bodyFonts[0] ?? 'Times New Roman';
  const size = Math.round(t.bodySizePt * 2);
  const line = Math.round(t.lineSpacing * 240);
  const headings = profile.headings
    .slice(0, 4)
    .map((spec, i) => headingStyle(i + 1, spec, i === 0))
    .join('');
  const toc = [1, 2, 3]
    .map(
      (level) =>
        `<w:style w:type="paragraph" w:styleId="TOC${level}"><w:name w:val="toc ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8494"/></w:tabs><w:spacing w:after="60"/><w:ind w:left="${(level - 1) * 240}"/><w:jc w:val="left"/></w:pPr></w:style>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="both"/></w:pPr></w:style>
${headings}
<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="60" w:after="200"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:sz w:val="${Math.max(16, size - 4)}"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="TOCHeading"><w:name w:val="TOC Heading"/><w:basedOn w:val="Heading1"/><w:next w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="TableofFigures"><w:name w:val="table of figures"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="8494"/></w:tabs><w:jc w:val="left"/></w:pPr></w:style>
${toc}
</w:styles>`;
}
