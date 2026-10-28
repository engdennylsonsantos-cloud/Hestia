import type { OpeningType } from '@hestia/model';
import { withOpeningField } from './openingTypeFields.ts';

/** Recuo do batente (m): zero tira o campo, que volta ao padrão por leitura (0). Preserva a âncora. */
export function setRevealDepth(t: OpeningType, depth: number): OpeningType {
  const next: OpeningType = { ...t };
  if (depth <= 0) delete next.reveal;
  else next.reveal = { ...t.reveal, depth };
  return next;
}

/** Soleira: sem peça, plana (2 cm) ou degrau (3 cm). O schema não guarda o tipo; a espessura é o que o distingue. */
export type OpeningThresholdKind = 'none' | 'flat' | 'step';
export const THRESHOLD_KINDS = [
  ['none', 'Nenhuma'],
  ['flat', 'Plana'],
  ['step', 'Degrau'],
] as const;
export const THRESHOLD_THICKNESS = { flat: 0.02, step: 0.03 } as const;

/** Tipo da soleira lido da espessura: degrau a partir de 3 cm; abaixo disso, plana. */
export function thresholdKind(t: Pick<OpeningType, 'threshold'>): OpeningThresholdKind {
  if (!t.threshold) return 'none';
  return t.threshold.thickness >= THRESHOLD_THICKNESS.step ? 'step' : 'flat';
}

const soleira = (t: Pick<OpeningType, 'threshold'>, thickness: number): OpeningType['threshold'] =>
  t.threshold?.materialId === undefined ? { thickness } : { thickness, materialId: t.threshold.materialId };

/** Troca o tipo da soleira; "Nenhuma" tira o campo e o material é preservado ao religar. */
export function setThresholdKind(t: OpeningType, kind: OpeningThresholdKind): OpeningType {
  const next: OpeningType = { ...t };
  if (kind === 'none') delete next.threshold;
  else next.threshold = soleira(t, THRESHOLD_THICKNESS[kind]);
  return next;
}

/** Altura (espessura) da soleira; o material existente é preservado. */
export function setThresholdThickness(t: OpeningType, thickness: number): OpeningType {
  return { ...t, threshold: soleira(t, thickness) };
}

/** Eixo da basculante como fração da altura: 0,5 (central) tira o campo; o excêntrico grava o valor. */
export function setTiltAxis(t: OpeningType, axis: number): OpeningType {
  return withOpeningField(t, 'tiltAxis', axis, 0.5);
}
