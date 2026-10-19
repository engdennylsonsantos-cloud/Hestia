import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * K4 · 500 paredes em tempo interativo. Malha 12 × 12 de ruas (cantos, Ts e cruzamentos) mais paredes soltas;
 * os limites são folgados para não oscilar em máquina lenta, mas pegam regressão de ordem de grandeza.
 */
describe('K4 · desempenho', () => {
  const build = (): ProjectStore => {
    const s = new ProjectStore(createEmptyProject());
    let n = 0;
    const add = (ax: number, ay: number, bx: number, by: number): void => {
      s.exec({ type: 'addWall', wall: makeWall({ id: `w${n++}`, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: ax, y: ay }, b: { x: bx, y: by } }) });
    };
    // 11 × 11 células de 4 m: linhas horizontais e verticais partidas a cada 4 m = 2 × 12 × 11 = 264 paredes ligadas...
    for (let i = 0; i <= 11; i++) for (let j = 0; j < 11; j++) add(j * 4, i * 4, (j + 1) * 4, i * 4);
    for (let i = 0; i <= 11; i++) for (let j = 0; j < 11; j++) add(i * 4, j * 4, i * 4, (j + 1) * 4);
    // ...mais 236 paredes isoladas em fileiras fora da malha: total 500.
    for (let k = 0; n < 500; k++) add(60 + (k % 20) * 3, Math.floor(k / 20) * 3, 62 + (k % 20) * 3, Math.floor(k / 20) * 3);
    return s;
  };

  it('500 paredes: resolução completa e recálculo depois de mover uma parede', () => {
    const s = build();
    expect(Object.keys(s.project.elements)).toHaveLength(500);
    const cold = performance.now();
    const r = resolveLevel(s.project, 'lv_0');
    const coldMs = performance.now() - cold;
    expect(Object.keys(r.walls)).toHaveLength(500);
    s.exec({ type: 'transform', ids: ['w0'], transform: { kind: 'translate', d: { x: 0, y: 0.5 } } });
    const warm = performance.now();
    resolveLevel(s.project, 'lv_0');
    const warmMs = performance.now() - warm;
    console.log(`K4: 500 paredes a frio ${coldMs.toFixed(0)} ms, depois de mover uma ${warmMs.toFixed(0)} ms`);
    expect(coldMs).toBeLessThan(6000);
    expect(warmMs).toBeLessThan(1500);
  }, 30000);
});
