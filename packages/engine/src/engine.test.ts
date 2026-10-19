import { describe, expect, it } from 'vitest';
import { multiArea, union } from '@hestia/geom';
import { ProjectStore, createEmptyProject, type Wall } from '@hestia/model';
import { quantifyLevel, resolveLevel } from './index.ts';

const T14 = 0.184;
const CORE14 = 0.14;

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Omit<Wall, 'order'> => ({
  id, kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by },
  baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter',
  flipped: false, noJoinStart: false, noJoinEnd: false, mark: '', comments: '', ...extra,
});

function setup(walls: Array<Omit<Wall, 'order'>>) {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  return s;
}

const silhouetteArea = (s: ProjectStore) => {
  const r = resolveLevel(s.project, 'lv_0');
  return multiArea(union(...r.clusters.map((c) => c.silhouette)));
};

const coreArea = (s: ProjectStore, matId = 'mat_bloco14') => {
  const r = resolveLevel(s.project, 'lv_0');
  return multiArea(union(...r.clusters.flatMap((c) => c.regions.filter((x) => x.materialId === matId).map((x) => x.polygons))));
};

describe('parede isolada', () => {
  it('área total e do núcleo', () => {
    const s = setup([wall('a', 0, 0, 4, 0)]);
    expect(silhouetteArea(s)).toBeCloseTo(4 * T14, 6);
    expect(coreArea(s)).toBeCloseTo(4 * CORE14, 6);
  });
  it('linha de localização desloca a parede inteira', () => {
    const s = setup([wall('a', 0, 0, 4, 0, { locationLine: 'finishExterior' })]);
    const r = resolveLevel(s.project, 'lv_0');
    const ys = r.walls.a!.layers.flatMap((l) => l.cut.flatMap((p) => p[0]!.map((v) => v.y)));
    expect(Math.max(...ys)).toBeCloseTo(0, 6); // face externa (esquerda) sobre a linha
    expect(Math.min(...ys)).toBeCloseTo(-T14, 6);
  });
  it('flipped inverte o lado externo', () => {
    const s = setup([wall('a', 0, 0, 4, 0, { locationLine: 'finishExterior', flipped: true })]);
    const r = resolveLevel(s.project, 'lv_0');
    const ys = r.walls.a!.layers.flatMap((l) => l.cut.flatMap((p) => p[0]!.map((v) => v.y)));
    expect(Math.min(...ys)).toBeCloseTo(0, 6);
    expect(Math.max(...ys)).toBeCloseTo(T14, 6);
  });
});

describe('junção em L', () => {
  const s = setup([wall('a', 0, 0, 4, 0), wall('b', 0, 0, 0, 3)]);
  it('silhueta é a união dos dois retângulos, sem furo nem sobra', () => {
    const expected = T14 * (4 + T14 / 2) + T14 * (3 + T14 / 2) - T14 * T14;
    expect(silhouetteArea(s)).toBeCloseTo(expected, 6);
  });
  it('núcleos se unem num só polígono (mesma prioridade e material)', () => {
    const r = resolveLevel(s.project, 'lv_0');
    const core = r.clusters[0]!.regions.find((x) => x.materialId === 'mat_bloco14')!;
    expect(core.polygons).toHaveLength(1);
  });
  it('acabamento externo contorna o canto sem ser cortado pela estrutura', () => {
    // Camada de tinta (mais externa) das duas paredes forma um L contínuo: um único polígono.
    const r = resolveLevel(s.project, 'lv_0');
    const tinta = r.clusters[0]!.regions.find((x) => x.materialId === 'mat_tinta')!;
    // externa + interna: dois L (um por lado) → 2 polígonos disjuntos
    expect(tinta.polygons).toHaveLength(2);
  });
  it('não há sobreposição entre camadas de materiais diferentes', () => {
    const r = resolveLevel(s.project, 'lv_0');
    const total = multiArea(union(...r.clusters.map((c) => c.silhouette)));
    const sum = Object.values(r.walls).flatMap((w) => w.layers).reduce((acc, l) => acc + multiArea(l.cut), 0);
    expect(sum).toBeCloseTo(total, 6);
  });
});

describe('junção em T', () => {
  const s = setup([wall('through', -3, 0, 3, 0), wall('branch', 0, 0, 0, 3)]);
  it('o ramal termina no centro da parede passante, sem atravessá-la', () => {
    const r = resolveLevel(s.project, 'lv_0');
    const ys = r.walls.branch!.layers.flatMap((l) => l.fragment.flatMap((p) => p[0]!.map((v) => v.y)));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(-1e-9);
  });
  it('não aparece estrutura do ramal do outro lado da parede passante', () => {
    const r = resolveLevel(s.project, 'lv_0');
    const ys = r.clusters[0]!.silhouette.flatMap((p) => p[0]!.map((v) => v.y));
    expect(Math.min(...ys)).toBeCloseTo(-T14 / 2, 6);
  });
  it('estrutura do ramal funde com a da parede passante', () => {
    const r = resolveLevel(s.project, 'lv_0');
    const core = r.clusters[0]!.regions.find((x) => x.materialId === 'mat_bloco14')!;
    expect(core.polygons).toHaveLength(1);
    const expected = 6 * CORE14 + (3 - CORE14 / 2) * CORE14;
    expect(multiArea(core.polygons)).toBeCloseTo(expected, 6);
  });
});

