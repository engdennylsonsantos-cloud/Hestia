import { useEffect, useState } from 'react';
import type { ValidationIssue } from '@hestia/model';
import { useProject } from './controller.ts';
import { agendarAvisos } from './avisosProjeto.ts';

/**
 * Avisos de validação do projeto atual. Todo modelo é validado depois de SETTLE_MS sem novas mudanças (até lá, mostra o
 * resultado anterior; na abertura, lista vazia). Antes, modelos com até 2000 elementos eram validados na mesma renderização,
 * o que somava o custo dos avisos à abertura. O resultado final é o mesmo: `agendarAvisos` usa `avisosDoProjeto`.
 */
export function useIssues(): ValidationIssue[] {
  const project = useProject();
  const [settled, setSettled] = useState<ValidationIssue[]>([]);
  useEffect(() => agendarAvisos(project, setSettled), [project]);
  return settled;
}
