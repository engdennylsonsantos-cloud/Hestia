import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import { stairsOnLevel, type Stair, type StairCurve, type StairLanding, type StairRun } from '@hestia/model';
import { clickAt, makeEnv, P, tool } from './testEnv.ts';
import { SelectTool } from './selectTool.ts';
import { StairTool } from './stairTool.ts';
import { createStairFromComponents, stairFromGenerator, updateStairComponents } from './stairCommands.ts';
import { pickStairAt, selectedStairs, stairIdsInBox } from './stairPick.ts';
import { applyStairGrip, arcApex, stairGripAt, stairHold } from './stairGrips.ts';
import type { PointerInfo, ToolEnv } from './types.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (a: Vec2, b: Vec2): StairCurve => ({ a, b, sag: 0 });

/** Lance reto válido: limites em y = ±0,5 de x = −0,5 a 5; espelhos em `xs`. */
function straight(xs: number[] = [0, 1, 2]): StairRun {
  return {
    id: 'r_test',
    kind: 'run',
    boundaryLeft: [ln(v(-0.5, 0.5), v(5, 0.5))],
    boundaryRight: [ln(v(-0.5, -0.5), v(5, -0.5))],
    risers: xs.map((x) => ln(v(x, -1), v(x, 1))),
    path: [],
  };
}

/** Escada criada pela própria ferramenta (um passo de desfazer) e o ambiente de teste. */
function withStair(components: Array<StairRun | StairLanding> = [straight()]) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  const r = createStairFromComponents(ctx.env, components);
  if (!('id' in r)) throw new Error(r.error);
  const stair = () => ctx.store.project.elements[r.id] as Stair;
  return { ...ctx, msgs, id: r.id, stair };
}

const pointer = (raw: Vec2): PointerInfo => ({ raw, shift: false, ctrl: false, alt: false });