describe('cruzamento em X e continuação', () => {
  it('X funde a estrutura sem duplicar área', () => {
    const s = setup([wall('h', -2, 0, 2, 0), wall('v', 0, -2, 0, 2)]);
    const expected = 4 * CORE14 * 2 - CORE14 * CORE14;
    expect(coreArea(s)).toBeCloseTo(expected, 6);
  });
  it('duas paredes colineares formam uma só parede contínua', () => {
    const s = setup([wall('a', 0, 0, 2, 0), wall('b', 2, 0, 5, 0)]);
    expect(silhouetteArea(s)).toBeCloseTo(5 * T14, 6);
  });
  it('tipos diferentes: a estrutura de maior prioridade corta o acabamento do vizinho', () => {
    const s = setup([wall('a', 0, 0, 4, 0), wall('b', 2, -2, 2, 0, { typeId: 'wt_alv9' })]);
    const r = resolveLevel(s.project, 'lv_0');
    expect(Object.keys(r.walls)).toHaveLength(2);
    const sum = Object.values(r.walls).flatMap((w) => w.layers).reduce((acc, l) => acc + multiArea(l.cut), 0);
    expect(sum).toBeCloseTo(multiArea(union(...r.clusters.map((c) => c.silhouette))), 6);
  });
});

describe('aberturas', () => {
  const build = () => {
    const s = setup([wall('a', 0, 0, 4, 0)]);
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'a', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    s.exec({ type: 'addOpening', opening: { id: 'j', kind: 'window', typeId: 'ot_j120', hostId: 'a', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    return s;
  };
  it('recorta todas as camadas em planta', () => {
    const s = build();
    expect(silhouetteArea(s)).toBeCloseTo((4 - 0.8 - 1.2) * T14, 6);
  });
  it('3D: janela deixa peça abaixo do peitoril e acima da verga; porta só acima', () => {
    const s = build();
    const rw = resolveLevel(s.project, 'lv_0').walls.a!;
    const j = rw.pieces.filter((p) => p.openingId === 'j');
    const d = rw.pieces.filter((p) => p.openingId === 'd');
    expect(j.some((p) => p.z0 === 0 && Math.abs(p.z1 - 1.1) < 1e-9)).toBe(true);
    expect(j.some((p) => Math.abs(p.z0 - 2.3) < 1e-9 && Math.abs(p.z1 - 2.8) < 1e-9)).toBe(true);
    expect(d.every((p) => p.z0 > 2)).toBe(true);
  });
  it('quantitativos: volume do bloco e área líquida', () => {
    const s = build();
    const q = quantifyLevel(s.project, resolveLevel(s.project, 'lv_0'));
    const w = q.walls[0]!;
    expect(w.grossFaceArea).toBeCloseTo(4 * 2.8, 6);
    expect(w.openingsArea).toBeCloseTo(0.8 * 2.1 + 1.2 * 1.2, 6);
    // volume do bloco = (comprimento líquido do vão cheio) + peças
    const expected = CORE14 * (4 * 2.8 - 0.8 * 2.1 - 1.2 * 1.2);
    expect(q.volumeByMaterial.mat_bloco14).toBeCloseTo(expected, 6);
  });
});

describe('cache', () => {
  it('resultado idêntico em chamadas repetidas e muda ao mover', () => {
    const s = setup([wall('a', 0, 0, 4, 0), wall('b', 0, 0, 0, 3)]);
    const r1 = resolveLevel(s.project, 'lv_0');
    const r2 = resolveLevel(s.project, 'lv_0');
    expect(r2.clusters[0]!.silhouette).toBe(r1.clusters[0]!.silhouette);
    s.exec({ type: 'setWallEnds', id: 'b', b: { x: 0, y: 5 } });
    expect(multiArea(resolveLevel(s.project, 'lv_0').clusters[0]!.silhouette)).toBeGreaterThan(multiArea(r1.clusters[0]!.silhouette));
  });
});

describe('modelos iniciais', () => {
  it.each(['house2', 'studio'] as const)('%s resolve, tem aberturas e nenhuma sobreposição de camadas', async (id) => {
    const { buildTemplate } = await import('@hestia/model');
    const p = buildTemplate(id);
    const r = resolveLevel(p, 'lv_0');
    expect(Object.keys(r.walls).length).toBeGreaterThan(5);
    const layers = Object.values(r.walls).flatMap((w) => w.layers);
    const sum = layers.reduce((a, l) => a + multiArea(l.cut), 0);
    const sil = multiArea(union(...r.clusters.map((c) => c.silhouette)));
    expect(sum).toBeCloseTo(sil, 5);
    const q = quantifyLevel(p, r);
    expect(q.walls.every((w) => w.netFaceArea > 0)).toBe(true);
  });
});
