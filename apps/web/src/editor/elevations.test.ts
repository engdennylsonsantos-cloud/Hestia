import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, type SectionView } from '@hestia/model';
import { elevationCommand, elevationSpecs, ELEVATION_OFFSET, type PlanBox } from './elevations.ts';

const BOX: PlanBox = { minX: 0, minY: 0, maxX: 10, maxY: 8 };
const CENTER = { x: 5, y: 4 };

/** Normal à esquerda de a→b, unitária. */
function leftNormal(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return { x: -dy / l, y: dx / l };
}

describe('elevationSpecs', () => {
  const specs = elevationSpecs(BOX);

  it('gera Norte, Sul, Leste e Oeste nessa ordem', () => {
    expect(specs.map((s) => s.name)).toEqual(['Norte', 'Sul', 'Leste', 'Oeste']);
  });

  it.each(elevationSpecs(BOX).map((s) => [s.name, s] as const))('%s: a normal à esquerda aponta para o centro da caixa', (_name, s) => {
    const n = leftNormal(s.a, s.b);
    const mid = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
    const toCenter = { x: CENTER.x - mid.x, y: CENTER.y - mid.y };
    expect(toCenter.x * n.x + toCenter.y * n.y).toBeGreaterThan(0);
  });

  it.each(elevationSpecs(BOX).map((s) => [s.name, s] as const))('%s: a linha fica a 3 m da face da caixa', (_name, s) => {
    const n = leftNormal(s.a, s.b);
    const corners = [
      { x: BOX.minX, y: BOX.minY },
      { x: BOX.maxX, y: BOX.minY },
      { x: BOX.maxX, y: BOX.maxY },
      { x: BOX.minX, y: BOX.maxY },
    ];
    const gaps = corners.map((c) => (c.x - s.a.x) * n.x + (c.y - s.a.y) * n.y);
    expect(Math.min(...gaps)).toBeCloseTo(ELEVATION_OFFSET);
  });

  it('Norte mostra a fachada norte: vista de norte olhando para -y, de leste para oeste, em y = maxY + 3', () => {
    const norte = specs[0]!;
    expect(norte.a.y).toBeCloseTo(BOX.maxY + ELEVATION_OFFSET);
    expect(norte.b.y).toBeCloseTo(BOX.maxY + ELEVATION_OFFSET);
    expect(norte.a.x).toBeGreaterThan(norte.b.x);
    expect(norte.depth).toBeCloseTo(8 + 6);
  });

  it('profundidade é a extensão da caixa ao longo do olhar mais 6 m', () => {
    const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
    expect(byName.Norte!.depth).toBeCloseTo(8 + 6);
    expect(byName.Sul!.depth).toBeCloseTo(8 + 6);
    expect(byName.Leste!.depth).toBeCloseTo(10 + 6);
    expect(byName.Oeste!.depth).toBeCloseTo(10 + 6);
  });

  it('a linha cobre a caixa com folga de 3 m em cada ponta', () => {
    const norte = specs[0]!;
    expect(Math.min(norte.a.x, norte.b.x)).toBeCloseTo(BOX.minX - ELEVATION_OFFSET);
    expect(Math.max(norte.a.x, norte.b.x)).toBeCloseTo(BOX.maxX + ELEVATION_OFFSET);
  });
});

describe('elevationCommand', () => {
  const addAll = (views: SectionView[]) => {
    const store = new ProjectStore({ ...createEmptyProject(), views });
    let n = 0;
    store.exec(elevationCommand(store.project.views, BOX, (p) => `${p}_gen${++n}`));
    return store;
  };

  it('cria as quatro elevações em um único passo de desfazer', () => {
    const store = addAll([]);
    expect(store.project.views.map((v) => `${v.kind}:${v.name}`)).toEqual([
      'elevation:Norte',
      'elevation:Sul',
      'elevation:Leste',
      'elevation:Oeste',
    ]);
    store.undo();
    expect(store.project.views).toHaveLength(0);
  });

  it('substitui elevações com o mesmo nome em vez de duplicar, mantendo o id', () => {
    const old: SectionView = { id: 'old_norte', name: 'Norte', kind: 'elevation', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, depth: 2 };
    const corte: SectionView = { id: 'corte_a', name: 'Corte A', kind: 'section', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, depth: 6 };
    const store = addAll([old, corte]);
    expect(store.project.views).toHaveLength(5);
    const norte = store.project.views.find((v) => v.name === 'Norte');
    expect(norte?.id).toBe('old_norte');
    expect(norte?.depth).toBeCloseTo(14);
    expect(store.project.views.find((v) => v.id === 'corte_a')).toBeDefined();
  });

  it('remove duplicatas de elevação com o mesmo nome', () => {
    const dup = (id: string): SectionView => ({ id, name: 'Sul', kind: 'elevation', a: { x: 0, y: 0 }, b: { x: 1, y: 0 }, depth: 2 });
    const store = addAll([dup('s1'), dup('s2')]);
    expect(store.project.views.filter((v) => v.name === 'Sul')).toHaveLength(1);
    expect(store.project.views).toHaveLength(4);
  });
});
