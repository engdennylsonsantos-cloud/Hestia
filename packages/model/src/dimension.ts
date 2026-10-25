import { add, len, mul, sub, type Vec2 } from '@hestia/geom';
import { isWall, type Dimension, type DimensionRef, type Project } from './types.ts';

/** Espaçamentos da cota em mm de papel (multiplicados pela escala da vista no render e no DXF). */
export const DIM_GAP_MM = 1.5;
export const DIM_OVERSHOOT_MM = 2;
export const DIM_TICK_HALF_MM = 1.4;
/** Altura padrão do texto do valor, em mm de papel. */
export const DIM_TEXT_MM = 2.5;

/** Comprimento mínimo de uma cota (m): abaixo disso os dois pontos são o mesmo. */
export const DIM_MIN_LENGTH = 0.001;

/** Arredonda a 1 mm, como o valor exibido pela cota. */
export const roundMm = (m: number): number => Math.round(m * 1000) / 1000;

/**
 * Pontos medidos da cota. Uma extremidade com referência a parede existente segue essa extremidade da parede
 * (decisão 0019); sem a parede, vale o ponto guardado (a cota vira livre). Com `ref.axis`, só a coordenada do
 * eixo acompanha a parede e a outra fica na linha guardada — é o que mantém reta uma cadeia de um lado da planta.
 */
export function dimensionPoints(p: Pick<Project, 'elements'>, d: Dimension): { a: Vec2; b: Vec2 } {
  const at = (ref: DimensionRef | undefined, fallback: Vec2): Vec2 => {
    const w = ref ? p.elements[ref.wallId] : undefined;
    if (!ref || !isWall(w)) return fallback;
    const pt = ref.end === 'a' ? w.a : w.b;
    if (ref.axis === 'x') return { x: pt.x, y: fallback.y };
    if (ref.axis === 'y') return { x: fallback.x, y: pt.y };
    return { ...pt };
  };
  return { a: at(d.refs?.a, d.a), b: at(d.refs?.b, d.b) };
}

/** Valor da cota em metros, arredondado a 1 mm. */
export function dimensionValue(p: Pick<Project, 'elements'>, d: Dimension): number {
  const { a, b } = dimensionPoints(p, d);
  return roundMm(len(sub(b, a)));
}

/** Texto do valor: duas casas decimais em metros, com vírgula ("3,50 m"). */
export const formatDimensionValue = (m: number): string => `${m.toFixed(2).replace('.', ',')} m`;

/** Texto mostrado na cota: o texto fixo, se houver algum (sem espaços nas pontas); senão, o valor medido. */
export function dimensionText(p: Pick<Project, 'elements'>, d: Dimension): string {
  const fixed = d.text?.trim();
  return fixed ? fixed : formatDimensionValue(dimensionValue(p, d));
}

export interface DimensionGeometry {
  /** Linha de cota, de uma extremidade à outra. */
  line: [Vec2, Vec2];
  /** Linhas de chamada: do ponto medido até além da linha de cota. */
  extensions: [[Vec2, Vec2], [Vec2, Vec2]];
  /** Marcas a 45° nas extremidades da linha de cota. */
  ticks: [[Vec2, Vec2], [Vec2, Vec2]];
  /** Centro do texto do valor: no meio da cota, acima da linha. */
  textAt: Vec2;
  /** Ângulo do texto em graus, sempre legível pela esquerda ou por baixo (−90 < θ ≤ 90). */
  textRotation: number;
  /** Comprimento medido, em metros. */
  length: number;
}

/**
 * Geometria da cota alinhada a–b, em metros. `mPerMm` é quantos metros de mundo cabem em 1 mm de papel
 * (escala da vista / 1000); assim as distâncias de papel (folga, marcas, texto) ficam legíveis em qualquer escala.
 * `offset` leva a linha de cota para o lado esquerdo de a→b (negativo, para o direito).
 */
export function dimensionGeometry(a: Vec2, b: Vec2, offset: number, mPerMm: number, textMm = DIM_TEXT_MM): DimensionGeometry {
  const d = sub(b, a);
  const length = len(d);
  const u: Vec2 = length > 0 ? { x: d.x / length, y: d.y / length } : { x: 1, y: 0 };
  const n: Vec2 = { x: -u.y, y: u.x };
  const s = offset >= 0 ? 1 : -1;
  const gap = DIM_GAP_MM * mPerMm;
  const over = DIM_OVERSHOOT_MM * mPerMm;
  const tick = DIM_TICK_HALF_MM * mPerMm;
  const ta = add(a, mul(n, offset));
  const tb = add(b, mul(n, offset));
  // Marca a 45° da linha de cota: direção u girada 45° (u + n)/√2.
  const t: Vec2 = mul({ x: u.x + n.x, y: u.y + n.y }, tick / Math.SQRT2);
  const readable = (Math.atan2(u.y, u.x) * 180) / Math.PI;
  let textRotation = readable;
  if (textRotation > 90) textRotation -= 180;
  if (textRotation <= -90) textRotation += 180;
  // Vetor "para cima" do texto: normal esquerda da direção legível.
  const rad = (textRotation * Math.PI) / 180;
  const up: Vec2 = { x: -Math.sin(rad), y: Math.cos(rad) };
  const mid = mul(add(ta, tb), 0.5);
  return {
    line: [ta, tb],
    extensions: [
      [add(a, mul(n, s * gap)), add(a, mul(n, offset + s * over))],
      [add(b, mul(n, s * gap)), add(b, mul(n, offset + s * over))],
    ],
    ticks: [
      [sub(ta, t), add(ta, t)],
      [sub(tb, t), add(tb, t)],
    ],
    textAt: add(mid, mul(up, gap + (textMm * mPerMm) / 2)),
    textRotation,
    length,
  };
}
