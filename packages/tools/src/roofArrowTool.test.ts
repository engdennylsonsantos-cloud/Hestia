import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { roofsOnLevel, type ProjectStore, type Roof } from '@hestia/model';
import { commitPerimeter } from './perimeterCommit.ts';
import type { CommitPerimeterOptions } from './perimeterCommitTypes.ts';
import { addSegs, newDraft, setSegSlope, type NewSeg } from './perimeterSession.ts';
import { roofShapePatch } from './roofEdges.ts';
import { resolveRoofs, roofTopAt } from '@hestia/engine';
import { roofToFreePatch } from './roofFreeConvert.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Lados de um retângulo 6 × 4 (x 0..6, y 0..4), na ordem do contorno. */
const CANTOS: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const RETANGULO: NewSeg[] = CANTOS.map((a, i) => ({ a, b: CANTOS[(i + 1) % CANTOS.length]! }));

/**
 * Cria o telhado 6 × 4 de duas águas pelo commit do perímetro (o caminho da faixa): as arestas curtas (1 e 3) ficam sem
 * inclinação, como a forma "duas águas" do antigo modo.
 */
function criarDuasAguas(store: ProjectStore, opts: CommitPerimeterOptions = {}): void {
  let d = addSegs(newDraft('roof'), RETANGULO);
  for (const i of [1, 3]) d = setSegSlope(d, d.segs[i]!.id, { definesSlope: false });
  const r = commitPerimeter(store.project, d, { typeId: 'rt_ceramica', levelId: 'lv_0', ...opts });
  if (!r.ok) throw new Error(`recusado: ${r.message}`);
  for (const c of r.commands) store.exec(c);
}

/** Telhado retangular 6 × 4 criado pelo perímetro e convertido em águas livres (uma água sobre o contorno). */
function freeRoof() {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  criarDuasAguas(ctx.store);
  const r = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
  ctx.store.exec({ type: 'updateElements', ids: [r.id], patch: roofShapePatch(r, 'free', 20) });
  ctx.env.setSelection([r.id]);
  return { ...ctx, msgs, id: r.id, roof: () => ctx.store.project.elements[r.id] as Roof };
}

