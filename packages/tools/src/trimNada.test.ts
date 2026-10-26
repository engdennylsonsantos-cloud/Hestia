import { describe, expect, it } from 'vitest';
import { clickAt, drawWall, makeEnv, tool, walls } from './testEnv.ts';

describe('aparar/estender: só confirma quando algo mudou', () => {
  it('duas paredes que já se encontram no canto: diz que nada há a aparar e não grava nada', () => {
    const ctx = makeEnv();
    const msgs: string[] = [];
    ctx.env.say = (m: string) => msgs.push(m);
    drawWall(ctx.env, [0, 0], [4, 0]);
    drawWall(ctx.env, [4, 0], [4, 3]);
    const antes = JSON.stringify(walls(ctx.store));
    const t = tool('trim', ctx.env);
    clickAt(t, 1, 0); // parte da primeira parede que fica
    clickAt(t, 4, 1); // parte da segunda parede que fica
    expect(JSON.stringify(walls(ctx.store))).toBe(antes);
    expect(msgs.at(-1)).toBe('Nada a aparar: as paredes já se encontram.');
    expect(msgs.some((m) => m.startsWith('Paredes aparadas'))).toBe(false);
  });
});
