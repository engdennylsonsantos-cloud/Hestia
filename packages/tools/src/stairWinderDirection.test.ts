import { describe, expect, it } from 'vitest';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { autoPath } from '@hestia/engine';
import { clickAt, makeEnv, tool } from './testEnv.ts';

/** Leque (winder) de H = 2,80 m, com o 2º clique para o norte (+y): reprodução do defeito 4 da frente D. */
describe('leque: a caminhada da seta de subida acompanha o sentido do clique (frente D, defeito 4)', () => {
  it('clique para o norte: o 1º espelho fica embaixo e o último em cima (seta sobe em +y)', () => {
    const ctx = makeEnv();
    ctx.env.say = () => undefined;
    ctx.options.stairRun = { shape: 'winder', width: 1.2, turn: 'left' };
    ctx.options.stair = { topLevelId: 'lv_1', topOffset: -0.2 };
    const t = tool('stairrun', ctx.env);
    clickAt(t, 0, 0);
    clickAt(t, 0, 5);
    const [s] = stairsOnLevel(ctx.store.project, 'lv_0') as Stair[];
    const run = s!.components[0] as StairRun;
    const walk = autoPath({ boundaryLeft: run.boundaryLeft, boundaryRight: run.boundaryRight, risers: run.risers, path: [] });
    expect(walk.length).toBeGreaterThan(1);
    // Primeiro ponto da caminhada deve estar mais baixo (menor y) que o último.
    expect(walk[walk.length - 1]!.y).toBeGreaterThan(walk[0]!.y);
  });
});
