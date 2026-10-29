import { asMulti, minAreaRect, multiPoints, offsetMulti, union, type MultiPolygon } from '@hestia/geom';
import { rampTopLevel, ramps, type Id, type Project, type Ramp } from '@hestia/model';
import type { StairArrivalFrame } from './stairBody.ts';
import { closeWells, trimBeyondTop } from './stairOpenings.ts';
import { resolveRampOne, type ResolvedRamp } from './ramps.ts';

const EPS = 1e-9;

/** Região em planta que a laje/piso de face inferior em `undersideZ` precisa vazar para a rampa passar (modo headroom). */
export function rampHoleRegion(rr: ResolvedRamp, undersideZ: number, headroom: number = rr.type.minHeadroom): MultiPolygon {
  const limit = undersideZ - headroom - EPS;
  const parts = rr.slices.filter((s) => s.z >= limit).map((s): MultiPolygon => [[s.polygon]]);
  return parts.length ? union(...parts) : [];
}

/** Frente da chegada: a borda de fim do último lance e o sentido de subida. Null sem lances. */
export function rampArrivalFrame(rr: ResolvedRamp): StairArrivalFrame | null {
  const last = rr.flights[rr.flights.length - 1];
  if (!last) return null;
  const ux = last.end.x - last.start.x;
  const uy = last.end.y - last.start.y;
  const l = Math.hypot(ux, uy);
  if (!(l > EPS)) return null;
  return { a: last.endEdge[0], b: last.endEdge[1], u: { x: ux / l, y: uy / l }, length: 0.3 };
}

/** Região do furo de uma rampa numa laje/piso: modo, folga lateral e, se pedido, o retângulo de menor área. */
export function rampOpeningRegion(r: Ramp, rr: ResolvedRamp, undersideZ: number): MultiPolygon {
  if (r.openingMode === 'none') return [];
  let region: MultiPolygon = r.openingMode === 'full' ? rr.footprint : rampHoleRegion(rr, undersideZ, r.openingHeadroom ?? rr.type.minHeadroom);
  if (region.length === 0) return [];
  if (r.openingMode === 'headroom') region = closeWells(region);
  if (r.openingMargin > 0) {
    region = offsetMulti(region, r.openingMargin);
    const top = rampArrivalFrame(rr);
    if (top) region = trimBeyondTop(region, top, r.openingMargin + 0.01);
  }
  if (r.openingRect) region = asMulti(minAreaRect(multiPoints(region)));
  return region;
}

/** Rampa com abertura (modo diferente de 'none') cujo nível de topo é o do elemento, já resolvida. */
export interface RampOpening {
  ramp: Ramp;
  resolved: ResolvedRamp;
}

/** Rampas que furam as lajes/pisos do nível: modo ≠ 'none' e nível de topo igual a `levelId`. */
export function rampOpeningsOnLevel(p: Project, levelId: Id): RampOpening[] {
  const candidates = ramps(p).filter((r) => r.openingMode !== 'none' && rampTopLevel(p, r)?.id === levelId);
  if (candidates.length === 0) return [];
  // Só as candidatas do nível de topo são resolvidas (e cada uma uma vez por projeto, pelo memo de `resolveRampOne`).
  return candidates.flatMap((ramp): RampOpening[] => {
    const resolvedRamp = resolveRampOne(p, ramp);
    return resolvedRamp ? [{ ramp, resolved: resolvedRamp }] : [];
  });
}

/** Furo que uma laje/piso de face inferior em `undersideZ` recebe das rampas do nível. */
export function rampHolesFor(openings: RampOpening[], undersideZ: number): MultiPolygon {
  const parts = openings.map((o) => rampOpeningRegion(o.ramp, o.resolved, undersideZ)).filter((region) => region.length > 0);
  return parts.length ? union(...parts) : [];
}
