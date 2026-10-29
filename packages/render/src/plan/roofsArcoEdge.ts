import type { Ring, Vec2 } from '@hestia/geom';
import { arcFromSagitta, arcPointAt, dist } from '@hestia/geom';
import { isRoof, type Element, type Roof } from '@hestia/model';
import { footprintOf, footprintSag, hasRoofArcs, sampleSagRing } from '@hestia/tools/src/perimeterRoofArcs.ts';

/** Distância (m) para um vértice do anel contar como o canto ou o meio do arco. */
const TOL = 1e-4;

/**
 * Pontos de alça do contorno do telhado: os cantos lógicos (`boundary`) e o meio de cada aresta em arco. O meio de reta
 * não entra (a alça de inserir vértice é do modo de edição, não da seleção).
 */
export function pontosDeAlca(roof: Roof): Vec2[] {
  const n = roof.boundary.length;
  const out: Vec2[] = [...roof.boundary];
  roof.boundary.forEach((a, i) => {
    const arc = arcFromSagitta(a, roof.boundary[(i + 1) % n]!, roof.edgeSag?.[i] ?? 0);
    if (arc) out.push(arcPointAt(arc, arc.length / 2));
  });
  return out;
}

/**
 * Quais vértices do anel da seleção (união das águas, com os arcos subdivididos pelo motor) levam alça: com arcos, os
 * cantos lógicos e o meio de cada arco (o motor sempre o deixa como vértice); sem arcos, o critério antigo
 * (`padrao`, que o chamador passa: `cantosLogicos` de roofs.ts). Aceita qualquer elemento (ausente ou outro tipo: critério antigo).
 */
export function gripsDoTelhado(el: Element | undefined, padrao: (ring: Ring) => boolean[]): (ring: Ring) => boolean[] {
  if (!isRoof(el) || !hasRoofArcs(el)) return padrao;
  const alvos = pontosDeAlca(el);
  return (ring) => ring.map((q) => alvos.some((t) => dist(q, t) <= TOL));
}

/**
 * Pegada (sem balanço) do telhado como polilinha fina, com o arco real (erro de corda de 2 mm), para o traço
 * tracejado da pegada. Null sem pegada gravada. Sem arcos devolve a própria pegada.
 */
export function pegadaDoTelhado(roof: Roof): Vec2[] | null {
  if (!roof.footprint) return null;
  if (!hasRoofArcs(roof)) return roof.footprint;
  return sampleSagRing(footprintOf(roof), footprintSag(roof, footprintOf(roof))).pts;
}
