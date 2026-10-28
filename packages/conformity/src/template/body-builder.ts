// TfcContent → body XML, with every number computed here.
//
// The table of contents and the lists of figures/tables are written as REAL fields whose
// cached result already lists the entries, so the document reads complete on opening and
// Word/the editor can still regenerate them. Their page numbers are supplied by the caller
// (a pagination pass) through `pageLabels`, keyed by the anchors this builder reports.

import type { Block, ChapterContent, ImageContent, SectionContent, TfcContent } from './content.ts';
import { inlinePicture, paragraph, run, sequenceField } from './wml.ts';

const EMU_PER_CM = 360_000;

/** A heading or caption whose page number the TOC/lists need. */
export interface Anchor {
  readonly key: string;
  /** Index among the BODY's direct children — the layout's paragraph id carries it. */
  readonly bodyIndex: number;
}

export interface RegisteredImage {
  readonly relationshipId: string;
  readonly partName: string;
  readonly image: ImageContent;
}

type TocKind = 'contents' | 'figures' | 'tables';

interface Entry {
  readonly key: string;
  readonly level: number;
  readonly text: string;
}

/** One body child, or a TOC whose rows are only known once the whole body is written. */
type Slot = { readonly xml: string; readonly key?: string } | { readonly toc: TocKind };

const TOC_INSTRUCTIONS: Readonly<Record<TocKind, string>> = {
  contents: 'TOC \\o "1-3" \\h \\z \\u',
  figures: 'TOC \\h \\z \\c "Figure"',
  tables: 'TOC \\h \\z \\c "Tableau"',
};

const EMPTY_TOC: Readonly<Record<TocKind, string>> = {
  contents: 'Clic droit → « Mettre à jour le champ » pour générer la table des matières.',
  figures: 'Aucune figure pour l’instant.',
  tables: 'Aucun tableau pour l’instant.',
};

export class BodyBuilder {
  private readonly slots: Slot[] = [];
  private readonly entries: Record<TocKind, Entry[]> = { contents: [], figures: [], tables: [] };
  readonly images: RegisteredImage[] = [];
  private counter = 0;
  /** Chapter number captions are counted in (0 inside the introduction). */
  private chapterNumber = 0;
  private figureInChapter = 0;
  private tableInChapter = 0;

  constructor(private readonly pageLabels: ReadonlyMap<string, string> = new Map()) {}

  private key(prefix: string): string {
    this.counter += 1;
    return `${prefix}${this.counter}`;
  }

  raw(xml: string): void {
    this.slots.push({ xml });
  }

  heading(level: number, text: string, inContents = true): void {
    const key = this.key('h');
    this.slots.push({ xml: paragraph(text, { style: `Heading${level}` }), key });
    if (inContents && level <= 3) this.entries.contents.push({ key, level, text });
  }

  toc(kind: TocKind): void {
    this.slots.push({ toc: kind });
  }

  paragraph(text: string): void {
    this.raw(paragraph(text));
  }

  // ─── Blocks ────────────────────────────────────────────────────────────

  blocks(blocks: readonly Block[], sectionNumber: string): void {
    let sub = 0;
    for (const block of blocks) {
      switch (block.kind) {
        case 'paragraph':
          this.paragraph(block.text);
          break;
        case 'list':
          for (const item of block.items) this.raw(paragraph(`– ${item}`, { indentLeftCm: 1 }));
          break;
        case 'table':
          this.table(block.caption, block.header, block.rows);
          break;
        case 'figure':
          this.figure(block.caption, block.image);
          break;
        case 'subsection':
          sub += 1;
          this.heading(3, `${sectionNumber}.${sub}. ${block.title}`);
          this.blocks(block.blocks, `${sectionNumber}.${sub}`);
          break;
      }
    }
  }

