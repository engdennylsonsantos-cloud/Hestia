import type { ReactElement } from 'react';
import { projectGridTypes, type Grid } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, Row, TextField } from './fields.tsx';
import { fmtMm } from './gridUi.ts';

/**
 * Propriedades de uma grade selecionada: nome, tipo e bolhas nas pontas. Cada alteração é um comando do modelo
 * (`updateGrid`); recusa do modelo (nome repetido, por exemplo) aparece na barra de status, como nas outras ações.
 */
export function GridProperties({ grid }: { grid: Grid }): ReactElement {
  const p = useProject();
  const types = projectGridTypes(p);
  const type = types.find((t) => t.id === grid.typeId);
  const change = (patch: Partial<Omit<Grid, 'id' | 'order'>>, label: string): void => {
    try {
      editor.store.exec({ type: 'updateGrid', id: grid.id, patch }, label);
    } catch (e) {
      useUi.setState({ status: e instanceof Error ? e.message : 'Operação recusada.' });
    }
  };
  return (
    <>
      <Group title="Grade">
        <Row label="Nome" htmlFor="g-name">
          <TextField id="g-name" value={grid.name} onCommit={(v) => change({ name: v.trim() }, 'Renomear grade')} />
        </Row>
        <Row label="Tipo" htmlFor="g-type">
          <select id="g-type" className="select" value={grid.typeId} onChange={(e) => change({ typeId: e.target.value }, 'Trocar tipo de grade')}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Row>
        <Row label="Bolha no início"><Check id="g-bubble-start" checked={grid.bubbleStart} onChange={(v) => change({ bubbleStart: v }, 'Bolha no início da grade')} /></Row>
        <Row label="Bolha no fim"><Check id="g-bubble-end" checked={grid.bubbleEnd} onChange={(v) => change({ bubbleEnd: v }, 'Bolha no fim da grade')} /></Row>
        <div className="prow"><span /><button id="g-type-edit" className="chiplink" onClick={() => useUi.setState({ dialog: 'gridType', dialogArg: grid.typeId })}>Editar tipo…</button></div>
      </Group>
      <Group title="Geometria" open={false}>
        <Row label="Pontos" readOnly><span className="val">{grid.points.length}</span></Row>
        {grid.sag !== 0 ? <Row label="Flecha do arco" readOnly><span className="val">{fmtMm(grid.sag * 1000, 0)} mm</span></Row> : null}
        {type ? <Row label="Segmento central" readOnly fromType><span className="val">{type.centerSegment === 'continuous' ? 'Contínuo' : type.centerSegment === 'none' ? 'Só as pontas' : 'Personalizado'}</span></Row> : null}
      </Group>
    </>
  );
}
