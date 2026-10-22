import { describe, expect, it } from 'vitest';
import { ProjectStore, SCHEMA_VERSION, createEmptyProject, makeFloor, makeSlab, migrateProject, type Floor, type Project } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function projectWithLinkedFloor(): ProjectStore {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } }) });
  return store;
}

describe('comandos de vínculo do contorno (decisão 0023 §8.2a)', () => {
  it('addFloor guarda a origem do contorno quando criado por paredes', () => {
    const store = projectWithLinkedFloor();
    const f = store.project.elements.f1 as Floor;
    expect(f.outlineSource).toEqual({ mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true });
  });

  it('detachOutline solta o vínculo e o desfazer restaura', () => {
    const store = projectWithLinkedFloor();
    store.exec({ type: 'detachOutline', id: 'f1' });
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(false);
    store.undo();
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(true);
  });

  it('relinkOutline revincula e o desfazer desfaz', () => {
    const store = projectWithLinkedFloor();
    store.exec({ type: 'detachOutline', id: 'f1' });
    store.exec({ type: 'relinkOutline', id: 'f1' });
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(true);
    store.undo();
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(false);
  });

  it('detachOutline em piso sem origem não faz nada; em não-piso/laje lança', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
    expect(() => store.exec({ type: 'detachOutline', id: 'f1' })).not.toThrow();
    expect((store.project.elements.f1 as Floor).outlineSource).toBeUndefined();
    store.exec({ type: 'addWall', wall: { id: 'w1', kind: 'wall', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, baseOffset: 0, topLevelId: null, height: 2.8, topOffset: 0, locationLine: 'wallCenter', flipped: false, noJoinStart: false, noJoinEnd: false, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false }, sag: 0, topProfile: null, mark: '', comments: '' } });
    expect(() => store.exec({ type: 'detachOutline', id: 'w1' })).toThrow();
  });

  it('relinkOutline sem origem lança', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 6, 4) }) });
    expect(() => store.exec({ type: 'relinkOutline', id: 'l1' })).toThrow();
  });
});

describe('edição manual solta o vínculo (decisão 0023 §8.2b)', () => {
  it('mover um piso vinculado solta o vínculo; copiar herda a origem', () => {
    const store = projectWithLinkedFloor();
    store.exec({ type: 'transform', ids: ['f1'], transform: { kind: 'translate', d: { x: 1, y: 0 } } });
    expect((store.project.elements.f1 as Floor).outlineSource!.linked).toBe(false);

    const linked = new ProjectStore(createEmptyProject());
    linked.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3), outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true } }) });
    linked.exec({ type: 'transform', ids: ['f1'], transform: { kind: 'translate', d: { x: 1, y: 0 } }, copy: { idMap: { f1: 'f2' } } });
    expect((linked.project.elements.f2 as Floor).outlineSource).toEqual({ mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true });
  });
});

describe('migração v18 → v19 (decisão 0023 §11)', () => {
  it('arquivo v18 abre com piso e laje estáticos (sem origem) e o contorno preservado', () => {
    const store = new ProjectStore(createEmptyProject());
    store.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(0, 0, 4, 3) }) });
    store.exec({ type: 'addSlab', slab: makeSlab({ id: 'l1', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(0, 0, 6, 4) }) });
    const legacy = JSON.parse(JSON.stringify(store.project)) as Project & { schemaVersion: number };
    legacy.schemaVersion = 18;
    const m = migrateProject(legacy);
    expect(m.schemaVersion).toBe(SCHEMA_VERSION);
    expect((m.elements.f1 as Floor).outlineSource).toBeUndefined();
    expect((m.elements.l1 as Extract<typeof m.elements[string], { kind: 'slab' }>).outlineSource).toBeUndefined();
    expect((m.elements.f1 as Floor).boundary).toEqual(rect(0, 0, 4, 3));
  });

  it('ida e volta preserva a origem e o vínculo de um piso associativo', () => {
    const store = projectWithLinkedFloor();
    const original: Project = store.project;
    const back = migrateProject(JSON.parse(JSON.stringify(original)));
    expect(back.elements.f1).toEqual(original.elements.f1);
    expect((back.elements.f1 as Floor).outlineSource).toEqual({ mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true });
  });
});
