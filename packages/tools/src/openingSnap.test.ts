import { describe, expect, it } from 'vitest';
import { openingsOfWall, openingType, type Opening } from '@hestia/model';
import { drawWall, makeEnv, P, tool } from './testEnv.ts';

describe('captura de posição da abertura (S-11)', () => {
  it('porta perto do início da parede encosta na ponta: a borda fica em 0', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    const door = tool('door', ctx.env);
    // Porta de 0,80 m: centro a 0,40 m encosta na ponta. Cursor a 0,43 m (3 cm longe, dentro da tolerância de 5 cm).
    door.move!(P(0.43, 0.01));
    door.click!(P(0.43, 0.01));
    const [o] = openingsOfWall(ctx.store.project, Object.values(ctx.store.project.elements).find((e) => e.kind === 'wall')!.id) as Opening[];
    const w = openingType(ctx.store.project, o!);
    expect(o!.offset - w.width / 2).toBeCloseTo(0.01, 6); // folga de 1 cm da ponta, a mesma do posicionamento
  });

  it('com a captura desligada (F3), a posição fica como o cursor', () => {
    const ctx = makeEnv();
    drawWall(ctx.env, [0, 0], [4, 0]);
    ctx.env.options().snap = { ...(ctx.env.options().snap ?? {}), enabled: false } as never;
    const door = tool('door', ctx.env);
    door.move!(P(0.43, 0.01));
    door.click!(P(0.43, 0.01));
    const id = Object.values(ctx.store.project.elements).find((e) => e.kind === 'wall')!.id;
    const [o] = openingsOfWall(ctx.store.project, id) as Opening[];
    expect(o!.offset).toBeCloseTo(0.43, 1);
  });
});
