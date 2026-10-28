// The academic writing tools: numbered captions, lists of figures and tables, and the page
// numbering of each section (roman for the preliminary pages, arabic from 1 for the body).
//
// Thin chrome over engine commands — `insertCaption`, `updateCaptionNumbers`, `insertToc`
// with a caption label, `setPageNumbering` — so every action is one undoable step and the
// document keeps Word's own markup.

import { useState, type FormEvent, type ReactNode } from 'react';
import { DocxEditor, useDocxEditor } from '@docx-editor.dev/react';
import type { EditorCommand, PageNumberFormat } from '@docx-editor.dev/core/contracts/editor';
import { ACADEMIC_TEXT as T, CAPTION_KINDS, PAGE_NUMBER_FORMATS } from './labels';

export type AcademicDialog = 'caption' | 'numbering' | null;

/** Run a command; a refusal is shown with the engine's own reason, never swallowed. */
function run(editor: ReturnType<typeof useDocxEditor>, command: EditorCommand): boolean {
  if (!editor) return false;
  const result = editor.exec(command);
  if (!result.ok) window.alert(T.refused(result.reason));
  else editor.focus();
  return result.ok;
}

/** The Insert-menu rows. Placed inside `DocxEditor.Menu.Insert`. */
export function AcademicInsertRows({
  onOpen,
}: {
  readonly onOpen: (dialog: AcademicDialog) => void;
}) {
  const editor = useDocxEditor();
  return (
    <>
      <DocxEditor.Menu.Separator />
      <DocxEditor.Menu.Row disabled={!editor} onSelect={() => onOpen('caption')}>
        {T.caption}
      </DocxEditor.Menu.Row>
      <DocxEditor.Menu.Row
        disabled={!editor}
        onSelect={() => run(editor, { type: 'insertToc', captionLabel: 'Figure' })}
      >
        {T.listOfFigures}
      </DocxEditor.Menu.Row>
      <DocxEditor.Menu.Row
        disabled={!editor}
        onSelect={() => run(editor, { type: 'insertToc', captionLabel: 'Tableau' })}
      >
        {T.listOfTables}
      </DocxEditor.Menu.Row>
      <DocxEditor.Menu.Row
        disabled={!editor}
        onSelect={() => run(editor, { type: 'updateCaptionNumbers' })}
      >
        {T.renumber}
      </DocxEditor.Menu.Row>
    </>
  );
}

function Dialog({
  title,
  intro,
  submit,
  onClose,
  onSubmit,
  children,
}: {
  readonly title: string;
  readonly intro: string;
  readonly submit: string;
  readonly onClose: () => void;
  readonly onSubmit: () => void;
  readonly children: ReactNode;
}) {
  return (
    <div
      className="intelli-dialog__backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="intelli-dialog intelli-dialog--compact"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <h2 className="intelli-dialog__title">{title}</h2>
        <p className="intelli-dialog__intro">{intro}</p>
        <div className="intelli-dialog__grid">{children}</div>
        <div className="intelli-dialog__actions">
          <button type="button" className="intelli-button" onClick={onClose}>
            {T.cancel}
          </button>
          <button type="submit" className="intelli-button intelli-button--primary">
            {submit}
          </button>
        </div>
      </form>
    </div>
  );
}

function CaptionDialog({ onClose }: { readonly onClose: () => void }) {
  const editor = useDocxEditor();
  const [kind, setKind] = useState<(typeof CAPTION_KINDS)[number]>(CAPTION_KINDS[0]);
  const [text, setText] = useState('');
  const [position, setPosition] = useState<'above' | 'below'>(CAPTION_KINDS[0].position);
  return (
    <Dialog
      title={T.captionTitle}
      intro={T.captionIntro}
      submit={T.insert}
      onClose={onClose}
      onSubmit={() => {
        const done = run(editor, {
          type: 'insertCaption',
          label: kind.label,
          text: text.trim(),
          position,
        });
        if (done) onClose();
      }}
    >
      <label className="intelli-field">
        <span className="intelli-field__label">{T.captionKind}</span>
        <select
          className="intelli-field__input"
          value={kind.label}
          onChange={(event) => {
            const next = CAPTION_KINDS.find((entry) => entry.label === event.target.value)!;
            setKind(next);
            // The norm's placement follows the kind; the user can still override it.
            setPosition(next.position);
          }}
        >
          {CAPTION_KINDS.map((entry) => (
            <option key={entry.label} value={entry.label}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label className="intelli-field">
        <span className="intelli-field__label">{T.captionPosition}</span>
        <select
          className="intelli-field__input"
          value={position}
          onChange={(event) => setPosition(event.target.value as 'above' | 'below')}
        >
          <option value="above">{T.above}</option>
          <option value="below">{T.below}</option>
        </select>
      </label>
      <label className="intelli-field intelli-field--wide">
        <span className="intelli-field__label">{T.captionText}</span>
        <input
          className="intelli-field__input"
          value={text}
          maxLength={200}
          autoFocus
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <p className="intelli-dialog__hint intelli-field--wide">{T.normHint}</p>
    </Dialog>
  );
}

function PageNumberingDialog({ onClose }: { readonly onClose: () => void }) {
  const editor = useDocxEditor();
  const current = editor?.query({ type: 'pageNumbering' }) ?? null;
  const [format, setFormat] = useState<PageNumberFormat>(current?.format ?? 'decimal');
  const [restart, setRestart] = useState(current?.start !== null && current?.start !== undefined);
  const [start, setStart] = useState(String(current?.start ?? 1));
  const [wholeDocument, setWholeDocument] = useState(false);
  const startNumber = Number(start);
  const startValid = Number.isInteger(startNumber) && startNumber >= 0 && startNumber <= 9999;
  return (
    <Dialog
      title={T.numberingTitle}
      intro={T.numberingIntro}
      submit={T.apply}
      onClose={onClose}
      onSubmit={() => {
        if (restart && !startValid) return;
        const done = run(editor, {
          type: 'setPageNumbering',
          format,
          start: restart ? startNumber : null,
          scope: wholeDocument ? 'document' : 'section',
        });
        if (done) onClose();
      }}
    >
      <label className="intelli-field intelli-field--wide">
        <span className="intelli-field__label">{T.format}</span>
        <select
          className="intelli-field__input"
          value={format}
          onChange={(event) => setFormat(event.target.value as PageNumberFormat)}
        >
          {PAGE_NUMBER_FORMATS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      <label className="intelli-choice intelli-field--wide">
        <input type="radio" checked={!restart} onChange={() => setRestart(false)} />
        {T.continuePrevious}
      </label>
      <label className="intelli-choice intelli-field--wide">
        <input type="radio" checked={restart} onChange={() => setRestart(true)} />
        {T.restartAt}
        <input
          className="intelli-field__input intelli-choice__number"
          type="number"
          min={0}
          max={9999}
          value={start}
          disabled={!restart}
          aria-invalid={restart && !startValid}
          onChange={(event) => setStart(event.target.value)}
        />
      </label>
      <label className="intelli-choice intelli-field--wide">
        <input
          type="checkbox"
          checked={wholeDocument}
          onChange={(event) => setWholeDocument(event.target.checked)}
        />
        {T.wholeDocument}
      </label>
    </Dialog>
  );
}

/** The open dialog, if any. Rendered once, outside the menu. */
export function AcademicDialogs({
  open,
  onClose,
}: {
  readonly open: AcademicDialog;
  readonly onClose: () => void;
}) {
  if (open === 'caption') return <CaptionDialog onClose={onClose} />;
  if (open === 'numbering') return <PageNumberingDialog onClose={onClose} />;
  return null;
}
