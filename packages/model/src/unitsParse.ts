/**
 * Leitura de valores digitados com unidade. Devolve o valor em metros (SI) ou `null` se o texto for inválido.
 *
 * Aceita vírgula ou ponto decimal, sinal, espaços livres e sufixo de unidade (`120cm`, `1.2 m`, `12m²`,
 * `500l`, `45°`, `0.78rad`, `5%`). Sem sufixo, vale a unidade de exibição da grandeza no projeto.
 * Pés e polegadas: `5'`, `5'6"`, `5' 6 1/2"`, `1/2"`; a forma `5-6` só vale quando a grandeza está em
 * `ft`, `in` ou `ft-in`. Sufixo incompatível com a grandeza (ex.: `m2` em comprimento) devolve `null`.
 */
import { siFrom, type Quantity, type QuantityUnit, type ResolvedUnits } from './units.ts';

const M_PER_FT = 0.3048;

const NUMBER_RE = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;
const SPLIT_RE = /^([+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+))\s*(.*)$/;

/** Converte um número simples (com vírgula ou ponto) em número; `null` se não for um número. */
function decimal(text: string): number | null {
  const t = text.trim();
  if (!NUMBER_RE.test(t)) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Polegadas de um trecho: `6`, `6.5`, `1/2`, `6 1/2` (com ou sem aspas no fim). */
function inches(part: string): number | null {
  const t = part.trim().replace(/"$/, '').trim();
  if (!t) return 0;
  const frac = /^(\d+(?:[.,]\d+)?)?\s*(\d+)\s*\/\s*(\d+)$/.exec(t);
  if (frac) {
    const whole = frac[1] ? decimal(frac[1]) : 0;
    const num = Number(frac[2]);
    const den = Number(frac[3]);
    if (whole === null || !Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return whole + num / den;
  }
  return decimal(t);
}

/** Pés e polegadas em metros; `null` se não for uma expressão de pés/polegadas. */
function feetInches(text: string): number | null {
  const t = text.trim();
  const negative = t.startsWith('-');
  const body = t.replace(/^[+-]\s*/, '');
  let feet = 0;
  let rest = '';
  const quote = body.indexOf("'");
  if (quote >= 0) {
    const parsedFeet = decimal(body.slice(0, quote));
    if (parsedFeet === null) return null;
    feet = parsedFeet;
    rest = body.slice(quote + 1);
  } else if (body.endsWith('"')) {
    rest = body;
  } else {
    const hyphen = /^(\d+(?:[.,]\d+)?)\s*-\s*(.*)$/.exec(body);
    if (!hyphen) return null;
    const feetText = hyphen[1];
    if (feetText === undefined) return null;
    const parsedFeet = decimal(feetText);
    if (parsedFeet === null) return null;
    feet = parsedFeet;
    rest = hyphen[2] ?? '';
  }
  const parsedInches = inches(rest);
  if (parsedInches === null) return null;
  const meters = (feet + parsedInches / 12) * M_PER_FT;
  return negative ? -meters : meters;
}

function unitOfToken(q: Quantity, token: string): QuantityUnit | null {
  const t = token.toLowerCase().replace(/\s+/g, '');
  if (q === 'length' || q === 'smallLength') {
    if (t === 'm') return 'm';
    if (t === 'cm') return 'cm';
    if (t === 'mm') return 'mm';
    if (t === 'ft') return 'ft';
    if (t === 'in') return 'in';
    return null;
  }
  if (q === 'area') {
    if (t === 'm2' || t === 'm²') return 'm2';
    if (t === 'cm2' || t === 'cm²') return 'cm2';
    if (t === 'ft2' || t === 'ft²') return 'ft2';
    return null;
  }
  if (q === 'volume') {
    if (t === 'm3' || t === 'm³') return 'm3';
    if (t === 'l') return 'l';
    if (t === 'ft3' || t === 'ft³') return 'ft3';
    return null;
  }
  if (q === 'angle') {
    if (t === 'deg' || t === '°') return 'deg';
    if (t === 'rad') return 'rad';
    return null;
  }
  if (t === '%' || t === 'percent') return 'percent';
  if (t === 'deg' || t === '°') return 'deg';
  return null;
}

function currencyValue(units: ResolvedUnits, text: string): number | null {
  const symbol = units.currency.trim();
  const without = symbol ? text.split(symbol).join('') : text;
  return decimal(without);
}

/**
 * Texto digitado na grandeza `q`, em metros (SI). Entrada sem sufixo usa a unidade de exibição configurada.
 * Texto vazio, `NaN`, número com duas vírgulas ou unidade incompatível devolvem `null`.
 */
export function parseQuantity(units: ResolvedUnits, q: Quantity, text: string): number | null {
  const raw = text.trim();
  if (!raw) return null;
  if (q === 'currency') return currencyValue(units, raw);

  const isLength = q === 'length' || q === 'smallLength';
  const isFtIn = isLength && (units[q].unit === 'ft' || units[q].unit === 'in' || units[q].unit === 'ft-in');
  if (isLength && (raw.includes("'") || raw.includes('"'))) {
    return feetInches(raw);
  }
  if (isFtIn && /^[+-]?\d+(?:[.,]\d+)?\s*-/.test(raw)) {
    return feetInches(raw);
  }

  const split = SPLIT_RE.exec(raw);
  if (!split) return null;
  const numberPart = split[1];
  if (numberPart === undefined) return null;
  const value = decimal(numberPart);
  if (value === null) return null;
  const token = (split[2] ?? '').trim();
  if (!token) return siFrom(q, units[q].unit, value);
  const unit = unitOfToken(q, token);
  return unit ? siFrom(q, unit, value) : null;
}
