import { isWall, type Project, type ValidationIssue } from '@hestia/model';
import { resolveAllFloors } from './floors.ts';
import { resolveAllRoofs } from './roofs.ts';
import { roofAxisReport } from './roofWall.ts';
import { resolveAllSlabs } from './slabs.ts';
import { wallZRange } from './wallZ.ts';

/** Folga (m) para a parede encostar na face inferior sem contar como atravessamento. */
const TOP_TOL = 1e-3;
/** Trecho sem telhado menor que isto (m) não é avisado. */
const UNCOVERED_TOL = 1e-3;

const fmt = (m: number): string => m.toFixed(2).replace('.', ',');

/**
 * Avisos entre paredes e telhados (docs/paridade/telhados C2). `wall-roof-uncovered`: parede anexada ao telhado cujo eixo
 * está fora do telhado em parte (ou todo). `wall-roof-pierce`: parede sem anexo que fica mais alta que a face inferior
 * do telhado num ponto do eixo coberto (atravessa o telhado). Parede curva entra pela face inferior amostrada ao longo do
 * arco (≤ 0,25 m); fica na altura normal, sem topo ajustado. O motor calcula; a interface junta.
 */
export function roofWallIssues(p: Project): ValidationIssue[] {
  const roofs = resolveAllRoofs(p);
  const floors = resolveAllFloors(p);
  const slabs = resolveAllSlabs(p);
  const out: ValidationIssue[] = [];
  for (const e of Object.values(p.elements)) {
    if (!isWall(e)) continue;
    const rep = roofAxisReport(e, roofs);
    if (!rep) continue;
    if (e.attachTopToRoof) {
      if (rep.uncovered <= UNCOVERED_TOL) continue;
      const whole = rep.uncovered >= rep.length - UNCOVERED_TOL;
      out.push({
        severity: 'warning',
        code: 'wall-roof-uncovered',
        message: whole
          ? `Parede "${e.id}" está anexada ao telhado, mas o eixo não está sob telhado nenhum; o topo fica na altura normal.`
          : `Parede "${e.id}" está anexada ao telhado, mas ${fmt(rep.uncovered)} m do eixo estão fora dele; esse trecho fica na altura normal.`,
        elementId: e.id,
      });
    } else if (rep.minBottom !== null) {
      const z = wallZRange(p, e, floors, slabs, roofs);
      const top = z.z0 + z.height;
      if (top > rep.minBottom + TOP_TOL) {
        out.push({
          severity: 'warning',
          code: 'wall-roof-pierce',
          message: `Parede "${e.id}" passa ${fmt(top - rep.minBottom)} m da face inferior do telhado; ative o topo ajustado ao telhado ou baixe a parede.`,
          elementId: e.id,
        });
      }
    }
  }
  return out;
}
