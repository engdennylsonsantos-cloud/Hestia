import { resolveRooms } from '@hestia/engine';
import { levelRoomSeparators, isWall, ProjectStore, type Command, type Id, type Project } from '@hestia/model';

/** Resumo de um ambiente para o aviso de fusão de áreas. */
export interface AreaMergeRoom {
  id: Id;
  name: string;
  number: string;
  area: number;
}

/** Fusão prevista ao remover parede/separador: o maior ambiente fica e os menores saem. */
export interface AreaMergePreview {
  keep: AreaMergeRoom[];
  remove: AreaMergeRoom[];
  /** Área final do circuito, depois da remoção. */
  mergedArea: number;
  message: string;
}

const roomSummary = (room: { roomId: Id; name: string; number: string; area: number }): AreaMergeRoom => ({
  id: room.roomId,
  name: room.name,
  number: room.number,
  area: room.area,
});

const labelOf = (r: AreaMergeRoom): string => `${r.number ? `${r.number} — ` : ''}${r.name || 'Ambiente'}`;
const areaText = (a: number): string => `${a.toFixed(2).replace('.', ',')} m²`;

/**
 * Previsão pura da regra de áreas: simula as remoções num projeto clonado, resolve os ambientes e, se uma parede ou
 * separador fizer dois circuitos caírem no mesmo polígono, mantém o de maior área atual e propõe apagar os menores.
 * `null` quando não há fusão nova (ou quando a remoção não mexe em circuito).
 */
export function areaMergePreview(
  project: Project,
  levelId: Id,
  commands: readonly Command[],
  removingCircuit: boolean,
): AreaMergePreview | null {
  if (!removingCircuit) return null;
  const before = new Map(resolveRooms(project, levelId).map((r) => [r.roomId, r] as const));
  const sim = new ProjectStore(structuredClone(project));
  for (const c of commands) sim.exec(c);
  const after = resolveRooms(sim.project, levelId);
  const groups = new Map<object, typeof after>();
  for (const r of after) {
    if (r.problem !== null || !r.polygon) continue;
    const group = groups.get(r.polygon);
    if (group) group.push(r);
    else groups.set(r.polygon, [r]);
  }

  const keep: AreaMergeRoom[] = [];
  const remove: AreaMergeRoom[] = [];
  let mergedArea = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Só avisa quando a remoção realmente junta circuitos que antes eram distintos; duplicata que já existia não muda.
    const antes = new Set(group.map((r) => JSON.stringify(before.get(r.roomId)?.polygon ?? null)));
    if (antes.size < 2) continue;
    const ordered = [...group].sort((a, b) => {
      const da = before.get(a.roomId)?.area ?? 0;
      const db = before.get(b.roomId)?.area ?? 0;
      return db - da;
    });
    const maior = ordered[0]!;
    const menor = ordered.slice(1);
    keep.push(roomSummary({ ...maior, area: before.get(maior.roomId)?.area ?? maior.area }));
    for (const r of menor) remove.push(roomSummary({ ...r, area: before.get(r.roomId)?.area ?? r.area }));
    mergedArea = Math.max(mergedArea, maior.area);
  }
  if (keep.length === 0 || remove.length === 0) return null;
  const message = [
    'Ao remover esta parede/separador, os ambientes abaixo vão se fundir:',
    ...keep.map((r) => `• Fica: ${labelOf(r)} (${areaText(r.area)}).`),
    ...remove.map((r) => `• Sai: ${labelOf(r)} (${areaText(r.area)}).`),
    `A área final do circuito será ${areaText(mergedArea)}. Confirmar a expansão e apagar o(s) ambiente(s) menor(es)?`,
  ].join('\n');
  return { keep, remove, mergedArea, message };
}

/** Ids dos ambientes menores que a confirmação deve apagar junto com a parede/separador. */
export const roomsToRemove = (preview: AreaMergePreview): Id[] => preview.remove.map((r) => r.id);

/** A remoção selecionada inclui parede ou linha de separador (os dois casos que podem fundir circuitos). */
export function removesCircuit(project: Project, levelId: Id, ids: readonly Id[]): boolean {
  const separators = new Set(levelRoomSeparators(project, levelId).map((r) => r.id));
  return ids.some((id) => isWall(project.elements[id]) || separators.has(id));
}
