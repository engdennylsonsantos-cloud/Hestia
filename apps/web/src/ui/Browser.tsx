import type { ReactElement } from 'react';
import { useProject } from '../editor/controller.ts';
import { FamiliesTree } from './browser/Families.tsx';
import { Node, Tree } from './browser/Tree.tsx';
import { SchedulesTree, SheetsTree, ViewsTree } from './browser/Views.tsx';
import { PanelHead } from './PanelHead.tsx';

/**
 * Navegador de projeto no padrão Revit: "Vistas (todas)", "Tabelas/Quantidades (todas)", "Pranchas (todas)", "Famílias",
 * "Grupos" e "Links". Duplo clique abre ou edita; botão direito traz as ações (renomear, duplicar, excluir…).
 * Materiais, níveis e pesos de linha saíram daqui: ficam nas abas Gerenciar e Arquitetura da faixa.
 */
export function Browser(): ReactElement {
  const p = useProject();
  return (
    <aside className="side" aria-label="Navegador de projeto">
      <PanelHead panel="browser" name={`Navegador de projeto - ${p.name}`} closeLabel="Fechar o navegador de projeto">
        Navegador de projeto - {p.name}
      </PanelHead>
      <div className="panel-scroll">
        <Tree label="Navegador de projeto">
          <ViewsTree />
          <SchedulesTree />
          <SheetsTree />
          <FamiliesTree />
          <Node id="g:groups" label="Grupos" group empty="Ainda não disponível." />
          <Node id="g:links" label="Links do Revit" group empty="Ainda não disponível." />
        </Tree>
      </div>
    </aside>
  );
}
