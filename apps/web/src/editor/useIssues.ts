import { useEffect, useMemo, useState } from 'react';
import { ceilingIssues, outlineIssues, roofSurfaceIssues, roofWallIssues, roomValidationIssues, stairValidationIssues, wallFloorIssues } from '@hestia/engine';
import { validateProject, type Project, type ValidationIssue } from '@hestia/model';
import { useProject } from './controller.ts';

/** Avisos do projeto: os de validação, os de parede que ultrapassa ou fica fora do telhado (C2), os degraus da superfície, os do croqui e de norma das escadas, os de ambiente e os do contorno associativo de piso e laje. */
const allIssues = (p: Project): ValidationIssue[] => [...validateProject(p), ...roofWallIssues(p), ...roofSurfaceIssues(p), ...stairValidationIssues(p), ...roomValidationIssues(p), ...ceilingIssues(p), ...outlineIssues(p), ...wallFloorIssues(p)];

/** Acima deste número de elementos a validação espera o modelo parar de mudar. */
const LARGE_MODEL = 2000;
/** Tempo de silêncio, em ms, antes de revalidar um modelo grande. */
const SETTLE_MS = 300;

/**
 * Avisos de validação do projeto atual. Modelos pequenos são validados a cada versão;
 * modelos grandes só são revalidados depois de SETTLE_MS sem novas mudanças (até lá, mostram o resultado anterior).
 */
export function useIssues(): ValidationIssue[] {
  const project = useProject();
  const large = Object.keys(project.elements).length > LARGE_MODEL;

  const immediate = useMemo(() => (large ? null : allIssues(project)), [project, large]);

  const [settled, setSettled] = useState<ValidationIssue[]>([]);
  useEffect(() => {
    if (!large) return;
    const timer = setTimeout(() => setSettled(allIssues(project)), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [project, large]);

  return immediate ?? settled;
}
