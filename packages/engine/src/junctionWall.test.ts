import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Floor, type Project, type Wall } from '@hestia/model';
import { junctionLevel, wallBandPartsOf, type JunctionLevel } from './junctionLevel.ts';
import { resolveFloors } from './floors.ts';
import { resolveLevel } from './resolve.ts';
import { winsOver } from './junctionPlanar.ts';
import type { ResolvedPrism } from './junctionPlanar.ts';

/**
 * Parede recortada pela junção com piso (decisão 0023 §3, F1 do plano de conclusão). A medida é volume: área da parte
 * vezes a altura dela. Planta de altura fixa não muda com o piso abaixo do corte, então o recorte aparece no corte e no 3D.
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type W = Omit<Wall, 'order'>;
type F = Omit<Floor, 'order'>;

function build(walls: W[], floors: F[] = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  return s.project;
}

/** Parede de (0,0) a (4,0), térreo, alvenaria de 14 cm, 3 m de altura, base em `baseOffset`. */
const wall = (id: string, baseOffset = 0): W =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 3, baseOffset });

/** Piso de sala (0 a 4 m em x, 0 a 3 m em y) encostado na parede de y = 0. */
const sala = (id = 'f1'): F => makeFloor({ id, typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) });

/** Índice da camada estrutural do tipo `ft_ceram` (a de prioridade 1, núcleo do piso). */
const STRUCT = createEmptyProject().floorTypes.ft_ceram!.layers.findIndex((l) => l.function === 'structure');

const areaOf = (poly: MultiPolygon): number => multiArea(poly);

/** Volume das partes de uma faixa: soma de área × altura de cada parte. */
const volumeOf = (parts: ResolvedPrism[]): number => parts.reduce((s, x) => s + areaOf(x.poly) * (x.z1 - x.z0), 0);

/** Volume cheio das faixas de uma parede (como o quantitativo a enxerga sem junção). */
function fullVolume(p: Project, wallId: string): number {
  const rw = resolveLevel(p, 'lv_0').walls[wallId]!;
  return rw.layers.reduce((s, l) => s + l.bands.reduce((t, b) => t + areaOf(b.poly) * (b.z1 - b.z0), 0), 0);
}

/** Volume da parede depois da junção, por faixa (faixa sem parte resolvida vale a cheia). */
function resolvedVolume(p: Project, jl: JunctionLevel, wallId: string): number {
  const rw = resolveLevel(p, 'lv_0').walls[wallId]!;
  return rw.layers.reduce(
    (s, l) =>
      s +
      l.bands.reduce((t, b, bandIndex) => {
        const full: ResolvedPrism[] = [{ poly: b.poly, z0: rw.baseZ + b.z0, z1: rw.baseZ + b.z1 }];
        return t + volumeOf(wallBandPartsOf(jl, wallId, l.layerIndex, bandIndex, full));
      }, 0),
    0,
  );
}

describe('F1 · parede recortada pela junção com piso', () => {
  it('parede que desce até a cota do piso é recortada (wall cut = true)', () => {
    const p = build([wall('w1', -0.2)], [sala()]);
    expect(junctionLevel(p, 'lv_0').walls.get('w1')?.cut).toBe(true);
  });

  it('parede acima da cota do piso (base no nível, piso abaixo dele) não é recortada', () => {
    const p = build([wall('w1', 0)], [sala()]);
    expect(junctionLevel(p, 'lv_0').walls.get('w1')?.cut ?? false).toBe(false);
  });

  it('o volume tirado da parede é a soma, par a par, das camadas do piso que vencem as da parede × altura comum', () => {
    const p = build([wall('w1', -0.2)], [sala()]);
    const jl = junctionLevel(p, 'lv_0');
    const rf = resolveFloors(p, 'lv_0')[0]!;
    const rw = resolveLevel(p, 'lv_0').walls['w1']!;
    // Regra da junção (0023 §1): a camada do piso vence a da parede quando `winsOver` diz que sim, e só na cota comum.
    let expected = 0;
    for (const fl of rf.layers) {
      for (const wl of rw.layers) {
        const fm = { kind: 'floor' as const, priority: fl.priority, core: fl.core };
        const wm = { kind: 'wall' as const, priority: wl.priority, core: wl.core };
        if (winsOver(fm, wm) !== true) continue;
        for (const band of wl.bands) {
          const z0 = Math.max(fl.z0, rw.baseZ + band.z0);
          const z1 = Math.min(fl.z1, rw.baseZ + band.z1);
          if (z1 - z0 <= 1e-9) continue;
          expected += areaOf(intersection(band.poly, fl.polygon)) * (z1 - z0);
        }
      }
    }
    const removed = fullVolume(p, 'w1') - resolvedVolume(p, jl, 'w1');
    expect(removed).toBeGreaterThan(0);
    expect(removed).toBeCloseTo(expected, 6);
  });

  it('o volume do que sobra na parede mais o volume removido é o volume cheio (nada se perde)', () => {
    const p = build([wall('w1', -0.2)], [sala()]);
    const jl = junctionLevel(p, 'lv_0');
    expect(resolvedVolume(p, jl, 'w1') + (fullVolume(p, 'w1') - resolvedVolume(p, jl, 'w1'))).toBeCloseTo(fullVolume(p, 'w1'), 9);
  });

  it('a parte que sobra não se sobrepõe à estrutura do piso na mesma cota', () => {
    const p = build([wall('w1', -0.2)], [sala()]);
    const jl = junctionLevel(p, 'lv_0');
    const rf = resolveFloors(p, 'lv_0')[0]!;
    const structure = rf.layers.find((l) => l.layerIndex === STRUCT)!;
    const rw = resolveLevel(p, 'lv_0').walls['w1']!;
    rw.layers.forEach((l) =>
      l.bands.forEach((b, bandIndex) => {
        const full: ResolvedPrism[] = [{ poly: b.poly, z0: rw.baseZ + b.z0, z1: rw.baseZ + b.z1 }];
        for (const part of wallBandPartsOf(jl, 'w1', l.layerIndex, bandIndex, full)) {
          const inZ = Math.min(part.z1, structure.z1) - Math.max(part.z0, structure.z0) > 1e-9;
          if (!inZ) continue;
          expect(areaOf(intersection(part.poly, structure.polygon))).toBeLessThan(1e-9);
        }
      }),
    );
  });

  it('parede × parede não corta: duas paredes encostadas continuam inteiras', () => {
    const p = build([wall('w1', -0.2), { ...wall('w2', -0.2), id: 'w2', a: { x: 4, y: 0 }, b: { x: 4, y: 4 } }]);
    const jl = junctionLevel(p, 'lv_0');
    expect(jl.walls.get('w2')?.cut ?? false).toBe(false);
  });

  it('faixa sem parte resolvida cai na faixa inteira (fallback)', () => {
    const p = build([wall('w1', -0.2)]);
    const jl = junctionLevel(p, 'lv_0');
    const full: ResolvedPrism[] = [{ poly: rect(0, 0, 1, 1) as unknown as MultiPolygon, z0: 0, z1: 1 }];
    expect(wallBandPartsOf(jl, 'w1', 0, 0, full)).toBe(full);
    expect(wallBandPartsOf(undefined, 'w1', 0, 0, full)).toBe(full);
  });
});
