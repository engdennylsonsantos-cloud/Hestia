import type { Vec2 } from '@hestia/geom';
import { ceilingIssues, ceilingOutline } from '@hestia/engine';
import {
  DEFAULT_CEILING_HEIGHT,
  followsRoom,
  isCeiling,
  isFloor,
  isSlab,
  makeCeiling,
  makeFloor,
  makeSlab,
  newId,
  validateProject,
  type Ceiling,
  type Command,
  type Floor,
  type OutlineSource,
  type Project,
  type Slab,
  type ValidationIssue,
} from '@hestia/model';
import { OUTLINE_LOCKED_MSG } from './outlineEdit.ts';
import { areaText, keepOrder, newError, pickTypeId, refuse, withElement } from './perimeterCommitShared.ts';
import type { CommitPerimeterOptions, CommitPerimeterResult } from './perimeterCommitTypes.ts';

/** Alvos de contorno simples: piso, laje e forro (contorno e furos, sem arestas). */
export type AreaTarget = 'floor' | 'slab' | 'ceiling';
export type AreaElement = Floor | Slab | Ceiling;

const NAME: Record<AreaTarget, string> = { floor: 'Piso', slab: 'Laje', ceiling: 'Forro' };

/** Contorno e furos de um piso, laje ou forro para o rascunho. O forro que acompanha o ambiente usa o contorno do ambiente. */
export function areaSides(p: Project, el: AreaElement): { outer: Vec2[]; holes: Vec2[][] } {
  if (isCeiling(el)) {
    const o = ceilingOutline(p, el);
    return { outer: o.boundary, holes: o.holes };
  }
  return { outer: el.boundary, holes: el.holes };
}

/** Origem de contorno de "estender até o núcleo": perímetro com a face do núcleo, estático (não vinculado às paredes). */
const coreOutline = (): OutlineSource => ({ mode: 'perimeter', linked: false, extend: 'core' });

/**
 * Liga ou desliga "estender até o núcleo" na origem do contorno. Ligar põe o modo perímetro com a face do núcleo;
 * desligar devolve a face de acabamento. Sem origem e desligado, não há o que mudar (undefined).
 */
function outlineWithExtend(src: OutlineSource | undefined, extend: boolean): OutlineSource | undefined {
  if (extend) return { ...src, mode: 'perimeter', linked: false, extend: 'core' };
  return src ? { ...src, extend: 'finish' } : undefined;
}

/** Piso, laje ou forro a partir do contorno do esboço: cria (`addFloor`, `addSlab`, `addCeiling`) ou altera. */
export function commitArea(
  p: Project,
  s: { target: AreaTarget; editing?: string },
  outer: Vec2[],
  holes: Vec2[][],
  opts: CommitPerimeterOptions,
): CommitPerimeterResult {
  return s.editing ? editArea(p, s.target, s.editing, outer, holes, opts) : createArea(p, s.target, outer, holes, opts);
}

function createArea(p: Project, target: AreaTarget, outer: Vec2[], holes: Vec2[][], opts: CommitPerimeterOptions): CommitPerimeterResult {
  const levelId = opts.levelId;
  if (!levelId) return refuse('Nível não informado.');
  if (!p.levels.some((l) => l.id === levelId)) return refuse('O nível não existe no projeto.');
  const id = newId(target === 'slab' ? 'l' : 'f');
  const common = { id, levelId, boundary: outer, holes, mark: opts.mark ?? '', comments: opts.comments ?? '' };
  const message = `${NAME[target]} criado: ${areaText(outer, holes)}.`;
  const core = opts.extendToCore ? { outlineSource: coreOutline() } : {};
  if (target === 'floor') {
    const typeId = pickTypeId(p.floorTypes, opts.typeId);
    if (!typeId) return refuse('O projeto não tem tipo de piso.');
    const floor = makeFloor({ ...common, typeId, heightOffset: opts.heightOffset ?? 0, ...core });
    return checked(p, id, { type: 'addFloor', floor }, { ...floor, order: p.nextOrder }, validateProject, message);
  }
  if (target === 'slab') {
    const typeId = pickTypeId(p.slabTypes, opts.typeId);
    if (!typeId) return refuse('O projeto não tem tipo de laje.');
    const slab = makeSlab({ ...common, typeId, heightOffset: opts.heightOffset ?? 0, ...core });
    return checked(p, id, { type: 'addSlab', slab }, { ...slab, order: p.nextOrder }, validateProject, message);
  }
  const typeId = pickTypeId(p.ceilingTypes, opts.typeId);
  if (!typeId) return refuse('O projeto não tem tipo de forro.');
  const ceiling = makeCeiling({ ...common, typeId, heightOffset: opts.heightOffset ?? DEFAULT_CEILING_HEIGHT });
  return checked(p, id, { type: 'addCeiling', ceiling }, { ...ceiling, order: p.nextOrder }, ceilingIssues, message);
}

