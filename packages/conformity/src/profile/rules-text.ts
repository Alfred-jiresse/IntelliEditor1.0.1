// The plain-text rules file: a norm written in French, by a secretariat or a director, not by
// a developer.
//
//     # commentaire
//     [norme]
//     nom = TFC — Faculté de Droit
//     [texte]
//     police = Arial
//     taille = 11
//     [regle] Pas de « nous »
//     type = texte interdit
//     valeurs = nous, notre, nos
//
// This module only TRANSLATES the text into the JSON profile shape, remembering which line
// every value came from. Validation is `parseProfile`'s — one set of bounds for both formats —
// and its messages are re-addressed to the line and the key the author actually wrote.
// The file is untrusted: line count and length are capped, keys are matched against a fixed
// vocabulary, and nothing in it is ever compiled into a pattern or evaluated.

import { normalize } from '../analysis/text.ts';
import { MAX_CUSTOM_RULES, parseProfile, type ProfileParseResult } from './parse-profile.ts';
import type { ConformityProfile, PartSpec } from './types.ts';
import { UDBL_TFC_PROFILE } from './udbl-tfc.ts';

const MAX_LINES = 3000;
/** The current section is an unknown one: its lines are skipped without a warning each. */
const IGNORED = '\u0000';
const MAX_LINE_LENGTH = 2000;

type Json = Record<string, unknown>;

interface Origin {
  readonly line: number;
  readonly key: string;
}

/** Splits `a, b (c, d), e` on the commas that are not inside parentheses. */
export function splitList(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  items.push(current);
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

/** `2,5`, `2.5 cm`, `12 pt`, `5 %` → a number (a percentage as a share). Null when not one. */
function parseNumber(value: string): number | null {
  const match =
    /^(-?\d{1,6}(?:[.,]\d{1,6})?)\s*(%|cm|mm|pt|pts|points?|pages?|mots?|lignes?)?$/i.exec(
      value.trim()
    );
  if (!match) return null;
  const number = Number(match[1]!.replace(',', '.'));
  return match[2] === '%' ? number / 100 : number;
}

function parseYesNo(value: string): boolean | null {
  const v = normalize(value);
  if (['oui', 'vrai', 'yes', 'true', 'obligatoire', 'activee', 'active'].includes(v)) return true;
  if (['non', 'faux', 'no', 'false', 'facultatif', 'facultative'].includes(v)) return false;
  return null;
}

/** `romain` / `chiffres romains majuscules` / `A, B, C` → the `w:pgNumType` format. */
function parseNumberFormat(value: string): string | null {
  const v = normalize(value);
  const upper = /majuscule|\bI\b|\bA\b/.test(value) || v.includes('majuscule');
  if (v.includes('romain') || /^i\b/.test(v)) return upper ? 'upperRoman' : 'lowerRoman';
  if (v.includes('lettre') || /^a\b/.test(v)) return upper ? 'upperLetter' : 'lowerLetter';
  if (v.includes('arabe') || /^1\b/.test(v)) return 'decimal';
  return null;
}

const SEVERITY: Readonly<Record<string, string>> = {
  erreur: 'error',
  error: 'error',
  avertissement: 'warning',
  warning: 'warning',
  conseil: 'info',
  info: 'info',
};

const RULE_KIND: Readonly<Record<string, string>> = {
  'texte interdit': 'forbidden-text',
  'mot interdit': 'forbidden-text',
  'mots interdits': 'forbidden-text',
  'texte obligatoire': 'required-text',
  'mention obligatoire': 'required-text',
  'partie obligatoire': 'required-part',
  'longueur de partie': 'part-length',
  'longueur d une partie': 'part-length',
  'longueur du document': 'document-length',
  'longueur du travail': 'document-length',
};

const ZONE: Readonly<Record<string, string>> = {
  corps: 'body',
  texte: 'body',
  'texte du travail': 'body',
  'page de garde': 'cover',
  document: 'document',
  'tout le document': 'document',
};

/**
 * A part list item: `Dédicace?` (optional), `Liste des figures (table des figures; liste des
 * illustrations)` (extra titles). The id is the built-in part's when the title is one of its
 * aliases — the rules that look for « introduction » or « références » find it whatever the
 * institution calls it — and a slug of the title otherwise.
 */
function partItem(raw: string, builtIn: readonly PartSpec[]): Json {
  const optional = /\?\s*(\(|$)/.test(raw);
  const extras = /\(([^)]*)\)/.exec(raw)?.[1];
  const label = raw
    .replace(/\([^)]*\)/, '')
    .replace('?', '')
    .trim();
  const aliases = [label, ...(extras ? extras.split(/[;/]/).map((a) => a.trim()) : [])].filter(
    (a) => a.length > 0
  );
  const normalized = aliases.map(normalize);
  const known = builtIn.find(
    (spec) =>
      spec.aliases.some((alias) => normalized.includes(normalize(alias))) ||
      normalized.includes(normalize(spec.label))
  );
  const id =
    known?.id ??
    (normalize(label)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) ||
      'partie');
  return { id, label, aliases, required: !optional };
}

