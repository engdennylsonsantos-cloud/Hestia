import type { OpeningType } from './types.ts';

/**
 * Acabamentos e vão bruto do tipo de abertura. Todos os campos são opcionais no `OpeningType`; aqui ficam o padrão por
 * leitura e a validação, no mesmo modelo do `openingFrame` (arquivos antigos não mudam de aparência).
 */

/** Vão bruto (furo na parede): dimensões do tipo mais a folga de assentamento. Só o furo cresce; a esquadria não. */
export interface OpeningRough {
  width: number;
  height: number;
}

/** Alizar: largura vista e espessura saliente da face da parede (m). */
export interface OpeningCasing {
  width: number;
  thickness: number;
}

/** Peitoril saliente: projeção além de cada face da parede e espessura da peça (m). */
export interface OpeningSillBoard {
  projection: number;
  thickness: number;
}

/** Verga ou contraverga: transpasse para cada lado do vão e altura da peça (m). */
export interface OpeningLintel {
  over: number;
  height: number;
}

/** Transpasse padrão da verga e da contraverga, para cada lado (m). A altura padrão é a do pedido do projeto. */
export const OPENING_LINTEL_DEFAULTS = { over: 0.3, height: 0.2 } as const;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const nonNeg = (v: unknown): number => Math.max(0, num(v));
const positive = (v: unknown): number => Math.max(0, num(v));
const defaulted = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

/** Vão bruto do tipo (m): largura e altura do tipo mais `roughOversize`. Ausente ou inválido vale 0. */
export function openingRough(t: Pick<OpeningType, 'width' | 'height' | 'roughOversize'>): OpeningRough {
  return { width: t.width + nonNeg(t.roughOversize?.w), height: t.height + nonNeg(t.roughOversize?.h) };
}

/** Alizar do tipo, ou null quando ausente/zerado (o padrão é não desenhar). */
export function openingCasing(t: Pick<OpeningType, 'casing'>): OpeningCasing | null {
  const c = t.casing;
  if (!c) return null;
  const width = positive(c.width);
  const thickness = positive(c.thickness);
  return width > 0 && thickness > 0 ? { width, thickness } : null;
}

/** Peitoril saliente do tipo, ou null quando ausente/zerado. Só vale para janela. */
export function openingSillBoard(t: Pick<OpeningType, 'kind' | 'sillBoard'>): OpeningSillBoard | null {
  if (t.kind !== 'window') return null;
  const s = t.sillBoard;
  if (!s) return null;
  const projection = positive(s.projection);
  const thickness = positive(s.thickness);
  return projection > 0 && thickness > 0 ? { projection, thickness } : null;
}

/** Verga do tipo, ou null quando o campo está ausente. Presente sem valores usa o transpasse e a altura padrão. */
export function openingLintel(t: Pick<OpeningType, 'lintel'>): OpeningLintel | null {
  if (!t.lintel) return null;
  return {
    over: defaulted(t.lintel.over, OPENING_LINTEL_DEFAULTS.over),
    height: defaulted(t.lintel.height, OPENING_LINTEL_DEFAULTS.height),
  };
}

/** Contraverga do tipo, ou null quando o campo está ausente. Presente sem valores usa o transpasse e a altura padrão. */
export function openingSillBeam(t: Pick<OpeningType, 'sillBeam'>): OpeningLintel | null {
  if (!t.sillBeam) return null;
  return {
    over: defaulted(t.sillBeam.over, OPENING_LINTEL_DEFAULTS.over),
    height: defaulted(t.sillBeam.height, OPENING_LINTEL_DEFAULTS.height),
  };
}

/** Limites razoáveis do acabamento (m): acima deles o tipo é recusado ao salvar (`acabamentoIssue`). */
export const ACABAMENTO_LIMITES = {
  folga: 0.2,
  alizarLargura: 0.3,
  alizarEspessura: 0.05,
  soleiraProjecao: 0.1,
  soleiraEspessura: 0.05,
  transpasse: 1,
  alturaVerga: 0.6,
} as const;

/** Campos de acabamento do tipo (os de `OpeningType`, todos opcionais). */
export type OpeningAcabamento = Pick<OpeningType, 'roughOversize' | 'casing' | 'sillBoard' | 'lintel' | 'sillBeam'>;

/**
 * Confere as medidas do acabamento: cada uma tem de ser finita, ≥ 0 e até o limite. Devolve a 1ª mensagem, ou null.
 * Campo ausente não é conferido (vale o padrão por leitura); zero é válido e equivale a não desenhar a peça.
 */
export function acabamentoIssue(t: OpeningAcabamento): string | null {
  const faixa = (campo: string, v: number | undefined, max: number): string | null =>
    v === undefined || (Number.isFinite(v) && v >= 0 && v <= max) ? null : `${campo}: use um valor de 0 a ${Math.round(max * 100)} cm.`;
  return (
    faixa('Folga do vão, largura', t.roughOversize?.w, ACABAMENTO_LIMITES.folga) ??
    faixa('Folga do vão, altura', t.roughOversize?.h, ACABAMENTO_LIMITES.folga) ??
    faixa('Alizar, largura', t.casing?.width, ACABAMENTO_LIMITES.alizarLargura) ??
    faixa('Alizar, espessura', t.casing?.thickness, ACABAMENTO_LIMITES.alizarEspessura) ??
    faixa('Soleira, projeção', t.sillBoard?.projection, ACABAMENTO_LIMITES.soleiraProjecao) ??
    faixa('Soleira, espessura', t.sillBoard?.thickness, ACABAMENTO_LIMITES.soleiraEspessura) ??
    faixa('Verga, transpasse', t.lintel?.over, ACABAMENTO_LIMITES.transpasse) ??
    faixa('Verga, altura', t.lintel?.height, ACABAMENTO_LIMITES.alturaVerga) ??
    faixa('Contraverga, transpasse', t.sillBeam?.over, ACABAMENTO_LIMITES.transpasse) ??
    faixa('Contraverga, altura', t.sillBeam?.height, ACABAMENTO_LIMITES.alturaVerga)
  );
}
