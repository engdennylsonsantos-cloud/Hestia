import type { ReactElement } from 'react';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { cadDrawingsOf, cadLevelName, frameCad, removeCad, selectCad, setCadVisible } from '../../editor/cadActions.ts';
import { Node, type MenuItem } from './Tree.tsx';

/**
 * Nó "CAD importado" do Navegador de projeto: os desenhos DXF do projeto, com mostrar/ocultar, selecionar, enquadrar e
 * excluir no menu de contexto. Duplo clique abre a planta do nível e seleciona o desenho.
 */
export function CadTree(): ReactElement {
  const p = useProject();
  const cads = cadDrawingsOf(p);
  return (
    <Node
      id="g:cad"
      label="CAD importado"
      icon="layers"
      group
      open
      empty="Nenhum desenho CAD. Menu Inserir → Importar CAD (DXF)."
      menu={[
        { label: 'Importar CAD (DXF)…', run: () => useUi.setState({ dialog: 'importCad', dialogArg: null }) },
        { label: 'Gerenciar CAD…', run: () => useUi.setState({ dialog: 'manageCad', dialogArg: null }) },
      ]}
    >
      {cads.map((c) => {
        const visivel = c.visible !== false;
        const menu: MenuItem[] = [
          { label: visivel ? 'Ocultar' : 'Mostrar', run: () => setCadVisible(c, !visivel) },
          { label: 'Selecionar', run: () => selectCad(c) },
          { label: 'Enquadrar', run: () => { selectCad(c); frameCad(c); } },
          { label: 'Renomear…', run: () => useUi.setState({ dialog: 'manageCad', dialogArg: null }) },
          { label: 'Excluir', run: () => removeCad(c), danger: true, sep: true },
        ];
        return (
          <Node
            key={c.id}
            id={`cad:${c.id}`}
            label={visivel ? c.name : `${c.name} (oculto)`}
            icon="layers"
            title={`${cadLevelName(p, c)} · ${c.layers.length} camada(s), ${c.paths.length} traço(s), ${c.texts.length} texto(s). Duplo clique seleciona; botão direito: mostrar/ocultar, enquadrar, excluir.`}
            onOpen={() => selectCad(c)}
            menu={menu}
          />
        );
      })}
    </Node>
  );
}
