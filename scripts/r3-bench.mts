/**
 * Medição do R3 (temporária, não versionada): picking e realce na cena real de 60×128 e 30×256, **antes** (cópia de HEAD
 * em `r3-antes.mts`) e **depois** (código do ramo), no mesmo processo e na mesma cena.
 *
 * Uso: npx vite-node scripts/r3-bench.mts
 *
 * Mede, em Node (CPU, sem GPU), mediana de `RUNS` chamadas (BENCH_RUNS, padrão 40) depois de 5 de aquecimento:
 *   - pickElement / pickModelPoint: 64 pontos de uma grade sobre o modelo;
 *   - realce de 1 id (hover), de 8 ids curto, do pavimento inteiro (144 elementos) e do mesmo id repetido;
 *   - caixaDaSelecao do pavimento inteiro.
 * Imprime também um checksum do picking e da caixa, para provar que o resultado não mudou.
 */
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import type { Id } from '@hestia/model';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { ModelScene } from '../packages/render/src/model3d/scene3d.ts';
import { pickElement, pickModelPoint } from '../packages/render/src/model3d/pick3d.ts';
import { highlightOf } from '../packages/render/src/model3d/highlight3d.ts';
import { caixaDaSelecao } from '../packages/render/src/model3d/selecao3d.ts';
import { caixaDaSelecaoAntes, highlightOfAntes } from './r3-antes.mts';
import { syntheticProject } from './perf-baselines/projeto-sintetico.mts';

const RUNS = Math.max(3, Number(process.env.BENCH_RUNS ?? 40));
const WARM = 5;
const ESTILO = { color: 0x2277ff, fill: 0.35, edges: 1 };

const mediana = (xs: number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
const f = (v: number): string => v.toFixed(3);

function cena(p: ReturnType<typeof syntheticProject>): ModelScene {
  const niveis: ResolvedLevel[] = p.levels.map((l) => resolveLevel(p, l.id));
  const ms = new ModelScene({});
  ms.update(p, niveis, { edges: true, shadows: false, dark: false });
  ms.orbit.fit(ms.bounds());
  ms.orbit.setAspect(1200, 800);
  return ms;
}

/** Ids distintos das malhas que o picking enxerga (uma vez cada). */
function elementos(ms: ModelScene): Id[] {
  const vistos = new Set<Id>();
  ms.scene.traverse((o) => {
    const r = (o as { userData?: { ranges?: Array<{ id: Id }> } }).userData?.ranges;
    if (r) for (const x of r) vistos.add(x.id);
  });
  return [...vistos];
}

function medir(fn: () => unknown): number {
  for (let i = 0; i < WARM; i++) fn();
  const xs: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    fn();
    xs.push(performance.now() - t0);
  }
  return mediana(xs);
}

function rodar(nivel: number, paredes: number): void {
  const p = syntheticProject(nivel, paredes);
  const ms = cena(p);
  const todos = elementos(ms);
  const cam = ms.orbit.camera;
  const doNivel = todos.filter((id) => /^perf_\w+_0_/.test(String(id)));

  const ndc: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) ndc.push({ x: -0.5 + i / 7, y: -0.5 + j / 7 });

  let k = 0;
  let acertos = 0;
  const checksum = { total: 0 };
  const pickE = medir(() => {
    const n = ndc[k++ % ndc.length]!;
    const e = pickElement(ms.scene, cam, n);
    if (e) acertos++;
    checksum.total += e ? e.point.x + e.point.y * 2 + e.point.z * 5 : 0;
    return e;
  });
  k = 0;
  const pickP = medir(() => {
    const q = pickModelPoint(ms.scene, cam, ndc[k++ % ndc.length]!);
    checksum.total += q ? q.x * 7 + q.y * 13 : 0;
    return q;
  });

  // Realce: cada caso usa o mesmo subconjunto de ids nas duas versões.
  const selUm = [todos[0]!];
  const selOito = todos.slice(0, 8);
  const selPav = doNivel;
  const realceAntes = {
    um: medir(() => highlightOfAntes(ms.scene, selUm, ESTILO)),
    oito: medir(() => highlightOfAntes(ms.scene, selOito, ESTILO)),
    pav: medir(() => highlightOfAntes(ms.scene, selPav, ESTILO)),
  };
  const realceDepois = {
    um: medir(() => highlightOf(ms.scene, selUm, ESTILO)),
    oito: medir(() => highlightOf(ms.scene, selOito, ESTILO)),
    pav: medir(() => highlightOf(ms.scene, selPav, ESTILO)),
    repetido: medir(() => highlightOf(ms.scene, selUm, ESTILO)),
  };
  const caixaAntes = medir(() => caixaDaSelecaoAntes(ms.scene, selPav));
  const caixaDepois = medir(() => caixaDaSelecao(ms.scene, selPav));
  const a = caixaDaSelecaoAntes(ms.scene, selPav)!;
  const b = caixaDaSelecao(ms.scene, selPav)!;
  const erroCaixa = Math.max(a.min.distanceTo(b.min), a.max.distanceTo(b.max));

  console.log(`--- ${nivel} pav × ${paredes} paredes (${todos.length} elementos distintos; ${selPav.length} no pavimento 0)`);
  console.log(`pickElement           ${f(pickE)} ms  (${acertos}/${RUNS} acertos, ${ndc.length} pontos em rodízio)`);
  console.log(`pickModelPoint        ${f(pickP)} ms`);
  console.log(`realce 1 id      antes ${f(realceAntes.um)}  depois ${f(realceDepois.um)} ms`);
  console.log(`realce 8 ids     antes ${f(realceAntes.oito)}  depois ${f(realceDepois.oito)} ms`);
  console.log(`realce pavimento antes ${f(realceAntes.pav)}  depois ${f(realceDepois.pav)} ms`);
  console.log(`realce 1 id repetido (depois) ${f(realceDepois.repetido)} ms`);
  console.log(`caixa seleção    antes ${f(caixaAntes)}  depois ${f(caixaDepois)} ms (erro ${erroCaixa.toExponential(2)} m)`);
  console.log(`checksum picking ${checksum.total.toFixed(6)}`);
  ms.dispose();
}

for (const [n, w] of [[60, 128], [30, 256]] as const) rodar(n, w);
void THREE;
