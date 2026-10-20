import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeRoof, makeSlab, makeWall, openingsOfWall, wallBaseElevation, wallTopElevation, type Floor, type Opening, type Project, type Roof, type Slab, type Wall } from './index.ts';

const square = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }];
const TERREO = 'lv_0';
const PAV2 = 'lv_1';

/** Parede de 3 m no térreo (cota 0). */
function wallStore(extra: Partial<Wall> = {}): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: TERREO, a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, ...extra }) });
  return s;
}

const el = <T>(s: ProjectStore, id: string): T => s.project.elements[id] as unknown as T;
const cmd = (ids: string[], levelId: string, keep: 'elevation' | 'offset') => ({ type: 'setElementLevel' as const, ids, levelId, keep });

describe('troca de nível de parede (F5)', () => {
  it('mantendo a cota: baseOffset compensa e a base absoluta continua 0', () => {
    const s = wallStore();
    s.exec(cmd(['w'], PAV2, 'elevation'));
    const w = el<Wall>(s, 'w');
    expect(w.levelId).toBe(PAV2);
    expect(w.baseOffset).toBe(-3);
    expect(wallBaseElevation(s.project, w)).toBe(0);
  });

  it('levando o deslocamento: a base absoluta vai para a cota do novo nível (3)', () => {
    const s = wallStore();
    s.exec(cmd(['w'], PAV2, 'offset'));
    const w = el<Wall>(s, 'w');
    expect(w.levelId).toBe(PAV2);
    expect(w.baseOffset).toBe(0);
    expect(wallBaseElevation(s.project, w)).toBe(3);
  });

  it('com topo vinculado a um nível, o topo continua no mesmo nível e o deslocamento do topo não muda', () => {
    const s = wallStore({ topLevelId: PAV2, topOffset: 0.5 });
    const topoAntes = wallTopElevation(s.project, el<Wall>(s, 'w'));
    s.exec(cmd(['w'], PAV2, 'elevation'));
    const w = el<Wall>(s, 'w');
    expect(w.topOffset).toBe(0.5);
    expect(w.topLevelId).toBe(PAV2);
    expect(wallTopElevation(s.project, w)).toBe(topoAntes);
  });

  it('com altura livre, a cota do topo acompanha a base quando se leva o deslocamento', () => {
    const s = wallStore({ height: 2.8 });
    s.exec(cmd(['w'], PAV2, 'offset'));
    const w = el<Wall>(s, 'w');
    expect(wallTopElevation(s.project, w)).toBe(3 + 2.8);
  });

  it('paredes com aberturas continuam hospedando as aberturas', () => {
    const s = wallStore();
    const door: Opening = { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 1.5, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
    s.exec({ type: 'addOpening', opening: door });
    s.exec(cmd(['w'], PAV2, 'elevation'));
    expect(openingsOfWall(s.project, 'w').map((o) => o.id)).toEqual(['d']);
    expect((s.project.elements.d as Opening).hostId).toBe('w');
  });

  it('a troca fica num único passo de desfazer, com o rótulo "Mudar de nível"', () => {
    const s = wallStore();
    s.exec(cmd(['w'], PAV2, 'elevation'));
    expect(s.undoLabel).toBe('Mudar de nível');
    s.undo();
    const w = el<Wall>(s, 'w');
    expect(w.levelId).toBe(TERREO);
    expect(w.baseOffset).toBe(0);
  });
});

describe('troca de nível de piso, laje e telhado (F5)', () => {
  it('piso mantendo a cota: heightOffset compensa e o topo absoluto fica igual', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: TERREO, boundary: square, heightOffset: 0.1 }) });
    s.exec(cmd(['f'], PAV2, 'elevation'));
    const f = el<Floor>(s, 'f');
    expect(f.levelId).toBe(PAV2);
    expect(f.heightOffset).toBeCloseTo(-2.9, 10);
    expect(3 + f.heightOffset).toBeCloseTo(0.1, 10);
  });

  it('piso levando o deslocamento: heightOffset fica igual e o topo sobe com o nível', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: TERREO, boundary: square, heightOffset: 0.1 }) });
    s.exec(cmd(['f'], PAV2, 'offset'));
    const f = el<Floor>(s, 'f');
    expect(f.heightOffset).toBe(0.1);
    expect(3 + f.heightOffset).toBeCloseTo(3.1, 10);
  });

  it('laje mantendo a cota e levando o deslocamento', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addSlab', slab: makeSlab({ id: 'l', typeId: 'ls_mac12', levelId: TERREO, boundary: square }) });
    s.exec(cmd(['l'], PAV2, 'elevation'));
    expect(el<Slab>(s, 'l').heightOffset).toBe(-3);
    s.exec(cmd(['l'], TERREO, 'offset'));
    expect(el<Slab>(s, 'l')).toMatchObject({ levelId: TERREO, heightOffset: -3 });
  });

  it('telhado mantendo a cota e levando o deslocamento', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r', typeId: 'rt_ceramica', levelId: PAV2, boundary: square, heightOffset: 0.2 }) });
    s.exec(cmd(['r'], TERREO, 'elevation'));
    expect(el<Roof>(s, 'r')).toMatchObject({ levelId: TERREO, heightOffset: 3.2 });
    s.exec(cmd(['r'], PAV2, 'offset'));
    expect(el<Roof>(s, 'r')).toMatchObject({ levelId: PAV2, heightOffset: 3.2 });
  });
});

