// Page numbering per section, numbered captions and lists of figures through the facade.
//
// What these tests pin down: the commands write Word's own markup (`w:pgNumType`, `SEQ`
// fields, `TOC \c`), renumbering happens in the same undo step as the insert that caused it,
// and a list of figures is filled from captions — never from headings.

import { GlobalRegistrator } from '@happy-dom/global-registrator';
if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

import { describe, expect, test } from 'bun:test';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { detectBodyTocs, displayedParagraphText, findNode } from '../../store/package/index.ts';
import { createDocxEditor, type DocxEditorInstance } from '../docx-editor.ts';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OD = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const STYLES =
  `<w:styles xmlns:w="${W}">` +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:basedOn w:val="Normal"/></w:style>' +
  '</w:styles>';

function docx(body: string): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8(
      `<Types xmlns="${CT}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'
    ),
    '_rels/.rels': strToU8(
      `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/officeDocument" Target="word/document.xml"/></Relationships>`
    ),
    'word/_rels/document.xml.rels': strToU8(
      `<Relationships xmlns="${REL}"><Relationship Id="rId1" Type="${OD}/styles" Target="styles.xml"/></Relationships>`
    ),
    'word/styles.xml': strToU8(STYLES),
    'word/document.xml': strToU8(
      `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`
    ),
  });
}

const p = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const h1 = (text: string) =>
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
/** A caption as Word writes it: `<label> <chapter>.` + SEQ field + text. */
const caption = (label: string, prefix: string, number: string, text: string) =>
  '<w:p><w:pPr><w:pStyle w:val="Caption"/></w:pPr>' +
  `<w:r><w:t xml:space="preserve">${label} ${prefix}</w:t></w:r>` +
  '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
  `<w:r><w:instrText xml:space="preserve"> SEQ ${label} \\* ARABIC \\s 1 </w:instrText></w:r>` +
  '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
  `<w:r><w:t>${number}</w:t></w:r>` +
  '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
  `<w:r><w:t xml:space="preserve"> ${text}</w:t></w:r></w:p>`;

function mount(body: string): DocxEditorInstance {
  const container = document.createElement('div');
  const editor = createDocxEditor({ container, document: docx(body) });
  if (!editor.surface) throw new Error('surface failed to mount');
  return editor;
}

/** Put the caret at the start of the n-th body paragraph. */
function caretAt(editor: DocxEditorInstance, index: number): void {
  const id = editor.surface!.session.paragraphIds()[index]!;
  editor.surface!.setSelection({
    anchor: { paragraphId: id, offset: 0 },
    head: { paragraphId: id, offset: 0 },
  });
}

/** What every body paragraph reads, field results included. */
function texts(editor: DocxEditorInstance): string[] {
  const part = editor.surface!.session.part();
  return editor
    .surface!.session.paragraphIds()
    .map((id) => displayedParagraphText(findNode(part, id)!));
}

async function documentXml(editor: DocxEditorInstance): Promise<string> {
  const bytes = new Uint8Array(await editor.save());
  return strFromU8(unzipSync(bytes)['word/document.xml']!);
}

const twoSections =
  '<w:p><w:pPr><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:pPr><w:r><w:t>liminaires</w:t></w:r></w:p>' +
  p('corps') +
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr>';

