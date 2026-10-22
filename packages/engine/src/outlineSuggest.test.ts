import { describe, expect, it } from 'vitest';
import { multiArea, polygonArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, buildTemplate, createEmptyProject, isFloor, isSlab, makeFloor, makeSlab, makeWall, totalThickness, type Floor, type Project, type Slab } from '@hestia/model';
import { enclosedRooms, interiorPoint, outlineElementsOfLevel, resolveFloors, suggestOutlineBatch, suggestOutlineSource } from './index.ts';

/** Retângulo de paredes com o eixo na borda, fechando um cômodo w × h (parede wt_alv14). */
function rectRoom(store: ProjectStore, levelId: string, w: number, h: number, x0 = 0, y0 = 0): void {
  const pts = [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }];
  pts.forEach((a, i) => store.exec({ type: 'addWall', wall: makeWall({ id: `w${x0}_${y0}_${i}`, typeId: 'wt_alv14', levelId, a, b: pts[(i + 1) % 4]! }) }));
}

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Piso por croqui (sem origem) com o contorno dado. */
function sketchFloor(store: ProjectStore, id: string, boundary: Vec2[], levelId = 'lv_0'): void {
  store.exec({ type: 'addFloor', floor: makeFloor({ id, typeId: 'ft_ceram', levelId, boundary }) });
}

const floorOf = (p: Project, id: string): Floor => p.elements[id] as Floor;

