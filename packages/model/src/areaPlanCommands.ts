import type { Vec2 } from '@hestia/geom';
import { areaPlanIssue, areaPlanOf, copyPlanAnnotations, DEFAULT_AREA_GRAPHICS, DEFAULT_ROOM_CATEGORIES, planAnnotationsOf, roomTagIssue, type AreaPlan, type RoomCategory, type RoomTag } from './areaPlan.ts';
import type { Command } from './commands.ts';
import { dropOrphanViewports } from './sheetCommands.ts';
import { isRoom, type Id, type Project } from './types.ts';

/** Comandos da planta de área e da etiqueta de ambiente (fora do `switch` grande de `commands.ts`). */
export type AreaPlanCommand = Extract<Command, { type: 'addAreaPlan' | 'updateAreaPlan' | 'removeAreaPlan' | 'addRoomTag' | 'updateRoomTag' | 'removeRoomTag' | 'setRoomReference' | 'upsertRoomCategory' | 'removeRoomCategory' | 'upsertColorScheme' | 'removeColorScheme' }>;

const planOf = (p: Project, id: Id): AreaPlan => {
  const plan = areaPlanOf(p, id);
  if (!plan) throw new Error('Planta de área inexistente');
  return plan;
};

const roomOf = (p: Project, id: Id) => {
  const room = p.elements[id];
  if (!isRoom(room)) throw new Error('Ambiente inexistente');
  return room;
};

const finite = (v: Vec2): boolean => Number.isFinite(v.x) && Number.isFinite(v.y);

