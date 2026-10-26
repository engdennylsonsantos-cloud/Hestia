import { pointInMulti, type Vec2 } from '@hestia/geom';
import { planeZ, type ResolvedRoof } from '@hestia/engine';

/** Afastamento (m) para fora da aresta, para achar a água vizinha que a encosta do outro lado. */
const EPS = 1e-5;
/** Tolerância (m) para a mesma cota nos dois extremos da aresta. */
const TOL = 1e-6;

/**
 * Emenda entre águas do mesmo telhado: a aresta p→q (sentido anti-horário, normal para fora à direita) da água `k` que
 * encosta em outra água com a mesma cota nos dois extremos é interna ao telhado. Sua parede vertical some das faces e, com
 * as arestas da vista ligadas, vira um raio entre facetas (arco amostrado em muitos lados). Degrau de cota continua
 * com parede. Devolve o predicado sobre a aresta.
 */
export function emendaDaAgua(r: ResolvedRoof, k: number): (p: Vec2, q: Vec2) => boolean {
  const pl = r.planes[k]!;
  return (p, q) => {
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    if (L < 1e-9) return false;
    const nx = (q.y - p.y) / L;
    const ny = -(q.x - p.x) / L;
    const m = { x: (p.x + q.x) / 2 + nx * EPS, y: (p.y + q.y) / 2 + ny * EPS };
    const zp = planeZ(pl, p);
    const zq = planeZ(pl, q);
    return r.planes.some((o, j) => j !== k && Math.abs(planeZ(o, p) - zp) < TOL && Math.abs(planeZ(o, q) - zq) < TOL && pointInMulti(m, o.polygon));
  };
}
