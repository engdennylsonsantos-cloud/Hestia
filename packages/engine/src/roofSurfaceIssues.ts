import { formatQuantity, isRoof, unitsOf, type Project, type Roof, type ValidationIssue } from '@hestia/model';
import { resolveAllRoofs } from './roofs.ts';

/** Nome do telhado no aviso: a marca quando existe, com o id entre parênteses (como o validador do modelo). */
const label = (r: Roof): string => (r.mark ? `"${r.mark}" (${r.id})` : `"${r.id}"`);

/**
 * Aviso não bloqueante (`roof-surface-step`): a superfície do telhado tem degrau num canto reentrante, onde uma empena
 * encosta em beiral. O telhado continua criado e desenhado; o aviso aponta o telhado para o painel de avisos ("Ir para").
 * Vem do motor (depende da geometria resolvida), como `roofWallIssues`.
 */
export function roofSurfaceIssues(p: Project): ValidationIssue[] {
  const units = unitsOf(p);
  const out: ValidationIssue[] = [];
  for (const res of resolveAllRoofs(p)) {
    const steps = res.steps ?? [];
    if (steps.length === 0) continue;
    const roof = p.elements[res.roofId];
    if (!isRoof(roof)) continue;
    const worst = Math.max(...steps.map((s) => s.dz));
    const where =
      steps.length === 1
        ? `um degrau de ${formatQuantity(units, 'smallLength', worst)} no canto reentrante`
        : `degraus de até ${formatQuantity(units, 'smallLength', worst)} em ${steps.length} cantos reentrantes`;
    out.push({
      severity: 'warning',
      code: 'roof-surface-step',
      message: `Telhado ${label(roof)}: a superfície tem ${where} (empena encostando em beiral); ajuste a inclinação das arestas vizinhas ou use outra forma.`,
      elementId: roof.id,
    });
  }
  return out;
}