describe('setPageNumbering', () => {
  test('writes the caret section only, and layout numbers its pages that way', async () => {
    const editor = mount(twoSections);
    caretAt(editor, 0);
    expect(editor.query({ type: 'pageNumbering' })).toEqual({ format: 'decimal', start: null });
    const result = editor.exec({ type: 'setPageNumbering', format: 'lowerRoman', start: 1 });
    expect(result).toEqual({ ok: true, changed: true });
    expect(editor.query({ type: 'pageNumbering' })).toEqual({ format: 'lowerRoman', start: 1 });
    expect(editor.surface!.layout().pages[0]!.pageFieldSource?.format).toBe('lowerRoman');

    const xml = await documentXml(editor);
    const elements = xml.match(/<w:pgNumType [^>]*\/>/g) ?? [];
    expect(elements).toHaveLength(1);
    expect(elements[0]).toContain('w:fmt="lowerRoman"');
    expect(elements[0]).toContain('w:start="1"');
  });

  test('restart on the second section, then continue again removes the element', async () => {
    const editor = mount(twoSections);
    caretAt(editor, 1);
    editor.exec({ type: 'setPageNumbering', format: 'decimal', start: 1 });
    expect(editor.query({ type: 'pageNumbering' })).toEqual({ format: 'decimal', start: 1 });
    expect(await documentXml(editor)).toContain('<w:pgNumType w:start="1"/>');
    editor.exec({ type: 'setPageNumbering', start: null });
    expect(await documentXml(editor)).not.toContain('pgNumType');
  });

  test('keeps the chapter attributes Word wrote and undoes as one step', async () => {
    const editor = mount(
      p('a') +
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgNumType w:chapStyle="1" w:chapSep="period"/></w:sectPr>'
    );
    editor.exec({ type: 'setPageNumbering', format: 'upperRoman' });
    const xml = await documentXml(editor);
    const element = /<w:pgNumType [^>]*\/>/.exec(xml)![0];
    for (const attribute of ['w:fmt="upperRoman"', 'w:chapStyle="1"', 'w:chapSep="period"']) {
      expect(element).toContain(attribute);
    }
    editor.exec({ type: 'undo' });
    expect(editor.query({ type: 'pageNumbering' })).toEqual({ format: 'decimal', start: null });
  });

  test('refuses hostile values with typed reasons', () => {
    const editor = mount(p('a'));
    expect(editor.can({ type: 'setPageNumbering' })).toMatchObject({
      ok: false,
      code: 'invalidArgs',
    });
    expect(editor.can({ type: 'setPageNumbering', format: 'chicago' as never })).toMatchObject({
      ok: false,
      code: 'invalidArgs',
    });
    expect(editor.can({ type: 'setPageNumbering', start: -1 })).toMatchObject({
      ok: false,
      code: 'invalidArgs',
    });
    expect(editor.can({ type: 'setPageNumbering', start: 1.5 })).toMatchObject({ ok: false });
  });
});

describe('insertCaption', () => {
  test('numbers by chapter, renumbers the next ones, and undoes as one step', async () => {
    const editor = mount(h1('Chapitre 2 : Analyse') + p('schéma') + p('suite'));
    caretAt(editor, 1);
    expect(editor.exec({ type: 'insertCaption', label: 'Figure', text: 'Processus' })).toEqual({
      ok: true,
      changed: true,
    });
    expect(texts(editor)).toEqual([
      'Chapitre 2 : Analyse',
      'schéma',
      'Figure 2.1 Processus',
      'suite',
    ]);

    // A second figure ABOVE the first one takes 2.1 and pushes the first to 2.2, in one step.
    caretAt(editor, 1);
    editor.exec({ type: 'insertCaption', label: 'Figure', text: 'Contexte', position: 'above' });
    expect(texts(editor)).toEqual([
      'Chapitre 2 : Analyse',
      'Figure 2.1 Contexte',
      'schéma',
      'Figure 2.2 Processus',
      'suite',
    ]);
    editor.exec({ type: 'undo' });
    expect(texts(editor)).toEqual([
      'Chapitre 2 : Analyse',
      'schéma',
      'Figure 2.1 Processus',
      'suite',
    ]);

    const xml = await documentXml(editor);
    expect(xml).toContain('SEQ Figure \\* ARABIC \\s 1');
    expect(xml).toContain('<w:pStyle w:val="Caption"/>');
  });

  test('a table caption goes above the whole table, kept with it', () => {
    const table =
      '<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid>' +
      `<w:tr><w:tc>${p('cellule')}</w:tc></w:tr></w:tbl>`;
    const editor = mount(h1('Chapitre 1 : Contexte') + table + p('après'));
    caretAt(editor, 1);
    editor.exec({ type: 'insertCaption', label: 'Tableau', text: 'Effectifs', position: 'above' });
    expect(texts(editor)).toEqual([
      'Chapitre 1 : Contexte',
      'Tableau 1.1 Effectifs',
      'cellule',
      'après',
    ]);
    const body = editor.surface!.session.part().root.children[0]!;
    expect(body.kind !== 'textValue' && body.children[1]!.kind).toBe('paragraph');
  });

  test('outside any chapter the number has no chapter part, and labels count apart', () => {
    const editor = mount(p('a') + p('b'));
    caretAt(editor, 0);
    editor.exec({ type: 'insertCaption', label: 'Figure', text: 'Un' });
    caretAt(editor, 2);
    editor.exec({ type: 'insertCaption', label: 'Tableau', text: 'Deux' });
    expect(texts(editor)).toEqual(['a', 'Figure 1 Un', 'b', 'Tableau 1 Deux']);
  });

  test('refuses a label that is not a field identifier', () => {
    const editor = mount(p('a'));
    for (const label of ['', 'Fig ure', 'Figure\\', 'a'.repeat(33), '"x"']) {
      expect(editor.can({ type: 'insertCaption', label })).toMatchObject({
        ok: false,
        code: 'invalidArgs',
      });
    }
  });
});

