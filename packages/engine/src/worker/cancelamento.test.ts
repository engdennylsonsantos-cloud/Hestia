import { describe, expect, it } from 'vitest';
import { ClienteResolucao } from './cliente.ts';
import { executarResolucao } from './executor.ts';
import { projetoComPavimentos } from './fixturePavimentos.ts';
import { ResolucaoCancelada } from './protocolo.ts';
import { criarWorkerSimulado } from './workerSimulado.ts';

/** Cliente com worker lento: os pedidos ficam pendentes tempo suficiente para serem cancelados. */
const clienteLento = (): ClienteResolucao => new ClienteResolucao({ usarWorker: true, criarWorker: () => criarWorkerSimulado({ latenciaMs: 5 }) });

describe('ClienteResolucao: cancelamento por nível e geral', () => {
  it('cancelarNivel rejeita os pedidos do nível e deixa os demais chegarem', async () => {
    const p = projetoComPavimentos(2);
    const c = clienteLento();
    // O `catch` é ligado já: a rejeição acontece dentro de `cancelarNivel`, antes de qualquer `await`.
    const cancelado = c.resolver('nivel', 'pav_0', p, 1).catch((e: unknown) => e);
    const mantido = c.resolver('nivel', 'pav_1', p, 1);
    c.cancelarNivel('pav_0');
    expect(await cancelado).toBeInstanceOf(ResolucaoCancelada);
    expect(await mantido).toEqual(executarResolucao('nivel', p, 'pav_1'));
  });

  it('cancelarTodos rejeita tudo, zera os pendentes e o cliente segue utilizável', async () => {
    const p = projetoComPavimentos(1);
    const c = clienteLento();
    const cancelado = c.resolver('ambientes', 'pav_0', p, 1).catch((e: unknown) => e);
    c.cancelarTodos();
    expect(await cancelado).toBeInstanceOf(ResolucaoCancelada);
    expect(c.pendentesAbertos).toBe(0);
    expect(await c.resolver('ambientes', 'pav_0', p, 1)).toEqual(executarResolucao('ambientes', p, 'pav_0'));
  });
});
