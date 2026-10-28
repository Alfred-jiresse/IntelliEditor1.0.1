// The path the app runs: the editor SAVES the document, the engine reads those bytes.
// The editor re-serializes every part (its own prefixes, paragraph ids…), so a report on the
// saved bytes must match the report on the original — otherwise the panel would judge a
// different document than the one on screen.

import { describe, expect, test } from 'bun:test';
import { openTreeSession } from '@docx-editor.dev/core/binding';
import { checkDocx } from '../engine.ts';
import { createTfcTemplate } from '../template/tfc-template.ts';

function failing(bytes: Uint8Array): string[] {
  const run = checkDocx(bytes);
  if (!run.ok) throw new Error(run.reason);
  return run.report.results.filter((r) => r.status === 'fail').map((r) => r.id);
}

describe('engine ↔ editor round trip', () => {
  test('the template judged after an editor save gives the same verdict', () => {
    const original = createTfcTemplate();
    const session = openTreeSession(original);
    if (!session.ok) throw new Error(session.reason);
    const saved = session.session.save();
    expect(failing(saved)).toEqual(failing(original));
  });
});
