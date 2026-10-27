import { arcFromSagitta, arcPointAt, type Vec2 } from '@hestia/geom';
import type { Roof } from '@hestia/model';
import { edgeSlopesOf } from './roofShapes.ts';

/** Ângulo máximo (graus) que um trecho reto cobre ao aproximar um arco do contorno. */
export const ROOF_ARC_STEP_DEG = 7.5;
/** Teto de trechos por arco (um arco de até 180° pede 24; o teto protege contra dados absurdos). */
export const ROOF_ARC_MAX_SEGMENTS = 48;

const hasSag = (r: Roof): boolean => (r.edgeSag ?? []).some((s) => Number.isFinite(s) && Math.abs(s) > 1e-6);

/** Pontos intermediários (sem as pontas) do arco da aresta a→b com flecha `sag`; vazio se a aresta é reta. */
export function roofArcInnerPoints(a: Vec2, b: Vec2, sag: number): Vec2[] {
  const arc = arcFromSagitta(a, b, sag);
  if (!arc) return [];
  const n = Math.max(2, Math.min(ROOF_ARC_MAX_SEGMENTS, Math.ceil((Math.abs(arc.sweep) * 180) / Math.PI / ROOF_ARC_STEP_DEG)));
  const out: Vec2[] = [];
  for (let i = 1; i < n; i++) out.push(arcPointAt(arc, (arc.length * i) / n));
  return out;
}

/**
 * Telhado "para o motor": cada aresta com flecha vira trechos retos (copiando inclinação e balanço da aresta pai) e o
 * resto do cálculo (esqueleto, águas, linhas, 3D, cortes, quantitativos) usa esse contorno. O modelo gravado não muda.
 * Sem flecha devolve o próprio telhado (mesma referência). As formas derivadas ('hip', 'gable', 'shed') são fixadas em
 * 'edges' com as inclinações calculadas no contorno original, para o arco todo herdar a inclinação da aresta pai.
 * Extrusão não expande (o perfil é por aresta).
 */
export function expandRoofArcs(r: Roof): Roof {
  if (!hasSag(r) || r.shape === 'extrusion' || r.boundary.length < 3) return r;
  const n = r.boundary.length;
  const slopes = edgeSlopesOf(r);
  const boundary: Vec2[] = [];
  const edgeSlopes: Array<number | null> = [];
  const edgeOverhangs: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = r.boundary[i]!;
    const b = r.boundary[(i + 1) % n]!;
    const inner = roofArcInnerPoints(a, b, r.edgeSag?.[i] ?? 0);
    boundary.push(a, ...inner);
    for (let k = 0; k <= inner.length; k++) {
      edgeSlopes.push(slopes[i] ?? null);
      edgeOverhangs.push(r.edgeOverhangs[i] ?? 0);
    }
  }
  const { footprint: _fp, edgeSag: _sag, ...rest } = r;
  void _fp;
  void _sag;
  return { ...rest, boundary, edgeSlopes, edgeOverhangs, shape: r.shape === 'free' ? 'free' : 'edges' };
}
