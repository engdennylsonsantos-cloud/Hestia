import type { ReactElement } from 'react';
import { formatDimensionValue, dimensionValue, levelDimensions, levelTexts, type Dimension, type Id, type Project, type TextNote } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Group, NumField, Row, TextField } from './fields.tsx';

/** Cota ou texto de anotação selecionado (decisão 0019), pelo id no nível ativo; null se a seleção não é uma anotação. */
export function selectedNote(p: Project, levelId: Id, ids: Id[]): { dim?: Dimension; text?: TextNote } | null {
  if (ids.length !== 1) return null;
  const dim = levelDimensions(p, levelId).find((d) => d.id === ids[0]);
  if (dim) return { dim };
  const text = levelTexts(p, levelId).find((t) => t.id === ids[0]);
  return text ? { text } : null;
}

/** Grava a mudança de uma anotação; recusa do modelo vai para a barra de estado. */
function edit(run: () => void): void {
  try {
    run();
  } catch (e) {
    useUi.setState({ status: e instanceof Error ? e.message : 'Não foi possível alterar a anotação.' });
  }
}

/** Propriedades da cota (valor só leitura, deslocamento da linha) e do texto (conteúdo, altura em mm e rotação). */
export function AnnotationProps({ dim, text }: { dim?: Dimension; text?: TextNote }): ReactElement {
  const p = useProject();
  const levelId = useUi((s) => s.levelId);
  if (dim) {
    return (
      <Group title="Cota">
        <Row label="Valor"><span className="val">{formatDimensionValue(dimensionValue(p, dim))}</span></Row>
        <Row label="Texto" htmlFor="p-dtext">
          <TextField id="p-dtext" value={dim.text ?? ''} placeholder={formatDimensionValue(dimensionValue(p, dim))} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { text: v.trim() === '' ? undefined : v } }))} />
        </Row>
        <Row label="Deslocamento" htmlFor="p-doff">
          <NumField id="p-doff" value={dim.offset} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { offset: v } }))} unit="m" />
        </Row>
        <div className="prow"><span className="soft">Acompanha a parede quando a extremidade está presa a uma parede. Texto vazio mostra o valor medido.</span></div>
      </Group>
    );
  }
  if (!text) return <></>;
  return (
    <Group title="Texto">
      <Row label="Texto" htmlFor="p-ttext">
        <TextField id="p-ttext" value={text.text} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { text: v } }))} />
      </Row>
      <Row label="Altura" htmlFor="p-theight">
        <NumField id="p-theight" value={text.height} decimals={1} unit="mm" min={0.5} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { height: v } }))} />
      </Row>
      <Row label="Rotação" htmlFor="p-trot">
        <NumField id="p-trot" value={text.rotation} decimals={0} unit="°" onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { rotation: v } }))} />
      </Row>
    </Group>
  );
}
