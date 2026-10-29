import { dot } from '@hestia/geom';
import { frameOfWall, pointAt, toLocal, wallPlaneAt, wallPlanes, type WallFrame } from '@hestia/engine';
import { isWall, type Id, type Project, type WallDimRef } from '@hestia/model';

/** Vão entre uma ponta da parede e o plano da parede perpendicular mais próxima, na direção do eixo. */
export interface AxisGap {
  /** Ponta da parede de onde a cota parte. */
  end: 'a' | 'b';
  ownerId: Id;
  /** `t`, na parede cotada, do plano da perpendicular. */
  targetT: number;
  /** Comprimento do vão (sempre maior que zero). */
  distance: number;
}

const EPS = 1e-6;
/** |cos| máximo entre os eixos para a vizinha valer como perpendicular. */
const PERP_TOL = 0.02;

/**
 * Para cada ponta da parede reta `host`, a perpendicular mais próxima que o prolongamento do eixo encontra além da
 * ponta (T, L ou cruz que já encostam na ponta não geram vão). Mede até o plano `ref` da perpendicular voltado para a
 * parede. Nunca devolve o comprimento da própria parede.
 */
export function axisGaps(project: Project, host: WallFrame, ref: WallDimRef): AxisGap[] {
  if (host.arc) return [];
  let a: AxisGap | null = null;
  let b: AxisGap | null = null;
  const origin = pointAt(host, 0, host.sMid);
  for (const e of Object.values(project.elements)) {
    if (!isWall(e) || e.id === host.wall.id || e.levelId !== host.wall.levelId) continue;
    const other = frameOfWall(project, e.id);
    if (!other || other.arc || Math.abs(dot(host.u, other.u)) > PERP_TOL) continue;
    const loc = toLocal(other, origin);
    // O eixo da parede cotada só atinge a perpendicular se passar dentro do seu comprimento.
    if (loc.t < -host.thickness / 2 || loc.t > other.length + host.thickness / 2) continue;
    const k = dot(host.u, other.n);
    const planes = wallPlanes(other);
    // Ponta b olha para +u: a face da perpendicular voltada para a parede está do lado −u (e o inverso na ponta a).
    const tAt = (toward: 1 | -1): number => (wallPlaneAt(planes, ref, toward) - loc.s) / k;
    const tb = tAt(k < 0 ? 1 : -1);
    const ta = tAt(k > 0 ? 1 : -1);
    const beyondB = tb - host.length;
    const beyondA = -ta;
    if (beyondB > EPS && (!b || beyondB < b.distance)) b = { end: 'b', ownerId: e.id, targetT: tb, distance: beyondB };
    if (beyondA > EPS && (!a || beyondA < a.distance)) a = { end: 'a', ownerId: e.id, targetT: ta, distance: beyondA };
  }
  return [a, b].filter((g): g is AxisGap => g !== null);
}
