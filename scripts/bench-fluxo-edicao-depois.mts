/**
 * Parte "depois" de `bench-fluxo-edicao.mts`: o fluxo incremental (`FluxoEdicao`) com a mesma edição de parede.
 *
 * Por edição mede, a partir do instante em que `store.exec` é chamado:
 *  - provisório: até o ouvinte receber o evento `provisorio` (resposta visual imediata);
 *  - exato: até o evento `exato` do nível editado (patch de diferença aplicado);
 *  - concluído: até o evento `concluido` (inclui as junções dos níveis afetados);
 *  - bloqueio síncrono: quanto dura a chamada `store.exec` inteira (é o que trava a thread principal antes de o
 *    navegador poder pintar), já com o envio do pedido ao cliente de resolução.
 * Dois clientes: thread principal em fatias (sem Worker) e worker simulado (cada mensagem dá a volta por
 * `structuredClone`, na mesma thread: o custo de clone da thread principal é real, o paralelismo não é simulado).
 */
import { performance } from 'node:perf_hooks';
import { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import { criarWorkerSimulado } from '@hestia/engine/src/worker/workerSimulado.ts';
import { ProjectStore, type Id } from '@hestia/model';
import { FluxoEdicao, type EventoFluxo } from '../apps/web/src/editor/fluxoEdicao.ts';
import { syntheticProject } from './perf-baselines/projeto-sintetico.mts';

const mediana = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.ceil(0.95 * xs.length) - 1)]!;
const fmt = (xs: number[]): string => `mediana ${mediana(xs).toFixed(2)} ms, p95 ${p95(xs).toFixed(2)} ms (n=${xs.length})`;
const esperar = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function esperarAte(condicao: () => boolean, limiteMs = 300_000): Promise<void> {
  const inicio = performance.now();
  while (!condicao()) {
    if (performance.now() - inicio > limiteMs) throw new Error('tempo esgotado');
    await esperar(2);
  }
}

async function medirCom(rotulo: string, cliente: ClienteResolucao, pavimentos: number, repeticoes: number, medio: number, editar: (s: ProjectStore, k: number) => void): Promise<void> {
  const store = new ProjectStore(syntheticProject(pavimentos));
  const fluxo = new FluxoEdicao({ cliente });
  const nivelEditado: Id = store.project.levels[medio]!.id;
  let t0 = 0;
  const marcas = { provisorio: 0, exato: 0, concluido: 0 };
  let tamanhoPatch = 0;
  let paredesNoPatch = 0;
  fluxo.assinar((e: EventoFluxo) => {
    const agora = performance.now();
    if (e.tipo === 'provisorio' && marcas.provisorio === 0) marcas.provisorio = agora;
    if (e.tipo === 'exato' && e.patch.nivel === nivelEditado && marcas.exato === 0) {
      marcas.exato = agora;
      paredesNoPatch = Object.keys(e.patch.paredes).length;
      tamanhoPatch = JSON.stringify(e.patch).length;
    }
    if (e.tipo === 'concluido') marcas.concluido = agora;
  });
  fluxo.abrir(store.project, store.version);
  store.subscribe(() => fluxo.atualizar(store.project, store.version));
  await esperarAte(() => marcas.concluido > 0);

  const prov: number[] = [];
  const exato: number[] = [];
  const concl: number[] = [];
  const bloqueio: number[] = [];
  for (let k = 0; k < repeticoes + 2; k++) {
    marcas.provisorio = marcas.exato = marcas.concluido = 0;
    t0 = performance.now();
    editar(store, k);
    const bloqueioSincrono = performance.now() - t0;
    await esperarAte(() => marcas.concluido > 0);
    if (k >= 2) {
      prov.push(marcas.provisorio - t0);
      exato.push(marcas.exato - t0);
      concl.push(marcas.concluido - t0);
      bloqueio.push(bloqueioSincrono);
    }
    await esperar(5);
  }
  console.log(`DEPOIS (${rotulo}), ${pavimentos} pavimentos`);
  console.log(`  até o provisório (resposta visual):   ${fmt(prov)}`);
  console.log(`  bloqueio síncrono da edição (exec):   ${fmt(bloqueio)}`);
  console.log(`  até o exato do nível editado:         ${fmt(exato)}`);
  console.log(`  até concluir (com junções):           ${fmt(concl)}`);
  console.log(`  patch do nível: ${paredesNoPatch} paredes trocadas, ~${(tamanhoPatch / 1024).toFixed(0)} KB em JSON`);
  fluxo.cancelar();
}

export async function medirDepois(pavimentos: number, repeticoes: number, medio: number, editar: (s: ProjectStore, k: number) => void): Promise<void> {
  await medirCom('thread principal em fatias, sem Worker', new ClienteResolucao(), pavimentos, repeticoes, medio, editar);
  await medirCom('worker simulado, clone nos dois sentidos', new ClienteResolucao({ usarWorker: true, criarWorker: () => criarWorkerSimulado() }), pavimentos, repeticoes, medio, editar);
}
