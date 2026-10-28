// « Règles… » — the norm the document is checked against, and how to replace it.
//
// An institution changes the norm without touching the code: download the current rules as a
// commented .txt file, edit it, import it back. Every problem in the file is shown with its
// line number; a file that does not validate changes nothing.

import { useRef, useState } from 'react';
import { ALL_RULES } from '@intellieditor/conformity';
import { useConformity } from './ConformityContext';
import { RULES_TEXT as T } from './labels';
import { downloadText, profileAsRulesText, type ProfileImport } from './profile-store';

const MAX_SHOWN = 12;

function Messages({
  title,
  items,
  tone,
}: {
  title: string;
  items: readonly string[];
  tone: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={`intelli-rules__messages intelli-rules__messages--${tone}`} role="status">
      <p className="intelli-rules__messages-title">{title}</p>
      <ul>
        {items.slice(0, MAX_SHOWN).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
        {items.length > MAX_SHOWN ? <li>{T.more(items.length - MAX_SHOWN)}</li> : null}
      </ul>
    </div>
  );
}

export function RulesDialog({ onClose }: { readonly onClose: () => void }) {
  const { profile, importProfile, resetProfile } = useConformity();
  const [result, setResult] = useState<ProfileImport | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const disabled = Object.values(profile.rules).filter((rule) => rule.enabled === false).length;

  return (
    <div
      className="intelli-dialog__backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="intelli-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intelli-rules"
      >
        <h2 id="intelli-rules" className="intelli-dialog__title">
          {T.title}
        </h2>
        <p className="intelli-dialog__intro">{T.intro}</p>

        <dl className="intelli-rules__current">
          <dt>{T.current}</dt>
          <dd>{profile.name}</dd>
          <dt>{T.institution}</dt>
          <dd>{profile.institution}</dd>
          <dt>{T.content}</dt>
          <dd>{T.counts(ALL_RULES.length - disabled, profile.customRules.length)}</dd>
        </dl>
        {profile.customRules.length > 0 ? (
          <ul className="intelli-rules__custom">
            {profile.customRules.map((rule) => (
              <li key={rule.id}>{rule.title}</li>
            ))}
          </ul>
        ) : null}

        <ol className="intelli-rules__steps">
          <li>{T.step1}</li>
          <li>{T.step2}</li>
          <li>{T.step3}</li>
        </ol>

        {result && !result.ok ? (
          <Messages title={T.refused} items={result.errors} tone="error" />
        ) : null}
        {result?.ok ? (
          <p className="intelli-rules__success" role="status">
            {T.loaded(result.profile.name)}
          </p>
        ) : null}
        {result ? <Messages title={T.warnings} items={result.warnings} tone="warning" /> : null}

        <div className="intelli-dialog__actions intelli-rules__actions">
          <button
            type="button"
            className="intelli-button"
            onClick={() => downloadText(`regles-${profile.id}.txt`, profileAsRulesText(profile))}
          >
            {T.download}
          </button>
          <button
            type="button"
            className="intelli-button"
            onClick={() => {
              resetProfile();
              setResult(null);
            }}
          >
            {T.reset}
          </button>
          <button
            type="button"
            className="intelli-button intelli-button--primary"
            onClick={() => input.current?.click()}
          >
            {T.import}
          </button>
          <button type="button" className="intelli-button" onClick={onClose}>
            {T.close}
          </button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".txt,text/plain,.json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void importProfile(file).then(setResult);
          }}
        />
      </div>
    </div>
  );
}
