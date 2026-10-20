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


/** Quina em encosto (ângulo reto, sem esquadria) onde pelo menos uma parede tem acabamento: a ponta aparece aparada. */
export function butCornerFinishIssues(p: Project, walls: Wall[]): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const ends = (w: Wall): Array<{ pt: Vec2; dir: Vec2; kind: 'a' | 'b'; join: string }> => [
    { pt: w.a, dir: { x: w.b.x - w.a.x, y: w.b.y - w.a.y }, kind: 'a', join: w.joinStart.kind },
    { pt: w.b, dir: { x: w.a.x - w.b.x, y: w.a.y - w.b.y }, kind: 'b', join: w.joinEnd.kind },
  ];
  const finished = (w: Wall): boolean => (p.wallTypes[w.typeId]?.layers ?? []).some((l) => l.function === 'finish1' || l.function === 'finish2' || l.function === 'substrate');
  const seen = new Set<string>();
  for (const a of walls) {
    for (const ea of ends(a)) {
      if (ea.join !== 'butt') continue;
      for (const b of walls) {
        if (b.id === a.id || b.levelId !== a.levelId) continue;
        for (const eb of ends(b)) {
          if (eb.join !== 'butt' || dist(ea.pt, eb.pt) > 1e-6) continue;
          const la = Math.hypot(ea.dir.x, ea.dir.y);
          const lb = Math.hypot(eb.dir.x, eb.dir.y);
          if (la < 1e-9 || lb < 1e-9) continue;
          const cos = (ea.dir.x * eb.dir.x + ea.dir.y * eb.dir.y) / (la * lb);
          if (Math.abs(cos) > 0.34) continue; // fora de 70°–110°
          if (!finished(a) && !finished(b)) continue;
          const key = [a.id, b.id].sort().join('|');
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({
            severity: 'warning',
            code: 'wall-corner-butt-finish',
            message: `Quina entre "${a.mark || a.id}" e "${b.mark || b.id}" em encosto, com acabamento: o núcleo de uma parede pode aparecer na quina e o acabamento da outra fica aparado. Use esquadria (ferramenta Junção, tecla N).`,
            elementId: a.id,
          });
        }
      }
    }
  }
  return out;
}
