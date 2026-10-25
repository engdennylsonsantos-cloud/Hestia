import { describe, expect, it } from 'vitest';
import { LevelResolveCache, type ResolvedLevel } from '@hestia/engine';
import { ClienteResolucao } from '@hestia/engine/src/worker/cliente.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import { criarWorkerSimulado } from '@hestia/engine/src/worker/workerSimulado.ts';
import { ProjectStore, type Id, type Project } from '@hestia/model';
import { FluxoEdicao, LIMITE_PROVISORIO, ProvisoriosAtivos, type EventoFluxo } from './fluxoEdicao.ts';

async function esperarAte(condicao: () => boolean, limiteMs = 60_000): Promise<void> {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error('tempo esgotado esperando o fluxo');
    await new Promise((r) => setTimeout(r, 5));
  }
}

const clienteSimulado = (): ClienteResolucao => new ClienteResolucao({ usarWorker: true, criarWorker: () => criarWorkerSimulado() });

/** Editor mínimo: store + fluxo ligados como no controller (cada mudança do store chama `atualizar`). */
function montar(pavimentos: number, cliente: ClienteResolucao = clienteSimulado()) {
  const store = new ProjectStore(projetoComPavimentos(pavimentos));
  const fluxo = new FluxoEdicao({ cliente });
  const eventos: EventoFluxo[] = [];
  fluxo.assinar((e) => eventos.push(e));
  fluxo.abrir(store.project, store.version);
  store.subscribe(() => fluxo.atualizar(store.project, store.version));
  const mover = (id: string, dx: number): void => {
    const w = store.project.elements[id];
    if (!w || w.kind !== 'wall') throw new Error(`parede ${id} não encontrada`);
    store.exec({ type: 'setWallEnds', id, b: { x: w.b.x + dx, y: w.b.y } });
  };
  const tipos = (): string[] => eventos.map((e) => e.tipo);
  const exatoDe = (nivel: Id): ResolvedLevel | null => fluxo.nivelPronto(nivel);
  return { store, fluxo, eventos, mover, tipos, exatoDe };
}

describe('FluxoEdicao: resposta imediata', () => {
  it('a edição gera o provisório no mesmo turno, antes de qualquer resultado exato', async () => {
    const f = montar(3);
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    f.mover('pav_1_w1', 0.5);
    // Síncrono: nada esperado ainda, e o provisório já está lá.
    expect(f.tipos()).toEqual(['provisorio']);
    const e = f.eventos[0]!;
    if (e.tipo !== 'provisorio') throw new Error('esperava provisório');
    expect(e.versao).toBe(f.store.version);
    expect(e.alteracao.alterados).toContain('pav_1_w1');
    expect(e.patches.map((p) => p.nivel)).toEqual(['pav_1']);
    expect(e.patches[0]!.elementos.find((el) => el.id === 'pav_1_w1')?.provisorio).toBe(true);
  });

  it('sem ouvinte não calcula provisório (custo zero)', () => {
    const store = new ProjectStore(projetoComPavimentos(2));
    const fluxo = new FluxoEdicao({ cliente: clienteSimulado() });
    fluxo.abrir(store.project, store.version);
    const w = store.project.elements['pav_1_w1']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    store.exec({ type: 'setWallEnds', id: w.id, b: { x: w.b.x + 1, y: w.b.y } });
    expect(() => fluxo.atualizar(store.project, store.version)).not.toThrow();
    fluxo.cancelar();
  });

  it('mudança global e mudança grande viram recarga, sem provisório', async () => {
    const f = montar(2);
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    const wt = f.store.project.wallTypes['wt_ext19']!;
    f.store.exec({ type: 'upsertWallType', wallType: { ...wt, name: 'Outro nome' } });
    expect(f.eventos).toHaveLength(1);
    expect(f.eventos[0]).toMatchObject({ tipo: 'recarga', niveis: 'todos' });
    f.eventos.length = 0;
    const grande = Array.from({ length: LIMITE_PROVISORIO + 1 }, (_, i) => ({
      type: 'addWall' as const,
      wall: { ...(f.store.project.elements['pav_0_w0'] as Extract<Project['elements'][string], { kind: 'wall' }>), id: `extra_${i}` },
    }));
    f.store.exec({ type: 'batch', commands: grande });
    expect(f.tipos()[0]).toBe('recarga');
    expect(f.tipos()).not.toContain('provisorio');
    f.fluxo.cancelar();
  });
});

