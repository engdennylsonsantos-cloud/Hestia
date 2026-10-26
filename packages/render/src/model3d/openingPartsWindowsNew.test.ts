import { describe, expect, it } from 'vitest';
import { frameOfWall, openingGeometry, type OpeningGeometry } from '@hestia/engine';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { openingPieces, type OpeningPiece } from './openingParts.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
}

function cena(base: string, extra: Partial<OpeningType> = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: base, hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f) };
}

const pecas = (c: Cena, open = false): OpeningPiece[] =>
  openingPieces(c.p, c.o, c.g, frameOfWall(c.p, 'w')!, 2.8, open);

interface Ponto3D {
  x: number;
  y: number;
  z: number;
}

/** Mesma cadeia de transformações que a cena usa (deslocamento e dobradiça). */
function transformar(p: Ponto3D, piece: OpeningPiece): Ponto3D {
  let { x, y, z } = p;
  if (piece.slide) {
    x += piece.slide.dx;
    y += piece.slide.dy;
    z += piece.slide.dz;
  }
  const h = piece.hinge;
  if (!h) return { x, y, z };
  const atS = h.atS ?? 0;
  const cos = Math.cos(h.angle);
  const sin = Math.sin(h.angle);
  if (h.axis === 'z') {
    const dx = x - h.at;
    const dy = y - atS;
    return { x: h.at + dx * cos - dy * sin, y: atS + dx * sin + dy * cos, z };
  }
  const dy = y - atS;
  const dz = z - h.at;
  return { x, y: atS + dy * cos - dz * sin, z: h.at + dy * sin + dz * cos };
}

function caixaDaPeca(piece: OpeningPiece): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        const p = transformar({ x: piece.x + (sx * piece.w) / 2, y: piece.y + (sy * piece.d) / 2, z: piece.z + (sz * piece.h) / 2 }, piece);
        x0 = Math.min(x0, p.x);
        x1 = Math.max(x1, p.x);
        z0 = Math.min(z0, p.z);
        z1 = Math.max(z1, p.z);
      }
    }
  }
  return { x0, x1, z0, z1 };
}

describe('3D das janelas novas', () => {
  it('todas as peças do modelo aparecem nas quatro famílias, fechadas e abertas', () => {
    for (const id of ['ot_ja120', 'ot_jg90', 'ot_jp80', 'ot_jv80']) {
      const c = cena(id);
      const fechada = pecas(c, false);
      expect(fechada.length, id).toBeGreaterThan(5);
      expect(pecas(c, true).length, id).toBe(fechada.length);
    }
  });

  it('janela de abrir: a folha e o vidro têm dobradiça vertical a 90°', () => {
    const c = cena('ot_ja120');
    const abertas = pecas(c, true).filter((x) => x.hinge);
    expect(abertas.length).toBeGreaterThanOrEqual(10);
    for (const p of abertas) {
      expect(p.hinge!.axis).toBe('z');
      expect(Math.abs(p.hinge!.angle)).toBeCloseTo(Math.PI / 2, 9);
    }
  });

  it('guilhotina: a folha de baixo sobe e a de cima não tem movimento', () => {
    const c = cena('ot_jg90');
    const abertas = pecas(c, true);
    const baixo = abertas.filter((x) => (x.slide?.dz ?? 0) > 1e-9);
    expect(baixo.length).toBeGreaterThan(0);
    const travel = (c.g.height - 2 * 0.05) / 2 - 0.02;
    for (const p of baixo) expect(p.slide!.dz).toBeCloseTo(travel, 9);
    const fechadas = pecas(c, false);
    expect(fechadas.every((x) => !x.slide)).toBe(true);
  });

  it('pivotante: todas as peças da folha giram em torno do eixo central', () => {
    const c = cena('ot_jp80');
    const abertas = pecas(c, true).filter((x) => x.hinge);
    expect(abertas.length).toBeGreaterThanOrEqual(5);
    for (const p of abertas) {
      expect(p.hinge!.axis).toBe('z');
      expect(p.hinge!.at).toBeCloseTo(0, 9);
    }
  });

  it('veneziana: cada aleta gira em torno do próprio eixo horizontal a 45°', () => {
    const c = cena('ot_jv80');
    const abertas = pecas(c, true).filter((x) => x.role === 'leafPanel');
    expect(abertas.length).toBeGreaterThan(5);
    for (const p of abertas) {
      expect(p.hinge!.axis).toBe('x');
      expect(Math.abs(p.hinge!.angle)).toBeCloseTo(Math.PI / 4, 9);
      expect(p.hinge!.at).toBeCloseTo(p.z, 9);
    }
  });

  it('veneziana: o ângulo de abertura fica limitado a 70°', () => {
    const c = cena('ot_jv80', { angle3d: 120 });
    const aletas = pecas(c, true).filter((x) => x.role === 'leafPanel');
    expect(aletas.length).toBeGreaterThan(0);
    for (const p of aletas) expect(Math.abs(p.hinge!.angle)).toBeCloseTo((70 * Math.PI) / 180, 9);
  });

  it('nada sai do vão em t e z, fechada ou aberta', () => {
    for (const id of ['ot_ja120', 'ot_jg90', 'ot_jp80', 'ot_jv80']) {
      for (const open of [false, true]) {
        const c = cena(id);
        const hw = c.g.width / 2;
        for (const p of pecas(c, open)) {
          const b = caixaDaPeca(p);
          const caso = `${id}${open ? ' aberta' : ' fechada'} ${p.role}`;
          expect(b.x0, caso).toBeGreaterThanOrEqual(-hw - 1e-9);
          expect(b.x1, caso).toBeLessThanOrEqual(hw + 1e-9);
          expect(b.z0, caso).toBeGreaterThanOrEqual(-1e-9);
          expect(b.z1, caso).toBeLessThanOrEqual(c.g.height + 1e-9);
        }
      }
    }
  });
});
