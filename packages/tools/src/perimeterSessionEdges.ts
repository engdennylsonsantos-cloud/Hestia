import { equal, type SketchLoop, type SketchSeg, type Vec2 } from '@hestia/geom';

const touches = (s: SketchSeg, p: Vec2): boolean => equal(s.a, p) || equal(s.b, p);

/**
 * Um seg por lado do anel do laço, na ordem do anel. Os vértices do anel que são pontas de linha
 * marcam os cantos; entre dois cantos consecutivos os lados pertencem à mesma linha (arco amostrado).
 */
export function sideSegs(loop: SketchLoop): SketchSeg[] {
  const ring = loop.ring;
  const n = ring.length;
  const corners: number[] = [];
  for (let i = 0; i < n; i++) if (loop.segs.some((s) => touches(s, ring[i]!))) corners.push(i);
  if (corners.length < 2) return loop.segs.slice();

  const out: SketchSeg[] = [];
  corners.forEach((i, k) => {
    const j = corners[(k + 1) % corners.length]!;
    const p = ring[i]!;
    const q = ring[j]!;
    const seg =
      loop.segs.find((s) => (equal(s.a, p) && equal(s.b, q)) || (equal(s.a, q) && equal(s.b, p))) ??
      loop.segs.find((s) => touches(s, p))!;
    const count = ((((j - i) % n) + n) % n) || n;
    for (let c = 0; c < count; c++) out.push(seg);
  });
  return out;
}
