// The style cascade, reduced to the properties a thesis norm checks.
//
// Word resolves a run's formatting as: document defaults → paragraph style chain (basedOn,
// root first) → character style chain → direct formatting. A norm checker that read only
// direct formatting would call a document written entirely through a "Normal" style set to
// Times New Roman non-conforming — so this resolves the same chain Word does, for the few
// properties that matter here.

import {
  attr,
  child,
  childVal,
  children,
  descendants,
  intAttr,
  onOff,
  type Element,
} from '../xml/element.ts';

export interface RunProps {
  readonly font?: string;
  readonly sizeHalfPoints?: number;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly caps?: boolean;
}

export interface ParagraphProps {
  readonly jc?: string;
  readonly line?: number;
  readonly lineRule?: string;
  readonly outlineLevel?: number;
  readonly pageBreakBefore?: boolean;
}

interface StyleRecord {
  readonly id: string;
  readonly type: string;
  readonly name: string | null;
  readonly basedOn: string | null;
  readonly paragraph: ParagraphProps;
  readonly run: RunProps;
}

/** Word's own fallback when nothing in the file sets a size: 10 pt. */
const DEFAULT_SIZE_HALF_POINTS = 20;
const MAX_BASED_ON_DEPTH = 32;

function themeFonts(theme: Element | null): { major?: string; minor?: string } {
  if (!theme) return {};
  const scheme = descendants(theme, 'a:fontScheme')[0];
  const latin = (name: string) => attr(child(child(scheme, name), 'a:latin'), 'typeface');
  return { major: latin('a:majorFont'), minor: latin('a:minorFont') };
}

export function readRunProps(
  rPr: Element | undefined,
  theme: { major?: string; minor?: string }
): RunProps {
  if (!rPr) return {};
  const fonts = child(rPr, 'w:rFonts');
  const themeSlot = attr(fonts, 'w:asciiTheme') ?? attr(fonts, 'w:hAnsiTheme');
  const fromTheme = themeSlot
    ? themeSlot.startsWith('major')
      ? theme.major
      : theme.minor
    : undefined;
  const size = intAttr(child(rPr, 'w:sz'), 'w:val');
  return {
    font: attr(fonts, 'w:ascii') ?? attr(fonts, 'w:hAnsi') ?? fromTheme,
    sizeHalfPoints: size !== undefined && size > 0 ? size : undefined,
    bold: onOff(rPr, 'w:b'),
    italic: onOff(rPr, 'w:i'),
    caps: onOff(rPr, 'w:caps'),
  };
}

export function readParagraphProps(pPr: Element | undefined): ParagraphProps {
  if (!pPr) return {};
  const spacing = child(pPr, 'w:spacing');
  return {
    jc: childVal(pPr, 'w:jc'),
    line: intAttr(spacing, 'w:line'),
    lineRule: attr(spacing, 'w:lineRule'),
    outlineLevel: intAttr(child(pPr, 'w:outlineLvl'), 'w:val'),
    pageBreakBefore: onOff(pPr, 'w:pageBreakBefore'),
  };
}

/** Later layers win, property by property; `undefined` means "this layer is silent". */
function merge<T extends object>(...layers: readonly T[]): T {
  const out: Record<string, unknown> = {};
  for (const layer of layers) {
    for (const [key, value] of Object.entries(layer)) if (value !== undefined) out[key] = value;
  }
  return out as T;
}

export class StyleCascade {
  private readonly styles = new Map<string, StyleRecord>();
  private readonly defaultRun: RunProps;
  private readonly defaultParagraph: ParagraphProps;
  private readonly defaultParagraphStyle: string | null;
  readonly theme: { major?: string; minor?: string };

  constructor(stylesPart: Element | null, themePart: Element | null) {
    this.theme = themeFonts(themePart);
    const defaults = child(stylesPart ?? undefined, 'w:docDefaults');
    this.defaultRun = readRunProps(child(child(defaults, 'w:rPrDefault'), 'w:rPr'), this.theme);
    this.defaultParagraph = readParagraphProps(child(child(defaults, 'w:pPrDefault'), 'w:pPr'));
    let defaultParagraphStyle: string | null = null;
    for (const style of children(stylesPart ?? undefined, 'w:style')) {
      const id = attr(style, 'w:styleId');
      if (!id) continue;
      const type = attr(style, 'w:type') ?? 'paragraph';
      this.styles.set(id, {
        id,
        type,
        name: childVal(style, 'w:name') ?? null,
        basedOn: childVal(style, 'w:basedOn') ?? null,
        paragraph: readParagraphProps(child(style, 'w:pPr')),
        run: readRunProps(child(style, 'w:rPr'), this.theme),
      });
      // `w:default` is an attribute on `w:style` itself (not a child toggle).
      if (type === 'paragraph' && ['1', 'true', 'on'].includes(attr(style, 'w:default') ?? '')) {
        defaultParagraphStyle = id;
      }
    }
    this.defaultParagraphStyle = defaultParagraphStyle;
  }

  /** The style chain root first, cycle- and depth-safe (`basedOn` comes from the file). */
  private chain(styleId: string | null): StyleRecord[] {
    const out: StyleRecord[] = [];
    const seen = new Set<string>();
    let current = styleId ? this.styles.get(styleId) : undefined;
    while (current && !seen.has(current.id) && out.length < MAX_BASED_ON_DEPTH) {
      seen.add(current.id);
      out.unshift(current);
      current = current.basedOn ? this.styles.get(current.basedOn) : undefined;
    }
    return out;
  }

  /** The style a paragraph actually uses: its own, else the document's default paragraph style. */
  effectiveParagraphStyle(styleId: string | null): string | null {
    return styleId && this.styles.has(styleId) ? styleId : this.defaultParagraphStyle;
  }

  styleName(styleId: string | null): string | null {
    return styleId ? (this.styles.get(styleId)?.name ?? null) : null;
  }

  paragraphProps(styleId: string | null, direct: ParagraphProps): ParagraphProps {
    const layers = this.chain(this.effectiveParagraphStyle(styleId)).map((s) => s.paragraph);
    return merge(this.defaultParagraph, ...layers, direct);
  }

  runProps(
    paragraphStyleId: string | null,
    characterStyleId: string | null,
    direct: RunProps
  ): RunProps {
    const paragraphLayers = this.chain(this.effectiveParagraphStyle(paragraphStyleId)).map(
      (s) => s.run
    );
    const characterLayers = this.chain(characterStyleId).map((s) => s.run);
    const resolved = merge(this.defaultRun, ...paragraphLayers, ...characterLayers, direct);
    return { ...resolved, sizeHalfPoints: resolved.sizeHalfPoints ?? DEFAULT_SIZE_HALF_POINTS };
  }
}
