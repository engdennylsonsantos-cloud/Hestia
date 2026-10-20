import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, wallsOnLevel, type Project } from '@hestia/model';
import { infer } from './infer.ts';

/**
 * Teste de desempenho da captura de faces. NÃO roda no `npm test` (ver vitest.config.ts); roda em
 * `npm run test:perf` (vitest.perf.config.ts), isolado, uma arquivo por vez.
 *
 * O limite é RELATIVO a uma tarefa-base cronometrada no mesmo processo, logo antes da medida: a razão
 * tempo/base corta a velocidade da máquina e a carga dos outros processos. O limite absoluto em ms
 * (1,5 s) reprovava dentro da suíte paralela (2,1 s) e passava isolado.
 */

const MPP = 0.005;

/** Projeto com n paredes horizontais de 4 m, em grade de 20 colunas (200 paredes para n = 200). */
function gridProject(n: number): Project {
  const store = new ProjectStore(createEmptyProject());
  for (let i = 0; i < n; i++) {
    const col = i % 20;
    const row = Math.floor(i / 20);
    const x = col * 6;
    const y = row * 4;
    store.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a: { x, y }, b: { x: x + 4, y } }) });
  }
  return store.project;
}

const BASE_ITERS = 30_000_000;
let sumidouro = 0;
/** Trabalho fixo de CPU (sem alocação), o mesmo a cada chamada. */
function tarefaBase(): number {
  let h = 0;
  for (let i = 0; i < BASE_ITERS; i++) h = (Math.imul(h ^ i, 0x9e3779b1) + i) | 0;
  return h;
}
/** Menor de três execuções: descarta as que caíram em pico de carga. */
function baseMs(): number {
  let melhor = Infinity;
  for (let k = 0; k < 3; k++) {
    const t = performance.now();
    sumidouro ^= tarefaBase();
    melhor = Math.min(melhor, performance.now() - t);
  }
  return melhor;
}

/**
 * Limite de razão (tempo da captura / tempo da base). Medido nesta máquina (4 núcleos): sem carga 8–11, com três
 * processos de CPU competindo 10–16. Limite 30 = cerca de 2× o pior caso sob carga.
 */
const LIMITE_RAZAO = 30;

describe('desempenho da captura com o cache de faces', () => {
  it('projeto de 200 paredes: 500 chamadas a infer dentro do limite relativo à base', () => {
    const p = gridProject(200);
    expect(wallsOnLevel(p, 'lv_0')).toHaveLength(200);
    const base = baseMs();
    const t0 = performance.now();
    for (let k = 0; k < 500; k++) {
      // Cursor percorrendo perto das faces das paredes: caminho com mais candidatos.
      const x = (k % 97) * 0.25;
      const y = (k % 10) * 4 + (k % 3 === 0 ? 0.092 : 0.5);
      infer({ x, y }, { project: p, levelId: 'lv_0', mpp: MPP, gridStep: 0.1 });
    }
    const ms = performance.now() - t0;
    const razao = ms / base;
    console.log(`captura: base ${base.toFixed(0)} ms · 500 infer ${ms.toFixed(0)} ms (razão ${razao.toFixed(1)})`);
    expect(razao).toBeLessThan(LIMITE_RAZAO);
  });
});
