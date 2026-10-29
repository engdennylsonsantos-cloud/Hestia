import { isWall, type Id, type Project, type Wall } from '@hestia/model';
import type { IfcPoint, IfcPolygon, IfcWallGeo } from './ifcTypes.ts';

const EPS = 1e-9;

export function wallAxis(w: Wall): IfcPoint | null {
  const dx = w.b.x - w.a.x;
  const dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy);
  return len > EPS ? { x: dx / len, y: dy / len } : null;
}

/** Normal externa em planta: lado esquerdo de a→b, invertido por `flipped` (docs/05 §3). */
export function outwardNormal(w: Wall, u: IfcPoint): IfcPoint {
  const s = w.flipped ? -1 : 1;
  return { x: -u.y * s, y: u.x * s };
}

/** Se o raio `p + t·d` (t > 0) cruza o anel fechado `ring` (interseção reta × aresta, sem contar o vértice final). */
function rayHitsRing(p: IfcPoint, d: IfcPoint, ring: readonly IfcPoint[]): boolean {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const rx = b.x - a.x;
    const ry = b.y - a.y;
    const den = d.x * ry - d.y * rx;
    if (Math.abs(den) < 1e-12) continue;
    const qx = a.x - p.x;
    const qy = a.y - p.y;
    const t = (qx * ry - qy * rx) / den;
    const s = (qx * d.y - qy * d.x) / den;
    if (t > 1e-9 && s >= -1e-9 && s < 1 - 1e-9) return true;
  }
  return false;
}

/**
 * Paredes externas: a face externa (lado esquerdo de a→b, invertido por `flipped`) é a que dá para fora. A parede é
 * externa quando, em pelo menos uma amostra do vão, o raio para fora não encontra outra parede do mesmo nível — fachada
 * dá para o vazio e divisória tem outra parede à frente. O modelo não guarda "interno/externo" e o io não importa o
 * motor, então a classificação é geométrica, sem depender do nome do tipo.
 */
export function externalWalls(p: Project, walls: readonly IfcWallGeo[]): Set<Id> {
  const byLevel = new Map<Id, Array<{ wallId: Id; rings: IfcPolygon[] }>>();
  for (const g of walls) {
    const w = p.elements[g.wallId];
    if (!isWall(w)) continue;
    const bucket = byLevel.get(w.levelId) ?? [];
    bucket.push({ wallId: g.wallId, rings: g.footprints });
    byLevel.set(w.levelId, bucket);
  }
  const out = new Set<Id>();
  for (const g of walls) {
    const w = p.elements[g.wallId];
    const u = isWall(w) ? wallAxis(w) : null;
    if (!isWall(w) || !u || g.footprints.length === 0) continue;
    const n = outwardNormal(w, u);
    // Maior afastamento da face externa em relação ao eixo: o ponto de amostra fica 1 mm além dele.
    let reach = 0;
    for (const footprint of g.footprints) for (const ring of footprint) for (const v of ring) {
      reach = Math.max(reach, (v.x - w.a.x) * n.x + (v.y - w.a.y) * n.y);
    }
    const others = (byLevel.get(w.levelId) ?? []).filter((o) => o.wallId !== g.wallId);
    for (const f of [0.25, 0.5, 0.75]) {
      const start: IfcPoint = {
        x: w.a.x + (w.b.x - w.a.x) * f + n.x * (reach + 0.001),
        y: w.a.y + (w.b.y - w.a.y) * f + n.y * (reach + 0.001),
      };
      if (!others.some((o) => o.rings.some((footprint) => footprint.some((ring) => rayHitsRing(start, n, ring))))) {
        out.add(g.wallId);
        break;
      }
    }
  }
  return out;
}

/**
 * `IFCMATERIALLAYERSET` do tipo de parede, criado uma vez por tipo. As camadas saem na ordem do modelo (face externa →
 * interna), com material, espessura e nome; camada de espessura zero (membrana) não entra no conjunto.
 */
