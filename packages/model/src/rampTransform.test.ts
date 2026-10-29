import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, defaultRampTypeId, makeRamp, type Ramp, type RampShape, type StairCurve, type StairRun } from './index.ts';

const curve = (ax: number, ay: number, bx: number, by: number, sag = 0): StairCurve => ({ a: { x: ax, y: ay }, b: { x: bx, y: by }, sag });

const run = (): StairRun => ({
  id: 'r1',
  kind: 'run',
  boundaryLeft: [curve(0, 0, 0, 3, 0.2)],
  boundaryRight: [curve(1, 0, 1, 3)],
  risers: [curve(0, 0, 1, 0), curve(0, 3, 1, 3)],
  path: [],
});

function store(extra: Partial<Ramp> = {}, turn: 'left' | 'right' = 'left', shape: RampShape = 'straight'): ProjectStore {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRamp',
    ramp: makeRamp({ id: 'rp1', typeId: defaultRampTypeId, levelId: 'lv_0', components: [run()], turn, shape, ...extra }),
  });
  return s;
}

const rampOf = (s: ProjectStore): Ramp => s.project.elements.rp1 as Ramp;

describe('transformRamp', () => {
  it('mover soma o deslocamento aos pontos', () => {
    const s = store();
    s.exec({ type: 'transform', ids: ['rp1'], transform: { kind: 'translate', d: { x: 5, y: 2 } } });
    const r = rampOf(s).components[0] as StairRun;
    expect(r.boundaryLeft[0]!.a).toEqual({ x: 5, y: 2 });
    expect(r.risers[0]!.b).toEqual({ x: 6, y: 2 });
    expect(r.boundaryLeft[0]!.sag).toBe(0.2);
  });

  it('espelhar troca os limites, nega a flecha e inverte o giro', () => {
    const s = store({}, 'left', 'lshape');
    s.exec({ type: 'transform', ids: ['rp1'], transform: { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 0, y: 1 } } });
    const r = rampOf(s);
    expect(r.turn).toBe('right');
    const c = r.components[0] as StairRun;
    expect(c.boundaryLeft[0]!.a).toEqual({ x: -1, y: 0 });
    expect(c.boundaryRight[0]!.a).toEqual({ x: 0, y: 0 });
    expect(c.boundaryRight[0]!.sag).toBeCloseTo(-0.2);
  });

  it('espelhar duas vezes volta o giro ao original', () => {
    const s = store({}, 'right', 'ushape');
    const m = { kind: 'mirror', a: { x: 0, y: 0 }, b: { x: 1, y: 0 } } as const;
    s.exec({ type: 'transform', ids: ['rp1'], transform: m });
    expect(rampOf(s).turn).toBe('left');
    s.exec({ type: 'transform', ids: ['rp1'], transform: m });
    expect(rampOf(s).turn).toBe('right');
  });

  it('girar mantém o giro e a flecha', () => {
    const s = store();
    s.exec({ type: 'transform', ids: ['rp1'], transform: { kind: 'rotate', about: { x: 0, y: 0 }, angle: Math.PI / 2 } });
    const r = rampOf(s);
    expect(r.turn).toBe('left');
    expect((r.components[0] as StairRun).boundaryLeft[0]!.sag).toBe(0.2);
  });
  it('forma livre: freePath acompanha mover e espelhar; round-trip por JSON', () => {
    const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 6 }];
    const s = store({ freePath: path, manualLandings: [1] }, 'left', 'free');
    s.exec({ type: 'transform', ids: ['rp1'], transform: { kind: 'translate', d: { x: 1, y: 2 } } });
    expect(rampOf(s).freePath).toEqual([{ x: 1, y: 2 }, { x: 6, y: 2 }, { x: 6, y: 8 }]);
    expect(rampOf(s).manualLandings).toEqual([1]);
    const back = JSON.parse(JSON.stringify(rampOf(s))) as Ramp;
    expect(back.shape).toBe('free');
    expect(back.freePath).toEqual(rampOf(s).freePath);
  });

  it('rampa sem freePath continua sem o campo (projetos antigos)', () => {
    const s = store();
    s.exec({ type: 'transform', ids: ['rp1'], transform: { kind: 'translate', d: { x: 1, y: 2 } } });
    expect('freePath' in rampOf(s)).toBe(false);
  });
});
