import { mid, norm, perp, pointInMulti, ringArea, sub, type Vec2 } from '@hestia/geom';
import { expandRoofArcs, type ResolvedRoof, type RoofLine } from '@hestia/engine';
import { edgeSlopesOf } from '@hestia/engine/src/roofShapes.ts';
import { isRoof, type Project, type Roof } from '@hestia/model';
import { ARC_TURN_DEG, edgeGroupsOf } from '@hestia/tools/src/roofGeom.ts';

/** Afastamento (m) do ponto médio de uma divisa para testar de que lado está cada água. */
const SIDE = 1e-5;

/** Formas cujas águas saem do esqueleto reto do contorno (as de extrusão e livres têm as suas linhas). */
const SHAPES_DE_CONTORNO = new Set<Roof['shape']>(['hip', 'gable', 'shed', 'edges']);

const degOf = (a: Vec2, b: Vec2): number => (Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y))) * 180) / Math.PI;

/** Lado do contorno que define inclinação (beiral com água). */
const beiralDe = (slopes: Array<number | null>, i: number): boolean => {
  const s = slopes[i];
  return s !== null && s !== undefined && s > 0;
};

/**
 * Lados do contorno que levam símbolo próprio (triângulo "define inclinação" e, na planta, seta e percentual): todos,
 * exceto os lados de um trecho curvo (arco amostrado em muitos lados, `edgeGroupsOf`) que não são o do meio do trecho.
 * O trecho curvo tem um símbolo só, no meio, e não um por lado amostrado.
 */
export function ladosComSimbolo(roof: Roof): boolean[] {
  const n = roof.boundary.length;
  if (!SHAPES_DE_CONTORNO.has(roof.shape) || n < 3) return roof.boundary.map(() => true);
  const slopes = edgeSlopesOf(roof);
  const groups = edgeGroupsOf(roof.boundary, slopes, roof.edgeOverhangs);
  const byGroup = new Map<number, number[]>();
  slopes.forEach((_, i) => {
    if (!beiralDe(slopes, i)) return;
    byGroup.set(groups[i] ?? 0, [...(byGroup.get(groups[i] ?? 0) ?? []), i]);
  });
  return roof.boundary.map((_, i) => {
    if (!beiralDe(slopes, i)) return true;
    const trecho = byGroup.get(groups[i] ?? 0) ?? [i];
    return trecho.length < 2 || trecho[Math.floor(trecho.length / 2)] === i;
  });
}

/**
 * Leitura dos trechos curvos de um telhado para o desenho na planta. `deArco`: a linha é divisa entre facetas do mesmo
 * trecho com desvio de direção abaixo de `ARC_TURN_DEG` (geratriz da amostragem, não cumeeira nem espigão), e sai.
 * `comSinal`: a água leva seta e percentual (uma por trecho curvo, na faceta do meio). Sem o projeto (testes e águas
 * soltas), tudo sai como antes.
 */
export function arcoDoTelhado(p: Project, r: ResolvedRoof): { deArco: (ln: RoofLine) => boolean; comSinal: (k: number) => boolean } {
  const raw = p.elements[r.roofId];
  // Arcos gravados como flecha: as águas vêm do contorno subdividido pelo motor, então os trechos também.
  const model = isRoof(raw) ? expandRoofArcs(raw) : raw;
  const padrao = { deArco: (): boolean => false, comSinal: (): boolean => true };
  if (!isRoof(model) || !SHAPES_DE_CONTORNO.has(model.shape) || model.boundary.length < 3) return padrao;
  const b = model.boundary;
  const n = b.length;
  const slopes = edgeSlopesOf(model);
  const groups = edgeGroupsOf(b, slopes, model.edgeOverhangs);
  const visivel = ladosComSimbolo(model);
  const ccw = ringArea(b) > 0;
  // Cada lado de beiral: o ponto um pouco para dentro do contorno (acha a água que o encosta) e o trecho a que pertence.
  const eaves = b.flatMap((a, i) => {
    if (!beiralDe(slopes, i)) return [];
    const c = b[(i + 1) % n]!;
    const left = perp(norm(sub(c, a)));
    const inward = ccw ? left : { x: -left.x, y: -left.y };
    const m = mid(a, c);
    return [{ i, group: groups[i] ?? 0, probe: { x: m.x + inward.x * SIDE, y: m.y + inward.y * SIDE } }];
  });
  const planeAt = (q: Vec2): number => r.planes.findIndex((pl) => pointInMulti(q, pl.polygon));
  // Trechos de cada água (pelos lados de beiral que ela encosta).
  const groupsOfPlane = r.planes.map((pl) => new Set(eaves.filter((e) => pointInMulti(e.probe, pl.polygon)).map((e) => e.group)));
  const comSinal = new Set<number>();
  for (const e of eaves) {
    if (!visivel[e.i]) continue;
    const k = planeAt(e.probe);
    if (k >= 0) comSinal.add(k);
  }

  const deArco = (ln: RoofLine): boolean => {
    if (ln.kind !== 'ridge' && ln.kind !== 'hip' && ln.kind !== 'valley') return false;
    const m = mid(ln.a, ln.b);
    const nrm = perp(norm(sub(ln.b, ln.a)));
    const ia = planeAt({ x: m.x + nrm.x * SIDE, y: m.y + nrm.y * SIDE });
    const ib = planeAt({ x: m.x - nrm.x * SIDE, y: m.y - nrm.y * SIDE });
    if (ia < 0 || ib < 0 || ia === ib) return false;
    if (![...groupsOfPlane[ia]!].some((g) => groupsOfPlane[ib]!.has(g))) return false;
    return degOf(r.planes[ia]!.up, r.planes[ib]!.up) < ARC_TURN_DEG;
  };
  return { deArco, comSinal: (k) => comSinal.has(k) };
}
