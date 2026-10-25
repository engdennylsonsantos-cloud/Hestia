import { useId, useState, type KeyboardEvent, type ReactElement } from 'react';
import type { Id, Project } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import {
  compatibleTypes,
  duplicateFloorType,
  floorTypeDeleteBlock,
  instancesOfType,
  renameFloorType,
  replaceStatus,
  replaceType,
  selectAllPlan,
  tryDeleteFloorType,
  tryDeleteWallType,
  wallTypeDeleteBlock,
  whereUsed,
  type TypeKind,
} from '../editor/typeActions.ts';
import { duplicateSlabType, renameSlabType, slabTypeDeleteBlock, tryDeleteSlabType } from '../editor/slabTypeActions.ts';
import { duplicateCeilingType, renameCeilingType, ceilingTypeDeleteBlock, tryDeleteCeilingType } from '../editor/ceilingTypeActions.ts';
import { duplicateRoofType, renameRoofType, roofTypeDeleteBlock, tryDeleteRoofType } from '../editor/roofTypeActions.ts';
import { duplicateStairType, renameStairType, stairTypeDeleteBlock, tryDeleteStairType } from '../editor/stairTypeActions.ts';
import { Node, type MenuItem } from './browser/Tree.tsx';

interface TypeRowProps {
  kind: TypeKind;
  typeId: Id;
  name: string;
  icon: string;
  /** Tipo escolhido para desenhar (em negrito). */
  active: boolean;
  onUse: () => void;
  onEdit: () => void;
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : 'falha desconhecida');

/** Motivo pelo qual o tipo não pode ser excluído (parede, piso, laje…); null quando pode ou não é excluível (porta, janela). */
function deleteBlockOf(p: Project, kind: TypeKind, typeId: Id): string | null {
  if (kind === 'wall') return wallTypeDeleteBlock(p, typeId);
  if (kind === 'floor') return floorTypeDeleteBlock(p, typeId);
  if (kind === 'slab') return slabTypeDeleteBlock(p, typeId);
  if (kind === 'ceiling') return ceilingTypeDeleteBlock(p, typeId);
  if (kind === 'roof') return roofTypeDeleteBlock(p, typeId);
  if (kind === 'stair') return stairTypeDeleteBlock(p, typeId);
  return null;
}

/**
 * Tipo na árvore do navegador (Famílias ▸ Categoria ▸ Família ▸ Tipo). Clique usa o tipo ao desenhar (negrito), duplo
 * clique edita o tipo e o botão direito abre o menu: onde é usado, selecionar instâncias, substituir, duplicar, renomear, excluir.
 */
