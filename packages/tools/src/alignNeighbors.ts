import { add, dist, type Vec2 } from '@hestia/geom';
import { isWall, type Id, type Project, type Wall } from '@hestia/model';
import { followingEnds } from './pick.ts';

/** Menor comprimento de parede que o alinhamento aceita: abaixo disso a parede some, e o alinhamento é recusado. */
const COMPRIMENTO_MINIMO_ALINHAR = 0.05;

/**
 * Parede vizinha (ligada à parede `id` pela extremidade) que ficaria com comprimento zero, ou menor que 5 cm, se a parede
 * andasse por `k`. Segue o critério do Mover: a vizinha termina no novo ponto da extremidade movida. Null quando nenhuma.
 */
export function vizinhaCurta(p: Project, levelId: Id, id: Id, k: Vec2): Wall | null {
  const w = p.elements[id];
  if (!isWall(w)) return null;
  const exclude = new Set([id]);
  for (const pt of [w.a, w.b]) {
    const to = add(pt, k);
    for (const c of followingEnds(p, levelId, pt, exclude)) {
      const other = p.elements[c.wallId];
      if (!isWall(other)) continue;
      const a = c.end === 'a' ? to : other.a;
      const b = c.end === 'b' ? to : other.b;
      if (dist(a, b) < COMPRIMENTO_MINIMO_ALINHAR) return other;
    }
  }
  return null;
}
