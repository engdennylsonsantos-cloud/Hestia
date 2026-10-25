import { describe, expect, it } from 'vitest';
import type { Project } from '@hestia/model';
import { ClienteResolucao, type WorkerLike } from './cliente.ts';
import { executarResolucao } from './executor.ts';
import { projetoComPavimentos } from './fixturePavimentos.ts';
import { ERRO_PROJETO_AUSENTE, type PedidoResolucao, type RespostaResolucao } from './protocolo.ts';
import { instalarServidor, type EscopoServidor } from './servidor.ts';
import { criarWorkerSimulado } from './workerSimulado.ts';

/** Worker simulado que anota, de cada pedido enviado, se a estrutura do projeto foi junto. */
function workerEspiao(): { worker: WorkerLike; estruturas: boolean[] } {
  const interno = criarWorkerSimulado();
  const estruturas: boolean[] = [];
  const worker: WorkerLike = {
    get onmessage() {
      return interno.onmessage;
    },
    set onmessage(f) {
      interno.onmessage = f;
    },
    get onerror() {
      return interno.onerror;
    },
    set onerror(f) {
      interno.onerror = f;
    },
    postMessage(m: unknown) {
      const pedido = m as PedidoResolucao;
      if (pedido.projeto) estruturas.push(pedido.projeto.estrutura !== undefined);
      interno.postMessage(m);
    },
    terminate: () => interno.terminate(),
  };
  return { worker, estruturas };
}

describe('projeto enviado ao worker uma vez por versão', () => {
  it('pedidos do mesmo projeto e versão seguem sem a estrutura; outra versão manda de novo; o resultado é o mesmo', async () => {
    const v1 = projetoComPavimentos(2);
    const w = v1.elements['pav_1_w1']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    const v2: Project = { ...v1, elements: { ...v1.elements, [w.id]: { ...w, b: { x: w.b.x + 1, y: w.b.y } } } };
    const { worker, estruturas } = workerEspiao();
    const cliente = new ClienteResolucao({ usarWorker: true, criarWorker: () => worker });
    expect(await cliente.resolver('nivel', 'pav_0', v1, 1)).toEqual(executarResolucao('nivel', v1, 'pav_0'));
    expect(await cliente.resolver('juncoes', 'pav_0', v1, 1)).toEqual(executarResolucao('juncoes', v1, 'pav_0'));
    expect(await cliente.resolver('nivel', 'pav_1', v1, 1)).toEqual(executarResolucao('nivel', v1, 'pav_1'));
    expect(estruturas).toEqual([true, false, false]);
    expect(await cliente.resolver('nivel', 'pav_1', v2, 2)).toEqual(executarResolucao('nivel', v2, 'pav_1'));
    expect(await cliente.resolver('juncoes', 'pav_1', v2, 2)).toEqual(executarResolucao('juncoes', v2, 'pav_1'));
    expect(estruturas).toEqual([true, false, false, true, false]);
  });

  it('dois pedidos em voo da mesma versão: o segundo não leva a estrutura e o primeiro continua com o projeto dele', async () => {
    const v1 = projetoComPavimentos(2);
    const { worker, estruturas } = workerEspiao();
    const cliente = new ClienteResolucao({ usarWorker: true, criarWorker: () => worker });
    const [a, b] = await Promise.all([cliente.resolver('nivel', 'pav_0', v1, 1), cliente.resolver('pisos', 'pav_1', v1, 1)]);
    expect(a).toEqual(executarResolucao('nivel', v1, 'pav_0'));
    expect(b).toEqual(executarResolucao('pisos', v1, 'pav_1'));
    expect(estruturas).toEqual([true, false]);
  });
});

describe('servidor: projeto omitido', () => {
  const escopoFalso = (): EscopoServidor & { respostas: RespostaResolucao[] } => {
    const respostas: RespostaResolucao[] = [];
    return { respostas, onmessage: null, postMessage: (m: unknown) => void respostas.push(m as RespostaResolucao) };
  };
  const esperar = (ms = 60) => new Promise((r) => setTimeout(r, ms));

  it('pedido sem estrutura usa o projeto da mesma versão que chegou antes, mesmo que outro chegue enquanto ele espera na fila', async () => {
    const escopo = escopoFalso();
    const vistos: unknown[] = [];
    instalarServidor(escopo, (_t, projeto, nivel) => (vistos.push(projeto), nivel));
    const p1 = { marca: 1 } as unknown as Project;
    const p2 = { marca: 2 } as unknown as Project;
    escopo.onmessage?.({ data: { id: 1, tipo: 'nivel', nivel: 'a', projeto: { versao: 1, estrutura: p1 } } });
    escopo.onmessage?.({ data: { id: 2, tipo: 'juncoes', nivel: 'a', projeto: { versao: 1 } } });
    escopo.onmessage?.({ data: { id: 3, tipo: 'nivel', nivel: 'b', projeto: { versao: 2, estrutura: p2 } } });
    await esperar();
    expect(escopo.respostas.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(vistos).toEqual([p1, p1, p2]);
  });

  it('versão que o servidor não tem: responde erro de projeto ausente, e o cliente reenvia completo', async () => {
    const escopo = escopoFalso();
    instalarServidor(escopo, () => 'x');
    escopo.onmessage?.({ data: { id: 9, tipo: 'nivel', nivel: 'a', projeto: { versao: 4 } } });
    expect(escopo.respostas).toEqual([{ id: 9, resultado: null, erro: ERRO_PROJETO_AUSENTE }]);

    // Worker que "esqueceu" o projeto (reiniciado): o cliente acha que ainda o tem e manda sem estrutura.
    const p = projetoComPavimentos(1);
    let esquecer = false;
    const interno = criarWorkerSimulado();
    const worker: WorkerLike = {
      get onmessage() {
        return interno.onmessage;
      },
      set onmessage(f) {
        interno.onmessage = f;
      },
      onerror: null,
      terminate: () => interno.terminate(),
      postMessage(m: unknown) {
        const pedido = m as PedidoResolucao;
        if (esquecer && pedido.projeto.estrutura === undefined) {
          // A resposta de erro que um servidor sem o projeto daria.
          setTimeout(() => interno.onmessage?.({ data: { id: pedido.id, resultado: null, erro: ERRO_PROJETO_AUSENTE } }), 0);
          return;
        }
        interno.postMessage(m);
      },
    };
    const cliente = new ClienteResolucao({ usarWorker: true, criarWorker: () => worker });
    await cliente.resolver('nivel', 'pav_0', p, 1);
    esquecer = true;
    expect(await cliente.resolver('juncoes', 'pav_0', p, 1)).toEqual(executarResolucao('juncoes', p, 'pav_0'));
  });
});
