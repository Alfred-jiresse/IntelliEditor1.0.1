// Reading a profile from JSON — uploaded as is, or produced from a plain-text rules file by
// `rules-text.ts`, which lands here so both formats share one validation.
//
// The JSON is untrusted. It is never spread or merged blindly: every field is read by name,
// type-checked and range-checked, then laid over the base profile. Unknown keys are ignored
// (and reported), so a `__proto__` key can only ever be reported, never assigned.

import type { PageNumberFormat } from '../model/types.ts';
import type {
  ConformityProfile,
  CustomRuleKind,
  CustomRuleSpec,
  HeadingSpec,
  PartSpec,
  RuleOverride,
  Severity,
  TextCase,
  TextZone,
} from './types.ts';
import { UDBL_TFC_PROFILE } from './udbl-tfc.ts';

export type ProfileParseResult =
  | { readonly ok: true; readonly profile: ConformityProfile; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

type Json = Record<string, unknown>;

const MAX_TEXT = 300;
const MAX_LIST = 60;
const FORMATS: readonly PageNumberFormat[] = [
  'decimal',
  'lowerRoman',
  'upperRoman',
  'lowerLetter',
  'upperLetter',
];
const SEVERITIES: readonly Severity[] = ['error', 'warning', 'info'];
const CASES: readonly TextCase[] = ['upper', 'lower', 'any'];
const ALIGNMENTS = ['left', 'center', 'right'] as const;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(object: Json, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
}

class Reader {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  object(source: Json, key: string, path: string, known: readonly string[]): Json | undefined {
    const value = own(source, key);
    if (value === undefined) return undefined;
    if (!isObject(value)) {
      this.errors.push(`${path}${key} doit être un objet`);
      return undefined;
    }
    for (const name of Object.keys(value)) {
      if (!known.includes(name)) this.warnings.push(`clé inconnue ignorée : ${path}${key}.${name}`);
    }
    return value;
  }

  number(
    source: Json | undefined,
    key: string,
    path: string,
    min: number,
    max: number,
    fallback: number
  ): number {
    const value = source ? own(source, key) : undefined;
    if (value === undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      this.errors.push(`${path}${key} doit être un nombre entre ${min} et ${max}`);
      return fallback;
    }
    return value;
  }

  boolean(source: Json | undefined, key: string, path: string, fallback: boolean): boolean {
    const value = source ? own(source, key) : undefined;
    if (value === undefined) return fallback;
    if (typeof value !== 'boolean') {
      this.errors.push(`${path}${key} doit être vrai ou faux`);
      return fallback;
    }
    return value;
  }

  text(source: Json | undefined, key: string, path: string, fallback: string): string {
    const value = source ? own(source, key) : undefined;
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_TEXT) {
      this.errors.push(`${path}${key} doit être un texte de 1 à ${MAX_TEXT} caractères`);
      return fallback;
    }
    return value;
  }

  choice<T extends string>(
    source: Json | undefined,
    key: string,
    path: string,
    allowed: readonly T[],
    fallback: T
  ): T {
    const value = source ? own(source, key) : undefined;
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      this.errors.push(`${path}${key} doit valoir : ${allowed.join(', ')}`);
      return fallback;
    }
    return value as T;
  }

  texts(
    source: Json | undefined,
    key: string,
    path: string,
    fallback: readonly string[]
  ): readonly string[] {
    const value = source ? own(source, key) : undefined;
    if (value === undefined) return fallback;
    if (
      !Array.isArray(value) ||
      value.length > MAX_LIST ||
      !value.every((v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXT)
    ) {
      this.errors.push(`${path}${key} doit être une liste de textes (max ${MAX_LIST})`);
      return fallback;
    }
    return value as string[];
  }

  parts(
    source: Json | undefined,
    key: string,
    path: string,
    fallback: readonly PartSpec[]
  ): readonly PartSpec[] {
    const value = source ? own(source, key) : undefined;
    if (value === undefined) return fallback;
    if (!Array.isArray(value) || value.length > MAX_LIST) {
      this.errors.push(`${path}${key} doit être une liste de parties (max ${MAX_LIST})`);
      return fallback;
    }
    const out: PartSpec[] = [];
    value.forEach((item, i) => {
      const where = `${path}${key}[${i}].`;
      if (!isObject(item)) {
        this.errors.push(`${path}${key}[${i}] doit être un objet`);
        return;
      }
      const id = this.text(item, 'id', where, '');
      const label = this.text(item, 'label', where, id);
      const aliases = this.texts(item, 'aliases', where, [label]);
      if (id)
        out.push({ id, label, aliases, required: this.boolean(item, 'required', where, false) });
    });
    return out;
  }
}

