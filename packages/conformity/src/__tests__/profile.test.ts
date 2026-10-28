import { describe, expect, test } from 'bun:test';
import { parseProfile } from '../profile/parse-profile.ts';
import { UDBL_TFC_PROFILE } from '../profile/udbl-tfc.ts';

describe('parseProfile', () => {
  test('overrides only what the JSON names, on top of the UDBL profile', () => {
    const result = parseProfile({
      name: 'Mémoire L2',
      page: { marginsCm: { left: 4 } },
      rules: { 'longueur.chapitres': { enabled: false } },
    });
    if (!result.ok) throw new Error(result.errors.join());
    expect(result.profile.name).toBe('Mémoire L2');
    expect(result.profile.page.marginsCm).toEqual({ ...UDBL_TFC_PROFILE.page.marginsCm, left: 4 });
    expect(result.profile.typography).toEqual(UDBL_TFC_PROFILE.typography);
    expect(result.profile.rules['longueur.chapitres']).toEqual({ enabled: false });
  });

  test('rejects wrong types and out-of-range values with readable errors', () => {
    const result = parseProfile({ typography: { bodySizePt: 'douze', lineSpacing: 99 } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('typography.bodySizePt doit être un nombre entre 6 et 72');
    expect(result.errors).toContain('typography.lineSpacing doit être un nombre entre 0.5 et 4');
  });

  test('a __proto__ key is reported and never assigned', () => {
    const hostile = JSON.parse(
      '{"__proto__": {"polluted": true}, "rules": {"__proto__": {"enabled": false}}}'
    );
    const result = parseProfile(hostile);
    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (result.ok) expect(Object.keys(result.profile.rules)).toEqual([]);
  });

  test('a non-object is refused', () => {
    expect(parseProfile([1, 2]).ok).toBe(false);
  });
});
