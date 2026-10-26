import { describe, expect, it } from 'vitest';
import { calcularAlteracao } from '@hestia/engine/src/fluxoPatch.ts';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import { ProjectStore } from '@hestia/model';
import { contornosAnteriores } from './provisorioAnterior.ts';
import { ProvisoriosAtivos } from './fluxoEdicao.ts';

describe('contornosAnteriores', () => {
  it('traz o contorno de antes do que foi alterado ou removido, no nível de origem', () => {
    const store = new ProjectStore(projetoComPavimentos(2));
    const antes = store.project;
    const w = antes.elements['pav_1_w1']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    store.exec({ type: 'batch', commands: [{ type: 'setWallEnds', id: w.id, b: { x: w.b.x + 1, y: w.b.y } }, { type: 'deleteElements', ids: ['pav_1_w3'] }] });
    const alteracao = calcularAlteracao(antes, store.project, store.version, 0);
    const lista = contornosAnteriores(antes, alteracao);
    expect(lista.map((a) => a.elemento.id).sort()).toEqual(['pav_1_w1', 'pav_1_w3']);
    expect(lista.every((a) => a.nivel === 'pav_1' && a.elemento.geometria.coords.length > 0)).toBe(true);
  });

  it('elemento novo não tem passado', () => {
    const store = new ProjectStore(projetoComPavimentos(1));
    const antes = store.project;
    const base = antes.elements['pav_0_w0']!;
    if (base.kind !== 'wall') throw new Error('esperava parede');
    store.exec({ type: 'addWall', wall: { ...base, id: 'nova' } });
    expect(contornosAnteriores(antes, calcularAlteracao(antes, store.project, store.version, 0))).toEqual([]);
  });
});

describe('ProvisoriosAtivos.apagarDoNivel', () => {
  it('contorno anterior de nível sem patch próprio também fica guardado, e some com o exato do nível', () => {
    const store = new ProjectStore(projetoComPavimentos(2));
    const antes = store.project;
    const w = antes.elements['pav_1_w1']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    store.exec({ type: 'setWallEnds', id: w.id, b: { x: w.b.x + 1, y: w.b.y } });
    const alteracao = calcularAlteracao(antes, store.project, store.version, 0);
    const anteriores = contornosAnteriores(antes, alteracao);
    const ativos = new ProvisoriosAtivos();
    // Evento sem patches: os contornos anteriores criam a entrada do nível.
    ativos.aplicar({ tipo: 'provisorio', versao: store.version, alteracao, patches: [], anteriores });
    expect(ativos.apagarDoNivel('pav_1').map((e) => e.id)).toEqual(['pav_1_w1']);
    expect(ativos.apagarDoNivel('pav_0')).toEqual([]);
    const exato = { nivel: 'pav_1', versao: store.version, base: null, ordemParedes: [], paredes: {}, removidas: [], ordemAgrupamentos: [], agrupamentos: {}, geometrias: [] };
    expect(ativos.aplicar({ tipo: 'exato', versao: store.version, patch: exato })).toBe(true);
    expect(ativos.apagarDoNivel('pav_1')).toEqual([]);
  });
});
