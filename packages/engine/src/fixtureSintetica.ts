/**
 * Projeto sintético de desempenho: N pavimentos com 32 paredes cada, uma porta, um piso e uma laje por nível, e cobertura no topo.
 * Fica em código tipado do engine para os testes; scripts/perf-baselines/projeto-sintetico.mts reexporta daqui.
 */
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeRoof, makeSlab, makeWall, type Command, type Id, type Project } from '@hestia/model';

export const WALLS_PER_LEVEL = 32;

/** Segmentos do layout de cada pavimento: 3 × 4 quadros de 4 m (bordas e divisórias) e 8 paredes internas. */
export const SEGMENTS: Array<[[number, number], [number, number]]> = (() => {
  const s: Array<[[number, number], [number, number]]> = [];
  for (const y of [0, 4, 8, 12]) for (const x of [0, 4, 8]) s.push([[x, y], [x + 4, y]]);
  for (const x of [0, 4, 8, 12]) for (const y of [0, 4, 8]) s.push([[x, y], [x, y + 4]]);
  s.push([[2, 0], [2, 4]], [[6, 4], [6, 8]], [[10, 8], [10, 12]], [[0, 2], [4, 2]], [[0, 6], [4, 6]], [[8, 10], [12, 10]], [[2, 8], [2, 12]], [[10, 0], [10, 4]]);
  if (s.length !== WALLS_PER_LEVEL) throw new Error(`Esperava ${WALLS_PER_LEVEL} paredes por nível, recebi ${s.length}`);
  return s;
})();

/** Projeto com `levelCount` pavimentos (cota de 3 m), 32 paredes por nível (tipo `wt_ext19`), uma porta e um piso e uma laje. */
export function syntheticProject(levelCount: number): Project {
  const store = new ProjectStore(createEmptyProject(`Baseline ${levelCount} pavimentos`));
  const cmds: Command[] = [];
  const levels: Id[] = [];
  for (let i = 0; i < levelCount; i++) {
    // Reaproveita os dois níveis do projeto vazio, para o total ficar exato.
    const id = i === 0 ? 'lv_0' : i === 1 ? 'lv_1' : `perf_lv_${i}`;
    levels.push(id);
    cmds.push({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) });
  }
  const box = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 }];
  for (let i = 0; i < levels.length; i++) {
    const levelId = levels[i]!;
    SEGMENTS.forEach(([[ax, ay], [bx, by]], j) => {
      const id = `perf_w_${i}_${j}`;
      cmds.push({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_ext19', levelId, a: { x: ax, y: ay }, b: { x: bx, y: by } }) });
      if (j === 0) cmds.push({ type: 'addOpening', opening: { id: `perf_o_${i}`, kind: 'door', typeId: 'ot_p80', hostId: id, offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
    });
    cmds.push({ type: 'addFloor', floor: makeFloor({ id: `perf_floor_${i}`, typeId: 'ft_ceram', levelId, boundary: box }) });
    cmds.push({ type: 'addSlab', slab: makeSlab({ id: `perf_slab_${i}`, typeId: 'ls_mac12', levelId, boundary: box }) });
    if (i === levels.length - 1) cmds.push({ type: 'addRoof', roof: makeRoof({ id: 'perf_roof', typeId: 'rt_ceramica', levelId, boundary: box, shape: 'gable', slopePercent: 30 }) });
  }
  store.exec({ type: 'batch', commands: cmds });
  return store.project;
}
