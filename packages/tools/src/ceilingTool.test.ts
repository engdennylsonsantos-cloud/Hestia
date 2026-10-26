import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { resolveRooms } from '@hestia/engine';
import { ceilingsOnLevel, makeRoom, type Ceiling, type Project } from '@hestia/model';
import type { CeilingMode } from './types.ts';
import { clickAt, makeEnv, tool } from './testEnv.ts';

const ceilings = (store: { project: Project }): Ceiling[] => ceilingsOnLevel(store.project, 'lv_0');

function ctx(mode: CeilingMode) {
  const c = makeEnv();
  c.options.ceilingMode = mode;
  const msgs: string[] = [];
  c.env.say = (m: string) => msgs.push(m);
  return { ...c, msgs };
}

/** Paredes de um retângulo 4 × 3 pela ferramenta Parede (forma retangular), como em slabTool.test.ts. */
function room(c: ReturnType<typeof makeEnv>): void {
  c.options.wallShape = 'rect';
  const w = tool('wall', c.env);
  clickAt(w, 0, 0);
  clickAt(w, 4, 3);
  c.options.wallShape = 'line';
}

describe('ferramenta Forro: contorno por cliques', () => {
  it('quatro cliques e o primeiro ponto fecham o contorno; o forro fica selecionado com o tipo e a cota das opções', () => {
    const c = ctx('poly');
    const t = tool('ceiling', c.env);
    clickAt(t, 0, 0);
    clickAt(t, 4, 0);
    clickAt(t, 4, 3);
    clickAt(t, 0, 3);
    clickAt(t, 0, 0);
    const [f] = ceilings(c.store);
    expect(f).toMatchObject({ kind: 'ceiling', typeId: 'ct_gesso', heightOffset: 2.6, levelId: 'lv_0', roomId: null });
    expect(f!.boundary).toHaveLength(4);
    expect(c.sel()).toEqual([f!.id]);
    expect(c.msgs.at(-1)).toContain('12,00 m²');
  });

  it('retângulo: dois cantos', () => {
    const c = ctx('rect');
    const t = tool('ceiling', c.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 1);
    expect(ceilings(c.store)).toHaveLength(1);
    expect(ceilings(c.store)[0]!.boundary).toHaveLength(4);
  });

  it('retângulo estreito não cria forro', () => {
    const c = ctx('rect');
    const t = tool('ceiling', c.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 0);
    expect(ceilings(c.store)).toHaveLength(0);
    expect(c.msgs.at(-1)).toContain('muito estreito');
  });

  it('tipo inexistente nas opções cai no primeiro tipo do projeto', () => {
    const c = ctx('rect');
    c.options.ceilingTypeId = 'nao_existe';
    const t = tool('ceiling', c.env);
    clickAt(t, 0, 0);
    clickAt(t, 2, 2);
    expect(ceilings(c.store)[0]!.typeId).toBe(Object.keys(c.store.project.ceilingTypes)[0]);
  });
});

describe('ferramenta Forro: no ambiente', () => {
  it('clique dentro do ambiente cria o forro com o contorno, o número e o pé-direito do ambiente', () => {
    const c = ctx('room');
    room(c);
    c.env.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 1.5 }, ceilingHeight: 2.9 }) });
    const t = tool('ceiling', c.env);
    clickAt(t, 2, 1.5);
    expect(ceilings(c.store)).toHaveLength(1);
    expect(ceilings(c.store)[0]).toMatchObject({ roomId: 'r1', heightOffset: 2.9, mark: '101' });
    // Contorno do ambiente = face interna das paredes (o mesmo polígono do motor de ambientes).
    const [r] = resolveRooms(c.store.project, 'lv_0');
    expect(multiArea([r!.polygon!])).toBeCloseTo(multiArea([[ceilings(c.store)[0]!.boundary]]), 6);
  });

  it('clique fora de qualquer ambiente não cria forro', () => {
    const c = ctx('room');
    room(c);
    const t = tool('ceiling', c.env);
    clickAt(t, 10, 10);
    expect(ceilings(c.store)).toHaveLength(0);
    expect(c.msgs.at(-1)).toContain('Clique dentro de um ambiente');
  });

  it('segundo clique no mesmo ambiente não cria forro empilhado: avisa e mantém o forro existente', () => {
    const c = ctx('room');
    room(c);
    c.env.exec({ type: 'addRoom', room: makeRoom({ id: 'r1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 1.5 }, ceilingHeight: 2.9 }) });
    const t = tool('ceiling', c.env);
    clickAt(t, 2, 1.5);
    clickAt(t, 2, 1.5);
    expect(ceilings(c.store)).toHaveLength(1);
    // Código do tipo do forro existente (FR-01 = forro de gesso, o tipo das opções por padrão).
    expect(c.msgs.at(-1)).toBe('Este ambiente já tem forro (FR-01). Selecione-o para editar.');
  });
});

/** Forro 4 × 3 desenhado pelo contorno, com a seleção nele. */
function ceilingSelected(): ReturnType<typeof ctx> {
  const c = ctx('poly');
  const t = tool('ceiling', c.env);
  clickAt(t, 0, 0);
  clickAt(t, 4, 0);
  clickAt(t, 4, 3);
  clickAt(t, 0, 3);
  clickAt(t, 0, 0);
  c.env.setSelection([ceilings(c.store)[0]!.id]);
  c.options.ceilingMode = 'hole';
  return c;
}

const holeTool = (c: ReturnType<typeof ctx>) => tool('ceiling', c.env);

describe('ferramenta Forro: furo (E7)', () => {
  it('contorno interno dentro do forro selecionado vira furo; um Ctrl+Z desfaz', () => {
    const c = ceilingSelected();
    const t = holeTool(c);
    clickAt(t, 1, 1);
    clickAt(t, 2, 1);
    clickAt(t, 2, 2);
    clickAt(t, 1, 2);
    clickAt(t, 1, 1);
    const [f] = ceilings(c.store);
    expect(f!.holes).toHaveLength(1);
    expect(multiArea([[f!.boundary, ...f!.holes]])).toBeCloseTo(12 - 1, 6);
    expect(c.msgs.at(-1)).toContain('Furo criado');
    c.store.undo();
    expect(ceilings(c.store)[0]!.holes).toHaveLength(0);
  });

  it('furo que sai do forro é recusado', () => {
    const c = ceilingSelected();
    const t = holeTool(c);
    clickAt(t, 3, 2);
    clickAt(t, 6, 2);
    clickAt(t, 6, 4);
    clickAt(t, 3, 4);
    clickAt(t, 3, 2);
    expect(ceilings(c.store)[0]!.holes).toHaveLength(0);
    expect(c.msgs.at(-1)).toContain('dentro do forro');
  });

  it('sem forro selecionado (ou com dois), o modo furo pede a seleção e não cria nada', () => {
    const c = ceilingSelected();
    c.env.setSelection([]);
    const t = holeTool(c);
    clickAt(t, 1, 1);
    clickAt(t, 2, 1);
    expect(c.msgs.at(-1)).toContain('selecione um único forro');
    expect(ceilings(c.store)[0]!.holes).toHaveLength(0);
  });
});
