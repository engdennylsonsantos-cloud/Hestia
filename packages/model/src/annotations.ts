import { len, sub, type Vec2 } from '@hestia/geom';
import { DIM_MIN_LENGTH } from './dimension.ts';
import { newId } from './ids.ts';
import { type Dimension, type DetailLine, type DetailRegion, type ElementTag, type Id, type Project, type RoomSeparator, type TextNote } from './types.ts';

/**
 * Anotações da planta (decisão 0019): cotas e textos ficam em cada nível. Os comandos recusam com mensagem pt-BR
 * e não alteram o projeto; remover o nível leva as anotações junto (elas moram no próprio nível).
 */
export type AnnotationCommand =
  | { type: 'addDimension'; levelId: Id; dimension: Dimension }
  | { type: 'updateDimension'; levelId: Id; id: Id; patch: Partial<Omit<Dimension, 'id'>> }
  | { type: 'removeDimension'; levelId: Id; id: Id }
  | { type: 'addText'; levelId: Id; text: TextNote }
  | { type: 'updateText'; levelId: Id; id: Id; patch: Partial<Omit<TextNote, 'id'>> }
  | { type: 'removeText'; levelId: Id; id: Id }
  | { type: 'addRoomSeparator'; levelId: Id; separator: RoomSeparator }
  | { type: 'removeRoomSeparator'; levelId: Id; id: Id }
  | { type: 'updateRoomSeparator'; levelId: Id; id: Id; patch: Partial<Omit<RoomSeparator, 'id'>> }
  | { type: 'addDetailLine'; levelId: Id; item: DetailLine }
  | { type: 'updateDetailLine'; levelId: Id; id: Id; patch: Partial<Omit<DetailLine, 'id'>> }
  | { type: 'removeDetailLine'; levelId: Id; id: Id }
  | { type: 'addDetailRegion'; levelId: Id; item: DetailRegion }
  | { type: 'updateDetailRegion'; levelId: Id; id: Id; patch: Partial<Omit<DetailRegion, 'id'>> }
  | { type: 'removeDetailRegion'; levelId: Id; id: Id }
  | { type: 'addTag'; levelId: Id; item: ElementTag }
  | { type: 'updateTag'; levelId: Id; id: Id; patch: Partial<Omit<ElementTag, 'id'>> }
  | { type: 'removeTag'; levelId: Id; id: Id };

const finite = (v: Vec2): boolean => Number.isFinite(v.x) && Number.isFinite(v.y);

/** Motivo de recusa de uma cota, ou null. */
export function dimensionIssue(d: Dimension): string | null {
  if (!finite(d.a) || !finite(d.b)) return 'As coordenadas da cota devem ser números finitos.';
  if (!Number.isFinite(d.offset)) return 'O deslocamento da cota deve ser um número finito.';
  if (d.textAt && !finite(d.textAt)) return 'A posição do texto da cota deve ser finita.';
  if (d.textHeight !== undefined && !(Number.isFinite(d.textHeight) && d.textHeight > 0)) return 'A altura do texto da cota deve ser maior que zero.';
  if (d.precision !== undefined && ![0, 1, 2, 3].includes(d.precision)) return 'A precisão da cota deve ter entre zero e três casas decimais.';
  if (len(sub(d.b, d.a)) < DIM_MIN_LENGTH) return 'A cota precisa de dois pontos distintos.';
  return null;
}

/** Motivo de recusa de um texto, ou null. */
export function textIssue(t: TextNote): string | null {
  if (!finite(t.at)) return 'A posição do texto deve ser um ponto finito.';
  if (t.text.trim() === '') return 'O texto não pode ser vazio.';
  if (!(Number.isFinite(t.height) && t.height > 0)) return 'A altura do texto deve ser maior que zero.';
  if (!Number.isFinite(t.rotation)) return 'A rotação do texto deve ser um número finito.';
  if (t.width !== undefined && !(Number.isFinite(t.width) && t.width > 0)) return 'A largura do texto deve ser maior que zero.';
  if (t.leader && (t.leader.length < 2 || t.leader.some((p) => !finite(p)))) return 'A chamada precisa de dois pontos válidos.';
  return null;
}

