import { multiArea } from '@hestia/geom';
import type { Id } from '@hestia/model';
import { rampBody, rampPieceVolume } from './rampBody.ts';
import type { ResolvedRamp } from './ramps.ts';

export interface RampQuantities {
  rampId: Id;
  typeId: Id;
  flightCount: number;
  landingCount: number;
  /** Inclinação (fração). */
  slope: number;
  /** Menor largura de lance (m). */
  width: number;
  /** Desnível (m). */
  rise: number;
  flightsLength: number;
  pathLength: number;
  /** Área em planta da rampa (m²). */
  planArea: number;
  /** Área em planta dos lances (m²). */
  flightArea: number;
  /** Área em planta dos patamares (m²). */
  landingArea: number;
  /** Área real da superfície: lances × sqrt(1 + slope²) + patamares (m²). */
  surfaceArea: number;
  volumeFlights: number;
  volumeLandings: number;
  volume: number;
  /** Tudo no material do tipo (m³). */
  volumeByMaterial: Record<Id, number>;
}

const areaOf = (rings: Array<import('@hestia/geom').Ring>): number => rings.reduce((s, ring) => s + multiArea([[ring]]), 0);

/** Quantitativos de uma rampa resolvida. Erro de croqui sai com tudo zero. */
export function rampQuantities(rr: ResolvedRamp): RampQuantities {
  const zero: RampQuantities = {
    rampId: rr.id,
    typeId: rr.typeId,
    flightCount: 0,
    landingCount: 0,
    slope: 0,
    width: 0,
    rise: 0,
    flightsLength: 0,
    pathLength: 0,
    planArea: 0,
    flightArea: 0,
    landingArea: 0,
    surfaceArea: 0,
    volumeFlights: 0,
    volumeLandings: 0,
    volume: 0,
    volumeByMaterial: {},
  };
  if (rr.issues.some((i) => i.severity === 'error')) return zero;

  const flightArea = areaOf(rr.flights.map((f) => f.polygon));
  const landingArea = areaOf(rr.landings.map((l) => l.polygon));
  const slope = rr.slope;
  const width = rr.flights.length ? Math.min(...rr.flights.map((f) => f.width)) : 0;
  const slant = Math.sqrt(1 + slope * slope);
  const surfaceArea = flightArea * slant + landingArea;
  const volumeFlights = flightArea * rr.type.structuralDepth * slant;
  const volumeLandings = landingArea * rr.type.landingThickness;
  const volume = volumeFlights + volumeLandings;

  return {
    rampId: rr.id,
    typeId: rr.typeId,
    flightCount: rr.flights.length,
    landingCount: rr.landings.length,
    slope,
    width,
    rise: rr.rise,
    flightsLength: rr.flightsLength,
    pathLength: rr.pathLength,
    planArea: multiArea(rr.footprint),
    flightArea,
    landingArea,
    surfaceArea,
    volumeFlights,
    volumeLandings,
    volume,
    volumeByMaterial: { [rr.type.materialId]: volume },
  };
}

/** Usado pelo corpo: o volume de uma peça isolada (reexportado para quem já importa daqui). */
export { rampBody, rampPieceVolume };
