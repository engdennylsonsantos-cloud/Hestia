import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import { buildOpeningModel } from './openingModel.ts';
import { partTransformed } from './openingModelTransforms.ts';
import type { OpeningModel, OpeningPart } from './openingModelTypes.ts';

/* Alizar x folha aberta: o alizar da face em que a folha abre não é atravessado por ela de 0° a 90° (verticais do alizar). */
// Folhas que giram em torno de um eixo vertical: porta de giro, dupla e janela de abrir (camarão e maxim-ar não entram).
const TIPOS = ['ot_p90', 'ot_pgiro100', 'ot_pgiro2_160', 'ot_ja120', 'ot_jab2_150x120'];
const COM_ALIZAR = { casing: { width: 0.07, thickness: 0.015, sides: 'both' as const } };

function modelo(base: OpeningType, flipHand: boolean, flipFacing: boolean, alizar: boolean): OpeningModel {
  const t: OpeningType = { ...base, id: 'ot_c', ...(alizar ? COM_ALIZAR : {}) };
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertOpeningType', openingType: t });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 8, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'v', kind: base.kind, typeId: 'ot_c', hostId: 'w', offset: 4, flipHand, flipFacing, sillOverride: null, mark: '' } });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return buildOpeningModel(p, o, openingGeometry(p, o, f), f);
}

/** Penetração (m) de um polígono convexo (cantos t,s) numa caixa alinhada, por SAT; ≤ 0 = sem sobreposição. */
function penetracao(poly: Array<{ t: number; s: number }>, b: { t0: number; t1: number; s0: number; s1: number }): number {
  const eixos: Array<[number, number]> = [[1, 0], [0, 1]];
  for (let i = 0; i < 2; i++) {
    const a = poly[i]!;
    const c = poly[i + 1]!;
    const nx = -(c.s - a.s);
    const ny = c.t - a.t;
    const n = Math.hypot(nx, ny) || 1;
    eixos.push([nx / n, ny / n]);
  }
  const rect = [[b.t0, b.s0], [b.t1, b.s0], [b.t1, b.s1], [b.t0, b.s1]] as Array<[number, number]>;
  let min = Infinity;
  for (const [ax, ay] of eixos) {
    const pa = poly.map((q) => q.t * ax + q.s * ay);
    const pb = rect.map(([x, y]) => x * ax + y * ay);
    min = Math.min(min, Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)));
  }
  return min;
}

describe('alizar recua da folha aberta (lado da dobradiça, face em que a folha abre)', () => {
  for (const id of TIPOS) {
    const base = DEFAULT_OPENING_TYPES.find((t) => t.id === id);
    if (!base) continue;
    for (const [fh, ff] of [[false, false], [true, true], [false, true], [true, false]] as const) {
      it(`${id} (flipHand=${fh}, flipFacing=${ff}): nenhuma folha atravessa os verticais do alizar de 0° a 90°`, () => {
        const m = modelo(base, fh, ff, true);
        const barras = m.parts.filter((p) => p.role === 'casing' && /casing-(left|right)-/.test(p.id));
        expect(barras.length).toBeGreaterThanOrEqual(4);
        const folhas = m.parts.filter((p) => p.role === 'leaf' && p.motion?.kind === 'rotate' && p.motion.axis === 'z');
        expect(folhas.length).toBeGreaterThan(0);
        for (let g = 0; g <= 90; g += 3) {
          for (const f of folhas) {
            const o = partTransformed(f as OpeningPart, { angle: (g * Math.PI) / 180, slide: 0 });
            for (const k of barras) {
              if (o.bounds.z1 <= k.box.z0 || o.bounds.z0 >= k.box.z1) continue;
              expect(penetracao(o.corners.slice(0, 4), k.box), `${id} ${f.id} ${g}° x ${k.id}`).toBeLessThanOrEqual(1e-9);
            }
          }
        }
      });
    }
  }

  it('porta de giro: na face de abertura os dois verticais começam fora do rebaixo (11 mm da borda da folha + margem)', () => {
    const base = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_p90')!;
    const m = modelo(base, false, false, true);
    const luz = Math.min(...m.parts.filter((p) => p.role === 'jamb').map((p) => Math.abs(p.box.t0 < 0 ? p.box.t1 : p.box.t0)));
    const dist = (face: 'a' | 'b') =>
      m.parts
        .filter((p) => p.role === 'casing' && new RegExp(`casing-(left|right)-${face}$`).test(p.id))
        .map((p) => (p.id.includes('left') ? -p.box.t1 : p.box.t0) - luz);
    // Uma das faces é a de abertura (recuada 14 mm); a outra segue alinhada à face interna do batente.
    const recuos = [...dist('a'), ...dist('b')].sort((x, y) => x - y);
    expect(recuos.slice(0, 2).every((d) => Math.abs(d) < 1e-6)).toBe(true);
    expect(recuos.slice(2).every((d) => d > 0.011 && d < 0.02)).toBe(true);
  });

  it('sem alizar nada muda e janela de correr (folha não gira) não recua', () => {
    const j = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_j120');
    if (!j) return;
    const m = modelo(j, false, false, true);
    const luz = Math.min(...m.parts.filter((p) => p.role === 'jamb').map((p) => Math.abs(p.box.t0 < 0 ? p.box.t1 : p.box.t0)));
    for (const p of m.parts.filter((q) => q.role === 'casing' && /casing-(left|right)-/.test(q.id))) {
      expect((p.id.includes('left') ? -p.box.t1 : p.box.t0) - luz).toBeCloseTo(0, 6);
    }
  });
});
