import { formatQuantity, isWall, unitsOf, wallMaxHeight, wallBaseElevation, type Project, type ValidationIssue, type Wall } from '@hestia/model';
import { resolveAllFloors } from './floors.ts';
import { attachSpans } from './wallAttach.ts';
import { resolveAllSlabs } from './slabs.ts';

/** Trecho sem piso ou laje menor que isto (m) não é avisado. */
const UNCOVERED_TOL = 1e-3;

/**
 * Avisos entre paredes e pisos/lajes (decisão 0023 §6, P9). `wall-floor-partial` (informativo): a base ou o topo anexado
 * só é coberto em parte do eixo; só o trecho coberto foi ajustado. `wall-attach-none` (aviso): anexada à base ou ao topo,
 * mas nenhum piso ou laje do nível cobre o eixo, então a cota fica no modelo. O topo não é avaliado quando o topo vem do
 * telhado (`attachTopToRoof`) ou quando a parede tem perfil superior (o perfil já define o topo). O motor calcula; a
 * interface junta. Como em `roofWallIssues`, a cobertura vem dos mesmos trechos que a geometria usa.
 */
export function wallFloorIssues(p: Project): ValidationIssue[] {
  const floors = resolveAllFloors(p);
  const slabs = resolveAllSlabs(p);
  const out: ValidationIssue[] = [];
  for (const e of Object.values(p.elements)) {
    if (!isWall(e)) continue;
    const bottom = e.attachBottomToFloor === true;
    const top = e.attachTopToFloor === true && e.topLevelId !== null && !(e.topProfile && e.sag === 0) && e.attachTopToRoof !== true;
    if (!bottom && !top) continue;
    const base = wallBaseElevation(p, e);
    const spans = attachSpans(e, base, base + wallMaxHeight(p, e), bottom ? e.levelId : null, top ? e.topLevelId : null, floors, slabs);
    const L = spans.reduce((s, sp) => s + (sp.t1 - sp.t0), 0);
    if (bottom) out.push(...endIssues(e, 'base', L, spans.filter((s) => s.onBottom), unitsOf(p)));
    if (top) out.push(...endIssues(e, 'topo', L, spans.filter((s) => s.onTop), unitsOf(p)));
  }
  return out;
}

/** Aviso de uma extremidade (base ou topo) pela soma dos trechos aplicados. */
function endIssues(e: Wall, nome: 'base' | 'topo', L: number, aplicados: Array<{ t0: number; t1: number }>, units: ReturnType<typeof unitsOf>): ValidationIssue[] {
  const coberto = aplicados.reduce((s, sp) => s + (sp.t1 - sp.t0), 0);
  if (coberto >= L - UNCOVERED_TOL) return [];
  const doAnexo = nome === 'base' ? 'à base' : 'ao topo';
  if (coberto <= UNCOVERED_TOL) {
    const fim = nome === 'base' ? 'a base fica na cota do nível' : 'o topo fica na altura normal';
    const cobre = nome === 'base' ? 'do nível' : 'do nível de topo';
    return [{ severity: 'warning', code: 'wall-attach-none', message: `Parede "${e.id}" está anexada ${doAnexo} no piso, mas nenhum piso ou laje ${cobre} cobre o eixo; ${fim}.`, elementId: e.id }];
  }
  return [
    {
      severity: 'info',
      code: 'wall-floor-partial',
      message: `Parede "${e.id}" está anexada ${doAnexo} no piso, mas só ${formatQuantity(units, 'length', coberto)} dos ${formatQuantity(units, 'length', L)} do eixo estão sobre piso ou laje; só o trecho coberto foi ajustado.`,
      elementId: e.id,
    },
  ];
}
