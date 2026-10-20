import { add, dist, intersectLines, mul, perp, type Vec2 } from '@hestia/geom';
import type { EndRef, WallEnds } from './joinTypes.ts';
import { both, setEnd } from './joinSides.ts';

const TWO_PI = Math.PI * 2;
const SECTOR_OVERLAP = 2e-5;

/** Largura da banda de uma extremidade medida à esquerda e à direita do sentido "saindo do nó". */
function sideExtents(r: EndRef): { dl: number; dr: number; nl: Vec2 } {
  const nl = perp(r.dir);
  return r.which === 'a' ? { dl: r.f.sHi, dr: -r.f.sLo, nl } : { dl: -r.f.sLo, dr: r.f.sHi, nl };
}

/**
 * Nó de 3+ paredes sem par colinear: cada parede ocupa o setor limitado pelas semirretas que saem do nó
 * e passam pelos cantos onde as faces vizinhas se cruzam. Cada camada é recortada nesse setor.
 */
export function starNode(out: Map<string, WallEnds>, g: EndRef[]): void {
  const refs = [...g].sort((x, y) => Math.atan2(x.dir.y, x.dir.x) - Math.atan2(y.dir.y, y.dir.x));
  const n = refs.length;
  const center = refs[0]!.o;
  const corners: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = refs[i]!;
    const b = refs[(i + 1) % n]!;
    const ea = sideExtents(a);
    const eb = sideExtents(b);
    const pa = add(a.o, mul(ea.nl, ea.dl));
    const pb = add(b.o, mul(eb.nl, -eb.dr));
    const hit = intersectLines(pa, a.dir, pb, b.dir);
    if (!hit) return; // faces paralelas: deixa os cortes retos
    corners.push(hit.point);
  }
  const ext = Math.max(...corners.map((c) => dist(c, center))) * 1.5 + 0.5;
  const far = ext + Math.max(...refs.map((r) => r.f.length)) + 1;
  refs.forEach((r, i) => {
    const prev = corners[(i + n - 1) % n]!;
    const next = corners[i]!;
    // Os setores vizinhos se sobrepõem por δ rad: o pintor recorta a sobra e deixa as bordas exatamente
    // coincidentes (sem frestas numéricas entre as paredes do nó).
    const a0 = Math.atan2(prev.y - center.y, prev.x - center.x) - SECTOR_OVERLAP;
    let sweep = Math.atan2(next.y - center.y, next.x - center.x) - a0 + SECTOR_OVERLAP;
    while (sweep <= 0) sweep += TWO_PI;
    const steps = Math.max(2, Math.ceil(sweep / (Math.PI / 4)));
    const clip: Vec2[] = [center];
    for (let k = 0; k <= steps; k++) {
      const ang = a0 + (sweep * k) / steps;
      clip.push({ x: center.x + Math.cos(ang) * far, y: center.y + Math.sin(ang) * far });
    }
    const t = r.which === 'a' ? -ext : r.f.length + ext;
    setEnd(out, r, { ...both({ kind: 'flat', t }), clip });
  });
}
