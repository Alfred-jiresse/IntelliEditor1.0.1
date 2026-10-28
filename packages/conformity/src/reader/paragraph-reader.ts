// One `w:p` → one ParagraphModel.
//
// Reads what is VISIBLE: inserted text counts, deleted and hidden text does not, and a
// field contributes its displayed result (which is exactly how a stale "Erreur ! Signet non
// défini." ends up on the page). Formatting is resolved through the style cascade per run
// and summarized by character count, so one bold word does not make a paragraph "bold".

import type {
  Alignment,
  LineSpacing,
  ParagraphModel,
  ParagraphRole,
  TextFormatting,
} from '../model/types.ts';
import { attr, child, childVal, isElement, onOff, type Element } from '../xml/element.ts';
import { readParagraphProps, readRunProps, type StyleCascade } from './styles.ts';

/** Containers whose runs are part of the paragraph's flow. `w:del` is deliberately absent. */
const RUN_CONTAINERS = new Set([
  'w:hyperlink',
  'w:ins',
  'w:smartTag',
  'w:customXml',
  'w:sdt',
  'w:sdtContent',
  'w:fldSimple',
  'w:moveTo',
  'w:bdo',
  'w:dir',
]);

export interface ParagraphReadResult {
  readonly paragraph: ParagraphModel;
  /** A page break follows the last visible text: the NEXT paragraph starts a page. */
  readonly endsWithPageBreak: boolean;
}

interface RunSlice {
  readonly length: number;
  readonly font: string | undefined;
  readonly sizePt: number;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly caps: boolean;
}

interface Accumulator {
  text: string;
  readonly slices: RunSlice[];
  readonly instructions: string[];
  hasDrawing: boolean;
  breakBeforeText: boolean;
  breakAfterText: boolean;
  /** Complex-field state: collecting an instruction until `separate`. */
  inInstruction: boolean;
  instruction: string;
}

function mapAlignment(jc: string | undefined): Alignment {
  switch (jc) {
    case undefined:
    case 'left':
    case 'start':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
    case 'end':
      return 'right';
    case 'both':
    case 'distribute':
      return 'justify';
    default:
      return 'other';
  }
}

function lineSpacing(line: number | undefined, rule: string | undefined): LineSpacing | null {
  if (line === undefined) return null;
  if (rule === 'exact' || rule === 'atLeast') return { kind: rule, points: line / 20 };
  return { kind: 'multiple', value: Math.round((line / 240) * 100) / 100 };
}

function headingLevelOf(
  styleId: string | null,
  styleName: string | null,
  outline: number | undefined
): number | null {
  if (outline !== undefined && outline >= 0 && outline < 9) return outline + 1;
  const match =
    /^(?:heading|titre)\s*([1-9])$/i.exec(styleName ?? '') ??
    /^(?:heading|titre)([1-9])$/i.exec(styleId ?? '');
  return match ? Number(match[1]) : null;
}

function summarize(slices: readonly RunSlice[]): TextFormatting {
  const fonts = new Map<string, number>();
  const sizes = new Map<number, number>();
  let bold = slices.length > 0;
  let italic = slices.length > 0;
  let caps = slices.length > 0;
  for (const slice of slices) {
    if (slice.font) fonts.set(slice.font, (fonts.get(slice.font) ?? 0) + slice.length);
    sizes.set(slice.sizePt, (sizes.get(slice.sizePt) ?? 0) + slice.length);
    bold &&= slice.bold;
    italic &&= slice.italic;
    caps &&= slice.caps;
  }
  const byWeight = <K>(map: Map<K, number>) =>
    [...map].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  return { fonts: byWeight(fonts), sizesPt: byWeight(sizes), bold, italic, caps };
}

export class ParagraphReader {
  constructor(private readonly cascade: StyleCascade) {}

  read(p: Element, index: number, sectionIndex: number): ParagraphReadResult {
    const pPr = child(p, 'w:pPr');
    const styleId = childVal(pPr, 'w:pStyle') ?? null;
    const effectiveStyle = this.cascade.effectiveParagraphStyle(styleId);
    const styleName = this.cascade.styleName(effectiveStyle);
    const props = this.cascade.paragraphProps(styleId, readParagraphProps(pPr));

    const acc: Accumulator = {
      text: '',
      slices: [],
      instructions: [],
      hasDrawing: false,
      breakBeforeText: false,
      breakAfterText: false,
      inInstruction: false,
      instruction: '',
    };
    this.walk(p, effectiveStyle, acc);

    const text = acc.text.replace(/\s+/g, ' ').trim();
    const headingLevel = text
      ? headingLevelOf(effectiveStyle, styleName, props.outlineLevel)
      : null;
    const paragraph: ParagraphModel = {
      index,
      text,
      styleId: effectiveStyle,
      styleName,
      headingLevel,
      role: this.roleOf(text, acc.text, headingLevel, effectiveStyle, styleName),
      alignment: mapAlignment(props.jc),
      lineSpacing: lineSpacing(props.line, props.lineRule),
      formatting: summarize(acc.slices),
      sectionIndex,
      fieldInstructions: acc.instructions,
      hasDrawing: acc.hasDrawing,
      startsPage: props.pageBreakBefore === true || acc.breakBeforeText,
    };
    return { paragraph, endsWithPageBreak: acc.breakAfterText };
  }

