import { describe, expect, it } from 'vitest';
import { rotate, type Vec2 } from '@hestia/geom';
import { isCeiling, makeCeiling, makeFloor, openingsOfWall, wallsOnLevel, type Wall } from '@hestia/model';
import { radialAngles, linearStep } from './arrayRadial.ts';
import { clickAt, drawWall, makeEnv, P, tool, walls } from './testEnv.ts';

const deg = (d: number): number => (d * Math.PI) / 180;
const near = (a: Vec2, b: Vec2): void => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('ângulos da matriz radial', () => {
  it('Último com 360° e 6 itens: o total se divide pelos 6 itens (sem sobrepor o primeiro)', () => {
    const a = radialAngles(6, 360, 'last');
    expect(a).toHaveLength(6);
    a.forEach((v, i) => expect(v).toBeCloseTo(deg(60 * i), 9));
  });
  it('Segundo: o ângulo informado é o do 1º ao 2º item', () => {
    const a = radialAngles(4, 90, 'second');
    [0, 90, 180, 270].forEach((g, i) => expect(a[i]).toBeCloseTo(deg(g), 9));
  });
  it('Último com 90°: o total vai do 1º ao último item (dividido por N-1)', () => {
    const a = radialAngles(4, 90, 'last');
    [0, 30, 60, 90].forEach((g, i) => expect(a[i]).toBeCloseTo(deg(g), 9));
  });
  it('Último com 180° e 3 itens', () => {
    const a = radialAngles(3, 180, 'last');
    expect(a[2]).toBeCloseTo(deg(180), 9);
  });
});

describe('espaçamento linear com Segundo e Último', () => {
  it('Segundo mantém o vetor digitado; Último divide pelo número de intervalos', () => {
    expect(linearStep({ x: 3, y: 0 }, 3, 'second')).toEqual({ x: 3, y: 0 });
    const s = linearStep({ x: 3, y: 0 }, 4, 'last');
    expect(s.x).toBeCloseTo(1, 9);
    expect(s.y).toBeCloseTo(0, 9);
  });
});

