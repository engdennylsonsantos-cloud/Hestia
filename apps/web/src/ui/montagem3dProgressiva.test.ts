import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LevelResolveCache, type ResolvedLevel } from '@hestia/engine';
import { ClienteResolucao, type WorkerLike } from '@hestia/engine/src/worker/cliente.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import type { Id, Project } from '@hestia/model';
import { ModelScene, type Scene3DOptions } from '@hestia/render';
import { criarFonteNiveisWorker } from './montagem3dNiveis.ts';
import { Montagem3dProgressiva, ordemDeMontagem, proximoLote, type CenaMontagem, type FonteNiveis, type FonteWorker } from './montagem3dProgressiva.ts';

/** Projeto mínimo só com os ids dos níveis (a montagem não lê mais nada além deles nos testes de fila). */
const projetoDeIds = (ids: Id[]): Project => ({ levels: ids.map((id) => ({ id })) }) as unknown as Project;
/** Nível falso: a montagem só repassa o objeto à cena. */
const nivelFalso = (id: Id): ResolvedLevel => ({ levelId: id }) as unknown as ResolvedLevel;
const OPT: Scene3DOptions = { edges: false, shadows: false, dark: false };

/** Cena que anota cada atualização (ids dos níveis e o projeto). */
class CenaAnotada implements CenaMontagem {
  readonly chamadas: Array<{ ids: Id[]; projeto: Project }> = [];
  update(p: Project, niveis: ResolvedLevel[]): void {
    this.chamadas.push({ ids: niveis.map((n) => (n as unknown as { levelId: Id }).levelId), projeto: p });
  }
}

/** Agendador manual: as tarefas ficam numa fila até o teste rodá-las. */
function filaManual(): { agendar: (t: () => void) => void; rodar: () => void } {
  const fila: Array<() => void> = [];
  return {
    agendar: (t) => fila.push(t),
    rodar: () => {
      while (fila.length > 0) fila.shift()!();
    },
  };
}

/** Fonte que conta quantas vezes cada nível foi calculado na hora. */
function fonteContada(pronto?: (id: Id) => ResolvedLevel | null): FonteNiveis & { calculados: Id[] } {
  const calculados: Id[] = [];
  return {
    calculados,
    pronto,
    resolver: (id) => {
      calculados.push(id);
      return nivelFalso(id);
    },
  };
}

describe('ordemDeMontagem', () => {
  it('o visível vem primeiro, depois os mais perto dele (empate: a ordem do projeto)', () => {
    expect(ordemDeMontagem(['a', 'b', 'c', 'd', 'e'], 'c')).toEqual(['c', 'b', 'd', 'a', 'e']);
  });

  it('sem visível, ou com visível desconhecido, começa pelo primeiro nível', () => {
    expect(ordemDeMontagem(['a', 'b', 'c'], null)).toEqual(['a', 'b', 'c']);
    expect(ordemDeMontagem(['a', 'b', 'c'], 'x')).toEqual(['a', 'b', 'c']);
  });
});

describe('proximoLote', () => {
  it('dobra quando a fatia coube com folga', () => {
    expect(proximoLote(2, 1, 12)).toBe(4);
  });

  it('divide quando a fatia estourou o orçamento, sem passar de 1 para baixo', () => {
    expect(proximoLote(4, 20, 12)).toBe(2);
    expect(proximoLote(1, 20, 12)).toBe(1);
  });

  it('mantém o tamanho quando a fatia ficou na faixa do orçamento', () => {
    expect(proximoLote(3, 8, 12)).toBe(3);
  });

  it('não passa do teto', () => {
    expect(proximoLote(8, 1, 12)).toBe(8);
  });
});

