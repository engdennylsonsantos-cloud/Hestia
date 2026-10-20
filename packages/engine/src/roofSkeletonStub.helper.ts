import { dot, ringArea, sub, type Ring, type SkeletonInput, type SkeletonResult, type Vec2 } from '@hestia/geom';
import { clipHalfPlane, perpOf, unitOf } from './roofGeom.ts';

/**
 * Esqueleto de TESTE (só os testes unitários do motor usam; o cálculo de verdade é o de @hestia/geom). Domínio: contorno
 * convexo anti-horário, sem furos, com as arestas que definem todas com a mesma inclinação. Nesse domínio a água de cada
 * aresta é a região onde ela é a mais próxima entre as que definem (d_i ≤ d_j), que é o esqueleto reto. Fora dele,
 * devolve ok:false, para o teste ver o motivo e não um resultado falso.
 */
export function stubSkeleton(input: SkeletonInput): SkeletonResult {
  const fail = (reason: string): SkeletonResult => ({ faces: [], arcs: [], ok: false, reason });
  const ring: Ring = input.outer;
  if (input.holes.length) return fail('stub sem furos');
  if (ringArea(ring) <= 0) return fail('stub espera contorno anti-horário');
  if (!isConvex(ring)) return fail('stub só convexo');
  const w = input.weights[0]!;
  const defining = w.flatMap((x, i) => (x > 0 ? [i] : []));
  if (new Set(defining.map((i) => w[i])).size > 1) return fail('stub: pesos diferentes');
  const n = ring.length;
  const normal = (i: number): { a: Vec2; nrm: Vec2 } => ({ a: ring[i]!, nrm: perpOf(unitOf(sub(ring[(i + 1) % n]!, ring[i]!))!) });
  const faces = defining.map((i) => {
    const ni = normal(i);
    let poly: Ring = ring;
    for (const j of defining) {
      if (j === i) continue;
      const nj = normal(j);
      // d_i(p) ≤ d_j(p): dot(p, n_i − n_j) ≤ dot(a_i, n_i) − dot(a_j, n_j).
      poly = clipHalfPlane(poly, ni.nrm.x - nj.nrm.x, ni.nrm.y - nj.nrm.y, dot(ni.a, ni.nrm) - dot(nj.a, nj.nrm));
    }
    return { ring: 0, edge: i, polygon: poly, z: [] };
  });
  return { faces: faces.filter((f) => f.polygon.length >= 3), arcs: [], ok: true };
}

/** Contorno convexo (curvas para o mesmo lado, sem vértices de reflexo). */
function isConvex(r: Ring): boolean {
  const n = r.length;
  for (let i = 0; i < n; i++) {
    const ab = sub(r[(i + 1) % n]!, r[i]!);
    const bc = sub(r[(i + 2) % n]!, r[(i + 1) % n]!);
    if (ab.x * bc.y - ab.y * bc.x < -1e-12) return false;
  }
  return true;
}
