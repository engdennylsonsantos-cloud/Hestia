import { mid, norm, perp, pointInMulti, ringArea, sub, type Vec2 } from '@hestia/geom';
import type { ResolvedRoof, RoofLine } from '@hestia/engine';
import { edgeSlopesOf } from '@hestia/engine/src/roofShapes.ts';
import { isRoof, type Project, type Roof } from '@hestia/model';
import { ARC_TURN_DEG, edgeGroupsOf } from '@hestia/tools/src/roofGeom.ts';

/** Afastamento (m) do ponto médio de uma divisa para testar de que lado está cada água. */
const SIDE = 1e-5;

/** Formas cujas águas saem do esqueleto reto do contorno (as de extrusão e livres têm as suas linhas). */
const SHAPES_DE_CONTORNO = new Set<Roof['shape']>(['hip', 'gable', 'shed', 'edges']);

const degOf = (a: Vec2, b: Vec2): number => (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;

/**
 * Linhas internas de um trecho curvo (arco amostrado em muitos lados): a divisa entre duas águas do mesmo trecho com
 * desvio de direção abaixo de `ARC_TURN_DEG` é só a amostragem do arco (geratriz), não cumeeira nem espigão, e sai do
 * desenho. A divisa entre águas do mesmo trecho com as subidas opostas (a cumeeira que um arco e as retas dele deixam)
 * fica. Devolve o predicado que diz, para cada linha do telhado, se ela é de arco e deve sair.
 */
export function linhaDeArco(p: Project, r: ResolvedRoof): (ln: RoofLine) => boolean {
  const model = p.elements[r.roofId];
  if (!isRoof(model) || !SHAPES_DE_CONTORNO.has(model.shape) || model.boundary.length < 3) return () => false;
  const b = model.boundary;
  const n = b.length;
  const slopes = edgeSlopesOf(model);
  const groups = edgeGroupsOf(b, slopes, model.edgeOverhangs);
  const ccw = ringArea(b) > 0;
  // Trechos de beiral (com água) e o ponto médio de cada lado, empurrado para dentro do contorno.
  const eaves = b.flatMap((a, i) => {
    const s = slopes[i];
    if (s === null || s === undefined || s <= 0) return [];
    const c = b[(i + 1) % n]!;
    const t = norm(sub(c, a));
    const left = perp(t);
    const inward = ccw ? left : { x: -left.x, y: -left.y };
    const m = mid(a, c);
    return [{ group: groups[i] ?? 0, probe: { x: m.x + inward.x * SIDE, y: m.y + inward.y * SIDE } }];
  });
  // Trechos de cada água: os de beiral em que o ponto de dentro do lado cai na água.
  const groupsOfPlane = r.planes.map((pl) => new Set(eaves.filter((e) => pointInMulti(e.probe, pl.polygon)).map((e) => e.group)));
  const planeAt = (q: Vec2): number => r.planes.findIndex((pl) => pointInMulti(q, pl.polygon));

  return (ln) => {
    if (ln.kind !== 'ridge' && ln.kind !== 'hip' && ln.kind !== 'valley') return false;
    const m = mid(ln.a, ln.b);
    const nrm = perp(norm(sub(ln.b, ln.a)));
    const ia = planeAt({ x: m.x + nrm.x * SIDE, y: m.y + nrm.y * SIDE });
    const ib = planeAt({ x: m.x - nrm.x * SIDE, y: m.y - nrm.y * SIDE });
    if (ia < 0 || ib < 0 || ia === ib) return false;
    const shared = [...groupsOfPlane[ia]!].some((g) => groupsOfPlane[ib]!.has(g));
    if (!shared) return false;
    return degOf(r.planes[ia]!.up, r.planes[ib]!.up) < ARC_TURN_DEG;
  };
}
