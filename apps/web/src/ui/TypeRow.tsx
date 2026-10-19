import { useId, useState, type KeyboardEvent, type ReactElement } from 'react';
import type { Id } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import {
  compatibleTypes,
  instancesOfType,
  replaceStatus,
  replaceType,
  selectAllPlan,
  tryDeleteWallType,
  wallTypeDeleteBlock,
  type TypeKind,
} from '../editor/typeActions.ts';
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

/**
 * Linha de tipo no navegador. Clique usa o tipo ao desenhar e duplo clique edita o tipo.
 * As ações por tipo ficam ao lado e aparecem ao passar o mouse ou focar a linha.
 */
export function TypeRow({ kind, typeId, name, icon, active, onUse, onEdit }: TypeRowProps): ReactElement {
  const p = useProject();
  const panelId = useId();
  const [replacing, setReplacing] = useState(false);
  const [target, setTarget] = useState<Id>('');
  const uses = instancesOfType(p, kind, typeId).length;
  const choices = compatibleTypes(p, kind, typeId);
  const chosen = choices.some((c) => c.id === target) ? target : (choices[0]?.id ?? '');
  const deleteBlock = kind === 'wall' ? wallTypeDeleteBlock(p, typeId) : null;
  const replaceBlock = choices.length === 0 ? 'Não há outro tipo compatível.' : uses === 0 ? 'Este tipo não tem instâncias.' : null;

  const selectAll = (): void => {
    const plan = selectAllPlan(editor.project, kind, typeId, useUi.getState().levelId, name);
    useUi.setState({ selection: plan.ids, status: plan.status });
  };

  const apply = (): void => {
    const to = choices.find((c) => c.id === chosen);
    if (!to) return;
    try {
      const n = replaceType(editor.store, kind, typeId, to.id);
      useUi.setState({ status: replaceStatus(n, to.name) });
      setReplacing(false);
    } catch (e) {
      useUi.setState({ status: `Não foi possível substituir: ${errText(e)}` });
    }
  };

  const remove = (): void => {
    const r = tryDeleteWallType(editor.store, typeId);
    if (!r.ok) {
      useUi.setState({ status: `Não foi possível excluir «${name}»: ${r.error}` });
      return;
    }
    // Se o tipo excluído era o escolhido para desenhar, volta ao padrão do projeto.
    const ui = useUi.getState();
    if (ui.options.wallTypeId === typeId) useUi.setState({ options: { ...ui.options, wallTypeId: editor.project.defaults.wallTypeId } });
    useUi.setState({ status: `Tipo «${name}» excluído.` });
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
          <span className="meta">{uses}</span>
        </button>
        <div className="type-actions" role="group" aria-label={`Ações do tipo ${name}`}>
          <button
            type="button"
            className="ibtn type-act"
            title="Selecionar todas as instâncias"
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
          {kind === 'wall' ? (
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
    </>
  );
}
