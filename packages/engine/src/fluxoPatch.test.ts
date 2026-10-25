import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, makeWall, totalThickness, type Id, type Project } from '@hestia/model';
import { caixaDe, desempacotarMulti, empacotarAnel, empacotarMulti, empacotarMultis, geometriaVazia, totalVertices } from './fluxoGeometria.ts';
import {
  aplicarPatchNivel,
  calcularAlteracao,
  chaveDoAgrupamento,
  diferencaNivel,
  gerarPatchNivel,
  igualProfundo,
  MemoriaPatch,
  nivelDoElemento,
  patchCompleto,
} from './fluxoPatch.ts';
import { elementoProvisorio, patchesProvisorios } from './fluxoProvisorio.ts';
import { resolveLevel } from './resolve.ts';
import { caminhoNaoSerializavel, colherBuffers } from './worker/protocolo.ts';
import { projetoComPavimentos } from './worker/fixturePavimentos.ts';
import { syntheticProject } from '../../../scripts/perf-baselines/projeto-sintetico.mts';

/** Aplica um comando e devolve os dois projetos. */
function editar(p: Project, comando: Parameters<ProjectStore['exec']>[0]): { antes: Project; depois: Project } {
  const store = new ProjectStore(p);
  store.exec(comando);
  return { antes: p, depois: store.project };
}

const moverB = (p: Project, id: Id, dx: number) => {
  const w = p.elements[id];
  if (!w || w.kind !== 'wall') throw new Error(`parede ${id} não encontrada`);
  return editar(p, { type: 'setWallEnds', id, b: { x: w.b.x + dx, y: w.b.y } });
};

describe('geometria empacotada', () => {
  const multi = [
    [
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
      ],
      [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ],
    ],
    [
      [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 12, y: 11 },
      ],
    ],
  ];

  it('ida e volta devolve o mesmo multipolígono, com furos', () => {
    const g = empacotarMulti(multi);
    expect(g.coords).toBeInstanceOf(Float64Array);
    expect(totalVertices(g)).toBe(10);
    expect(Array.from(g.poligonos)).toEqual([2, 1]);
    expect(Array.from(g.aneis)).toEqual([0, 4, 7, 10]);
    expect(desempacotarMulti(g)).toEqual(multi);
  });

  it('vários multipolígonos viram um só, na ordem', () => {
    const g = empacotarMultis([[multi[0]!], [multi[1]!]]);
    expect(desempacotarMulti(g)).toEqual(multi);
  });

  it('vazio: sem vértices, caixa nula, volta a lista vazia', () => {
    const g = geometriaVazia();
    expect(totalVertices(g)).toBe(0);
    expect(Array.from(caixaDe(g))).toEqual([0, 0, 0, 0]);
    expect(desempacotarMulti(g)).toEqual([]);
  });

  it('caixa envolvente e anel simples', () => {
    expect(Array.from(caixaDe(empacotarMulti(multi)))).toEqual([0, 0, 12, 11]);
    const anel = empacotarAnel([
      { x: -1, y: 2 },
      { x: 3, y: 5 },
      { x: 0, y: -4 },
    ]);
    expect(Array.from(caixaDe(anel))).toEqual([-1, -4, 3, 5]);
    expect(Array.from(anel.poligonos)).toEqual([1]);
  });
});

