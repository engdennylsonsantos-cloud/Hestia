import { describe, expect, it } from 'vitest';
import { makeWall, type Wall } from '@hestia/model';
import { P, drawWall, makeEnv, tool, walls } from './testEnv.ts';
import { resizeWallCommands } from './lengthEdit.ts';

/** Parede A de (0,0) a (4,0) e B encostada em A.b, descendo até (4,3). */
function pair() {
  const ctx = makeEnv();
  drawWall(ctx.env, [0, 0], [4, 0]);
  drawWall(ctx.env, [4, 0], [4, 3]);
  return ctx;
}

describe('cota temporária: editar comprimento (F5)', () => {
  it('digitar um número mantém a extremidade a e move b ao longo do eixo', () => {
    const { store, env, sel } = pair();
    const [a] = walls(store) as [Wall];
    env.setSelection([a.id]);
    const s = tool('select', env);
    expect(s.inputPrompt()).toContain('Comprimento');
    expect(s.type('3,5')).toBe(true);
    const [a2] = walls(store) as [Wall];
    expect(a2.a.x).toBeCloseTo(0);
    expect(a2.b.x).toBeCloseTo(3.5);
    expect(a2.b.y).toBeCloseTo(0);
    expect(sel()).toEqual([a.id]);
  });

  it('a parede ligada em b acompanha a nova extremidade (como a alça)', () => {
    const { store, env } = pair();
    const [a, b] = walls(store) as [Wall, Wall];
    env.setSelection([a.id]);
    tool('select', env).type('2,5');
    const [, b2] = walls(store) as [Wall, Wall];
    expect(b2.id).toBe(b.id);
    expect(b2.a.x).toBeCloseTo(2.5);
    expect(b2.a.y).toBeCloseTo(0);
    expect(b2.b.y).toBeCloseTo(3); // a outra extremidade de B não muda
  });

  it('a parede selecionada não mostra o próprio comprimento como cota (nem ao mover o cursor)', () => {
    const { store, env } = pair();
    const [a] = walls(store) as [Wall];
    env.setSelection([a.id]);
    const s = tool('select', env);
    s.move(P(2, 1));
    expect(s.preview().filter((i) => i.kind === 'label')).toEqual([]);
  });

  it('aceita expressões aritméticas', () => {
    const { store, env } = pair();
    const [a] = walls(store) as [Wall];
    env.setSelection([a.id]);
    expect(tool('select', env).type('3+0,15*2')).toBe(true);
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(3.3);
  });

  it('desfazer restaura a parede e a vizinha num único passo', () => {
    const { store, env } = pair();
    const [a] = walls(store) as [Wall];
    env.setSelection([a.id]);
    tool('select', env).type('2');
    store.undo();
    const [a0, b0] = walls(store) as [Wall, Wall];
    expect(a0.b.x).toBeCloseTo(4);
    expect(b0.a.x).toBeCloseTo(4);
  });

  it('recusa valor inválido, zero e expressão incompleta sem alterar o modelo', () => {
    const { store, env } = pair();
    const [a] = walls(store) as [Wall];
    env.setSelection([a.id]);
    const s = tool('select', env);
    expect(s.type('abc')).toBe(false);
    expect(s.type('0')).toBe(false);
    expect(s.type('3+')).toBe(false);
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(4);
  });

  it('sem seleção única de parede não há campo de cota', () => {
    const { store, env } = pair();
    const [a, b] = walls(store) as [Wall, Wall];
    const s = tool('select', env);
    expect(s.inputPrompt()).toBeNull();
    env.setSelection([a.id, b.id]);
    expect(s.inputPrompt()).toBeNull();
    expect(s.type('3')).toBe(false);
  });

  it('Enter sem valor não altera nada e não sai da ferramenta', () => {
    const { store, env, done } = pair();
    const [a] = walls(store) as [Wall];
    env.setSelection([a.id]);
    const s = tool('select', env);
    s.confirm();
    expect(done()).toBe(0);
    expect((walls(store)[0] as Wall).b.x).toBeCloseTo(4);
  });

  it('clique sobre parede sem seleção continua selecionando (comportamento anterior)', () => {
    const { env, sel } = pair();
    const s = tool('select', env);
    s.down!(P(1, 0));
    s.up!(P(1, 0));
    expect(sel()).toHaveLength(1);
  });
});

describe('resizeWallCommands', () => {
  it('recusa parede curva', () => {
    const { store } = makeEnv();
    store.exec({ type: 'addWall', wall: makeWall({ id: 'arc', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 }, sag: 1 }) });
    const r = resizeWallCommands(store.project, 'lv_0', 'arc', 3);
    expect('error' in r).toBe(true);
  });

  it('recusa parede inexistente', () => {
    const { store } = makeEnv();
    expect('error' in resizeWallCommands(store.project, 'lv_0', 'nada', 3)).toBe(true);
  });
});
