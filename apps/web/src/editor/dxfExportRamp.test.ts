import { describe, expect, it } from 'vitest';
import { planRamp, resolveRampsOnLevel } from '@hestia/engine';
import {
  ProjectStore,
  createEmptyProject,
  makeLevel,
  makeRamp,
  type CategoryOverride,
  type GraphicsCategory,
  type Project,
  type StairLanding,
  type StairRun,
  type ViewGraphics,
  type ViewRange,
} from '@hestia/model';
import { planDxf, rampDxf } from './dxfExport.ts';

const type = createEmptyProject().rampTypes.rmt_nbr9050!;

const componentsOf = (plan: ReturnType<typeof planRamp>): Array<StairRun | StairLanding> => {
  if ('error' in plan) throw new Error(plan.error);
  return plan.parts.map((x, i) => (x.kind === 'run' ? { id: `c${i}`, kind: 'run', ...x.run } : { id: `c${i}`, kind: 'landing', ...x.landing }));
};

/** Projeto com uma rampa reta de 9,60 m (H = 0,80, inclinação 1/12) subindo no eixo +Y. */
function straightRamp(): Project {
  const plan = planRamp({ start: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, H: 0.8, type, shape: 'straight', turn: 'left', width: 1.5, mode: 'slope', slope: 1 / 12 });
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertLevel', level: makeLevel({ id: 'lv_top', name: 'Topo', elevation: 0.8 }) });
  s.exec({
    type: 'addRamp',
    ramp: makeRamp({
      id: 'rp1',
      typeId: type.id,
      levelId: 'lv_0',
      topLevelId: 'lv_top',
      components: componentsOf(plan),
      shape: 'straight',
      inputMode: 'slope',
      slopeTarget: 1 / 12,
    }),
  });
  return s.project;
}

const withRange = (p: Project, range: Partial<ViewRange>): Project => ({
  ...p,
  levels: p.levels.map((l) => (l.id === 'lv_0' ? { ...l, viewRange: { ...l.viewRange, ...range } } : l)),
});

/** Cópia com os gráficos salvos da vista (a categoria `stair` cobre escada e rampa). */
function withGraphics(p: Project, overrides: Partial<Record<GraphicsCategory, Partial<CategoryOverride>>>): Project {
  const q = structuredClone(p);
  q.levels = q.levels.map((l) => (l.id === 'lv_0' ? { ...l, graphics: { overrides } as ViewGraphics } : l));
  return q;
}

describe('DXF da rampa reta (H=0,80, 9,60 m)', () => {
  it('acima do topo: camadas RAMPA, RAMPA_SETA e RAMPA_TEXTO com o texto 8,33 % (1:12)', () => {
    const out = planDxf(straightRamp(), 'lv_0');
    expect(out).toContain('\r\nPOLYLINE\r\n8\r\nRAMPA\r\n');
    expect(out).toContain('\r\nLINE\r\n8\r\nRAMPA_SETA\r\n');
    expect(out).toContain('\r\nRAMPA_TEXTO\r\n');
    expect(out).toContain('8,33 % (1:12)');
    expect(out).not.toContain('RAMPA_ACIMA');
    expect(out).not.toContain('RAMPA_CORTE');
  });

  it('com a cota de corte em 0,40: aparece RAMPA_ACIMA (tracejada) e a linha RAMPA_CORTE', () => {
    const out = planDxf(withRange(straightRamp(), { cut: 0.4 }), 'lv_0');
    expect(out).toContain('\r\nPOLYLINE\r\n8\r\nRAMPA_ACIMA\r\n');
    expect(out).toContain('\r\nLINE\r\n8\r\nRAMPA_CORTE\r\n');
  });

  it('com a categoria stair oculta: nenhuma camada de rampa', () => {
    const p = withGraphics(straightRamp(), { stair: { visible: false } });
    const out = planDxf(p, 'lv_0');
    expect(out).not.toContain('RAMPA');
  });

  it('a rotação do texto de uma rampa ao longo de +Y é 90 graus, no meio do eixo', () => {
    const p = straightRamp();
    const rr = resolveRampsOnLevel(p, 'lv_0')[0]!;
    const dxf = rampDxf(p, rr, { cutZ: 2, topZ: 2 });
    expect(dxf.texts).toHaveLength(1);
    expect(dxf.texts[0]!.rotation).toBeCloseTo(90, 6);
    expect(dxf.texts[0]!.text).toBe('8,33 % (1:12)');
    expect(dxf.texts[0]!.at.y).toBeCloseTo(4.8, 6);
    expect(dxf.texts[0]!.at.x).toBeCloseTo(0, 6);
  });

  it('acima do topo o prisma sai só em RAMPA; abaixo do topo o acima do corte sai em RAMPA_ACIMA', () => {
    const p = straightRamp();
    const rr = resolveRampsOnLevel(p, 'lv_0')[0]!;
    const high = rampDxf(p, rr, { cutZ: 2, topZ: 2 });
    expect(high.outlines).toHaveLength(1);
    expect(high.outlinesAbove ?? []).toHaveLength(0);
    expect(high.cut).toHaveLength(0);
    const low = rampDxf(p, rr, { cutZ: 0.4, topZ: 2 });
    expect(low.outlines).toHaveLength(1);
    expect(low.outlinesAbove ?? []).toHaveLength(1);
    expect(low.cut).toHaveLength(1);
  });
});
