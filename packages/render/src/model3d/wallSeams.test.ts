import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ProjectStore, createEmptyProject, makeWall, openingSill, openingsOfWall, type Wall } from '@hestia/model';
import { bandVolume, fuseBands, quantifyLevel, resolveLevel, type LayerBand, type ResolvedLevel, type ResolvedWall } from '@hestia/engine';
import type { Polygon, Ring } from '@hestia/geom';
import { buildLevelSolids } from './solids.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by } });
const addWin = (s: ProjectStore, hostId: string, offset: number) => s.exec({ type: 'addOpening', opening: { id: 'j', kind: 'window', typeId: 'ot_j200', hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
const addDoor = (s: ProjectStore, hostId: string, offset: number) => s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });

/** Anel canônico: vértices arredondados, início no menor vértice e sentido fixo; independe de rotação e orientação. */
function canonRing(r: Ring): string {
  const pts = r.map((v) => `${Math.round(v.x * 1e6)},${Math.round(v.y * 1e6)}`);
  const n = pts.length;
  const fwd = pts.map((_, i) => [...pts.slice(i), ...pts.slice(0, i)].join(';'));
  const bwd = [...pts].reverse();
  const back = bwd.map((_, i) => [...bwd.slice(i), ...bwd.slice(0, i)].join(';'));
  void n;
  return [...fwd, ...back].sort()[0]!;
}
const canonPoly = (p: Polygon): string => p.map(canonRing).sort().join('|');

/** Volume por camada (teorema da divergência não é necessário: bandVolume já é área × altura, com inclinação). */
const volOf = (bs: LayerBand[]): number => bs.reduce((s, b) => s + bandVolume(b), 0);

/** Arestas que o 3D desenha (EdgesGeometry 28°): horizontais no interior da parede fora de qualquer peitoril/verga. */
function fakeHorizontalCreases(batches: Array<{ positions: number[]; normals: number[]; indices: number[] }>, w: { a: { x: number; y: number }; b: { x: number; y: number } }, baseZ: number, H: number, spans: Array<{ t0: number; t1: number; z0: number; z1: number }>): number {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
  const u = { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
  const tOf = (x: number, y: number): number => (x - w.a.x) * u.x + (y - w.a.y) * u.y;
  let fake = 0;
  for (const b of batches) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.normals, 3));
    g.setIndex(b.indices);
    const pos = new THREE.EdgesGeometry(g, 28).getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 2) {
      const z0 = pos.getZ(i);
      const z1 = pos.getZ(i + 1);
      if (Math.abs(z1 - z0) > 1e-6) continue;
      const ta = tOf(pos.getX(i), pos.getY(i));
      const tb = tOf(pos.getX(i + 1), pos.getY(i + 1));
      const lo = Math.min(ta, tb);
      const hi = Math.max(ta, tb);
      if (hi - lo < 0.01 || z0 < baseZ + 1e-4 || z0 > baseZ + H - 1e-4) continue;
      const legit = spans.some((s) => (Math.abs(z0 - s.z0) < 1e-4 || Math.abs(z0 - s.z1) < 1e-4) && lo >= s.t0 - 0.03 && hi <= s.t1 + 0.03);
      if (!legit) fake++;
    }
    g.dispose();
  }
  return fake;
}

/** Vãos do primeiro muro do nível em (t, z) absolutos, para classificar as arestas. */
function spansOf(s: ProjectStore, rw: ResolvedWall): Array<{ t0: number; t1: number; z0: number; z1: number }> {
  return openingsOfWall(s.project, rw.wallId).map((o) => {
    const t = s.project.openingTypes[o.typeId]!;
    const sl = openingSill(t, o);
    return { t0: o.offset - t.width / 2, t1: o.offset + t.width / 2, z0: rw.baseZ + sl, z1: rw.baseZ + sl + t.height };
  });
}

/** Prismas (pares faixa × polígono) de uma camada, depois da fusão. */
const prismsOf = (bs: LayerBand[]): number => bs.reduce((n, b) => n + b.poly.length, 0);

/** Pares de prismas vizinhos (z contíguo) com o mesmo anel: deveria ser zero após a fusão. */
function identicalAdjacent(bs: LayerBand[]): number {
  let n = 0;
  for (const a of bs)
    for (const b of bs) {
      if (a === b || Math.abs(a.z1 - b.z0) > 1e-6) continue;
      if (a.slope || b.slope) continue;
      for (const pa of a.poly) for (const pb of b.poly) if (canonPoly(pa) === canonPoly(pb)) n++;
    }
  return n;
}

function setupWall(build: (s: ProjectStore) => void): { s: ProjectStore; r: ResolvedLevel } {
  const s = new ProjectStore(createEmptyProject());
  build(s);
  return { s, r: resolveLevel(s.project, 'lv_0') };
}

