import type { ReactElement } from 'react';
import type { Id, OutlineSource, ProjectStore } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { Group, Row } from './fields.tsx';

/** Só o que o grupo lê de um piso ou laje (decisão 0023 §8.2). */
export interface OutlineHolder {
  id: Id;
  outlineSource?: OutlineSource;
}

/** Nome do modo de origem, como aparece no painel (decisão 0023 §8.2a). */
export const OUTLINE_MODE_LABEL: Record<OutlineSource['mode'], string> = {
  'walls-finish': 'face de acabamento',
  'walls-core': 'núcleo',
  perimeter: 'perímetro externo',
};

/** Estado do grupo "Contorno" para a seleção: texto e quais ids podem ser desvinculados ou revinculados. */
export interface OutlineView {
  text: string;
  detachIds: Id[];
  relinkIds: Id[];
}

/**
 * Texto e ações do grupo "Contorno" de piso ou laje. Vinculado: "Desvincular" fica ativo. Estático (editado à mão):
 * "Revincular às paredes" fica ativo. Sem origem (desenhado por croqui): os dois ficam desabilitados.
 */
export function outlineView(els: readonly OutlineHolder[]): OutlineView {
  const linked = els.filter((e) => e.outlineSource?.linked);
  const estatico = els.filter((e) => e.outlineSource && !e.outlineSource.linked);
  const semOrigem = els.filter((e) => !e.outlineSource);
  const modes = new Set(linked.map((e) => e.outlineSource!.mode));
  const parts: string[] = [];
  if (linked.length > 0) {
    const modo = modes.size === 1 ? OUTLINE_MODE_LABEL[[...modes][0]!] : null;
    parts.push(modo ? `Vinculado às paredes (modo: ${modo})` : 'Vinculado às paredes (modos variados)');
  }
  if (estatico.length > 0) parts.push('Estático (editado à mão)');
  if (semOrigem.length > 0) parts.push('Sem vínculo (desenhado por croqui)');
  return {
    text: parts.join(' · ') || 'Sem elementos',
    detachIds: linked.map((e) => e.id),
    relinkIds: estatico.map((e) => e.id),
  };
}

/** Aplica o vínculo a todos os ids num único passo de desfazer. Ids sem origem são ignorados pelo comando. */
export function runOutlineAction(store: Pick<ProjectStore, 'transaction' | 'exec'>, action: 'detach' | 'relink', ids: Id[]): void {
  if (ids.length === 0) return;
  const label = action === 'detach' ? 'Desvincular contorno' : 'Revincular contorno às paredes';
  store.transaction(label, () => {
    for (const id of ids) store.exec({ type: action === 'detach' ? 'detachOutline' : 'relinkOutline', id });
  });
}

/** Grupo "Contorno" do painel de piso e de laje: estado do vínculo às paredes e os botões Desvincular / Revincular. */
export function OutlineGroup({ elements }: { elements: readonly OutlineHolder[] }): ReactElement {
  const view = outlineView(elements);
  return (
    <Group title="Contorno">
      <Row label="Estado">
        <span className="val" id="p-outline-state">{view.text}</span>
      </Row>
      <div className="row">
        <button className="btn small" disabled={view.detachIds.length === 0} onClick={() => runOutlineAction(editor.store, 'detach', view.detachIds)}>
          Desvincular
        </button>
        <button className="btn small" disabled={view.relinkIds.length === 0} onClick={() => runOutlineAction(editor.store, 'relink', view.relinkIds)}>
          Revincular às paredes
        </button>
      </div>
    </Group>
  );
}
