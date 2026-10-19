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
import { Icon } from './Icon.tsx';

interface TypeRowProps {
  kind: TypeKind;
  typeId: Id;
  name: string;
  icon: string;
  /** Tipo escolhido para desenhar. */
  active: boolean;
  onUse: () => void;
  onEdit: () => void;
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : 'falha desconhecida');

/** Motivo pelo qual o tipo não pode ser excluído (parede, piso ou laje); null quando pode ou não é excluível (porta, janela). */
function deleteBlockOf(p: Project, kind: TypeKind, typeId: Id): string | null {
  if (kind === 'wall') return wallTypeDeleteBlock(p, typeId);
  if (kind === 'floor') return floorTypeDeleteBlock(p, typeId);
  if (kind === 'slab') return slabTypeDeleteBlock(p, typeId);
  return null;
}

/**
 * Linha de tipo no navegador. Clique usa o tipo ao desenhar e duplo clique edita o tipo.
 * As ações por tipo ficam ao lado e aparecem ao passar o mouse ou focar a linha.
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
  /** Tipos de parede, piso e laje podem ser excluídos aqui; portas e janelas não. */
  const deletable = kind === 'wall' || kind === 'floor' || kind === 'slab';
  const deleteBlock = deleteBlockOf(p, kind, typeId);
  const replaceBlock = choices.length === 0 ? 'Não há outro tipo compatível.' : uses === 0 ? 'Este tipo não tem instâncias.' : null;

  const selectAll = (): void => {
    const plan = selectAllPlan(editor.project, kind, typeId, useUi.getState().levelId, name);
    useUi.setState({ selection: plan.ids, status: plan.status });
  };

  const showWhereUsed = (): void => {
    const status = whereUsed(editor, kind, typeId, name, (ids) => useUi.setState({ selection: ids }));
    useUi.setState({ status });
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
    const r = kind === 'floor' ? tryDeleteFloorType(editor.store, typeId) : kind === 'slab' ? tryDeleteSlabType(editor.store, typeId) : tryDeleteWallType(editor.store, typeId);
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
    } else if (kind === 'wall' && ui.options.wallTypeId === typeId) {
      useUi.setState({ options: { ...ui.options, wallTypeId: editor.project.defaults.wallTypeId } });
    }
    setAskDelete(false);
    useUi.setState({ status: `Tipo «${name}» excluído.` });
  };

  const duplicate = (): void => {
    const id = kind === 'slab' ? duplicateSlabType(editor.store, typeId) : duplicateFloorType(editor.store, typeId);
    useUi.setState({ status: id ? `Tipo «${name}» duplicado. Duplo clique na cópia para editar.` : 'Não foi possível duplicar este tipo.' });
  };

  const applyRename = (): void => {
    const r = kind === 'slab' ? renameSlabType(editor.store, typeId, newName) : renameFloorType(editor.store, typeId, newName);
    if (!r.ok) {
      useUi.setState({ status: r.error });
      return;
    }
    setRenaming(false);
    useUi.setState({ status: `Tipo renomeado para «${newName.trim()}».` });
  };

  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyRename();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setRenaming(false);
    }
  };

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setReplacing(false);
    }
  };

  return (
    <>
      <div className={`type-row${replacing ? ' open' : ''}`}>
        <button className={`leaf${active ? ' on' : ''}`} title="Clique para usar este tipo ao desenhar. Duplo clique edita o tipo." onClick={onUse} onDoubleClick={onEdit}>
          <Icon name={icon} size={14} /> {name}
          <span className="meta" title={`${uses} ${uses === 1 ? 'uso' : 'usos'} no projeto`}>
            {uses}
          </span>
        </button>
        <div className="type-actions" role="group" aria-label={`Ações do tipo ${name}`}>
          <button
            type="button"
            className="ibtn type-act"
            title={uses === 0 ? 'Este tipo não tem instâncias.' : 'Onde é usado: vai ao nível com mais instâncias, enquadra e seleciona'}
            aria-label={`Onde é usado: ${name}`}
            disabled={uses === 0}
            onClick={showWhereUsed}
          >
            <Icon name="fit" size={13} />
          </button>
          <button
            type="button"
            className="ibtn type-act"
            title="Selecionar as instâncias deste nível"
            aria-label={`Selecionar todas as instâncias de ${name}`}
            onClick={selectAll}
          >
            <Icon name="select" size={13} />
          </button>
          <button
            type="button"
            className={`ibtn type-act${replacing ? ' on' : ''}`}
            title={replaceBlock ?? 'Substituir por outro tipo em todas as instâncias'}
            aria-label={`Substituir o tipo ${name} por outro`}
            aria-expanded={replacing}
            aria-controls={replacing ? panelId : undefined}
            disabled={replaceBlock !== null}
            onClick={() => setReplacing((v) => !v)}
          >
            <Icon name="rotate" size={13} />
          </button>
          {kind === 'floor' || kind === 'slab' ? (
            <>
              <button type="button" className="ibtn type-act" title="Duplicar tipo" aria-label={`Duplicar tipo ${name}`} onClick={duplicate}>
                <Icon name="plus" size={13} />
              </button>
              <button
                type="button"
                className={`ibtn type-act${renaming ? ' on' : ''}`}
                title="Renomear tipo"
                aria-label={`Renomear tipo ${name}`}
                aria-expanded={renaming}
                onClick={() => {
                  setNewName(name);
                  setRenaming((v) => !v);
                }}
              >
                <Icon name="edit" size={13} />
              </button>
            </>
          ) : null}
          {deletable ? (
            <button
              type="button"
              className="ibtn type-act danger"
              title={deleteBlock ? `Não é possível excluir: ${deleteBlock}` : 'Excluir tipo'}
              aria-label={`Excluir tipo ${name}`}
              disabled={deleteBlock !== null}
              onClick={remove}
            >
              <Icon name="trash" size={13} />
            </button>
          ) : null}
        </div>
      </div>
      {renaming ? (
        <div className="type-replace" role="group" aria-label={`Renomear o tipo ${name}`}>
          <label>
            <span>Novo nome</span>
            <input className="input" aria-label="Novo nome do tipo" value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} onKeyDown={onRenameKey} />
          </label>
          <div className="type-replace-btns">
            <button type="button" className="btn small primary" onClick={applyRename}>
              Renomear
            </button>
            <button type="button" className="btn small" onClick={() => setRenaming(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {replacing ? (
        <div id={panelId} className="type-replace" onKeyDown={onPanelKey}>
          <label>
            <span>Substituir por…</span>
            <select className="select" aria-label="Novo tipo" value={chosen} onChange={(e) => setTarget(e.target.value)}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="type-replace-btns">
            <button type="button" className="btn small primary" disabled={!chosen} onClick={apply}>
              Aplicar
            </button>
            <button type="button" className="btn small" onClick={() => setReplacing(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {askDelete ? (
        <div className="type-replace" role="group" aria-label={`Excluir o tipo ${name}`}>
          <span>Excluir o tipo «{name}», que ficou sem uso?</span>
          <div className="type-replace-btns">
            <button type="button" className="btn small danger" onClick={remove}>
              Excluir tipo
            </button>
            <button type="button" className="btn small" onClick={() => setAskDelete(false)}>
              Manter
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
