import { ceilingTypeThickness, isCeiling, isWall, levelElevation, wallsOnLevel, type Ceiling, type Project, type ValidationIssue } from '@hestia/model';
import { elementZRange } from './viewClass.ts';

/** Tolerância (m) para a comparação de cotas: 1 mm. */
const EPS = 1e-3;

const label = (c: Ceiling): string => (c.mark ? `"${c.mark}" (${c.id})` : `"${c.id}"`);

/**
 * Avisos dos forros (decisão 0021): forro sem contorno, tipo ausente, e forro cuja face inferior fica acima da parede
 * mais baixa do nível (o forro deveria ficar abaixo do topo das paredes que o cercam). Não bloqueia nada.
 */
export function ceilingIssues(p: Project): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const c of Object.values(p.elements).filter(isCeiling)) {
    const name = label(c);
    if (c.boundary.length < 3) {
      out.push({ severity: 'error', code: 'ceiling-no-boundary', message: `Forro ${name} não tem contorno (menos de 3 pontos).`, elementId: c.id });
      continue;
    }
    const t = p.ceilingTypes[c.typeId];
    if (!t) {
      out.push({ severity: 'error', code: 'ceiling-type-missing', message: `Forro ${name} usa um tipo que não existe no projeto.`, elementId: c.id });
      continue;
    }
    const walls = wallsOnLevel(p, c.levelId).filter(isWall);
    if (walls.length === 0) continue;
    const lowestTop = Math.min(...walls.map((w) => elementZRange(p, w)?.z1 ?? Infinity));
    const underside = levelElevation(p, c.levelId) + c.heightOffset - ceilingTypeThickness(t);
    if (underside > lowestTop + EPS) {
      out.push({
        severity: 'warning',
        code: 'ceiling-above-wall',
        message: `Forro ${name} fica acima da parede mais baixa do nível (face inferior em ${underside.toFixed(2).replace('.', ',')} m; parede em ${lowestTop.toFixed(2).replace('.', ',')} m).`,
        elementId: c.id,
      });
    }
  }
  return out;
}