export const levelDimensions = (p: Pick<Project, 'levels'>, levelId: Id): Dimension[] =>
  p.levels.find((l) => l.id === levelId)?.dimensions ?? [];

/** Comprimento mínimo (m) de uma linha de separação de ambiente. */
export const ROOM_SEPARATOR_MIN_LENGTH = 0.05;

/** Motivo de recusa de uma linha de separação, ou null. Pontos distintos e não muito próximos. */
export function roomSeparatorIssue(r: RoomSeparator): string | null {
  if (!finite(r.a) || !finite(r.b)) return 'As coordenadas da linha de separação devem ser números finitos.';
  if (len(sub(r.b, r.a)) < ROOM_SEPARATOR_MIN_LENGTH) return 'A linha de separação precisa de dois pontos distintos.';
  return null;
}

export const levelRoomSeparators = (p: Pick<Project, 'levels'>, levelId: Id): RoomSeparator[] =>
  p.levels.find((l) => l.id === levelId)?.roomSeparators ?? [];

export const levelTexts = (p: Pick<Project, 'levels'>, levelId: Id): TextNote[] =>
  p.levels.find((l) => l.id === levelId)?.texts ?? [];

/** Aplica um comando de anotação sobre o rascunho do projeto. Lança Error em texto pt-BR se recusar. */
export function applyAnnotationCommand(p: Project, c: AnnotationCommand): void {
  const level = p.levels.find((l) => l.id === c.levelId);
  if (!level) throw new Error('Nível inexistente');
  switch (c.type) {
    case 'addDimension': {
      const issue = dimensionIssue(c.dimension);
      if (issue) throw new Error(issue);
      level.dimensions = [...(level.dimensions ?? []), c.dimension];
      break;
    }
    case 'updateDimension': {
      const old = level.dimensions?.find((d) => d.id === c.id);
      if (!old) throw new Error('Cota inexistente');
      const next: Dimension = { ...old, ...c.patch, id: old.id };
      const issue = dimensionIssue(next);
      if (issue) throw new Error(issue);
      level.dimensions = level.dimensions!.map((d) => (d.id === c.id ? next : d));
      break;
    }
    case 'removeDimension':
      if (!level.dimensions?.some((d) => d.id === c.id)) throw new Error('Cota inexistente');
      level.dimensions = level.dimensions.filter((d) => d.id !== c.id);
      break;
    case 'addText': {
      const issue = textIssue(c.text);
      if (issue) throw new Error(issue);
      level.texts = [...(level.texts ?? []), c.text];
      break;
    }
    case 'updateText': {
      const old = level.texts?.find((t) => t.id === c.id);
      if (!old) throw new Error('Texto inexistente');
      const next: TextNote = { ...old, ...c.patch, id: old.id };
      const issue = textIssue(next);
      if (issue) throw new Error(issue);
      level.texts = level.texts!.map((t) => (t.id === c.id ? next : t));
      break;
    }
    case 'removeText':
      if (!level.texts?.some((t) => t.id === c.id)) throw new Error('Texto inexistente');
      level.texts = level.texts.filter((t) => t.id !== c.id);
      break;
    case 'addRoomSeparator': {
      const issue = roomSeparatorIssue(c.separator);
      if (issue) throw new Error(issue);
      level.roomSeparators = [...(level.roomSeparators ?? []), c.separator];
      break;
    }
    case 'removeRoomSeparator':
      if (!level.roomSeparators?.some((r) => r.id === c.id)) throw new Error('Linha de separação inexistente');
      level.roomSeparators = level.roomSeparators.filter((r) => r.id !== c.id);
      break;
    case 'updateRoomSeparator': {
      const old = level.roomSeparators?.find((r) => r.id === c.id);
      if (!old) throw new Error('Linha de separação inexistente');
      const next: RoomSeparator = { ...old, ...c.patch, id: old.id };
      const issue = roomSeparatorIssue(next);
      if (issue) throw new Error(issue);
      level.roomSeparators = level.roomSeparators!.map((r) => (r.id === c.id ? next : r));
      break;
    }
    case 'addDetailLine':
      if (!finite(c.item.a) || !finite(c.item.b) || len(sub(c.item.b, c.item.a)) < ROOM_SEPARATOR_MIN_LENGTH) throw new Error('A linha de detalhe precisa de dois pontos distintos.');
      level.detailLines = [...(level.detailLines ?? []), c.item];
      break;
    case 'updateDetailLine': {
      const old = level.detailLines?.find((x) => x.id === c.id);
      if (!old) throw new Error('Linha de detalhe inexistente');
      const next = { ...old, ...c.patch, id: old.id };
      if (!finite(next.a) || !finite(next.b) || len(sub(next.b, next.a)) < ROOM_SEPARATOR_MIN_LENGTH) throw new Error('A linha de detalhe precisa de dois pontos distintos.');
      level.detailLines = level.detailLines!.map((x) => x.id === c.id ? next : x);
      break;
    }
    case 'removeDetailLine':
      if (!level.detailLines?.some((x) => x.id === c.id)) throw new Error('Linha de detalhe inexistente');
      level.detailLines = level.detailLines.filter((x) => x.id !== c.id);
      break;
    case 'addDetailRegion':
      if (c.item.boundary.length < 3 || c.item.boundary.some((p) => !finite(p))) throw new Error('A região precisa de pelo menos três pontos válidos.');
      level.detailRegions = [...(level.detailRegions ?? []), c.item];
      break;
    case 'updateDetailRegion': {
      const old = level.detailRegions?.find((x) => x.id === c.id);
      if (!old) throw new Error('Região de detalhe inexistente');
      const next = { ...old, ...c.patch, id: old.id };
      if (next.boundary.length < 3 || next.boundary.some((p) => !finite(p))) throw new Error('A região precisa de pelo menos três pontos válidos.');
      level.detailRegions = level.detailRegions!.map((x) => x.id === c.id ? next : x);
      break;
    }
    case 'removeDetailRegion':
      if (!level.detailRegions?.some((x) => x.id === c.id)) throw new Error('Região de detalhe inexistente');
      level.detailRegions = level.detailRegions.filter((x) => x.id !== c.id);
      break;
    case 'addTag':
      if (!finite(c.item.at) || !p.elements[c.item.hostId]) throw new Error('A etiqueta precisa estar ligada a um elemento existente.');
      level.tags = [...(level.tags ?? []), c.item];
      break;
    case 'updateTag': {
      const old = level.tags?.find((x) => x.id === c.id);
      if (!old) throw new Error('Etiqueta inexistente');
      const next = { ...old, ...c.patch, id: old.id };
      if (!finite(next.at) || !p.elements[next.hostId]) throw new Error('A etiqueta precisa estar ligada a um elemento existente.');
      level.tags = level.tags!.map((x) => x.id === c.id ? next : x);
      break;
    }
    case 'removeTag':
      if (!level.tags?.some((x) => x.id === c.id)) throw new Error('Etiqueta inexistente');
      level.tags = level.tags.filter((x) => x.id !== c.id);
      break;
  }
}