describe('parede com janela e porta: fusão vertical das faixas', () => {
  const build = (s: ProjectStore) => {
    s.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
    addWin(s, 'a', 1.2);
    addDoor(s, 'a', 3.0);
  };

  it('o bloco (camada estrutural) fica com 6 prismas: 3 inteiros, 2 na faixa da janela, 1 na da porta', () => {
    const { r } = setupWall(build);
    const rw = r.walls['a']!;
    const bloco = rw.layers.find((l) => l.materialId === 'mat_bloco14')!;
    expect(prismsOf(bloco.bands)).toBe(8);
    expect(prismsOf(fuseBands(bloco.bands))).toBe(6);
  });

  it('por camada: nenhum par de prismas vizinhos com anel idêntico e z contíguo, e o número de prismas não passa do razoável', () => {
    const { r } = setupWall(build);
    for (const l of r.walls['a']!.layers) {
      const fused = fuseBands(l.bands);
      expect(identicalAdjacent(fused)).toBe(0);
      expect(prismsOf(fused)).toBeLessThanOrEqual(20);
    }
  });

  it('volume por camada inalterado (1e-9 m³) em relação às faixas de origem', () => {
    const { r } = setupWall(build);
    for (const l of r.walls['a']!.layers) expect(Math.abs(volOf(fuseBands(l.bands)) - volOf(l.bands))).toBeLessThan(1e-9);
  });

  it('fora do vão não há emenda horizontal no 3D (arestas de faixa só no peitoril e na verga)', () => {
    const { s, r } = setupWall(build);
    const rw = r.walls['a']!;
    const w = s.project.elements['a'] as unknown as { a: { x: number; y: number }; b: { x: number; y: number } };
    expect(fakeHorizontalCreases(buildLevelSolids(r).batches, w, rw.baseZ, rw.height, spansOf(s, rw))).toBe(0);
  });

  it('o quantitativo não depende da fusão: o volume do bloco vem das faixas de origem', () => {
    const { s, r } = setupWall(build);
    const bloco = r.walls['a']!.layers.find((l) => l.materialId === 'mat_bloco14')!;
    expect(quantifyLevel(s.project, r).volumeByMaterial['mat_bloco14']).toBeCloseTo(volOf(bloco.bands), 9);
  });
});

describe('parede girada: sem arestas falsas', () => {
  it('janela e porta numa parede inclinada: nenhuma emenda horizontal fora do vão e volume igual', () => {
    const { s, r } = setupWall((st) => {
      st.exec({ type: 'addWall', wall: wall('a', 0, 0, 3, 4) });
      addWin(st, 'a', 1.2);
      addDoor(st, 'a', 3.0);
    });
    const rw = r.walls['a']!;
    const w = s.project.elements['a'] as unknown as { a: { x: number; y: number }; b: { x: number; y: number } };
    expect(fakeHorizontalCreases(buildLevelSolids(r).batches, w, rw.baseZ, rw.height, spansOf(s, rw))).toBe(0);
    for (const l of rw.layers) {
      expect(identicalAdjacent(fuseBands(l.bands))).toBe(0);
      expect(Math.abs(volOf(fuseBands(l.bands)) - volOf(l.bands))).toBeLessThan(1e-9);
    }
  });
});

describe('topo inclinado e rodapé', () => {
  it('parede com perfil superior inclinado e janela: as faixas inclinadas só se fundem com o mesmo plano, volume igual', () => {
    const { r } = setupWall((st) => {
      st.exec({ type: 'addWall', wall: { ...wall('g', 0, 0, 6, 0), topProfile: [{ t: 0, h: 2.8 }, { t: 3, h: 4.5 }, { t: 6, h: 2.8 }] } });
      addWin(st, 'g', 1.5);
    });
    const rw = r.walls['g']!;
    for (const l of rw.layers) {
      const fused = fuseBands(l.bands);
      expect(Math.abs(volOf(fused) - volOf(l.bands))).toBeLessThan(1e-9);
      for (const b of fused) if (b.slope) expect(l.bands.some((o) => o.slope && JSON.stringify(o.slope) === JSON.stringify(b.slope))).toBe(true);
    }
  });

  it('rodapé (faixa de layerIndex negativo) não se funde com as camadas da parede e tem volume próprio', () => {
    const { r, s } = setupWall((st) => {
      st.exec({ type: 'addWall', wall: wall('a', 0, 0, 4, 0) });
      const base = st.project.wallTypes.wt_alv14!;
      st.exec({ type: 'upsertWallType', wallType: { ...base, strips: [{ id: 'st0', name: 'rodapé', side: 'interior', materialId: 'mat_madeira', thickness: 0.02, z0: 0, z1: 0.1 }] } });
      addWin(st, 'a', 1.2);
    });
    const rw = resolveLevel(s.project, 'lv_0').walls['a']!;
    const strip = rw.layers.find((l) => l.layerIndex < 0)!;
    expect(strip).toBeDefined();
    expect(rw.layers.filter((l) => l.layerIndex >= 0).every((l) => l.materialId !== 'mat_madeira')).toBe(true);
    expect(Math.abs(volOf(fuseBands(strip.bands)) - volOf(strip.bands))).toBeLessThan(1e-9);
    for (const l of rw.layers) expect(Math.abs(volOf(fuseBands(l.bands)) - volOf(l.bands))).toBeLessThan(1e-9);
  });
});
