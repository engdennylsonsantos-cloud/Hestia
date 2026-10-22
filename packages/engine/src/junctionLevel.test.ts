import { describe, expect, it } from 'vitest';
import { multiArea, union, type MultiPolygon } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Layer, type Project, type WallType } from '@hestia/model';
import { resolveFloors } from './floors.ts';
import { junctionLevel, layerPartsOf } from './junctionLevel.ts';
import { flatPiece, overlapVolume } from './junctionNet.ts';
import { layerMetas, resolveJunction, winsOver, type PlanarPiece } from './junctionPlanar.ts';
import { resolveSlabs } from './slabs.ts';

type Pt = { x: number; y: number };
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Piso e laje de uma camada estrutural de 0,10 m (tipos `ft_t` e `ls_t`), para áreas calculadas à mão. */
function build(els: { floors?: Array<Partial<ReturnType<typeof makeFloor>>>; slabs?: Array<Partial<ReturnType<typeof makeSlab>>>; walls?: Array<Partial<ReturnType<typeof makeWall>>>; wallBaseOffset?: number }, types = 'mono'): Project {
  const base = createEmptyProject();
  const one: Layer[] = [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.1 } as Layer];
  base.floorTypes.ft_t = { ...base.floorTypes.ft_ceram!, id: 'ft_t', name: 'Teste piso', code: 'PT', layers: one };
  base.slabTypes.ls_t = { ...base.slabTypes.ls_mac12!, id: 'ls_t', name: 'Teste laje', code: 'LT', layers: one };
  const wt: WallType = { ...base.wallTypes.wt_alv14!, id: 'wt_t', name: 'Teste', code: 'T', layers: [{ function: 'structure', materialId: 'mat_bloco14', thickness: 0.23, wraps: false }] };
  base.wallTypes.wt_t = wt;
  const s = new ProjectStore(base);
  for (const w of els.walls ?? []) s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_t', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, height: 2.8, ...w }) });
  for (const f of els.floors ?? []) s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: types === 'padrao' ? 'ft_ceram' : 'ft_t', levelId: 'lv_0', boundary: rect(0, 0, 6, 4), ...f }) });
  for (const x of els.slabs ?? []) s.exec({ type: 'addSlab', slab: makeSlab({ id: 's', typeId: 'ls_t', levelId: 'lv_0', boundary: rect(3, 0, 9, 4), ...x }) });
  return s.project;
}

const area = (m: MultiPolygon): number => multiArea(m);
/** Área em planta da união das partes de uma camada (cada parte pode ser uma fatia de cota; a união evita contar duas vezes). */
const planArea = (parts: Array<{ poly: MultiPolygon }>): number => area(union(...parts.map((x) => x.poly)));

