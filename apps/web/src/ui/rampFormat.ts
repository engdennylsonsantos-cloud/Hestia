import type { RampQuantities, ResolvedRamp } from '@hestia/engine';
import { formatRampSlope } from '@hestia/model';

/** Fração (0,0833) → campo em % (8,33). A inclinação é guardada como fração; a interface edita em %. */
export const slopeToPercentField = (s: number): number => s * 100;

/** Campo em % (8,33) → fração (0,0833). */
export const percentFieldToSlope = (v: number): number => v / 100;

const fmt = (n: number): string => n.toFixed(2).replace('.', ',');

export interface RampSummaryLine {
  label: string;
  value: string;
}

/** Linhas só leitura dos resultados da rampa (painel de propriedades e diálogos), em pt-BR. */
export function rampSummaryLines(rr: ResolvedRamp, q: RampQuantities): RampSummaryLine[] {
  return [
    { label: 'Desnível', value: `${fmt(rr.rise)} m` },
    { label: 'Inclinação', value: formatRampSlope(rr.slope) },
    { label: 'Lances', value: String(q.flightCount) },
    { label: 'Patamares', value: String(q.landingCount) },
    { label: 'Comprimento do percurso', value: `${fmt(rr.pathLength)} m` },
    { label: 'Área', value: `${fmt(q.planArea)} m²` },
    { label: 'Volume', value: `${fmt(q.volume)} m³` },
  ];
}
