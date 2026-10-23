import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { junctionLevel, resolveFloors, resolveSlabs } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Layer, type Project } from '@hestia/model';
import { floorOpsOf } from './floors.ts';
import { slabOpsOf } from './slabs.ts';
import { defaultPaint } from './style.ts';
import { LIGHT } from './types.ts';
import type { Viewport } from '../viewport.ts';

const VIEW: Viewport = { cx: 3, cy: 2, zoom: 40, width: 800, height: 600 };
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Piso (0 a 6 m × 0 a 4 m) e laje (3 a 9 m) de uma camada estrutural: a laje corta o piso na faixa de 3 a 6 m. */
function project(slabBox = rect(3, 0, 9, 4)): Project {
  const base = createEmptyProject();
  const one: Layer[] = [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.1 } as Layer];
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste piso', code: 'PT', layers: one };
  base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Teste laje', code: 'LT', layers: one };
  const s = new ProjectStore(base);
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_t', levelId: 'lv_0', boundary: rect(0, 0, 6, 4) }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_t', levelId: 'lv_0', boundary: slabBox }) });
  return s.project;
}

describe('planta: piso e laje pela região resolvida (decisão 0023 §3, P7b)', () => {
  it('o piso cortado pela laje pinta só a região que sobra (12 de 24 m²)', () => {
    const p = project();
    const rf = resolveFloors(p, 'lv_0')[0]!;
    const jl = junctionLevel(p, 'lv_0');
    const ops = floorOpsOf(p, rf, LIGHT, false, 'medium', VIEW, defaultPaint('floor', VIEW.zoom), jl.elements.get('f'));
    expect(multiArea(ops.fills[0]!.polygons)).toBeCloseTo(12, 9);
  });

  it('sem junção (ou sem corte) o preenchimento é o contorno inteiro, como antes', () => {
    const p = project();
    const rf = resolveFloors(p, 'lv_0')[0]!;
    const ops = floorOpsOf(p, rf, LIGHT, false, 'medium', VIEW, defaultPaint('floor', VIEW.zoom));
    expect(multiArea(ops.fills[0]!.polygons)).toBeCloseTo(24, 9);
  });

  it('a laje que a outra não corta mantém o contorno inteiro', () => {
    const p = project();
    const rs = resolveSlabs(p, 'lv_0')[0]!;
    const jl = junctionLevel(p, 'lv_0');
    const ops = slabOpsOf(p, rs, LIGHT, false, 'medium', VIEW, defaultPaint('slab', VIEW.zoom), jl.elements.get('s'));
    expect(multiArea(ops.fills[0]!.polygons)).toBeCloseTo(24, 9);
  });

  it('sem sobreposição em planta, o piso sai inteiro mesmo com laje na mesma cota', () => {
    const p = project(rect(20, 20, 24, 24));
    const rf = resolveFloors(p, 'lv_0')[0]!;
    const ops = floorOpsOf(p, rf, LIGHT, false, 'medium', VIEW, defaultPaint('floor', VIEW.zoom), junctionLevel(p, 'lv_0').elements.get('f'));
    expect(multiArea(ops.fills[0]!.polygons)).toBeCloseTo(24, 9);
  });
});

describe('planta · região sem corte segue a camada de cima (término por camada, perímetro)', () => {
  it('piso de borda com término núcleo: a planta desenha o núcleo, não o contorno de acabamento', () => {
    const base = createEmptyProject();
    const ft = base.floorTypes['ft_ceram']!;
    base.floorTypes['ft_ceram'] = { ...ft, layers: ft.layers.map((l, i) => (i === 0 ? { ...l, termino: 'nucleo' } : l)) } as Project['floorTypes'][string];
    const s = new ProjectStore(base);
    const W = (id: string, a: { x: number; y: number }, b: { x: number; y: number }) => makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, height: 3 });
    s.exec({ type: 'addWall', wall: W('n', { x: 0, y: 6 }, { x: 8, y: 6 }) });
    s.exec({ type: 'addWall', wall: W('e', { x: 8, y: 6 }, { x: 8, y: 0 }) });
    s.exec({ type: 'addWall', wall: W('s', { x: 8, y: 0 }, { x: 0, y: 0 }) });
    s.exec({ type: 'addWall', wall: W('o', { x: 0, y: 0 }, { x: 0, y: 6 }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 8, 6), outlineSource: { mode: 'perimeter', seed: { x: 4, y: 3 }, linked: true } }) });
    const p = s.project;
    const rf = resolveFloors(p, 'lv_0')[0]!;
    const ops = floorOpsOf(p, rf, LIGHT, false, 'medium', VIEW, defaultPaint('floor', VIEW.zoom), junctionLevel(p, 'lv_0').elements.get('f'));
    const drawn = multiArea(ops.fills[0]!.polygons);
    // A camada de cima vai ao núcleo (menor que a face de acabamento, 50,61 m²)
    expect(drawn).toBeCloseTo(multiArea(rf.layers[0]!.polygon), 6);
    expect(drawn).toBeLessThan(multiArea(rf.polygon) - 1e-6);
  });
});
