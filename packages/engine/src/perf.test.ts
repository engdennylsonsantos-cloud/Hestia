import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * Teste de desempenho: NÃO roda no `npm test` (ver vitest.config.ts); roda em `npm run test:perf`
 * (vitest.perf.config.ts), isolado, uma arquivo por vez.
 *
 * Os limites são RELATIVOS a uma tarefa-base cronometrada no mesmo processo, logo antes da medida:
 * a razão tempo/base corta a velocidade da máquina e a carga de outros processos, e ainda pega
 * regressão de ordem de grandeza. Limite absoluto em ms reprovava por contenção, não por código.
 */
const BASE_ITERS = 30_000_000;
/**
 * Limites de razão (tempo da operação / tempo da base). Medido nesta máquina (4 núcleos): sem carga, quente 13–15
 * e frio 21–32; com três processos de CPU competindo, quente 18–24 e frio 25–33. Limite = pior caso sob carga com
 * folga: passa com contenção; uma regressão de cerca de 2,7× no quente sem carga (15 → 40) reprova.
 */
const LIMITE_FRIO = 60;
const LIMITE_QUENTE = 40;
/** Trabalho fixo de CPU (sem alocação), o mesmo a cada chamada: devolve um checksum determinístico. */
function tarefaBase(): number {
  let h = 0;
  for (let i = 0; i < BASE_ITERS; i++) h = (Math.imul(h ^ i, 0x9e3779b1) + i) | 0;
  return h;
}
/** Menor de três execuções (descarta as que caíram em pico de carga) e o checksum, que confere que é o mesmo trabalho. */
function baseMs(): { ms: number; h: number } {
  let melhor = Infinity;
  let h = 0;
  for (let k = 0; k < 3; k++) {
    const t = performance.now();
    h = tarefaBase();
    melhor = Math.min(melhor, performance.now() - t);
  }
  return { ms: melhor, h };
}

/**
 * K4 · 500 paredes em tempo interativo. Malha 12 × 12 de ruas (cantos, Ts e cruzamentos) mais paredes soltas.
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
    const b1 = baseMs();
    const cold = performance.now();
    const r = resolveLevel(s.project, 'lv_0');
    const coldMs = performance.now() - cold;
    expect(Object.keys(r.walls)).toHaveLength(500);
    s.exec({ type: 'transform', ids: ['w0'], transform: { kind: 'translate', d: { x: 0, y: 0.5 } } });
    const b2 = baseMs();
    expect(b2.h).toBe(b1.h);
    const warm = performance.now();
    resolveLevel(s.project, 'lv_0');
    const warmMs = performance.now() - warm;
    const razaoFrio = coldMs / b1.ms;
    const razaoQuente = warmMs / b2.ms;
    console.log(
      `K4: base ${b1.ms.toFixed(0)}/${b2.ms.toFixed(0)} ms · a frio ${coldMs.toFixed(0)} ms (razão ${razaoFrio.toFixed(1)}) · ` +
        `depois de mover uma ${warmMs.toFixed(0)} ms (razão ${razaoQuente.toFixed(1)})`,
    );
    expect(razaoFrio).toBeLessThan(LIMITE_FRIO);
    expect(razaoQuente).toBeLessThan(LIMITE_QUENTE);
  }, 60000);
});
