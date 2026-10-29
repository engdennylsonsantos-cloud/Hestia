import { frameOfWall, pointAt, toLocal, wallPlaneAt, wallPlanes, type WallFrame } from '@hestia/engine';
import { isWall, type Project, type WallDimRef } from '@hestia/model';
import { areParallel, nearestParallelGaps, type LocalPlane, type ParallelGap } from '../parallel.ts';

/**
 * Cotas laterais de uma parede reta: a paralela mais próxima de cada lado (sobreposta a ela ao longo do eixo), medida
 * entre os planos da referência `ref` (face acabada, núcleo, eixo...) pela face de cada uma voltada para a outra.
 */
export function wallLateralGaps(project: Project, host: WallFrame, ref: WallDimRef): ParallelGap[] {
  if (host.arc) return [];
  const planes: LocalPlane[] = [];
  const mid = pointAt(host, host.length / 2, host.sMid);
  for (const e of Object.values(project.elements)) {
    if (!isWall(e) || e.id === host.wall.id || e.levelId !== host.wall.levelId) continue;
    const other = frameOfWall(project, e.id);
    if (!other || other.arc || !areParallel(host.a, host.b, other.a, other.b)) continue;
    // A face da vizinha voltada para a hospedeira.
    const towardHost = toLocal(other, mid).s >= other.sMid ? 1 : -1;
    const plane = wallPlaneAt(wallPlanes(other), ref, towardHost);
    const t0 = toLocal(host, pointAt(other, 0, plane));
    const t1 = toLocal(host, pointAt(other, other.length, plane));
    planes.push({ id: e.id, s: t0.s, t0: Math.min(t0.t, t1.t), t1: Math.max(t0.t, t1.t) });
  }
  const planesOfHost = wallPlanes(host);
  return nearestParallelGaps((side) => wallPlaneAt(planesOfHost, ref, side), host.sMid, host.length, planes);
}
