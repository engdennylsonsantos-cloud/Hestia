import { dist, type Vec2 } from '@hestia/geom';
import { totalThickness } from './wallType.ts';
import type { ValidationIssue } from './validate.ts';
import type { Project, Wall } from './types.ts';

/** Distância de um ponto ao segmento a–b. */
function distToSegment(pt: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 < 1e-18) return dist(pt, a);
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / l2));
  return dist(pt, { x: a.x + t * dx, y: a.y + t * dy });
}

/**
 * Pontas com "não unir" ligado que caem dentro do corpo de outra parede do mesmo nível: nada recorta a ponta contra
 * a outra, então as duas se sobrepõem (decide só a prioridade das camadas). É o caso típico de junção esquecida
 * desligada. Parede curva usa a corda como aproximação.
 */
export function unjoinedEndIssues(p: Project, walls: Wall[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const w of walls) {
    for (const end of ['a', 'b'] as const) {
      if (!(end === 'a' ? w.noJoinStart : w.noJoinEnd)) continue;
      const pt = end === 'a' ? w.a : w.b;
      for (const o of walls) {
        if (o.id === w.id || o.levelId !== w.levelId) continue;
        const half = (p.wallTypes[o.typeId] ? totalThickness(p.wallTypes[o.typeId]!) : 0.2) / 2;
        if (distToSegment(pt, o.a, o.b) > half) continue;
        out.push({
          severity: 'warning',
          code: 'wall-end-unjoined',
          message: `A ${end === 'a' ? 'ponta inicial' : 'ponta final'} da parede "${w.mark || w.id}" está dentro da parede "${o.mark || o.id}" com a junção desligada: as duas se sobrepõem.`,
          elementId: w.id,
        });
        break;
      }
    }
  }
  return out;
}
