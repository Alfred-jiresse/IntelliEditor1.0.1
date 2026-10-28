// Page and caption numbering commands for `createDocxEditor` (editor seam).
//
// `setPageNumbering`, `insertCaption` and `updateCaptionNumbers`: shape checks for `can`,
// the document-dependent gate, and the exec — beside the image and header/footer lanes so
// the shared dispatch files only route to them.

import type { EditorCommand, ExecResult, PageNumbering } from '../contracts/editor.ts';
import type { PageNumberFormat } from '../contracts/editor-numbering.ts';
import { isCaptionLabel, isCaptionText } from '@docx-editor.dev/core/store';
import type { PaginatedSurface } from './paginated-surface-contract.ts';

type NumberingCommand = Extract<
  EditorCommand,
  { type: 'setPageNumbering' | 'insertCaption' | 'updateCaptionNumbers' }
>;

const PAGE_NUMBER_FORMATS: ReadonlySet<string> = new Set<PageNumberFormat>([
  'decimal',
  'lowerRoman',
  'upperRoman',
  'lowerLetter',
  'upperLetter',
]);
const MAX_PAGE_NUMBER_START = 9999;

export function isNumberingCommand(command: EditorCommand): command is NumberingCommand {
  return (
    command.type === 'setPageNumbering' ||
    command.type === 'insertCaption' ||
    command.type === 'updateCaptionNumbers'
  );
}

/** Shape checks, answered without a document — the same bounds the op layer enforces. */
export function classifyNumberingCommand(
  command: NumberingCommand
): { supported: true; mutating: true } | { supported: false; code: 'invalidArgs'; reason: string } {
  const refuse = (reason: string) => ({
    supported: false as const,
    code: 'invalidArgs' as const,
    reason,
  });
  switch (command.type) {
    case 'setPageNumbering': {
      if (command.format === undefined && command.start === undefined) {
        return refuse('setPageNumbering requires a format or a start');
      }
      if (command.format !== undefined && !PAGE_NUMBER_FORMATS.has(command.format)) {
        return refuse(
          "format must be 'decimal', 'lowerRoman', 'upperRoman', 'lowerLetter' or 'upperLetter'"
        );
      }
      const start = command.start;
      if (
        start !== undefined &&
        start !== null &&
        (!Number.isInteger(start) || start < 0 || start > MAX_PAGE_NUMBER_START)
      ) {
        return refuse(`start must be a whole number from 0 to ${MAX_PAGE_NUMBER_START}, or null`);
      }
      if (
        command.scope !== undefined &&
        command.scope !== 'document' &&
        command.scope !== 'section'
      ) {
        return refuse("scope must be 'document' or 'section'");
      }
      return { supported: true, mutating: true };
    }
    case 'insertCaption':
      if (!isCaptionLabel(command.label)) {
        return refuse('a caption label is 1–32 letters, like Figure or Tableau');
      }
      if (command.text !== undefined && !isCaptionText(command.text)) {
        return refuse('caption text must be at most 200 characters of valid text');
      }
      if (
        command.position !== undefined &&
        command.position !== 'above' &&
        command.position !== 'below'
      ) {
        return refuse("position must be 'above' or 'below'");
      }
      return { supported: true, mutating: true };
    case 'updateCaptionNumbers':
      if (command.label !== undefined && !isCaptionLabel(command.label)) {
        return refuse('a caption label is 1–32 letters, like Figure or Tableau');
      }
      return { supported: true, mutating: true };
  }
}

/** The refusal the document gives, or null when the command can run here. */
export function gateNumberingCommand(
  command: NumberingCommand,
  surface: PaginatedSurface
): ExecResult | null {
  if (command.type !== 'insertCaption') return null;
  return surface.canInsertCaption(command.label, command.position ?? 'below')
    ? null
    : {
        ok: false,
        code: 'unsupported',
        reason: 'a caption can only be inserted beside a block of the editable document body',
      };
}

export function execNumberingCommand(
  mounted: PaginatedSurface,
  command: NumberingCommand
): ExecResult | null {
  const refused = (fallback: string): ExecResult => ({
    ok: false,
    code: 'unsupported',
    reason: mounted.state().lastRejection ?? fallback,
  });
  switch (command.type) {
    case 'setPageNumbering': {
      const anchor =
        command.scope === 'document' ? undefined : mounted.state().selection.head.paragraphId;
      const committed = mounted.setSectionProperties({
        ...(command.format !== undefined ? { pageNumberFormat: command.format } : {}),
        ...(command.start !== undefined ? { pageNumberStart: command.start } : {}),
        ...(anchor !== undefined ? { anchorParagraphId: anchor } : {}),
      });
      return committed ? null : refused('the page numbering change was refused');
    }
    case 'insertCaption':
      return mounted.insertCaption(command.label, command.text ?? '', command.position ?? 'below')
        ? null
        : refused('the caption could not be inserted');
    case 'updateCaptionNumbers':
      return mounted.updateCaptionNumbers(command.label)
        ? null
        : refused('the captions could not be renumbered');
  }
}

/** The page numbering of the section holding the caret. */
export function pageNumberingOf(surface: PaginatedSurface | null): PageNumbering | null {
  if (!surface) return null;
  const section = surface.sectionPropertiesAt(surface.state().selection.head.paragraphId);
  const fmt = section.pageNumbering?.fmt;
  return {
    format:
      fmt !== undefined && PAGE_NUMBER_FORMATS.has(fmt) ? (fmt as PageNumberFormat) : 'decimal',
    start: section.pageNumbering?.start ?? null,
  };
}