function readHeadings(
  reader: Reader,
  root: Json,
  fallback: readonly HeadingSpec[]
): readonly HeadingSpec[] {
  const value = own(root, 'headings');
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.length === 0 || value.length > 9) {
    reader.errors.push('headings doit être une liste de 1 à 9 niveaux');
    return fallback;
  }
  return value.map((item, i) => {
    const base = fallback[i] ?? fallback[fallback.length - 1]!;
    const spec = isObject(item) ? item : undefined;
    if (!spec) reader.errors.push(`headings[${i}] doit être un objet`);
    const where = `headings[${i}].`;
    return {
      bold: reader.boolean(spec, 'bold', where, base.bold),
      italic: reader.boolean(spec, 'italic', where, base.italic),
      textCase: reader.choice(spec, 'textCase', where, CASES, base.textCase),
      sizePt: reader.number(spec, 'sizePt', where, 6, 72, base.sizePt),
    };
  });
}

function readRules(reader: Reader, root: Json): Readonly<Record<string, RuleOverride>> {
  const out: Record<string, RuleOverride> = Object.create(null) as Record<string, RuleOverride>;
  const value = own(root, 'rules');
  if (value === undefined) return out;
  if (!isObject(value)) {
    reader.errors.push('rules doit être un objet { "id.de.regle": { "enabled", "severity" } }');
    return out;
  }
  for (const [id, override] of Object.entries(value)) {
    if (!/^[a-z0-9][a-z0-9.-]{0,63}$/.test(id) || !isObject(override)) {
      reader.warnings.push(`règle ignorée : ${id.slice(0, 64)}`);
      continue;
    }
    const where = `rules.${id}.`;
    const enabled = own(override, 'enabled');
    out[id] = {
      ...(enabled !== undefined
        ? { enabled: reader.boolean(override, 'enabled', where, true) }
        : {}),
      ...(own(override, 'severity') !== undefined
        ? { severity: reader.choice(override, 'severity', where, SEVERITIES, 'warning') }
        : {}),
    };
  }
  return out;
}

const RULE_KINDS: readonly CustomRuleKind[] = [
  'forbidden-text',
  'required-text',
  'required-part',
  'part-length',
  'document-length',
];
const ZONES: readonly TextZone[] = ['body', 'cover', 'document'];
/** Most custom rules one profile may declare. */
export const MAX_CUSTOM_RULES = 50;
const MAX_RULE_TITLE = 120;

/** `Pas de « nous »` → `pas-de-nous`: the id a custom rule gets when the file names none. */
export function ruleSlug(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'regle'
  );
}