describe('validação do comando (F5)', () => {
  it('nível inexistente lança e o modelo não muda', () => {
    const s = wallStore();
    const antes = JSON.stringify(s.project.elements);
    expect(() => s.exec(cmd(['w'], 'lv_x', 'elevation'))).toThrow('Nível inexistente');
    expect(JSON.stringify(s.project.elements)).toBe(antes);
    expect(s.canUndo).toBe(true);
    expect(s.undoLabel).toBe('Criar parede');
  });

  it('elemento inexistente lança e nenhum outro da lista muda', () => {
    const s = wallStore();
    expect(() => s.exec(cmd(['w', 'nao_existe'], PAV2, 'elevation'))).toThrow('Elemento inexistente');
    expect(el<Wall>(s, 'w').levelId).toBe(TERREO);
  });

  it('abertura lança, pois não tem nível próprio', () => {
    const s = wallStore();
    s.exec({ type: 'addOpening', opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'w', offset: 1, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    expect(() => s.exec(cmd(['d'], PAV2, 'elevation'))).toThrow('Abertura');
  });

  it('ids repetidos são contados uma vez (não compensa duas vezes)', () => {
    const s = wallStore();
    s.exec(cmd(['w', 'w'], PAV2, 'elevation'));
    expect(el<Wall>(s, 'w').baseOffset).toBe(-3);
  });

  it('lista vazia não altera nada', () => {
    const s = wallStore();
    s.exec(cmd([], PAV2, 'elevation'));
    expect(el<Wall>(s, 'w').levelId).toBe(TERREO);
  });
});

describe('mistura de elementos num mesmo comando', () => {
  it('troca paredes, pisos e lajes juntos, cada um com a sua compensação', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: TERREO, a: { x: 0, y: 0 }, b: { x: 3, y: 0 } }) });
    s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f', typeId: 'ft_ceram', levelId: TERREO, boundary: square }) });
    s.exec(cmd(['w', 'f'], PAV2, 'elevation'));
    const p: Project = s.project;
    expect((p.elements.w as Wall).baseOffset).toBe(-3);
    expect((p.elements.f as Floor).heightOffset).toBe(-3);
    expect(p.elements.w).toMatchObject({ levelId: PAV2 });
    expect(p.elements.f).toMatchObject({ levelId: PAV2 });
  });
});
