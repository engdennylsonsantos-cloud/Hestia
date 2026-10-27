import { describe, expect, it } from 'vitest';
import { resolverZoom } from './zoomOps.ts';
import type { Vec2 } from '@hestia/geom';
import type { ResolvedRoof } from '@hestia/engine';
import { createEmptyProject } from '@hestia/model';
import { roofOps } from './roofs.ts';
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

const P = (x: number, y: number): Vec2 => ({ x, y });
const VIEW: Viewport = { cx: 4, cy: 3, zoom: 100, width: 800, height: 600 };

/** Telhado plano (nenhuma aresta com inclinação): uma água horizontal, como o Revit aceita. */
const plano: ResolvedRoof = {
  roofId: 'r',
  typeId: 'rt_ceramica',
  levelId: 'lv_0',
  eaveZ: 2.8,
  joinedArea: 0,
  layers: [{ layerIndex: 0, materialId: 'mat_telha_ceramica', thickness: 0.015, below: 0 }],
  planes: [{ polygon: [[[P(0, 0), P(8, 0), P(8, 6), P(0, 6)]]], origin: P(0, 0), up: P(0, 1), percent: 0, z0: 2.8 }],
  lines: [{ kind: 'eave', a: P(0, 0), b: P(8, 0) }],
};

describe('telhado plano na planta', () => {
  it('desenha a água e o beiral, sem seta de caimento nem o rótulo "0,0 %"', () => {
    const o = resolverZoom(roofOps([plano], createEmptyProject(), LIGHT, false, 'medium', VIEW), 100);
    expect(o.fills.length).toBeGreaterThan(0);
    expect(o.labels.some((l) => /%/.test(l.text))).toBe(false);
    expect(o.strokes.some((s) => s.color === LIGHT.roofSlope)).toBe(false);
  });
});