export type RemoveAnnotation = Extract<AnnotationCommand, { type: 'removeDimension' | 'removeText' | 'removeRoomSeparator' | 'removeDetailLine' | 'removeDetailRegion' | 'removeTag' }>;

/** Comandos de exclusão para as cotas e os textos do nível cujos ids estão em `ids` (o resto são elementos). */
export function annotationRemovals(p: Pick<Project, 'levels'>, levelId: Id, ids: Id[]): RemoveAnnotation[] {
  const want = new Set(ids);
  const out: RemoveAnnotation[] = [];
  for (const d of levelDimensions(p, levelId)) if (want.has(d.id)) out.push({ type: 'removeDimension', levelId, id: d.id });
  for (const t of levelTexts(p, levelId)) if (want.has(t.id)) out.push({ type: 'removeText', levelId, id: t.id });
  const level = p.levels.find((l) => l.id === levelId);
  for (const x of level?.detailLines ?? []) if (want.has(x.id)) out.push({ type: 'removeDetailLine', levelId, id: x.id });
  for (const x of level?.detailRegions ?? []) if (want.has(x.id)) out.push({ type: 'removeDetailRegion', levelId, id: x.id });
  for (const x of level?.tags ?? []) if (want.has(x.id)) out.push({ type: 'removeTag', levelId, id: x.id });
  return out;
}

