import { intersectCurves, toLocal, faceCurve, wallPlaneAt, wallPlanes, type WallFrame } from '@hestia/engine';
import type { Id, Project, WallDimRef } from '@hestia/model';
import { perpendicularNeighbors, type PerpendicularWall } from '../openingPlacement.ts';

/** Alvo de uma cota ao longo do hospedeiro: o `t` do plano escolhido e quem o forma. */
export interface HostTarget {
  /** Posição ao longo do hospedeiro (comprimento de arco nas paredes curvas). */
  t: number;
  /** Parede vizinha dona do plano; `null` quando é a extremidade do hospedeiro. */
  ownerId: Id | null;
  kind: 'wall' | 'end';
}

const TOL = 0.05;

/** `t`, no hospedeiro, do plano `s` da vizinha (reta ou arco). Null se o plano não cruza o eixo do hospedeiro por perto. */
function planeT(host: WallFrame, n: PerpendicularWall, s: number): number | null {
  const hit = intersectCurves(faceCurve(n.frame, s), faceCurve(host, host.sMid), n.point);
  if (!hit) return null;
  const t = toLocal(host, hit).t;
  return Number.isFinite(t) && t >= -TOL && t <= host.length + TOL ? Math.max(0, Math.min(host.length, t)) : null;
}

/**
 * `t` do plano `ref` da vizinha que fica entre ela e a abertura. Para as faces (`finish`, `coreFace`) vale a mais
 * próxima de `t0` do lado de cá; `axis` e `coreCenter` têm um só plano.
 */
function neighborT(host: WallFrame, n: PerpendicularWall, ref: WallDimRef, side: 'left' | 'right'): number | null {
  const planes = wallPlanes(n.frame);
  const ts = [wallPlaneAt(planes, ref, 1), wallPlaneAt(planes, ref, -1)]
    .map((s) => planeT(host, n, s))
    .filter((t): t is number => t !== null);
  if (ts.length === 0) return null;
  return side === 'left' ? Math.max(...ts) : Math.min(...ts);
}

/**
 * Alvos à esquerda e à direita de `t0` para a referência de parede escolhida. A vizinha é qualquer parede que encosta
 * no hospedeiro quase em ângulo reto (T, L ou cruz); sem vizinha de um lado, o alvo é a extremidade do hospedeiro.
 * Em hospedeiro curvo só entram vizinhas cuja interseção cai sobre o arco.
 */
export function hostTargets(project: Project, host: WallFrame, t0: number, ref: WallDimRef): { left: HostTarget; right: HostTarget } {
  let left: HostTarget = { t: 0, ownerId: null, kind: 'end' };
  let right: HostTarget = { t: host.length, ownerId: null, kind: 'end' };
  for (const n of perpendicularNeighbors(project, host.wall.id, host.wall.levelId)) {
    if (n.axisT < t0) {
      const t = neighborT(host, n, ref, 'left');
      if (t !== null && t < t0 && t >= left.t) left = { t, ownerId: n.wallId, kind: 'wall' };
    } else {
      const t = neighborT(host, n, ref, 'right');
      if (t !== null && t > t0 && t <= right.t) right = { t, ownerId: n.wallId, kind: 'wall' };
    }
  }
  return { left, right };
}
