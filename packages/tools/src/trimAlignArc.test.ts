import { describe, expect, it } from 'vitest';
import { arcFromSagitta, sagFromThreePoints, type Vec2 } from '@hestia/geom';
import { makeWall, type Wall } from '@hestia/model';
import { clickAt, makeEnv, tool, walls } from './testEnv.ts';
import type { ToolEnv } from './index.ts';

const wall = (id: string, a: Vec2, b: Vec2, sag = 0): Omit<Wall, 'order'> =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, sag });

/** Arco de (0,0) a (6,0) com flecha 1: centro (3,−4), raio 5. */
function arcWall(id: string): Omit<Wall, 'order'> {
  return wall(id, { x: 0, y: 0 }, { x: 6, y: 0 }, 1);
}

/** Arco de (2,5; 0,33) a (7,5; 0,33) sobre o círculo de centro (5,−4) e raio 5. */
function arcWall2(id: string): Omit<Wall, 'order'> {
  const a = { x: 2.5, y: 0.33 };
  const b = { x: 7.5, y: 0.33 };
  return wall(id, a, b, sagFromThreePoints(a, { x: 5, y: 1 }, b));
}

const radiusOf = (w: Wall): number => arcFromSagitta(w.a, w.b, w.sag)!.radius;
const centerOf = (w: Wall): Vec2 => arcFromSagitta(w.a, w.b, w.sag)!.center;

function capture(env: ToolEnv): string[] {
  const messages: string[] = [];
  env.say = (m: string): void => {
    messages.push(m);
  };
  return messages;
}

describe('aparar/estender com paredes em arco', () => {
  it('arco × reta: apara o arco no canto e mantém a circunferência', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: arcWall('c') });
    ctx.store.exec({ type: 'addWall', wall: wall('v', { x: 3, y: -3 }, { x: 3, y: 3 }) });
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0.583); // parte esquerda do arco fica
    clickAt(t, 3, -2); // parte de baixo da reta fica
    const [c, v] = walls(ctx.store) as [Wall, Wall];
    expect(c.b.x).toBeCloseTo(3);
    expect(c.b.y).toBeCloseTo(1);
    expect(v.b.x).toBeCloseTo(3);
    expect(v.b.y).toBeCloseTo(1);
    expect(v.a.y).toBeCloseTo(-3);
    expect(centerOf(c).x).toBeCloseTo(3);
    expect(centerOf(c).y).toBeCloseTo(-4);
    expect(radiusOf(c)).toBeCloseTo(5);
  });

  it('arco × arco: escolhe o cruzamento do lado clicado e preserva os dois círculos', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: arcWall('c') });
    ctx.store.exec({ type: 'addWall', wall: arcWall2('d') });
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0.583); // parte esquerda do primeiro arco fica
    clickAt(t, 7, 0.583); // parte direita do segundo arco fica
    const [c, d] = walls(ctx.store) as [Wall, Wall];
    expect(c.b.x).toBeCloseTo(4);
    expect(c.b.y).toBeCloseTo(0.899, 3);
    expect(d.a.x).toBeCloseTo(4);
    expect(d.a.y).toBeCloseTo(0.899, 3);
    expect(d.b.x).toBeCloseTo(7.5);
    expect(centerOf(c).x).toBeCloseTo(3);
    expect(centerOf(c).y).toBeCloseTo(-4);
    expect(radiusOf(c)).toBeCloseTo(5);
    expect(centerOf(d).x).toBeCloseTo(5);
    expect(centerOf(d).y).toBeCloseTo(-4);
    expect(radiusOf(d)).toBeCloseTo(5);
  });

  it('sem interseção devolve mensagem clara e não altera o modelo', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: arcWall('c') });
    ctx.store.exec({ type: 'addWall', wall: wall('v', { x: 0, y: 10 }, { x: 6, y: 10 }) });
    const messages = capture(ctx.env);
    const before = JSON.stringify(ctx.store.project);
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0.583);
    clickAt(t, 3, 10);
    expect(messages.at(-1)).toBe('As paredes não se cruzam: não há canto.');
    expect(JSON.stringify(ctx.store.project)).toBe(before);
  });

  it('em lote, a referência em arco apara as paredes da lista', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: arcWall('c') });
    ctx.store.exec({ type: 'addWall', wall: wall('v', { x: 3, y: 2 }, { x: 3, y: 5 }) });
    const t = tool('trim', ctx.env);
    clickAt(t, 3, 3, { shift: true });
    clickAt(t, 3, 1); // referência: o arco
    const [c, v] = walls(ctx.store) as [Wall, Wall];
    expect(v.a.x).toBeCloseTo(3);
    expect(v.a.y).toBeCloseTo(1);
    expect(v.b.y).toBeCloseTo(5);
    expect(c.b.x).toBeCloseTo(6); // referência intacta
    expect(c.b.y).toBeCloseTo(0);
  });
});

describe('alinhar com paredes em arco', () => {
  it('parede reta se alinha à face de referência em arco', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: arcWall('c') });
    ctx.store.exec({ type: 'addWall', wall: wall('h', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 1); // face de referência do arco, no topo
    clickAt(t, 3, 0); // face da reta a mover
    const h = walls(ctx.store)[1]!;
    expect(h.a.y).toBeCloseTo(1);
    expect(h.b.y).toBeCloseTo(1);
  });

  it('arco se alinha à face de referência reta', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: wall('h', { x: 0, y: 2 }, { x: 6, y: 2 }) });
    ctx.store.exec({ type: 'addWall', wall: arcWall('c') });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 2); // referência reta
    clickAt(t, 3, 1); // arco a mover
    const c = walls(ctx.store)[1]!;
    expect(centerOf(c).x).toBeCloseTo(3);
    expect(centerOf(c).y).toBeCloseTo(-3);
    expect(radiusOf(c)).toBeCloseTo(5);
  });
});