describe('Montagem3dProgressiva: fatias', () => {
  it('a primeira fatia é síncrona e traz o visível com os dois vizinhos, na ordem do projeto', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    const p = projetoDeIds(ids);
    const cena = new CenaAnotada();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar });
    m.iniciar(p, OPT, 'n10');
    expect(cena.chamadas).toHaveLength(1);
    expect(cena.chamadas[0]!.ids).toEqual(['n9', 'n10', 'n11']);
  });

  it('a cena cresce a cada fatia e termina com todos os níveis na ordem do projeto', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    const p = projetoDeIds(ids);
    const cena = new CenaAnotada();
    const fila = filaManual();
    let atualizacoes = 0;
    let concluidas = 0;
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => atualizacoes++, aoConcluir: () => concluidas++, agendar: fila.agendar });
    m.iniciar(p, OPT, 'n0');
    fila.rodar();
    const tamanhos = cena.chamadas.map((c) => c.ids.length);
    expect(tamanhos.every((t, i) => i === 0 || t > tamanhos[i - 1]!)).toBe(true);
    expect(cena.chamadas.at(-1)!.ids).toEqual(ids);
    expect(atualizacoes).toBe(cena.chamadas.length);
    expect(concluidas).toBe(1);
    expect(m.montados).toBe(20);
  });

  it('o lote cresce quando a fatia é barata (3, 6, 8, 3)', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    const cena = new CenaAnotada();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar, relogio: () => 0 });
    m.iniciar(projetoDeIds(ids), OPT, 'n0');
    fila.rodar();
    expect(cena.chamadas.map((c) => c.ids.length)).toEqual([3, 9, 17, 20]);
  });

  it('o lote encolhe quando a fatia estoura o orçamento', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `n${i}`);
    const cena = new CenaAnotada();
    const fila = filaManual();
    let t = 0;
    // Cada leitura do relógio avança 20 ms: a fatia dura 20 ms, acima do orçamento de 12 ms.
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar, relogio: () => (t += 20), orcamentoMs: 12 });
    m.iniciar(projetoDeIds(ids), OPT, 'n0');
    fila.rodar();
    expect(cena.chamadas.map((c) => c.ids.length)).toEqual([3, 4, 5, 6]);
  });

  it('sem níveis: a cena é atualizada uma vez, vazia, e a montagem conclui', () => {
    const cena = new CenaAnotada();
    let concluidas = 0;
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => concluidas++ });
    m.iniciar(projetoDeIds([]), OPT, null);
    expect(cena.chamadas).toHaveLength(1);
    expect(cena.chamadas[0]!.ids).toEqual([]);
    expect(concluidas).toBe(1);
  });
});

describe('Montagem3dProgressiva: fonte e cancelamento', () => {
  it('usa o pronto em segundo plano quando há, sem calcular esse nível de novo', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const cena = new CenaAnotada();
    const fila = filaManual();
    const fonte = fonteContada((id) => (id === 'c' ? nivelFalso('c') : null));
    const m = new Montagem3dProgressiva({ cena, fonte, aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar });
    m.iniciar(projetoDeIds(ids), OPT, 'a');
    fila.rodar();
    expect(fonte.calculados).not.toContain('c');
    expect(cena.chamadas.at(-1)!.ids).toEqual(ids);
  });

  it('iniciar de novo cancela a montagem anterior: as fatias antigas não mexem na cena', () => {
    const cena = new CenaAnotada();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => undefined, agendar: fila.agendar });
    const antigo = projetoDeIds(['a', 'b', 'c', 'd', 'e']);
    const novo = projetoDeIds(['x', 'y']);
    m.iniciar(antigo, OPT, 'a');
    m.iniciar(novo, OPT, 'x');
    fila.rodar();
    expect(cena.chamadas.filter((c) => c.projeto === antigo)).toHaveLength(1);
    expect(cena.chamadas.at(-1)!.ids).toEqual(['x', 'y']);
  });

  it('cancelar: as fatias agendadas não atualizam a cena nem concluem', () => {
    const cena = new CenaAnotada();
    const fila = filaManual();
    let concluidas = 0;
    const m = new Montagem3dProgressiva({ cena, fonte: fonteContada(), aoAtualizar: () => undefined, aoConcluir: () => concluidas++, agendar: fila.agendar });
    m.iniciar(projetoDeIds(['a', 'b', 'c', 'd', 'e']), OPT, 'a');
    m.cancelar();
    fila.rodar();
    expect(cena.chamadas).toHaveLength(1);
    expect(concluidas).toBe(0);
  });
});

/** Conteúdo da cena: cada malha e linha com tipo, categoria, faixas de picking, matriz e posições. Na ordem da cena. */
function assinatura(ms: ModelScene): string[] {
  const linhas: string[] = [];
  ms.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
    const pos = o.geometry.getAttribute('position');
    linhas.push([o.type, String(o.userData.kind), JSON.stringify(o.userData.ranges ?? null), o.matrixWorld.elements.join(','), pos ? Array.from(pos.array as ArrayLike<number>).join(',') : ''].join('|'));
  });
  return linhas;
}

