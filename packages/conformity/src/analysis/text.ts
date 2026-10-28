// Text normalization shared by structure detection and rules.

/** Lower case, accents removed, typographic quotes/dashes folded, whitespace collapsed. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[‐-―_-]/g, ' ')
    .replace(/[«»"“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The leading section number of a title — "1.2.3", "0.4", "2", "IV" — and the title without
 * it. "Chapitre 2 : Analyse" yields chapter number 2 through {@link chapterPrefix} instead.
 */
export function splitNumbering(title: string): {
  readonly number: string | null;
  readonly rest: string;
} {
  const match = /^\s*((?:\d+\.)*\d+|[ivxlc]+)(?:[.)]|\s*[-–:]|\s)\s*(.*)$/i.exec(title);
  if (!match) return { number: null, rest: title.trim() };
  const candidate = match[1]!;
  // A lone roman-looking word ("Ce", "Dix") is text, not numbering: require a separator.
  if (/^[ivxlc]+$/i.test(candidate) && !/^[ivxlc]+[.)\-–:]/i.test(title.trim())) {
    return { number: null, rest: title.trim() };
  }
  return { number: candidate, rest: match[2]!.trim() };
}

const ROMAN: Readonly<Record<string, number>> = { i: 1, v: 5, x: 10, l: 50, c: 100 };

export function romanToNumber(roman: string): number | null {
  let total = 0;
  const chars = roman.toLowerCase().split('');
  for (let i = 0; i < chars.length; i++) {
    const value = ROMAN[chars[i]!];
    if (value === undefined) return null;
    const next = ROMAN[chars[i + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total > 0 ? total : null;
}

/** "Chapitre 2 : Titre", "CHAPITRE I. Titre", "Chapitre premier" → { number, rest }. */
export function chapterPrefix(
  normalized: string
): { readonly number: number | null; readonly rest: string } | null {
  const match = /^chapitre\s+(premier|\d+|[ivxlc]+)\b\s*[.:\-–]?\s*(.*)$/.exec(normalized);
  if (!match)
    return /^chapitre\b/.test(normalized)
      ? { number: null, rest: normalized.slice(8).trim() }
      : null;
  const token = match[1]!;
  const number =
    token === 'premier' ? 1 : /^\d+$/.test(token) ? Number(token) : romanToNumber(token);
  return { number, rest: match[2]!.trim() };
}

/** Whether a normalized title is one of the aliases (or starts with one, as a whole word). */
export function matchesAlias(normalizedTitle: string, aliases: readonly string[]): boolean {
  return aliases.some((alias) => {
    const a = normalize(alias);
    return (
      normalizedTitle === a ||
      normalizedTitle.startsWith(`${a} `) ||
      normalizedTitle.startsWith(`${a}:`)
    );
  });
}

/** A short excerpt for messages and for finding the paragraph again in the editor. */
export function excerpt(text: string, max = 80): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** Words as a reader counts them: letters/digits runs, keeping elisions and hyphens. */
export function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches ? matches.length : 0;
}
