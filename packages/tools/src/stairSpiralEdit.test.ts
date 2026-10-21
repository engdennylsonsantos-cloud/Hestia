import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import { stairsOnLevel, type Stair, type StairRun } from '@hestia/model';
import { resolveStairs, type ResolvedStair } from '@hestia/engine';
import { makeEnv, P, tool } from './testEnv.ts';
import { discardSpiralOnEdit, regenSpiralComponents, spiralInfo, spiralOfStair } from './stairSpiralRun.ts';
import { spiralGripAt, spiralHandlePoints, spiralHandles, spiralHandlePreview, spiralHold, type SpiralHandle } from './stairSpiralGrips.ts';
import { stairGripAt, stairHold } from './stairGrips.ts';
import type { PointerInfo, Tool, ToolEnv } from './types.ts';

const DEG = Math.PI / 180;
const at = (r: number, deg: number, c: Vec2 = { x: 0, y: 0 }): PointerInfo => P(c.x + r * Math.cos(deg * DEG), c.y + r * Math.sin(deg * DEG));
const pointer = (raw: Vec2): PointerInfo => ({ raw, shift: false, ctrl: false, alt: false });
const snapTo = (q: Vec2) => () => q;
/** Soltar a alça: a interface de arraste não usa o ponto nem o foco do vértice. */
const RELEASE = (): void => {};
const release = (h: { release: (p: PointerInfo, f: () => void) => void }) => h.release(pointer({ x: 0, y: 0 }), RELEASE);

/** Caracol criado pela ferramenta (H = 2,80 m, 16 espelhos), com a escada selecionada. */
function make(sweepDeg = 270) {
  const ctx = makeEnv();
  const msgs: string[] = [];
  ctx.env.say = (m: string) => msgs.push(m);
  ctx.options.stairRun = { shape: 'spiral', width: 1.2, turn: 'left' };
  ctx.options.stair = { topLevelId: 'lv_1', topOffset: -0.2 };
  const t: Tool = tool('stairrun', ctx.env);
  t.move(at(0, 0));
  t.click(at(0, 0));
  t.move(at(1, 0));
  t.click(at(1, 0));
  const steps = Math.round(Math.abs(sweepDeg) / 10);
  for (let i = 1; i <= steps; i++) t.move(at(1, (sweepDeg * i) / steps));
  t.click(at(1, sweepDeg));
  const [s] = stairsOnLevel(ctx.store.project, 'lv_0');
  return { ...ctx, msgs, id: s!.id, stair: () => ctx.store.project.elements[s!.id] as Stair, last: () => msgs[msgs.length - 1] ?? '' };
}

/** Alça `handle` do caracol da escada, pelo ponto exato dela. */
function grip(w: ReturnType<typeof make>, handle: SpiralHandle) {
  const run = w.stair().components[0] as StairRun;
  const at0 = spiralHandlePoints(run.spiral!)[handle];
  const g = spiralGripAt(w.store.project, [w.id], at0, 0.01);
  if (!g || g.handle !== handle) throw new Error(`alça ${handle} não achada`);
  return g;
}

const spiralOf = (w: ReturnType<typeof make>) => (w.stair().components[0] as StairRun).spiral!;
const resolvedOf = (w: ReturnType<typeof make>): ResolvedStair => resolveStairs(w.store.project)[0]!;
const errorsOf = (r: ResolvedStair) => r.issues.filter((i) => i.severity === 'error');

