// The active norm profile: the built-in UDBL one, or a JSON the user imported.
//
// The imported JSON is remembered in this browser only (a per-viewer convenience), and is
// re-validated through `parseProfile` every time it is read back — storage is as untrusted
// as the file it came from. Every storage access is guarded: a private window or blocked
// site data simply means "no remembered profile".

import { parseProfile, UDBL_TFC_PROFILE, type ConformityProfile } from '@intellieditor/conformity';

const STORAGE_KEY = 'intellieditor:profile:v1';
const MAX_PROFILE_BYTES = 256 * 1024;

export type ProfileImport =
  | { readonly ok: true; readonly profile: ConformityProfile; readonly warnings: readonly string[] }
  | { readonly ok: false; readonly errors: readonly string[] };

function fromJsonText(text: string): ProfileImport {
  if (text.length > MAX_PROFILE_BYTES)
    return { ok: false, errors: ['fichier trop volumineux (256 Ko maximum)'] };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['le fichier n’est pas un JSON valide'] };
  }
  return parseProfile(json);
}

export function loadStoredProfile(): ConformityProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return UDBL_TFC_PROFILE;
    const parsed = fromJsonText(raw);
    return parsed.ok ? parsed.profile : UDBL_TFC_PROFILE;
  } catch {
    return UDBL_TFC_PROFILE;
  }
}

export async function importProfileFile(file: File): Promise<ProfileImport> {
  if (file.size > MAX_PROFILE_BYTES)
    return { ok: false, errors: ['fichier trop volumineux (256 Ko maximum)'] };
  const text = await file.text();
  const result = fromJsonText(text);
  if (result.ok) {
    try {
      window.localStorage.setItem(STORAGE_KEY, text);
    } catch {
      // Not remembered across reloads; the profile still applies to this session.
    }
  }
  return result;
}

export function forgetStoredProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing stored, or storage unavailable: either way nothing to forget.
  }
}

/** The active profile as a JSON file, to share it or to start a new one from it. */
export function profileAsJson(profile: ConformityProfile): string {
  return JSON.stringify(profile, null, 2);
}