describe('igualProfundo', () => {
  it('compara objetos, arrays e arrays tipados; chave ausente vale undefined', () => {
    expect(igualProfundo({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(igualProfundo({ a: 1 }, { a: 2 })).toBe(false);
    expect(igualProfundo({ a: 1, b: undefined }, { a: 1 })).toBe(true);
    expect(igualProfundo({ a: 1 }, { a: 1, b: 3 })).toBe(false);
    expect(igualProfundo([1, 2], [1, 2, 3])).toBe(false);
    expect(igualProfundo(new Float64Array([1, 2]), new Float64Array([1, 2]))).toBe(true);
    expect(igualProfundo(new Float64Array([1, 2]), new Float64Array([1, 3]))).toBe(false);
    expect(igualProfundo(NaN, NaN)).toBe(true);
    expect(igualProfundo(null, {})).toBe(false);
    expect(igualProfundo([], {})).toBe(false);
  });
});

describe('calcularAlteracao', () => {
  const p = projetoComPavimentos(3);

  it('mover uma parede: um alterado e só o nível dela afetado', () => {
    const { antes, depois } = moverB(p, 'pav_1_w1', 0.5);
    const alt = calcularAlteracao(antes, depois, 7, 6);
    expect(alt.alterados.sort()).toEqual(expect.arrayContaining(['pav_1_w1']));
    expect(alt.adicionados).toEqual([]);
    expect(alt.removidos).toEqual([]);
    expect(alt.versao).toBe(7);
    expect(alt.versaoAnterior).toBe(6);
    expect(alt.niveis).toBeInstanceOf(Set);
    expect([...(alt.niveis as Set<Id>)]).toContain('pav_1');
    expect((alt.niveis as Set<Id>).has('pav_0')).toBe(false);
  });

  it('remover uma parede: aparece em removidos, com o nível dele', () => {
    const { antes, depois } = editar(p, { type: 'deleteElements', ids: ['pav_2_w3'] });
    const alt = calcularAlteracao(antes, depois, 2, 1);
    expect(alt.removidos).toContain('pav_2_w3');
    expect(nivelDoElemento(antes, 'pav_2_w3')).toBe('pav_2');
    expect(nivelDoElemento(depois, 'pav_2_w3')).toBeNull();
    expect((alt.niveis as Set<Id>).has('pav_2')).toBe(true);
  });

  it('abertura: o nível é o da parede hospedeira', () => {
    expect(nivelDoElemento(p, 'pav_1_o')).toBe('pav_1');
  });

  it('mudança de tipo de parede é global', () => {
    const wt = p.wallTypes['wt_ext19']!;
    const { antes, depois } = editar(p, { type: 'upsertWallType', wallType: { ...wt, name: 'Outro nome' } });
    expect(calcularAlteracao(antes, depois, 2, 1).niveis).toBe('todos');
  });

  it('mesmo projeto: nada alterado', () => {
    const alt = calcularAlteracao(p, p, 1, 1);
    expect(alt.alterados).toEqual([]);
    expect([...(alt.niveis as Set<Id>)]).toEqual([]);
  });
});

describe('geometria provisória', () => {
  const p = projetoComPavimentos(2);

  it('parede: retângulo do eixo com a espessura do tipo, na cota do nível', () => {
    const w = p.elements['pav_1_w0']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    const el = elementoProvisorio(p, w, 'pav_1')!;
    expect(el.provisorio).toBe(true);
    expect(el.kind).toBe('wall');
    const area = multiArea(desempacotarMulti(el.geometria));
    const comprimento = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    expect(area).toBeCloseTo(comprimento * totalThickness(p.wallTypes[w.typeId]!), 6);
    expect(el.z0).toBeCloseTo(3 + w.baseOffset, 9);
    expect(el.z1).toBeGreaterThan(el.z0);
    expect(Array.from(el.caixa)).toEqual(Array.from(caixaDe(el.geometria)));
  });

  it('parede curva: poligonal ao longo do arco, com mais vértices que o retângulo', () => {
    const w = p.elements['pav_0_w0']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    const reta = elementoProvisorio(p, w, 'pav_0')!;
    const curva = elementoProvisorio(p, { ...w, sag: 1 }, 'pav_0')!;
    expect(totalVertices(curva.geometria)).toBeGreaterThan(totalVertices(reta.geometria));
    expect(totalVertices(reta.geometria)).toBe(4);
  });

  it('abertura: retângulo do vão dentro da caixa da parede', () => {
    const o = p.elements['pav_0_o']!;
    const w = p.elements['pav_0_w0']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    const aberta = elementoProvisorio(p, o, 'pav_0')!;
    const parede = elementoProvisorio(p, w, 'pav_0')!;
    expect(aberta.kind).toBe('door');
    const [ax0, ay0, ax1, ay1] = aberta.caixa as unknown as number[];
    const [px0, py0, px1, py1] = parede.caixa as unknown as number[];
    expect(ax0!).toBeGreaterThanOrEqual(px0! - 1e-9);
    expect(ax1!).toBeLessThanOrEqual(px1! + 1e-9);
    expect(ay0!).toBeGreaterThanOrEqual(py0! - 1e-9);
    expect(ay1!).toBeLessThanOrEqual(py1! + 1e-9);
  });

  it('piso: o próprio contorno; ambiente: sem contorno barato (null)', () => {
    const piso = p.elements['pav_0_piso']!;
    const el = elementoProvisorio(p, piso, 'pav_0')!;
    expect(multiArea(desempacotarMulti(el.geometria))).toBeCloseTo(10 * 8, 9);
    expect(elementoProvisorio(p, p.elements['pav_0_amb']!, 'pav_0')).toBeNull();
  });

  it('tipo ausente não derruba: devolve null', () => {
    const w = p.elements['pav_0_w1']!;
    if (w.kind !== 'wall') throw new Error('esperava parede');
    const quebrada = { ...p, wallTypes: {}, defaults: { ...p.defaults, wallTypeId: 'nao_existe' } };
    expect(elementoProvisorio(quebrada, w, 'pav_0')).toBeNull();
  });
});

describe('patchesProvisorios', () => {
  const p = projetoComPavimentos(3);

  it('um patch por nível editado, com os elementos alterados', () => {
    const { antes, depois } = moverB(p, 'pav_1_w1', 0.5);
    const alt = calcularAlteracao(antes, depois, 5, 4);
    const patches = patchesProvisorios(antes, depois, alt);
    expect(patches.map((x) => x.nivel)).toEqual(['pav_1']);
    expect(patches[0]!.versao).toBe(5);
    expect(patches[0]!.elementos.map((e) => e.id)).toContain('pav_1_w1');
    expect(patches[0]!.elementos.every((e) => e.provisorio)).toBe(true);
  });

  it('remoção: o id sai em `removidos` do nível dele (achado no projeto de antes)', () => {
    const { antes, depois } = editar(p, { type: 'deleteElements', ids: ['pav_2_w3'] });
    const patches = patchesProvisorios(antes, depois, calcularAlteracao(antes, depois, 2, 1));
    const do2 = patches.find((x) => x.nivel === 'pav_2')!;
    expect(do2.removidos).toContain('pav_2_w3');
  });

  it('mudança global não tem provisório', () => {
    const { antes, depois } = editar(p, { type: 'upsertWallType', wallType: { ...p.wallTypes['wt_ext19']!, name: 'Outro' } });
    expect(patchesProvisorios(antes, depois, calcularAlteracao(antes, depois, 2, 1))).toEqual([]);
  });

  it('o patch provisório é serializável e transferível', () => {
    const { antes, depois } = moverB(p, 'pav_1_w1', 0.5);
    const patches = patchesProvisorios(antes, depois, calcularAlteracao(antes, depois, 5, 4));
    expect(caminhoNaoSerializavel(patches)).toBeNull();
    expect(colherBuffers(patches).length).toBeGreaterThan(0);
    const volta = structuredClone(patches, { transfer: colherBuffers(patches) });
    expect(volta[0]!.elementos[0]!.id).toBe(patches[0]!.elementos[0]!.id);
  });
});

describe('patch exato de nível', () => {
  const p = projetoComPavimentos(2);
  const antigo = resolveLevel(p, 'pav_1');

  it('patch completo reconstrói o nível sem estado anterior', () => {
    const patch = patchCompleto(antigo, 3);
    expect(patch.base).toBeNull();
    expect(Object.keys(patch.paredes)).toEqual(Object.keys(antigo.walls));
    expect(patch.geometrias).toHaveLength(Object.keys(antigo.walls).length);
    expect(patch.geometrias.every((g) => !g.provisorio)).toBe(true);
    expect(aplicarPatchNivel(null, patch)).toEqual(antigo);
  });

  it('diferença: só as paredes que mudaram de conteúdo; aplicar dá o resultado novo e preserva a identidade do resto', () => {
    const { depois } = moverB(p, 'pav_1_w1', 0.7);
    const novo = resolveLevel(depois, 'pav_1');
    const patch = diferencaNivel(antigo, novo, 4, 3);
    expect(Object.keys(patch.paredes)).toContain('pav_1_w1');
    expect(patch.base).toBe(3);
    const aplicado = aplicarPatchNivel(antigo, patch)!;
    expect(aplicado).toEqual(novo);
    for (const id of Object.keys(novo.walls)) {
      if (!patch.paredes[id]) expect(aplicado.walls[id]).toBe(antigo.walls[id]);
    }
    expect(patch.ordemAgrupamentos).toEqual(novo.clusters.map(chaveDoAgrupamento));
  });

  it('sem mudança de conteúdo, o patch não traz parede nem agrupamento', () => {
    const copia = structuredClone(antigo);
    const patch = diferencaNivel(antigo, copia, 9, 8);
    expect(Object.keys(patch.paredes)).toEqual([]);
    expect(Object.keys(patch.agrupamentos)).toEqual([]);
    expect(patch.geometrias).toEqual([]);
    expect(aplicarPatchNivel(antigo, patch)).toEqual(antigo);
  });

  it('parede removida sai da ordem e aparece em `removidas`', () => {
    const { depois } = editar(p, { type: 'deleteElements', ids: ['pav_1_w3'] });
    const novo = resolveLevel(depois, 'pav_1');
    const patch = diferencaNivel(antigo, novo, 2, 1);
    expect(patch.removidas).toEqual(['pav_1_w3']);
    expect(aplicarPatchNivel(antigo, patch)).toEqual(novo);
  });

  it('nível grande: editar uma parede troca poucas paredes de 32, e o resultado aplicado é igual ao completo', () => {
    const grande = syntheticProject(2);
    const anterior = resolveLevel(grande, 'lv_1');
    const { depois } = moverB(grande, 'perf_w_1_25', 0.3);
    const novo = resolveLevel(depois, 'lv_1');
    const patch = diferencaNivel(anterior, novo, 2, 1);
    const trocadas = Object.keys(patch.paredes).length;
    expect(trocadas).toBeGreaterThan(0);
    expect(trocadas).toBeLessThanOrEqual(6);
    expect(patch.ordemParedes).toHaveLength(32);
    expect(aplicarPatchNivel(anterior, patch)).toEqual(novo);
  });

  it('agrupamentos: editar uma parede isolada troca só o agrupamento dela', () => {
    const isolada = makeWall({ id: 'longe', typeId: 'wt_ext19', levelId: 'pav_1', a: { x: 50, y: 0 }, b: { x: 54, y: 0 } });
    const { depois: comLonge } = editar(p, { type: 'addWall', wall: isolada });
    const anterior = resolveLevel(comLonge, 'pav_1');
    expect(anterior.clusters.length).toBeGreaterThanOrEqual(2);
    const { depois } = moverB(comLonge, 'longe', 1);
    const novo = resolveLevel(depois, 'pav_1');
    const patch = diferencaNivel(anterior, novo, 3, 2);
    expect(Object.keys(patch.paredes)).toEqual(['longe']);
    expect(Object.keys(patch.agrupamentos)).toEqual(['longe']);
    expect(patch.ordemAgrupamentos).toHaveLength(anterior.clusters.length);
    const aplicado = aplicarPatchNivel(anterior, patch)!;
    expect(aplicado).toEqual(novo);
    const intacto = anterior.clusters.find((c) => !c.wallIds.includes('longe'))!;
    expect(aplicado.clusters).toContain(intacto);
  });

  it('patch de diferença sobre base ausente não se aplica (null)', () => {
    const { depois } = moverB(p, 'pav_1_w1', 0.7);
    const patch = diferencaNivel(antigo, resolveLevel(depois, 'pav_1'), 4, 3);
    expect(aplicarPatchNivel(null, patch)).toBeNull();
  });

  it('patch de diferença sobre outro estado (falta parede) não se aplica (null)', () => {
    const { depois } = moverB(p, 'pav_1_w1', 0.7);
    const patch = diferencaNivel(antigo, resolveLevel(depois, 'pav_1'), 4, 3);
    const outro = { ...antigo, walls: {} };
    expect(aplicarPatchNivel(outro, patch)).toBeNull();
  });

  it('o patch atravessa structuredClone e carrega buffers transferíveis', () => {
    const { depois } = moverB(p, 'pav_1_w1', 0.7);
    const patch = diferencaNivel(antigo, resolveLevel(depois, 'pav_1'), 4, 3);
    expect(caminhoNaoSerializavel(patch)).toBeNull();
    const buffers = colherBuffers(patch);
    expect(buffers.length).toBeGreaterThan(0);
    const volta = structuredClone(patch, { transfer: buffers });
    expect(volta.paredes['pav_1_w1']).toEqual(patch.paredes['pav_1_w1'] ?? volta.paredes['pav_1_w1']);
    expect(aplicarPatchNivel(antigo, volta)).toEqual(resolveLevel(depois, 'pav_1'));
  });

  it('gerarPatchNivel: com a base certa vai a diferença; com base errada ou ausente, o completo; a memória guarda o último', () => {
    const memoria = new MemoriaPatch();
    const p1 = gerarPatchNivel(memoria, antigo, 3, null);
    expect(p1.base).toBeNull();
    expect(memoria.get('pav_1')?.versao).toBe(3);
    const { depois } = moverB(p, 'pav_1_w1', 0.7);
    const novo = resolveLevel(depois, 'pav_1');
    const p2 = gerarPatchNivel(memoria, novo, 4, 3);
    expect(p2.base).toBe(3);
    expect(Object.keys(p2.paredes)).toContain('pav_1_w1');
    const p3 = gerarPatchNivel(memoria, novo, 5, 3); // a memória já está na 4: base 3 não bate
    expect(p3.base).toBeNull();
    expect(memoria.size).toBe(1);
    memoria.clear();
    expect(memoria.size).toBe(0);
  });
});
