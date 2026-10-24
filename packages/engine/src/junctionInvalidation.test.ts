import { describe, expect, it, vi } from 'vitest';
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeSlab, makeWall, type Command, type Project } from '@hestia/model';
import { junctionLevel, type JunctionLevel } from './junctionLevel.ts';

/**
 * Invalidação do cache por snapshot (junção e cortadores). Cada cenário edita o projeto base e compara a junção com o
 * cálculo do zero (módulo recarregado, sem nenhum cache). Se o cache devolver dado obsoleto, a comparação falha.
 */

const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/** Térreo: parede de 6 m (y = 0) com piso que a envolve; pavimento de cima com laje que a cobre. */
function base(): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, height: 6 }) });
  s.exec({ type: 'addFloor', floor: makeFloor({ id: 'f1', typeId: 'ft_ceram', levelId: 'lv_0', boundary: rect(-1, -2, 5, 2) }) });
  s.exec({ type: 'addSlab', slab: makeSlab({ id: 's1', typeId: 'ls_mac12', levelId: 'lv_1', boundary: rect(-1, -1, 5, 1) }) });
  return s.project;
}

/** Aplica comandos sobre um projeto (o original não muda: o motor é imutável). */
function edit(p: Project, ...cmds: Command[]): Project {
  const s = new ProjectStore(p);
  for (const c of cmds) s.exec(c);
  return s.project;
}

/** Junção dos níveis pedidos calculada do zero: módulo recarregado (caches vazios) sobre uma cópia do projeto. */
async function fromScratch(p: Project, levelIds: string[]): Promise<JunctionLevel[]> {
  vi.resetModules();
  const fresh = await import('./junctionLevel.ts');
  const copy = structuredClone(p);
  return levelIds.map((id) => fresh.junctionLevel(copy, id));
}

/** Cada cenário: a junção cacheada (dos dois níveis) tem de ser igual ao cálculo do zero e diferente da base. */
async function expectFresh(before: Project, after: Project): Promise<void> {
  const levels = ['lv_0', 'lv_1'];
  const cached = levels.map((id) => junctionLevel(after, id));
  const scratch = await fromScratch(after, levels);
  expect(cached).toEqual(scratch);
  const baseCached = levels.map((id) => junctionLevel(before, id));
  expect(cached).not.toEqual(baseCached);
}

describe('invalidação do cache de junção por snapshot', () => {
  it('mover a parede (novas extremidades) recalcula a junção', async () => {
    const p0 = base();
    junctionLevel(p0, 'lv_0');
    const p1 = edit(p0, { type: 'setWallEnds', id: 'w1', a: { x: 0, y: 3 }, b: { x: 4, y: 3 } });
    await expectFresh(p0, p1);
  });

  it('mudar a espessura (troca de tipo de parede) recalcula a junção', async () => {
    const p0 = base();
    junctionLevel(p0, 'lv_0');
    const p1 = edit(p0, { type: 'updateElements', ids: ['w1'], patch: { typeId: 'wt_alv9' } });
    await expectFresh(p0, p1);
  });

  it('mover o nível de cima recalcula a junção do térreo (cortador de outro nível)', async () => {
    const p0 = base();
    junctionLevel(p0, 'lv_0');
    const p1 = edit(p0, { type: 'upsertLevel', level: makeLevel({ id: 'lv_1', name: 'Pavimento 2', elevation: 2.5 }) });
    await expectFresh(p0, p1);
  });

  it('remover a laje do pavimento de cima (elemento de outro nível) recalcula a junção do térreo', async () => {
    const p0 = base();
    junctionLevel(p0, 'lv_0');
    const p1 = edit(p0, { type: 'deleteElements', ids: ['s1'] });
    await expectFresh(p0, p1);
  });

  it('mover parede do pavimento de cima que alcança o térreo recalcula a junção do térreo', async () => {
    const p0 = edit(base(), { type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_1', a: { x: 0, y: 0.5 }, b: { x: 4, y: 0.5 }, height: 3 }) });
    junctionLevel(p0, 'lv_0');
    const p1 = edit(p0, { type: 'setWallEnds', id: 'w2', a: { x: 0, y: 4 }, b: { x: 4, y: 4 } });
    await expectFresh(p0, p1);
  });

  it('remover piso do térreo recalcula a junção do térreo', async () => {
    const p0 = base();
    junctionLevel(p0, 'lv_0');
    const p1 = edit(p0, { type: 'deleteElements', ids: ['f1'] });
    await expectFresh(p0, p1);
  });

  it('adicionar abertura na parede e depois removê-la: a junção acompanha os dois passos', async () => {
    const p0 = base();
    junctionLevel(p0, 'lv_0');
    const opening = { id: 'o1', kind: 'door' as const, typeId: 'ot_p80', hostId: 'w1', offset: 1.5, flipHand: false, flipFacing: false, sillOverride: null, mark: '' };
    const p1 = edit(p0, { type: 'addOpening', opening });
    await expectFresh(p0, p1);
    const p2 = edit(p1, { type: 'deleteElements', ids: ['o1'] });
    // Volta ao conteúdo da base: o cache não pode devolver a versão com abertura.
    const back = junctionLevel(p2, 'lv_0');
    const scratch = await fromScratch(p2, ['lv_0']);
    expect(back).toEqual(scratch[0]);
  });
});