  private table(
    caption: string,
    header: readonly string[],
    rows: readonly (readonly string[])[]
  ): void {
    this.tableInChapter += 1;
    const key = this.key('t');
    // Caption ABOVE the table (§1.3.1), numbered by a SEQ field as Word's Insert Caption does.
    this.slots.push({
      xml: paragraph(this.captionRuns('Tableau', this.tableInChapter, caption), {
        style: 'Caption',
        keepNext: true,
      }),
      key,
    });
    this.entries.tables.push({
      key,
      level: 1,
      text: `Tableau ${this.chapterNumber}.${this.tableInChapter} ${caption}`,
    });
    const width = Math.floor(8500 / header.length);
    const cell = (value: string, bold: boolean) =>
      `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr>${paragraph([run(value, { bold, sizePt: 11 })], { align: 'left', spaceAfterPt: 2, singleSpacing: true })}</w:tc>`;
    const borders = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`)
      .join('');
    this.raw(
      `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:tblBorders>${borders}</w:tblBorders></w:tblPr>` +
        `<w:tblGrid>${header.map(() => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>` +
        `<w:tr><w:trPr><w:tblHeader/></w:trPr>${header.map((h) => cell(h, true)).join('')}</w:tr>` +
        rows
          .map((row) => `<w:tr>${row.map((value) => cell(value, false)).join('')}</w:tr>`)
          .join('') +
        '</w:tbl>'
    );
  }

  private figure(caption: string, image: ImageContent): void {
    this.figureInChapter += 1;
    const registered = this.register(image);
    const width = Math.round(image.widthCm * EMU_PER_CM);
    const height = Math.round(width / image.aspect);
    this.raw(
      paragraph(
        [
          inlinePicture(
            registered.relationshipId,
            width,
            height,
            `Figure ${this.images.length}`,
            this.images.length + 1
          ),
        ],
        {
          align: 'center',
          keepNext: true,
          spaceAfterPt: 4,
        }
      )
    );
    // Caption BELOW the figure (§1.3.1).
    const key = this.key('f');
    this.slots.push({
      xml: paragraph(this.captionRuns('Figure', this.figureInChapter, caption), {
        style: 'Caption',
      }),
      key,
    });
    this.entries.figures.push({
      key,
      level: 1,
      text: `Figure ${this.chapterNumber}.${this.figureInChapter} ${caption}`,
    });
  }

  /** `<label> <chapter>.` + SEQ field + ` <caption>`: what the editor's Insert Caption writes. */
  private captionRuns(label: string, number: number, caption: string): string[] {
    return [
      run(`${label} ${this.chapterNumber}.`),
      sequenceField(label, number),
      run(` ${caption}`),
    ];
  }

  register(image: ImageContent): RegisteredImage {
    const n = this.images.length + 1;
    const registered = {
      relationshipId: `rIdImage${n}`,
      partName: `media/image${n}.${image.format === 'png' ? 'png' : 'jpeg'}`,
      image,
    };
    this.images.push(registered);
    return registered;
  }

  // ─── Parts of the thesis ───────────────────────────────────────────────

  introduction(sections: readonly SectionContent[]): void {
    this.startChapter(0);
    this.heading(1, 'Introduction générale');
    sections.forEach((section, i) => {
      this.heading(2, `0.${i + 1}. ${section.title}`);
      this.blocks(section.blocks, `0.${i + 1}`);
    });
  }

  chapter(n: number, chapter: ChapterContent): void {
    this.startChapter(n);
    this.heading(1, `Chapitre ${n} : ${chapter.title}`);
    this.heading(2, `${n}.1. Introduction partielle`);
    this.blocks(chapter.introduction, `${n}.1`);
    chapter.sections.forEach((section, i) => {
      this.heading(2, `${n}.${i + 2}. ${section.title}`);
      this.blocks(section.blocks, `${n}.${i + 2}`);
    });
    this.heading(2, `${n}.${chapter.sections.length + 2}. Conclusion partielle`);
    this.blocks(chapter.conclusion, `${n}.${chapter.sections.length + 2}`);
  }

  private startChapter(n: number): void {
    this.chapterNumber = n;
    this.figureInChapter = 0;
    this.tableInChapter = 0;
  }

  content(content: TfcContent): void {
    this.introduction(content.introduction);
    content.chapters.forEach((chapter, i) => this.chapter(i + 1, chapter));
    this.heading(1, 'Conclusion générale');
    this.blocks(content.conclusion, '');
    this.heading(1, 'Références');
    content.references.forEach((entry, i) =>
      this.raw(paragraph(`[${i + 1}] ${entry}`, { hangingCm: 0.9 }))
    );
    this.heading(1, 'Annexes');
    this.blocks(content.annexes, '');
  }

  // ─── Output ─────────────────────────────────────────────────────────────

  private tocRows(kind: TocKind): string[] {
    const entries = this.entries[kind];
    const begin = `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> ${TOC_INSTRUCTIONS[kind]} </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>`;
    const end = '<w:r><w:fldChar w:fldCharType="end"/></w:r>';
    const style = (level: number) => (kind === 'contents' ? `TOC${level}` : 'TableofFigures');
    // The field's begin and end sit in paragraphs of their own around the rows — the shape the
    // editor's Update Table recognizes and rebuilds in place.
    const chrome = { singleSpacing: true, spaceAfterPt: 0 };
    if (entries.length === 0) {
      const empty = paragraph([run(EMPTY_TOC[kind], { italic: true })]);
      return [paragraph([begin], chrome), empty, paragraph([end], chrome)];
    }
    const rows = entries.map((entry) => {
      const label = this.pageLabels.get(entry.key);
      const runs = [run(entry.text), ...(label ? ['<w:r><w:tab/></w:r>', run(label)] : [])];
      return paragraph(runs, { style: style(entry.level) });
    });
    return [paragraph([begin], chrome), ...rows, paragraph([end], chrome)];
  }

  /** The body XML and, for pagination, where each anchored paragraph landed. */
  build(): { readonly xml: string; readonly anchors: readonly Anchor[] } {
    const parts: string[] = [];
    const anchors: Anchor[] = [];
    for (const slot of this.slots) {
      if ('toc' in slot) {
        parts.push(...this.tocRows(slot.toc));
        continue;
      }
      if (slot.key) anchors.push({ key: slot.key, bodyIndex: parts.length });
      parts.push(slot.xml);
    }
    return { xml: parts.join(''), anchors };
  }
}
