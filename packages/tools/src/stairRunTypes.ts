import { defaultStairTypeId, type Id, type Project, type StairType } from '@hestia/model';
import { stairTypeId } from './stairCommands.ts';
import type { StairRunShape } from './stairRunPlan.ts';

/**
 * Tipo é de caracol? O modelo não tem um campo próprio para isso: valem os tipos de estilo poste, os de id `stt_caracol…`
 * e os de nome com "caracol" (uma cópia de tipo caracol mantém o nome). Usado para listar os tipos compatíveis com a forma.
 */
export function isSpiralStairType(t: Pick<StairType, 'id' | 'name' | 'runStyle'>): boolean {
  return t.runStyle === 'post' || t.id.startsWith('stt_caracol') || /caracol/i.test(t.name);
}

/**
 * Tipos que a forma aceita: o caracol usa só os tipos caracol; as demais formas usam os outros. Sem nenhum tipo do grupo,
 * a lista volta a ser todos os tipos (o projeto sempre oferece algum).
 */
export function stairTypesForShape(p: Project, shape: StairRunShape): StairType[] {
  const all = Object.values(p.stairTypes);
  const spiral = shape === 'spiral';
  const list = all.filter((t) => isSpiralStairType(t) === spiral);
  return list.length ? list : all;
}

/**
 * Tipo válido para a forma: o pedido, se é compatível; senão o padrão do projeto, se compatível; senão o 1º compatível.
 * Sem tipo compatível nenhum, cai no `stairTypeId` comum (tipo pedido, padrão ou o primeiro do projeto).
 */
export function stairTypeForShape(p: Project, shape: StairRunShape, want?: Id): Id | null {
  const list = stairTypesForShape(p, shape);
  const ids = new Set(list.map((t) => t.id));
  if (want && ids.has(want)) return want;
  if (ids.has(defaultStairTypeId)) return defaultStairTypeId;
  return list[0]?.id ?? stairTypeId(p, want);
}
