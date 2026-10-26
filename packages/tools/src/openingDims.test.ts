import { describe, expect, it } from 'vitest';
import { frameOfWall } from '@hestia/engine';
import { drawWall, makeEnv, walls } from './testEnv.ts';
import { perpendicularNeighbors } from './openingPlacement.ts';
import { editOpeningDim, openingDimLines } from './openingDims.ts';

function cena() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [5, 0]);
  drawWall(ctx.env, [2, -1], [2, 1]);
  const host = walls(ctx.store).find((w) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y) > 4.9)!;
  const frame = frameOfWall(ctx.store.project, host.id)!;
  const neighbors = perpendicularNeighbors(ctx.store.project, host.id, 'lv_0');
  return { ctx, frame, neighbors };
}

describe('cotas editáveis da abertura', () => {
  it('parede de 5 m com perpendicular a 2 m e porta de 0,90 m em 3,5: eixo 1,50 e 1,50', () => {
    const { frame, neighbors } = cena();
    const set = openingDimLines(frame, 3.5, 0.9, neighbors, 'axis', 1);
    expect(set.left.value).toBeCloseTo(1.5, 6);
    expect(set.right.value).toBeCloseTo(1.5, 6);
  });

  it('editar a cota da esquerda para 1,20 move o offset para 3,20', () => {
    const { frame, neighbors } = cena();
    const set = openingDimLines(frame, 3.5, 0.9, neighbors, 'axis', 1);
    const result = editOpeningDim(set, 'left', 1.2, { neighbors, occupied: [] });
    expect('offset' in result).toBe(true);
    if ('offset' in result) expect(result.offset).toBeCloseTo(3.2, 6);
  });

  it('editar a cota da direita mantém a medida do eixo da direita', () => {
    const { frame, neighbors } = cena();
    const set = openingDimLines(frame, 3.5, 0.9, neighbors, 'axis', 1);
    const result = editOpeningDim(set, 'right', 1.8, { neighbors, occupied: [] });
    if ('offset' in result) expect(result.offset).toBeCloseTo(3.2, 6);
    else throw new Error(result.error);
  });

  it('valor que invade a perpendicular devolve erro com mensagem e não move', () => {
    const { frame, neighbors } = cena();
    const set = openingDimLines(frame, 3.5, 0.9, neighbors, 'axis', 1);
    const result = editOpeningDim(set, 'left', 0.2, { neighbors, occupied: [] });
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error.length).toBeGreaterThan(0);
    expect(set.center).toBe(3.5);
  });

  it('valor que invade outra abertura devolve erro com mensagem', () => {
    const { frame, neighbors } = cena();
    const set = openingDimLines(frame, 3.5, 0.9, neighbors, 'axis', 1);
    const result = editOpeningDim(set, 'left', 1.6, { neighbors, occupied: [[3.6, 4.5]] });
    expect('error' in result).toBe(true);
    if ('error' in result) expect(result.error).toMatch(/outra abertura/i);
  });

  it('modo face mede da borda do batente à face da perpendicular', () => {
    const { frame, neighbors } = cena();
    const set = openingDimLines(frame, 3.5, 0.9, neighbors, 'face', 1);
    const perp = neighbors[0]!;
    const faceHi = Math.max(perp.faceLo, perp.faceHi);
    expect(set.left.value).toBeCloseTo(3.5 - 0.45 - faceHi, 6);
    expect(set.right.value).toBeCloseTo(5 - (3.5 + 0.45), 6);
    const result = editOpeningDim(set, 'left', 0.9, { neighbors, occupied: [] });
    if ('offset' in result) expect(result.offset).toBeCloseTo(faceHi + 0.9 + 0.45, 6);
    else throw new Error(result.error);
  });
});
