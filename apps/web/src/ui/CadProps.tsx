import type { ReactElement } from 'react';
import type { CadDrawing } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { frameCad, removeCad } from '../editor/cadActions.ts';
import { Group, NumField, Row, TextField } from './fields.tsx';

/**
 * Propriedades do CAD importado: nome, nível, visibilidade e deslocamento vertical. O desenho em si (camadas, traços e
 * textos) é somente leitura; para mover/girar, use as ferramentas de Modificar como em qualquer elemento.
 */
export function CadProps({ items }: { items: CadDrawing[] }): ReactElement {
  const p = useProject();
  const levelName = (levelId: string): string => p.levels.find((l) => l.id === levelId)?.name ?? levelId;
  return (
    <>
      {items.map((c) => (
        <Group key={c.id} title={c.name}>
          <Row label="Nome" htmlFor={`cad-name-${c.id}`}>
            <TextField
              id={`cad-name-${c.id}`}
              value={c.name}
              onCommit={(v) => editor.store.exec({ type: 'updateCadDrawing', id: c.id, patch: { name: v || c.name } }, 'Renomear CAD')}
            />
          </Row>
          <Row label="Nível" readOnly><span className="val">{levelName(c.levelId)}</span></Row>
          <Row label="Visível">
            <input
              type="checkbox"
              aria-label={`Visível ${c.name}`}
              checked={c.visible !== false}
              onChange={(e) => editor.store.exec({ type: 'updateCadDrawing', id: c.id, patch: { visible: e.target.checked } }, 'Visibilidade do CAD')}
            />
          </Row>
          <Row label="Deslocamento (m)" htmlFor={`cad-offset-${c.id}`}>
            <NumField
              id={`cad-offset-${c.id}`}
              value={c.offsetZ ?? 0}
              quantity="length"
              onCommit={(v) => editor.store.exec({ type: 'updateCadDrawing', id: c.id, patch: { offsetZ: v } }, 'Deslocamento do CAD')}
            />
          </Row>
          <Row label="Camadas" readOnly><span className="val">{c.layers.length}</span></Row>
          <Row label="Traços" readOnly><span className="val">{c.paths.length}</span></Row>
          <Row label="Textos" readOnly><span className="val">{c.texts.length}</span></Row>
          <Row label="Unidade de origem" readOnly><span className="val">{c.unit}</span></Row>
          <Row label="Captura">
            <span className="val">Linhas e vértices (Snap → CAD importado)</span>
          </Row>
          <Row label="Ações" readOnly>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="btn small" onClick={() => frameCad(c)}>Enquadrar</button>
              <button className="btn small" onClick={() => removeCad(c)}>Excluir</button>
            </span>
          </Row>
        </Group>
      ))}
    </>
  );
}
