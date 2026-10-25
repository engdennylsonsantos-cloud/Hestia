import { describe, expect, it } from 'vitest';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { elementoProvisorio } from '@hestia/engine/src/fluxoProvisorio.ts';
import { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import { criarWorkerSimulado } from '@hestia/engine/src/worker/workerSimulado.ts';
import { ProjectStore, type Command, type Id } from '@hestia/model';
import { FluxoEdicao, type EventoFluxo } from './fluxoEdicao.ts';

/**
 * O que a planta lê do fluxo para mostrar a edição: o provisório no mesmo turno da edição (`doNivel`, `apagarDoNivel`,
 * `removidosDoNivel`), o exato igual ao cálculo direto no lugar dele, e a edição velha que não reaparece depois da nova.
 */

async function esperarAte(condicao: () => boolean, limiteMs = 60_000): Promise<void> {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error('tempo esgotado esperando o fluxo');
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Editor mínimo como o controller: o fluxo recebe cada mudança do store e a tela lê `fluxo.provisorios`. */
function montar(pavimentos: number) {
  const store = new ProjectStore(projetoComPavimentos(pavimentos));
  const cliente = new ClienteResolucao({ usarWorker: true, criarWorker: () => criarWorkerSimulado() });
  const fluxo = new FluxoEdicao({ cliente });
  const provisorios = fluxo.provisorios; // como o controller: ligado antes de qualquer edição
  const eventos: EventoFluxo[] = [];
  fluxo.assinar((e) => eventos.push(e));
  fluxo.abrir(store.project, store.version);
  store.subscribe(() => fluxo.atualizar(store.project, store.version));
  const concluir = async (): Promise<void> => {
    const antes = eventos.filter((e) => e.tipo === 'concluido').length;
    await esperarAte(() => eventos.filter((e) => e.tipo === 'concluido').length > antes);
  };
  const mover = (id: Id, dx: number): void => {
    const w = store.project.elements[id];
    if (!w || w.kind !== 'wall') throw new Error(`parede ${id} não encontrada`);
    store.exec({ type: 'setWallEnds', id, b: { x: w.b.x + dx, y: w.b.y } });
  };
  return { store, fluxo, provisorios, eventos, concluir, mover };
}

const caixaDe = (el: { caixa: Float64Array }): number[] => [...el.caixa];

describe('provisório na tela: editar parede', () => {
  it('a edição já traz o contorno novo no mesmo turno, e o antigo para apagar', async () => {
    const f = montar(2);
    await f.concluir();
    const antes = f.store.project;
    const contornoAntes = elementoProvisorio(antes, antes.elements['pav_1_w1']!, 'pav_1')!;
    f.mover('pav_1_w1', 0.5);
    // Síncrono, sem esperar nada: a planta já tem o que desenhar.
    const novo = f.provisorios.doNivel('pav_1').find((e) => e.id === 'pav_1_w1');
    expect(novo?.provisorio).toBe(true);
    expect(caixaDe(novo!)).toEqual(caixaDe(elementoProvisorio(f.store.project, f.store.project.elements['pav_1_w1']!, 'pav_1')!));
    expect(caixaDe(novo!)).not.toEqual(caixaDe(contornoAntes));
    // O contorno que o último exato ainda mostra é o de antes da edição.
    const apagar = f.provisorios.apagarDoNivel('pav_1').find((e) => e.id === 'pav_1_w1');
    expect(caixaDe(apagar!)).toEqual(caixaDe(contornoAntes));
    expect(f.provisorios.niveis()).toEqual(['pav_1']);
    f.fluxo.cancelar();
  });

  it('o exato igual ao cálculo direto substitui o provisório', async () => {
    const f = montar(2);
    await f.concluir();
    f.mover('pav_1_w1', 0.5);
    expect(f.provisorios.doNivel('pav_1')).not.toEqual([]);
    await f.concluir();
    // Substituído: nada a desenhar nem a apagar, e o que a tela passa a ler é o exato do cálculo direto.
    expect(f.provisorios.doNivel('pav_1')).toEqual([]);
    expect(f.provisorios.apagarDoNivel('pav_1')).toEqual([]);
    expect(f.provisorios.niveis()).toEqual([]);
    expect(f.fluxo.nivelPronto('pav_1') as ResolvedLevel).toEqual(resolveLevel(f.store.project, 'pav_1', new Map()));
    f.fluxo.cancelar();
  });

  it('edição antiga não aparece depois da nova: vale o provisório mais novo e o exato da última versão', async () => {
    const f = montar(2);
    await f.concluir();
    const original = f.store.project.elements['pav_1_w1']!;
    const contornoOriginal = elementoProvisorio(f.store.project, original, 'pav_1')!;
    f.mover('pav_1_w1', 0.5); // edição velha, ainda sem exato
    f.mover('pav_1_w1', 1.5); // edição nova por cima
    const final = elementoProvisorio(f.store.project, f.store.project.elements['pav_1_w1']!, 'pav_1')!;
    const lista = f.provisorios.doNivel('pav_1').filter((e) => e.id === 'pav_1_w1');
    expect(lista).toHaveLength(1);
    expect(caixaDe(lista[0]!)).toEqual(caixaDe(final)); // só o da edição nova
    // Apagar vale o primeiro: o desenho de antes das duas edições, nunca o intermediário (que a tela não chegou a pintar).
    const apagar = f.provisorios.apagarDoNivel('pav_1').filter((e) => e.id === 'pav_1_w1');
    expect(apagar).toHaveLength(1);
    expect(caixaDe(apagar[0]!)).toEqual(caixaDe(contornoOriginal));
    await f.concluir();
    expect(f.provisorios.niveis()).toEqual([]);
    expect(f.fluxo.nivelPronto('pav_1') as ResolvedLevel).toEqual(resolveLevel(f.store.project, 'pav_1', new Map()));
    f.fluxo.cancelar();
  });
});

describe('provisório na tela: porta, janela e remoção', () => {
  const janela: Command = {
    type: 'addOpening',
    opening: { id: 'pav_1_j', kind: 'window', typeId: 'ot_j120', hostId: 'pav_1_w1', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  };

  it('janela nova: vão para desenhar e nada a apagar; mover a janela apaga o vão antigo', async () => {
    const f = montar(2);
    await f.concluir();
    f.store.exec(janela);
    expect(f.provisorios.doNivel('pav_1').map((e) => e.id)).toContain('pav_1_j');
    expect(f.provisorios.apagarDoNivel('pav_1')).toEqual([]);
    await f.concluir();
    const vaoAntes = elementoProvisorio(f.store.project, f.store.project.elements['pav_1_j']!, 'pav_1')!;
    f.store.exec({ type: 'setOpeningHost', id: 'pav_1_j', hostId: 'pav_1_w1', offset: 4.5 });
    const apagar = f.provisorios.apagarDoNivel('pav_1').find((e) => e.id === 'pav_1_j');
    expect(caixaDe(apagar!)).toEqual(caixaDe(vaoAntes));
    const novo = f.provisorios.doNivel('pav_1').find((e) => e.id === 'pav_1_j');
    expect(caixaDe(novo!)).not.toEqual(caixaDe(vaoAntes));
    await f.concluir();
    expect(f.fluxo.nivelPronto('pav_1') as ResolvedLevel).toEqual(resolveLevel(f.store.project, 'pav_1', new Map()));
    f.fluxo.cancelar();
  });

  it('parede removida: escondida e com o contorno antigo para apagar', async () => {
    const f = montar(2);
    await f.concluir();
    const w = f.store.project.elements['pav_1_w3']!;
    const contorno = elementoProvisorio(f.store.project, w, 'pav_1')!;
    f.store.exec({ type: 'deleteElements', ids: ['pav_1_w3'] });
    expect(f.provisorios.removidosDoNivel('pav_1')).toContain('pav_1_w3');
    expect(f.provisorios.doNivel('pav_1').map((e) => e.id)).not.toContain('pav_1_w3');
    const apagar = f.provisorios.apagarDoNivel('pav_1').find((e) => e.id === 'pav_1_w3');
    expect(caixaDe(apagar!)).toEqual(caixaDe(contorno));
    f.fluxo.cancelar();
  });
});
