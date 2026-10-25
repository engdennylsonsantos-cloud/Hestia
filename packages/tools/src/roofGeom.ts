import { asMulti, dot, len, norm, offsetMulti, perp, ringArea, sub, type Ring, type Vec2 } from '@hestia/geom';
import { wallMaxHeight, wallsOnLevel, type Id, type Project, type RoofShape } from '@hestia/model';

/** Maior inclinação aceita para telhado, em % (200 % = 63,4°). Acima disso o telhado vira parede. */
export const ROOF_SLOPE_LIMIT = 200;

/** Percentual de inclinação para graus: % = tan(graus) × 100. */
export const percentToDeg = (percent: number): number => (Math.atan(percent / 100) * 180) / Math.PI;

/** Graus para percentual de inclinação: % = tan(graus) × 100. */
export const degToPercent = (deg: number): number => Math.tan((deg * Math.PI) / 180) * 100;

/**
 * Inclinação (%) gravada pelo campo em graus ao sair dele. Sem edição, o campo lê o valor mostrado (1 casa decimal):
 * nesse caso a inclinação atual em % fica como estava, senão o arredondamento trocaria 45 % por 44,94 %.
 */
export function roofSlopeFromDegField(typedDeg: number, currentDeg: number, currentPercent: number): number {
  const shownDeg = Number(currentDeg.toFixed(1));
  return Math.abs(typedDeg - shownDeg) < 1e-9 ? currentPercent : degToPercent(typedDeg);
}

/** Erro da inclinação de telhado (não finita, não positiva ou acima do limite), ou null quando é aceita. */
export function roofSlopeError(percent: number): string | null {
  if (!Number.isFinite(percent)) return 'Inclinação inválida: digite um número.';
  if (percent <= 0) return 'Inclinação do telhado precisa ser maior que zero.';
  if (percent > ROOF_SLOPE_LIMIT) return `Inclinação acima de ${ROOF_SLOPE_LIMIT} %: confira o valor.`;
  return null;
}

/** Deslocamento padrão do beiral sem paredes no nível (m). */
export const ROOF_DEFAULT_OFFSET = 2.8;

/** Cota do beiral quando o usuário não digitou uma: altura da parede mais alta do nível, ou 2,8 m sem paredes. */
export function roofAutoOffset(p: Project, levelId: Id): number {
  const heights = wallsOnLevel(p, levelId).map((w) => wallMaxHeight(p, w));
  return heights.length ? Math.max(...heights) : ROOF_DEFAULT_OFFSET;
}

/** Ordena o sinal da direção (x positivo, ou x nulo e y positivo) para que o mesmo eixo nunca saia invertido. */
function canonicalDir(d: Vec2): Vec2 {
  const flip = Math.abs(d.x) > 1e-12 ? d.x < 0 : d.y < 0;
  // `+ 0` converte -0 em 0: a comparação de eixos e o JSON do projeto ficam estáveis.
  return flip ? { x: -d.x + 0, y: -d.y + 0 } : { x: d.x + 0, y: d.y + 0 };
}

/**
 * Eixo do lado MAIOR do retângulo envolvente de mínima área do contorno (rotating calipers sobre as arestas).
 * É a direção da cumeeira por padrão: as águas caem sobre os lados menores. Função pura e determinística.
 */
export function defaultRoofDir(boundary: Vec2[]): Vec2 {
  let best = { area: Infinity, dir: { x: 1, y: 0 } };
  const n = boundary.length;
  for (let i = 0; i < n; i++) {
    const e = sub(boundary[(i + 1) % n]!, boundary[i]!);
    if (len(e) < 1e-9) continue;
    const u = norm(e);
    const v = perp(u);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const q of boundary) {
      const pu = dot(q, u);
      const pv = dot(q, v);
      minU = Math.min(minU, pu);
      maxU = Math.max(maxU, pu);
      minV = Math.min(minV, pv);
      maxV = Math.max(maxV, pv);
    }
    const su = maxU - minU;
    const sv = maxV - minV;
    const area = su * sv;
    if (area < best.area - 1e-9) best = { area, dir: su >= sv ? u : v };
  }
  return canonicalDir(best.dir);
}

/**
 * Direção que o telhado usa para a forma: duas águas = cumeeira no eixo `base`; uma água = subida perpendicular
 * ao eixo (a água cai sobre o lado maior, como nas duas águas); quatro águas não usa direção (devolve `base`).
 * `alt` (Tab) troca para o outro eixo ortogonal.
 */
export function roofDirFor(shape: RoofShape, base: Vec2, alt: boolean): Vec2 {
  const axis = alt ? perp(base) : base;
  if (shape === 'shed') return canonicalDir(perp(axis));
  return canonicalDir(axis);
}

/** Retângulo com dois cantos opostos, em ordem de contorno. */
export const rectRing = (a: Vec2, c: Vec2): Vec2[] => [a, { x: c.x, y: a.y }, c, { x: a.x, y: c.y }];

/**
 * Contorno do beiral a partir do contorno externo da edificação: deslocado para fora pelo balanço, com cantos em
 * esquadria (Clipper, miter). Balanço zero ou negativo devolve o próprio contorno.
 */
export function eaveOutline(outer: Ring, overhang: number): Ring {
  if (!(overhang > 1e-9)) return outer;
  const grown = offsetMulti(asMulti(outer), overhang);
  let best: Ring | null = null;
  let bestArea = -Infinity;
  for (const poly of grown) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    const a = Math.abs(ringArea(ring));
    if (a > bestArea) {
      best = ring;
      bestArea = a;
    }
  }
  return best ?? outer;
}
