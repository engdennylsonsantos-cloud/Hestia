import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { frameOfWall, pointAt } from '@hestia/engine';
import { makeWall, openingsOfWall, type LocationLine, type Opening, type Wall } from '@hestia/model';
import { clickAt, makeEnv, tool, walls } from './testEnv.ts';

type Ctx = ReturnType<typeof makeEnv>;

/** Parede de alvenaria (wt_alv14), com a linha de locação escolhida (padrão: eixo). */
const wall = (id: string, a: Vec2, b: Vec2, locationLine: LocationLine = 'wallCenter') =>
  makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a, b, locationLine });

const byId = (ctx: Ctx, id: string): Wall => walls(ctx.store).find((w) => w.id === id)!;
const frame = (ctx: Ctx, id: string) => frameOfWall(ctx.store.project, id)!;

/** Ponto no meio do vão de uma parede reta, sobre uma das faces (`sExt`/`sInt`, ou `sHi`/`sLo` pelo lado do eixo). */
const midOn = (ctx: Ctx, id: string, lado: 'sExt' | 'sInt' | 'sHi' | 'sLo'): Vec2 => {
  const f = frame(ctx, id);
  return pointAt(f, f.length / 2, f[lado]);
};

describe('alinhar parede com parede (sem vínculo)', () => {
  it('face externa com face externa: a parede se move até as faces externas ficarem na mesma linha', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    // M é locada pela face externa: o eixo dela cai sobre a própria face externa.
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 3 }, 'finishExterior') });
    const alvo = midOn(ctx, 'R', 'sExt');
    const t = tool('align', ctx.env);
    clickAt(t, alvo.x, alvo.y); // referência: face externa de R
    clickAt(t, 3, 3); // M: a face externa, que é o próprio eixo dela
    const m = byId(ctx, 'M');
    expect(midOn(ctx, 'M', 'sExt').y).toBeCloseTo(alvo.y, 9);
    expect(m.a.y).toBeCloseTo(alvo.y, 9);
    // Não é alinhamento de eixo: o eixo de M foi para a face de R, longe do eixo dela (y = 0).
    expect(Math.abs(alvo.y)).toBeGreaterThan(0.05);
  });

  it('eixo com eixo: com a preferência "eixos", a parede vai para o eixo da referência', () => {
    const ctx = makeEnv();
    ctx.options.alignPrefer = 'eixos';
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 3 }) });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 0); // eixo de R
    clickAt(t, 3, 3); // eixo de M
    const m = byId(ctx, 'M');
    expect(m.a.y).toBeCloseTo(0, 9);
    expect(m.b.y).toBeCloseTo(0, 9);
    expect(m.a.x).toBeCloseTo(0, 9);
    expect(m.b.x).toBeCloseTo(6, 9);
  });

  it('parede inclinada em relação à referência: recusa, não gira e não grava', () => {
    const ctx = makeEnv();
    const messages: string[] = [];
    ctx.env.say = (msg: string) => messages.push(msg);
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 4.5 }) });
    const antes = { a: { ...byId(ctx, 'M').a }, b: { ...byId(ctx, 'M').b } };
    const t = tool('align', ctx.env);
    clickAt(t, 3, 0); // referência: eixo horizontal de R
    clickAt(t, 3, 3.75); // M, inclinada (sobre o eixo dela, no meio do vão)
    expect(messages).toContain(
      'A referência não é paralela a esta feição. Para estender uma parede até ela, escolha a extremidade da parede (Tab).',
    );
    expect(byId(ctx, 'M').a).toEqual(antes.a);
    expect(byId(ctx, 'M').b).toEqual(antes.b);
  });

  it('abertura hospedeira acompanha a parede: o vão continua no mesmo lugar da parede', () => {
    const ctx = makeEnv();
    ctx.options.alignPrefer = 'eixos';
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 3 }) });
    ctx.store.exec({
      type: 'addOpening',
      opening: { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'M', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
    });
    const t = tool('align', ctx.env);
    clickAt(t, 0.5, 0); // eixo de R, fora de qualquer vão
    clickAt(t, 0.5, 3); // eixo de M, fora da porta (a porta não entra na escolha)
    const porta = ctx.store.project.elements.d as Opening;
    expect(porta.hostId).toBe('M');
    expect(porta.offset).toBeCloseTo(3, 9);
    expect(openingsOfWall(ctx.store.project, 'M')).toHaveLength(1);
    // O ponto do vão, pela parede, agora está sobre o eixo de R: a porta foi junto com a parede.
    const p = pointAt(frame(ctx, 'M'), porta.offset, 0);
    expect(p.x).toBeCloseTo(3, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it('depois de alinhar, mover a referência não mexe na parede alinhada (nada fica vinculado)', () => {
    const ctx = makeEnv();
    ctx.options.alignPrefer = 'eixos';
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 3 }) });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 0);
    clickAt(t, 3, 3);
    expect(byId(ctx, 'M').a.y).toBeCloseTo(0, 9);
    ctx.store.exec({ type: 'transform', ids: ['R'], transform: { kind: 'translate', d: { x: 0, y: 2 } } });
    expect(byId(ctx, 'R').a.y).toBeCloseTo(2, 9);
    expect(byId(ctx, 'M').a.y).toBeCloseTo(0, 9);
    expect(byId(ctx, 'M').b.y).toBeCloseTo(0, 9);
  });

  it('um passo de desfazer reverte o alinhamento inteiro', () => {
    const ctx = makeEnv();
    ctx.options.alignPrefer = 'eixos';
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 3 }) });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 0);
    clickAt(t, 3, 3);
    expect(ctx.store.undoLabel).toBe('Alinhar');
    ctx.store.undo();
    expect(byId(ctx, 'M').a.y).toBeCloseTo(3, 9);
  });

  it('vizinha ligada pela extremidade acompanha a parede alinhada (só na hora, sem vínculo)', () => {
    const ctx = makeEnv();
    ctx.options.alignPrefer = 'eixos';
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 0, y: 3 }, { x: 6, y: 3 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('C', { x: 6, y: 3 }, { x: 6, y: 6 }) });
    const t = tool('align', ctx.env);
    clickAt(t, 3, 0);
    clickAt(t, 3, 3);
    const c = byId(ctx, 'C');
    expect(c.a.x).toBeCloseTo(6, 9);
    expect(c.a.y).toBeCloseTo(0, 9);
    expect(c.b).toEqual({ x: 6, y: 6 });
  });

  it('parede colinear ligada à referência pela extremidade: a M se alinha e a referência fica intacta', () => {
    const ctx = makeEnv();
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    ctx.store.exec({ type: 'addWall', wall: wall('M', { x: 6, y: 0 }, { x: 12, y: 0 }) });
    const antesR = { a: { ...byId(ctx, 'R').a }, b: { ...byId(ctx, 'R').b } };
    const t = tool('align', ctx.env);
    const refPt = midOn(ctx, 'R', 'sHi');
    clickAt(t, refPt.x, refPt.y); // referência: face de cima de R
    const movPt = midOn(ctx, 'M', 'sLo');
    clickAt(t, movPt.x, movPt.y); // M: face de baixo, que a deslocaria para cima
    expect(midOn(ctx, 'M', 'sLo').y).toBeCloseTo(refPt.y, 9);
    expect(byId(ctx, 'R').a).toEqual(antesR.a);
    expect(byId(ctx, 'R').b).toEqual(antesR.b);
  });

  it('a parede não se alinha a si mesma: a recusa diz isso e a parede fica intacta', () => {
    const ctx = makeEnv();
    const messages: string[] = [];
    ctx.env.say = (msg: string) => messages.push(msg);
    ctx.store.exec({ type: 'addWall', wall: wall('R', { x: 0, y: 0 }, { x: 6, y: 0 }) });
    const antes = { ...byId(ctx, 'R').a };
    const t = tool('align', ctx.env);
    const cima = midOn(ctx, 'R', 'sHi');
    clickAt(t, cima.x, cima.y); // referência: face de cima de R
    const baixo = midOn(ctx, 'R', 'sLo');
    clickAt(t, baixo.x, baixo.y); // alvo: a face de baixo da própria R
    expect(messages.at(-1)).toBe('Alinhar não move a própria parede de referência: nada foi alterado.');
    expect(byId(ctx, 'R').a).toEqual(antes);
  });
});
