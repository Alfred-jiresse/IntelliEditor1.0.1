// Page numbers for the generated table of contents and lists, computed with the EDITOR'S own
// layout engine: HarfBuzz shaping over Liberation Serif (metric-compatible with Times New
// Roman), real image extents, per-section numbering formats. Dev tool for `make-samples`.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openTreeSession } from '../../../core/src/binding/tree-session.ts';
import { createHeadlessImageDecodePort } from '../../../core/src/editor/browser-image-decode-port.ts';
import {
  createFixedMeasurer,
  createFontResourceSnapshot,
  createHarfBuzzTextShaper,
  createShapedMeasurer,
  FontResolutionError,
  HARFBUZZ_SHAPING_LIBRARY,
  harfBuzzFontValidator,
  initializeHarfBuzz,
  layoutSemanticDocument,
  sha256FontBytes,
  type FontRequest,
  type ResolvedFont,
} from '../../../core/src/layout/index.ts';
import { createInlineDrawingLayoutBundle } from '../../../core/src/layout/inline-drawing-source.ts';
import { buildStyleCascadeTable } from '../../../core/src/layout/style-cascade.ts';
import { readOoxmlPackage } from '../../../core/src/store/index.ts';
import type { Anchor } from '../../src/template/body-builder.ts';

const FONTS = join(import.meta.dir, '../../../fonts/assets');
const FAMILY = 'Times New Roman';
const FACES = [
  ['LiberationSerif-Regular.ttf', 400, 'normal'],
  ['LiberationSerif-Bold.ttf', 700, 'normal'],
  ['LiberationSerif-Italic.ttf', 400, 'italic'],
  ['LiberationSerif-BoldItalic.ttf', 700, 'italic'],
] as const;

const ROMAN: readonly [number, string][] = [
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
];
function lowerRoman(n: number): string {
  let out = '';
  for (const [value, digits] of ROMAN) while (n >= value) ((out += digits), (n -= value));
  return out;
}

async function measurer() {
  await initializeHarfBuzz();
  const snapshot = createFontResourceSnapshot({
    epoch: 1,
    maxFontBytes: 4_000_000,
    resources: FACES.map(([file, weight, style]) => {
      const bytes = new Uint8Array(readFileSync(join(FONTS, file)));
      return {
        request: { family: FAMILY, weight, style },
        id: file,
        bytes,
        hash: sha256FontBytes(bytes),
        faceIndex: 0,
      };
    }),
    validateFont: harfBuzzFontValidator,
  });
  const resolveFont = (style: { bold: boolean; italic: boolean }): ResolvedFont | null => {
    const request: FontRequest = {
      family: FAMILY,
      weight: style.bold ? 700 : 400,
      style: style.italic ? 'italic' : 'normal',
    };
    const font = snapshot.resolve(request);
    return font instanceof FontResolutionError ? null : font;
  };
  return createShapedMeasurer({
    shaper: createHarfBuzzTextShaper(),
    resolveFont,
    fallback: createFixedMeasurer(6, 14),
    shapingLibrary: HARFBUZZ_SHAPING_LIBRARY,
    unicodeDataVersion: '15.1',
  });
}

/** Displayed page label ("iv", "12") of every anchored paragraph. */
export async function pageLabels(
  bytes: Uint8Array,
  anchors: readonly Anchor[]
): Promise<Map<string, string>> {
  const opened = openTreeSession(bytes);
  if (!opened.ok) throw new Error(`document illisible : ${opened.reason}`);
  const session = opened.session;
  const pkg = readOoxmlPackage(bytes);
  if (!pkg.ok) throw new Error(pkg.reason);
  const styles = pkg.package.parts.get('/word/styles.xml');
  const drawings = createInlineDrawingLayoutBundle({
    session,
    decodePort: createHeadlessImageDecodePort(),
    onResourcesChanged: () => {},
  });
  const layout = layoutSemanticDocument(session.part(), 1, {
    measurer: await measurer(),
    ...(styles ? { styleCascade: buildStyleCascadeTable(styles.root) } : {}),
    inlineDrawingLayout: drawings.bodyContext,
  });

  const pageOf = new Map<string, number>();
  layout.pages.forEach((page, index) => {
    for (const fragment of page.fragments) {
      if (fragment.kind === 'paragraph' && !pageOf.has(fragment.paragraphId))
        pageOf.set(fragment.paragraphId, index);
    }
  });
  const labels = new Map<string, string>();
  for (const anchor of anchors) {
    const index = pageOf.get(`/word/document.xml#0.0.${anchor.bodyIndex}`);
    if (index === undefined) continue;
    const source = layout.pages[index]!.pageFieldSource;
    if (!source) continue;
    labels.set(
      anchor.key,
      source.format === 'lowerRoman' ? lowerRoman(source.pageNumber) : String(source.pageNumber)
    );
  }
  return labels;
}
