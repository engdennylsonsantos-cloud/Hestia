import { describe, expect, it } from 'vitest';
import { LevelResolveCache } from '@hestia/engine';
import { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import { executarResolucao } from '@hestia/engine/src/worker/executor.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import type { TipoResolucao } from '@hestia/engine/src/worker/protocolo.ts';
import { criarWorkerSimulado } from '@hestia/engine/src/worker/workerSimulado.ts';
import type { Id, Project } from '@hestia/model';
import { ResolucaoProgressiva } from './resolucaoAssincrona.ts';

/** Espera uma condição ficar verdadeira (a resolução em segundo plano chega por macrotarefas). */
async function esperarAte(condicao: () => boolean, limiteMs = 60_000): Promise<void> {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error('tempo esgotado esperando a resolução');
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Cliente que anota a ordem dos pedidos, para testar a prioridade. */
class Gravador extends ClienteResolucao {
  readonly log: string[] = [];

  override resolver(tipo: TipoResolucao, nivel: Id, p: Project, versao: number): Promise<unknown> {
    this.log.push(`${tipo}:${nivel}`);
    return super.resolver(tipo, nivel, p, versao);
  }
}

const clienteSimulado = (): ClienteResolucao => new ClienteResolucao({ usarWorker: true, criarWorker: () => criarWorkerSimulado() });

describe('ResolucaoProgressiva: resultado igual ao caminho síncrono', () => {
  it('1 nível: o pronto em segundo plano (worker simulado) é igual ao síncrono, nível e junções', async () => {
    const p = projetoComPavimentos(1);
    const r = new ResolucaoProgressiva({ cliente: clienteSimulado() });
    r.abrir(p);
    await esperarAte(() => r.nivelPronto('pav_0') !== null && r.juncoes('pav_0') !== null);
    expect(r.nivelPronto('pav_0')).toEqual(new LevelResolveCache().get(p, 'pav_0'));
    expect(r.juncoes('pav_0')).toEqual(executarResolucao('juncoes', p, 'pav_0'));
  });

  it('20 níveis: todos prontos pelo worker simulado são iguais ao síncrono', async () => {
    const p = projetoComPavimentos(20);
    const ids = p.levels.map((l) => l.id);
    const r = new ResolucaoProgressiva({ cliente: clienteSimulado() });
    r.abrir(p);
    await esperarAte(() => ids.every((id) => r.nivelPronto(id) !== null));
    const sincrono = new LevelResolveCache();
    for (const id of ids) expect(r.nivelPronto(id)).toEqual(sincrono.get(p, id));
  }, 120_000);

  it('sem Worker (thread principal em fatias): 2 níveis iguais ao síncrono', async () => {
    const p = projetoComPavimentos(2);
    const r = new ResolucaoProgressiva();
    r.abrir(p);
    await esperarAte(() => r.nivelPronto('pav_1') !== null);
    expect(r.nivelPronto('pav_1')).toEqual(new LevelResolveCache().get(p, 'pav_1'));
  });
});

describe('ResolucaoProgressiva: agendamento', () => {
  it('ordem: visível e vizinhos primeiro, um pedido por vez, depois os mais próximos', async () => {
    const p = projetoComPavimentos(4);
    const cliente = new Gravador({ usarWorker: true, criarWorker: () => criarWorkerSimulado() });
    const r = new ResolucaoProgressiva({ cliente });
    r.abrir(p);
    // O controller resolve o visível e o vizinho de forma síncrona: o segundo plano não os refaz (só as junções).
    r.resolvido('pav_0', () => new LevelResolveCache().get(p, 'pav_0'));
    r.resolvido('pav_1', () => new LevelResolveCache().get(p, 'pav_1'));
    await esperarAte(() => r.juncoes('pav_3') !== null);
    expect(cliente.log).toEqual(['juncoes:pav_0', 'juncoes:pav_1', 'patchNivel:pav_2', 'juncoes:pav_2', 'patchNivel:pav_3', 'juncoes:pav_3']);
  });

  it('liberar: cancela o pedido do nível e ele não volta à fila até ser o visível', async () => {
    const p = projetoComPavimentos(3);
    const cliente = new Gravador({ usarWorker: true, criarWorker: () => criarWorkerSimulado() });
    const r = new ResolucaoProgressiva({ cliente });
    r.abrir(p);
    r.liberar('pav_2');
    await esperarAte(() => r.juncoes('pav_1') !== null);
    expect(r.nivelPronto('pav_2')).toBeNull();
    expect(cliente.log.some((s) => s.endsWith(':pav_2'))).toBe(false);
  });

  it('cancelar: a fila para e nenhum pedido novo sai, mesmo com o disparo inicial agendado', async () => {
    const p = projetoComPavimentos(3);
    const cliente = new Gravador({ usarWorker: true, criarWorker: () => criarWorkerSimulado() });
    const r = new ResolucaoProgressiva({ cliente });
    r.abrir(p);
    r.cancelar();
    await new Promise((res) => setTimeout(res, 30));
    expect(cliente.log).toEqual([]);
    expect(r.nivelPronto('pav_0')).toBeNull();
  });

  it('avisa a interface (agrupado) e o contador de versão cresce a cada nível pronto', async () => {
    const p = projetoComPavimentos(2);
    let avisos = 0;
    const r = new ResolucaoProgressiva({ cliente: clienteSimulado(), aoMudar: () => avisos++ });
    const antes = r.versao;
    r.abrir(p);
    await esperarAte(() => r.nivelPronto('pav_1') !== null);
    expect(r.versao).toBeGreaterThan(antes);
    await esperarAte(() => avisos > 0);
  });
});

describe('ResolucaoProgressiva: invalidação por edição', () => {
  it('edição num nível: só ele sai dos prontos; os demais seguem com o mesmo objeto', async () => {
    const p = projetoComPavimentos(3);
    const r = new ResolucaoProgressiva({ cliente: clienteSimulado() });
    r.abrir(p);
    await esperarAte(() => ['pav_0', 'pav_1', 'pav_2'].every((id) => r.nivelPronto(id) !== null));
    const pronto0 = r.nivelPronto('pav_0');
    const parede = p.elements['pav_2_w1'];
    if (!parede || parede.kind !== 'wall') throw new Error('parede de teste não encontrada');
    const p2: Project = { ...p, elements: { ...p.elements, [parede.id]: { ...parede, b: { ...parede.b, x: parede.b.x + 1.5 } } } };
    r.atualizar(p2);
    expect(r.nivelPronto('pav_2')).toBeNull();
    expect(r.nivelPronto('pav_0')).toBe(pronto0);
    await esperarAte(() => r.nivelPronto('pav_2') !== null);
    expect(r.nivelPronto('pav_2')).toEqual(executarResolucao('nivel', p2, 'pav_2'));
    expect(r.nivelPronto('pav_2')).not.toEqual(executarResolucao('nivel', p, 'pav_2'));
  }, 60_000);
});

describe('ResolucaoProgressiva.semear', () => {
  it('põe o resultado conhecido como pronto: vale para a planta e o segundo plano não o recalcula', async () => {
    const p = projetoComPavimentos(2);
    const r = new ResolucaoProgressiva({ cliente: clienteSimulado() });
    r.abrir(p);
    const valor = new LevelResolveCache().get(p, 'pav_1');
    expect(r.semear('pav_1', valor)).toBe(true);
    expect(r.nivelPronto('pav_1')).toBe(valor);
    expect(r.resolvido('pav_1', () => {
      throw new Error('não devia calcular: o nível já está pronto');
    })).toBe(valor);
    await esperarAte(() => r.nivelPronto('pav_0') !== null);
    expect(r.nivelPronto('pav_1')).toBe(valor);
  });

  it('não semeia um nível já calculado na hora (o resultado síncrono prevalece)', () => {
    const p = projetoComPavimentos(1);
    const r = new ResolucaoProgressiva();
    r.abrir(p);
    const sincrono = new LevelResolveCache();
    r.resolvido('pav_0', () => sincrono.get(p, 'pav_0'));
    expect(r.semear('pav_0', sincrono.get(p, 'pav_0'))).toBe(false);
  });
});
