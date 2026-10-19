import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Floor, type Project, type Wall } from '@hestia/model';
import { quantifyLevel, resolveAllFloors, resolveLevel, wallZRange } from './index.ts';

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

type W = Omit<Wall, 'order'>;

/** Projeto com paredes e pisos, montados pelos comandos (como na aplicação). */
function build(walls: W[], floors: Array<Omit<Floor, 'order'>> = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  return s.project;
}

/** Parede de 3 m de (0,0) a (3,0) no térreo, com o piso de +0,05 cobrindo o ponto médio (1,5; 0). */
const wall3 = (extra: Partial<W> = {}): W => makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, height: 3, ...extra });
const floorAt = (extra: Partial<Floor> = {}): Omit<Floor, 'order'> =>
  makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -1, 4, 1), heightOffset: 0.05, ...extra });

describe('parede anexada à base no piso', () => {
  it('parede de 3 m sobre piso de topo +0,05: base em 0,05 e altura 2,95', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [floorAt()]);
    const z = wallZRange(p, p.elements.w1 as Wall);
    expect(z.z0).toBeCloseTo(0.05, 9);
    expect(z.height).toBeCloseTo(2.95, 9);
  });

  it('o engine usa a base e a altura anexadas: baseZ, faces e volume', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [floorAt()]);
    const rw = resolveLevel(p, 'lv_0').walls.w1!;
    expect(rw.baseZ).toBeCloseTo(0.05, 9);
    expect(rw.height).toBeCloseTo(2.95, 9);
    const q = quantifyLevel(p, resolveLevel(p, 'lv_0')).walls[0]!;
    expect(q.height).toBeCloseTo(2.95, 9);
    expect(q.grossFaceArea).toBeCloseTo(3 * 2.95, 9);
  });

  it('sem piso que cubra o ponto médio, a parede fica como no modelo', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [floorAt({ boundary: rect(10, 10, 12, 12) })]);
    expect(wallZRange(p, p.elements.w1 as Wall)).toEqual({ z0: 0, height: 3 });
  });

  it('piso de outro nível não conta', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [floorAt({ levelId: 'lv_1' })]);
    expect(wallZRange(p, p.elements.w1 as Wall)).toEqual({ z0: 0, height: 3 });
  });

  it('piso que deixaria a parede sem altura é ignorado', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [floorAt({ heightOffset: 3 })]);
    expect(wallZRange(p, p.elements.w1 as Wall)).toEqual({ z0: 0, height: 3 });
  });

  it('com vários pisos cobrindo, a base usa o mais alto', () => {
    const p = build(
      [wall3({ attachBottomToFloor: true })],
      [floorAt({ id: 'f1', heightOffset: 0.05 }), floorAt({ id: 'f2', heightOffset: 0.2, boundary: rect(0, -0.5, 3, 0.5) })],
    );
    expect(wallZRange(p, p.elements.w1 as Wall).z0).toBeCloseTo(0.2, 9);
  });

  it('o ponto médio do arco (não o da corda) é o que vale', () => {
    // Arco com flecha de 1 m: o meio do arco está em (2; 1); a corda passa por (2; 0).
    const arcWall = wall3({ a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, sag: 1, attachBottomToFloor: true });
    const onArc = build([arcWall], [floorAt({ boundary: rect(1.5, 0.5, 2.5, 1.5) })]);
    expect(wallZRange(onArc, onArc.elements.w1 as Wall).z0).toBeCloseTo(0.05, 9);
    const onChordOnly = build([arcWall], [floorAt({ boundary: rect(1.5, -0.5, 2.5, 0.2) })]);
    expect(wallZRange(onChordOnly, onChordOnly.elements.w1 as Wall).z0).toBe(0);
  });
});

describe('parede anexada ao topo no piso do nível de topo', () => {
  // Térreo em 0 m, pavimento 2 em 3 m: parede do térreo até o pavimento 2, com a laje (piso do pavimento 2) de 0,19 m.
  const toLevel1 = (extra: Partial<W> = {}): W => wall3({ topLevelId: 'lv_1', attachTopToFloor: true, ...extra });
  const slab = (extra: Partial<Floor> = {}): Omit<Floor, 'order'> => floorAt({ id: 'laje', levelId: 'lv_1', heightOffset: 0, ...extra });

  it('o topo desce até a face inferior da laje do nível de topo', () => {
    const p = build([toLevel1()], [slab()]);
    const z = wallZRange(p, p.elements.w1 as Wall);
    expect(z.z0).toBe(0);
    expect(z.height).toBeCloseTo(3 - 0.19, 9);
  });

  it('laje abaixo da base não é usada', () => {
    const p = build([toLevel1()], [slab({ heightOffset: -2.99 })]);
    expect(wallZRange(p, p.elements.w1 as Wall)).toEqual({ z0: 0, height: 3 });
  });

  it('parede com perfil superior não recebe o topo anexado', () => {
    const profiled = toLevel1({ height: 3, topProfile: [{ t: 0, h: 2.8 }, { t: 3, h: 2.8 }] });
    const p = build([profiled], [slab()]);
    expect(wallZRange(p, p.elements.w1 as Wall)).toEqual({ z0: 0, height: 2.8 });
  });

  it('piso do topo é lido pelo engine na mesma cota (floors do projeto)', () => {
    const p = build([toLevel1()], [slab()]);
    const [f] = resolveAllFloors(p).filter((x) => x.levelId === 'lv_1');
    expect(f!.bottomZ).toBeCloseTo(3 - 0.19, 9);
  });
});

describe('sem os flags, nada muda', () => {
  it('flags falsos ou ausentes dão a base e a altura do modelo', () => {
    for (const extra of [{}, { attachBottomToFloor: false, attachTopToFloor: false }]) {
      const p = build([wall3(extra)], [floorAt()]);
      expect(wallZRange(p, p.elements.w1 as Wall)).toEqual({ z0: 0, height: 3 });
    }
  });

  it('com flags falsos, o piso não altera a resolução da parede', () => {
    const withFloor = build([wall3({ attachBottomToFloor: false, attachTopToFloor: false })], [floorAt()]);
    const noFloor = build([wall3({ attachBottomToFloor: false, attachTopToFloor: false })]);
    expect(resolveLevel(withFloor, 'lv_0')).toEqual(resolveLevel(noFloor, 'lv_0'));
  });
});
