// Conformity state for the whole app: the active profile, the latest report, and the
// triggers that keep it current.
//
// One provider under `DocxEditor.Root`, read by the header badge and the side panel, so both
// always show the same report. Analysis is debounced after edits (the engine reads the saved
// bytes, so it runs on what Word would see) and stale runs are dropped: a slow analysis of an
// older revision can never overwrite a newer report.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDocxEditor, useEditorEvent } from '@docx-editor.dev/react';
import {
  checkDocx,
  UDBL_TFC_PROFILE,
  type ConformityProfile,
  type ConformityReport,
} from '@intellieditor/conformity';
import {
  forgetStoredProfile,
  importProfileFile,
  loadStoredProfile,
  type ProfileImport,
} from './profile-store';

const EDIT_DEBOUNCE_MS = 1200;
const LOAD_DELAY_MS = 400;
const MAX_MOUNT_RETRIES = 5;

export type AnalysisStatus = 'idle' | 'running' | 'ready' | 'error';

export interface ConformityState {
  readonly profile: ConformityProfile;
  readonly report: ConformityReport | null;
  readonly status: AnalysisStatus;
  readonly error: string | null;
  readonly analyzedAt: Date | null;
  /** Re-run now (the "Vérifier" button). */
  readonly refresh: () => void;
  /** Tell the analysis a new document was loaded (Open, New, Nouveau TFC). */
  readonly documentLoaded: () => void;
  readonly importProfile: (file: File) => Promise<ProfileImport>;
  readonly resetProfile: () => void;
}

const ConformityContext = createContext<ConformityState | null>(null);

export function ConformityProvider({ children }: { readonly children: ReactNode }) {
  const editor = useDocxEditor();
  const [profile, setProfile] = useState<ConformityProfile>(loadStoredProfile);
  const [report, setReport] = useState<ConformityReport | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const runId = useRef(0);
  const retries = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const analyze = useCallback(async () => {
    if (!editor) return;
    const id = ++runId.current;
    setStatus('running');
    try {
      const bytes = new Uint8Array(await editor.save());
      const run = checkDocx(bytes, profileRef.current);
      if (id !== runId.current) return; // a newer run started meanwhile
      if (run.ok) {
        setReport(run.report);
        setError(null);
        setStatus('ready');
      } else {
        setError(run.reason);
        setStatus('error');
      }
      setAnalyzedAt(new Date());
    } catch (cause) {
      if (id !== runId.current) return;
      // The surface may not have mounted the document yet: wait for it a few times quietly.
      if (retries.current < MAX_MOUNT_RETRIES) {
        retries.current += 1;
        setStatus('idle');
        timer.current = setTimeout(() => void analyzeRef.current(), LOAD_DELAY_MS * 2);
        return;
      }
      setError(cause instanceof Error ? cause.message : 'analyse impossible');
      setStatus('error');
    }
    retries.current = 0;
  }, [editor]);
  const analyzeRef = useRef(analyze);
  analyzeRef.current = analyze;

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void analyze(), delay);
    },
    [analyze]
  );

  useEffect(() => {
    schedule(LOAD_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [schedule]);

  // Re-check against the new profile as soon as it changes.
  useEffect(() => schedule(0), [profile, schedule]);

  useEditorEvent('change', () => schedule(EDIT_DEBOUNCE_MS));

  const value = useMemo<ConformityState>(
    () => ({
      profile,
      report,
      status,
      error,
      analyzedAt,
      refresh: () => schedule(0),
      documentLoaded: () => {
        setReport(null);
        schedule(LOAD_DELAY_MS);
      },
      importProfile: async (file) => {
        const result = await importProfileFile(file);
        if (result.ok) setProfile(result.profile);
        return result;
      },
      resetProfile: () => {
        forgetStoredProfile();
        setProfile(UDBL_TFC_PROFILE);
      },
    }),
    [profile, report, status, error, analyzedAt, schedule]
  );

  return <ConformityContext.Provider value={value}>{children}</ConformityContext.Provider>;
}

export function useConformity(): ConformityState {
  const state = useContext(ConformityContext);
  if (!state) throw new Error('useConformity must be used under <ConformityProvider>');
  return state;
}
