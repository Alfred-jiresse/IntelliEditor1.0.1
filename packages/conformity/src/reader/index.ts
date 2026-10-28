import type { DocumentModel } from '../model/types.ts';
import { readDocxPackage } from '../xml/docx-package.ts';
import { DocumentReader } from './document-reader.ts';

export type DocumentModelResult =
  | { readonly ok: true; readonly document: DocumentModel }
  | { readonly ok: false; readonly reason: string };

/** DOCX bytes → the rules' read model. Never throws on a malformed file. */
export function readDocumentModel(bytes: Uint8Array): DocumentModelResult {
  const opened = readDocxPackage(bytes);
  if (!opened.ok) return opened;
  return { ok: true, document: new DocumentReader(opened.package).read() };
}
