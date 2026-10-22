import { boxOf, multiPoints, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { resolveFloors, resolveSlabs } from '@hestia/engine';
import { slabRiseAt, type DetailLevel, type Id, type Project } from '@hestia/model';
import type { Viewport } from '../viewport.ts';
import { floorOpsOf, type FloorOps } from './floors.ts';
import { slabOpsOf } from './slabs.ts';
import type { PlanPaint } from './style.ts';
import type { PlanTheme } from './types.ts';

/** Ponto médio do contorno: o centro da caixa envolvente (onde se mede a cota da face superior de pisos e lajes). */
export function contourMid(polygon: MultiPolygon): Vec2 {
  const b = boxOf(multiPoints(polygon));
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** Uma peça de piso ou laje pronta para pintar: as operações dela e o estilo da categoria. */
export interface SurfaceOps {
  ops: FloorOps;
  paint: PlanPaint;
}

/**
 * Pisos e lajes do nível na ordem de pintura da planta (decisão 0023 §3, P6): crescente pela cota da face superior no
 * ponto médio do contorno, então o mais alto desenha por último e não fica escondido atrás de um mais baixo. Empate:
 * a ordem da lista (lajes antes dos pisos, como antes), pois `sort` é estável. As paredes continuam por cima, fora daqui.
 */
export function floorAndSlabOps(
  p: Project,
  levelId: Id,
  theme: PlanTheme,
  dark: boolean,
  detail: DetailLevel,
  v: Viewport,
  hidden: ReadonlySet<Id> | undefined,
  paint: { floor: PlanPaint; slab: PlanPaint },
): SurfaceOps[] {
  const list: Array<SurfaceOps & { top: number }> = [];
  for (const s of resolveSlabs(p, levelId)) {
    if (hidden?.has(s.slabId)) continue;
    const top = s.topZ + slabRiseAt(s.slope, contourMid(s.polygon));
    list.push({ top, ops: slabOpsOf(p, s, theme, dark, detail, v, paint.slab), paint: paint.slab });
  }
  for (const f of resolveFloors(p, levelId)) {
    if (hidden?.has(f.floorId)) continue;
    list.push({ top: f.topZ, ops: floorOpsOf(p, f, theme, dark, detail, v, paint.floor), paint: paint.floor });
  }
  return list.sort((a, b) => a.top - b.top).map(({ ops, paint: pt }) => ({ ops, paint: pt }));
}
