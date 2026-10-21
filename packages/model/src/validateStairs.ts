import { stairBaseZ, stairTopZ } from './queries.ts';
import { isStair, type Project, type Stair } from './types.ts';
import type { ValidationIssue } from './validate.ts';

const label = (e: { id: string; mark: string }): string => (e.mark ? `"${e.mark}" (${e.id})` : `"${e.id}"`);
const fmt = (n: number): string => (Number.isFinite(n) ? n.toFixed(3).replace('.', ',') : String(n));

/** Erros simples de modelo da escada: tipo, níveis e topo acima da base. A geometria do croqui é do motor. */
function stairIssuesOf(p: Project, s: Stair): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const name = label(s);
  const push = (code: string, message: string): void => void out.push({ severity: 'error', code, message, elementId: s.id });
  if (!p.stairTypes[s.typeId]) push('stair-type-missing', `Escada ${name} usa o tipo "${s.typeId}", que não existe no projeto.`);
  const levelOk = p.levels.some((l) => l.id === s.levelId);
  if (!levelOk) push('stair-level-missing', `Escada ${name} está no nível "${s.levelId}", que não existe.`);
  const topOk = s.topLevelId === null || p.levels.some((l) => l.id === s.topLevelId);
  if (!topOk) push('stair-top-level-missing', `Escada ${name} tem topo no nível "${s.topLevelId}", que não existe.`);
  // A cota só é conferida quando os níveis existem; senão o cálculo usaria cota 0.
  if (levelOk && topOk) {
    const base = stairBaseZ(p, s);
    const top = stairTopZ(p, s);
    if (!(top > base)) push('stair-top-below-base', `Topo da escada ${name} (cota ${fmt(top)} m) não fica acima da base (cota ${fmt(base)} m).`);
  }
  return out;
}

/** Problemas de modelo de todas as escadas do projeto. */
export function stairIssues(p: Project): ValidationIssue[] {
  return Object.values(p.elements)
    .filter(isStair)
    .flatMap((s) => stairIssuesOf(p, s));
}
