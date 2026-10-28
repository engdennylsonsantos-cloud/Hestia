import type { Id, OpeningType } from './types.ts';
import type { OpeningOptionSupport } from './openingSupport.ts';

/**
 * Ferragens, folga inferior e soleira da porta (esquadria v3). Leitura com o padrão por campo ausente (como
 * `openingStyle.ts`, sem migração) e validação pura. Só porta: janela ignora tudo isto.
 *
 * O motor escolhe as peças pela família (`openingModelDoors*.ts`); a tabela `openingSupport.ts` diz o que cada família
 * oferece. A validação recebe essa tabela e ignora o campo que a família não usa (sem erro e sem peça).
 */

/** Padrões do modelo (m). */
export const HARDWARE_DEFAULTS = {
  /** Folga inferior: piso seco (NBR 15930-2). */
  leafUndercut: 0.007,
  /** Altura da maçaneta do piso (NBR 9050: 0,80 a 1,10 m). */
  handleHeight: 1,
  /** Eixo da maçaneta a partir da borda livre da folha. */
  handleInset: 0.06,
  /** Dobradiças por folha de giro. */
  hinges: 3,
} as const;

/** Faixas aceitas (erro fora delas) e a faixa da NBR 9050 para a maçaneta (só aviso). */
export const HARDWARE_LIMITS = {
  leafUndercut: { min: 0, max: 0.05 },
  handleHeight: { min: 0.5, max: 1.5 },
  handleInset: { min: 0, max: 0.2 },
  hinges: { min: 0, max: 6 },
  threshold: { min: 0, max: 0.15 },
  nbrHandleHeight: { min: 0.8, max: 1.1 },
} as const;

/** Distância da dobradiça de cima e de baixo até as bordas da folha (m). */
export const HINGE_EDGE = 0.25;

type Faixa = { min: number; max: number };

const dentro = (v: unknown, f: Faixa): v is number => typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max;

/** Folga inferior da folha (m). Ausente, inválida ou janela: padrão (janela devolve 0, porque não tem folha). */
export function openingLeafUndercut(t: Pick<OpeningType, 'kind' | 'leafUndercut'>): number {
  if (t.kind !== 'door') return 0;
  return dentro(t.leafUndercut, HARDWARE_LIMITS.leafUndercut) ? t.leafUndercut : HARDWARE_DEFAULTS.leafUndercut;
}

/** Altura da maçaneta (m, do piso). Ausente ou fora da faixa de erro: padrão 1,00. */
export function openingHandleHeight(t: Pick<OpeningType, 'handleHeight'>): number {
  return dentro(t.handleHeight, HARDWARE_LIMITS.handleHeight) ? t.handleHeight : HARDWARE_DEFAULTS.handleHeight;
}

/** Distância da borda livre ao eixo da maçaneta (m). Ausente ou inválida: padrão 0,06. */
export function openingHandleInset(t: Pick<OpeningType, 'handleInset'>): number {
  return dentro(t.handleInset, HARDWARE_LIMITS.handleInset) ? t.handleInset : HARDWARE_DEFAULTS.handleInset;
}

/** Quantidade de dobradiças (inteiro de 0 a 6). Ausente ou inválida: padrão 3. Janela: 0. */
export function openingHinges(t: Pick<OpeningType, 'kind' | 'hinges'>): number {
  if (t.kind !== 'door') return 0;
  return typeof t.hinges === 'number' && Number.isInteger(t.hinges) && dentro(t.hinges, HARDWARE_LIMITS.hinges) ? t.hinges : HARDWARE_DEFAULTS.hinges;
}

/**
 * Soleira do tipo (espessura em m e material opcional), ou null quando ausente, zerada ou fora da faixa. Só porta. A
 * família que a desenha é decidida pelo motor (`openingSupport.threshold`).
 */
export function openingThreshold(t: Pick<OpeningType, 'kind' | 'threshold'>): { thickness: number; materialId?: Id } | null {
  if (t.kind !== 'door' || !t.threshold) return null;
  const e = t.threshold.thickness;
  if (!dentro(e, HARDWARE_LIMITS.threshold) || e <= 0) return null;
  return t.threshold.materialId !== undefined ? { thickness: e, materialId: t.threshold.materialId } : { thickness: e };
}

/**
 * Altura (m) da face inferior da folha: acima da soleira (quando há) mais a folga inferior. Piso sem soleira: só a folga.
 */
export function openingLeafBottom(t: Pick<OpeningType, 'kind' | 'leafUndercut' | 'threshold'>): number {
  return (openingThreshold(t)?.thickness ?? 0) + openingLeafUndercut(t);
}

/**
 * Alturas das dobradiças (m do piso) entre `z0` e `z1` da folha: a primeira a 0,25 m de `z0`, a última a 0,25 m de `z1`,
 * e as demais espaçadas igualmente. Uma só: no meio.
 */
export function hingeHeights(n: number, z0: number, z1: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [(z0 + z1) / 2];
  const a = z0 + HINGE_EDGE;
  const b = z1 - HINGE_EDGE;
  return Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 1));
}

/** Campos de ferragem e folga conferidos ao salvar. */
export type OpeningHardwareRules = Pick<OpeningType, 'leafUndercut' | 'handleHeight' | 'handleInset' | 'hinges' | 'threshold'>;

/**
 * Erro de ferragem e folga, ou null. Só confere o campo que a família usa (`sup`); campo ausente não é conferido. A
 * maçaneta e a sua altura/recuo dependem de `sup.handle`; dobradiças de `sup.hinges`; soleira de `sup.threshold`.
 */
export function openingHardwareIssue(t: OpeningHardwareRules, sup: OpeningOptionSupport): string | null {
  if (t.leafUndercut !== undefined && sup.leafUndercut && !dentro(t.leafUndercut, HARDWARE_LIMITS.leafUndercut)) {
    return 'Folga inferior: use um valor de 0 a 5 cm.';
  }
  if (t.handleHeight !== undefined && sup.handle && !dentro(t.handleHeight, HARDWARE_LIMITS.handleHeight)) {
    return 'Altura da maçaneta: use um valor de 0,50 a 1,50 m.';
  }
  if (t.handleInset !== undefined && sup.handle && !dentro(t.handleInset, HARDWARE_LIMITS.handleInset)) {
    return 'Distância da maçaneta à borda: use um valor de 0 a 20 cm.';
  }
  if (t.hinges !== undefined && sup.hinges && !(Number.isInteger(t.hinges) && dentro(t.hinges, HARDWARE_LIMITS.hinges))) {
    return 'Dobradiças: use um número inteiro de 0 a 6.';
  }
  if (t.threshold !== undefined && sup.threshold && !dentro(t.threshold?.thickness, HARDWARE_LIMITS.threshold)) {
    return 'Soleira: use uma altura de 0 a 15 cm.';
  }
  return null;
}

/**
 * Aviso (não erro): maçaneta fora da faixa da NBR 9050 (0,80 a 1,10 m). Fora da faixa de erro não avisa (já é erro).
 */
export function openingHardwareWarning(t: Pick<OpeningType, 'handleHeight'>, sup: OpeningOptionSupport): string | null {
  if (!sup.handle || t.handleHeight === undefined || !dentro(t.handleHeight, HARDWARE_LIMITS.handleHeight)) return null;
  if (dentro(t.handleHeight, HARDWARE_LIMITS.nbrHandleHeight)) return null;
  return 'Altura da maçaneta fora da faixa da NBR 9050 (0,80 a 1,10 m): confira a altura.';
}
