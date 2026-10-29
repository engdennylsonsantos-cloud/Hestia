import { describe, expect, it } from 'vitest';
import { defaultUnits,
  createEmptyProject,
  leafSizeOf,
  makeWall,
  openingSpanOf,
  openingTypeIssue,
  ProjectStore,
  spanTypeOf,
  type Opening,
  type OpeningType,
  type Project,
} from '@hestia/model';
import { frameOfWall, openingGeometry, resolveLevel } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import { buildOpeningSchedule, openingScheduleToCsv } from './openingSchedule.ts';
import { openingChecks } from './openingChecks.ts';

/** Referência nominal da folha (`nominalRef` 'leaf'): o vão é derivado e TODO o motor lê o vão por uma fonte só. */

function cena(extra: Partial<OpeningType>, base = 'ot_p80'): Project {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base]!;
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: 'ot_x', hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  return s.project;
}

const geo = (p: Project) => openingGeometry(p, p.elements.v as Opening, frameOfWall(p, 'w')!);
const resolvido = (p: Project): string => JSON.stringify(resolveLevel(p, 'lv_0', new Map()));

describe('acessores do vão e da folha', () => {
  const base = { width: 0.8, height: 2.1 };
  it("'opening' (padrão): o vão é o próprio tipo e o objeto não muda", () => {
    const t = { ...base };
    expect(openingSpanOf(t)).toEqual({ width: 0.8, height: 2.1 });
    expect(spanTypeOf(t)).toBe(t);
  });
  it("'leaf': vão = folha + 0,08 × 0,05 por padrão e folgas configuráveis", () => {
    const t = { ...base, nominalRef: 'leaf' as const };
    expect(openingSpanOf(t).width).toBeCloseTo(0.88, 9);
    expect(openingSpanOf(t).height).toBeCloseTo(2.15, 9);
    expect(leafSizeOf(t)).toEqual({ width: 0.8, height: 2.1 });
    const g2 = openingSpanOf({ ...t, spanGap: { w: 0.06, h: 0.03 } });
    expect(g2.width).toBeCloseTo(0.86, 9);
    expect(g2.height).toBeCloseTo(2.13, 9);
    const n = spanTypeOf(t);
    expect(n.nominalRef).toBe('opening');
    expect(spanTypeOf(n)).toBe(n);
  });
  it("'opening': a folha é o vão menos a folga", () => {
    expect(leafSizeOf({ width: 0.88, height: 2.15 }).width).toBeCloseTo(0.8, 9);
  });
});

describe('validação', () => {
  const ok = { kind: 'door', plan: 'swing', leaves: 1 } as const;
  it('folgas fora de 0..30 cm, nominalRef desconhecido e reveal inválido são recusados', () => {
    expect(openingTypeIssue({ ...ok, nominalRef: 'leaf', spanGap: { w: 0.08, h: 0.05 } })).toBeNull();
    expect(openingTypeIssue({ ...ok, spanGap: { w: -0.01, h: 0.05 } })).toMatch(/Folga do vão/);
    expect(openingTypeIssue({ ...ok, spanGap: { w: 0.08, h: 0.5 } })).toMatch(/Folga do vão/);
    expect(openingTypeIssue({ ...ok, nominalRef: 'x' as 'leaf' })).toMatch(/Referência nominal/);
    expect(openingTypeIssue({ ...ok, reveal: { depth: -0.1 } })).toMatch(/Recuo/);
    expect(openingTypeIssue({ ...ok, reveal: { depth: 0.04 } })).toBeNull();
  });
});

describe('motor com porta 80 x 210 de folha', () => {
  const leaf = cena({ nominalRef: 'leaf' });
  it('furo de 0,88 × 2,15 na parede; o batente ocupa o vão', () => {
    const g = geo(leaf);
    expect(g.width).toBeCloseTo(0.88, 9);
    expect(g.height).toBeCloseTo(2.15, 9);
    expect(g.roughWidth).toBeCloseTo(0.88, 9);
    expect(g.roughHeight).toBeCloseTo(2.15, 9);
    const m = buildOpeningModel(leaf, leaf.elements.v as Opening, g, frameOfWall(leaf, 'w')!);
    expect(m.width).toBeCloseTo(0.88, 9);
    expect(m.height).toBeCloseTo(2.15, 9);
  });
  it('a folha desenhada é a nominal (dentro do vão, com a folga do rebaixo)', () => {
    const g = geo(leaf);
    const m = buildOpeningModel(leaf, leaf.elements.v as Opening, g, frameOfWall(leaf, 'w')!);
    const folha = m.parts.find((x) => x.role === 'leaf')!;
    expect(folha.box.s1 - folha.box.s0).toBeGreaterThan(0);
    const w = folha.box.t1 - folha.box.t0;
    expect(Math.abs(w - 0.8)).toBeLessThan(0.005); // 0,88 − 2 × 0,05 + 2 × 0,015 − 2 × 0,004 = 0,802
    expect(w).toBeLessThan(0.88);
  });
  it('resolveLevel é idêntico ao de um tipo dado pelo vão 0,88 × 2,15', () => {
    const porVao = cena({ nominalRef: 'opening', width: 0.88, height: 2.15 });
    expect(resolvido(leaf)).toBe(resolvido(porVao));
  });
  it("tipo 'opening' (padrão) não muda: nominalRef explícito 'opening' resolve igual ao ausente", () => {
    expect(resolvido(cena({ nominalRef: 'opening' }))).toBe(resolvido(cena({})));
  });
});

describe('quadro de esquadrias', () => {
  it('mostra o vão e a folha', () => {
    const p = cena({ nominalRef: 'leaf' });
    const row = buildOpeningSchedule(p).rows.find((r) => r.typeId === 'ot_x')!;
    expect(row.width).toBeCloseTo(0.88, 9);
    expect(row.height).toBeCloseTo(2.15, 9);
    expect(row.leafWidth).toBeCloseTo(0.8, 9);
    expect(row.leafHeight).toBeCloseTo(2.1, 9);
    expect(row.unitArea).toBeCloseTo(0.88 * 2.15, 9);
    const s = buildOpeningSchedule(p);
    expect(openingScheduleToCsv(s.rows, s.totals, defaultUnits())).toContain('0,80;2,10');
  });
});

describe('verificações do tipo', () => {
  it("largura livre do tipo 'leaf' parte do vão", () => {
    const p = cena({ nominalRef: 'leaf' });
    const txt = openingChecks(p.openingTypes.ot_x!, 0.14).map((c) => c.text).join('|');
    expect(txt).toContain('0,78'); // 0,88 − 2 × 0,05
  });
});
