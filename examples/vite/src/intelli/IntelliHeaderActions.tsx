// IntelliEditor's two header controls: « Nouveau TFC » and the conformity badge that opens
// the panel. The badge shows the live level (🟢🟠🔴) so the status is visible even with the
// panel closed — the "notification" the specification asks for.

import { useState } from 'react';
import { useDocxEditor } from '@docx-editor.dev/react';
import { DEMO_SECONDARY_BUTTON, keepCaret } from '../demoButtons';
import { useConformity } from './ConformityContext';
import { LEVEL_LABEL, TEXT } from './labels';
import { NewTfcDialog } from './NewTfcDialog';

interface IntelliHeaderActionsProps {
  readonly panelOpen: boolean;
  readonly onTogglePanel: () => void;
  readonly onTitleChange: (title: string) => void;
}

export function IntelliHeaderActions({
  panelOpen,
  onTogglePanel,
  onTitleChange,
}: IntelliHeaderActionsProps) {
  const editor = useDocxEditor();
  const { report, profile, documentLoaded } = useConformity();
  const [creating, setCreating] = useState(false);
  const level = report?.summary.level ?? 'pending';

  return (
    <>
      <button
        type="button"
        style={DEMO_SECONDARY_BUTTON}
        disabled={!editor}
        onMouseDown={keepCaret}
        onClick={() => setCreating(true)}
      >
        {TEXT.newTfc}
      </button>
      <button
        type="button"
        className="intelli-badge"
        data-level={level}
        aria-pressed={panelOpen}
        title={TEXT.open}
        onMouseDown={keepCaret}
        onClick={onTogglePanel}
      >
        <span className="intelli-status__dot" aria-hidden="true" />
        {report
          ? `${LEVEL_LABEL[report.summary.level]} · ${report.summary.score}`
          : TEXT.panelTitle}
      </button>
      {creating ? (
        <NewTfcDialog
          profile={profile}
          onClose={() => setCreating(false)}
          onCreate={(bytes, title) => {
            editor?.load(bytes);
            onTitleChange(title);
            documentLoaded();
            setCreating(false);
          }}
        />
      ) : null}
    </>
  );
}
