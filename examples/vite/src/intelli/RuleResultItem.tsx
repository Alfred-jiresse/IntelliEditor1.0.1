// One rule in the conformity panel: status, title, the norm's wording, and its findings.
// A finding with a location jumps to it; a finding with a fix offers to apply it.

import { useState } from 'react';
import type { Finding, RuleResult } from '@intellieditor/conformity';
import { SEVERITY_LABEL, TEXT } from './labels';

interface RuleResultItemProps {
  readonly result: RuleResult;
  readonly onGoTo: (finding: Finding) => void;
  readonly onFix: (finding: Finding) => void;
}

const STATUS_ICON = { pass: '✓', fail: '!', skip: '–' } as const;

export function RuleResultItem({ result, onGoTo, onFix }: RuleResultItemProps) {
  const [open, setOpen] = useState(result.status === 'fail');
  const tone = result.status === 'fail' ? result.severity : result.status;
  const detail =
    result.status === 'skip' ? `${TEXT.notVerifiable} : ${result.reason}` : result.summary;

  return (
    <li className="intelli-rule" data-tone={tone}>
      <button
        type="button"
        className="intelli-rule__head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="intelli-rule__icon" aria-hidden="true">
          {STATUS_ICON[result.status]}
        </span>
        <span className="intelli-rule__title">{result.title}</span>
        {result.status === 'fail' ? (
          <span className="intelli-rule__badge">
            {result.findings.length > 1 ? result.findings.length : SEVERITY_LABEL[result.severity]}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="intelli-rule__body">
          <p className="intelli-rule__reference">{result.reference}</p>
          {detail ? <p className="intelli-rule__detail">{detail}</p> : null}
          {result.findings.length > 0 ? (
            <ul className="intelli-findings">
              {result.findings.map((finding, i) => (
                <li key={i} className="intelli-finding">
                  {finding.location ? (
                    <button
                      type="button"
                      className="intelli-finding__text intelli-finding__text--link"
                      title={TEXT.goTo}
                      onClick={() => onGoTo(finding)}
                    >
                      {finding.message}
                    </button>
                  ) : (
                    <span className="intelli-finding__text">{finding.message}</span>
                  )}
                  {finding.fix ? (
                    <button
                      type="button"
                      className="intelli-finding__fix"
                      onClick={() => onFix(finding)}
                    >
                      {finding.fix.label}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
