import { ToolBase } from './base.ts';

/**
 * Ferramenta Grade (Revit: Grid). Contrato fixado na Fase 0: id `grid`, opções em `ToolOptions.grid`. A lógica
 * (linha, arco, escolher linhas e multissegmento) é implementada pelo agente G1 neste arquivo.
 */
export class GridTool extends ToolBase {
  readonly id = 'grid';
  readonly label = 'Grade';
  readonly hint = 'Grade: clique no início e no fim do eixo.';

  protected reset(): void {}

  protected busy(): boolean {
    return false;
  }
}