describe('FluxoEdicao: resultado exato por patch', () => {
  it('chega um patch por nível afetado, igual ao cálculo direto, e o resto do projeto não é refeito', async () => {
    const f = montar(3);
    await esperarAte(() => f.tipos().includes('concluido'));
    const outroNivel = f.exatoDe('pav_0');
    f.eventos.length = 0;
    f.mover('pav_1_w1', 0.5);
    await esperarAte(() => f.tipos().includes('concluido'));
    const exatos = f.eventos.filter((e) => e.tipo === 'exato');
    expect(exatos).toHaveLength(1);
    const patch = exatos[0]!.tipo === 'exato' ? exatos[0]!.patch : null;
    expect(patch?.nivel).toBe('pav_1');
    expect(patch?.base).not.toBeNull(); // diferença sobre o exato anterior, não o nível inteiro
    expect(f.exatoDe('pav_1')).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    expect(f.exatoDe('pav_0')).toBe(outroNivel);
    expect(f.tipos().indexOf('provisorio')).toBeLessThan(f.tipos().indexOf('exato'));
    expect(f.tipos()[f.tipos().length - 1]).toBe('concluido');
    f.fluxo.cancelar();
  });

  it('sem Worker (thread principal, em fatias) o resultado é o mesmo', async () => {
    const f = montar(2, new ClienteResolucao());
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    f.mover('pav_1_w2', -0.4);
    await esperarAte(() => f.tipos().includes('concluido'));
    expect(f.exatoDe('pav_1')).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    f.fluxo.cancelar();
  });

  it('desfazer volta ao exato anterior (e cada passo gera seu patch)', async () => {
    const f = montar(2);
    await esperarAte(() => f.tipos().includes('concluido'));
    const original = f.store.project;
    f.mover('pav_1_w1', 0.5);
    await esperarAte(() => f.fluxo.nivelPronto('pav_1') !== null && !f.fluxo.pendente('pav_1'));
    await esperarAte(() => f.tipos().includes('concluido') && !f.fluxo.pendente('pav_1'));
    const concluidosAntes = f.tipos().filter((t) => t === 'concluido').length;
    f.store.undo();
    await esperarAte(() => f.tipos().filter((t) => t === 'concluido').length > concluidosAntes);
    expect(f.store.project).toEqual(original);
    expect(f.exatoDe('pav_1')).toEqual(new LevelResolveCache().get(original, 'pav_1'));
    f.fluxo.cancelar();
  });
});

describe('FluxoEdicao: descarte por versão', () => {
  it('duas edições seguidas no mesmo nível: só o resultado da última é aplicado; o da antiga é descartado', async () => {
    const f = montar(3);
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    f.mover('pav_1_w1', 0.5);
    const v1 = f.store.version;
    f.mover('pav_1_w1', 0.5);
    const v2 = f.store.version;
    await esperarAte(() => f.tipos().includes('concluido'));
    const exatos = f.eventos.filter((e): e is Extract<EventoFluxo, { tipo: 'exato' }> => e.tipo === 'exato');
    expect(exatos.every((e) => e.versao >= v2)).toBe(true);
    expect(exatos.some((e) => e.versao === v1)).toBe(false);
    expect(f.exatoDe('pav_1')).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    f.fluxo.cancelar();
  });

  it('resposta que já estava a caminho quando a edição chegou vira `descartado`', async () => {
    const f = montar(2);
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    f.mover('pav_1_w1', 0.5);
    await new Promise((r) => setTimeout(r, 0)); // deixa o pedido sair
    const v1 = f.store.version;
    f.mover('pav_1_w1', 0.5); // alcança o mesmo nível com o pedido em voo
    await esperarAte(() => f.tipos().includes('concluido'));
    const descartes = f.eventos.filter((e) => e.tipo === 'descartado');
    expect(descartes.length).toBeGreaterThan(0);
    expect(descartes[0]).toMatchObject({ tipo: 'descartado', nivel: 'pav_1', versao: v1, motivo: 'versao-antiga' });
    expect(f.exatoDe('pav_1')).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    f.fluxo.cancelar();
  });

  it('edição em outro nível não descarta o resultado em curso de um nível não afetado', async () => {
    const f = montar(3);
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    f.mover('pav_2_w1', 0.5);
    await new Promise((r) => setTimeout(r, 0));
    f.mover('pav_0_w1', 0.5); // outro nível
    await esperarAte(() => f.tipos().includes('concluido'));
    expect(f.eventos.filter((e) => e.tipo === 'descartado' && e.nivel === 'pav_2')).toHaveLength(0);
    expect(f.exatoDe('pav_2')).toEqual(new LevelResolveCache().get(f.store.project, 'pav_2'));
    expect(f.exatoDe('pav_0')).toEqual(new LevelResolveCache().get(f.store.project, 'pav_0'));
    f.fluxo.cancelar();
  });
});

