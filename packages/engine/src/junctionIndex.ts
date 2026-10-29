import { floorsOnLevel, isFloor, isRamp, isRoof, isSlab, isStair, openingsOfWall, rampsOnLevel, roofsOnLevel, slabsOnLevel, stairsOnLevel, wallsOnLevel, type Element, type Id, type Project, type Wall } from '@hestia/model';

/**
 * Horizontais do projeto (pisos, lajes, escadas e telhados) por conjunto de elementos, montados numa única passagem sobre
 * `p.elements`. Os cortadores de cada nível os leem inteiros, então sem este cache cada nível varreria o projeto.
 * A ordem é a de `Object.values(p.elements)`, a mesma das consultas de `@hestia/model`. (As aberturas por parede vêm do
 * índice de `openingsOfWall` no próprio `@hestia/model`.)
 *
 * A chave é o objeto `elements`, não o projeto: o projeto reduzido da junção (`projetoDaJuncao`) compartilha `elements`
 * com o inteiro, então a varredura é feita uma vez para os dois.
 */
const horizontaisPorElementos = new WeakMap<object, readonly Element[]>();

/** Horizontais do projeto inteiro, na ordem do projeto. Conjunto de elementos novo (edição) monta outra lista. */
export function horizontaisDoProjeto(p: Project): readonly Element[] {
  const hit = horizontaisPorElementos.get(p.elements);
  if (hit) return hit;
  const lista = Object.values(p.elements).filter((e) => isFloor(e) || isSlab(e) || isStair(e) || isRamp(e) || isRoof(e));
  horizontaisPorElementos.set(p.elements, lista);
  return lista;
}

/** Parede com fixação a piso ou telhado: a resolução dela lê pisos, lajes e telhados de todos os níveis. */
const fixadaAOutroNivel = (w: Wall): boolean => w.attachBottomToFloor === true || w.attachTopToFloor === true || w.attachTopToRoof === true;

/**
 * Níveis que o cortador de `levelId` lê: o próprio (cota e faixa) e o nível de topo de cada parede (`topLevelId`, a altura
 * depende da cota dele). Os vizinhos por cota não entram: a resolução de pisos, lajes e paredes não os lê (só a cota do
 * próprio nível, `levelElevation`). Nível ausente no projeto (reduzido) entra pelo id, então não casa com o objeto do
 * projeto inteiro.
 */
function niveisLidos(p: Project, levelId: Id, walls: readonly Wall[]): unknown[] {
  const ids = new Set<Id>([levelId]);
  for (const w of walls) if (w.topLevelId) ids.add(w.topLevelId);
  return [...ids].map((id) => p.levels.find((l) => l.id === id) ?? id);
}

/** Elementos do nível que validam o cache de cortadores (paredes, aberturas, pisos, lajes, escadas, telhados e horizontais). */
interface ElementosDoNivel {
  walls: Wall[];
  lista: unknown[];
}

const elementosPorNivelPorElementos = new WeakMap<object, Map<Id, ElementosDoNivel>>();

/** Elementos do nível, por conjunto de elementos (o projeto reduzido reaproveita a varredura do inteiro). */
function elementosDoNivel(p: Project, levelId: Id): ElementosDoNivel {
  let porNivel = elementosPorNivelPorElementos.get(p.elements);
  if (!porNivel) {
    porNivel = new Map();
    elementosPorNivelPorElementos.set(p.elements, porNivel);
  }
  const hit = porNivel.get(levelId);
  if (hit) return hit;
  const walls = wallsOnLevel(p, levelId);
  const lista: unknown[] = [
    ...walls,
    ...walls.flatMap((wall) => openingsOfWall(p, wall.id)),
    ...floorsOnLevel(p, levelId),
    ...slabsOnLevel(p, levelId),
    ...stairsOnLevel(p, levelId),
    ...rampsOnLevel(p, levelId),
    ...roofsOnLevel(p, levelId),
    // Alturas anexadas e contornos com dependências verticais também leem estes elementos de outros níveis.
    ...horizontaisDoProjeto(p),
  ];
  const out = { walls, lista };
  porNivel.set(levelId, out);
  return out;
}

/**
 * Fontes (referências) que validam o cache de cortadores de um nível. Não entra o array inteiro de níveis: o projeto
 * reduzido da junção tem outro array, mas os mesmos objetos de nível e de elemento. Só parede fixada a outro nível lê
 * todos os níveis; nesse caso o array inteiro entra.
 */
export function fontesDoCortador(p: Project, levelId: Id): unknown[] {
  const { walls, lista } = elementosDoNivel(p, levelId);
  const niveis = walls.some(fixadaAOutroNivel) ? [p.levels] : niveisLidos(p, levelId, walls);
  return [...niveis, p.settings, p.defaults, p.wallTypes, p.openingTypes, p.floorTypes, p.slabTypes, p.roofTypes, p.stairTypes, p.rampTypes, ...lista];
}