/** One section's keys: normalized key → [json path, how to read the value]. */
type Reader = (value: string, builtIn: ConformityProfile) => unknown;
type KeySpec = readonly [path: string, read: Reader];

const text: Reader = (v) => v.trim();
const list: Reader = (v) => splitList(v);
const number: Reader = (v) => parseNumber(v) ?? v;
const yesNo: Reader = (v) => parseYesNo(v) ?? v;
const choice =
  (map: Readonly<Record<string, string>>): Reader =>
  (v) =>
    map[normalize(v)] ?? v;
const format: Reader = (v) => parseNumberFormat(v) ?? v;
const parts =
  (which: 'parts' | 'introductionSections'): Reader =>
  (v, base) =>
    splitList(v).map((item) => partItem(item, base.structure[which]));

const POSITION = {
  droite: 'right',
  centre: 'center',
  gauche: 'left',
  right: 'right',
  center: 'center',
  left: 'left',
};
const ABOVE_BELOW = {
  dessus: 'above',
  'au dessus': 'above',
  'au dessus de l element': 'above',
  dessous: 'below',
  'en dessous': 'below',
  'en dessous de l element': 'below',
  above: 'above',
  below: 'below',
};

const SECTIONS: Readonly<Record<string, Readonly<Record<string, KeySpec>>>> = {
  norme: {
    nom: ['name', text],
    institution: ['institution', text],
    source: ['source', text],
    identifiant: ['id', text],
  },
  page: {
    'marge haut': ['page.marginsCm.top', number],
    'marge droite': ['page.marginsCm.right', number],
    'marge bas': ['page.marginsCm.bottom', number],
    'marge gauche': ['page.marginsCm.left', number],
    'tolerance marges': ['page.marginToleranceMm', number],
    'largeur page': ['page.widthMm', number],
    'hauteur page': ['page.heightMm', number],
    'position numero': ['page.numberAlignment', choice(POSITION)],
    'numerotation liminaires': ['page.liminaryNumberFormat', format],
    'numerotation corps': ['page.bodyNumberFormat', format],
  },
  texte: {
    police: ['typography.bodyFonts', list],
    polices: ['typography.bodyFonts', list],
    taille: ['typography.bodySizePt', number],
    interligne: ['typography.lineSpacing', number],
    'tolerance interligne': ['typography.lineSpacingTolerance', number],
    'tolerance ecarts': ['typography.deviationTolerance', number],
  },
  'page de garde': {
    mentions: ['cover.requiredMentions', list],
  },
  structure: {
    parties: ['structure.parts', parts('parts')],
    'sections introduction': ['structure.introductionSections', parts('introductionSections')],
    'introduction et conclusion partielles': ['structure.requirePartialIntroAndConclusion', yesNo],
    'chapitres minimum': ['structure.minChapters', number],
    'chapitres maximum': ['structure.maxChapters', number],
  },
  legendes: {
    tableaux: ['captions.tableCaptionPosition', choice(ABOVE_BELOW)],
    figures: ['captions.figureCaptionPosition', choice(ABOVE_BELOW)],
    'numerotation par chapitre': ['captions.chapterNumbering', yesNo],
  },
  references: {
    titre: ['references.preferredTitle', text],
    'titres acceptes': ['references.sectionAliases', list],
    minimum: ['references.minimumCount', number],
    style: ['references.style', (v) => normalize(v)],
  },
  longueurs: {
    'mots par page': ['lengths.wordsPerPage', number],
    'introduction max': ['lengths.introductionMaxPages', number],
    'chapitre max': ['lengths.chapterMaxPages', number],
  },
};