describe('FluxoEdicao: consulta do nível (resolvido / pendente)', () => {
  it('padrão: devolve sempre o exato da versão atual, calculando na hora', async () => {
    const f = montar(2);
    await esperarAte(() => f.tipos().includes('concluido'));
    f.mover('pav_1_w1', 0.5);
    const cache = new LevelResolveCache();
    const agora = f.fluxo.resolvido('pav_1', () => cache.get(f.store.project, 'pav_1'), true);
    expect(agora).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    f.fluxo.cancelar();
  });

  it('exatoAssincrono: devolve o último exato (antigo) com `pendente` verdadeiro, até o patch chegar', async () => {
    const f = montar(2);
    await esperarAte(() => f.tipos().includes('concluido'));
    const cache = new LevelResolveCache();
    const anterior = f.fluxo.resolvido('pav_1', () => cache.get(f.store.project, 'pav_1'), true);
    f.fluxo.exatoAssincrono = true;
    f.mover('pav_1_w1', 0.5);
    expect(f.fluxo.pendente('pav_1')).toBe(true);
    let calculouNaHora = false;
    const durante = f.fluxo.resolvido('pav_1', () => ((calculouNaHora = true), cache.get(f.store.project, 'pav_1')), true);
    expect(calculouNaHora).toBe(false);
    expect(durante).toEqual(anterior);
    // `exigirExato` calcula na hora mesmo no modo assíncrono.
    const exato = f.fluxo.resolvido('pav_1', () => new LevelResolveCache().get(f.store.project, 'pav_1'), true, true);
    expect(exato).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    await esperarAte(() => f.tipos().includes('concluido'));
    expect(f.fluxo.pendente('pav_1')).toBe(false);
    expect(f.fluxo.resolvido('pav_1', () => cache.get(f.store.project, 'pav_1'))).toEqual(exato);
    f.fluxo.cancelar();
  });

  it('exatoAssincrono: nível liberado não devolve o antigo (o recálculo dele não viria)', async () => {
    const f = montar(2);
    await esperarAte(() => f.tipos().includes('concluido'));
    const cache = new LevelResolveCache();
    f.fluxo.resolvido('pav_1', () => cache.get(f.store.project, 'pav_1'), true);
    f.fluxo.exatoAssincrono = true;
    f.fluxo.liberar('pav_1');
    f.mover('pav_1_w1', 0.5);
    let calculou = false;
    const agora = f.fluxo.resolvido('pav_1', () => ((calculou = true), new LevelResolveCache().get(f.store.project, 'pav_1')));
    expect(calculou).toBe(true);
    expect(agora).toEqual(new LevelResolveCache().get(f.store.project, 'pav_1'));
    f.fluxo.cancelar();
  });
});

