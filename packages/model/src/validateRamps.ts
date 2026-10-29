import { rampBaseZ, rampTopZ } from './queries.ts';
import { isRamp, type Project, type Ramp } from './types.ts';
import { STAIR_MIN_HEIGHT } from './validateStairs.ts';
import type { ValidationIssue } from './validate.ts';

const label = (e: { id: string; mark: string }): string => (e.mark ? `"${e.mark}" (${e.id})` : `"${e.id}"`);

/** Erros simples de modelo da rampa: tipo, níveis e topo acima da base. A geometria do croqui é do motor. */
function rampIssuesOf(p: Project, r: Ramp): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(r);
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: r.id });
  if (!p.rampTypes[r.typeId]) push('ramp-type-missing', `Rampa ${name} usa o tipo "${r.typeId}", que não existe no projeto.`);
  const levelOk = p.levels.some((l) => l.id === r.levelId);
  if (!levelOk) push('ramp-level-missing', `Rampa ${name} está no nível "${r.levelId}", que não existe.`);
  const topOk = r.topLevelId === null || p.levels.some((l) => l.id === r.topLevelId);
  if (!topOk) push('ramp-top-level-missing', `Rampa ${name} tem topo no nível "${r.topLevelId}", que não existe.`);
  if (levelOk && topOk && !(rampTopZ(p, r) - rampBaseZ(p, r) > STAIR_MIN_HEIGHT)) {
    push('ramp-top-not-above', 'O nível de topo deve estar acima do nível da rampa.');
  }
  return out;
}

/** Problemas de modelo de todas as rampas do projeto. */
export function rampIssues(p: Project): ValidationIssue[] {
  return Object.values(p.elements)
    .filter(isRamp)
    .flatMap((r) => rampIssuesOf(p, r));
}