describe('Montagem3dProgressiva: resultado igual à montagem completa', () => {
  for (const opt of [OPT, { edges: true, shadows: false, dark: true }] as Scene3DOptions[]) {
    it(`20 pavimentos (edges=${opt.edges}, dark=${opt.dark}): a cena final é a mesma da montagem de uma vez`, () => {
      const p = projetoComPavimentos(20);
      const ids = p.levels.map((l) => l.id);

      const cheia = new ModelScene();
      const cacheCheia = new LevelResolveCache();
      cheia.update(p, ids.map((id) => cacheCheia.get(p, id)), opt);

      const parcial = new ModelScene();
      const cenaParcial: CenaMontagem = {
        update: (proj, niveis, o) => {
          parcial.update(proj, niveis, o);
        },
      };
      const cacheParcial = new LevelResolveCache();
      const fila = filaManual();
      let concluidas = 0;
      const m = new Montagem3dProgressiva({
        cena: cenaParcial,
        fonte: { resolver: (id) => cacheParcial.get(p, id) },
        aoAtualizar: () => undefined,
        aoConcluir: () => concluidas++,
        agendar: fila.agendar,
      });
      m.iniciar(p, opt, 'pav_10');
      fila.rodar();

      expect(concluidas).toBe(1);
      expect(assinatura(cheia).length).toBeGreaterThan(100);
      expect(assinatura(parcial)).toEqual(assinatura(cheia));
      expect(parcial.orbit.sceneRadius).toBe(cheia.orbit.sceneRadius);
    }, 120_000);
  }

  it('caminho pronto (resolução já em segundo plano) dá a mesma cena final que o caminho com resolução', () => {
    const p = projetoComPavimentos(20);
    const ids = p.levels.map((l) => l.id);
    const prontos = new LevelResolveCache();
    const niveisProntos = new Map(ids.map((id) => [id, prontos.get(p, id)] as const));

    const cheia = new ModelScene();
    cheia.update(p, ids.map((id) => niveisProntos.get(id)!), OPT);

    const comPronto = new ModelScene();
    const fila = filaManual();
    const m = new Montagem3dProgressiva({
      cena: { update: (proj, niveis, o) => comPronto.update(proj, niveis, o) },
      // Sem `resolver` útil: se a montagem calculasse algum nível, o teste acusaria a volta do cálculo na hora.
      fonte: { resolver: () => { throw new Error('não devia calcular: o nível já está pronto'); }, pronto: (id) => niveisProntos.get(id) ?? null },
      aoAtualizar: () => undefined,
      aoConcluir: () => undefined,
      agendar: fila.agendar,
    });
    m.iniciar(p, OPT, 'pav_10');
    fila.rodar();

    expect(assinatura(comPronto)).toEqual(assinatura(cheia));
  }, 120_000);
});

/** Worker simulado: guarda os pedidos e entrega o nível quando o teste manda (`entregar`), um de cada vez. */
class WorkerFalso implements FonteWorker {
  readonly iniciados: Project[] = [];
  readonly pedidos: Id[] = [];
  /** Pedidos ainda sem resposta, na ordem em que foram feitos. */
  private emCurso = new Map<Id, { resolver: (n: ResolvedLevel) => void; rejeitar: (e: unknown) => void }>();
  /** Falha todo pedido novo (teste da rede de segurança). */
  falhar = false;

  iniciar(projeto: Project): void {
    this.iniciados.push(projeto);
  }

  pedir(id: Id): Promise<ResolvedLevel> {
    this.pedidos.push(id);
    if (this.falhar) return Promise.reject(new Error('worker falhou'));
    return new Promise((resolver, rejeitar) => this.emCurso.set(id, { resolver, rejeitar }));
  }

  /** Responde o pedido do nível. */
  entregar(id: Id): void {
    const p = this.emCurso.get(id);
    if (!p) return;
    this.emCurso.delete(id);
    p.resolver(nivelFalso(id));
  }

  cancelar(): void {
    for (const p of this.emCurso.values()) p.rejeitar(new Error('cancelado'));
    this.emCurso.clear();
  }

  encerrar(): void {
    this.cancelar();
  }

  get abertos(): number {
    return this.emCurso.size;
  }
}

/** Deixa as promessas do worker assentarem (o `.then` da montagem roda em microtarefa). */
const assentar = (): Promise<void> => new Promise((res) => setTimeout(res, 0));

