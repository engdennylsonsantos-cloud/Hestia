import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeSlab, makeWall, type Floor, type Project, type Slab, type Wall } from '@hestia/model';
import { resolveLevel, wallZRange } from './index.ts';

type W = Omit<Wall, 'order'>;

/** Projeto com paredes, pisos e lajes, montados pelos comandos (como na aplicação). */
function build(walls: W[], floors: Array<Omit<Floor, 'order'>> = [], slabs: Array<Omit<Slab, 'order'>> = []): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  for (const f of floors) s.exec({ type: 'addFloor', floor: f });
  for (const x of slabs) s.exec({ type: 'addSlab', slab: x });
  return s.project;
}

/** Parede de 3 m de (0,0) a (3,0) no térreo; o ponto médio é (1,5; 0). */
const wall3 = (extra: Partial<W> = {}): W => makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 3, y: 0 }, height: 3, ...extra });

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Laje maciça de 12 cm (ls_mac12) cobrindo o ponto médio da parede. */
const slabAt = (extra: Partial<Slab> = {}): Omit<Slab, 'order'> =>
  makeSlab({ id: 'laje', typeId: 'ls_mac12', levelId: 'lv_0', boundary: rect(-1, -1, 4, 1), heightOffset: 0.05, ...extra });

const zOf = (p: Project) => wallZRange(p, p.elements.w1 as Wall);

describe('C1 · parede anexada à base na laje', () => {
  it('parede de 3 m sob laje horizontal de topo +0,05: base em 0,05 e altura 2,95', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [], [slabAt()]);
    const z = zOf(p);
    expect(z.z0).toBeCloseTo(0.05, 9);
    expect(z.height).toBeCloseTo(2.95, 9);
  });

  it('laje com 10 % de inclinação e ponto médio a 2 m da origem: topo da laje em 0,05 + 0,2', () => {
    // Origem em (-0,5; 0) com direção +x: o ponto médio (1,5; 0) está a 2 m dela, subida de 10 % = 0,2 m.
    const sloped = slabAt({ slope: { origin: { x: -0.5, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 } });
    const p = build([wall3({ attachBottomToFloor: true })], [], [sloped]);
    const z = zOf(p);
    expect(z.z0).toBeCloseTo(0.25, 9);
    expect(z.height).toBeCloseTo(2.75, 9);
  });

  it('a cota é a do ponto médio: a mesma laje inclinada dá outra base se a parede estiver em outro lugar', () => {
    // Parede de (2; 0) a (5; 0): ponto médio (3,5; 0), a 4 m da origem (-0,5; 0): subida de 10 % = 0,4 m, topo em 0,45.
    const slope = { origin: { x: -0.5, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 };
    const shifted = build([wall3({ attachBottomToFloor: true, a: { x: 2, y: 0 }, b: { x: 5, y: 0 } })], [], [slabAt({ boundary: rect(-1, -1, 7, 1), slope })]);
    expect(zOf(shifted).z0).toBeCloseTo(0.45, 9);
  });

  it('o engine usa a base da laje inclinada: baseZ e altura da parede resolvida', () => {
    const sloped = slabAt({ slope: { origin: { x: -0.5, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 } });
    const p = build([wall3({ attachBottomToFloor: true })], [], [sloped]);
    const rw = resolveLevel(p, 'lv_0').walls.w1!;
    expect(rw.baseZ).toBeCloseTo(0.25, 9);
    expect(rw.height).toBeCloseTo(2.75, 9);
  });

  it('laje de outro nível não conta', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [], [slabAt({ levelId: 'lv_1' })]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });

  it('laje que não cobre o ponto médio não conta', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [], [slabAt({ boundary: rect(10, 10, 12, 12) })]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });

  it('laje que deixaria a parede sem altura é ignorada', () => {
    const p = build([wall3({ attachBottomToFloor: true })], [], [slabAt({ heightOffset: 3 })]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });

  it('entre piso e laje que cobrem o ponto médio, a base usa o mais alto', () => {
    const floor = makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -1, 4, 1), heightOffset: 0.1 });
    const p = build([wall3({ attachBottomToFloor: true })], [floor], [slabAt({ heightOffset: 0.05 })]);
    expect(zOf(p).z0).toBeCloseTo(0.1, 9);
  });

  it('sem os flags, a laje não altera a parede', () => {
    const p = build([wall3({ attachBottomToFloor: false, attachTopToFloor: false })], [], [slabAt()]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });
});

