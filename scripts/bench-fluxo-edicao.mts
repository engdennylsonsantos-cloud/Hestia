/**
 * Medição do fluxo de edição (parede) em Node, projeto sintético de 20 pavimentos.
 *
 * Cada edição move a ponta `b` de uma parede do nível do meio (como o roteiro do navegador). Mede:
 *  - ANTES (caminho síncrono): `niveisAfetados` + `LevelResolveCache.get` dos níveis afetados na thread principal. A
 *    interface não recebe nada até o fim: provisório = exato.
 *  - DEPOIS (fluxo incremental): tempo até o patch provisório (geometria barata do elemento editado, sem junção) e
 *    tempo até o patch exato do nível (resolução em fatias na thread principal, e com o cliente de worker simulado,
 *    que dá a volta por `structuredClone` nos dois sentidos). Também o tamanho do que atravessa o worker.
 *
 * Uso: npx vite-node -c <config com alias> scripts/bench-fluxo-edicao.mts [pavimentos] [repeticoes]
 */
import { performance } from 'node:perf_hooks';
import { LevelResolveCache, niveisAfetados, resolveLevel } from '@hestia/engine';
import { ProjectStore, type Id, type Project } from '@hestia/model';
import { syntheticProject } from './perf-baselines/projeto-sintetico.mts';

const PAVIMENTOS = Number(process.argv[2] ?? 20);
const REPETICOES = Number(process.argv[3] ?? 15);
const MEDIO = Math.floor(PAVIMENTOS / 2);

const mediana = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(0.95 * xs.length) - 1)]!;
const fmt = (xs: number[]): string => `mediana ${mediana(xs).toFixed(2)} ms, p95 ${p95(xs).toFixed(2)} ms (n=${xs.length})`;

/** Edita a parede de índice 25 do nível do meio: a ponta `b` anda `k` mm. */
function editar(store: ProjectStore, k: number): void {
  const id = `perf_w_${MEDIO}_25`;
  const w = store.project.elements[id];
  if (!w || w.kind !== 'wall') throw new Error(`Parede ${id} não encontrada`);
  store.exec({ type: 'setWallEnds', id, b: { x: w.b.x + (k % 2 === 0 ? 0.05 : -0.05), y: w.b.y } });
}

function antes(): void {
  const store = new ProjectStore(syntheticProject(PAVIMENTOS));
  const cache = new LevelResolveCache();
  const ids: Id[] = store.project.levels.map((l) => l.id);
  for (const id of ids) cache.get(store.project, id); // aquece: todos os níveis resolvidos
  const diff: number[] = [];
  const nivelVisivel: number[] = [];
  const todosAfetados: number[] = [];
  let afetados = 0;
  for (let k = 0; k < REPETICOES + 2; k++) {
    const p0 = store.project;
    editar(store, k);
    const p1 = store.project;
    const t0 = performance.now();
    const a = niveisAfetados(p0, p1);
    const t1 = performance.now();
    afetados = a === 'todos' ? ids.length : a.size;
    cache.get(p1, ids[MEDIO]!);
    const t2 = performance.now();
    for (const id of ids) cache.get(p1, id);
    const t3 = performance.now();
    if (k >= 2) {
      diff.push(t1 - t0);
      nivelVisivel.push(t2 - t0);
      todosAfetados.push(t3 - t0);
    }
  }
  console.log(`ANTES (síncrono, thread principal), ${PAVIMENTOS} pavimentos, níveis afetados por edição: ${afetados}`);
  console.log(`  niveisAfetados:                      ${fmt(diff)}`);
  console.log(`  até o nível editado resolvido:       ${fmt(nivelVisivel)}   (= provisório = exato: a tela não recebe nada antes)`);
  console.log(`  até todos os níveis resolvidos (3D): ${fmt(todosAfetados)}`);
}

/** Custo do que atravessaria o worker: clone do projeto e do resultado de um nível. */
function custoDeClone(): void {
  const p: Project = syntheticProject(PAVIMENTOS);
  const ida: number[] = [];
  const volta: number[] = [];
  const nivel = resolveLevel(p, p.levels[MEDIO]!.id);
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    structuredClone(p);
    const t1 = performance.now();
    structuredClone(nivel);
    const t2 = performance.now();
    if (i >= 2) {
      ida.push(t1 - t0);
      volta.push(t2 - t1);
    }
  }
  console.log(`CLONE (structuredClone, o que o worker custa à thread principal)`);
  console.log(`  projeto inteiro (ida):    ${fmt(ida)}`);
  console.log(`  ResolvedLevel (volta):    ${fmt(volta)}`);
}

antes();
custoDeClone();
const depois = process.env.SEM_DEPOIS ? null : await import('./bench-fluxo-edicao-depois.mts').catch(() => null);
if (depois) await depois.medirDepois(PAVIMENTOS, REPETICOES, MEDIO, editar);
