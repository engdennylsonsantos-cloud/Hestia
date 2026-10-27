import { add, mid, norm, perp, pointInMulti, sub, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { mmNoModelo } from './roofsRotulos.ts';
import type { Espessura, PlanTheme, StrokeOp } from './types.ts';

/** Base do símbolo de empena em mm de papel (o triângulo de perfil). */
export const EMPENA_BASE_MM = 2.6;
/** Altura do símbolo de empena em mm de papel, do lado de dentro do telhado. */
export const EMPENA_ALTURA_MM = 1.8;

/** Ponto deslocado na normal `n` a uma distância pequena, para achar o lado de dentro da cobertura. */
const probe = (m: Vec2, n: Vec2, d: number): Vec2 => ({ x: m.x + n.x * d, y: m.y + n.y * d });

/** Normal de `a`→`b` que aponta para dentro da cobertura (a que cai sobre as águas); a outra, se nenhuma cair. */
function inwardNormal(a: Vec2, b: Vec2, foot: MultiPolygon, escala: number): Vec2 {
  const m = mid(a, b);
  const n = perp(norm(sub(b, a)));
  const d = Math.max(mmNoModelo(0.2, escala), 1e-4);
  if (pointInMulti(probe(m, n, d), foot)) return n;
  const oposto = { x: -n.x, y: -n.y };
  if (pointInMulti(probe(m, oposto, d), foot)) return oposto;
  return n;
}

/**
 * Símbolo de perfil da empena, como o Revit e o Archicad desenham a aresta sem inclinação: um triângulo pequeno com a
 * base sobre a aresta, no meio dela, e o vértice apontando para dentro do telhado. O tamanho é em mm de papel (escala 1:
 * `escala`), então a planta o vê crescer com o zoom, sem depender do zoom para a geometria. A linha da empena continua
 * sendo desenhada à parte, na cor da tinta.
 */
export function gableSymbolOps(a: Vec2, b: Vec2, foot: MultiPolygon, theme: PlanTheme, espessura: Espessura, escala: number): StrokeOp[] {
  const t = norm(sub(b, a));
  const n = inwardNormal(a, b, foot, escala);
  const m = mid(a, b);
  const meiaBase = mmNoModelo(EMPENA_BASE_MM, escala) / 2;
  const altura = mmNoModelo(EMPENA_ALTURA_MM, escala);
  const base1 = add(m, { x: -t.x * meiaBase, y: -t.y * meiaBase });
  const base2 = add(m, { x: t.x * meiaBase, y: t.y * meiaBase });
  const ponta = add(m, { x: n.x * altura, y: n.y * altura });
  return [{ pts: [base1, ponta, base2], closed: true, ...espessura, color: theme.ink, alpha: 1 }];
}
