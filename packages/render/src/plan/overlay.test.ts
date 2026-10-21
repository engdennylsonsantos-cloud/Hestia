import { describe, expect, it } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { createEmptyProject } from '@hestia/model';
import type { PreviewItem } from '@hestia/tools';
import { buildPlanDrawList, type PlanInput } from './build.ts';
import { previewOverlay } from './overlay.ts';
import { DARK, LIGHT, type PlanTheme } from './types.ts';
import type { Viewport } from '../viewport.ts';

const VIEW: Viewport = { cx: 0, cy: 0, zoom: 100, width: 800, height: 600 };
const A = { x: 0, y: 0 };
const B = { x: 1, y: 0 };
const RING = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const noHighlight = () => [];

/** Um item de cada tom da escada, na ordem: limite, espelho, caminhada, patamar e degrau calculado. */
const TONED: PreviewItem[] = [
  { kind: 'line', a: A, b: B, tone: 'boundary' },
  { kind: 'line', a: A, b: B, tone: 'riser' },
  { kind: 'line', a: A, b: B, tone: 'path' },
  { kind: 'polygon', ring: RING, tone: 'landing' },
  { kind: 'polygon', ring: RING, tone: 'tread' },
];

/** Cor do traço (ou do preenchimento, se o item só tem polígono) de cada item, na ordem. */
function colorsOf(items: PreviewItem[], theme: PlanTheme): string[] {
  const ov = previewOverlay(items, VIEW, theme, noHighlight);
  return items.map((_, i) => {
    const stroke = ov.strokes[i];
    return stroke?.color ?? '';
  });
}

describe('prévia da escada por tom (decisão 0011 · interface)', () => {
  for (const [name, theme] of [
    ['tema claro', LIGHT],
    ['tema escuro', DARK],
  ] as const) {
    it(`${name}: cada tom tem cor própria, distinta das demais e da cor de destaque`, () => {
      const colors = colorsOf(TONED, theme);
      expect(colors).toEqual([theme.stairBoundary, theme.stairRiser, theme.stairPath, theme.stairLanding, theme.stairTread]);
      expect(new Set(colors).size).toBe(TONED.length);
      expect(colors).not.toContain(theme.accent);
    });
  }

  it('os degraus calculados saem translúcidos, com contorno fino', () => {
    const ov = previewOverlay([TONED[4]!], VIEW, LIGHT, noHighlight);
    expect(ov.fills[0]).toMatchObject({ color: LIGHT.stairTread, alpha: 0.2 });
    expect(ov.strokes[0]).toMatchObject({ closed: true, widthPx: 1, color: LIGHT.stairTread });
  });

  it('itens sem tom saem exatamente como antes (cor de destaque, mesmos traços e alfas)', () => {
    const ov = previewOverlay([{ kind: 'line', a: A, b: B }, { kind: 'polygon', ring: RING }], VIEW, LIGHT, noHighlight);
    expect(ov.strokes[0]).toEqual({ pts: [A, B], closed: false, widthPx: 1.5, color: LIGHT.accent, alpha: 0.95, dash: undefined });
    expect(ov.fills[0]).toEqual({ polygons: [[RING]], color: LIGHT.accent, alpha: 0.14 });
    expect(ov.strokes[1]).toEqual({ pts: RING, closed: true, widthPx: 1.5, color: LIGHT.accent, alpha: 0.95, dash: undefined });
  });

  it('o PlanDrawList da prévia leva as cores por tom e mantém a cor de destaque nos itens sem tom', () => {
    const p = createEmptyProject();
    const input: PlanInput = {
      project: p,
      levelId: 'lv_0',
      resolved: resolveLevel(p, 'lv_0', new Map()),
      below: null,
      viewport: VIEW,
      theme: LIGHT,
      dark: false,
      selection: [],
      hover: null,
      preview: [...TONED, { kind: 'line', a: A, b: B }],
      inference: null,
      showGrid: false,
    };
    const dl = buildPlanDrawList(input);
    const colors = new Set(dl.strokes.map((s) => s.color));
    for (const c of [LIGHT.stairBoundary, LIGHT.stairRiser, LIGHT.stairPath, LIGHT.stairLanding, LIGHT.stairTread, LIGHT.accent]) {
      expect(colors.has(c)).toBe(true);
    }
    expect(dl.strokes.filter((s) => s.color === LIGHT.accent && s.widthPx === 1.5 && s.pts.length === 2)).toHaveLength(1);
  });
});
