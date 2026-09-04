import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDocumentOutline } from '../editor/navigation/useDocumentOutline';
import { useFontFamily } from '../editor/toolbar/FontFamily';
import { usePageSetup } from '../editor/usePageSetup';
import { useDocxEditor } from '../editor/context';
import { useEditorState } from '../editor/useEditorState';

type RulesShape = {
  pageSetup?: any;
  typography?: any;
  validation?: { checks?: Record<string, any> };
  autoFormat?: any;
  documentStructure?: any;
  requiredSections?: string[];
  allowedFonts?: string[];
  margins_mm?: { top?: number; bottom?: number; left?: number; right?: number };
  [key: string]: any;
};

function mmToTwips(mm: number): number {
  // 1 inch = 1440 twips, 1 inch = 25.4 mm
  return Math.round((1440 * mm) / 25.4);
}

export function RulesPanel({ className }: { className?: string }) {
  const outline = useDocumentOutline();
  const fonts = useFontFamily();
  const { pageSetup } = usePageSetup();
  const editor = useDocxEditor();

  const [rules, setRules] = useState<RulesShape | null>(() => {
    try {
      const raw = localStorage.getItem('intelli:rules');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    // When no rules are present, do nothing. If rules change externally, keep them in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'intelli:rules') {
        try {
          setRules(e.newValue ? JSON.parse(e.newValue) : null);
        } catch (err) {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const snapshot = useEditorState((s) => s);

  const diagnostics = useMemo(() => {
    if (!rules) return { total: 0, violations: [] as { message: string; severity: string; id?: string }[] };
    const violations: { message: string; severity: string; id?: string }[] = [];
    let total = 0;

    const checks = rules.validation?.checks ?? {};

    // Helper to push violation by severity
    const pushViolation = (id: string, severity: string, message: string) => {
      violations.push({ id, severity, message });
    };

    // FONT FAMILY check
    if (checks.fontFamily?.enabled) {
      total += 1;
      const expected = String(checks.fontFamily.expected ?? rules.typography?.body?.fontFamily ?? '').toLowerCase();
      const docFonts = fonts.options.map((f) => (f ?? '').toLowerCase());
      const has = expected && docFonts.some((f) => f === expected);
      if (!has) pushViolation('fontFamily', checks.fontFamily.severity ?? 'error', checks.fontFamily.message ?? `Expected font ${expected}`);
    }

    // FONT SIZE check
    if (checks.fontSize?.enabled) {
      total += 1;
      const expected = checks.fontSize.expected;
      // try to read from snapshot.formatting
      const currentSize = snapshot?.formatting?.fontSizePt ?? snapshot?.formatting?.fontSize ?? null;
      if (typeof currentSize === 'number') {
        if (currentSize !== expected) pushViolation('fontSize', checks.fontSize.severity ?? 'error', checks.fontSize.message ?? `Expected font size ${expected}pt`);
      } else {
        pushViolation('fontSize', 'info', 'Font size check not verifiable yet');
      }
    }

    // LINE SPACING check
    if (checks.lineSpacing?.enabled) {
      total += 1;
      const expected = checks.lineSpacing.expected;
      const currentSpacing = snapshot?.formatting?.lineSpacing ?? null;
      if (typeof currentSpacing === 'number') {
        if (Math.abs(currentSpacing - expected) > 0.001) pushViolation('lineSpacing', checks.lineSpacing.severity ?? 'warning', checks.lineSpacing.message ?? `Expected line spacing ${expected}`);
      } else {
        pushViolation('lineSpacing', 'info', 'Line spacing check not verifiable yet');
      }
    }

    // MARGINS
    if (checks.margins?.enabled && pageSetup) {
      total += 1;
      const expected = checks.margins.expected ?? rules.pageSetup?.margins ?? rules.margins_mm;
      if (expected) {
        const errs: string[] = [];
        const { marginTop, marginRight, marginBottom, marginLeft } = pageSetup;
        const unit = checks.margins.unit ?? 'cm';
        const conv = (val: number) => mmToTwips(unit === 'cm' ? val * 10 : val);
        if (typeof expected.top === 'number') {
          if (Math.abs(marginTop - conv(expected.top)) > 48) errs.push('top');
        }
        if (typeof expected.bottom === 'number') {
          if (Math.abs(marginBottom - conv(expected.bottom)) > 48) errs.push('bottom');
        }
        if (typeof expected.left === 'number') {
          if (Math.abs(marginLeft - conv(expected.left)) > 48) errs.push('left');
        }
        if (typeof expected.right === 'number') {
          if (Math.abs(marginRight - conv(expected.right)) > 48) errs.push('right');
        }
        if (errs.length) pushViolation('margins', checks.margins.severity ?? 'error', checks.margins.message ?? `Margins differ: ${errs.join(', ')}`);
      }
    }

    // Heading existence / structure (documentStructure required parts)
    if (rules.documentStructure?.liminaire?.required && Array.isArray(rules.documentStructure.liminaire.required)) {
      const requiredItems = rules.documentStructure.liminaire.required.filter((r: any) => r.required);
      total += requiredItems.length;
      const headings = outline.headings.map((h) => (h?.text ?? '').toLowerCase());
      for (const item of requiredItems) {
        const want = (item.name ?? item.id ?? '').toLowerCase();
        if (want && !headings.some((h) => h.indexOf(want) !== -1)) {
          pushViolation(`doc_${item.id}`, 'warning', `Missing required document element: ${item.name || item.id}`);
        }
      }
    }

    // Bibliography count
    if (checks.bibliographyCount?.enabled) {
      total += 1;
      const min = checks.bibliographyCount.minSources ?? checks.bibliographyCount.minSources ?? rules.bibliography?.minimumSources?.value;
      // try snapshot or editor API — not implemented: mark as info
      if (typeof min === 'number') pushViolation('bibliographyCount', 'info', `Bibliography count check requires document references count (not implemented). Requires ≥ ${min}`);
    }

    // Other checks that require richer inspection - mark as info
    const otherChecks = ['headingFormat', 'tableNumbering', 'figureNumbering', 'equationNumbering', 'citationFormat', 'plagiarism', 'introductionLength', 'chapterCount', 'chapterLength'];
    for (const key of otherChecks) {
      if (checks[key]?.enabled) {
        total += 1;
        pushViolation(key, 'info', checks[key].message ?? `${key} check enabled but not yet verifiable`);
      }
    }

    return { total, violations };
  }, [rules, outline.headings, fonts.options, pageSetup, snapshot]);

  const status = useMemo(() => {
    if (!rules) return { level: 'none', text: 'No rules loaded' } as const;
    const { total, violations } = diagnostics;
    if (total === 0) return { level: 'none', text: 'No rules to check' } as const;
    const errorCount = violations.filter((v) => v.severity === 'error').length;
    const warnCount = violations.filter((v) => v.severity === 'warning').length;
    if (errorCount === 0 && warnCount === 0) return { level: 'good', text: 'Règles respectées' } as const;
    if (errorCount === 0 && warnCount > 0) return { level: 'warn', text: 'Partiellement respecté' } as const;
    return { level: 'bad', text: 'Document non conforme' } as const;
  }, [rules, diagnostics]);

  const clearRules = useCallback(() => {
    localStorage.removeItem('intelli:rules');
    setRules(null);
  }, []);

  return (
    <aside
      aria-live="polite"
      className={`docx-rules-panel ${className ?? ''}`}
      style={{
        width: 320,
        minWidth: 280,
        borderLeft: '1px solid var(--doc-border)',
        padding: 12,
        boxSizing: 'border-box',
        background: 'var(--doc-surface)',
        position: 'relative',
      }}
    >
      <h3 style={{ marginTop: 0 }}>Conformité — Règles universitaires</h3>
      <div style={{ marginBottom: 8 }}>
        <strong>Status: </strong>
        <span
          style={{
            color: status.level === 'good' ? 'green' : status.level === 'warn' ? '#b77900' : status.level === 'bad' ? 'red' : 'inherit',
            fontWeight: 600,
          }}
        >
          {status.text}
        </span>
      </div>

      {!rules && (
        <div style={{ color: 'var(--doc-muted)' }}>Aucune règle chargée. Utilisez "Upload Rules" pour importer un fichier JSON.</div>
      )}

      {rules && (
        <div style={{ fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>
            <strong>Règles chargées</strong>
            <div style={{ marginTop: 6 }}>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 160, overflow: 'auto' }}>{JSON.stringify(rules, null, 2)}</pre>
            </div>
          </div>

          <div>
            <strong>Diagnostics</strong>
            <ul>
              {diagnostics.total === 0 && <li>Aucune règle vérifiable trouvée</li>}
              {diagnostics.violations.map((v, i) => (
                <li key={i} style={{ color: v.severity === 'error' ? 'red' : v.severity === 'warning' ? '#b77900' : 'var(--doc-text)' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{v.severity}</strong>: {v.message}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={clearRules} style={{ marginRight: 8 }}>
              Clear rules
            </button>
            <button
              type="button"
              onClick={() => {
                if (!rules) return;
                const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'university-rules.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download rules
            </button>
          </div>
        </div>
      )}

      <style>{`
        .docx-rules-panel pre { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Segoe UI Mono", monospace; font-size: 12px; }
      `}</style>
    </aside>
  );
}

export function processRulesFile(file: File): Promise<RulesShape> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result ?? '')) as RulesShape;
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    };
    r.onerror = () => reject(new Error('File read error'));
    r.readAsText(file);
  });
}

export default RulesPanel;
