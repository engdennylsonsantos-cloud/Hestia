import { stairBaseZ, stairTopZ } from './queries.ts';
import { isStair, type Project, type Stair } from './types.ts';
import type { ValidationIssue } from './validate.ts';

const label = (e: { id: string; mark: string }): string => (e.mark ? `"${e.mark}" (${e.id})` : `"${e.id}"`);

/**
 * Altura mínima (m) entre a base e o topo: topo a 1 mm ou menos acima da base conta como não acima (decisão 0011 §3).
 * Com altura igual ou menor, a escada não gera degraus nem furo (o motor não gera geometria para ela).
 */
export const STAIR_MIN_HEIGHT = 0.001;

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
  if (levelOk && topOk && !(stairTopZ(p, s) - stairBaseZ(p, s) > STAIR_MIN_HEIGHT)) {
    push('stair-top-not-above', 'O nível de topo deve estar acima do nível da escada.');
  }
  return out;
}

/** Problemas de modelo de todas as escadas do projeto. */
export function stairIssues(p: Project): ValidationIssue[] {
  return Object.values(p.elements)
    .filter(isStair)
    .flatMap((s) => stairIssuesOf(p, s));
}
