import { describe, expect, it } from 'vitest';
import { executarResolucao } from '@hestia/engine/src/worker/executor.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import { criarClienteResolucao } from './resolveWorker.ts';

describe('criarClienteResolucao', () => {
  it('vem desligado por padrão: roda na thread principal e iguala o cálculo direto', async () => {
    const p = projetoComPavimentos(2);
    const cliente = criarClienteResolucao();
    expect(cliente.modo).toBe('principal');
    expect(await cliente.resolver('nivel', 'pav_1', p, 1)).toEqual(executarResolucao('nivel', p, 'pav_1'));
  });

  it('com usarWorker, mas sem Worker no ambiente (Node), cai para a thread principal', async () => {
    const p = projetoComPavimentos(1);
    const cliente = criarClienteResolucao({ usarWorker: true });
    expect(cliente.modo).toBe('principal');
    expect(await cliente.resolver('ambientes', 'pav_0', p, 1)).toEqual(executarResolucao('ambientes', p, 'pav_0'));
  });
});
