import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDocx } from '../engine.ts';
import { parseRulesFile, parseRulesText } from '../profile/rules-text.ts';
import { profileToRulesText } from '../profile/rules-text-write.ts';
import type { ConformityProfile } from '../profile/types.ts';
import { UDBL_TFC_PROFILE } from '../profile/udbl-tfc.ts';
import { createTfcTemplate } from '../template/tfc-template.ts';
import { docx, h, p } from './fixtures.ts';

function profileOf(text: string): ConformityProfile {
  const result = parseRulesText(text);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.profile;
}

function summary(bytes: Uint8Array, profile: ConformityProfile) {
  const run = checkDocx(bytes, profile);
  if (!run.ok) throw new Error(run.reason);
  return run.report;
}

const SAMPLES = join(import.meta.dir, '../../../../examples/vite/public/intellieditor');

describe('the downloadable template', () => {
  const text = profileToRulesText(UDBL_TFC_PROFILE);
  const roundTrip = profileOf(text);

  test('reads back to the same norm values', () => {
    expect(roundTrip.page).toEqual(UDBL_TFC_PROFILE.page);
    expect(roundTrip.typography).toEqual(UDBL_TFC_PROFILE.typography);
    expect(roundTrip.headings).toEqual(UDBL_TFC_PROFILE.headings);
    expect(roundTrip.captions).toEqual(UDBL_TFC_PROFILE.captions);
    expect(roundTrip.lengths).toEqual(UDBL_TFC_PROFILE.lengths);
    expect(roundTrip.cover).toEqual(UDBL_TFC_PROFILE.cover);
    expect(roundTrip.structure.parts.map((part) => [part.id, part.required])).toEqual(
      UDBL_TFC_PROFILE.structure.parts.map((part) => [part.id, part.required])
    );
    expect(roundTrip.structure.minChapters).toBe(UDBL_TFC_PROFILE.structure.minChapters);
  });

  test('judges the demo documents exactly like the built-in norm', () => {
    for (const file of [
      'tfc-exemple-conforme.docx',
      'tfc-exemple-erreurs.docx',
      'tfc-modele-udbl.docx',
    ]) {
      const bytes = new Uint8Array(readFileSync(join(SAMPLES, file)));
      const expected = summary(bytes, UDBL_TFC_PROFILE);
      const actual = summary(bytes, roundTrip);
      expect(actual.summary).toEqual(expected.summary);
      expect(actual.results.map((r) => [r.id, r.status])).toEqual(
        expected.results.map((r) => [r.id, r.status])
      );
    }
  });
});

describe('a rules file written by another faculty', () => {
  const profile = profileOf(`
# Faculté de Droit
[norme]
nom = Mémoire — Faculté de Droit
institution = Université de Lubumbashi

[page]
marges = 2,5 2,5 2,5 3
position numero = centre
numerotation liminaires = chiffres romains majuscules

[texte]
police = Arial, Liberation Sans
taille = 11 pt
interligne = 1,5
tolerance ecarts = 10 %

[titres]
niveau 1 = gras, 14 pt

[structure]
parties = Dédicace?, Remerciements,
    Sommaire,
    Introduction générale, Conclusion générale, Bibliographie, Annexes?
chapitres = 2 à 5

[legendes]
tableaux = dessous

[regles]
references.ieee = désactivée
typo.interligne = erreur

[regle] Rédaction impersonnelle
type = texte interdit
valeurs = nous, notre, nos
gravite = avertissement
explication = Le mémoire est rédigé à la forme impersonnelle.

[regle] Résumé de 300 mots au plus
type = longueur de partie
valeurs = Résumé
max mots = 300
`);

  test('sets the values it names and keeps the norm for everything else', () => {
    expect(profile.name).toBe('Mémoire — Faculté de Droit');
    expect(profile.page.marginsCm).toEqual({ top: 2.5, right: 2.5, bottom: 2.5, left: 3 });
    expect(profile.page.numberAlignment).toBe('center');
    expect(profile.page.liminaryNumberFormat).toBe('upperRoman');
    expect(profile.typography.bodyFonts).toEqual(['Arial', 'Liberation Sans']);
    expect(profile.typography.bodySizePt).toBe(11);
    expect(profile.typography.deviationTolerance).toBeCloseTo(0.1);
    expect(profile.headings[0]).toEqual({ bold: true, italic: false, textCase: 'any', sizePt: 14 });
    expect(profile.headings[1]).toEqual(UDBL_TFC_PROFILE.headings[1]);
    expect(profile.captions.tableCaptionPosition).toBe('below');
    expect(profile.structure.minChapters).toBe(2);
    expect(profile.structure.maxChapters).toBe(5);
    expect(profile.rules).toEqual({
      'references.ieee': { enabled: false },
      'typo.interligne': { severity: 'error' },
    });
    expect(profile.references).toEqual(UDBL_TFC_PROFILE.references);
  });

  test('maps renamed parts to the parts the built-in rules look for', () => {
    const ids = profile.structure.parts.map((part) => part.id);
    // « Sommaire » is the table of contents, « Bibliographie » the references.
    expect(ids).toEqual([
      'dedicace',
      'remerciements',
      'table-matieres',
      'introduction',
      'conclusion',
      'references',
      'annexes',
    ]);
    expect(profile.structure.parts.find((part) => part.id === 'annexes')?.required).toBe(false);
  });

  test('declares its own rules, which run next to the built-in ones', () => {
    expect(profile.customRules.map((r) => [r.id, r.kind, r.severity])).toEqual([
      ['perso.redaction-impersonnelle', 'forbidden-text', 'warning'],
      ['perso.resume-de-300-mots-au-plus', 'part-length', 'warning'],
    ]);
    const r = summary(
      docx(
        h(1, 'Introduction générale') +
          p('Dans ce travail, nous analysons la gestion des stages.') +
          h(1, 'Résumé') +
          p('mot '.repeat(320)) +
          h(1, 'Conclusion générale') +
          p('Le travail est terminé.')
      ),
      profile
    );
    const impersonal = r.results.find((x) => x.id === 'perso.redaction-impersonnelle')!;
    expect(impersonal.category).toBe('etablissement');
    expect(impersonal.status).toBe('fail');
    expect(impersonal.findings[0]!.message).toContain('« nous »');
    expect(impersonal.reference).toBe('Le mémoire est rédigé à la forme impersonnelle.');
    const summaryRule = r.results.find((x) => x.id === 'perso.resume-de-300-mots-au-plus')!;
    expect(summaryRule.status).toBe('fail');
    expect(summaryRule.findings[0]!.message).toContain('320 mots, le maximum est 300');
  });
});

