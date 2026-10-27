import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { resolveRoofs, roofTopAt } from '@hestia/engine';
import { roofsOnLevel, type Roof } from '@hestia/model';
import { makeEnv } from './testEnv.ts';
import { commitPerimeter } from './perimeterCommit.ts';
import { addSegs, newDraft, type NewSeg } from './perimeterSession.ts';
import { roofShapePatch } from './roofEdges.ts';
import { roofToFreePatch } from './roofFreeConvert.ts';

/** Retângulo 6 × 4 (x 0..6, y 0..4), na ordem do contorno. */
const CANTOS: Vec2[] = [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }];
const RETANGULO: NewSeg[] = CANTOS.map((a, i) => ({ a, b: CANTOS[(i + 1) % CANTOS.length]! }));

/** Pontos dentro do telhado, cobrindo as quatro águas do 6 × 4 (perto de cada beiral e no centro). */
const PONTOS: Vec2[] = [{ x: 3, y: 2 }, { x: 1, y: 2 }, { x: 5, y: 2 }, { x: 3, y: 0.5 }, { x: 3, y: 3.5 }];

describe('conversão para águas livres (seletor Forma das Propriedades)', () => {
  it('quatro águas trocado para águas livres mantém as quatro águas, com as mesmas cotas', () => {
    const ctx = makeEnv();
    const r = commitPerimeter(ctx.store.project, addSegs(newDraft('roof'), RETANGULO), { typeId: 'rt_ceramica', levelId: 'lv_0' });
    if (!r.ok) throw new Error(`recusado: ${r.message}`);
    for (const c of r.commands) ctx.store.exec(c);
    const id = roofsOnLevel(ctx.store.project, 'lv_0')[0]!.id;
    const roof = () => ctx.store.project.elements[id] as Roof;
    ctx.store.exec({ type: 'updateElements', ids: [id], patch: roofShapePatch(roof(), 'hip', 30) });
    const antes = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    expect(antes.planes).toHaveLength(4);

    ctx.store.exec({ type: 'updateElements', ids: [id], patch: roofToFreePatch(roof()) });
    expect(roof().shape).toBe('free');
    expect(roof().planes).toHaveLength(4);
    expect(roof().planes.every((pl) => pl.percent === 30)).toBe(true);
    const depois = resolveRoofs(ctx.store.project, 'lv_0')[0]!;
    expect(depois.planes).toHaveLength(4);
    for (const q of PONTOS) expect(roofTopAt(depois, q)).toBeCloseTo(roofTopAt(antes, q)!, 9);
  });

  it('a conversão simples de quatro águas perde as águas (um plano só), por isso o seletor não a usa para águas livres', () => {
    const ctx = makeEnv();
    const r = commitPerimeter(ctx.store.project, addSegs(newDraft('roof'), RETANGULO), { typeId: 'rt_ceramica', levelId: 'lv_0' });
    if (!r.ok) throw new Error(`recusado: ${r.message}`);
    for (const c of r.commands) ctx.store.exec(c);
    const id = roofsOnLevel(ctx.store.project, 'lv_0')[0]!.id;
    const hip = roofShapePatch(ctx.store.project.elements[id] as Roof, 'hip', 30);
    ctx.store.exec({ type: 'updateElements', ids: [id], patch: hip });
    const roof = ctx.store.project.elements[id] as Roof;
    expect(roofShapePatch(roof, 'free').planes).toHaveLength(1);
    expect(roofToFreePatch(roof).planes).toHaveLength(4);
  });
});
