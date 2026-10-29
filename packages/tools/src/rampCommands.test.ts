import { describe, expect, it } from 'vitest';
import { DEFAULT_RAMP_TYPES, rampsOnLevel, type Ramp, type RampShape, type StairRun } from '@hestia/model';
import { planRamp, type RampPlan } from '@hestia/engine';
import { createRampFromPlan, draftRamp, rampRise, rampTypeId } from './rampCommands.ts';
import { clipboardFrom, pasteAlignedCommand } from './clipboard.ts';
import { selectedMovables } from './edit.ts';
import { makeEnv } from './testEnv.ts';

const type = DEFAULT_RAMP_TYPES.find((t) => t.id === 'rmt_nbr9050')!;

function straightPlan(extra: Partial<Parameters<typeof planRamp>[0]> = {}): RampPlan {
  const r = planRamp({
    start: { x: 0, y: 0 },
    dir: { x: 1, y: 0 },
    H: 0.8,
    type,
    shape: 'straight',
    turn: 'left',
    width: 1.5,
    mode: 'slope',
    slope: 1 / 12,
    ...extra,
  });
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('rampTypeId e draftRamp', () => {
  it('tipo pedido se existe, senão o padrão do projeto', () => {
    const { store } = makeEnv();
    expect(rampTypeId(store.project, 'rmt_ada')).toBe('rmt_ada');
    expect(rampTypeId(store.project, 'nao_existe')).toBe('rmt_nbr9050');
    expect(rampTypeId(store.project)).toBe('rmt_nbr9050');
  });

  it('rascunho usa as opções de cota e a altura padrão sem nível acima', () => {
    const { store } = makeEnv();
    const d = draftRamp(store.project, { shape: 'straight', turn: 'left', mode: 'length' }, 'lv_1')!;
    expect(d.id).toBe('draft');
    expect(d.kind).toBe('ramp');
    expect(d.order).toBe(0);
    expect(d.topLevelId).toBeNull();
    expect(rampRise(store.project, d)).toBeCloseTo(0.8, 6);
  });
});

describe('createRampFromPlan', () => {
  it('cria a rampa com forma e inclinação alvo, seleciona e desfaz em um passo', () => {
    const { store, env, sel } = makeEnv();
    const shape: RampShape = 'straight';
    const r = createRampFromPlan(env, straightPlan(), {
      typeId: 'rmt_nbr9050',
      levelId: 'lv_0',
      shape,
      turn: 'left',
      inputMode: 'slope',
      slopeTarget: 1 / 12,
    });
    expect('id' in r).toBe(true);
    if (!('id' in r)) return;
    const ramp = store.project.elements[r.id];
    expect(ramp?.kind).toBe('ramp');
    expect(ramp && 'shape' in ramp ? ramp.shape : null).toBe('straight');
    expect(ramp && 'slopeTarget' in ramp ? ramp.slopeTarget : null).toBeCloseTo(1 / 12, 9);
    expect(ramp && 'inputMode' in ramp ? ramp.inputMode : null).toBe('slope');
    expect(sel()).toEqual([r.id]);
    expect(rampsOnLevel(store.project, 'lv_0')).toHaveLength(1);
    store.undo();
    expect(rampsOnLevel(store.project, 'lv_0')).toHaveLength(0);
  });

  it('recusa tipo inexistente', () => {
    const { env } = makeEnv();
    expect(createRampFromPlan(env, straightPlan(), {
      typeId: 'nao_existe',
      levelId: 'lv_0',
      shape: 'straight',
      turn: 'left',
      inputMode: 'slope',
      slopeTarget: 1 / 12,
    })).toEqual({ error: 'Tipo de rampa inexistente' });
  });
});

/** Cria uma rampa no projeto e devolve o id. */
function createRamp(extra: Partial<Parameters<typeof planRamp>[0]> = {}): { ctx: ReturnType<typeof makeEnv>; id: string } {
  const ctx = makeEnv();
  const plan = straightPlan(extra);
  const r = createRampFromPlan(ctx.env, plan, {
    typeId: 'rmt_nbr9050',
    levelId: 'lv_0',
    shape: (extra.shape ?? 'straight') as RampShape,
    turn: extra.turn ?? 'left',
    inputMode: 'slope',
    slopeTarget: 1 / 12,
  });
  if (!('id' in r)) throw new Error(r.error);
  return { ctx, id: r.id };
}

/** Todos os pontos do croqui (a e b de cada curva de cada componente). */
function sketchPoints(r: Ramp): Array<{ x: number; y: number }> {
  return r.components.flatMap((c) => {
    const curves = c.kind === 'landing' ? c.boundary : [...c.boundaryLeft, ...c.boundaryRight, ...c.risers, ...c.path];
    return curves.flatMap((q) => [q.a, q.b]);
  });
}

const rampOf = (ctx: ReturnType<typeof makeEnv>, id: string): Ramp => {
  const e = ctx.store.project.elements[id];
  if (!e || e.kind !== 'ramp') throw new Error('esperava uma rampa');
  return e;
};

describe('mover, copiar/colar e espelhar a rampa', () => {
  it('a rampa entra nos movíveis e mover por (2, 1) desloca todos os pontos do croqui', () => {
    const { ctx, id } = createRamp();
    expect(selectedMovables(ctx.store.project, [id])).toEqual([id]);
    const before = sketchPoints(rampOf(ctx, id));
    ctx.store.exec({ type: 'transform', ids: [id], transform: { kind: 'translate', d: { x: 2, y: 1 } } });
    const after = sketchPoints(rampOf(ctx, id));
    expect(after).toHaveLength(before.length);
    after.forEach((q, i) => {
      expect(q.x).toBeCloseTo(before[i]!.x + 2, 9);
      expect(q.y).toBeCloseTo(before[i]!.y + 1, 9);
    });
  });

  it('copiar e colar cria uma rampa com id novo e a mesma geometria', () => {
    const { ctx, id } = createRamp();
    const clip = clipboardFrom(ctx.store.project, [id])!;
    expect(clip.ramps).toHaveLength(1);
    const r = pasteAlignedCommand(ctx.store.project, clip, 'lv_0')!;
    expect(r.rampIds).toHaveLength(1);
    ctx.store.exec(r.command);
    const newId = r.rampIds[0]!;
    expect(newId).not.toBe(id);
    expect(rampsOnLevel(ctx.store.project, 'lv_0')).toHaveLength(2);
    expect(sketchPoints(rampOf(ctx, newId))).toEqual(sketchPoints(rampOf(ctx, id)));
  });

  it('a cópia por transformação desloca a geometria e mantém a original', () => {
    const { ctx, id } = createRamp();
    const before = sketchPoints(rampOf(ctx, id));
    ctx.store.exec({ type: 'transform', ids: [id], transform: { kind: 'translate', d: { x: 2, y: 1 } }, copy: { idMap: { [id]: 'rp_copia' } } });
    expect(sketchPoints(rampOf(ctx, 'rp_copia'))[0]).toEqual({ x: before[0]!.x + 2, y: before[0]!.y + 1 });
    expect(sketchPoints(rampOf(ctx, id))).toEqual(before);
  });

  it('espelhar uma rampa em L troca o lado do giro', () => {
    const { ctx, id } = createRamp({ shape: 'lshape', H: 1.2 });
    expect(rampOf(ctx, id).turn).toBe('left');
    ctx.store.exec({ type: 'transform', ids: [id], transform: { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 0, y: 1 } } });
    expect(rampOf(ctx, id).turn).toBe('right');
    const runs = rampOf(ctx, id).components.filter((c): c is StairRun => c.kind === 'run');
    expect(runs).toHaveLength(2);
  });
});
