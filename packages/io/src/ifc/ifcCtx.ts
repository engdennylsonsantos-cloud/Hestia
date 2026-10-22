import type { Id, Project } from '@hestia/model';
import { ifcGuid } from './ifcGuid.ts';
import { OMIT, stepString, type StepWriter } from './ifcStep.ts';

/** Pavimento IFC: id da entidade IFCBUILDINGSTOREY, sua colocação, cota do nível e os elementos contidos nele. */
export interface IfcStorey {
  id: number;
  place: number;
  elev: number;
  contained: number[];
}

/** Estado da montagem: arquivo, contexto de geometria, pavimentos, materiais e paredes já escritas (id por `wallId`). */
export interface IfcCtx {
  p: Project;
  w: StepWriter;
  ctx: number;
  storeys: Map<Id, IfcStorey>;
  materials: Map<Id, number>;
  walls: Map<Id, number>;
}

/** Pavimento do nível, ou `undefined` quando o nível não existe no projeto (o elemento não sai). */
export const storeyOf = (c: IfcCtx, levelId: Id): IfcStorey | undefined => c.storeys.get(levelId);

/** IFCMATERIAL do material do projeto, criado uma vez. Material ausente vira "Material não definido". */
export function materialOf(c: IfcCtx, materialId: Id): number {
  const known = c.materials.get(materialId);
  if (known !== undefined) return known;
  const name = c.p.materials[materialId]?.name ?? 'Material não definido';
  const id = c.w.add('IFCMATERIAL', [stepString(name), OMIT, OMIT]);
  c.materials.set(materialId, id);
  return id;
}

/** Atributo de texto opcional: vazio vira `$`. */
export const optStr = (s: string | undefined): string => (s ? stepString(s) : OMIT);

/** GlobalId (texto STEP) de uma entidade, derivado da chave dela no projeto (`tipo:id`). */
export const gid = (key: string): string => stepString(ifcGuid(key));