describe('alças do caracol', () => {
  it('as cinco alças saem dos parâmetros; a de centro, raios e ângulos ficam sobre o croqui', () => {
    const w = make(270);
    const sp = spiralOf(w);
    const pts = spiralHandlePoints(sp);
    expect(spiralHandles(w.stair())).toHaveLength(5);
    expect(pts.center).toEqual({ x: 0, y: 0 });
    expect(pts.start.x).toBeCloseTo(1, 6);
    expect(pts.start.y).toBeCloseTo(0, 6);
    expect(spiralHandlePreview(w.store.project, [w.id])).toHaveLength(5);
  });

  it('alça do raio externo: arrastar muda o raio e regenera o croqui em uma transação; desfazer volta', () => {
    const w = make(270);
    const g = grip(w, 'outer');
    const hold = spiralHold(w.env as ToolEnv, g);
    hold.drag(pointer(at(1.5, 135).raw), snapTo({ x: 0, y: 0 }));
    release(hold);
    expect(spiralOf(w).rOuter).toBeCloseTo(1.5, 6);
    expect(spiralOf(w).sweep).toBeCloseTo((270 * DEG), 6);
    expect(errorsOf(resolvedOf(w))).toEqual([]);
    expect(w.last()).toBe('Alça do caracol ajustada. Ctrl+Z desfaz.');
    w.store.undo();
    expect(spiralOf(w).rOuter).toBeCloseTo(1, 6);
  });

  it('alça do raio interno: arrastar muda o raio interno, e raio interno igual ao externo é recusado', () => {
    const w = make(270);
    const hold = spiralHold(w.env as ToolEnv, grip(w, 'inner'));
    hold.drag(pointer(at(0.25, 135).raw), snapTo({ x: 0, y: 0 }));
    release(hold);
    expect(spiralOf(w).rInner).toBeCloseTo(0.25, 6);

    const bad = spiralHold(w.env as ToolEnv, grip(w, 'inner'));
    bad.drag(pointer(at(1.2, 135).raw), snapTo({ x: 0, y: 0 }));
    release(bad);
    expect(w.last()).toMatch(/^Não é possível mover a alça: O raio externo deve ser maior que o interno\./);
    expect(spiralOf(w).rInner).toBeCloseTo(0.25, 6);
  });

  it('alça do ângulo inicial: gira tudo e mantém a varredura', () => {
    const w = make(270);
    const g = grip(w, 'start');
    const hold = spiralHold(w.env as ToolEnv, g);
    // Arrasta 30° no sentido anti-horário, em passos de 5°.
    for (let a = 5; a <= 30; a += 5) hold.drag(pointer(at(1, a).raw), snapTo({ x: 0, y: 0 }));
    release(hold);
    expect(spiralOf(w).startAngle).toBeCloseTo(30 * DEG, 6);
    expect(spiralOf(w).sweep).toBeCloseTo(270 * DEG, 6);
  });

  it('alça do ângulo final: passa de 360° até 720° (acumula o giro) e não passa de 720°', () => {
    const w = make(270);
    const hold = spiralHold(w.env as ToolEnv, grip(w, 'sweep'));
    for (let a = 280; a <= 540; a += 10) hold.drag(pointer(at(1, a).raw), snapTo({ x: 0, y: 0 }));
    release(hold);
    expect(spiralOf(w).sweep).toBeCloseTo(540 * DEG, 6);
    expect(errorsOf(resolvedOf(w))).toEqual([]);

    const w2 = make(270);
    const h2 = spiralHold(w2.env as ToolEnv, grip(w2, 'sweep'));
    for (let a = 280; a <= 1200; a += 10) h2.drag(pointer(at(1, a).raw), snapTo({ x: 0, y: 0 }));
    release(h2);
    expect(spiralOf(w2).sweep).toBeCloseTo(4 * Math.PI, 6);
  });

  it('alça do ângulo final: mínimo de 30°, sem inverter o sentido ao passar de zero', () => {
    const w = make(270);
    const hold = spiralHold(w.env as ToolEnv, grip(w, 'sweep'));
    for (let a = 260; a >= -200; a -= 10) hold.drag(pointer(at(1, a).raw), snapTo({ x: 0, y: 0 }));
    release(hold);
    expect(spiralOf(w).sweep).toBeCloseTo(30 * DEG, 6);
  });

  it('alça do centro: move o conjunto (o croqui vai com o centro)', () => {
    const w = make(270);
    const hold = spiralHold(w.env as ToolEnv, grip(w, 'center'));
    hold.drag(pointer({ x: 2, y: 0 }), snapTo({ x: 2, y: 0 }));
    release(hold);
    expect(spiralOf(w).center).toEqual({ x: 2, y: 0 });
    const run = w.stair().components[0] as StairRun;
    expect(run.boundaryRight.length).toBeGreaterThan(0);
    expect(run.boundaryRight[0]!.a.x).toBeCloseTo(2 + 1, 6);
  });

  it('alça do croqui comum (espelho) é edição à mão: descarta o caracol e mantém a origem spiral', () => {
    const w = make(270);
    const run = w.stair().components[0] as StairRun;
    const riser = run.risers[3]!;
    const g = stairGripAt(w.store.project, [w.id], riser.b, 0.01)!;
    const hold = stairHold(w.env as ToolEnv, g);
    hold.drag(pointer({ x: riser.b.x + 0.005, y: riser.b.y }), () => ({ x: riser.b.x + 0.005, y: riser.b.y }));
    hold.release(pointer(riser.b), () => {});
    const after = w.stair().components[0] as StairRun;
    expect(after.spiral).toBeUndefined();
    expect(after.generatedBy).toBe('spiral');
    expect(w.stair().components.length).toBe(1);
    w.store.undo();
    expect((w.stair().components[0] as StairRun).spiral).toBeDefined();
  });

  it('a alça de caracol só vale para escada selecionada', () => {
    const w = make(270);
    const sp = spiralOf(w);
    expect(spiralGripAt(w.store.project, [], sp.center, 0.01)).toBeNull();
  });
});

