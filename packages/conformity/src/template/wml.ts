// Tiny WordprocessingML builders for the template generator.
//
// Every piece of user-supplied text goes through `escapeXml` (the engine's own sink) — the
// template is filled from a form, and a title containing "<" or "&" must stay text.

import { escapeXml } from '@docx-editor.dev/core/store';

export interface RunOptions {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly caps?: boolean;
  readonly sizePt?: number;
}

export interface ParagraphOptions {
  readonly style?: string;
  readonly align?: 'left' | 'center' | 'right' | 'both';
  readonly spaceBeforePt?: number;
  readonly spaceAfterPt?: number;
  /** Single line spacing (table cells), overriding the body's 1,25. */
  readonly singleSpacing?: boolean;
  readonly indentLeftCm?: number;
  /** Hanging indent, e.g. for reference lists. */
  readonly hangingCm?: number;
  readonly keepNext?: boolean;
  readonly borderTop?: boolean;
  readonly borderBottom?: boolean;
  /** `true` forces a page break before; `false` cancels one inherited from the style. */
  readonly pageBreakBefore?: boolean;
  /** Extra raw `w:pPr` children (already-built XML, e.g. a `w:sectPr`). */
  readonly trailing?: string;
}

const border = (side: 'top' | 'bottom') =>
  `<w:${side} w:val="single" w:sz="8" w:space="4" w:color="000000"/>`;

const twipsOfCm = (cm: number) => Math.round((cm * 1440) / 2.54);

export function run(text: string, options: RunOptions = {}): string {
  const props = [
    options.bold ? '<w:b/>' : '',
    options.italic ? '<w:i/>' : '',
    options.caps ? '<w:caps/>' : '',
    options.sizePt ? `<w:sz w:val="${Math.round(options.sizePt * 2)}"/>` : '',
  ].join('');
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function spacingOf(options: ParagraphOptions): string {
  const attrs = [
    options.spaceBeforePt !== undefined ? ` w:before="${options.spaceBeforePt * 20}"` : '',
    options.spaceAfterPt !== undefined ? ` w:after="${options.spaceAfterPt * 20}"` : '',
    options.singleSpacing ? ' w:line="240" w:lineRule="auto"' : '',
  ].join('');
  return attrs ? `<w:spacing${attrs}/>` : '';
}

function indentOf(options: ParagraphOptions): string {
  if (options.indentLeftCm === undefined && options.hangingCm === undefined) return '';
  const hanging = options.hangingCm ?? 0;
  const left = (options.indentLeftCm ?? 0) + hanging;
  return `<w:ind w:left="${twipsOfCm(left)}"${hanging ? ` w:hanging="${twipsOfCm(hanging)}"` : ''}/>`;
}

/** `w:pPr` children in schema order (CT_PPrBase): style, keeps, break, borders, spacing, ind, jc. */
export function paragraph(
  content: string | readonly string[],
  options: ParagraphOptions = {}
): string {
  const borders =
    options.borderTop || options.borderBottom
      ? `<w:pBdr>${options.borderTop ? border('top') : ''}${options.borderBottom ? border('bottom') : ''}</w:pBdr>`
      : '';
  const pPr = [
    options.style ? `<w:pStyle w:val="${options.style}"/>` : '',
    options.keepNext ? '<w:keepNext/>' : '',
    options.pageBreakBefore === true
      ? '<w:pageBreakBefore/>'
      : options.pageBreakBefore === false
        ? '<w:pageBreakBefore w:val="0"/>'
        : '',
    borders,
    spacingOf(options),
    indentOf(options),
    options.align ? `<w:jc w:val="${options.align}"/>` : '',
    options.trailing ?? '',
  ].join('');
  const runs = typeof content === 'string' ? (content ? run(content) : '') : content.join('');
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${runs}</w:p>`;
}

/** A complex field (TOC, PAGE…) with a placeholder result shown until it is updated. */
export function field(instruction: string, placeholder: string, options: RunOptions = {}): string {
  return [
    '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>',
    `<w:r><w:instrText xml:space="preserve"> ${escapeXml(instruction)} </w:instrText></w:r>`,
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
    run(placeholder, options),
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
  ].join('');
}

/**
 * A caption number: the `SEQ` field Word's Insert Caption writes — the order of `label` in
 * its chapter, restarting at each Heading 1 — with its result already computed.
 */
export function sequenceField(label: string, number: number): string {
  return [
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r>',
    `<w:r><w:instrText xml:space="preserve"> SEQ ${escapeXml(label)} \\* ARABIC \\s 1 </w:instrText></w:r>`,
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r>',
    run(String(number)),
    '<w:r><w:fldChar w:fldCharType="end"/></w:r>',
  ].join('');
}

export interface SectionOptions {
  readonly marginsTwips: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  readonly footerRelationshipId?: string;
  readonly numberFormat?: string;
  readonly numberStart?: number;
}

export function sectionProperties(options: SectionOptions): string {
  const m = options.marginsTwips;
  return [
    '<w:sectPr>',
    options.footerRelationshipId
      ? `<w:footerReference w:type="default" r:id="${options.footerRelationshipId}"/>`
      : '',
    '<w:type w:val="nextPage"/>',
    '<w:pgSz w:w="11906" w:h="16838"/>',
    `<w:pgMar w:top="${m.top}" w:right="${m.right}" w:bottom="${m.bottom}" w:left="${m.left}" w:header="708" w:footer="708" w:gutter="0"/>`,
    options.numberFormat
      ? `<w:pgNumType w:fmt="${options.numberFormat}"${options.numberStart !== undefined ? ` w:start="${options.numberStart}"` : ''}/>`
      : '',
    '</w:sectPr>',
  ].join('');
}

/** An inline picture, sized in EMU, pointing at an image relationship. */
export function inlinePicture(
  relationshipId: string,
  widthEmu: number,
  heightEmu: number,
  name: string,
  /** `wp:docPr/@id`, unique per document. */
  id = 1
): string {
  const safe = escapeXml(name);
  return [
    '<w:r><w:drawing>',
    `<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/>`,
    `<wp:docPr id="${id}" name="${safe}"/>`,
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">',
    `<pic:nvPicPr><pic:cNvPr id="0" name="${safe}"/><pic:cNvPicPr/></pic:nvPicPr>`,
    `<pic:blipFill><a:blip r:embed="${relationshipId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`,
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`,
    '</pic:pic></a:graphicData></a:graphic></wp:inline>',
    '</w:drawing></w:r>',
  ].join('');
}