/** Aplica um comando de planta de área. Devolve false quando o comando não é desta família. */
export function applyAreaPlanCommand(p: Project, c: Command): boolean {
  switch (c.type) {
    case 'addAreaPlan': {
      const issue = areaPlanIssue(p, c.plan);
      if (issue) throw new Error(issue);
      if (areaPlanOf(p, c.plan.id)) throw new Error('Já existe planta de área com este id');
      const plan: AreaPlan = { ...c.plan, graphics: { ...DEFAULT_AREA_GRAPHICS, ...c.plan.graphics }, tags: [...c.plan.tags] };
      if (c.plan.annotations) plan.annotations = copyPlanAnnotations(c.plan.annotations);
      p.areaPlans = [...(p.areaPlans ?? []), plan];
      return true;
    }
    case 'updateAreaPlan': {
      const plan = planOf(p, c.id);
      const next: AreaPlan = { ...plan, ...c.patch, id: plan.id };
      const issue = areaPlanIssue(p, next);
      if (issue) throw new Error(issue);
      p.areaPlans = (p.areaPlans ?? []).map((x) => (x.id === plan.id ? next : x));
      return true;
    }
    case 'removeAreaPlan': {
      planOf(p, c.id);
      p.areaPlans = (p.areaPlans ?? []).filter((x) => x.id !== c.id);
      dropOrphanViewports(p);
      return true;
    }
    case 'addRoomTag': {
      const plan = planOf(p, c.planId);
      roomOf(p, c.tag.roomId);
      const issue = roomTagIssue(c.tag);
      if (issue) throw new Error(issue);
      if (c.tag.planId !== c.planId) throw new Error('A etiqueta aponta para outra planta');
      if (plan.tags.some((t) => t.id === c.tag.id)) throw new Error('Já existe etiqueta com este id na planta');
      if (plan.tags.some((t) => t.roomId === c.tag.roomId)) throw new Error('Este ambiente já tem etiqueta nesta planta');
      plan.tags = [...plan.tags, { ...c.tag, fields: [...c.tag.fields] }];
      return true;
    }
    case 'updateRoomTag': {
      const plan = planOf(p, c.planId);
      const tag = plan.tags.find((t) => t.id === c.id);
      if (!tag) throw new Error('Etiqueta inexistente');
      const next: RoomTag = { ...tag, ...c.patch, id: tag.id, planId: tag.planId, roomId: tag.roomId };
      const issue = roomTagIssue(next);
      if (issue) throw new Error(issue);
      plan.tags = plan.tags.map((t) => (t.id === tag.id ? next : t));
      return true;
    }
    case 'removeRoomTag': {
      const plan = planOf(p, c.planId);
      if (!plan.tags.some((t) => t.id === c.id)) throw new Error('Etiqueta inexistente');
      plan.tags = plan.tags.filter((t) => t.id !== c.id);
      return true;
    }
    case 'setRoomReference': {
      const room = roomOf(p, c.id);
      if (c.point === null) delete room.referencePoint;
      else {
        if (!finite(c.point)) throw new Error('A referência precisa ser um ponto finito');
        room.referencePoint = c.point;
      }
      return true;
    }
    case 'setRoomLabel': {
      const room = roomOf(p, c.id);
      if (c.position === null) delete room.labelPosition;
      else {
        if (!finite(c.position)) throw new Error('O rótulo precisa de um ponto finito');
        room.labelPosition = c.position;
      }
      if (c.rotation !== undefined) {
        if (!Number.isFinite(c.rotation)) throw new Error('A rotação do rótulo precisa ser um número');
        room.labelRotation = c.rotation;
      }
      if (c.leader !== undefined) room.labelLeader = c.leader;
      return true;
    }
    case 'upsertRoomCategory': {
      if (!c.category.name.trim()) throw new Error('A categoria precisa de nome');
      const list = p.roomCategories ?? DEFAULT_ROOM_CATEGORIES;
      p.roomCategories = list.some((x) => x.id === c.category.id) ? list.map((x) => (x.id === c.category.id ? c.category : x)) : [...list, c.category];
      return true;
    }
    case 'removeRoomCategory': {
      const inUse = Object.values(p.elements).some((e) => isRoom(e) && e.categoryId === c.id);
      if (inUse) throw new Error('Categoria em uso');
      p.roomCategories = (p.roomCategories ?? DEFAULT_ROOM_CATEGORIES).filter((x) => x.id !== c.id);
      return true;
    }
    case 'upsertColorScheme': {
      const s = c.scheme;
      if (!s.name.trim()) throw new Error('O esquema precisa de nome');
      if (s.by === 'areaRange' && (!s.ranges || s.ranges.length === 0)) throw new Error('O esquema por faixa precisa de ao menos uma faixa');
      const list = p.colorSchemes ?? [];
      p.colorSchemes = list.some((x) => x.id === s.id) ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s];
      return true;
    }
    case 'removeColorScheme': {
      p.colorSchemes = (p.colorSchemes ?? []).filter((x) => x.id !== c.id);
      for (const plan of p.areaPlans ?? []) if (plan.schemeId === c.id) delete plan.schemeId;
      return true;
    }
    default:
      return false;
  }
}

/** Remove das plantas as etiquetas de ambientes apagados (chamado por `removeRoom`/`deleteElements`). */
export function dropRoomTags(p: Project, ids: readonly Id[]): void {
  if (!p.areaPlans?.length) return;
  const doomed = new Set(ids);
  for (const plan of p.areaPlans) if (plan.tags.some((t) => doomed.has(t.roomId))) plan.tags = plan.tags.filter((t) => !doomed.has(t.roomId));
}

/**
 * Remove das anotações das plantas de área as etiquetas de elementos que não existem mais. Arquivos antigos
 * com etiqueta órfã continuam abrindo: a validação só avisa, e a próxima exclusão limpa a lista.
 */
export function prunePlanElementTags(p: Project): void {
  if (!p.areaPlans?.length) return;
  for (const plan of p.areaPlans) {
    const a = planAnnotationsOf(plan);
    const tags = a.tags.filter((t) => Boolean(p.elements[t.hostId]));
    if (tags.length !== a.tags.length) plan.annotations = { ...a, tags };
  }
}

/** Remove as plantas de área de um nível apagado. */
export function dropAreaPlansOfLevel(p: Project, levelId: Id): void {
  if (!p.areaPlans?.length) return;
  p.areaPlans = p.areaPlans.filter((x) => x.levelId !== levelId);
}


export const areaPlanCategories = (p: Pick<Project, 'roomCategories'>): RoomCategory[] => p.roomCategories ?? [];