describe('C1 · parede anexada ao topo na laje do nível de topo', () => {
  // Térreo em 0 m, pavimento 2 em 3 m: a parede vai do térreo até o pavimento 2, onde está a laje (topo em 3 m).
  const toLevel1 = (extra: Partial<W> = {}): W => wall3({ topLevelId: 'lv_1', attachTopToFloor: true, ...extra });

  it('o topo desce até a face inferior da laje do nível de topo', () => {
    const slab = slabAt({ levelId: 'lv_1', heightOffset: 0 });
    const p = build([toLevel1()], [], [slab]);
    const z = zOf(p);
    expect(z.z0).toBe(0);
    expect(z.height).toBeCloseTo(3 - 0.12, 9);
  });

  it('laje inclinada no topo: a face inferior vale no ponto médio', () => {
    // Topo em 3 m na origem (-0,5; 0), subida de 10 % ao ponto médio: face inferior = 3 + 0,2 - 0,12 = 3,08.
    const slab = slabAt({ levelId: 'lv_1', heightOffset: 0, slope: { origin: { x: -0.5, y: 0 }, dir: { x: 1, y: 0 }, percent: 10 } });
    const p = build([toLevel1()], [], [slab]);
    expect(zOf(p).height).toBeCloseTo(3.08, 9);
  });

  it('laje do térreo não serve para o topo', () => {
    const p = build([toLevel1()], [], [slabAt({ heightOffset: 0 })]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });

  it('parede com perfil superior não recebe o topo anexado', () => {
    const profiled = toLevel1({ height: 3, topProfile: [{ t: 0, h: 2.8 }, { t: 3, h: 2.8 }] });
    const p = build([profiled], [], [slabAt({ levelId: 'lv_1', heightOffset: 0 })]);
    expect(zOf(p)).toEqual({ z0: 0, height: 2.8 });
  });
});

describe('6.1 · o topo anexado não depende do lado da borda da laje', () => {
  // Laje ls_mac15 (0,02 + 0,15 = 0,17 m) no lv_1 (3,00 m), contorno sobre o eixo (0,0)–(4,0)–(4,4)–(0,4): a face
  // inferior fica em 3,00 − 0,17 = 2,83 m. O ponto médio de cada uma das quatro paredes cai EXATAMENTE sobre uma borda
  // da laje, e todas precisam ancorar em 2,83 m. Antes da correção (defeito 6.1 de C-montagem.md), a borda superior e a
  // direita davam 3,000 m, porque o ray-casting de `pointInRing` é ambíguo sobre a borda.
  const lajeNoEixo = makeSlab({ id: 'laje', typeId: 'ls_mac15', levelId: 'lv_1', boundary: rect(0, 0, 4, 4), heightOffset: 0 });
  const naBorda = (a: { x: number; y: number }, b: { x: number; y: number }): W => wall3({ a, b, height: 3, topLevelId: 'lv_1', attachTopToFloor: true });
  const casos: Array<[string, { x: number; y: number }, { x: number; y: number }]> = [
    ['borda superior', { x: 0, y: 4 }, { x: 4, y: 4 }],
    ['borda inferior', { x: 4, y: 0 }, { x: 0, y: 0 }],
    ['borda direita', { x: 4, y: 0 }, { x: 4, y: 4 }],
    ['borda esquerda', { x: 0, y: 4 }, { x: 0, y: 0 }],
  ];

  for (const [nome, a, b] of casos) {
    it(`${nome}: ponto médio sobre a borda ancora na face inferior da laje (2,83 m)`, () => {
      const p = build([naBorda(a, b)], [], [lajeNoEixo]);
      const z = zOf(p);
      expect(z.z0).toBe(0);
      expect(z.height).toBeCloseTo(3 - 0.17, 9);
    });
  }

  it('ponto médio fora da laje não ancora: só a borda passou a contar como coberta', () => {
    const p = build([naBorda({ x: 0, y: 5 }, { x: 4, y: 5 })], [], [lajeNoEixo]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });
  });
});
