import { describe, expect, test } from 'bun:test';
import { checkDocx } from '../engine.ts';
import { createTfcTemplate } from '../template/tfc-template.ts';
import type { ConformityReport, RuleResult } from '../engine.ts';
import { caption, docx, h, p, paragraph, run, table, tocField } from './fixtures.ts';

function report(bytes: Uint8Array): ConformityReport {
  const result = checkDocx(bytes);
  if (!result.ok) throw new Error(result.reason);
  return result.report;
}

function rule(r: ConformityReport, id: string): RuleResult {
  const found = r.results.find((x) => x.id === id);
  if (!found) throw new Error(`rule ${id} not in report`);
  return found;
}

const messages = (r: RuleResult) => r.findings.map((f) => f.message).join('\n');

describe('the generated « Nouveau TFC » template', () => {
  const r = report(createTfcTemplate());

  test('satisfies every layout, typography, heading and structure rule of the profile', () => {
    const failing = r.results.filter((x) => x.status === 'fail').map((x) => x.id);
    // Only the content the student still has to write may fail: ten references.
    expect(failing).toEqual(['references.nombre']);
    expect(r.summary.errors).toBe(0);
  });

  test('is split into cover / preliminaries / body sections with their own numbering', () => {
    expect(r.stats.sections).toBe(3);
    expect(rule(r, 'page.format-numero').status).toBe('pass');
    expect(rule(r, 'structure.table-automatique').status).toBe('pass');
  });
});

describe('page rules', () => {
  test('wrong margins are reported with a fix the editor can apply', () => {
    const r = report(
      docx(p('Texte.'), {
        finalSection:
          '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
      })
    );
    const margins = rule(r, 'page.marges');
    expect(margins.status).toBe('fail');
    expect(messages(margins)).toContain('haut 2,54 cm (attendu 3,5)');
    expect(margins.findings[0]!.fix).toEqual({
      kind: 'set-page-margins',
      label: 'Appliquer les marges de la norme',
      marginsTwips: { top: 1984, right: 1417, bottom: 1417, left: 1984 },
    });
  });

  test('a page number not in the right corner is a warning', () => {
    const r = report(docx(p('Texte.'), { footerAlignment: 'center' }));
    expect(messages(rule(r, 'page.position-numero'))).toContain('au centre au lieu de à droite');
  });
});

describe('typography', () => {
  const styles = (font: string, halfPoints: number) => `<?xml version="1.0"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${halfPoints}"/></w:rPr></w:style>
</w:styles>`;

  test('fonts and sizes resolve through the style cascade, not only direct formatting', () => {
    const ok = report(
      docx(p('Un paragraphe.') + p('Un autre.'), { styles: styles('Times New Roman', 24) })
    );
    expect(rule(ok, 'typo.police').status).toBe('pass');
    expect(rule(ok, 'typo.taille').status).toBe('pass');

    const bad = report(
      docx(p('Un paragraphe.') + p('Un autre.'), { styles: styles('Calibri', 22) })
    );
    expect(messages(rule(bad, 'typo.police'))).toContain('Police « Calibri »');
    expect(messages(rule(bad, 'typo.taille'))).toContain('Taille 11 pt au lieu de 12 pt');
  });
});

describe('headings', () => {
  test('duplicate numbers, gaps and a section numbered for another chapter are all reported', () => {
    const body = [
      h(1, 'Introduction générale'),
      h(1, 'Chapitre 1 : Généralités'),
      h(2, '1.1. Introduction partielle'),
      h(2, '1.2. Première'),
      h(2, '1.2. Doublon'),
      h(2, '1.4. Après un saut'),
      h(1, 'Chapitre 2 : Analyse'),
      h(2, '1.1. Mal numérotée'),
      h(1, 'Conclusion générale'),
    ].join('');
    const numbering = rule(report(docx(body)), 'titres.numerotation');
    const text = messages(numbering);
    expect(text).toContain('Numéro 1.2 utilisé deux fois');
    expect(text).toContain('Saut de numérotation : 1.2 est suivi de 1.4 (1.3 manquant)');
    expect(text).toContain('est dans le chapitre 2 mais numéroté 1.1');
  });
});

describe('structure and integrity', () => {
  test('a stale cross-reference is an error wherever it appears', () => {
    const r = report(docx(p('Figure 3.2: Diagramme ....... Erreur ! Signet non défini.')));
    expect(rule(r, 'integrite.champs').status).toBe('fail');
  });

  test('a hand-typed table of contents is not accepted as automatic', () => {
    const manual = report(docx(h(1, 'Table des matières') + p('Introduction générale........1')));
    expect(rule(manual, 'structure.table-automatique').status).toBe('fail');
    const generated = report(docx(h(1, 'Table des matières') + tocField()));
    expect(rule(generated, 'structure.table-automatique').status).toBe('pass');
  });

  test('missing introduction sections are listed by name', () => {
    const r = report(docx(h(1, 'Introduction générale') + h(2, '0.1. Problématique') + p('…')));
    const text = messages(rule(r, 'structure.introduction'));
    expect(text).toContain('« Hypothèses »');
    expect(text).not.toContain('« Problématique »');
  });
});

describe('captions', () => {
  test('a table caption placed below the table is reported', () => {
    const body =
      h(1, 'Introduction générale') +
      h(1, 'Chapitre 1 : X') +
      table('Désignation') +
      caption('Tableau 1.1 Résultats');
    const position = rule(report(docx(body)), 'legendes.position');
    expect(messages(position)).toContain('la légende d’un tableau se place au-dessus');
  });

  test('captions numbered without the chapter are reported', () => {
    const body =
      h(1, 'Introduction générale') + h(1, 'Chapitre 1 : X') + caption('Tableau 1') + table('A');
    expect(messages(rule(report(docx(body)), 'legendes.numerotation'))).toContain(
      'numérotation simple'
    );
  });
});

describe('references', () => {
  test('citations pointing past the list and sources never cited are reported', () => {
    const body = [
      h(1, 'Introduction générale'),
      p('Comme le montre [1] et plus loin [4, p. 12].'),
      h(1, 'Conclusion générale'),
      p('Fin.'),
      h(1, 'Références'),
      p('[1] A. Auteur, Un livre, Ville : Éditeur, 2020.'),
      p('[2] B. Autre, Un article, Revue, 2021.'),
    ].join('');
    const text = messages(rule(report(docx(body)), 'references.ieee'));
    expect(text).toContain('[4] est cité mais la liste ne compte que 2 référence(s)');
    expect(text).toContain('jamais citée(s) dans le texte : [2]');
  });
});

describe('robustness', () => {
  test('a non-zip file is a typed refusal, not an exception', () => {
    const result = checkDocx(new TextEncoder().encode('pas un docx'));
    expect(result.ok).toBe(false);
  });

  test('WordprocessingML bound to another prefix reads the same', () => {
    const xml = `<?xml version="1.0"?><x:document xmlns:x="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><x:body><x:p><x:r><x:t>Erreur ! Signet non défini.</x:t></x:r></x:p></x:body></x:document>`;
    const r = report(docx('', { documentXml: xml }));
    expect(rule(r, 'integrite.champs').status).toBe('fail');
  });

  test('bold runs are summarized by character share, not by the first run', () => {
    const mixed = paragraph([run('Un mot ', { bold: true }), run('puis du texte normal.')]);
    const r = report(docx(mixed));
    expect(r.stats.paragraphs).toBe(1);
  });
});