describe('junção resolvida por nível (decisão 0023 §3, P7b)', () => {
  it('sem sobreposição de elementos: nada é recortado e a camada inteira fica (cut falso)', () => {
    const p = build({ floors: [{}], slabs: [{ boundary: rect(20, 20, 24, 24) }] });
    const el = junctionLevel(p, 'lv_0').elements.get('f')!;
    expect(el.cut).toBe(false);
    expect(area(el.layers[0]!.parts[0]!.poly)).toBeCloseTo(24, 9);
    const fb = [{ poly: rect(0, 0, 1, 1) as unknown as MultiPolygon, z0: 0, z1: 1 }];
    expect(layerPartsOf(el, 0, fb)).toBe(fb);
  });

  it('encostar sem sobrepor área não é corte: piso e laje que só dividem a aresta ficam com cut falso (P7c)', () => {
    // O piso vai de x 0 a 6 e a laje de x 6 a 9: a aresta comum tem faixa de cota sobreposta, mas nenhuma área.
    const p = build({ floors: [{}], slabs: [{ boundary: rect(6, 0, 9, 4) }] });
    const j = junctionLevel(p, 'lv_0');
    const el = j.elements.get('f')!;
    expect(el.cut).toBe(false);
    expect(area(el.layers[0]!.parts[0]!.poly)).toBeCloseTo(24, 9);
    expect(j.elements.get('s')?.cut ?? false).toBe(false);
  });

  it('laje estrutural corta piso (empate: laje vence): o piso fica com 12 de 24 m², a laje inteira', () => {
    const p = build({ floors: [{}], slabs: [{}] });
    const j = junctionLevel(p, 'lv_0');
    const floor = j.elements.get('f')!;
    expect(floor.cut).toBe(true);
    expect(area(floor.region)).toBeCloseTo(12, 9);
    expect(planArea(floor.layers[0]!.parts)).toBeCloseTo(12, 9);
    expect(j.elements.get('s')?.cut ?? false).toBe(false);
  });

  it('parede embutida no piso: o acabamento e o substrato perdem o núcleo da parede; a estrutura do piso fica (empate)', () => {
    // Parede 0,23 × 1,00 m com base no nível; piso de 0,16 m de topo (como o caso de `netQuantities`): z sobreposto.
    const p = build({ floors: [{ heightOffset: 0.16, boundary: rect(-1, -1, 2, 1) }], walls: [{}] }, 'padrao');
    const el = junctionLevel(p, 'lv_0').elements.get('f')!;
    expect(el.cut).toBe(true);
    const rf = resolveFloors(p, 'lv_0')[0]!;
    expect(rf.layers.map((l) => l.priority)).toEqual([4, 2, 2, 1]);
    const partsOf = (i: number) => el.layers.find((l) => l.layerIndex === i)!.parts;
    expect(planArea(partsOf(0))).toBeCloseTo(6 - 0.23, 9);
    expect(planArea(partsOf(1))).toBeCloseTo(6 - 0.23, 9);
    expect(planArea(partsOf(3))).toBeCloseTo(6, 9);
  });

  it('cache por nível: mesmo conteúdo devolve o mesmo resultado; mudar a laje recalcula', () => {
    const p = build({ floors: [{}], slabs: [{}] });
    const a = junctionLevel(p, 'lv_0');
    expect(junctionLevel(p, 'lv_0')).toBe(a);
    const q = build({ floors: [{}], slabs: [{ boundary: rect(20, 20, 24, 24) }] });
    const b = junctionLevel(q, 'lv_0');
    expect(b).not.toBe(a);
    expect(b.elements.get('f')!.cut).toBe(false);
  });

  it('camadas do mesmo elemento e parede contra parede não se cortam (resolveJunction)', () => {
    const poly = [[rect(0, 0, 4, 4)]] as MultiPolygon;
    const mini: MultiPolygon = [[rect(1, 1, 3, 3)]];
    const same: PlanarPiece[] = [
      { meta: { kind: 'floor', priority: 4, core: false }, poly, z0: 0, z1: 1, owner: 'a' },
      { meta: { kind: 'floor', priority: 1, core: true }, poly: mini, z0: 0, z1: 1, owner: 'a' },
    ];
    expect(resolveJunction(same)[0]![0]!.poly).toBe(poly);
    const walls: PlanarPiece[] = [
      { meta: { kind: 'wall', priority: 4, core: false }, poly, z0: 0, z1: 1, owner: 'w1' },
      { meta: { kind: 'wall', priority: 1, core: true }, poly: mini, z0: 0, z1: 1, owner: 'w2' },
    ];
    expect(resolveJunction(walls)[0]![0]!.poly).toBe(poly);
    const mixed: PlanarPiece[] = [
      { meta: { kind: 'floor', priority: 4, core: false }, poly, z0: 0, z1: 1, owner: 'f' },
      { meta: { kind: 'wall', priority: 1, core: true }, poly: mini, z0: 0, z1: 1, owner: 'w2' },
    ];
    expect(area(resolveJunction(mixed)[0]![0]!.poly)).toBeCloseTo(16 - 4, 9);
  });

  it('metas de camada vêm da função e da prioridade efetiva (sem nome de material)', () => {
    const metas = layerMetas('floor', [{ function: 'finish1', materialId: 'mat_x', thickness: 0.01 } as Layer, { function: 'structure', materialId: 'mat_x', thickness: 0.1, priority: 6 } as Layer]);
    expect(metas.map((m) => m.priority)).toEqual([4, 6]);
  });

  it('partes de uma camada: sem corte ou sem a camada, vale o contorno inteiro', () => {
    const fb = [{ poly: rect(0, 0, 1, 1) as unknown as MultiPolygon, z0: 0, z1: 1 }];
    expect(layerPartsOf(undefined, 0, fb)).toBe(fb);
    expect(layerPartsOf({ cut: false, layers: [], region: [] }, 0, fb)).toBe(fb);
    expect(layerPartsOf({ cut: true, layers: [], region: [] }, 0, fb)).toBe(fb);
  });

  it('propriedade (10 sementes): nenhum par em que uma camada vence deixa volume sobreposto na outra', () => {
    let cuts = 0;
    for (let seed = 1; seed <= 10; seed++) {
      let s = seed * 7919;
      const r = (): number => {
        s = (s * 1103515245 + 12345) % 2147483648;
        return s / 2147483648;
      };
      const box = (): Pt[] => {
        const x0 = r() * 4;
        const y0 = r() * 3;
        return rect(x0, y0, x0 + 2 + r() * 3, y0 + 2 + r() * 2);
      };
      const off = (): number => [-0.05, 0, 0.05][Math.floor(r() * 3)]!;
      const p = build({
        floors: [
          { id: 'f1', boundary: box(), heightOffset: off() },
          { id: 'f2', boundary: box(), heightOffset: off() },
        ],
        slabs: [
          { id: 's1', boundary: box(), heightOffset: off() },
          { id: 's2', boundary: box(), heightOffset: off() },
        ],
      });
      const j = junctionLevel(p, 'lv_0');
      // Uma peça por parte resolvida de cada camada, com os atributos de junção dela.
      const items: Array<{ owner: string; meta: ReturnType<typeof layerMetas>[number]; piece: ReturnType<typeof flatPiece> }> = [];
      for (const rf of resolveFloors(p, 'lv_0')) {
        const metas = layerMetas('floor', p.floorTypes[rf.typeId]!.layers);
        for (const l of rf.layers) {
          if (l.membrane) continue;
          for (const part of layerPartsOf(j.elements.get(rf.floorId), l.layerIndex, [{ poly: rf.polygon, z0: l.z0, z1: l.z1 }])) {
            items.push({ owner: rf.floorId, meta: metas[l.layerIndex]!, piece: flatPiece(part.poly, part.z0, part.z1) });
          }
        }
      }
      for (const rs of resolveSlabs(p, 'lv_0')) {
        const metas = layerMetas('slab', p.slabTypes[rs.typeId]!.layers);
        for (const l of rs.layers) {
          for (const part of layerPartsOf(j.elements.get(rs.slabId), l.layerIndex, [{ poly: rs.polygon, z0: l.z0, z1: l.z1 }])) {
            items.push({ owner: rs.slabId, meta: metas[l.layerIndex]!, piece: flatPiece(part.poly, part.z0, part.z1) });
          }
        }
      }
      cuts += [...j.elements.values()].filter((e) => e.cut).length;
      for (const c of items) {
        for (const t of items) {
          if (c.owner === t.owner) continue;
          // Se `c` vence `t`, a parte resolvida de `t` não pode ocupar volume que `c` tem na mesma cota.
          if (winsOver(c.meta, t.meta) === true) expect(overlapVolume(t.piece, c.piece)).toBeLessThan(1e-9);
        }
      }
    }
    expect(cuts).toBeGreaterThan(0);
  });
});