  private roleOf(
    text: string,
    raw: string,
    level: number | null,
    styleId: string | null,
    styleName: string | null
  ): ParagraphRole {
    if (!text) return 'empty';
    const style = `${styleName ?? ''} ${styleId ?? ''}`;
    if (/\b(toc|tm)\s*\d|table of figures|table des illustrations/i.test(style)) return 'toc';
    // A hand-typed or stale table-of-contents row: "Titre ........ 12" or "Titre<TAB>xiv".
    if (/(\.{4,}|…{2,}|\t)\s*([0-9]+|[ivxlcdm]+)\s*$/i.test(raw)) return 'toc';
    // …or a row whose page number Word replaced with a broken-field message.
    if (/(\.{4,}|…{2,}|\t)\s*(erreur|error)\s*!/i.test(raw)) return 'toc';
    if (/\b(caption|l[ée]gende)\b/i.test(style)) return 'caption';
    if (level !== null) return 'heading';
    if (
      /^(figure|tableau|table|[ée]quation)\s+[\divx]+([.\-–]\d+)*\b/i.test(text) &&
      text.length < 220
    ) {
      return 'caption';
    }
    return 'body';
  }

  private walk(container: Element, paragraphStyle: string | null, acc: Accumulator): void {
    for (const node of container.children) {
      if (!isElement(node)) continue;
      if (node.name === 'w:r') this.readRun(node, paragraphStyle, acc);
      else if (node.name === 'w:fldSimple') {
        const instr = attr(node, 'w:instr');
        if (instr) acc.instructions.push(instr.trim());
        this.walk(node, paragraphStyle, acc);
      } else if (RUN_CONTAINERS.has(node.name)) this.walk(node, paragraphStyle, acc);
    }
  }

  private readRun(run: Element, paragraphStyle: string | null, acc: Accumulator): void {
    const rPr = child(run, 'w:rPr');
    if (onOff(rPr, 'w:vanish') === true) return;
    const resolved = this.cascade.runProps(
      paragraphStyle,
      childVal(rPr, 'w:rStyle') ?? null,
      readRunProps(rPr, this.cascade.theme)
    );
    let text = '';
    for (const node of run.children) {
      if (!isElement(node)) continue;
      switch (node.name) {
        case 'w:fldChar': {
          const type = attr(node, 'w:fldCharType');
          if (type === 'begin') {
            acc.inInstruction = true;
            acc.instruction = '';
          } else if (type === 'separate' || type === 'end') {
            if (acc.inInstruction && acc.instruction.trim())
              acc.instructions.push(acc.instruction.trim());
            acc.inInstruction = false;
          }
          break;
        }
        case 'w:instrText':
          if (acc.inInstruction)
            acc.instruction += node.children.map((c) => ('text' in c ? c.text : '')).join('');
          break;
        case 'w:t':
          if (!acc.inInstruction)
            text += node.children.map((c) => ('text' in c ? c.text : '')).join('');
          break;
        case 'w:tab':
          if (!acc.inInstruction) text += '\t';
          break;
        case 'w:br':
        case 'w:lastRenderedPageBreak':
          if (node.name === 'w:br' && attr(node, 'w:type') === 'page') {
            if ((acc.text + text).trim() === '') acc.breakBeforeText = true;
            else acc.breakAfterText = true;
          } else if (node.name === 'w:br') text += ' ';
          break;
        case 'w:drawing':
        case 'w:pict':
        case 'w:object':
          acc.hasDrawing = true;
          break;
        default:
          break;
      }
    }
    if (text.trim()) {
      acc.breakAfterText = false; // text after the break: the break was mid-paragraph
      acc.slices.push({
        length: text.replace(/\s/g, '').length,
        font: resolved.font,
        sizePt: (resolved.sizeHalfPoints ?? 20) / 2,
        bold: resolved.bold === true,
        italic: resolved.italic === true,
        caps:
          resolved.caps === true || (text === text.toLocaleUpperCase('fr') && /\p{L}/u.test(text)),
      });
    }
    acc.text += text;
  }
}