/** A rule's values: `Résumé (Abstract; Summary)` is the title « Résumé » or one of the others. */
const ruleValues: Reader = (v) =>
  splitList(v).flatMap((item) => {
    const extras = /\(([^)]*)\)/.exec(item)?.[1];
    const main = item.replace(/\([^)]*\)/, '').trim();
    return [main, ...(extras ? extras.split(/[;/]/).map((a) => a.trim()) : [])].filter(
      (value) => value.length > 0
    );
  });

/** Keys of a `[regle]` block → custom rule fields. */
const RULE_KEYS: Readonly<Record<string, KeySpec>> = {
  titre: ['title', text],
  type: ['kind', choice(RULE_KIND)],
  valeurs: ['values', ruleValues],
  textes: ['values', ruleValues],
  mots: ['values', ruleValues],
  partie: ['values', ruleValues],
  parties: ['values', ruleValues],
  zone: ['zone', choice(ZONE)],
  gravite: ['severity', choice(SEVERITY)],
  explication: ['reference', text],
  reference: ['reference', text],
  'min mots': ['minWords', number],
  'max mots': ['maxWords', number],
  'min pages': ['minPages', number],
  'max pages': ['maxPages', number],
  identifiant: ['id', text],
};

/** The closed vocabularies of a `[regle]` block, and how to name them in an error. */
const CHOICES: Readonly<Record<string, { map: Readonly<Record<string, string>>; label: string }>> =
  {
    kind: {
      map: RULE_KIND,
      label:
        'texte interdit, texte obligatoire, partie obligatoire, longueur de partie, longueur du document',
    },
    zone: { map: ZONE, label: 'corps, page de garde, document' },
    severity: { map: SEVERITY, label: 'erreur, avertissement, conseil' },
  };

/** `niveau 2 = gras, italique, 12 pt` → a heading spec. */
function headingSpec(value: string, fallbackSize: number): Json | string {
  const tokens = splitList(value).map(normalize);
  let size = fallbackSize;
  for (const token of tokens) {
    const n = parseNumber(token);
    if (n !== null) size = n;
    else if (!['gras', 'italique', 'majuscules', 'minuscules', 'libre', 'normal'].includes(token))
      return `« ${token} » n'est pas reconnu (gras, italique, majuscules, minuscules, taille)`;
  }
  return {
    bold: tokens.includes('gras'),
    italic: tokens.includes('italique'),
    textCase: tokens.includes('majuscules')
      ? 'upper'
      : tokens.includes('minuscules')
        ? 'lower'
        : 'any',
    sizePt: size,
  };
}

function setPath(root: Json, path: string, value: unknown): void {
  const keys = path.split('.');
  let node = root;
  for (const key of keys.slice(0, -1)) {
    if (!Object.prototype.hasOwnProperty.call(node, key)) node[key] = {};
    node = node[key] as Json;
  }
  node[keys[keys.length - 1]!] = value;
}

export type RulesTextResult =
  | {
      readonly ok: true;
      readonly profile: ConformityProfile;
      readonly warnings: readonly string[];
    }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly warnings: readonly string[];
    };

