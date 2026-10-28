// The conformity side panel: overall status 🟢🟠🔴, score, and the rules grouped by area.
//
// Presentation only. The report comes from `ConformityContext`; going to a finding and
// applying a fix go through `editor-actions`. Chrome buttons keep the caret (mousedown is
// prevented) so clicking the panel never moves the student's cursor by accident.

import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { useDocxEditor } from '@docx-editor.dev/react';
import type { Finding, RuleCategory, RuleResult } from '@intellieditor/conformity';
import { useConformity } from './ConformityContext';
import { applyFix, goToFinding } from './editor-actions';
import { CATEGORY_LABEL, LEVEL_LABEL, TEXT } from './labels';
import { downloadText, profileAsRulesText } from './profile-store';
import { RuleResultItem } from './RuleResultItem';

type Filter = 'to-fix' | 'all';

const keepCaret = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) event.preventDefault();
};

function groupByCategory(results: readonly RuleResult[]): [RuleCategory, RuleResult[]][] {
  const groups = new Map<RuleCategory, RuleResult[]>();
  for (const result of results)
    groups.set(result.category, [...(groups.get(result.category) ?? []), result]);
  return [...groups];
}

export function ConformityPanel({ onClose }: { readonly onClose: () => void }) {
  const editor = useDocxEditor();
  const { report, status, error, analyzedAt, profile, refresh, importProfile, resetProfile } =
    useConformity();
  const [filter, setFilter] = useState<Filter>('to-fix');
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const visible = useMemo(() => {
    const results = report?.results ?? [];
    return filter === 'to-fix' ? results.filter((r) => r.status === 'fail') : results;
  }, [report, filter]);

  const goTo = (finding: Finding) => {
    if (!editor || !finding.location) return;
    if (!goToFinding(editor, finding.location))
      setNotice('Passage introuvable : le texte a peut-être changé depuis l’analyse.');
  };
  const fix = (finding: Finding) => {
    if (!editor || !finding.fix) return;
    setNotice(
      applyFix(editor, finding.fix)
        ? `« ${finding.fix.label} » appliqué.`
        : 'L’éditeur a refusé la correction.'
    );
    refresh();
  };

  const summary = report?.summary;
  return (
    <aside className="intelli-panel" aria-label={TEXT.panelTitle} onMouseDown={keepCaret}>
      <header className="intelli-panel__header">
        <div className="intelli-panel__title-row">
          <h2 className="intelli-panel__title">{TEXT.panelTitle}</h2>
          <button
            type="button"
            className="intelli-icon-button"
            aria-label={TEXT.close}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="intelli-status" data-level={summary?.level ?? 'pending'}>
          <span className="intelli-status__dot" aria-hidden="true" />
          <span className="intelli-status__label">
            {summary ? LEVEL_LABEL[summary.level] : TEXT.noReport}
          </span>
          {summary ? <span className="intelli-status__score">{summary.score}/100</span> : null}
        </div>
        {summary ? (
          <p className="intelli-panel__meta">
            {TEXT.summary(summary.passed, summary.failed, summary.skipped)}
          </p>
        ) : null}
        <div className="intelli-panel__actions">
          <button
            type="button"
            className="intelli-button intelli-button--primary"
            onClick={refresh}
            disabled={status === 'running'}
          >
            {status === 'running' ? TEXT.checking : TEXT.check}
          </button>
          {analyzedAt ? (
            <span className="intelli-panel__time">{TEXT.analyzedAt(analyzedAt)}</span>
          ) : null}
        </div>
        {error ? (
          <p className="intelli-panel__error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="intelli-panel__notice" role="status" onClick={() => setNotice(null)}>
            {notice}
          </p>
        ) : null}
      </header>

      <div className="intelli-tabs" role="tablist">
        {(['to-fix', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            className="intelli-tab"
            onClick={() => setFilter(value)}
          >
            {value === 'to-fix'
              ? `${TEXT.toFix} (${summary?.failed ?? 0})`
              : `${TEXT.all} (${report?.results.length ?? 0})`}
          </button>
        ))}
      </div>

      <div className="intelli-panel__content">
        {report && visible.length === 0 ? (
          <p className="intelli-panel__empty">{TEXT.allGood}</p>
        ) : null}
        {groupByCategory(visible).map(([category, results]) => (
          <section key={category} className="intelli-group">
            <h3 className="intelli-group__title">{CATEGORY_LABEL[category]}</h3>
            <ul className="intelli-rules">
              {results.map((result) => (
                <RuleResultItem key={result.id} result={result} onGoTo={goTo} onFix={fix} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="intelli-panel__footer">
        <div className="intelli-panel__profile" title={profile.source}>
          <span className="intelli-panel__profile-label">{TEXT.profile}</span>
          <span className="intelli-panel__profile-name">{profile.name}</span>
        </div>
        <div className="intelli-panel__profile-actions">
          <button type="button" className="intelli-link" onClick={() => fileInput.current?.click()}>
            {TEXT.importProfile}
          </button>
          <button
            type="button"
            className="intelli-link"
            onClick={() => downloadText(`regles-${profile.id}.txt`, profileAsRulesText(profile))}
          >
            {TEXT.exportProfile}
          </button>
          <button type="button" className="intelli-link" onClick={resetProfile}>
            {TEXT.resetProfile}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,text/plain,.json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void importProfile(file).then((result) =>
              setNotice(
                result.ok
                  ? `Règles « ${result.profile.name} » chargées.`
                  : `Fichier refusé : ${result.errors.slice(0, 3).join(' ; ')}${result.errors.length > 3 ? ' …' : ''}`
              )
            );
          }}
        />
      </footer>
    </aside>
  );
}
