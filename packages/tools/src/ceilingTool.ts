import { ToolBase } from './base.ts';

/**
 * Forro (Revit: Ceiling). Sem modos próprios: o contorno é criado pelo modo "Criar/Editar perímetro" (com "Por ambiente"
 * para o forro que acompanha o ambiente), para onde a faixa desvia a escolha (`PerimeterMode.intercepta`). A classe fica
 * no registro de ferramentas e não chega a ser ativada.
 */
export class CeilingTool extends ToolBase {
  readonly id = 'ceiling';
  readonly label = 'Forro';
  readonly hint = 'Forro: crie o contorno pelo modo Criar/Editar perímetro.';

  protected reset(): void {
    // Sem estado próprio: nada a limpar.
  }

  protected busy(): boolean {
    return false;
  }
}