describe('Montagem3dProgressiva: níveis no worker', () => {
  it('a primeira fatia traz só o visível; o resto vem do worker, um pedido de cada vez e na ordem da montagem', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const cena = new CenaAnotada();
    const fonte = fonteContada();
    const worker = new WorkerFalso();
    const m = new Montagem3dProgressiva({
      cena, fonte, worker, aoAtualizar: () => undefined, aoConcluir: () => undefined,
    });
    m.iniciar(projetoDeIds(ids), OPT, 'c');
    // Primeira fatia na hora: só o visível, para o primeiro quadro ter o que mostrar. O worker já está com a fila cheia
    // (dois pedidos: a resolução de um nível corre enquanto a cena monta o outro).
    expect(cena.chamadas.map((c) => c.ids)).toEqual([['c']]);
    expect(fonte.calculados).toEqual(['c']);
    expect(worker.pedidos).toEqual(['b', 'd']);
    expect(worker.abertos).toBe(2);
    expect(worker.iniciados).toHaveLength(1);

    for (const id of ['b', 'd', 'a', 'e']) {
      worker.entregar(id);
      await assentar();
      expect(worker.pedidos.filter((x) => x === id)).toHaveLength(1);
    }
    expect(fonte.calculados).toEqual(['c']);
    expect(cena.chamadas.map((c) => c.ids)).toEqual([['c'], ['b', 'c'], ['b', 'c', 'd'], ['a', 'b', 'c', 'd'], ids]);
    expect(m.montados).toBe(5);
    expect(m.usandoWorker).toBe(false);
  });

  it('cancelar cancela os pedidos: resposta que chega depois não mexe na cena', async () => {
    const cena = new CenaAnotada();
    const fonte = fonteContada();
    const worker = new WorkerFalso();
    const m = new Montagem3dProgressiva({ cena, fonte, worker, aoAtualizar: () => undefined, aoConcluir: () => undefined });
    m.iniciar(projetoDeIds(['a', 'b', 'c']), OPT, 'a');
    m.cancelar();
    expect(worker.abertos).toBe(0);
    await assentar();
    expect(cena.chamadas).toHaveLength(1);
  });

  it('iniciar de novo cancela os pedidos da montagem anterior', async () => {
    const cena = new CenaAnotada();
    const fonte = fonteContada();
    const worker = new WorkerFalso();
    const m = new Montagem3dProgressiva({ cena, fonte, worker, aoAtualizar: () => undefined, aoConcluir: () => undefined });
    const antigo = projetoDeIds(['a', 'b', 'c', 'd']);
    m.iniciar(antigo, OPT, 'a');
    m.iniciar(projetoDeIds(['x', 'y']), OPT, 'x');
    await assentar();
    // Os pedidos da montagem anterior ("b" e "c") são cancelados; o novo projeto já enche a fila com o "y".
    expect(worker.pedidos).toEqual(['b', 'c', 'y']);
    expect(cena.chamadas.filter((c) => c.projeto === antigo)).toHaveLength(1);
    worker.entregar('y');
    await assentar();
    expect(cena.chamadas.at(-1)!.ids).toEqual(['x', 'y']);
  });

  it('falha do worker cai na resolução da thread da interface e tenta de novo; duas falhas, desiste do worker', async () => {
    const ids = ['a', 'b', 'c', 'd'];
    const cena = new CenaAnotada();
    const fonte = fonteContada();
    const worker = new WorkerFalso();
    const m = new Montagem3dProgressiva({ cena, fonte, worker, aoAtualizar: () => undefined, aoConcluir: () => undefined });
    m.iniciar(projetoDeIds(ids), OPT, 'a');
    // O worker quebra: o pedido em curso é rejeitado e os próximos falham na hora.
    worker.falhar = true;
    worker.cancelar();
    await assentar();
    // A falha do pedido em curso calcula o nível aqui; a do pedido seguinte faz a montagem desistir do worker.
    expect(fonte.calculados).toContain('b');
    expect(m.usandoWorker).toBe(false);
    await assentar();
    await assentar();
    expect(cena.chamadas.at(-1)!.ids).toEqual(ids);
  });

  it('worker que não responde não trava a montagem: o prazo calcula o nível na thread da interface', async () => {
    const ids = ['a', 'b', 'c'];
    const cena = new CenaAnotada();
    const fonte = fonteContada();
    const worker = new WorkerFalso();
    const m = new Montagem3dProgressiva({
      cena, fonte, worker, aoAtualizar: () => undefined, aoConcluir: () => undefined, prazoWorkerMs: 15,
    });
    m.iniciar(projetoDeIds(ids), OPT, 'a');
    expect(worker.pedidos).toEqual(['b', 'c']);
    await new Promise((res) => setTimeout(res, 40));
    // O prazo venceu: 'b' foi calculado aqui e a montagem pediu o próximo; o segundo prazo desiste do worker.
    expect(fonte.calculados).toContain('b');
    await new Promise((res) => setTimeout(res, 40));
    expect(m.usandoWorker).toBe(false);
    expect(cena.chamadas.at(-1)!.ids).toEqual(ids);
  });

  it('caminho do worker dá a mesma cena final que a montagem de uma vez', async () => {
    const p = projetoComPavimentos(20);
    const ids = p.levels.map((l) => l.id);
    const cache = new LevelResolveCache();
    const niveis = new Map(ids.map((id) => [id, cache.get(p, id)] as const));

    const cheia = new ModelScene();
    cheia.update(p, ids.map((id) => niveis.get(id)!), OPT);

    const parcial = new ModelScene();
    const worker: FonteWorker = {
      iniciar: () => undefined,
      pedir: (id) => Promise.resolve(niveis.get(id)!),
      cancelar: () => undefined,
      encerrar: () => undefined,
    };
    const m = new Montagem3dProgressiva({
      cena: { update: (proj, lv, o) => parcial.update(proj, lv, o) },
      fonte: { pronto: (id) => niveis.get(id) ?? null, resolver: () => { throw new Error('não devia calcular: o nível está no worker'); } },
      worker,
      aoAtualizar: () => undefined,
      aoConcluir: () => undefined,
    });
    m.iniciar(p, OPT, 'pav_10');
    for (let i = 0; i < ids.length * 2 && m.montados < ids.length; i++) await assentar();
    expect(m.montados).toBe(ids.length);
    expect(assinatura(parcial)).toEqual(assinatura(cheia));
  }, 120_000);
});