describe('matriz radial no motor', () => {
  it('360° com 6 itens: cada cópia gira em torno do centro, em passo único de desfazer', () => {
    const { store, env, options } = makeEnv();
    drawWall(env, [2, 0], [3, 0]);
    const original = walls(store)[0]!;
    env.setSelection([original.id]);
    options.arrayKind = 'radial';
    options.arrayCount = 6;
    options.arrayAngle = 360;
    options.arrayAnchor = 'last';
    const a = tool('array', env);
    clickAt(a, 0, 0); // centro
    a.click(P(0, 0)); // confirma com as opções da barra
    expect(walls(store)).toHaveLength(6);
    const esperados = Array.from({ length: 5 }, (_, i) => rotate({ x: 2, y: 0 }, deg(60 * (i + 1)), { x: 0, y: 0 }));
    for (const e of esperados) {
      const achou = walls(store).some((w: Wall) => Math.abs(w.a.x - e.x) < 1e-6 && Math.abs(w.a.y - e.y) < 1e-6);
      expect(achou).toBe(true);
    }
    store.undo();
    expect(walls(store)).toHaveLength(1);
  });

  it('90° Segundo com 3 itens: a segunda cópia fica a 90° e a terceira a 180°', () => {
    const { store, env, options } = makeEnv();
    drawWall(env, [2, 0], [3, 0]);
    env.setSelection([walls(store)[0]!.id]);
    options.arrayKind = 'radial';
    options.arrayCount = 3;
    options.arrayAngle = 90;
    options.arrayAnchor = 'second';
    const a = tool('array', env);
    clickAt(a, 0, 0);
    a.click(P(0, 0));
    expect(walls(store)).toHaveLength(3);
    const pontos = walls(store).map((w) => w.a);
    near(pontos.find((p) => Math.abs(p.x) < 1e-6 && Math.abs(p.y - 2) < 1e-6)!, { x: 0, y: 2 });
    near(pontos.find((p) => Math.abs(p.x + 2) < 1e-6 && Math.abs(p.y) < 1e-6)!, { x: -2, y: 0 });
  });

  it('digitar o ângulo + Enter confirma a matriz radial', () => {
    const { store, env, options } = makeEnv();
    drawWall(env, [2, 0], [3, 0]);
    env.setSelection([walls(store)[0]!.id]);
    options.arrayKind = 'radial';
    options.arrayCount = 4;
    options.arrayAngle = 360;
    options.arrayAnchor = 'second';
    const a = tool('array', env);
    clickAt(a, 0, 0);
    expect(a.type('90')).toBe(true);
    expect(walls(store)).toHaveLength(4);
  });

  it('a cópia leva o piso e a abertura hospedada, e tudo volta num único desfazer', () => {
    const { store, env, options } = makeEnv();
    drawWall(env, [2, 0], [3, 0]);
    const w = walls(store)[0]!;
    const door = tool('door', env);
    clickAt(door, 2.5, 0);
    door.cancel();
    const piso = makeFloor({ id: 'fl_teste', typeId: 'ft_ceram', levelId: 'lv_0', boundary: [{ x: 2, y: -0.5 }, { x: 3, y: -0.5 }, { x: 3, y: 0.5 }, { x: 2, y: 0.5 }] });
    store.exec({ type: 'addFloor', floor: piso });
    env.setSelection([w.id, 'fl_teste']);
    options.arrayKind = 'radial';
    options.arrayCount = 4;
    options.arrayAngle = 360;
    options.arrayAnchor = 'last';
    const a = tool('array', env);
    clickAt(a, 0, 0);
    a.click(P(0, 0));
    const paredes = wallsOnLevel(store.project, 'lv_0');
    expect(paredes).toHaveLength(4);
    const comPorta = paredes.filter((p: Wall) => openingsOfWall(store.project, p.id).length === 1);
    expect(comPorta).toHaveLength(4);
    const pisos = Object.values(store.project.elements).filter((e) => e.kind === 'floor');
    expect(pisos).toHaveLength(4);
    store.undo();
    expect(wallsOnLevel(store.project, 'lv_0')).toHaveLength(1);
    expect(Object.values(store.project.elements).filter((e) => e.kind === 'floor')).toHaveLength(1);
  });

  it('forro selecionado entra na matriz radial: cópias giradas com ids novos', () => {
    const { store, env, options } = makeEnv();
    const forro = makeCeiling({ id: 'ce_qa', typeId: 'ct_gesso', levelId: 'lv_0', boundary: [{ x: 2, y: 4 }, { x: 3, y: 4 }, { x: 3, y: 5 }, { x: 2, y: 5 }] });
    store.exec({ type: 'addCeiling', ceiling: forro });
    env.setSelection(['ce_qa']);
    options.arrayKind = 'radial';
    options.arrayCount = 4;
    options.arrayAngle = 360;
    options.arrayAnchor = 'last';
    const a = tool('array', env);
    clickAt(a, 0, 0);
    a.click(P(0, 0));
    const forros = Object.values(store.project.elements).filter(isCeiling);
    expect(forros).toHaveLength(4);
    const ids = new Set(forros.map((c) => c.id));
    expect(ids.size).toBe(4);
    // (2, 4) girado 90° em torno da origem vira (-4, 2)
    const girado90 = forros.some((c) => c.boundary.some((q) => Math.abs(q.x + 4) < 1e-6 && Math.abs(q.y - 2) < 1e-6));
    expect(girado90).toBe(true);
    store.undo();
    expect(Object.values(store.project.elements).filter(isCeiling)).toHaveLength(1);
  });

  it('Esc cancela o centro e o segundo Esc sai da ferramenta', () => {
    const { store, env, options, done } = makeEnv();
    drawWall(env, [2, 0], [3, 0]);
    env.setSelection([walls(store)[0]!.id]);
    options.arrayKind = 'radial';
    const a = tool('array', env);
    clickAt(a, 0, 0);
    a.cancel();
    expect(walls(store)).toHaveLength(1);
    expect(done()).toBe(0);
    a.cancel();
    expect(done()).toBe(1);
  });

  it('o centro da matriz radial não entra na cópia quando nada está selecionado', () => {
    const { store, env, options } = makeEnv();
    drawWall(env, [2, 0], [3, 0]);
    options.arrayKind = 'radial';
    env.setSelection([]);
    const a = tool('array', env);
    a.click(P(0, 0));
    expect(walls(store)).toHaveLength(1);
  });
});