function readCustomRules(
  reader: Reader,
  root: Json,
  fallback: readonly CustomRuleSpec[]
): readonly CustomRuleSpec[] {
  const value = own(root, 'customRules');
  if (value === undefined) return fallback;
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_RULES) {
    reader.errors.push(`customRules doit être une liste de ${MAX_CUSTOM_RULES} règles au plus`);
    return fallback;
  }
  const ids = new Set<string>();
  const out: CustomRuleSpec[] = [];
  value.forEach((item, i) => {
    const where = `customRules[${i}].`;
    if (!isObject(item)) {
      reader.errors.push(`customRules[${i}] doit être un objet`);
      return;
    }
    const before = reader.errors.length;
    const kind = reader.choice(item, 'kind', where, RULE_KINDS, 'forbidden-text');
    if (own(item, 'kind') === undefined) reader.errors.push(`${where}kind est obligatoire`);
    const title = reader.text(item, 'title', where, '');
    if (!title || title.length > MAX_RULE_TITLE) {
      reader.errors.push(`${where}title doit être un texte de 1 à ${MAX_RULE_TITLE} caractères`);
    }
    const values = reader.texts(item, 'values', where, []);
    if (kind !== 'document-length' && values.length === 0) {
      reader.errors.push(`${where}values doit contenir au moins un texte`);
    }
    const bound = (key: string, max: number): number | undefined =>
      own(item, key) === undefined
        ? undefined
        : Math.round(reader.number(item, key, where, 0, max, 0));
    const minWords = bound('minWords', 100_000);
    const maxWords = bound('maxWords', 100_000);
    const minPages = bound('minPages', 1000);
    const maxPages = bound('maxPages', 1000);
    const isLength = kind === 'part-length' || kind === 'document-length';
    if (isLength && [minWords, maxWords, minPages, maxPages].every((b) => b === undefined)) {
      reader.errors.push(`${where} une règle de longueur a besoin d'un minimum ou d'un maximum`);
    }
    if (
      (minWords !== undefined && maxWords !== undefined && minWords > maxWords) ||
      (minPages !== undefined && maxPages !== undefined && minPages > maxPages)
    ) {
      reader.errors.push(`${where} le minimum dépasse le maximum`);
    }
    const askedId = own(item, 'id');
    let id: string;
    if (askedId !== undefined) {
      id = typeof askedId === 'string' && /^perso\.[a-z0-9-]{1,48}$/.test(askedId) ? askedId : '';
      if (!id) reader.errors.push(`${where}id doit s'écrire perso.mots-separes-par-des-tirets`);
    } else {
      id = `perso.${ruleSlug(title)}`;
      for (let n = 2; ids.has(id); n += 1) id = `perso.${ruleSlug(title)}-${n}`;
    }
    if (ids.has(id)) reader.errors.push(`${where}id « ${id} » est déjà utilisé`);
    if (reader.errors.length > before) return;
    ids.add(id);
    out.push({
      id,
      kind,
      title,
      severity: reader.choice(item, 'severity', where, SEVERITIES, 'warning'),
      reference: reader.text(item, 'reference', where, title),
      values,
      zone: reader.choice(
        item,
        'zone',
        where,
        ZONES,
        kind === 'required-text' ? 'document' : 'body'
      ),
      ...(minWords !== undefined ? { minWords } : {}),
      ...(maxWords !== undefined ? { maxWords } : {}),
      ...(minPages !== undefined ? { minPages } : {}),
      ...(maxPages !== undefined ? { maxPages } : {}),
    });
  });
  return out;
}

