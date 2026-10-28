// Which paragraphs a rule should judge. Shared so every rule agrees on "body text".

import type { DocumentStructure } from '../analysis/structure.ts';
import type { DocumentModel, ParagraphModel } from '../model/types.ts';

/** Ordinary running text after the cover: what the body typography rules apply to. */
export function bodyParagraphs(doc: DocumentModel, structure: DocumentStructure): ParagraphModel[] {
  const afterCover = structure.cover.length;
  return doc.paragraphs.filter((p) => p.index >= afterCover && p.role === 'body');
}

/** The chapter (1-based ordinal) a paragraph falls in, 0 inside the introduction, else null. */
export function chapterOf(structure: DocumentStructure, index: number): number | null {
  const intro = structure.part('introduction');
  if (intro && index >= intro.title.index && index <= intro.contentEnd) return 0;
  const chapter = structure.chapters.find((c) => index >= c.title.index && index <= c.contentEnd);
  return chapter ? (chapter.announcedNumber ?? chapter.ordinal) : null;
}

export const TWIPS_PER_MM = 1440 / 25.4;

export function twipsToCm(twips: number): string {
  return (twips / TWIPS_PER_MM / 10)
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace('.', ',');
}