/** Read a plain-text rules file into a validated profile, laid over `base` (UDBL by default). */
export function parseRulesText(
  source: string,
  base: ConformityProfile = UDBL_TFC_PROFILE
): RulesTextResult {
  const lines = source.replace(/^﻿/, '').split(/\r?\n/);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (lines.length > MAX_LINES) {
    return { ok: false, errors: [`fichier trop long (${MAX_LINES} lignes au plus)`], warnings };
  }

  const json: Json = Object.create(null) as Json;
  const origins = new Map<string, Origin>();
  const rules: Json = Object.create(null) as Json;
  const customRules: Json[] = [];
  const headings: Json[] = [];
  let section: string | null = null;
  let rule: Json | null = null;
  let chapters: { min?: number; max?: number } = {};

  // A line starting with spaces continues the previous value (long lists on several lines).
  const logical: { line: number; text: string }[] = [];
  lines.forEach((raw, i) => {
    if (raw.length > MAX_LINE_LENGTH) {
      errors.push(`ligne ${i + 1} : trop longue (${MAX_LINE_LENGTH} caractères au plus)`);
      return;
    }
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) return;
    const previous = logical[logical.length - 1];
    if (/^\s/.test(raw) && previous && !trimmed.startsWith('[') && !trimmed.includes('=')) {
      previous.text += ` ${trimmed}`;
      return;
    }
    logical.push({ line: i + 1, text: trimmed });
  });

  for (const { line, text: content } of logical) {
    const header = /^\[([^\]]+)\]\s*(.*)$/.exec(content);
    if (header) {
      section = normalize(header[1]!);
      rule = null;
      if (section === 'regle') {
        if (customRules.length >= MAX_CUSTOM_RULES) {
          errors.push(`ligne ${line} : ${MAX_CUSTOM_RULES} règles personnalisées au plus`);
          section = null;
          continue;
        }
        rule = Object.create(null) as Json;
        if (header[2]!.trim()) rule.title = header[2]!.trim();
        origins.set(`customRules[${customRules.length}].`, { line, key: '[regle]' });
        customRules.push(rule);
      } else if (section !== 'regles' && section !== 'titres' && !SECTIONS[section]) {
        warnings.push(`ligne ${line} : section inconnue [${header[1]}] ignorée`);
        section = IGNORED;
      }
      continue;
    }
    // The section was already reported once; its lines go with it, silently.
    if (section === IGNORED) continue;
    const equals = content.indexOf('=');
    if (equals === -1) {
      errors.push(`ligne ${line} : « clé = valeur » attendu`);
      continue;
    }
    const rawKey = content.slice(0, equals).trim();
    const value = content.slice(equals + 1).trim();
    const key = normalize(rawKey);
    if (section === null) {
      warnings.push(`ligne ${line} : « ${rawKey} » est hors de toute section, ignoré`);
      continue;
    }
    if (value === '') {
      errors.push(`ligne ${line} : « ${rawKey} » n'a pas de valeur`);
      continue;
    }

    if (section === 'regle' && rule) {
      const spec = RULE_KEYS[key];
      if (!spec) {
        warnings.push(`ligne ${line} : « ${rawKey} » inconnu dans une [regle], ignoré`);
        continue;
      }
      const choices = CHOICES[spec[0]];
      if (choices && !choices.map[normalize(value)]) {
        errors.push(`ligne ${line} : « ${value} » — ${rawKey} attendu : ${choices.label}`);
        continue;
      }
      rule[spec[0]] = spec[1](value, base);
      origins.set(`customRules[${customRules.length - 1}].${spec[0]}`, { line, key: rawKey });
      continue;
    }
    if (section === 'regles') {
      const id = rawKey.toLowerCase();
      const v = normalize(value);
      if (['desactivee', 'desactive', 'non'].includes(v)) rules[id] = { enabled: false };
      else if (['activee', 'active', 'oui'].includes(v)) rules[id] = { enabled: true };
      else if (SEVERITY[v]) rules[id] = { severity: SEVERITY[v] };
      else
        errors.push(
          `ligne ${line} : « ${value} » — attendu erreur, avertissement, conseil ou désactivée`
        );
      continue;
    }
    if (section === 'titres') {
      const level = /^niveau (\d)$/.exec(key);
      if (!level || Number(level[1]) < 1) {
        warnings.push(`ligne ${line} : « ${rawKey} » ignoré (attendu « niveau 1 » … « niveau 9 »)`);
        continue;
      }
      const index = Number(level[1]) - 1;
      const spec = headingSpec(value, base.headings[index]?.sizePt ?? 12);
      if (typeof spec === 'string') errors.push(`ligne ${line} : ${spec}`);
      else {
        headings[index] = spec;
        origins.set(`headings[${index}].`, { line, key: rawKey });
      }
      continue;
    }
    // Combined forms that fill several fields at once.
    if (section === 'page' && key === 'marges') {
      const values = value.split(/\s+/).map(parseNumber);
      if (values.length !== 4 || values.some((v) => v === null)) {
        errors.push(`ligne ${line} : marges = haut droite bas gauche, en cm (ex. 3,5 2,5 2,5 3,5)`);
        continue;
      }
      ['top', 'right', 'bottom', 'left'].forEach((side, i) => {
        setPath(json, `page.marginsCm.${side}`, values[i]);
        origins.set(`page.marginsCm.${side}`, { line, key: rawKey });
      });
      continue;
    }
    if (section === 'page' && key === 'format') {
      const v = normalize(value);
      const size = v === 'a4' ? [210, 297] : /^(\d+)\s*x\s*(\d+)/.exec(v)?.slice(1).map(Number);
      if (!size) {
        errors.push(`ligne ${line} : format = A4 ou largeur x hauteur en mm (ex. 210 x 297)`);
        continue;
      }
      setPath(json, 'page.widthMm', size[0]);
      setPath(json, 'page.heightMm', size[1]);
      origins.set('page.widthMm', { line, key: rawKey });
      origins.set('page.heightMm', { line, key: rawKey });
      continue;
    }
    if (section === 'structure' && key === 'chapitres') {
      const bounds = /^(\d{1,2})\s*(?:a|-)\s*(\d{1,2})$/.exec(normalize(value));
      if (!bounds) {
        errors.push(`ligne ${line} : chapitres = minimum à maximum (ex. 1 à 4)`);
        continue;
      }
      chapters = { min: Number(bounds[1]), max: Number(bounds[2]) };
      origins.set('structure.minChapters', { line, key: rawKey });
      origins.set('structure.maxChapters', { line, key: rawKey });
      continue;
    }

    const spec = SECTIONS[section]?.[key];
    if (!spec) {
      warnings.push(`ligne ${line} : « ${rawKey} » inconnu dans [${section}], ignoré`);
      continue;
    }
    setPath(json, spec[0], spec[1](value, base));
    origins.set(spec[0], { line, key: rawKey });
  }

  if (chapters.min !== undefined) setPath(json, 'structure.minChapters', chapters.min);
  if (chapters.max !== undefined) setPath(json, 'structure.maxChapters', chapters.max);
  if (headings.length > 0) {
    // Levels the file does not restate keep the base profile's.
    json.headings = Array.from(
      { length: Math.max(headings.length, base.headings.length) },
      (_, i) => headings[i] ?? { ...base.headings[i] }
    );
  }
  if (Object.keys(rules).length > 0) json.rules = rules;
  if (customRules.length > 0) json.customRules = customRules;
  if (errors.length > 0) return { ok: false, errors, warnings };

  const parsed: ProfileParseResult = parseProfile(json, base);
  const located = (message: string): string => {
    // `typography.bodySizePt doit être…` → `ligne 12 (taille) : doit être…`
    let best: [string, Origin] | null = null;
    for (const entry of origins) {
      if (message.startsWith(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
    }
    return best
      ? `ligne ${best[1].line} (${best[1].key}) : ${message.slice(best[0].length).trim()}`
      : message;
  };
  if (!parsed.ok) return { ok: false, errors: parsed.errors.map(located), warnings };
  return {
    ok: true,
    profile: parsed.profile,
    warnings: [...warnings, ...parsed.warnings.map(located)],
  };
}

/** A rules file is JSON when its first character opens an object; plain text otherwise. */
export function parseRulesFile(
  source: string,
  base: ConformityProfile = UDBL_TFC_PROFILE
): RulesTextResult {
  if (source.trimStart().startsWith('{')) {
    let json: unknown;
    try {
      json = JSON.parse(source);
    } catch {
      return {
        ok: false,
        errors: ['le fichier commence par « { » mais n’est pas un JSON valide'],
        warnings: [],
      };
    }
    const parsed = parseProfile(json, base);
    return parsed.ok ? parsed : { ok: false, errors: parsed.errors, warnings: [] };
  }
  return parseRulesText(source, base);
}
