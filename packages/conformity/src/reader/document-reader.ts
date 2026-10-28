// DocxPackage → DocumentModel: the body in reading order, split into sections.
//
// Section boundaries follow WordprocessingML: a `w:sectPr` inside a paragraph's properties
// CLOSES the section that paragraph belongs to, and the body's trailing `w:sectPr` describes
// the last one. Headers and footers are read only to learn where the page number is printed.

import type {
  BlockModel,
  DocumentModel,
  MarginsTwips,
  PageNumberFormat,
  PageNumberPlacement,
  ParagraphModel,
  SectionModel,
} from '../model/types.ts';
import type { DocxPackage } from '../xml/docx-package.ts';
import {
  attr,
  child,
  children,
  descendants,
  intAttr,
  isElement,
  type Element,
} from '../xml/element.ts';
import { countWords } from '../analysis/text.ts';
import { ParagraphReader } from './paragraph-reader.ts';
import { StyleCascade } from './styles.ts';

/** Block-level wrappers whose content is ordinary body flow. */
const BLOCK_WRAPPERS = new Set(['w:sdt', 'w:sdtContent', 'w:customXml', 'w:ins', 'w:moveTo']);

const NUMBER_FORMATS: Readonly<Record<string, PageNumberFormat>> = {
  decimal: 'decimal',
  lowerRoman: 'lowerRoman',
  upperRoman: 'upperRoman',
  lowerLetter: 'lowerLetter',
  upperLetter: 'upperLetter',
};

interface PendingSection {
  readonly sectPr: Element | undefined;
  readonly first: number;
  readonly last: number;
}

function readMargins(sectPr: Element | undefined): MarginsTwips | null {
  const pgMar = child(sectPr, 'w:pgMar');
  if (!pgMar) return null;
  const read = (name: string) => Math.abs(intAttr(pgMar, name) ?? 0);
  return {
    top: read('w:top'),
    right: read('w:right'),
    bottom: read('w:bottom'),
    left: read('w:left'),
  };
}

export class DocumentReader {
  private readonly cascade: StyleCascade;
  private readonly paragraphs: ParagraphReader;

  constructor(private readonly pkg: DocxPackage) {
    this.cascade = new StyleCascade(pkg.styles, pkg.theme);
    this.paragraphs = new ParagraphReader(this.cascade);
  }

  read(): DocumentModel {
    const body = child(this.pkg.document, 'w:body');
    const blocks: BlockModel[] = [];
    const paragraphs: ParagraphModel[] = [];
    const pending: PendingSection[] = [];
    let sectionStart = 0;
    let breakCarried = false;

    const visit = (container: Element | undefined): void => {
      for (const node of container?.children ?? []) {
        if (!isElement(node)) continue;
        if (node.name === 'w:p') {
          const index = paragraphs.length;
          const { paragraph, endsWithPageBreak } = this.paragraphs.read(
            node,
            index,
            pending.length
          );
          const model =
            breakCarried && !paragraph.startsPage ? { ...paragraph, startsPage: true } : paragraph;
          breakCarried = endsWithPageBreak;
          paragraphs.push(model);
          blocks.push({ kind: 'paragraph', paragraph: model });
          const sectPr = child(child(node, 'w:pPr'), 'w:sectPr');
          if (sectPr) {
            pending.push({ sectPr, first: sectionStart, last: index });
            sectionStart = index + 1;

            breakCarried = true; // a section break starts the next section on a new page (default)
          }
        } else if (node.name === 'w:tbl') {
          blocks.push({ kind: 'table', firstCellText: this.firstCellText(node) });
        } else if (BLOCK_WRAPPERS.has(node.name)) {
          visit(node);
        }
      }
    };
    visit(body);
    pending.push({
      sectPr: child(body, 'w:sectPr'),
      first: sectionStart,
      last: Math.max(sectionStart, paragraphs.length - 1),
    });

    const sections = this.readSections(pending);
    const wordCount = paragraphs
      .filter((p) => p.role !== 'toc' && p.role !== 'empty')
      .reduce((sum, p) => sum + countWords(p.text), 0);
    return { blocks, paragraphs, sections, wordCount };
  }

  private firstCellText(table: Element): string {
    const firstParagraph = descendants(table, 'w:p')[0];
    if (!firstParagraph) return '';
    return this.paragraphs.read(firstParagraph, -1, -1).paragraph.text;
  }

  private readSections(pending: readonly PendingSection[]): SectionModel[] {
    const sections: SectionModel[] = [];
    let inherited: PageNumberPlacement | null = null;
    pending.forEach((section, index) => {
      const sectPr = section.sectPr;
      const pgSz = child(sectPr, 'w:pgSz');
      const pgNumType = child(sectPr, 'w:pgNumType');
      const hasReferences =
        children(sectPr, 'w:headerReference').length +
          children(sectPr, 'w:footerReference').length >
        0;
      // Word inherits headers/footers from the previous section when a section names none.
      const placement = hasReferences ? this.pageNumberPlacement(sectPr) : inherited;
      inherited = placement;
      sections.push({
        index,
        pageWidthTwips: intAttr(pgSz, 'w:w') ?? null,
        pageHeightTwips: intAttr(pgSz, 'w:h') ?? null,
        margins: readMargins(sectPr),
        numberFormat: NUMBER_FORMATS[attr(pgNumType, 'w:fmt') ?? 'decimal'] ?? 'other',
        numberStart: intAttr(pgNumType, 'w:start') ?? null,
        pageNumber: placement,
        firstParagraph: section.first,
        lastParagraph: section.last,
      });
    });
    return sections;
  }

  /** Find the PAGE field in the section's headers/footers ("default" variant first). */
  private pageNumberPlacement(sectPr: Element | undefined): PageNumberPlacement | null {
    const references = [
      ...children(sectPr, 'w:footerReference').map((ref) => ({ ref, where: 'footer' as const })),
      ...children(sectPr, 'w:headerReference').map((ref) => ({ ref, where: 'header' as const })),
    ].sort(
      (a, b) =>
        Number(attr(b.ref, 'w:type') === 'default') - Number(attr(a.ref, 'w:type') === 'default')
    );
    for (const { ref, where } of references) {
      const partName = this.pkg.documentRelationships.get(attr(ref, 'r:id') ?? '');
      const part = partName ? this.pkg.readPart(partName) : null;
      if (!part) continue;
      for (const p of descendants(part, 'w:p')) {
        const { paragraph } = this.paragraphs.read(p, -1, -1);
        if (paragraph.fieldInstructions.some((instr) => /^PAGE\b/i.test(instr))) {
          return { where, alignment: paragraph.alignment };
        }
      }
    }
    return null;
  }
}
