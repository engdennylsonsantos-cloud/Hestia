import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  makeWall,
  openingTypeById,
  ProjectStore,
  type DetailLevel,
  type Opening,
  type OpeningType,
  type Project,
} from '@hestia/model';
import type { WallFrame } from './frame.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingPlanPaths } from './openingPlan.ts';
import { openingPlanOptionsOf, openingPlanPathsAt, openingPreviewDetail, openingPreviewStrokes } from './openingPreview.ts';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  f: WallFrame;
  t: OpeningType;
}

/** Parede de 5 m com um vão no meio, do tipo `base` (com `extra` opcional) e um `offset` qualquer. */
function cena(base: string, offset = 2.5, extra: Partial<OpeningType> = {}, typeId = 'wt_alv14'): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 5, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset,
      flipHand: false,
      flipFacing: false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f), f, t: p.openingTypes.ot_x! };
}

const strokes = (c: Cena, detail: DetailLevel = c.p.settings.detail) => openingPreviewStrokes(c.p, c.o, c.f, detail);

/** Forma comparável (pontos com 9 casas) para igualdade entre prévia e planta. */
const forma = (list: ReadonlyArray<{ pts: ReadonlyArray<{ x: number; y: number }>; closed: boolean; dashed: boolean; role: string }>) =>
  list.map((s) => ({
    pts: s.pts.map((q) => `${q.x.toFixed(9)},${q.y.toFixed(9)}`),
    closed: s.closed,
    dashed: s.dashed,
    role: s.role,
  }));

describe('openingPreviewStrokes: a mesma planta que será colocada', () => {
  for (const base of ['ot_pgiro2_120', 'ot_jcomb_fa150x120'] as const) {
    it(`${base}: prévia = planta real do vão colocado`, () => {
      const c = cena(base);
      const t = openingTypeById(c.p, c.o.typeId)!;
      const m = buildOpeningModel(c.p, c.o, c.g, c.f);
      const d = openingPreviewDetail(t, c.p.settings.detail);
      if (d === 'off') throw new Error('detalhe inesperadamente desligado');
      const planta = openingPlanPathsAt(c.g, openingPlanPaths(m, openingPlanOptionsOf(t, m.height, d)));
      expect(forma(strokes(c))).toEqual(
        forma(
          planta.map((s) => ({ pts: s.pts, closed: s.closed, dashed: s.dash !== undefined, role: s.role })),
        ),
      );
    });
  }

  it('deslocar a abertura ao longo da parede só desloca os pontos da prévia', () => {
    for (const base of ['ot_pgiro2_120', 'ot_jcomb_fa150x120'] as const) {
      const a = cena(base, 2.1);
      const b = cena(base, 3.4);
      const pa = strokes(a);
      const pb = strokes(b);
      expect(pb).toHaveLength(pa.length);
      const dx = b.g.u.x * (3.4 - 2.1);
      const dy = b.g.u.y * (3.4 - 2.1);
      for (let i = 0; i < pa.length; i++) {
        expect(pb[i]!.pts).toHaveLength(pa[i]!.pts.length);
        for (let k = 0; k < pa[i]!.pts.length; k++) {
          expect(pb[i]!.pts[k]!.x - pa[i]!.pts[k]!.x).toBeCloseTo(dx, 9);
          expect(pb[i]!.pts[k]!.y - pa[i]!.pts[k]!.y).toBeCloseTo(dy, 9);
        }
      }
    }
  });

  it('porta de duas folhas com bandeira tem mais traços que a simples e traz o batente em volta do vão', () => {
    const simples = cena('ot_p90');
    const composta = cena('ot_pbalcao_band120');
    expect(strokes(composta).length).toBeGreaterThan(strokes(simples).length);
    const papeis = new Set(strokes(composta).map((s) => s.role));
    expect(papeis.has('jamb')).toBe(true);
    expect(papeis.has('leaf')).toBe(true);
  });

  it('detalhe desligado no tipo devolve a prévia vazia', () => {
    const c = cena('ot_p90', 2.5, { detail2d: 'off' });
    expect(strokes(c)).toEqual([]);
  });
});
