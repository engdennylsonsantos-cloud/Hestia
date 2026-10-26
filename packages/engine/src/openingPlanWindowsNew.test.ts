import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingPlanPaths, type OpeningPlanOptions, type OpeningPlanPath } from './openingPlan.ts';
import type { OpeningModel } from './openingModelTypes.ts';

interface Cena {
  p: Project;
  o: Opening;
}

function cena(base: string): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: base, hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  return { p, o };
}

const modelo = (c: Cena): OpeningModel => buildOpeningModel(c.p, c.o, openingGeometry(c.p, c.o, frameOfWall(c.p, 'w')!), frameOfWall(c.p, 'w')!);

const opts = (over: Partial<OpeningPlanOptions> = {}): OpeningPlanOptions => ({
  detail: 'mid',
  angle: Math.PI / 2,
  planDisplay: 'symbolic',
  showSwing: true,
  swingStyle: 'arc',
  cutZ: 1,
  ...over,
});

const abertos = (paths: OpeningPlanPath[]): OpeningPlanPath[] => paths.filter((p) => p.closed && p.role === 'leaf');
const swing = (paths: OpeningPlanPath[]): OpeningPlanPath[] => paths.filter((p) => p.role === 'swing');

function ladoMaisCurto(path: OpeningPlanPath): number {
  const pts = path.pts;
  const lados = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return Math.hypot(q.t - p.t, q.s - p.s);
  });
  return Math.min(...lados);
}

describe('planta das janelas novas: janela de abrir', () => {
  it('a folha aberta é um retângulo com a espessura da folha e um arco tracejado', () => {
    const paths = openingPlanPaths(modelo(cena('ot_ja120')), opts());
    const folhas = abertos(paths);
    expect(folhas).toHaveLength(2);
    for (const f of folhas) {
      expect(ladoMaisCurto(f)).toBeCloseTo(0.03, 9);
      expect(f.pts).toHaveLength(4);
    }
    const arcos = swing(paths);
    expect(arcos).toHaveLength(2);
    for (const a of arcos) expect(a.dash).toEqual([4, 3]);
  });

  it('showSwing = false remove os arcos e mantém a folha aberta', () => {
    const paths = openingPlanPaths(modelo(cena('ot_ja120')), opts({ showSwing: false }));
    expect(swing(paths)).toHaveLength(0);
    expect(abertos(paths)).toHaveLength(2);
  });
});

describe('planta das janelas novas: guilhotina', () => {
  it('duas linhas defasadas na profundidade, sem as três linhas do caixilho', () => {
    for (const detail of ['low', 'mid'] as const) {
      const paths = openingPlanPaths(modelo(cena('ot_jg90')), opts({ detail }));
      const linhas = paths.filter((p) => !p.closed && p.role === 'leaf');
      expect(linhas, detail).toHaveLength(2);
      const s = linhas.map((p) => p.pts[0]!.s).sort((a, b) => a - b);
      expect(Math.abs(s[0]! - s[1]!)).toBeGreaterThan(0.02);
    }
  });
});

describe('planta das janelas novas: pivotante', () => {
  it('folha girada em torno de t = 0 e dois arcos curtos tracejados', () => {
    const paths = openingPlanPaths(modelo(cena('ot_jp80')), opts());
    const folhas = abertos(paths);
    expect(folhas).toHaveLength(1);
    const t = folhas[0]!.pts.map((p) => p.t);
    expect(Math.min(...t)).toBeLessThan(0);
    expect(Math.max(...t)).toBeGreaterThan(0);
    const arcos = swing(paths);
    expect(arcos).toHaveLength(2);
    for (const a of arcos) expect(a.dash).toEqual([4, 3]);
  });
});

describe('planta das janelas novas: veneziana', () => {
  it('três linhas do caixilho e traços diagonais tracejados das aletas', () => {
    const paths = openingPlanPaths(modelo(cena('ot_jv80')), opts());
    const linhas = paths.filter((p) => !p.closed && (p.role === 'jamb' || p.role === 'glass'));
    expect(linhas).toHaveLength(3);
    const aletas = paths.filter((p) => p.role === 'leafPanel' && p.dash);
    expect(aletas.length).toBeGreaterThan(2);
    for (const a of aletas) {
      expect(a.pts).toHaveLength(2);
      expect(a.pts[0]!.t).not.toBeCloseTo(a.pts[1]!.t, 9);
      expect(a.pts[0]!.s).not.toBeCloseTo(a.pts[1]!.s, 9);
    }
  });
});
