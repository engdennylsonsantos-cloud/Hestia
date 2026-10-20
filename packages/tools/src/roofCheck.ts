import { resolveRoofs, roofProfileError } from '@hestia/engine';
import { isRoof, type Id, type Project, type Roof } from '@hestia/model';
import type { ToolEnv } from './types.ts';

/** Chaves que mudam a geometria das águas. Só uma alteração delas é conferida pelo motor. */
const GEOMETRY_KEYS: Array<keyof Roof> = ['boundary', 'holes', 'shape', 'edgeSlopes', 'edgeOverhangs', 'slopePercent', 'dir', 'planes', 'profile', 'levelId', 'heightOffset'];

/** Motivo para um telhado com forma que não produz água, em português. */
function noWaterReason(r: Roof): string {
  if (r.shape === 'edges' && r.edgeSlopes.every((v) => v === null)) return 'nenhuma aresta define inclinação; marque ao menos uma aresta';
  if (r.shape === 'free') return 'nenhuma água fica sobre o beiral';
  if (r.shape === 'edges') return 'as arestas que definem inclinação não formam águas';
  if (r.shape === 'extrusion') return roofProfileError(r.profile) ?? 'o perfil não cobre o contorno';
  return 'o contorno não gera águas com esta forma';
}

/**
 * Motivo pelo qual o motor não gera águas para `roofs` no estado dado, ou null quando todos têm águas. Usa o projeto com
 * estes telhados no lugar dos guardados; os demais telhados do nível não são conferidos. A ferramenta usa antes de criar
 * ou alterar, para que o telhado nunca desapareça em silêncio.
 */
export function roofProblem(p: Project, roofs: Roof[]): string | null {
  if (roofs.length === 0) return null;
  const elements = { ...p.elements };
  for (const r of roofs) elements[r.id] = r;
  const q: Project = { ...p, elements };
  for (const r of roofs) {
    if (!p.levels.some((l) => l.id === r.levelId)) return 'o nível do telhado não existe';
    if (!p.roofTypes[r.typeId]) return 'o tipo de telhado não existe no projeto';
    if (r.boundary.length < 3) return 'o contorno tem menos de 3 pontos';
    const res = resolveRoofs(q, r.levelId).find((x) => x.roofId === r.id);
    if (!res) return 'o telhado não pôde ser resolvido';
    if (res.problem) return res.problem;
    if (res.planes.length === 0) return noWaterReason(r);
  }
  return null;
}

/**
 * Motivo para aplicar `patch` aos telhados `ids`, ou null. Alterações que não mexem na geometria (marca, comentários,
 * tipo, beiral) não são conferidas: um telhado já sem águas continua editável nelas.
 */
export function roofPatchProblem(p: Project, ids: Id[], patch: Partial<Roof>): string | null {
  if (!Object.keys(patch).some((k) => GEOMETRY_KEYS.includes(k as keyof Roof))) return null;
  const roofs = ids.map((id) => p.elements[id]).filter(isRoof).map((r) => ({ ...r, ...patch }));
  return roofProblem(p, roofs);
}

/** Aplica a alteração de telhados pelo ambiente da ferramenta, se o motor ainda gerar águas; senão não aplica e avisa. */
export function commitRoofPatch(env: Pick<ToolEnv, 'project' | 'exec' | 'say'>, ids: Id[], patch: Partial<Roof>): boolean {
  const problem = roofPatchProblem(env.project(), ids, patch);
  if (problem) {
    env.say(`Alteração não aplicada: ${problem}`);
    return false;
  }
  env.exec({ type: 'updateElements', ids, patch });
  return true;
}