describe('custom rule kinds', () => {
  const run = (rules: string, body: string) => {
    const profile = profileOf(rules);
    return summary(docx(body), profile).results.filter((r) => r.category === 'etablissement');
  };

  test('a forbidden word matches whole words only, accents and case ignored', () => {
    const [rule] = run(
      '[regle] Pas de « on »\ntype = texte interdit\nvaleurs = on',
      h(1, 'Introduction générale') +
        p('Une question bien posée, sans pronom.') +
        h(1, 'Conclusion générale')
    );
    expect(rule!.status).toBe('pass');
  });

  test('required text, required part and document length', () => {
    const results = run(
      `[regle] Mention du jury
type = texte obligatoire
valeurs = membres du jury
zone = document

[regle] Résumé obligatoire
type = partie obligatoire
valeurs = Résumé (Abstract)

[regle] Au moins dix pages
type = longueur du document
min pages = 10`,
      h(1, 'Introduction générale') + p('Court.') + h(1, 'Conclusion générale')
    );
    expect(results.map((r) => [r.id, r.status])).toEqual([
      ['perso.mention-du-jury', 'fail'],
      ['perso.resume-obligatoire', 'fail'],
      ['perso.au-moins-dix-pages', 'fail'],
    ]);
  });
});

describe('mistakes in a rules file', () => {
  test('are reported with the line and the key the author wrote', () => {
    const result = parseRulesText('[texte]\ntaille = douze\n\n[page]\nposition numero = en haut');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('ligne 2 (taille) : doit être un nombre entre 6 et 72');
    expect(result.errors.some((e) => e.startsWith('ligne 5 (position numero)'))).toBe(true);
  });

  test('a wrong rule type lists the possible ones in French', () => {
    const result = parseRulesText('[regle] X\ntype = interdiction\nvaleurs = a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('texte interdit, texte obligatoire');
  });

  test('a line without « = » is an error; an unknown key or section is a warning', () => {
    const broken = parseRulesText('[texte]\npolice Arial');
    expect(broken.ok).toBe(false);
    const result = parseRulesText('[texte]\ncouleur = rouge\n[inconnue]\nx = 1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual([
        'ligne 2 : « couleur » inconnu dans [texte], ignoré',
        'ligne 3 : section inconnue [inconnue] ignorée',
      ]);
    }
  });

  test('size limits and the JSON format still apply', () => {
    expect(parseRulesText('x\n'.repeat(4000)).ok).toBe(false);
    const json = parseRulesFile('{"typography": {"bodySizePt": 11}}');
    expect(json.ok && json.profile.typography.bodySizePt).toBe(11);
    expect(parseRulesFile('{ pas du json').ok).toBe(false);
  });

  test('the generated « Nouveau TFC » follows a norm read from text', () => {
    const profile = profileOf('[texte]\npolice = Arial\ntaille = 11');
    const r = summary(createTfcTemplate(undefined, profile), profile);
    expect(r.results.find((x) => x.id === 'typo.police')!.status).toBe('pass');
    expect(r.results.find((x) => x.id === 'typo.taille')!.status).toBe('pass');
  });
});

describe('the rules files shipped in packages/conformity/regles', () => {
  const dir = join(import.meta.dir, '../../regles');

  test('the UDBL template is up to date with the built-in norm', () => {
    const shipped = readFileSync(join(dir, 'regles-udbl-fsi.txt'), 'utf8');
    expect(shipped).toBe(profileToRulesText(UDBL_TFC_PROFILE));
  });

  test('the other-faculty example reads without errors or warnings', () => {
    const result = parseRulesText(readFileSync(join(dir, 'exemple-faculte-de-droit.txt'), 'utf8'));
    if (!result.ok) throw new Error(result.errors.join('\n'));
    expect(result.warnings).toEqual([]);
    expect(result.profile.customRules).toHaveLength(4);
    expect(result.profile.references.preferredTitle).toBe('Bibliographie');
  });
});
