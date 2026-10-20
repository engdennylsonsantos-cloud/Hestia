import { describe, expect, it } from 'vitest';
import { DEFAULT_JOIN, ProjectStore, createEmptyProject, makeWall, openingsOfWall, wallsOnLevel, type Opening, type Project, type Wall } from './index.ts';

const wall = (id: string, ax: number, ay: number, bx: number, by: number, extra: Partial<Wall> = {}): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by }, ...extra });

const opening = (id: string, hostId: string, typeId: string, offset: number): Opening => ({
  id,
  kind: typeId === 'ot_p80' ? 'door' : 'window',
  typeId,
  hostId,
  offset,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
});

function setup(extra: Partial<Wall> = {}): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: wall('w', 0, 0, 6, 0, extra) });
  return s;
}

const el = (s: ProjectStore, id: string): Wall => s.project.elements[id] as Wall;
const byId = (p: Project, id: string): Wall => p.elements[id] as Wall;

describe('dividir parede', () => {
  it('divide sem intervalo em duas paredes contíguas', () => {
    const s = setup();
    const before = s.project.nextOrder;
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 2 });
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(2);
    expect(el(s, 'w').a).toEqual({ x: 0, y: 0 });
    expect(el(s, 'w').b.x).toBeCloseTo(2);
    expect(el(s, 'w2').a.x).toBeCloseTo(2);
    expect(el(s, 'w2').b).toEqual({ x: 6, y: 0 });
    expect(el(s, 'w2').order).toBe(before);
    expect(s.project.nextOrder).toBe(before + 1);
  });

  it('com intervalo remove o trecho do meio', () => {
    const s = setup();
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 2, gap: 0.5 });
    expect(el(s, 'w').b.x).toBeCloseTo(1.75);
    expect(el(s, 'w2').a.x).toBeCloseTo(2.25);
    expect(el(s, 'w2').b.x).toBeCloseTo(6);
  });

  it('a nova parede copia todas as propriedades da original', () => {
    const s = setup({ height: 3.1, mark: 'P-7', comments: 'teste', flipped: true, baseOffset: 0.2 });
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 3 });
    const copy = el(s, 'w2');
    expect(copy.height).toBe(3.1);
    expect(copy.mark).toBe('P-7');
    expect(copy.comments).toBe('teste');
    expect(copy.flipped).toBe(true);
    expect(copy.baseOffset).toBe(0.2);
    expect(copy.typeId).toBe('wt_alv14');
    expect(copy.levelId).toBe('lv_0');
    expect(copy.locationLine).toBe(el(s, 'w').locationLine);
  });

  it('herda junções: a original recebe encosto na ponta nova e a nova herda a ponta antiga', () => {
    const s = setup({ joinStart: { kind: 'miter', flip: true }, noJoinEnd: true, joinEnd: { kind: 'butt', flip: true } });
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 2 });
    expect(el(s, 'w').joinStart).toEqual({ kind: 'miter', flip: true });
    expect(el(s, 'w').noJoinStart).toBe(false);
    expect(el(s, 'w').joinEnd).toEqual(DEFAULT_JOIN);
    expect(el(s, 'w').noJoinEnd).toBe(false);
    expect(el(s, 'w2').joinStart).toEqual(DEFAULT_JOIN);
    expect(el(s, 'w2').joinEnd).toEqual({ kind: 'butt', flip: true });
    expect(el(s, 'w2').noJoinEnd).toBe(true);
  });

  it('redistribui aberturas: as antes do corte ficam, as depois migram com offset recalculado', () => {
    const s = setup();
    s.exec({ type: 'addOpening', opening: opening('d1', 'w', 'ot_p80', 1) });
    s.exec({ type: 'addOpening', opening: opening('d2', 'w', 'ot_p80', 2.8) });
    s.exec({ type: 'addOpening', opening: opening('j1', 'w', 'ot_j120', 4) });
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 3 });
    expect(openingsOfWall(s.project, 'w').map((o) => o.id)).toEqual(['d1']);
    expect(openingsOfWall(s.project, 'w2').map((o) => o.id)).toEqual(['j1']);
    expect((s.project.elements.j1 as Opening).offset).toBeCloseTo(1);
    expect(s.project.elements.d2).toBeUndefined();
  });

  it('remove aberturas que caem no intervalo removido e as que não cabem na nova parede', () => {
    const s = setup();
    s.exec({ type: 'addOpening', opening: opening('d1', 'w', 'ot_p80', 1) });
    s.exec({ type: 'addOpening', opening: opening('d2', 'w', 'ot_p80', 2.8) });
    s.exec({ type: 'addOpening', opening: opening('j1', 'w', 'ot_j120', 4.2) });
    s.exec({ type: 'addOpening', opening: opening('j2', 'w', 'ot_j120', 3.8) });
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 3, gap: 1 });
    expect(openingsOfWall(s.project, 'w').map((o) => o.id)).toEqual(['d1']);
    expect(openingsOfWall(s.project, 'w2').map((o) => o.id)).toEqual(['j1']);
    expect(s.project.elements.d2).toBeUndefined();
    expect(s.project.elements.j2).toBeUndefined();
    expect((s.project.elements.j1 as Opening).offset).toBeCloseTo(0.7);
  });

  it('recusa parede curva com a mensagem da regra', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: wall('w', 0, 0, 6, 0, { sag: 0.5 }) });
    expect(() => s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 2 })).toThrow('Dividir parede curva ainda não é suportado');
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(1);
  });

  it('recusa ponto de corte fora da parede ou trecho que não sobra', () => {
    const s = setup();
    const snapshot = JSON.stringify(s.project);
    expect(() => s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 0 })).toThrow('Ponto de corte inválido');
    expect(() => s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 6 })).toThrow('Ponto de corte inválido');
    expect(() => s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 0.2, gap: 0.5 })).toThrow('Ponto de corte inválido');
    expect(() => s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: Number.NaN })).toThrow('Ponto de corte inválido');
    expect(JSON.stringify(s.project)).toBe(snapshot);
  });

  it('recusa identificador já existente', () => {
    const s = setup();
    s.exec({ type: 'addWall', wall: wall('w2', 0, 5, 6, 5) });
    expect(() => s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 2 })).toThrow('Identificador da nova parede já existe');
  });

  it('desfazer volta exatamente ao estado anterior, com rótulo próprio', () => {
    const s = setup();
    s.exec({ type: 'addOpening', opening: opening('d1', 'w', 'ot_p80', 1) });
    s.exec({ type: 'addOpening', opening: opening('j1', 'w', 'ot_j120', 4) });
    const before = JSON.stringify(s.project);
    s.exec({ type: 'splitWall', id: 'w', newId: 'w2', t: 3, gap: 0.4 });
    expect(s.undoLabel).toBe('Dividir parede');
    s.undo();
    expect(JSON.stringify(s.project)).toBe(before);
    s.redo();
    expect(wallsOnLevel(s.project, 'lv_0')).toHaveLength(2);
    expect(byId(s.project, 'w2')).toBeDefined();
  });
});
