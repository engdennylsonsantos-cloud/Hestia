import { len, sub, type Vec2 } from '@hestia/geom';
import { DIM_MIN_LENGTH } from './dimension.ts';
import { newId } from './ids.ts';
import { type Dimension, type Id, type Project, type TextNote } from './types.ts';

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
  | { type: 'removeText'; levelId: Id; id: Id };

const finite = (v: Vec2): boolean => Number.isFinite(v.x) && Number.isFinite(v.y);

/** Motivo de recusa de uma cota, ou null. */
export function dimensionIssue(d: Dimension): string | null {
  if (!finite(d.a) || !finite(d.b)) return 'As coordenadas da cota devem ser números finitos.';
  if (!Number.isFinite(d.offset)) return 'O deslocamento da cota deve ser um número finito.';
  if (len(sub(d.b, d.a)) < DIM_MIN_LENGTH) return 'A cota precisa de dois pontos distintos.';
  return null;
}

/** Motivo de recusa de um texto, ou null. */
export function textIssue(t: TextNote): string | null {
  if (!finite(t.at)) return 'A posição do texto deve ser um ponto finito.';
  if (t.text.trim() === '') return 'O texto não pode ser vazio.';
  if (!(Number.isFinite(t.height) && t.height > 0)) return 'A altura do texto deve ser maior que zero.';
  if (!Number.isFinite(t.rotation)) return 'A rotação do texto deve ser um número finito.';
  return null;
}

export const levelDimensions = (p: Pick<Project, 'levels'>, levelId: Id): Dimension[] =>
  p.levels.find((l) => l.id === levelId)?.dimensions ?? [];

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
  }
}

export type RemoveAnnotation = Extract<AnnotationCommand, { type: 'removeDimension' | 'removeText' }>;

/** Comandos de exclusão para as cotas e os textos do nível cujos ids estão em `ids` (o resto são elementos). */
export function annotationRemovals(p: Pick<Project, 'levels'>, levelId: Id, ids: Id[]): RemoveAnnotation[] {
  const want = new Set(ids);
  const out: RemoveAnnotation[] = [];
  for (const d of levelDimensions(p, levelId)) if (want.has(d.id)) out.push({ type: 'removeDimension', levelId, id: d.id });
  for (const t of levelTexts(p, levelId)) if (want.has(t.id)) out.push({ type: 'removeText', levelId, id: t.id });
  return out;
}

/** Ids das cotas e textos do nível que estão em `ids`. */
export function annotationIdsIn(p: Pick<Project, 'levels'>, levelId: Id, ids: Id[]): Id[] {
  const have = new Set([...levelDimensions(p, levelId), ...levelTexts(p, levelId)].map((a) => a.id));
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
    const moved = { a: shift(dim.a), b: shift(dim.b), offset: dim.offset };
    if (copy) out.push({ type: 'addDimension', levelId, dimension: { id: newId('dim'), ...moved } });
    else out.push({ type: 'updateDimension', levelId, id: dim.id, patch: { ...moved, refs: undefined } });
  }
  for (const t of levelTexts(p, levelId)) {
    if (!want.has(t.id)) continue;
    if (copy) out.push({ type: 'addText', levelId, text: { ...t, id: newId('txt'), at: shift(t.at) } });
    else out.push({ type: 'updateText', levelId, id: t.id, patch: { at: shift(t.at) } });
  }
  return out;
}