describe('FluxoEdicao.provisorios', () => {
  it('criado na primeira leitura: passa a guardar o provisório, avisa a interface e limpa quando o exato chega', async () => {
    const store = new ProjectStore(projetoComPavimentos(2));
    let avisos = 0;
    const fluxo = new FluxoEdicao({ cliente: clienteSimulado(), aoMudar: () => avisos++ });
    const tipos: string[] = [];
    fluxo.abrir(store.project, store.version);
    store.subscribe(() => fluxo.atualizar(store.project, store.version));
    const ativos = fluxo.provisorios; // sem isto o fluxo não calcula provisório (nenhum ouvinte)
    fluxo.assinar((e) => tipos.push(e.tipo));
    await esperarAte(() => tipos.includes('concluido'));
    tipos.length = 0;
    const antes = avisos;
    const w = store.project.elements['pav_1_w1'];
    if (!w || w.kind !== 'wall') throw new Error('esperava parede');
    store.exec({ type: 'setWallEnds', id: w.id, b: { x: w.b.x + 0.5, y: w.b.y } });
    expect(ativos.doNivel('pav_1').map((e) => e.id)).toEqual(['pav_1_w1']);
    expect(avisos).toBeGreaterThan(antes);
    await esperarAte(() => tipos.includes('concluido'));
    expect(ativos.niveis()).toEqual([]);
    expect(fluxo.provisorios).toBe(ativos);
    fluxo.cancelar();
  });
});

describe('ProvisoriosAtivos', () => {
  it('o provisório fica até chegar o exato do nível (versão igual ou maior) e então some', async () => {
    const f = montar(2);
    const ativos = new ProvisoriosAtivos();
    f.fluxo.assinar((e) => ativos.aplicar(e));
    await esperarAte(() => f.tipos().includes('concluido'));
    f.eventos.length = 0;
    f.mover('pav_1_w1', 0.5);
    expect(ativos.niveis()).toEqual(['pav_1']);
    expect(ativos.doNivel('pav_1').map((e) => e.id)).toContain('pav_1_w1');
    await esperarAte(() => f.tipos().includes('exato'));
    expect(ativos.niveis()).toEqual([]);
    expect(ativos.doNivel('pav_1')).toEqual([]);
    f.fluxo.cancelar();
  });

  it('remoção aparece como escondida até o exato; recarga limpa tudo', async () => {
    const f = montar(2);
    const ativos = new ProvisoriosAtivos();
    f.fluxo.assinar((e) => ativos.aplicar(e));
    await esperarAte(() => f.tipos().includes('concluido'));
    f.store.exec({ type: 'deleteElements', ids: ['pav_1_w3'] });
    expect(ativos.removidosDoNivel('pav_1')).toContain('pav_1_w3');
    expect(ativos.aplicar({ tipo: 'recarga', versao: 99, niveis: 'todos' })).toBe(true);
    expect(ativos.niveis()).toEqual([]);
    expect(ativos.aplicar({ tipo: 'recarga', versao: 99, niveis: 'todos' })).toBe(false);
    f.fluxo.cancelar();
  });

  it('o provisório mais novo de um id vence; exato antigo não limpa o provisório novo', () => {
    const ativos = new ProvisoriosAtivos();
    const geo = { coords: new Float64Array(0), aneis: new Uint32Array([0]), poligonos: new Uint32Array(0) };
    const el = (z: number) => ({ id: 'w', kind: 'wall' as const, provisorio: true, z0: z, z1: z + 1, geometria: geo, caixa: new Float64Array(4) });
    ativos.aplicar({ tipo: 'provisorio', versao: 5, alteracao: { versao: 5, versaoAnterior: 4, adicionados: [], alterados: ['w'], removidos: [], niveis: new Set(['n']) }, patches: [{ nivel: 'n', versao: 5, elementos: [el(1)], removidos: [] }] });
    ativos.aplicar({ tipo: 'provisorio', versao: 6, alteracao: { versao: 6, versaoAnterior: 5, adicionados: [], alterados: ['w'], removidos: [], niveis: new Set(['n']) }, patches: [{ nivel: 'n', versao: 6, elementos: [el(2)], removidos: [] }] });
    expect(ativos.doNivel('n')[0]!.z0).toBe(2);
    const exato5 = { nivel: 'n', versao: 5, base: null, ordemParedes: [], paredes: {}, removidas: [], ordemAgrupamentos: [], agrupamentos: {}, geometrias: [] };
    ativos.aplicar({ tipo: 'exato', versao: 5, patch: exato5 });
    expect(ativos.doNivel('n')[0]!.z0).toBe(2); // o provisório da versão 6 segue
    ativos.aplicar({ tipo: 'concluido', versao: 6 });
    expect(ativos.niveis()).toEqual([]);
  });
});