describe('sugestão de vínculo do contorno (decisão 0023 §8.2a)', () => {
  it('interiorPoint cai dentro do polígono e longe da borda', () => {
    const q = interiorPoint([rect(0, 0, 4, 2)])!;
    expect(q.x).toBeCloseTo(2, 1);
    expect(q.y).toBeCloseTo(1, 1);
    expect(interiorPoint([rect(0, 0, 0, 0)])).toBeNull();
  });

  it('piso de croqui exatamente sobre o espaço entre as faces é walls-finish com diferença zero', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    const room = enclosedRooms(store.project, 'lv_0', 'finish')[0]!;
    sketchFloor(store, 'f1', room[0]!);
    const s = suggestOutlineSource(store.project, floorOf(store.project, 'f1'))!;
    expect(s.source.mode).toBe('walls-finish');
    expect(s.source.linked).toBe(true);
    expect(s.diferencia.m2).toBeCloseTo(0, 9);
    expect(s.confianca).toBeCloseTo(1, 9);
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    expect(s.areaDerivada).toBeCloseTo((4 - t) * (3 - t), 6);
  });

  it('piso até o núcleo das paredes é walls-core', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    const core = enclosedRooms(store.project, 'lv_0', 'core')[0]!;
    sketchFloor(store, 'f1', core[0]!);
    const s = suggestOutlineSource(store.project, floorOf(store.project, 'f1'))!;
    expect(s.source.mode).toBe('walls-core');
    expect(s.diferencia.m2).toBeCloseTo(0, 9);
  });

  it('laje do perímetro externo é perimeter', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    const outer = [{ x: -t / 2, y: -t / 2 }, { x: 4 + t / 2, y: -t / 2 }, { x: 4 + t / 2, y: 3 + t / 2 }, { x: -t / 2, y: 3 + t / 2 }];
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac15', levelId: 'lv_0', boundary: outer }) });
    const s = suggestOutlineSource(store.project, store.project.elements.s1 as Slab)!;
    expect(s.source.mode).toBe('perimeter');
    expect(s.diferencia.m2).toBeCloseTo(0, 6);
  });

  it('contorno aleatório sem correspondência com as paredes devolve null', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    sketchFloor(store, 'f1', [{ x: 0.7, y: 0.4 }, { x: 3.1, y: 0.2 }, { x: 2.2, y: 2.6 }]);
    expect(suggestOutlineSource(store.project, floorOf(store.project, 'f1'))).toBeNull();
  });

  it('sem paredes no nível não há sugestão', () => {
    const store = new ProjectStore(createEmptyProject());
    sketchFloor(store, 'f1', rect(0, 0, 2, 2));
    expect(suggestOutlineSource(store.project, floorOf(store.project, 'f1'))).toBeNull();
  });

  it('preserva os furos manuais na área e no contorno resultante', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    const room = enclosedRooms(store.project, 'lv_0', 'finish')[0]!;
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: room[0]!, holes: [rect(1, 1, 1.5, 1.5)] }) });
    const s = suggestOutlineSource(store.project, floorOf(store.project, 'f1'))!;
    expect(s.diferencia.m2).toBeCloseTo(0, 9);
    expect(multiArea([s.polygon])).toBeCloseTo(s.areaDerivada, 9);
  });

  it('lote: dois vinculáveis e um sem correspondência, com a variação somada', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    rectRoom(store, 'lv_0', 2, 2, 10, 0);
    const a = enclosedRooms(store.project, 'lv_0', 'finish').find((r) => r[0]![0]!.x < 1)!;
    const b = enclosedRooms(store.project, 'lv_0', 'finish').find((r) => r[0]![0]!.x > 9)!;
    sketchFloor(store, 'fa', a[0]!);
    sketchFloor(store, 'fb', b[0]!);
    sketchFloor(store, 'fx', [{ x: 0.7, y: 0.4 }, { x: 3.1, y: 0.2 }, { x: 2.2, y: 2.6 }]);
    const els = outlineElementsOfLevel(store.project, 'lv_0');
    expect(els.map((e) => e.id).sort()).toEqual(['fa', 'fb', 'fx']);
    const batch = suggestOutlineBatch(store.project, els);
    expect(batch.vinculaveis.map((v) => v.id).sort()).toEqual(['fa', 'fb']);
    expect(batch.semCorrespondencia).toEqual(['fx']);
    expect(batch.diferencia.m2).toBeCloseTo(0, 9);
  });

  it('um piso vinculado não entra na lista de estáticos do nível', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 1, 1), outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } }) });
    expect(outlineElementsOfLevel(store.project, 'lv_0')).toEqual([]);
    expect(outlineElementsOfLevel(store.project, 'lv_0', false)).toHaveLength(1);
  });

  it('a sugestão aplicada acompanha a parede movida (mesma área de resolveFloors)', () => {
    const store = new ProjectStore(createEmptyProject());
    rectRoom(store, 'lv_0', 4, 3);
    const room = enclosedRooms(store.project, 'lv_0', 'finish')[0]!;
    sketchFloor(store, 'f1', room[0]!);
    const s = suggestOutlineSource(store.project, floorOf(store.project, 'f1'))!;
    store.exec({ type: 'updateElements', ids: ['f1'], patch: { boundary: s.polygon[0]!, outlineSource: s.source } });
    const area = (): number => multiArea(resolveFloors(store.project, 'lv_0').find((r) => r.floorId === 'f1')!.polygon);
    const t = totalThickness(store.project.wallTypes.wt_alv14!);
    expect(area()).toBeCloseTo((4 - t) * (3 - t), 6);
    // Move a parede direita (x = 4) para x = 5, levando os cantos.
    const direita = Object.values(store.project.elements).filter((e) => e.kind === 'wall' && e.a.x === 4 && e.b.x === 4);
    expect(direita.length).toBe(1);
    store.exec({ type: 'updateElements', ids: [direita[0]!.id], patch: { a: { x: 5, y: 0 }, b: { x: 5, y: 3 } } });
    for (const w of Object.values(store.project.elements)) {
      if (w.kind !== 'wall') continue;
      const patch: Partial<typeof w> = {};
      if (w.a.x === 4) patch.a = { x: 5, y: w.a.y };
      if (w.b.x === 4) patch.b = { x: 5, y: w.b.y };
      if (Object.keys(patch).length) store.exec({ type: 'updateElements', ids: [w.id], patch });
    }
    expect(area()).toBeCloseTo((5 - t) * (3 - t), 6);
    expect(polygonArea(s.polygon)).toBeCloseTo(s.areaDerivada, 9);
  });

  it('casa de alto padrão: só a laje do pavimento 2 casa; os dois pisos do térreo ficam sem correspondência', () => {
    const p = buildTemplate('house-premium');
    const els = Object.values(p.elements).filter((e): e is Floor | Slab => isFloor(e) || isSlab(e));
    const batch = suggestOutlineBatch(p, els);
    expect(els.map((e) => e.id).sort()).toEqual(['F-T-01', 'F-T-02', 'L-P2-01']);
    expect(batch.vinculaveis.map((v) => v.id)).toEqual(['L-P2-01']);
    expect(batch.vinculaveis[0]!.suggestion.source.mode).toBe('perimeter');
    expect(batch.semCorrespondencia.sort()).toEqual(['F-T-01', 'F-T-02']);
    // Medido: a laje casa com diferença zero; os pisos do térreo ficam no eixo das paredes (garagem 0,94 < 0,95).
    expect(batch.diferencia.m2).toBeCloseTo(0, 6);
  });
});
