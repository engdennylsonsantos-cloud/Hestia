import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  DEFAULT_OPENING_TYPES,
  makeWall,
  ProjectStore,
  resolveLayout,
  type CompositionNode,
  type Opening,
  type OpeningType,
} from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import type { OpeningModel, OpeningPart } from './openingModelTypes.ts';

/*
 * Catálogo de composições no motor: cada tipo novo (com `composition`) montado numa parede de 0,20 (núcleo 0,09). Confere
 * vão (cobertura = membros + luzes das células), membros sem volume sobreposto e presença de jamb/head e de divisores.
 */

const TOL = 6;
const EPS = 1e-9;
const MEMBROS = ['jamb', 'head', 'sillFrame', 'threshold', 'mullion', 'transom'];
const NOVOS: OpeningType[] = DEFAULT_OPENING_TYPES.filter((t) => t.composition !== undefined);

const ov = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** Modelo do tipo `t` numa parede de 0,20 (mesmas camadas do aceite de composição). */
function montaModelo(t: OpeningType): OpeningModel {
  const s = new ProjectStore(createEmptyProject());
  const alv = s.project.wallTypes['wt_alv14']!;
  const layers = (sub: number) => [
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'structure' as const, materialId: 'mat_bloco14', thickness: 0.09, wraps: false },
    { function: 'substrate' as const, materialId: 'mat_reboco', thickness: sub, wraps: true },
    { function: 'finish2' as const, materialId: 'mat_tinta', thickness: 0.002, wraps: true },
  ];
  s.exec({ type: 'upsertWallType', wallType: { ...alv, id: 'wt_x20', layers: layers(0.053) } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_x20', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: t.id, hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return buildOpeningModel(p, o, openingGeometry(p, o, f), f);
}

const ehMembro = (q: OpeningPart): boolean => MEMBROS.includes(String(q.role));

/** Eixos das divisões da composição (`cols` e/ou `rows`). */
function eixos(n: CompositionNode, acc = new Set<string>()): Set<string> {
  if (n.kind === 'split') {
    acc.add(n.axis);
    for (const c of n.children) eixos(c.node, acc);
  }
  return acc;
}

describe.each(NOVOS.map((t) => [t.code, t] as const))('%s no motor', (_code, t) => {
  const c = t.composition!;
  const L = resolveLayout(c);
  const W = L.span.width;
  const H = L.span.height;
  const m = montaModelo(t);
  const membros = m.parts.filter(ehMembro);

  it('vão do modelo é o da composição', () => {
    expect(m.width).toBeCloseTo(W, TOL);
    expect(m.height).toBeCloseTo(H, TOL);
  });

  it('cobertura: membros + luzes das células somam exatamente o vão, sem sobreposição e dentro do vão', () => {
    const rs = [...membros.map((q) => q.box), ...L.cells.map((x) => x.luz)];
    const soma = rs.reduce((a, r) => a + (r.t1 - r.t0) * (r.z1 - r.z0), 0);
    expect(soma, 'soma das áreas = vão').toBeCloseTo(W * H, TOL);
    rs.forEach((r, i) => {
      expect(r.t0).toBeGreaterThanOrEqual(-W / 2 - EPS);
      expect(r.t1).toBeLessThanOrEqual(W / 2 + EPS);
      expect(r.z0).toBeGreaterThanOrEqual(-EPS);
      expect(r.z1).toBeLessThanOrEqual(H + EPS);
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[j]!;
        expect(ov(r.t0, r.t1, a.t0, a.t1) > EPS && ov(r.z0, r.z1, a.z0, a.z1) > EPS, `sobreposição ${i}×${j}`).toBe(false);
      }
    });
  });

  it('nenhum volume de membro sobreposto a outro', () => {
    for (let i = 0; i < membros.length; i++)
      for (let j = i + 1; j < membros.length; j++) {
        const a = membros[i]!;
        const b = membros[j]!;
        const sobrepoe =
          ov(a.box.t0, a.box.t1, b.box.t0, b.box.t1) > EPS &&
          ov(a.box.s0, a.box.s1, b.box.s0, b.box.s1) > EPS &&
          ov(a.box.z0, a.box.z1, b.box.z0, b.box.z1) > EPS;
        expect(sobrepoe, `${a.id} × ${b.id}`).toBe(false);
      }
  });

  it('presença: jamb-left, jamb-right e head; mullion-* se há divisão em cols; transom-* se há divisão em rows', () => {
    const ids = m.parts.map((q) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['jamb-left', 'jamb-right', 'head']));
    const ax = eixos(c.layout);
    if (ax.has('cols')) expect(ids.some((id) => id.startsWith('mullion-')), 'mullion').toBe(true);
    if (ax.has('rows')) expect(ids.some((id) => id.startsWith('transom-')), 'transom').toBe(true);
  });
});
