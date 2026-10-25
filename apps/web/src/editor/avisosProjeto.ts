import { ceilingIssues, outlineIssues, projectIssues, roofSurfaceIssues, roofWallIssues, roomValidationIssues, stairValidationIssues, wallFloorIssues } from '@hestia/engine';
import { validateProject, type Project, type ValidationIssue } from '@hestia/model';

/** Avisos do projeto: os de validação, os de parede que ultrapassa ou fica fora do telhado (C2), os degraus da superfície, os do croqui e de norma das escadas, os de ambiente, os do contorno associativo de piso e laje e os de abertura/parede do projeto. */
export const avisosDoProjeto = (p: Project): ValidationIssue[] => [...validateProject(p), ...roofWallIssues(p), ...roofSurfaceIssues(p), ...stairValidationIssues(p), ...roomValidationIssues(p), ...ceilingIssues(p), ...outlineIssues(p), ...wallFloorIssues(p), ...projectIssues(p)];

/** Tempo de silêncio, em ms, antes de calcular os avisos de um projeto. Vale para qualquer tamanho de modelo. */
export const SETTLE_MS = 300;

/**
 * Agenda o cálculo dos avisos de `p` para depois de `ms` (padrão SETTLE_MS). O resultado é o mesmo de `avisosDoProjeto(p)`,
 * só chega depois do primeiro quadro. Devolve a função que cancela a agenda (troca de projeto ou desmontagem).
 */
export function agendarAvisos(p: Project, receber: (avisos: ValidationIssue[]) => void, ms: number = SETTLE_MS): () => void {
  const timer = setTimeout(() => receber(avisosDoProjeto(p)), ms);
  return () => clearTimeout(timer);
}