/** Worker simulado do protocolo: responde cada pedido de nível com o nível falso e anota o que atravessou. */
class WorkerQueResponde implements WorkerLike {
  onmessage: ((evento: { data: unknown }) => void) | null = null;
  onerror: ((evento: unknown) => void) | null = null;
  readonly recebidos: Array<{ id: number; tipo: string; nivel: Id; projeto: { versao: number; estrutura?: Project } }> = [];
  /** Falso: guarda os pedidos sem responder (para o teste de cancelamento). */
  mudo = false;

  postMessage(mensagem: unknown): void {
    const m = mensagem as { id: number; tipo: string; nivel: Id; projeto: { versao: number; estrutura?: Project } };
    if (m.tipo === 'cancelar') return;
    this.recebidos.push(m);
    if (this.mudo) return;
    queueMicrotask(() => this.onmessage?.({ data: { id: m.id, resultado: nivelFalso(m.nivel), erro: null } }));
  }

  terminate(): void {
    // Nada a encerrar num substituto.
  }
}

describe('criarFonteNiveisWorker', () => {
  it('sem worker de verdade devolve null (a montagem fica no caminho síncrono)', () => {
    expect(criarFonteNiveisWorker({ cliente: new ClienteResolucao({ usarWorker: false }) })).toBeNull();
  });

  it('pede o nível ao worker e devolve o mesmo resultado da resolução local', async () => {
    const worker = new WorkerQueResponde();
    const fonte = criarFonteNiveisWorker({ cliente: new ClienteResolucao({ usarWorker: true, criarWorker: () => worker }) })!;
    const p = projetoDeIds(['a', 'b']);
    fonte.iniciar(p);
    const nivel = await fonte.pedir('a', p);
    expect((nivel as unknown as { levelId: Id }).levelId).toBe('a');
    expect(worker.recebidos.map((m) => [m.tipo, m.nivel])).toEqual([['nivel', 'a']]);
    fonte.encerrar();
  });

  it('a estrutura do projeto atravessa uma vez só (versão por projeto) e outro projeto ganha outra versão', async () => {
    const worker = new WorkerQueResponde();
    const fonte = criarFonteNiveisWorker({ cliente: new ClienteResolucao({ usarWorker: true, criarWorker: () => worker }) })!;
    const p = projetoDeIds(['a', 'b']);
    const outro = projetoDeIds(['c']);
    fonte.iniciar(p);
    await fonte.pedir('a', p);
    await fonte.pedir('b', p);
    await fonte.pedir('c', outro);
    const [primeiro, segundo, terceiro] = worker.recebidos;
    expect(primeiro!.projeto.estrutura).toBe(p);
    expect(segundo!.projeto.estrutura).toBeUndefined();
    expect(segundo!.projeto.versao).toBe(primeiro!.projeto.versao);
    expect(terceiro!.projeto.estrutura).toBe(outro);
    expect(terceiro!.projeto.versao).not.toBe(primeiro!.projeto.versao);
    fonte.encerrar();
  });

  it('cancelar rejeita o pedido em curso (a montagem trata como cancelamento)', async () => {
    const worker = new WorkerQueResponde();
    worker.mudo = true;
    const fonte = criarFonteNiveisWorker({ cliente: new ClienteResolucao({ usarWorker: true, criarWorker: () => worker }) })!;
    const p = projetoDeIds(['a']);
    fonte.iniciar(p);
    const promessa = fonte.pedir('a', p);
    fonte.cancelar();
    await expect(promessa).rejects.toThrow(/cancelad/i);
    fonte.encerrar();
  });
});
