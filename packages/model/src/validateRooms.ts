import { isRoom, type Project, type Room } from './types.ts';
import type { ValidationIssue } from './validate.ts';

const label = (r: Room): string => (r.number ? `"${r.number}" (${r.id})` : `"${r.id}"`);

/** Erros simples de modelo do ambiente: nome vazio e nível inexistente. O circuito é validado no motor (resolveRooms). */
function roomIssuesOf(p: Project, r: Room): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(r);
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: r.id });
  if (!r.name.trim()) push('room-empty-name', `Ambiente ${name} está sem nome.`);
  if (!p.levels.some((l) => l.id === r.levelId)) push('room-level-missing', `Ambiente ${name} está no nível "${r.levelId}", que não existe.`);
  return out;
}

/** Problemas de modelo de todos os ambientes do projeto. */
export function roomIssues(p: Project): ValidationIssue[] {
  return Object.values(p.elements)
    .filter(isRoom)
    .flatMap((r) => roomIssuesOf(p, r));
}