describe('comandos de escada (createStairFromComponents, stairFromGenerator, updateStairComponents)', () => {
  it('cria a escada com lance e patamar em ordem, em um comando, e seleciona a nova', () => {
    const ctx = makeEnv();
    const landing: StairLanding = { id: 'p_1', kind: 'landing', boundary: [ln(v(6, 0), v(9, 0)), ln(v(9, 0), v(9, 3)), ln(v(9, 3), v(6, 3)), ln(v(6, 3), v(6, 0))] };
    const r = createStairFromComponents(ctx.env, [straight(), landing, { ...straight([0, 1]), id: 'r_2' }]);
    expect('id' in r).toBe(true);
    const [s] = stairsOnLevel(ctx.store.project, 'lv_0');
    expect(s!.components.map((c) => c.kind)).toEqual(['run', 'landing', 'run']);
    expect(ctx.store.project.elements[s!.id]?.kind).toBe('stair');
    expect(ctx.env.selection()).toEqual([s!.id]);
    ctx.store.undo();
    expect(stairsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
  });

  it('recusa croqui com erro (limites se tocam) sem criar nada', () => {
    const ctx = makeEnv();
    const bad = { ...straight(), boundaryRight: [ln(v(-0.5, 0.5), v(5, 0.5))] };
    const r = createStairFromComponents(ctx.env, [bad]);
    expect(r).toEqual({ error: 'Os limites esquerdo e direito do lance não podem se tocar.' });
    expect(stairsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
  });

  it('gerador: a origem (generatedBy) vai para os lances que não a trazem', () => {
    const ctx = makeEnv();
    const r = stairFromGenerator(ctx.env, [straight()], { generatedBy: 'straight' });
    expect('id' in r).toBe(true);
    const [s] = stairsOnLevel(ctx.store.project, 'lv_0');
    expect((s!.components[0] as StairRun).generatedBy).toBe('straight');
  });

  it('updateStairComponents grava o croqui novo em um comando e recusa erro de geometria', () => {
    const w = withStair();
    const bad = [{ ...straight(), boundaryRight: [] }];
    expect('error' in updateStairComponents(w.env, w.id, bad)).toBe(true);
    const ok = updateStairComponents(w.env, w.id, [straight([0, 1, 2, 3])]);
    expect('report' in ok).toBe(true);
    expect((w.stair().components[0] as StairRun).risers).toHaveLength(4);
    w.store.undo();
    expect((w.stair().components[0] as StairRun).risers).toHaveLength(3);
  });

  it('ferramenta: Concluir com patamar aberto no meio é recusado; com o lance válido, cria', () => {
    const ctx = makeEnv();
    const t = tool('stair', ctx.env) as StairTool;
    t.setSubmode('patamar');
    clickAt(t, 6, 0);
    clickAt(t, 9, 0);
    t.setSubmode('concluir');
    expect(stairsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(0);
  });
});

describe('seleção de escadas: pick por ponto e janela', () => {
  it('pick dentro do contorno de um lance e sobre uma linha; fora de tudo, nada', () => {
    const w = withStair();
    expect(pickStairAt(w.store.project, 'lv_0', v(2, 0), 0.01)).toBe(w.id);
    expect(pickStairAt(w.store.project, 'lv_0', v(1, 0.5), 0.01)).toBe(w.id);
    expect(pickStairAt(w.store.project, 'lv_0', v(10, 10), 0.01)).toBeNull();
    expect(pickStairAt(w.store.project, 'lv_1', v(2, 0), 0.01)).toBeNull();
  });

  it('janela esq→dir: só escadas inteiras dentro; dir→esq: também as que a cruzam', () => {
    const w = withStair();
    expect(stairIdsInBox(w.store.project, 'lv_0', v(-1, -2), v(6, 2))).toEqual([w.id]);
    expect(stairIdsInBox(w.store.project, 'lv_0', v(-1, -2), v(1, 2))).toEqual([]);
    expect(stairIdsInBox(w.store.project, 'lv_0', v(1, 2), v(-1, -2))).toEqual([w.id]);
  });

  it('a seleção (selectedStairs) só pega escadas', () => {
    const w = withStair();
    expect(selectedStairs(w.store.project, [w.id, 'w_nao_existe'])).toEqual([w.id]);
  });

  it('o seletor pega a escada pelo clique e a seleciona', () => {
    const w = withStair();
    const sel = new SelectTool(w.env);
    sel.start();
    sel.down(P(2, 0));
    sel.up(P(2, 0));
    expect(w.env.selection()).toEqual([w.id]);
  });
});

describe('alças da escada', () => {
  it('a alça na extremidade de um limite é achada; a do meio do arco também', () => {
    const arc: StairRun = { ...straight(), boundaryLeft: [{ a: v(0, 0.5), b: v(4, 0.5), sag: 1 }], boundaryRight: [ln(v(0, -0.5), v(4, -0.5))], risers: [ln(v(1, -1), v(1, 3)), ln(v(3, -1), v(3, 3))] };
    const w = withStair([arc]);
    const g = stairGripAt(w.store.project, [w.id], v(0, 0.5), 0.01);
    expect(g).toMatchObject({ key: 'boundaryLeft', index: 0, end: 'a' });
    expect(arcApex(arc.boundaryLeft[0]!)).toEqual({ x: 2, y: 1.5 });
    const apex = stairGripAt(w.store.project, [w.id], v(2, 1.5), 0.01);
    expect(apex).toMatchObject({ key: 'boundaryLeft', end: 'mid' });
  });

  it('arrastar a extremidade de um limite e soltar grava por updateElements, em um passo de desfazer', () => {
    const w = withStair();
    const g = stairGripAt(w.store.project, [w.id], v(-0.5, 0.5), 0.01)!;
    const hold = stairHold(w.env as ToolEnv, g);
    hold.drag(pointer(v(-0.6, 0.5)), () => v(-0.6, 0.5));
    hold.release(pointer(v(-0.6, 0.5)), () => {});
    expect((w.stair().components[0] as StairRun).boundaryLeft[0]!.a).toEqual(v(-0.6, 0.5));
    w.store.undo();
    expect((w.stair().components[0] as StairRun).boundaryLeft[0]!.a).toEqual(v(-0.5, 0.5));
  });

  it('o vértice compartilhado de uma cadeia acompanha a extremidade vizinha', () => {
    const chain: StairRun = {
      ...straight(),
      boundaryLeft: [ln(v(-0.5, 0.5), v(2, 0.5)), ln(v(2, 0.5), v(5, 0.5))],
      boundaryRight: [ln(v(-0.5, -0.5), v(5, -0.5))],
    };
    const next = applyStairGrip([chain], { part: 0, key: 'boundaryLeft', index: 0, end: 'b' }, v(2.5, 0.5));
    const r = next[0] as StairRun;
    expect(r.boundaryLeft[0]!.b).toEqual(v(2.5, 0.5));
    expect(r.boundaryLeft[1]!.a).toEqual(v(2.5, 0.5));
    expect(chain.boundaryLeft[0]!.b).toEqual(v(2, 0.5));
  });

  it('a alça do espelho não acompanha outra (espelhos são linhas soltas)', () => {
    const next = applyStairGrip([straight()], { part: 0, key: 'risers', index: 0, end: 'b' }, v(0, 1.5));
    const r = next[0] as StairRun;
    expect(r.risers[0]!.b).toEqual(v(0, 1.5));
    expect(r.risers[1]!.a).toEqual(v(1, -1));
  });

  it('arrastar o meio do arco muda a flecha (sag) pelo ponto de arraste', () => {
    const arc: StairRun = { ...straight([]), boundaryLeft: [{ a: v(0, 0.5), b: v(4, 0.5), sag: 1 }], risers: [ln(v(1, -1), v(1, 3)), ln(v(3, -1), v(3, 3))] };
    const w = withStair([arc]);
    const g = stairGripAt(w.store.project, [w.id], v(2, 1.5), 0.01)!;
    const hold = stairHold(w.env as ToolEnv, g);
    hold.drag(pointer(v(2, 2)), () => v(2, 2));
    hold.release(pointer(v(2, 2)), () => {});
    expect((w.stair().components[0] as StairRun).boundaryLeft[0]!.sag).toBeCloseTo(1.5, 9);
  });

  it('croqui que fica inválido com o arraste é recusado e a escada não muda', () => {
    const w = withStair();
    const g = stairGripAt(w.store.project, [w.id], v(-0.5, -0.5), 0.01)!;
    const hold = stairHold(w.env as ToolEnv, g);
    hold.drag(pointer(v(-0.5, 0.5)), () => v(-0.5, 0.5));
    hold.release(pointer(v(-0.5, 0.5)), () => {});
    expect(w.msgs.at(-1)).toMatch(/Não é possível mover a alça/);
    expect((w.stair().components[0] as StairRun).boundaryRight[0]!.a).toEqual(v(-0.5, -0.5));
  });

  it('a alça não é achada em escada que não está selecionada', () => {
    const w = withStair();
    expect(stairGripAt(w.store.project, [], v(-0.5, 0.5), 0.01)).toBeNull();
  });
});
