import { describe, expect, it } from 'vitest';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import { criarWorkerSimulado } from '@hestia/engine/src/worker/workerSimulado.ts';
import { ProjectStore, type Command, type Id, type Project } from '@hestia/model';
import { FluxoEdicao, type EventoFluxo } from './fluxoEdicao.ts';

/**
 * O resultado exato que chega por patch de nível é o mesmo do cálculo direto do projeto editado, para 1 e para 20
 * níveis, nas edições de parede, de porta e de janela, e o que sai de versão antiga é descartado.
 */

async function esperarAte(condicao: () => boolean, limiteMs = 240_000): Promise<void> {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error('tempo esgotado esperando o fluxo');
    await new Promise((r) => setTimeout(r, 5));
  }
}

function montar(pavimentos: number, comWorker: boolean) {
  const store = new ProjectStore(projetoComPavimentos(pavimentos));
  const cliente = comWorker ? new ClienteResolucao({ usarWorker: true, criarWorker: () => criarWorkerSimulado() }) : new ClienteResolucao();
  const fluxo = new FluxoEdicao({ cliente });
  const eventos: EventoFluxo[] = [];
  fluxo.assinar((e) => eventos.push(e));
  fluxo.abrir(store.project, store.version);
  store.subscribe(() => fluxo.atualizar(store.project, store.version));
  const concluidos = (): number => eventos.filter((e) => e.tipo === 'concluido').length;
  const aguardarConclusao = async (): Promise<void> => {
    const antes = concluidos();
    await esperarAte(() => concluidos() > antes);
  };
  return { store, fluxo, eventos, aguardarConclusao };
}

/** Todos os níveis do fluxo iguais ao cálculo direto, com cache novo, do projeto atual. */
function conferirTodos(store: ProjectStore, fluxo: FluxoEdicao): void {
  const p: Project = store.project;
  for (const l of p.levels) {
    const exato = fluxo.nivelPronto(l.id);
    expect(exato, `nível ${l.id} pronto`).not.toBeNull();
    expect(exato as ResolvedLevel, `nível ${l.id}`).toEqual(resolveLevel(p, l.id, new Map()));
  }
}

const moverPonta = (store: ProjectStore, id: Id, dx: number): void => {
  const w = store.project.elements[id];
  if (!w || w.kind !== 'wall') throw new Error(`parede ${id} não encontrada`);
  store.exec({ type: 'setWallEnds', id, b: { x: w.b.x + dx, y: w.b.y } });
};

const janela = (nivel: number): Command => ({
  type: 'addOpening',
  opening: { id: `pav_${nivel}_j`, kind: 'window', typeId: 'ot_j120', hostId: `pav_${nivel}_w1`, offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
});

describe.each([
  { pavimentos: 1, comWorker: true },
  { pavimentos: 1, comWorker: false },
  { pavimentos: 20, comWorker: true },
])('patch por nível igual ao cálculo direto: $pavimentos nível(is), worker $comWorker', ({ pavimentos, comWorker }) => {
  it('edição de parede, porta e janela, e desfazer: cada passo gera patch só dos níveis afetados e o resultado confere', async () => {
    const f = montar(pavimentos, comWorker);
    await f.aguardarConclusao();
    conferirTodos(f.store, f.fluxo);
    const alvo = Math.floor(pavimentos / 2);
    const nivel = `pav_${alvo}`;

    const passos: Array<[string, () => void]> = [
      ['parede', () => moverPonta(f.store, `pav_${alvo}_w1`, 0.5)],
      ['porta', () => f.store.exec({ type: 'updateElements', ids: [`pav_${alvo}_o`], patch: { offset: 3.5 } })],
      ['janela', () => f.store.exec(janela(alvo))],
    ];
    for (const [rotulo, editar] of passos) {
      f.eventos.length = 0;
      editar();
      await f.aguardarConclusao();
      const exatos = f.eventos.filter((e): e is Extract<EventoFluxo, { tipo: 'exato' }> => e.tipo === 'exato');
      expect(exatos.map((e) => e.patch.nivel), rotulo).toEqual([nivel]);
      expect(exatos[0]!.patch.base, `${rotulo}: diferença sobre o exato anterior`).not.toBeNull();
      expect(Object.keys(exatos[0]!.patch.paredes).length, `${rotulo}: só as paredes que mudaram`).toBeLessThanOrEqual(3);
      conferirTodos(f.store, f.fluxo);
    }
    f.eventos.length = 0;
    f.store.undo();
    await f.aguardarConclusao();
    conferirTodos(f.store, f.fluxo);
    f.fluxo.cancelar();
  }, 300_000);
});

describe('descarte por versão em projeto de 20 níveis', () => {
  it('duas edições seguidas no mesmo nível: o exato da primeira nunca é aplicado e o resultado final confere', async () => {
    const f = montar(20, true);
    await f.aguardarConclusao();
    f.eventos.length = 0;
    moverPonta(f.store, 'pav_10_w1', 0.5);
    const v1 = f.store.version;
    await new Promise((r) => setTimeout(r, 0)); // o pedido da primeira sai
    moverPonta(f.store, 'pav_10_w1', 0.5);
    const v2 = f.store.version;
    await f.aguardarConclusao();
    const exatos = f.eventos.filter((e): e is Extract<EventoFluxo, { tipo: 'exato' }> => e.tipo === 'exato');
    expect(exatos.some((e) => e.versao === v1)).toBe(false);
    expect(exatos.every((e) => e.versao >= v2)).toBe(true);
    expect(f.eventos.some((e) => e.tipo === 'descartado' && e.nivel === 'pav_10' && e.versao === v1)).toBe(true);
    conferirTodos(f.store, f.fluxo);
    f.fluxo.cancelar();
  }, 300_000);

  it('mudança global com pedido em voo: o resultado em curso é descartado e todos os níveis são refeitos certos', async () => {
    const f = montar(20, true);
    await f.aguardarConclusao();
    f.eventos.length = 0;
    moverPonta(f.store, 'pav_10_w1', 0.5);
    const v1 = f.store.version;
    await new Promise((r) => setTimeout(r, 0));
    const wt = f.store.project.wallTypes['wt_ext19']!;
    f.store.exec({ type: 'upsertWallType', wallType: { ...wt, name: 'Renomeado' } });
    await f.aguardarConclusao();
    const exatos = f.eventos.filter((e): e is Extract<EventoFluxo, { tipo: 'exato' }> => e.tipo === 'exato');
    expect(exatos.some((e) => e.versao === v1)).toBe(false);
    expect(f.eventos.some((e) => e.tipo === 'descartado' && e.versao === v1)).toBe(true);
    conferirTodos(f.store, f.fluxo);
    f.fluxo.cancelar();
  }, 300_000);
});
