import { describe, expect, it } from 'vitest';
import { ProjectStore, buildTemplate, makeWall, type Id, type Project } from '@hestia/model';
import type { Viewport } from '@hestia/render';
import { boxOfElements, compatibleTypes, instancesOfType, replaceStatus, replaceType, selectAllPlan, tryDeleteWallType, wallTypeDeleteBlock, whereUsed, whereUsedTarget, type WhereUsedNav } from './typeActions.ts';

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

/** Controller falso com a mesma forma de `WhereUsedNav`: guarda o nível, o viewport e a seleção. */
function fakeNav(store: ProjectStore): { nav: WhereUsedNav; state: { level: Id; viewport: Viewport | null; selected: Id[] } } {
  const state: { level: Id; viewport: Viewport | null; selected: Id[] } = {
    level: 'lv_0',
    viewport: { cx: 0, cy: 0, zoom: 60, width: 800, height: 600 },
    selected: [],
  };
  const nav: WhereUsedNav = {
    get project() {
      return store.project;
    },
    viewport: () => state.viewport,
    setViewport: (v) => {
      state.viewport = v;
    },
    selectLevel: (id) => {
      state.level = id;
      state.selected = [];
    },
  };
  return { nav, state };
}

describe('onde é usado', () => {
  it('escolhe o nível com mais instâncias e conta o resto', () => {
    const store = house();
    withUpperFloor(store);
    const t = whereUsedTarget(store.project, 'wall', 'wt_ext19');
    expect(t?.levelId).toBe('lv_0');
    expect(t?.ids.sort()).toEqual(['h_e', 'h_n', 'h_s', 'h_w']);
    expect(t?.elsewhere).toBe(2);
  });

  it('vai ao nível de cima quando é lá que o tipo mais aparece', () => {
    const store = house();
    withUpperFloor(store);
    for (let i = 0; i < 5; i++) {
      store.exec({ type: 'addWall', wall: makeWall({ id: `top_${i}`, typeId: 'wt_ext19', levelId: 'lv_1', a: { x: i, y: 9 }, b: { x: i + 1, y: 9 } }) });
    }
    const t = whereUsedTarget(store.project, 'wall', 'wt_ext19');
    expect(t?.levelId).toBe('lv_1');
    expect(t?.ids).toHaveLength(7);
    expect(t?.elsewhere).toBe(4);
  });

  it('tipo sem instância não tem alvo', () => {
    expect(whereUsedTarget(house().project, 'wall', 'wt_conc15')).toBeNull();
  });

  it('seleciona e enquadra as instâncias, com status que cita os outros níveis', () => {
    const store = house();
    withUpperFloor(store);
    const { nav, state } = fakeNav(store);
    const status = whereUsed(nav, 'wall', 'wt_ext19', 'Externa 19 + cerâmica', (ids) => {
      state.selected = ids;
    });
    const lvName = store.project.levels.find((l) => l.id === 'lv_0')?.name ?? 'lv_0';
    expect(status).toBe(`4 instâncias de «Externa 19 + cerâmica» em ${lvName}, 2 em outros níveis.`);
    expect(state.level).toBe('lv_0');
    expect([...state.selected].sort()).toEqual(['h_e', 'h_n', 'h_s', 'h_w']);

    const box = boxOfElements(store.project, state.selected)!;
    expect(state.viewport?.cx).toBeCloseTo((box.minX + box.maxX) / 2, 9);
    expect(state.viewport?.cy).toBeCloseTo((box.minY + box.maxY) / 2, 9);
    expect(state.viewport?.width).toBe(800);
  });

  it('sem instâncias devolve a frase e não mexe em nível nem seleção', () => {
    const store = house();
    const { nav, state } = fakeNav(store);
    const status = whereUsed(nav, 'wall', 'wt_conc15', 'Concreto 15', (ids) => {
      state.selected = ids;
    });
    expect(status).toBe('Nenhuma instância de «Concreto 15» no projeto.');
    expect(state.level).toBe('lv_0');
    expect(state.selected).toEqual([]);
  });
});

describe('caixa das instâncias', () => {
  it('a caixa da parede cobre seus extremos', () => {
    const p = house().project;
    const w = p.elements.h_e as { a: { x: number; y: number }; b: { x: number; y: number } };
    const box = boxOfElements(p, ['h_e'])!;
    expect(box.minX).toBeCloseTo(Math.min(w.a.x, w.b.x), 9);
    expect(box.maxX).toBeCloseTo(Math.max(w.a.x, w.b.x), 9);
    expect(box.minY).toBeCloseTo(Math.min(w.a.y, w.b.y), 9);
    expect(box.maxY).toBeCloseTo(Math.max(w.a.y, w.b.y), 9);
  });

  it('a caixa do vão cabe dentro da caixa da parede que o hospeda', () => {
    const p = house().project;
    const door = instancesOfType(p, 'door', 'ot_p80')[0]!;
    const hostId = (p.elements[door] as { hostId: Id }).hostId;
    const inner = boxOfElements(p, [door])!;
    const outer = boxOfElements(p, [hostId])!;
    const eps = 1e-9;
    expect(inner.minX).toBeGreaterThanOrEqual(outer.minX - eps);
    expect(inner.maxX).toBeLessThanOrEqual(outer.maxX + eps);
    expect(inner.minY).toBeGreaterThanOrEqual(outer.minY - eps);
    expect(inner.maxY).toBeLessThanOrEqual(outer.maxY + eps);
    expect(inner.maxX - inner.minX + (inner.maxY - inner.minY)).toBeGreaterThan(0);
  });

  it('nada com geometria devolve null', () => {
    expect(boxOfElements(house().project, [])).toBeNull();
    expect(boxOfElements(house().project, ['nao_existe'])).toBeNull();
  });
});