/** Ids das cotas e textos do nível que estão em `ids`. */
export function annotationIdsIn(p: Pick<Project, 'levels'>, levelId: Id, ids: Id[]): Id[] {
  const level = p.levels.find((l) => l.id === levelId);
  const have = new Set([...levelDimensions(p, levelId), ...levelTexts(p, levelId), ...(level?.detailLines ?? []), ...(level?.detailRegions ?? []), ...(level?.tags ?? [])].map((a) => a.id));
  return ids.filter((id) => have.has(id));
}

/**
 * Comandos que movem por `d` as cotas e os textos de `ids` (ou, com `copy`, criam cópias com ids novos). Uma cota movida
 * perde as referências às paredes: a posição passa a ser livre.
 */
export function annotationMoveCommands(p: Pick<Project, 'levels'>, levelId: Id, ids: Id[], d: Vec2, copy: boolean): AnnotationCommand[] {
  const want = new Set(ids);
  const shift = (v: Vec2): Vec2 => ({ x: v.x + d.x, y: v.y + d.y });
  const out: AnnotationCommand[] = [];
  for (const dim of levelDimensions(p, levelId)) {
    if (!want.has(dim.id)) continue;
    const moved = { ...dim, a: shift(dim.a), b: shift(dim.b), ...(dim.textAt ? { textAt: shift(dim.textAt) } : {}) };
    if (copy) out.push({ type: 'addDimension', levelId, dimension: { ...moved, id: newId('dim'), refs: undefined } });
    else out.push({ type: 'updateDimension', levelId, id: dim.id, patch: { ...moved, refs: undefined } });
  }
  for (const t of levelTexts(p, levelId)) {
    if (!want.has(t.id)) continue;
    const movedLeader = t.leader?.map(shift);
    if (copy) out.push({ type: 'addText', levelId, text: { ...t, id: newId('txt'), at: shift(t.at), leader: movedLeader } });
    else out.push({ type: 'updateText', levelId, id: t.id, patch: { at: shift(t.at), leader: movedLeader } });
  }
  const level = p.levels.find((l) => l.id === levelId);
  for (const item of level?.detailLines ?? []) if (want.has(item.id)) {
    const moved = { a: shift(item.a), b: shift(item.b) };
    if (copy) out.push({ type: 'addDetailLine', levelId, item: { ...item, id: newId('dl'), ...moved } });
    else out.push({ type: 'updateDetailLine', levelId, id: item.id, patch: moved });
  }
  for (const item of level?.detailRegions ?? []) if (want.has(item.id)) {
    const boundary = item.boundary.map(shift);
    if (copy) out.push({ type: 'addDetailRegion', levelId, item: { ...item, id: newId('dr'), boundary } });
    else out.push({ type: 'updateDetailRegion', levelId, id: item.id, patch: { boundary } });
  }
  for (const item of level?.tags ?? []) if (want.has(item.id)) {
    const at = shift(item.at);
    if (copy) out.push({ type: 'addTag', levelId, item: { ...item, id: newId('tag'), at } });
    else out.push({ type: 'updateTag', levelId, id: item.id, patch: { at } });
  }
  return out;
}
