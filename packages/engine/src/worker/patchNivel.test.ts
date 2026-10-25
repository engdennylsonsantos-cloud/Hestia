import { describe, expect, it } from 'vitest';
import { ProjectStore, type Project } from '@hestia/model';
import { aplicarPatchNivel, MemoriaPatch, type PatchNivel } from '../fluxoPatch.ts';
import { resolveLevel } from '../resolve.ts';
import { ClienteResolucao } from './cliente.ts';
import { executarResolucao } from './executor.ts';
import { projetoComPavimentos } from './fixturePavimentos.ts';
import { instalarServidor, type EscopoServidor } from './servidor.ts';
import type { PedidoResolucao, RespostaResolucao } from './protocolo.ts';
import { criarWorkerSimulado } from './workerSimulado.ts';

const espera = (ms = 80) => new Promise((r) => setTimeout(r, ms));

function moverParede(p: Project, id: string, dx: number): Project {
  const w = p.elements[id];
  if (!w || w.kind !== 'wall') throw new Error(`parede ${id} não encontrada`);
  const store = new ProjectStore(p);
  store.exec({ type: 'setWallEnds', id, b: { x: w.b.x + dx, y: w.b.y } });
  return store.project;
}

describe('executarResolucao: patchNivel', () => {
  it('sem base, devolve o patch completo; com a base da memória, só a diferença', () => {
    const p = projetoComPavimentos(2);
    const memoria = new MemoriaPatch();
    const completo = executarResolucao('patchNivel', p, 'pav_1', undefined, { versao: 1, base: null, memoria }) as PatchNivel;
    expect(completo.base).toBeNull();
    expect(aplicarPatchNivel(null, completo)).toEqual(resolveLevel(p, 'pav_1'));
    const p2 = moverParede(p, 'pav_1_w1', 0.6);
    const diferenca = executarResolucao('patchNivel', p2, 'pav_1', undefined, { versao: 2, base: 1, memoria }) as PatchNivel;
    expect(diferenca.base).toBe(1);
    expect(aplicarPatchNivel(aplicarPatchNivel(null, completo), diferenca)).toEqual(resolveLevel(p2, 'pav_1'));
  });

  it('sem contexto usa a memória do módulo e o patch é completo', () => {
    const p = projetoComPavimentos(1);
    const patch = executarResolucao('patchNivel', p, 'pav_0') as PatchNivel;
    expect(patch.base).toBeNull();
    expect(patch.versao).toBe(0);
  });
});

describe('servidor: patchNivel guarda a memória por servidor', () => {
  it('o pedido seguinte com a base certa recebe a diferença; com base errada, o patch completo', async () => {
    const respostas: RespostaResolucao[] = [];
    const escopo: EscopoServidor = { onmessage: null, postMessage: (m) => void respostas.push(m as RespostaResolucao) };
    instalarServidor(escopo);
    const p = projetoComPavimentos(2);
    const p2 = moverParede(p, 'pav_1_w1', 0.6);
    const pedido = (id: number, projeto: Project, versao: number, base: number | null): PedidoResolucao => ({
      id,
      tipo: 'patchNivel',
      nivel: 'pav_1',
      projeto: { versao, estrutura: projeto },
      base,
    });
    escopo.onmessage?.({ data: pedido(1, p, 1, null) });
    await espera();
    escopo.onmessage?.({ data: pedido(2, p2, 2, 1) });
    await espera();
    escopo.onmessage?.({ data: pedido(3, p2, 3, 1) }); // a memória já está na versão 2: base 1 não bate
    await espera();
    const [r1, r2, r3] = respostas.map((r) => r.resultado as PatchNivel);
    expect(r1!.base).toBeNull();
    expect(r2!.base).toBe(1);
    expect(r3!.base).toBeNull();
  });
});

describe('cliente: patchNivel no worker simulado e na thread principal', () => {
  for (const modo of ['worker', 'principal'] as const) {
    it(`${modo}: diferença sobre o estado anterior reproduz o nível exato`, async () => {
      const cliente = new ClienteResolucao(modo === 'worker' ? { usarWorker: true, criarWorker: () => criarWorkerSimulado() } : {});
      expect(cliente.modo).toBe(modo);
      const p = projetoComPavimentos(2);
      const p2 = moverParede(p, 'pav_1_w1', 0.6);
      const p1 = (await cliente.resolver('patchNivel', 'pav_1', p, 1, null)) as PatchNivel;
      const estado = aplicarPatchNivel(null, p1);
      expect(estado).toEqual(resolveLevel(p, 'pav_1'));
      const p2patch = (await cliente.resolver('patchNivel', 'pav_1', p2, 2, 1)) as PatchNivel;
      expect(p2patch.base).toBe(1);
      expect(aplicarPatchNivel(estado, p2patch)).toEqual(resolveLevel(p2, 'pav_1'));
      cliente.encerrar();
    });
  }

  it('pedidos de patch do mesmo nível se substituem (só o mais recente vale)', async () => {
    const cliente = new ClienteResolucao();
    const p = projetoComPavimentos(1);
    const antigo = cliente.resolver('patchNivel', 'pav_0', p, 1, null);
    const novo = cliente.resolver('patchNivel', 'pav_0', p, 2, null);
    await expect(antigo).rejects.toMatchObject({ motivo: 'substituido' });
    expect(((await novo) as PatchNivel).versao).toBe(2);
  });
});
