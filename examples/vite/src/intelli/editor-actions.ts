// The two places the conformity panel reaches INTO the editor: going to a finding, and
// applying a fix. Both go through the public `Editor` contract — find/select/scroll and
// `exec` — so the engine stays read-only and every correction is one undoable step.

import type { Editor } from '@docx-editor.dev/core/contracts/editor';
import type { FindingLocation, FixSuggestion } from '@intellieditor/conformity';

/** Search keys from most to least specific: a long prefix first, then shorter ones. */
function searchKeys(text: string): string[] {
  const words = text.split(' ').filter(Boolean);
  const keys = [
    words.slice(0, 8).join(' '),
    words.slice(0, 4).join(' '),
    words.slice(0, 2).join(' '),
  ];
  return [...new Set(keys.filter((key) => key.length >= 3))];
}

/**
 * Put the caret on the paragraph a finding points at and scroll it into view.
 *
 * The finding carries the paragraph's body ordinal and text; the editor's find results carry
 * the same ordinal (`paragraphIndex`), so among the matches for the text the right one is the
 * one at that ordinal — or the nearest, if the document moved since the analysis.
 */
export function goToFinding(editor: Editor, location: FindingLocation): boolean {
  for (const key of searchKeys(location.text)) {
    const matches = editor.findMatches(key, { matchCase: true });
    if (matches.length === 0) continue;
    const best = matches.reduce((a, b) =>
      Math.abs(b.paragraphIndex - location.paragraphIndex) <
      Math.abs(a.paragraphIndex - location.paragraphIndex)
        ? b
        : a
    );
    editor.selectMatch(best);
    editor.scrollToBlock(best.blockId);
    editor.focus();
    return true;
  }
  return false;
}

/** Apply a described correction. Returns whether the editor accepted it. */
export function applyFix(editor: Editor, fix: FixSuggestion): boolean {
  switch (fix.kind) {
    case 'set-page-margins': {
      const m = fix.marginsTwips;
      return editor.exec({
        type: 'setPageSetup',
        marginTop: m.top,
        marginRight: m.right,
        marginBottom: m.bottom,
        marginLeft: m.left,
        scope: 'document',
      }).ok;
    }
  }
}
