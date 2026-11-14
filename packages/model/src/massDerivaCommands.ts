import type { Vec2 } from '@hestia/geom';
import type { Command } from './commands.ts';
import { makeFloor } from './floor.ts';
import { t, type Lang } from './i18n.ts';
import { makeSlab } from './slab.ts';
import { isMass } from './mass.ts';
import { isFloor, isSlab, type Floor, type Id, type Project, type Slab } from './types.ts';

/** Piso ou laje: o que a derivação cria (ficha D1, plano de massa A.7). */
export type TipoDerivado = 'piso' | 'laje';

/** Um contorno gerado: o id do elemento novo, o nível e o contorno (anel externo e furos), em metros, na cota do nível. */
export interface ContornoDerivado {
  id: Id;
  nivelId: Id;
  boundary: Vec2[];
  holes: Vec2[][];
}

export interface DerivaPisosArgs {
  massaId: Id;
  tipo: TipoDerivado;
  /** Tipo de piso (`floorTypes`) ou de laje (`slabTypes`), conforme `tipo`. */
  typeId: Id;
  contornos: ContornoDerivado[];
}

/** Os pisos e lajes que uma derivação anterior gerou pela MESMA massa no MESMO nível (de qualquer tipo). */
function geradosAnteriores(p: Project, massaId: Id, nivelId: Id): Id[] {
  return Object.values(p.elements)
    .filter((e): e is Floor | Slab => (isFloor(e) || isSlab(e)) && e.origemMassa?.massaId === massaId && e.origemMassa.nivelId === nivelId && e.levelId === nivelId)
    .map((e) => e.id);
}

/**
 * Comando da derivação de pisos da massa (ficha D1). Devolve UM comando `batch`: apaga os gerados antes pela mesma massa e
 * nível e cria um piso (ou laje) por contorno, com `origemMassa` e contorno ESTÁTICO. Como é um só `batch`, um Ctrl+Z
 * desfaz tudo e rodar de novo substitui (não duplica). Valida antes e lança sem tocar no projeto se a massa, o tipo, um
 * nível ou um contorno estiverem errados.
 */
export function comandoDerivarPisos(p: Project, a: DerivaPisosArgs, lang: Lang = 'pt'): Command {
  if (!isMass(p.elements[a.massaId])) throw new Error(t(lang, 'md_cmd_mass_missing'));
  if (a.tipo === 'piso' && !p.floorTypes[a.typeId]) throw new Error(t(lang, 'md_cmd_floor_type_missing'));
  if (a.tipo === 'laje' && !p.slabTypes[a.typeId]) throw new Error(t(lang, 'md_cmd_slab_type_missing'));
  const remover: Id[] = [];
  const criar: Command[] = [];
  for (const c of a.contornos) {
    if (!p.levels.some((l) => l.id === c.nivelId)) throw new Error(t(lang, 'md_cmd_level_missing_id', { id: c.nivelId }));
    if (c.boundary.length < 3) throw new Error(t(lang, a.tipo === 'piso' ? 'md_cmd_floor_min_points' : 'md_cmd_slab_min_points'));
    if (c.holes.some((h) => h.length < 3)) throw new Error(t(lang, a.tipo === 'piso' ? 'md_cmd_floor_min_points' : 'md_cmd_slab_min_points'));
    remover.push(...geradosAnteriores(p, a.massaId, c.nivelId));
    const origemMassa = { massaId: a.massaId, nivelId: c.nivelId };
    const base = { id: c.id, typeId: a.typeId, levelId: c.nivelId, boundary: c.boundary, holes: c.holes, origemMassa };
    criar.push(a.tipo === 'piso' ? { type: 'addFloor', floor: makeFloor(base) } : { type: 'addSlab', slab: makeSlab(base) });
  }
  const apagar: Command[] = remover.length > 0 ? [{ type: 'deleteElements', ids: [...new Set(remover)] }] : [];
  return { type: 'batch', commands: [...apagar, ...criar] };
}
