// Recovering the thesis skeleton from the paragraphs.
//
// Students rarely use heading styles for the preliminary pages ("DÉDICACE" is often just a
// bold, centered line), so a title is recognized two ways: a real heading, or a short,
// visually emphasized standalone line. Titles are then matched against the profile's part
// aliases; chapters are the top-level titles between the introduction and the conclusion.

import type { DocumentModel, ParagraphModel } from '../model/types.ts';
import type { ConformityProfile, PartSpec } from '../profile/types.ts';
import { chapterPrefix, matchesAlias, normalize, splitNumbering } from './text.ts';

export interface PartOccurrence {
  readonly spec: PartSpec;
  readonly title: ParagraphModel;
  /** Paragraph indexes of the part's content (after its title), inclusive; empty when end < start. */
  readonly contentStart: number;
  readonly contentEnd: number;
}

export interface ChapterOccurrence {
  /** 1-based position among chapters. */
  readonly ordinal: number;
  /** The number the title itself announces ("Chapitre 2"), when it announces one. */
  readonly announcedNumber: number | null;
  readonly title: ParagraphModel;
  readonly contentStart: number;
  readonly contentEnd: number;
  readonly hasPartialIntroduction: boolean;
  readonly hasPartialConclusion: boolean;
}

export interface DocumentStructure {
  /** Every recognized title, in order (parts, chapters, sub-titles). */
  readonly titles: readonly ParagraphModel[];
  readonly parts: readonly PartOccurrence[];
  readonly chapters: readonly ChapterOccurrence[];
  /** Paragraphs before the first recognized part: the cover page(s). */
  readonly cover: readonly ParagraphModel[];
  /** Intro sub-sections found, by profile section id. */
  readonly introductionSections: ReadonlyMap<string, ParagraphModel>;
  part(id: string): PartOccurrence | undefined;
}

const MAX_TITLE_LENGTH = 110;
const MAX_TITLE_WORDS = 14;
const PARTIAL = /^(introduction|conclusion) partielle\b/;

/** A line that reads as a title even without a heading style. */
function isTitleCandidate(p: ParagraphModel): boolean {
  if (p.role === 'heading') return true;
  if (p.role !== 'body') return false;
  if (p.text.length > MAX_TITLE_LENGTH || p.text.split(' ').length > MAX_TITLE_WORDS) return false;
  if (/[.;,]$/.test(p.text) && !/\.\.\.$/.test(p.text)) return false;
  return p.formatting.bold || p.formatting.caps || p.alignment === 'center';
}

/** The title with its numbering and any "Chapitre N :" prefix removed, normalized. */
function bareTitle(text: string): string {
  const normalized = normalize(text);
  const chapter = chapterPrefix(normalized);
  if (chapter) return chapter.rest;
  return normalize(splitNumbering(text).rest);
}

/** Whether a title, numbering and « Chapitre N : » aside, is one of `aliases`. */
export function titleMatches(text: string, aliases: readonly string[]): boolean {
  return matchesAlias(bareTitle(text), aliases);
}

function matchPart(text: string, specs: readonly PartSpec[]): PartSpec | undefined {
  const bare = bareTitle(text);
  if (PARTIAL.test(bare)) return undefined;
  // Longest alias first: "introduction generale" must win over "introduction".
  const ranked = specs
    .flatMap((spec) => spec.aliases.map((alias) => ({ spec, alias: normalize(alias) })))
    .sort((a, b) => b.alias.length - a.alias.length);
  return ranked.find(({ alias }) => matchesAlias(bare, [alias]))?.spec;
}

export function analyzeStructure(
  doc: DocumentModel,
  profile: ConformityProfile
): DocumentStructure {
  const titles = doc.paragraphs.filter(isTitleCandidate);
  const found = new Map<string, ParagraphModel>();
  const boundaries: { kind: 'part' | 'chapter'; paragraph: ParagraphModel; spec?: PartSpec }[] = [];

  for (const title of titles) {
    const spec = matchPart(title.text, profile.structure.parts);
    if (spec && !found.has(spec.id)) {
      found.set(spec.id, title);
      boundaries.push({ kind: 'part', paragraph: title, spec });
    }
  }

  // Chapters: top-level titles between the introduction and the conclusion that are not parts.
  const intro = found.get('introduction');
  const conclusion = found.get('conclusion') ?? found.get('references');
  const lower = intro?.index ?? -1;
  const upper = conclusion?.index ?? Number.POSITIVE_INFINITY;
  const chapterTitles = titles.filter((t) => {
    if (t.index <= lower || t.index >= upper || boundaries.some((b) => b.paragraph === t))
      return false;
    const normalized = normalize(t.text);
    if (PARTIAL.test(bareTitle(t.text))) return false;
    if (chapterPrefix(normalized) !== null) return true;
    // Without an introduction there is no "between": only explicit « Chapitre N » titles count.
    if (!intro) return false;
    // A level-1 heading numbered "1.2" is a section someone styled too high, not a chapter.
    return t.headingLevel === 1 && !(splitNumbering(t.text).number ?? '').includes('.');
  });
  for (const paragraph of chapterTitles) boundaries.push({ kind: 'chapter', paragraph });
  boundaries.sort((a, b) => a.paragraph.index - b.paragraph.index);

  const endOf = (i: number): number =>
    i + 1 < boundaries.length ? boundaries[i + 1]!.paragraph.index - 1 : doc.paragraphs.length - 1;

  const parts: PartOccurrence[] = [];
  const chapters: ChapterOccurrence[] = [];
  boundaries.forEach((boundary, i) => {
    const contentStart = boundary.paragraph.index + 1;
    const contentEnd = endOf(i);
    if (boundary.kind === 'part' && boundary.spec) {
      parts.push({ spec: boundary.spec, title: boundary.paragraph, contentStart, contentEnd });
      return;
    }
    const inside = titles
      .filter((t) => t.index >= contentStart && t.index <= contentEnd)
      .map((t) => bareTitle(t.text));
    chapters.push({
      ordinal: chapters.length + 1,
      announcedNumber: chapterPrefix(normalize(boundary.paragraph.text))?.number ?? null,
      title: boundary.paragraph,
      contentStart,
      contentEnd,
      hasPartialIntroduction: inside.some(
        (t) => t.startsWith('introduction partielle') || t === 'introduction'
      ),
      hasPartialConclusion: inside.some(
        (t) => t.startsWith('conclusion partielle') || t === 'conclusion'
      ),
    });
  });

  const introPart = parts.find((p) => p.spec.id === 'introduction');
  const introductionSections = new Map<string, ParagraphModel>();
  if (introPart) {
    for (const t of titles) {
      if (t.index < introPart.contentStart || t.index > introPart.contentEnd) continue;
      const spec = matchPart(t.text, profile.structure.introductionSections);
      if (spec && !introductionSections.has(spec.id)) introductionSections.set(spec.id, t);
    }
  }

  // No recognized part at all: nothing can be told apart as a cover, so nothing is.
  const firstBoundary = boundaries[0]?.paragraph.index ?? 0;
  return {
    titles,
    parts,
    chapters,
    cover: doc.paragraphs.slice(0, firstBoundary),
    introductionSections,
    part: (id) => parts.find((p) => p.spec.id === id),
  };
}
