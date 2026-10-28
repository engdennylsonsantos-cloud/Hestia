import {
  defaultUnits,
  formatQuantity,
  resolveUnits,
  type Quantity,
  type QuantityFormat,
  type QuantityUnit,
  type ResolvedUnits,
  type UnitsSettings,
} from '@hestia/model';

/** Linhas da tabela do diálogo, na ordem do plano. */
export const QUANTITY_KEYS = ['length', 'smallLength', 'area', 'volume', 'angle', 'slope'] as const;
export type QuantityKey = (typeof QUANTITY_KEYS)[number];

export type DraftFormat<U extends string> = Required<QuantityFormat<U>>;

export interface UnitsDraft {
  length: DraftFormat<'m' | 'cm' | 'mm' | 'ft' | 'in' | 'ft-in'>;
  smallLength: DraftFormat<'m' | 'cm' | 'mm' | 'ft' | 'in' | 'ft-in'>;
  area: DraftFormat<'m2' | 'cm2' | 'ft2'>;
  volume: DraftFormat<'m3' | 'l' | 'ft3'>;
  angle: DraftFormat<'deg' | 'rad'>;
  slope: DraftFormat<'percent' | 'deg'>;
  decimalSymbol: ',' | '.';
  currency: string;
}

export const QUANTITY_LABELS: Record<Quantity, string> = {
  length: 'Comprimento',
  smallLength: 'Comprimento pequeno (espessuras e folgas)',
  area: 'Área',
  volume: 'Volume',
  angle: 'Ângulo',
  slope: 'Inclinação',
  currency: 'Moeda',
};

export const UNIT_LABELS: Record<QuantityUnit, string> = {
  m: 'Metros',
  cm: 'Centímetros',
  mm: 'Milímetros',
  ft: 'Pés',
  in: 'Polegadas',
  'ft-in': 'Pés e polegadas',
  m2: 'm²',
  cm2: 'cm²',
  ft2: 'ft²',
  m3: 'm³',
  l: 'Litros',
  ft3: 'ft³',
  deg: 'Graus',
  rad: 'Radianos',
  percent: 'Porcentagem',
};

/** Valores SI dos exemplos ao vivo (um por grandeza). */
export const EXAMPLES: Array<[Quantity, number]> = [
  ['length', 1234.5678],
  ['smallLength', 0.0123],
  ['area', 123.4567],
  ['volume', 1.23456],
  ['angle', Math.PI / 4],
  ['slope', 0.267949],
  ['currency', 1234.5678],
];

/** Rascunho editável a partir das unidades resolvidas do projeto. */
export function draftFrom(u: ResolvedUnits): UnitsDraft {
  return {
    length: { ...u.length },
    smallLength: { ...u.smallLength },
    area: { ...u.area },
    volume: { ...u.volume },
    angle: { ...u.angle },
    slope: { ...u.slope },
    decimalSymbol: u.decimalSymbol,
    currency: u.currency,
  };
}

function normalizado<U extends string>(f: DraftFormat<U>): DraftFormat<U> {
  return f.unit === 'ft-in' ? f : { ...f, denominator: 16 };
}

/** Configuração completa do rascunho (ainda com todos os campos). */
export function draftSettings(d: UnitsDraft): UnitsSettings {
  return {
    length: normalizado(d.length),
    smallLength: normalizado(d.smallLength),
    area: normalizado(d.area),
    volume: normalizado(d.volume),
    angle: normalizado(d.angle),
    slope: normalizado(d.slope),
    decimalSymbol: d.decimalSymbol,
    currency: d.currency.trim(),
  };
}

function igual<U extends string>(a: DraftFormat<U>, b: DraftFormat<U>): boolean {
  const x = normalizado(a);
  const y = normalizado(b);
  return x.unit === y.unit && x.decimals === y.decimals && x.suppressZeros === y.suppressZeros && x.denominator === y.denominator;
}

/**
 * Configuração a gravar: só as grandezas que diferem do padrão. Igual ao padrão em tudo → `undefined`
 * (o diálogo grava `units: undefined`).
 */
export function applyDraft(d: UnitsDraft): UnitsSettings | undefined {
  const padrao = draftFrom(defaultUnits());
  const completo = draftSettings(d);
  const out: UnitsSettings = {};
  if (!igual(d.length, padrao.length)) out.length = completo.length;
  if (!igual(d.smallLength, padrao.smallLength)) out.smallLength = completo.smallLength;
  if (!igual(d.area, padrao.area)) out.area = completo.area;
  if (!igual(d.volume, padrao.volume)) out.volume = completo.volume;
  if (!igual(d.angle, padrao.angle)) out.angle = completo.angle;
  if (!igual(d.slope, padrao.slope)) out.slope = completo.slope;
  if (d.decimalSymbol !== padrao.decimalSymbol) out.decimalSymbol = d.decimalSymbol;
  if (d.currency.trim() !== padrao.currency) out.currency = completo.currency;
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Erro de validação do rascunho, ou `null` se estiver tudo certo. */
export function validateDraft(d: UnitsDraft): string | null {
  for (const key of QUANTITY_KEYS) {
    const casas = d[key].decimals;
    if (!Number.isInteger(casas) || casas < 0 || casas > 5) {
      return `${QUANTITY_LABELS[key]}: as casas decimais precisam ser um inteiro de 0 a 5.`;
    }
    if (d[key].unit === 'ft-in' && ![2, 4, 8, 16, 32, 64].includes(d[key].denominator)) {
      return `${QUANTITY_LABELS[key]}: fração de polegada inválida.`;
    }
  }
  const moeda = d.currency.trim();
  if (moeda.length < 1 || moeda.length > 4) return 'O símbolo de moeda precisa ter de 1 a 4 caracteres.';
  return null;
}

/** Linhas do exemplo ao vivo: valor de referência (SI) → valor com as escolhas do rascunho. */
export function exampleLines(d: UnitsDraft): Array<{ q: Quantity; label: string; text: string }> {
  const padrao = defaultUnits();
  const unidades = resolveUnits(draftSettings(d));
  return EXAMPLES.map(([q, si]) => ({
    q,
    label: QUANTITY_LABELS[q],
    text: `${formatQuantity(padrao, q, si, { decimals: 4, trim: true })} → ${formatQuantity(unidades, q, si)}`,
  }));
}
