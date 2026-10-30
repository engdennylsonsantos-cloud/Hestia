import type { Vec2 } from '@hestia/geom';
import { OPENING_DIM_REF_LABELS, WALL_DIM_REF_LABELS, dimensionGeometry, isWallDimRef, type FormatOptions, type OpeningDimRef, type Quantity, type WallDimRef } from '@hestia/model';
import type { DimEnd, DimRef, TempDim } from '@hestia/tools';

/** Formata uma grandeza em SI na unidade do projeto (o mesmo `useFormat()` do overlay). */
export type DimFormatter = (q: Quantity, si: number, o?: FormatOptions) => string;

/** Tamanho de tela fixo da cota: milímetros de papel por pixel (independe do zoom). */
export const PX_PER_MM = 3.78;

export interface GripView {
  slot: string;
  /** Chave de `dimOverrides`: `${provedor}:${ponta}`. */
  overrideKey: string;
  at: Vec2;
  current: DimRef;
  next: DimRef;
  title: string;
}

export interface DimView {
  key: string;
  /** Segmentos em pixels de tela: linha de cota, linhas de chamada e tracinhos. */
  line: [Vec2, Vec2];
  extensions: Array<[Vec2, Vec2]>;
  ticks: Array<[Vec2, Vec2]>;
  textAt: Vec2;
  textRotation: number;
  editable: boolean;
  invalid: boolean;
  grips: GripView[];
}

/** Próxima referência da ponta, em ciclo; referência fora das opções volta à primeira. */
export function nextRef(options: ReadonlyArray<DimRef>, current: DimRef): DimRef {
  const i = options.indexOf(current);
  return options[(i + 1) % options.length] ?? current;
}

/** Nome por extenso da referência, para a dica da alça. */
export function refLabel(ref: DimRef): string {
  return isWallDimRef(ref) ? WALL_DIM_REF_LABELS[ref as WallDimRef] : OPENING_DIM_REF_LABELS[ref as OpeningDimRef];
}

/** O provedor é o primeiro trecho da chave da cota (`${provedor}:${sujeito}:${ponta}`). */
export const providerOf = (dim: TempDim): string => dim.key.split(':')[0] ?? '';

/**
 * Texto mostrado no campo da cota: valor principal e, quando houver, a medida informativa (ex.: "5,00 · 53,1°").
 * Comprimentos vão sem unidade (o campo já pertence à grandeza); ângulos levam o símbolo, que os distingue do número.
 */
export function dimText(dim: TempDim, format: DimFormatter): string {
  const q = dim.quantity ?? 'length';
  const main = format(q, dim.value, q === 'angle' ? { trim: true } : { withUnit: false, trim: true });
  if (!dim.secondary) return main;
  return `${main} · ${format(dim.secondary.quantity, dim.secondary.value, { trim: true })}`;
}

export function gripOf(dim: TempDim, end: DimEnd, toScreen: (p: Vec2) => Vec2): GripView {
  return {
    slot: end.slot,
    overrideKey: `${providerOf(dim)}:${end.slot}`,
    at: toScreen(end.at),
    current: end.current,
    next: nextRef(end.options, end.current),
    title: `Referência: ${refLabel(end.current)} (clique para alternar)`,
  };
}

/** Geometria de tela de uma cota dinâmica; `invalidKey` destaca em vermelho a cota recusada. */
export function viewOfDim(dim: TempDim, toScreen: (p: Vec2) => Vec2, metersPerPixel: number, invalidKey: string | null): DimView {
  const g = dimensionGeometry(dim.a, dim.b, dim.offset, metersPerPixel * PX_PER_MM);
  const seg = ([a, b]: [Vec2, Vec2]): [Vec2, Vec2] => [toScreen(a), toScreen(b)];
  return {
    key: dim.key,
    line: seg(g.line),
    extensions: g.extensions.map(seg),
    ticks: g.ticks.map(seg),
    textAt: toScreen(g.textAt),
    textRotation: g.textRotation,
    editable: dim.edit !== undefined,
    invalid: dim.tone === 'invalid' || invalidKey === dim.key,
    // Ponta com uma só referência não tem o que alternar: sem alça (ela só cobriria as alças de vértice do elemento).
    grips: dim.ends.filter((e) => e.options.length >= 2).map((e) => gripOf(dim, e, toScreen)),
  };
}