/** Confere o elemento novo com o validador do alvo; sem erro novo, devolve o comando de criação. */
function checked(
  p: Project,
  id: string,
  cmd: Command,
  el: Floor | Slab | Ceiling,
  check: (q: Project) => ValidationIssue[],
  message: string,
): CommitPerimeterResult {
  const problem = newError(p, withElement(p, el), id, check);
  if (problem) return refuse(`Não foi possível criar: ${problem}`);
  return { ok: true, id, commands: [cmd], message };
}

function editArea(p: Project, target: AreaTarget, id: string, outer: Vec2[], holes: Vec2[][], opts: CommitPerimeterOptions): CommitPerimeterResult {
  const el = p.elements[id];
  if (target === 'ceiling') return isCeiling(el) ? editCeiling(p, el, outer, holes, opts) : refuse(`${NAME[target]} não encontrado.`);
  if (target === 'floor') return isFloor(el) ? editPlate(p, el, outer, holes, opts) : refuse(`${NAME[target]} não encontrado.`);
  return isSlab(el) ? editPlate(p, el, outer, holes, opts) : refuse(`${NAME[target]} não encontrado.`);
}

/** Piso ou laje editados. Contorno travado nas paredes recusa a edição (decisão 0031): é preciso desvincular antes. */
function editPlate(p: Project, el: Floor | Slab, outer: Vec2[], holes: Vec2[][], opts: CommitPerimeterOptions): CommitPerimeterResult {
  if (el.outlineSource?.linked) return refuse(OUTLINE_LOCKED_MSG);
  const patch: Partial<Floor> & Partial<Slab> = { boundary: outer, holes: keepOrder(el.holes, holes) };
  if (opts.heightOffset !== undefined) patch.heightOffset = opts.heightOffset;
  if (opts.mark !== undefined) patch.mark = opts.mark;
  if (opts.comments !== undefined) patch.comments = opts.comments;
  if (opts.extendToCore !== undefined) {
    const src = outlineWithExtend(el.outlineSource, opts.extendToCore);
    if (src) patch.outlineSource = src;
  }
  const next = { ...el, ...patch } as Floor | Slab;
  const problem = newError(p, withElement(p, next), el.id, validateProject);
  if (problem) return refuse(`Alteração não aplicada: ${problem}`);
  const label = NAME[el.kind];
  return { ok: true, id: el.id, commands: [{ type: 'updateElements', ids: [el.id], patch }], message: `${label} atualizado: ${areaText(outer, patch.holes ?? holes)}.` };
}

/** Forro editado: um forro que acompanha o ambiente se solta no mesmo passo, como o contorno editado à mão. */
function editCeiling(p: Project, el: Ceiling, outer: Vec2[], holes: Vec2[][], opts: CommitPerimeterOptions): CommitPerimeterResult {
  const patch: Partial<Ceiling> = { boundary: outer, holes: keepOrder(areaSides(p, el).holes, holes) };
  if (opts.heightOffset !== undefined) patch.heightOffset = opts.heightOffset;
  if (opts.mark !== undefined) patch.mark = opts.mark;
  if (opts.comments !== undefined) patch.comments = opts.comments;
  const detach = followsRoom(el);
  const next: Ceiling = { ...el, ...patch, ...(detach ? { roomLinked: false } : {}) };
  const problem = newError(p, withElement(p, next), el.id, ceilingIssues);
  if (problem) return refuse(`Alteração não aplicada: ${problem}`);
  const update: Command = { type: 'updateElements', ids: [el.id], patch };
  const commands: Command[] = detach ? [{ type: 'detachCeilingRoom', id: el.id }, update] : [update];
  return { ok: true, id: el.id, commands, message: `Forro atualizado: ${areaText(outer, patch.holes ?? holes)}.` };
}