export function TypeRow({ kind, typeId, name, icon, active, onUse, onEdit }: TypeRowProps): ReactElement {
  const p = useProject();
  const panelId = useId();
  const [replacing, setReplacing] = useState(false);
  const [target, setTarget] = useState<Id>('');
  /** Depois de substituir, pergunta se o tipo antigo (que ficou sem uso) deve ser excluído. */
  const [askDelete, setAskDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(name);
  const uses = instancesOfType(p, kind, typeId).length;
  const choices = compatibleTypes(p, kind, typeId);
  const chosen = choices.some((c) => c.id === target) ? target : (choices[0]?.id ?? '');
  const deletable = kind === 'wall' || kind === 'floor' || kind === 'slab' || kind === 'ceiling' || kind === 'roof' || kind === 'stair';
  const renamable = kind === 'floor' || kind === 'slab' || kind === 'ceiling' || kind === 'roof' || kind === 'stair';
  const deleteBlock = deleteBlockOf(p, kind, typeId);
  const replaceBlock = choices.length === 0 ? 'Não há outro tipo compatível.' : uses === 0 ? 'Este tipo não tem instâncias.' : null;

  const selectAll = (): void => {
    const plan = selectAllPlan(editor.project, kind, typeId, useUi.getState().levelId, name);
    useUi.setState({ selection: plan.ids, status: plan.status });
  };
  const showWhereUsed = (): void => {
    useUi.setState({ status: whereUsed(editor, kind, typeId, name, (ids) => useUi.setState({ selection: ids })) });
  };
  const apply = (): void => {
    const to = choices.find((c) => c.id === chosen);
    if (!to) return;
    try {
      const n = replaceType(editor.store, kind, typeId, to.id);
      useUi.setState({ status: replaceStatus(n, to.name) });
      setReplacing(false);
      // Só pergunta se o tipo antigo pode mesmo ser excluído (o padrão do projeto não pode).
      setAskDelete(deletable && n > 0 && deleteBlockOf(editor.project, kind, typeId) === null);
    } catch (e) {
      useUi.setState({ status: `Não foi possível substituir: ${errText(e)}` });
    }
  };
  const remove = (): void => {
    const r = kind === 'floor' ? tryDeleteFloorType(editor.store, typeId) : kind === 'slab' ? tryDeleteSlabType(editor.store, typeId) : kind === 'ceiling' ? tryDeleteCeilingType(editor.store, typeId) : kind === 'roof' ? tryDeleteRoofType(editor.store, typeId) : kind === 'stair' ? tryDeleteStairType(editor.store, typeId) : tryDeleteWallType(editor.store, typeId);
    if (!r.ok) {
      useUi.setState({ status: `Não foi possível excluir «${name}»: ${r.error}` });
      return;
    }
    // Se o tipo excluído era o escolhido para desenhar, volta ao padrão do projeto.
    const ui = useUi.getState();
    if (kind === 'floor' && ui.options.floorTypeId === typeId) {
      useUi.setState({ options: { ...ui.options, floorTypeId: Object.keys(editor.project.floorTypes)[0] ?? ui.options.floorTypeId } });
    } else if (kind === 'slab' && ui.options.slabTypeId === typeId) {
      useUi.setState({ options: { ...ui.options, slabTypeId: Object.keys(editor.project.slabTypes)[0] ?? ui.options.slabTypeId } });
    } else if (kind === 'ceiling' && ui.options.ceilingTypeId === typeId) {
      useUi.setState({ options: { ...ui.options, ceilingTypeId: Object.keys(editor.project.ceilingTypes)[0] ?? ui.options.ceilingTypeId } });
    } else if (kind === 'roof' && ui.options.roofTypeId === typeId) {
      useUi.setState({ options: { ...ui.options, roofTypeId: Object.keys(editor.project.roofTypes)[0] ?? ui.options.roofTypeId } });
    } else if (kind === 'stair' && ui.options.stair?.typeId === typeId) {
      useUi.setState({ options: { ...ui.options, stair: { ...ui.options.stair, typeId: Object.keys(editor.project.stairTypes)[0] } } });
    } else if (kind === 'wall' && ui.options.wallTypeId === typeId) {
      useUi.setState({ options: { ...ui.options, wallTypeId: editor.project.defaults.wallTypeId } });
    }
    setAskDelete(false);
    useUi.setState({ status: `Tipo «${name}» excluído.` });
  };
  const duplicate = (): void => {
    const id = kind === 'slab' ? duplicateSlabType(editor.store, typeId) : kind === 'ceiling' ? duplicateCeilingType(editor.store, typeId) : kind === 'roof' ? duplicateRoofType(editor.store, typeId) : kind === 'stair' ? duplicateStairType(editor.store, typeId) : duplicateFloorType(editor.store, typeId);
    useUi.setState({ status: id ? `Tipo «${name}» duplicado. Duplo clique na cópia para editar.` : 'Não foi possível duplicar este tipo.' });
  };
  const applyRename = (): void => {
    const r = kind === 'slab' ? renameSlabType(editor.store, typeId, newName) : kind === 'ceiling' ? renameCeilingType(editor.store, typeId, newName) : kind === 'roof' ? renameRoofType(editor.store, typeId, newName) : kind === 'stair' ? renameStairType(editor.store, typeId, newName) : renameFloorType(editor.store, typeId, newName);
    if (!r.ok) {
      useUi.setState({ status: r.error });
      return;
    }
    setRenaming(false);
    useUi.setState({ status: `Tipo renomeado para «${newName.trim()}».` });
  };
  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); applyRename(); }
    else if (e.key === 'Escape') setRenaming(false);
  };

  const menu: MenuItem[] = [
    { label: 'Propriedades de tipo…', run: onEdit },
    { label: 'Usar ao desenhar', run: onUse },
    { label: 'Selecionar todas as instâncias (nível atual)', run: selectAll, sep: true },
    { label: 'Onde é usado', run: showWhereUsed, disabled: uses === 0, hint: uses === 0 ? 'Este tipo não tem instâncias.' : 'Vai ao nível com mais instâncias, enquadra e seleciona.' },
    { label: 'Substituir por outro tipo…', run: () => setReplacing(true), disabled: replaceBlock !== null, hint: replaceBlock ?? undefined },
    ...(renamable ? [{ label: 'Duplicar', run: duplicate, sep: true }, { label: 'Renomear', run: () => { setNewName(name); setRenaming(true); } }] : []),
    ...(deletable ? [{ label: 'Excluir', run: remove, disabled: deleteBlock !== null, danger: true, sep: !renamable, hint: deleteBlock ? `Não é possível excluir: ${deleteBlock}` : undefined }] : []),
  ];

  const label = renaming ? (
    <input className="input view-rename" aria-label="Novo nome do tipo" value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} onKeyDown={onRenameKey} onBlur={() => setRenaming(false)} onClick={(e) => e.stopPropagation()} />
  ) : name;

  const panels = (
    <>
      {replacing ? (
        <div id={panelId} className="type-replace" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setReplacing(false); } }}>
          <label>
            <span>Substituir por…</span>
            <select className="select" aria-label="Novo tipo" value={chosen} onChange={(e) => setTarget(e.target.value)}>
              {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="type-replace-btns">
            <button type="button" className="btn small primary" disabled={!chosen} onClick={apply}>Aplicar</button>
            <button type="button" className="btn small" onClick={() => setReplacing(false)}>Cancelar</button>
          </div>
        </div>
      ) : null}
      {askDelete ? (
        <div className="type-replace" role="group" aria-label={`Excluir o tipo ${name}`}>
          <span>Excluir o tipo «{name}», que ficou sem uso?</span>
          <div className="type-replace-btns">
            <button type="button" className="btn small danger" onClick={remove}>Excluir tipo</button>
            <button type="button" className="btn small" onClick={() => setAskDelete(false)}>Manter</button>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <Node
      id={`type:${kind}:${typeId}`}
      label={label}
      icon={icon}
      bold={active}
      title={`${name} — ${uses} ${uses === 1 ? 'uso' : 'usos'} no projeto. Clique usa ao desenhar; duplo clique edita; botão direito abre o menu.`}
      onSelect={onUse}
      onOpen={onEdit}
      menu={menu}
      after={panels}
    />
  );
}
