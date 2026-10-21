import { cross, type Vec2 } from '@hestia/geom';
import type { EndRef, WallEnds } from './joinTypes.ts';
import { both, setEnd } from './joinSides.ts';
import { joinPair } from './joinPair.ts';

const TWO_PI = Math.PI * 2;
/** Abaixo disso (|sen|) duas paredes são paralelas: sobrepostas na mesma direção não formam canto. */
const PARALELA = 0.035;

/** Ângulo da direção de saída do nó (atan2 de `dir`). */
const angleOf = (r: EndRef): number => Math.atan2(r.dir.y, r.dir.x);

/** Lacuna angular no sentido anti-horário de `from` até `to`, em [0, 2π). */
const ccwGap = (from: number, to: number): number => (((to - from) % TWO_PI) + TWO_PI) % TWO_PI;

/** Paredes que se afastam do nó em direções diferentes formam um canto (a lacuna entre elas não é nula). */
const formaCanto = (a: Vec2, b: Vec2): boolean => Math.abs(cross(a, b)) >= PARALELA;

/**
 * Nó de 3+ paredes sem par colinear (J-2, docs/08 §6). Toda parede corta reto exatamente no ponto do nó: quando
 * nenhuma lacuna angular passa de 180°, as bandas se cruzam e cobrem o disco do nó sem fresta (cada canto interno é
 * a união de dois triângulos convexos, um por parede), e o pintor resolve as sobreposições por prioridade e núcleo.
 *
 * Uma lacuna reflexa (> 180°) entre as paredes `a` e `b` significa canto externo ali: esse par recebe a junção de duas
 * paredes (`joinPair`, que lê a configuração de junção) e as demais continuam retas no nó.
 */
export function nodeOfWalls(out: Map<string, WallEnds>, g: EndRef[]): void {
  const refs = [...g].sort((x, y) => angleOf(x) - angleOf(y));
  for (const r of refs) setEnd(out, r, both({ kind: 'flat', t: r.which === 'a' ? 0 : r.f.length }));
  const n = refs.length;
  for (let i = 0; i < n; i++) {
    const a = refs[i]!;
    const b = refs[(i + 1) % n]!;
    if (ccwGap(angleOf(a), angleOf(b)) > Math.PI && formaCanto(a.dir, b.dir)) {
      joinPair(out, a, b);
      return;
    }
  }
}
