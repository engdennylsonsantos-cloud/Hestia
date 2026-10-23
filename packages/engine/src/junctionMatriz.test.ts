import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Project, type Wall } from '@hestia/model';
import { junctionLevel, wallBandCut } from './junctionLevel.ts';
import type { ResolvedPrism } from './junctionPlanar.ts';
import { resolveFloors } from './floors.ts';
import { resolveLevel } from './resolve.ts';

/**
 * F5 · matriz da tabela §9.1 da 0023 (piso × parede, em L e em T). Os nomes dos tipos são só identificação. Não é validação
 * contra o Revit (conferência manual do dono). O que a matriz garante: depois da junção, nenhuma camada de piso e nenhuma
 * faixa de parede ocupam o mesmo volume. Cada par tem um vencedor, então a zona comum fica com um só.
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type W = Omit<Wall, 'order'>;

const FLOORS = ['ft_ceram', 'ft_acab', 'ft_madeira'] as const;
const WALLS = ['wt_alv14', 'wt_ext19', 'wt_dry'] as const;

/** L: parede em y = 0 e parede em x = 0, com o piso encostado nas duas. T: parede passante e ramal em x = 2. */
function walls(config: 'L' | 'T', typeId: string, baseOffset: number): W[] {
  const base = { typeId, levelId: 'lv_0', height: 3, baseOffset };
  if (config === 'L') {
    return [
      makeWall({ ...base, id: 'wa', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }),
      makeWall({ ...base, id: 'wb', a: { x: 0, y: 0 }, b: { x: 0, y: 3 } }),
    ];
  }
  return [
    makeWall({ ...base, id: 'wa', a: { x: -1, y: 0 }, b: { x: 5, y: 0 } }),
    makeWall({ ...base, id: 'wb', a: { x: 2, y: 0 }, b: { x: 2, y: 3 } }),
  ];
}

function build(config: 'L' | 'T', floorType: string, wallType: string): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls(config, wallType, -0.2)) s.exec({ type: 'addWall', wall: w });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: floorType, levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
  return s.project;
}

/** Volume de sobreposição entre as partes de piso e as partes de parede, pela cota comum (soma área × altura). */
function overlapVolume(p: Project): number {
  const jl = junctionLevel(p, 'lv_0');
  const rw = resolveLevel(p, 'lv_0');
  const floorParts: ResolvedPrism[] = [...jl.elements.values()].flatMap((el) => el.layers.flatMap((l) => l.parts));
  let v = 0;
  for (const w of Object.values(rw.walls)) {
    for (const l of w.layers) {
      l.bands.forEach((b, bandIndex) => {
        const parts = wallBandCut(jl, w.wallId, l.layerIndex, bandIndex) ?? [{ poly: b.poly, z0: w.baseZ + b.z0, z1: w.baseZ + b.z1 }];
        for (const wp of parts) {
          for (const fp of floorParts) {
            const dz = Math.min(wp.z1, fp.z1) - Math.max(wp.z0, fp.z0);
            if (dz <= 1e-9) continue;
            v += multiArea(intersection(wp.poly as MultiPolygon, fp.poly as MultiPolygon)) * dz;
          }
        }
      });
    }
  }
  return v;
}

/** Sobreposição antes da junção: camadas de piso e faixas inteiras de parede (controle: o teste não pode ser vazio). */
function rawOverlapVolume(p: Project): number {
  const rw = resolveLevel(p, 'lv_0');
  const floorPieces = resolveFloors(p, 'lv_0').flatMap((rf) => rf.layers.map((l) => ({ poly: l.polygon as MultiPolygon, z0: l.z0, z1: l.z1 })));
  let v = 0;
  for (const w of Object.values(rw.walls)) {
    for (const l of w.layers) {
      for (const b of l.bands) {
        for (const fp of floorPieces) {
          const dz = Math.min(w.baseZ + b.z1, fp.z1) - Math.max(w.baseZ + b.z0, fp.z0);
          if (dz <= 1e-9) continue;
          v += multiArea(intersection(b.poly as MultiPolygon, fp.poly)) * dz;
        }
      }
    }
  }
  return v;
}

describe('F5 · matriz §9.1 (controle)', () => {
  it('sem junção, piso e parede se sobrepõem (o teste abaixo não é vazio)', () => {
    expect(rawOverlapVolume(build('L', 'ft_ceram', 'wt_alv14'))).toBeGreaterThan(1e-6);
  });
});

describe('F5 · matriz §9.1 (piso × parede, L e T): sem sobreposição de volume depois da junção', () => {
  for (const config of ['L', 'T'] as const) {
    for (const f of FLOORS) {
      for (const w of WALLS) {
        it(`${f} × ${w} em ${config}`, () => {
          const p = build(config, f, w);
          expect(resolveFloors(p, 'lv_0').length).toBe(1);
          expect(overlapVolume(p)).toBeLessThan(1e-9);
        });
      }
    }
  }
});