/** Lay a user JSON profile over `base` (the UDBL profile by default). */
export function parseProfile(
  input: unknown,
  base: ConformityProfile = UDBL_TFC_PROFILE
): ProfileParseResult {
  if (!isObject(input)) return { ok: false, errors: ['le fichier doit contenir un objet JSON'] };
  const r = new Reader();
  const known = [
    'id',
    'name',
    'institution',
    'source',
    'page',
    'typography',
    'headings',
    'cover',
    'structure',
    'captions',
    'references',
    'lengths',
    'rules',
    'customRules',
    '$schema',
  ];
  for (const key of Object.keys(input))
    if (!known.includes(key)) r.warnings.push(`clé inconnue ignorée : ${key}`);

  const page = r.object(input, 'page', '', [
    'widthMm',
    'heightMm',
    'marginsCm',
    'marginToleranceMm',
    'numberAlignment',
    'liminaryNumberFormat',
    'bodyNumberFormat',
  ]);
  const margins = page
    ? r.object(page, 'marginsCm', 'page.', ['top', 'right', 'bottom', 'left'])
    : undefined;
  const typo = r.object(input, 'typography', '', [
    'bodyFonts',
    'bodySizePt',
    'lineSpacing',
    'lineSpacingTolerance',
    'deviationTolerance',
  ]);
  const cover = r.object(input, 'cover', '', ['requiredMentions']);
  const structure = r.object(input, 'structure', '', [
    'parts',
    'introductionSections',
    'minChapters',
    'maxChapters',
    'requirePartialIntroAndConclusion',
  ]);
  const captions = r.object(input, 'captions', '', [
    'tableCaptionPosition',
    'figureCaptionPosition',
    'chapterNumbering',
  ]);
  const refs = r.object(input, 'references', '', [
    'sectionAliases',
    'preferredTitle',
    'minimumCount',
    'style',
  ]);
  const lengths = r.object(input, 'lengths', '', [
    'wordsPerPage',
    'introductionMaxPages',
    'chapterMaxPages',
  ]);
  const b = base;

  const profile: ConformityProfile = {
    id: r.text(input, 'id', '', b.id),
    name: r.text(input, 'name', '', b.name),
    institution: r.text(input, 'institution', '', b.institution),
    source: r.text(input, 'source', '', b.source),
    page: {
      widthMm: r.number(page, 'widthMm', 'page.', 50, 1000, b.page.widthMm),
      heightMm: r.number(page, 'heightMm', 'page.', 50, 1000, b.page.heightMm),
      marginsCm: {
        top: r.number(margins, 'top', 'page.marginsCm.', 0, 10, b.page.marginsCm.top),
        right: r.number(margins, 'right', 'page.marginsCm.', 0, 10, b.page.marginsCm.right),
        bottom: r.number(margins, 'bottom', 'page.marginsCm.', 0, 10, b.page.marginsCm.bottom),
        left: r.number(margins, 'left', 'page.marginsCm.', 0, 10, b.page.marginsCm.left),
      },
      marginToleranceMm: r.number(
        page,
        'marginToleranceMm',
        'page.',
        0,
        20,
        b.page.marginToleranceMm
      ),
      numberAlignment: r.choice(
        page,
        'numberAlignment',
        'page.',
        ALIGNMENTS,
        b.page.numberAlignment
      ),
      liminaryNumberFormat: r.choice(
        page,
        'liminaryNumberFormat',
        'page.',
        FORMATS,
        b.page.liminaryNumberFormat
      ),
      bodyNumberFormat: r.choice(
        page,
        'bodyNumberFormat',
        'page.',
        FORMATS,
        b.page.bodyNumberFormat
      ),
    },
    typography: {
      bodyFonts: r.texts(typo, 'bodyFonts', 'typography.', b.typography.bodyFonts),
      bodySizePt: r.number(typo, 'bodySizePt', 'typography.', 6, 72, b.typography.bodySizePt),
      lineSpacing: r.number(typo, 'lineSpacing', 'typography.', 0.5, 4, b.typography.lineSpacing),
      lineSpacingTolerance: r.number(
        typo,
        'lineSpacingTolerance',
        'typography.',
        0,
        1,
        b.typography.lineSpacingTolerance
      ),
      deviationTolerance: r.number(
        typo,
        'deviationTolerance',
        'typography.',
        0,
        1,
        b.typography.deviationTolerance
      ),
    },
    headings: readHeadings(r, input, b.headings),
    cover: {
      requiredMentions: r.texts(cover, 'requiredMentions', 'cover.', b.cover.requiredMentions),
    },
    structure: {
      parts: r.parts(structure, 'parts', 'structure.', b.structure.parts),
      introductionSections: r.parts(
        structure,
        'introductionSections',
        'structure.',
        b.structure.introductionSections
      ),
      minChapters: r.number(structure, 'minChapters', 'structure.', 0, 50, b.structure.minChapters),
      maxChapters: r.number(structure, 'maxChapters', 'structure.', 1, 50, b.structure.maxChapters),
      requirePartialIntroAndConclusion: r.boolean(
        structure,
        'requirePartialIntroAndConclusion',
        'structure.',
        b.structure.requirePartialIntroAndConclusion
      ),
    },
    captions: {
      tableCaptionPosition: r.choice(
        captions,
        'tableCaptionPosition',
        'captions.',
        ['above', 'below'] as const,
        b.captions.tableCaptionPosition
      ),
      figureCaptionPosition: r.choice(
        captions,
        'figureCaptionPosition',
        'captions.',
        ['above', 'below'] as const,
        b.captions.figureCaptionPosition
      ),
      chapterNumbering: r.boolean(
        captions,
        'chapterNumbering',
        'captions.',
        b.captions.chapterNumbering
      ),
    },
    references: {
      sectionAliases: r.texts(refs, 'sectionAliases', 'references.', b.references.sectionAliases),
      preferredTitle: r.text(refs, 'preferredTitle', 'references.', b.references.preferredTitle),
      minimumCount: r.number(
        refs,
        'minimumCount',
        'references.',
        0,
        500,
        b.references.minimumCount
      ),
      style: r.choice(refs, 'style', 'references.', ['ieee'] as const, b.references.style),
    },
    lengths: {
      wordsPerPage: r.number(lengths, 'wordsPerPage', 'lengths.', 50, 2000, b.lengths.wordsPerPage),
      introductionMaxPages: r.number(
        lengths,
        'introductionMaxPages',
        'lengths.',
        1,
        500,
        b.lengths.introductionMaxPages
      ),
      chapterMaxPages: r.number(
        lengths,
        'chapterMaxPages',
        'lengths.',
        1,
        500,
        b.lengths.chapterMaxPages
      ),
    },
    rules: { ...b.rules, ...readRules(r, input) },
    customRules: readCustomRules(r, input, b.customRules),
  };
  return r.errors.length > 0
    ? { ok: false, errors: r.errors }
    : { ok: true, profile, warnings: r.warnings };
}