describe('seta de inclinação (A5)', () => {
  it('dois cliques sobre uma água a alteram: subida do primeiro para o segundo, inclinação da barra, mesmo polígono', () => {
    const ctx = freeRoof();
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 0, 2);
    clickAt(a, 3, 2);
    const planes = ctx.roof().planes;
    expect(planes).toHaveLength(1);
    const w = planes[0]!;
    expect(w.up.x).toBeCloseTo(1, 9);
    expect(w.up.y).toBeCloseTo(0, 9);
    expect(w.percent).toBe(30);
    // Beiral no vértice mais baixo da subida (o contorno inclui o balanço).
    expect(w.origin.x).toBeCloseTo(Math.min(...ctx.roof().boundary.map((q) => q.x)), 9);
    expect(w.origin.y).toBeCloseTo(2, 9);
    expect(w.polygon).toEqual(ctx.roof().boundary);
    expect(ctx.msgs.at(-1)).toMatch(/Água 1 alterada/);
  });

  it('fora de toda água, uma nova água cobre o contorno', () => {
    const ctx = freeRoof();
    // Água só na metade esquerda (x 0..3): o clique em x = 5 cai fora dela.
    ctx.store.exec({ type: 'updateElements', ids: [ctx.id], patch: { planes: [{ polygon: [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }, { x: 0, y: 4 }], origin: { x: 0, y: 0 }, up: { x: 0, y: 1 }, percent: 20, z0: 0 }] } });
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 5, 2);
    clickAt(a, 5, 3);
    const planes = ctx.roof().planes;
    expect(planes).toHaveLength(2);
    expect(planes[1]!.polygon).toEqual(ctx.roof().boundary);
    expect(ctx.msgs.at(-1)).toMatch(/Água adicionada/);
  });

  it('sem telhado de águas livres selecionado, avisa e não adiciona', () => {
    const ctx = makeEnv();
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    const t = tool('roofarrow', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 3, 0);
    expect(msgs.at(-1)).toMatch(/Selecione um telhado/);
  });

  it('telhado de quatro águas selecionado: a dica explica a conversão e não exige passo prévio', () => {
    const ctx = makeEnv();
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    criarDuasAguas(ctx.store);
    const r = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
    ctx.env.setSelection([r.id]);
    tool('roofarrow', ctx.env);
    expect(msgs.at(-1)).toMatch(/vira de águas livres/);
  });

  it('a primeira seta num telhado por arestas converte preservando as águas atuais e altera a água clicada, num só comando', () => {
    const ctx = makeEnv();
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    criarDuasAguas(ctx.store);
    const r0 = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
    expect(r0.shape).toBe('edges');
    const antes = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    const n = antes.planes.length;
    expect(n).toBe(2);
    ctx.env.setSelection([r0.id]);
    const a = tool('roofarrow', ctx.env);
    // Água de baixo (junto à aresta y = 0): sobe em +x em vez de +y.
    clickAt(a, 3, 0.5);
    clickAt(a, 5, 0.5);
    const r = ctx.store.project.elements[r0.id] as Roof;
    expect(r.shape).toBe('free');
    expect(r.planes).toHaveLength(n);
    const depois = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    expect(depois.problem).toBeUndefined();
    expect(depois.planes).toHaveLength(n);
    // A água não clicada (aresta y = 4) continua igual: 0,2 · 1 m do beiral alto a 20 % (altura em y = 3,5).
    expect(roofTopAt(depois, { x: 3, y: 3.5 })).toBeCloseTo(roofTopAt(antes, { x: 3, y: 3.5 })!, 9);
    // A água clicada agora sobe em +x a 30 %.
    expect(r.planes.some((pl) => pl.up.x > 0.99 && pl.percent === 30)).toBe(true);
    expect(msgs.at(-1)).toMatch(/virou de águas livres/);
    ctx.store.undo();
    expect((ctx.store.project.elements[r0.id] as Roof).shape).toBe('edges');
  });

  it('conversão preserva as águas de um telhado com mansarda (duas faixas por água viram planos)', () => {
    const ctx = makeEnv();
    criarDuasAguas(ctx.store);
    const r0 = roofsOnLevel(ctx.store.project, 'lv_0')[0]!;
    ctx.store.exec({ type: 'updateElements', ids: [r0.id], patch: { mansard: { lowerPercent: 100, upperPercent: 30, run: 0.5 } } });
    const antes = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    ctx.store.exec({ type: 'updateElements', ids: [r0.id], patch: roofToFreePatch(ctx.store.project.elements[r0.id] as Roof) });
    const livre = ctx.store.project.elements[r0.id] as Roof;
    expect(livre.shape).toBe('free');
    expect(livre.mansard).toBeUndefined();
    const depois = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    expect(depois.planes).toHaveLength(antes.planes.length);
    for (const q of [{ x: 3, y: 0.25 }, { x: 3, y: 1.2 }, { x: 1, y: 2 }]) expect(roofTopAt(depois, q)).toBeCloseTo(roofTopAt(antes, q)!, 9);
  });

  it('Esc no meio do passo cancela só o passo e diz que outro Esc sai da ferramenta', () => {
    const ctx = freeRoof();
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 0, 2);
    a.cancel();
    expect(ctx.msgs.at(-1)).toMatch(/Esc de novo sai da ferramenta/);
  });

  it('a direção nula não cria água', () => {
    const ctx = freeRoof();
    const a = tool('roofarrow', ctx.env);
    clickAt(a, 1, 1);
    clickAt(a, 1, 1);
    expect(ctx.roof().planes).toHaveLength(1);
    expect(ctx.msgs.at(-1)).toMatch(/Direção nula/);
  });
});
