// Références: IEEE citations "[n]" in the text, every citation resolvable, a list of at least
// ten sources, titled « Références » rather than « Bibliographie ».

import type { ParagraphModel } from '../model/types.ts';
import { normalize } from '../analysis/text.ts';
import {
  at,
  capFindings,
  fail,
  pass,
  skip,
  type Finding,
  type Rule,
  type RuleContext,
} from './types.ts';

/** "[3]", "[3, p. 12]", "[2, pp. 11-27]", "[1], [4]" — one number per bracket, IEEE style. */
const CITATION = /\[(\d{1,3})(?:\s*,\s*[^\]]{0,40})?\]/g;

function referenceEntries(ctx: RuleContext): ParagraphModel[] | null {
  const part = ctx.structure.part('references');
  if (!part) return null;
  return ctx.document.paragraphs
    .slice(part.contentStart, part.contentEnd + 1)
    .filter((p) => (p.role === 'body' || p.role === 'caption') && p.text.length >= 15);
}

function citedNumbers(ctx: RuleContext): Map<number, ParagraphModel> {
  const refs = ctx.structure.part('references');
  const cited = new Map<number, ParagraphModel>();
  for (const p of ctx.document.paragraphs) {
    if (p.index < ctx.structure.cover.length || p.role === 'toc') continue;
    if (refs && p.index >= refs.title.index && p.index <= refs.contentEnd) continue;
    for (const match of p.text.matchAll(CITATION)) {
      const n = Number(match[1]);
      if (!cited.has(n)) cited.set(n, p);
    }
  }
  return cited;
}

export const referencesTitleRule: Rule = {
  id: 'references.titre',
  title: 'Intitulé « Références »',
  category: 'references',
  severity: 'info',
  reference: 'On utilise le concept « Références » en lieu et place de « Bibliographie » (§1.5.1).',
  check(ctx) {
    const part = ctx.structure.part('references');
    if (!part) return skip('section des références introuvable');
    const preferred = normalize(ctx.profile.references.preferredTitle);
    return normalize(part.title.text).includes(preferred)
      ? pass()
      : fail([
          {
            message: `Intitulez la section « ${ctx.profile.references.preferredTitle} » plutôt que « ${part.title.text} ».`,
            location: at(part.title),
          },
        ]);
  },
};

export const referencesCountRule: Rule = {
  id: 'references.nombre',
  title: 'Nombre de références',
  category: 'references',
  severity: 'warning',
  reference: 'Au minimum une dizaine de sources, de nature et de langues diverses (§1.4, §2.7).',
  check(ctx) {
    const entries = referenceEntries(ctx);
    if (!entries) return skip('section des références introuvable');
    const min = ctx.profile.references.minimumCount;
    const summary = `${entries.length} référence(s)`;
    return entries.length >= min
      ? pass(summary)
      : fail(
          [
            {
              message: `${entries.length} référence(s) seulement : la norme en demande au moins ${min}.`,
              location: at(ctx.structure.part('references')!.title),
            },
          ],
          summary
        );
  },
};

export const ieeeCitationsRule: Rule = {
  id: 'references.ieee',
  title: 'Citations au format IEEE',
  category: 'references',
  severity: 'warning',
  reference:
    'Norme IEEE : les sources sont citées dans le texte par des numéros entre crochets [n], dans l’ordre d’apparition (§1.5.1).',
  check(ctx) {
    const entries = referenceEntries(ctx);
    if (!entries) return skip('section des références introuvable');
    const cited = citedNumbers(ctx);
    const findings: Finding[] = [];
    if (cited.size === 0) {
      return fail([
        { message: 'Aucune citation au format IEEE ([1], [2, p. 12]…) dans le texte.' },
      ]);
    }
    for (const [n, paragraph] of cited) {
      if (n < 1 || n > entries.length) {
        findings.push({
          message: `[${n}] est cité mais la liste ne compte que ${entries.length} référence(s).`,
          location: at(paragraph),
        });
      }
    }
    const never = Array.from({ length: entries.length }, (_, i) => i + 1).filter(
      (n) => !cited.has(n)
    );
    if (never.length > 0) {
      findings.push({
        message: `Référence(s) jamais citée(s) dans le texte : ${never.map((n) => `[${n}]`).join(', ')}.`,
        location: at(entries[never[0]! - 1]!),
      });
    }
    const order = [...cited.keys()];
    const firstOutOfOrder = order.findIndex(
      (n, i) => i > 0 && n > Math.max(...order.slice(0, i)) + 1
    );
    if (firstOutOfOrder > 0) {
      findings.push({
        message: `Numérotation non séquentielle : [${order[firstOutOfOrder]}] apparaît avant [${Math.max(...order.slice(0, firstOutOfOrder)) + 1}] (IEEE numérote dans l’ordre d’apparition).`,
        location: at(cited.get(order[firstOutOfOrder]!)!),
      });
    }
    return fail(capFindings(findings, 'problèmes de citation'), `${cited.size} source(s) citée(s)`);
  },
};

export const REFERENCE_RULES: readonly Rule[] = [
  referencesTitleRule,
  referencesCountRule,
  ieeeCitationsRule,
];
