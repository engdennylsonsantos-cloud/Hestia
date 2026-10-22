import { offsetMulti, type MultiPolygon, type Ring } from '@hestia/geom';
import { terminoMeters, terminoOf, type Id, type Layer, type OutlineSource, type Project } from '@hestia/model';
import { enclosedRooms, roomAt, type RoomExtend } from './enclosed.ts';

/**
 * Contorno por camada de piso e de laje vinculados às paredes (decisão 0023 §2, P8). Cada camada escolhe, pelo seu
 * término (`termino`), entre o contorno na face de acabamento da parede e o contorno no núcleo dela. A escolha usa só
 * atributos de camada: a posição no núcleo do elemento (`core`) e o término. Nome e material não entram.
 */

/** Elemento vinculado: a origem do contorno e os furos manuais (os de escada entram depois, em `floors`/`slabs`). */
export interface LinkedHost {
  outlineSource?: OutlineSource;
  holes: Ring[];
}

/** Polígono de um circuito fechado (anel externo e ilhas de parede) com os furos manuais do elemento. */
function withHoles(room: Ring[], holes: Ring[]): MultiPolygon {
  return [[room[0]!, ...holes, ...room.slice(1)]];
}

/**
 * Contorno de cada camada, antes do corte de escada. Elemento estático, de perímetro externo ou com circuito aberto:
 * todas as camadas recebem `base` (o contorno do elemento, como antes). Vinculado a circuito fechado: `finish` e `core`
 * vêm do mesmo circuito (o do modo do elemento é o `base`; o outro é recalculado). Quando o circuito do núcleo não fecha,
 * as camadas que iriam ao núcleo ficam na face de acabamento.
 *
 * Término: `face` = face de acabamento; `nucleo` = núcleo da parede; `auto` = núcleo para a camada dentro do núcleo do
 * elemento, face para as demais; `{cm}` = a face de acabamento deslocada em cm (positivo avança sobre a parede).
 */
export function layerOutlines(p: Project, levelId: Id, el: LinkedHost, layers: readonly Layer[], core: readonly boolean[], base: MultiPolygon): MultiPolygon[] {
  const src = el.outlineSource;
  const fallback = layers.map(() => base);
  if (!src?.linked || src.mode === 'perimeter' || !src.seed) return fallback;
  const term = layers.map(terminoOf);
  const needCore = term.some((t, i) => t === 'nucleo' || (t === 'auto' && core[i]));
  const circuit = (extend: RoomExtend): MultiPolygon | null => {
    const room = roomAt(enclosedRooms(p, levelId, extend), src.seed!);
    return room ? withHoles(room, el.holes) : null;
  };
  const finish = src.mode === 'walls-finish' ? base : circuit('finish');
  if (!finish) return fallback;
  const corePoly = src.mode === 'walls-core' ? base : needCore ? circuit('core') : null;
  return layers.map((_, i) => {
    const t = term[i]!;
    if (typeof t === 'object') return t.cm === 0 ? finish : offsetMulti(finish, terminoMeters(t));
    if (t === 'face') return finish;
    if (t === 'nucleo') return corePoly ?? finish;
    return core[i] && corePoly ? corePoly : finish;
  });
}

/**
 * Corte de escada com memória: a mesma forma (objeto) não é recortada duas vezes. Camadas com o contorno do elemento
 * reaproveitam o resultado do próprio elemento.
 */
export function memoCut(cut: (m: MultiPolygon) => MultiPolygon): (m: MultiPolygon) => MultiPolygon {
  const done = new Map<MultiPolygon, MultiPolygon>();
  return (m) => {
    let r = done.get(m);
    if (!r) {
      r = cut(m);
      done.set(m, r);
    }
    return r;
  };
}
