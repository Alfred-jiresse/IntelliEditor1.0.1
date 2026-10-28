// The active norm profile: the built-in UDBL one, or a rules file the user imported — plain
// text (.txt) or JSON.
//
// The imported file is remembered in this browser only (a per-viewer convenience), as the text
// the user gave, and is re-validated through `parseRulesFile` every time it is read back —
// storage is as untrusted as the file it came from. Every storage access is guarded: a private
// window or blocked site data simply means "no remembered profile".

import {
  parseRulesFile,
  profileToRulesText,
  UDBL_TFC_PROFILE,
  type ConformityProfile,
} from '@intellieditor/conformity';

const STORAGE_KEY = 'intellieditor:profile:v1';
const MAX_PROFILE_BYTES = 256 * 1024;

export type ProfileImport =
  | { readonly ok: true; readonly profile: ConformityProfile; readonly warnings: readonly string[] }
  | {
      readonly ok: false;
      readonly errors: readonly string[];
      readonly warnings: readonly string[];
    };

function fromText(text: string): ProfileImport {
  if (text.length > MAX_PROFILE_BYTES)
    return { ok: false, errors: ['fichier trop volumineux (256 Ko maximum)'], warnings: [] };
  return parseRulesFile(text);
}

export function loadStoredProfile(): ConformityProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return UDBL_TFC_PROFILE;
    const parsed = fromText(raw);
    return parsed.ok ? parsed.profile : UDBL_TFC_PROFILE;
  } catch {
    return UDBL_TFC_PROFILE;
  }
}

export async function importProfileFile(file: File): Promise<ProfileImport> {
  if (file.size > MAX_PROFILE_BYTES)
    return { ok: false, errors: ['fichier trop volumineux (256 Ko maximum)'], warnings: [] };
  const text = await file.text();
  const result = fromText(text);
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

/** The active profile as a commented .txt rules file: the template an institution edits. */
export function profileAsRulesText(profile: ConformityProfile): string {
  return profileToRulesText(profile);
}

/** Offer `text` as a file download (UTF-8 with BOM, so Windows Notepad shows the accents). */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