describe('updateCaptionNumbers', () => {
  test('repairs numbers and the chapter of a caption that moved', () => {
    const editor = mount(
      h1('Chapitre 1 : A') +
        caption('Figure', '1.', '7', 'Premier') +
        h1('Chapitre 2 : B') +
        caption('Figure', '1.', '2', 'Déplacé') +
        caption('Figure', '2.', '9', 'Suivant')
    );
    expect(editor.exec({ type: 'updateCaptionNumbers' })).toEqual({ ok: true, changed: true });
    expect(texts(editor)).toEqual([
      'Chapitre 1 : A',
      'Figure 1.1 Premier',
      'Chapitre 2 : B',
      'Figure 2.1 Déplacé',
      'Figure 2.2 Suivant',
    ]);
    // Already right: nothing to write.
    expect(editor.exec({ type: 'updateCaptionNumbers' })).toEqual({ ok: true, changed: false });
  });
});

describe('lists of figures and tables', () => {
  const body =
    p('liste') +
    h1('Chapitre 1 : A') +
    caption('Figure', '1.', '1', 'Processus') +
    caption('Tableau', '1.', '1', 'Effectifs') +
    caption('Figure', '1.', '2', 'Architecture');

  test('insertToc with a caption label lists that label only, styled as a table of figures', () => {
    const editor = mount(body);
    caretAt(editor, 0);
    expect(editor.exec({ type: 'insertToc', captionLabel: 'Figure' })).toMatchObject({ ok: true });
    const part = editor.surface!.session.part();
    const [toc] = detectBodyTocs(part);
    expect(toc!.instruction.captionLabel).toBe('Figure');
    const rows = toc!.resultParagraphIds.map((id) => displayedParagraphText(findNode(part, id)!));
    expect(rows).toEqual(['Figure 1.1 Processus 1', 'Figure 1.2 Architecture 1']);
  });

  test('refreshing a list of figures fills it from captions, never from headings', () => {
    const field =
      '<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\h \\z \\c "Tableau" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r></w:p>' +
      p('ancienne ligne') +
      '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    const editor = mount(field + body);
    const [toc] = detectBodyTocs(editor.surface!.session.part());
    expect(editor.exec({ type: 'refreshToc', tocId: toc!.id })).toMatchObject({ ok: true });
    const part = editor.surface!.session.part();
    const [after] = detectBodyTocs(part);
    const rows = after!.resultParagraphIds.map((id) => displayedParagraphText(findNode(part, id)!));
    expect(rows).toEqual(['Tableau 1.1 Effectifs 1']);
  });
});
