import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, makeWall, type Project } from '@hestia/model';
import { compatibleTypes, instancesOfType, replaceStatus, replaceType, selectAllPlan, tryDeleteWallType, wallTypeDeleteBlock } from './typeActions.ts';

/** Casa de 2 quartos: 4 paredes externas (wt_ext19) e 4 internas (wt_alv9) no térreo; portas e janelas. */
const house = (): ProjectStore => new ProjectStore(buildTemplate('house2'));

/** Acrescenta duas paredes externas no pavimento 2 (lv_1), para testar vários níveis. */
function withUpperFloor(store: ProjectStore): void {
  store.exec({ type: 'addWall', wall: makeWall({ id: 'up_1', typeId: 'wt_ext19', levelId: 'lv_1', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: 'up_2', typeId: 'wt_ext19', levelId: 'lv_1', a: { x: 6, y: 0 }, b: { x: 6, y: 4 } }) });
}

describe('instâncias por tipo', () => {
  it('acha as paredes externas e as portas do tipo', () => {
    const p = house().project;
    expect(instancesOfType(p, 'wall', 'wt_ext19').sort()).toEqual(['h_e', 'h_n', 'h_s', 'h_w']);
    const doors = instancesOfType(p, 'door', 'ot_p80');
    expect(doors).toHaveLength(2);
    expect(doors.every((id) => p.elements[id]?.kind === 'door')).toBe(true);
    expect(instancesOfType(p, 'window', 'ot_p80')).toHaveLength(0);
  });

  it('seleciona só as do nível atual e informa as de outros níveis', () => {
    const store = house();
    withUpperFloor(store);
    const p = store.project;
    const aqui = selectAllPlan(p, 'wall', 'wt_ext19', 'lv_0', 'Externa 19 + cerâmica');
    expect(aqui.ids.sort()).toEqual(['h_e', 'h_n', 'h_s', 'h_w']);
    expect(aqui.status).toBe('4 instâncias neste nível, 2 em outros níveis.');

    const acima = selectAllPlan(p, 'wall', 'wt_ext19', 'lv_1', 'Externa 19 + cerâmica');
    expect(acima.ids.sort()).toEqual(['up_1', 'up_2']);
    expect(acima.status).toBe('2 instâncias neste nível, 4 em outros níveis.');
  });

  it('mensagens quando não há instância no nível ou no projeto', () => {
    const store = house();
    withUpperFloor(store);
    const p = store.project;
    const semNivel = selectAllPlan(p, 'wall', 'wt_ext19', 'lv_9', 'Externa');
    expect(semNivel.ids).toEqual([]);
    expect(semNivel.status).toBe('Nenhuma instância neste nível; 6 em outros níveis.');

    const vazio = selectAllPlan(p, 'wall', 'wt_conc15', 'lv_0', 'Concreto 15');
    expect(vazio.ids).toEqual([]);
    expect(vazio.status).toBe('Nenhuma instância de «Concreto 15» no projeto.');
  });
});

describe('substituir tipo', () => {
  it('lista só tipos compatíveis e exclui o próprio', () => {
    const p = house().project;
    const paredes = compatibleTypes(p, 'wall', 'wt_ext19').map((t) => t.id);
    expect(paredes).not.toContain('wt_ext19');
    expect(paredes).toContain('wt_alv14');
    const portas = compatibleTypes(p, 'door', 'ot_p80');
    expect(portas.length).toBeGreaterThan(0);
    expect(portas.every((t) => p.openingTypes[t.id]?.kind === 'door' && t.id !== 'ot_p80')).toBe(true);
  });

  it('troca todas as instâncias, em todos os níveis, com um único passo de desfazer', () => {
    const store = house();
    withUpperFloor(store);
    const n = replaceType(store, 'wall', 'wt_ext19', 'wt_alv14');
    expect(n).toBe(6);
    expect(instancesOfType(store.project, 'wall', 'wt_ext19')).toHaveLength(0);
    expect(instancesOfType(store.project, 'wall', 'wt_alv14')).toHaveLength(6);
    expect(replaceStatus(n, 'Alvenaria 14 + reboco')).toBe('6 instâncias substituídas por «Alvenaria 14 + reboco».');

    store.undo();
    expect(instancesOfType(store.project, 'wall', 'wt_ext19')).toHaveLength(6);
    expect(instancesOfType(store.project, 'wall', 'wt_alv14')).toHaveLength(0);
  });

  it('troca porta por porta do mesmo tipo', () => {
    const store = house();
    expect(replaceType(store, 'door', 'ot_p80', 'ot_p90')).toBe(2);
    // a casa-modelo já tem uma porta ot_p90 (fundos), então o total esperado é 1 + 2
    expect(instancesOfType(store.project, 'door', 'ot_p90')).toHaveLength(3);
    expect(instancesOfType(store.project, 'door', 'ot_p80')).toHaveLength(0);
  });

  it('recusa destino de outra família e não altera o projeto', () => {
    const store = house();
    const antes: Project = store.project;
    expect(() => replaceType(store, 'wall', 'wt_ext19', 'ot_p80')).toThrow('Tipo de destino incompatível.');
    expect(store.project).toBe(antes);
  });

  it('sem instâncias não cria passo de desfazer', () => {
    const store = house();
    expect(replaceType(store, 'wall', 'wt_conc15', 'wt_dry')).toBe(0);
    expect(store.canUndo).toBe(false);
  });
});

describe('excluir tipo de parede', () => {
  it('bloqueia tipo padrão e tipo em uso, libera tipo sem uso', () => {
    const store = house();
    const p = store.project;
    expect(wallTypeDeleteBlock(p, 'wt_alv14')).toBe('É o tipo padrão do projeto.');
    expect(wallTypeDeleteBlock(p, 'wt_ext19')).toBe('Em uso por 4 paredes.');
    expect(wallTypeDeleteBlock(p, 'wt_conc15')).toBeNull();
  });

  it('exclui o tipo sem uso pelo comando e devolve o erro quando o comando recusa', () => {
    const store = house();
    expect(tryDeleteWallType(store, 'wt_conc15')).toEqual({ ok: true });
    expect(store.project.wallTypes.wt_conc15).toBeUndefined();

    const padrao = tryDeleteWallType(store, 'wt_alv14');
    expect(padrao).toEqual({ ok: false, error: 'Tipo padrão não pode ser excluído' });
    const emUso = tryDeleteWallType(store, 'wt_ext19');
    expect(emUso).toEqual({ ok: false, error: 'Tipo em uso' });
    expect(store.project.wallTypes.wt_ext19).toBeDefined();
  });
});