describe('edição do croqui e propriedades do caracol', () => {
  it('discardSpiralOnEdit: só mudança de limite ou espelho descarta; caminhada e igualdade mantêm', () => {
    const w = make(270);
    const before = w.stair().components;
    const run = before[0] as StairRun;
    const pathOnly: StairRun = { ...run, path: [{ a: { x: 0, y: 0 }, b: { x: 1, y: 1 }, sag: 0 }] };
    expect((discardSpiralOnEdit(before, [pathOnly])[0] as StairRun).spiral).toBeDefined();
    expect((discardSpiralOnEdit(before, [{ ...run }])[0] as StairRun).spiral).toBeDefined();
    const movedRiser: StairRun = { ...run, risers: run.risers.map((r, i) => (i === 0 ? { ...r, b: { x: r.b.x + 0.01, y: r.b.y } } : r)) };
    const out = discardSpiralOnEdit(before, [movedRiser])[0] as StairRun;
    expect(out.spiral).toBeUndefined();
    expect(out.generatedBy).toBe('spiral');
  });

  it('regenSpiralComponents: N pela altura (16), raio e varredura novos; o id do lance é o mesmo', () => {
    const w = make(270);
    const s = w.stair();
    const sp = spiralOf(w);
    const reg = regenSpiralComponents(w.store.project, s, 0, { ...sp, rOuter: 1.2, sweep: 540 * DEG });
    expect('error' in reg).toBe(false);
    if ('error' in reg) return;
    const run = reg.components[0] as StairRun;
    expect(run.id).toBe((s.components[0] as StairRun).id);
    expect(run.risers).toHaveLength(16);
    expect(run.spiral!.rOuter).toBeCloseTo(1.2, 9);
    expect(run.spiral!.sweep).toBeCloseTo(540 * DEG, 9);
  });

  it('regenSpiralComponents recusa raio externo não maior que o interno, com a mensagem', () => {
    const w = make(270);
    const sp = spiralOf(w);
    expect(regenSpiralComponents(w.store.project, w.stair(), 0, { ...sp, rOuter: 0.05 })).toEqual({ error: 'O raio externo deve ser maior que o interno.' });
  });

  it('linha informativa: com 540°, 10 espelhos por volta e folga entre voltas (h 0,175; T 0,169) abaixo do mínimo de 2,10 m', () => {
    const w = make(540);
    const info = spiralInfo(w.store.project, w.stair(), spiralOf(w));
    expect(info).not.toBeNull();
    expect(info!.risers).toBe(16);
    expect(info!.riserHeight).toBeCloseTo(0.175, 6);
    expect(info!.perTurn).toBeCloseTo(10, 6);
    expect(info!.headroom).toBeCloseTo(1.406, 2);
    expect(info!.minHeadroom).toBeCloseTo(2.1, 9);
  });

  it('spiralOfStair acha o 1º lance caracol; escada sem caracol, nenhum', () => {
    const w = make(270);
    expect(spiralOfStair(w.stair())?.part).toBe(0);
    const plain = { ...w.stair(), components: [{ ...(w.stair().components[0] as StairRun), spiral: undefined }] } as Stair;
    expect(spiralOfStair(plain)).toBeNull();
  });
});
