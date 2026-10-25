import { createEmptyProject, makeFloor, makeLevel, makeRoom, makeSlab, makeWall, ProjectStore, type Command, type Id, type Project } from '@hestia/model';

/**
 * Projeto sintético com `pavimentos` níveis (3 m entre eles), cada um com 4 paredes externas, uma porta, um piso, uma
 * laje e um ambiente. Usado pelos testes do protocolo e pela medição de custo (ver relatório). Não depende de tipos
 * fora dos padrões do projeto vazio (`wt_ext19`, `ft_ceram`, `ls_mac12`, `ot_p80`).
 */
export function projetoComPavimentos(pavimentos: number): Project {
  const base = createEmptyProject('Projeto de pavimentos');
  const store = new ProjectStore({ ...base, levels: [], elements: {} });
  const comandos: Command[] = [];
  const cantos = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 8 },
    { x: 0, y: 8 },
  ];
  for (let i = 0; i < pavimentos; i++) {
    const levelId: Id = `pav_${i}`;
    comandos.push({ type: 'upsertLevel', level: makeLevel({ id: levelId, name: `Pavimento ${i + 1}`, elevation: i * 3 }) });
    cantos.forEach((a, k) => {
      const b = cantos[(k + 1) % cantos.length]!;
      const id = `pav_${i}_w${k}`;
      comandos.push({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_ext19', levelId, a, b }) });
      if (k === 0) {
        comandos.push({ type: 'addOpening', opening: { id: `pav_${i}_o`, kind: 'door', typeId: 'ot_p80', hostId: id, offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
      }
    });
    comandos.push({ type: 'addFloor', floor: makeFloor({ id: `pav_${i}_piso`, typeId: 'ft_ceram', levelId, boundary: cantos }) });
    comandos.push({ type: 'addSlab', slab: makeSlab({ id: `pav_${i}_laje`, typeId: 'ls_mac12', levelId, boundary: cantos }) });
    comandos.push({ type: 'addRoom', room: makeRoom({ id: `pav_${i}_amb`, levelId, name: 'Sala', number: `${i + 1}01`, point: { x: 5, y: 4 } }) });
  }
  store.exec({ type: 'batch', commands: comandos });
  return store.project;
}
