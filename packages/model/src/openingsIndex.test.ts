import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeLevel, makeWall, type Command, type Project } from './index.ts';
import { isOpening } from './types.ts';
import { openingsOfWall } from './queries.ts';

/**
 * Índice de aberturas por parede (`openingsOfWall`): o resultado tem de ser o da varredura direta de `p.elements`, na
 * mesma ordem, em projeto de 20 pavimentos. Projeto novo (edição) não reaproveita o índice do anterior.
 */

function predio20(): Project {
  const store = new ProjectStore(createEmptyProject('Índice de aberturas'));
  const cmds: Command[] = [];
  for (let i = 0; i < 20; i++) {
    const id = `ix_lv_${i}`;
    cmds.push({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) });
    for (let j = 0; j < 3; j++) {
      const wid = `ix_w_${i}_${j}`;
      cmds.push({ type: 'addWall', wall: makeWall({ id: wid, typeId: 'wt_ext19', levelId: id, a: { x: j * 4, y: 0 }, b: { x: j * 4, y: 4 } }) });
    }
    // Duas portas na primeira parede e uma janela na segunda, para ter mais de uma abertura por parede.
    for (const [k, host, kind] of [[0, `ix_w_${i}_0`, 'door'], [1, `ix_w_${i}_0`, 'door'], [2, `ix_w_${i}_1`, 'window']] as const) {
      cmds.push({
        type: 'addOpening',
        opening: { id: `ix_o_${i}_${k}`, kind, typeId: kind === 'door' ? 'ot_p80' : 'ot_j120', hostId: host, offset: 1 + k * 0.5, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
      });
    }
  }
  store.exec({ type: 'batch', commands: cmds });
  return store.project;
}

describe('openingsOfWall indexado (model)', () => {
  it('bate com a varredura direta em todas as paredes de um projeto de 20 pavimentos, na mesma ordem', () => {
    const p = predio20();
    const paredes = Object.values(p.elements).filter((e) => e.kind === 'wall');
    expect(paredes.length).toBe(60);
    for (const w of paredes) {
      const direta = Object.values(p.elements).filter(isOpening).filter((o) => o.hostId === w.id);
      expect(openingsOfWall(p, w.id)).toEqual(direta);
    }
    expect(openingsOfWall(p, 'ix_w_10_0').map((o) => o.id)).toEqual(['ix_o_10_0', 'ix_o_10_1']);
    expect(openingsOfWall(p, 'inexistente')).toEqual([]);
  });

  it('devolve cópia: alterar a lista devolvida não muda a consulta seguinte', () => {
    const p = predio20();
    openingsOfWall(p, 'ix_w_3_0').pop();
    expect(openingsOfWall(p, 'ix_w_3_0').length).toBe(2);
  });

  it('projeto novo com a mesma parede ganha índice próprio (remoção de abertura aparece)', () => {
    const p = predio20();
    expect(openingsOfWall(p, 'ix_w_0_1').length).toBe(1);
    const elementos = { ...p.elements };
    delete elementos['ix_o_0_2'];
    const q: Project = { ...p, elements: elementos };
    expect(openingsOfWall(q, 'ix_w_0_1')).toEqual([]);
    expect(openingsOfWall(p, 'ix_w_0_1').length).toBe(1);
  });
});
