import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening } from '@hestia/model';
import { buildOpeningModel, frameOfWall, openingGeometry, type OpeningGeometry, type OpeningModel } from '@hestia/engine';
import { LIGHT } from './types.ts';
import { openingDetailByZoom, openingPlanDetail, openingPlanWorldPaths, openingSymbol, type OpeningSymbolOptions } from './symbols.ts';
import { openingViewOps } from './view.ts';

interface Cena {
  g: OpeningGeometry;
  model: OpeningModel;
}

function cena(over: { typeId?: string; flipHand?: boolean; flipFacing?: boolean } = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const typeId = over.typeId ?? 'ot_p90';
  const t = s.project.openingTypes[typeId]!;
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId,
      hostId: 'w',
      offset: 2,
      flipHand: over.flipHand ?? false,
      flipFacing: over.flipFacing ?? false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  const g = openingGeometry(p, o, f);
  return { g, model: buildOpeningModel(p, o, g, f) };
}

const options = (over: Partial<OpeningSymbolOptions> = {}): OpeningSymbolOptions => ({
  detail: 'mid',
  angle: Math.PI / 2,
  planDisplay: 'symbolic',
  showSwing: true,
  swingStyle: 'arc',
  cutZ: 1,
  ...over,
});

describe('openingSymbol: modelo único na planta', () => {
  it('low: só a linha da folha; mid: perfis cortados, folha aberta e arco; high: mais a folha fechada', () => {
    const c = cena();
    expect(openingSymbol(c.g, c.model, LIGHT, 1.2, options({ detail: 'low' }))).toHaveLength(1);
    const mid = openingSymbol(c.g, c.model, LIGHT, 1.2, options());
    expect(mid.filter((s) => s.closed)).toHaveLength(5);
    expect(mid.length).toBe(6);
    const high = openingSymbol(c.g, c.model, LIGHT, 1.2, options({ detail: 'high' }));
    expect(high.filter((s) => s.closed)).toHaveLength(6);
  });

  it("detail off não gera traços", () => {
    const c = cena();
    expect(openingSymbol(c.g, c.model, LIGHT, 1.2, options({ detail: 'off' }))).toEqual([]);
  });

  it("detail 'scale' escolhe low/mid/high pelo zoom", () => {
    expect(openingPlanDetail('scale', 15)).toBe('low');
    expect(openingPlanDetail('scale', 60)).toBe('mid');
    expect(openingPlanDetail('scale', 400)).toBe('high');
    expect(openingDetailByZoom(20)).toBe('low');
    expect(openingDetailByZoom(100)).toBe('mid');
    expect(openingDetailByZoom(1000)).toBe('high');
    expect(openingPlanDetail('off', 400)).toBe('off');
  });

  it('a folha aberta é um retângulo com espessura, não uma linha', () => {
    const c = cena();
    const leaf = openingPlanWorldPaths(c.g, c.model, options()).find((p) => p.role === 'leaf' && p.closed)!;
    const xs = leaf.pts.map((p) => p.x);
    const ys = leaf.pts.map((p) => p.y);
    const lados = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].sort((a, b) => a - b);
    expect(lados[0]).toBeCloseTo(0.04, 9);
    expect(lados[1]).toBeCloseTo(0.822, 9);
  });

  it('projection-above continua tracejado; projection-below e beyond saem leves', () => {
    const c = cena();
    const widths = { cut: { widthPx: 1.2 }, proj: { widthPx: 0.6 } };
    const above = openingViewOps(c.g, 'projection-above', LIGHT, widths, { ...options(), model: c.model });
    expect(above.length).toBeGreaterThan(0);
    expect(above.every((s) => s.dash?.[0] === 6)).toBe(true);
    const below = openingViewOps(c.g, 'projection-below', LIGHT, widths, { ...options(), model: c.model });
    expect(below.every((s) => s.color === LIGHT.inkSoft)).toBe(true);
    const beyond = openingViewOps(c.g, 'beyond', LIGHT, widths, { ...options(), model: c.model });
    expect(beyond.every((s) => s.color === LIGHT.inkSoft)).toBe(true);
    expect(openingViewOps(c.g, 'hidden', LIGHT, widths, { ...options(), model: c.model })).toEqual([]);
  });

  it('as famílias geram desenhos diferentes e o vão livre são duas linhas tracejadas', () => {
    const sig = (typeId: string): string => {
      const c = cena({ typeId });
      return JSON.stringify(openingPlanWorldPaths(c.g, c.model, options()));
    };
    const all = [sig('ot_p90'), sig('ot_p160'), sig('ot_pc160'), sig('ot_pp80')];
    expect(new Set(all).size).toBe(all.length);
    const vazio = cena({ typeId: 'ot_vao90' });
    const paths = openingPlanWorldPaths(vazio.g, vazio.model, options());
    expect(paths).toHaveLength(2);
    expect(paths.every((p) => p.dash !== undefined && !p.closed)).toBe(true);
  });
});
