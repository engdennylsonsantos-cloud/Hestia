import type { ReactElement } from 'react';
import { FUNCTION_LABEL, floorArea, floorTypeThickness, type Floor, type Id } from '@hestia/model';
import { ringPerimeter } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Group, NumField, Row, TextField } from './fields.tsx';
import { LevelField } from './LevelField.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

/** Valor comum a todos os selecionados, ou `mixed` quando divergem. */
function common<T, K>(items: T[], get: (t: T) => K): { value: K; mixed: boolean } {
  const first = get(items[0]!);
  return { value: first, mixed: items.some((x) => get(x) !== first) };
}

function patch(ids: Id[], p: Partial<Floor>): void {
  editor.store.exec({ type: 'updateElements', ids, patch: p });
}

/** Propriedades de um ou mais pisos selecionados (tipo, deslocamento, marca, área e perímetro). */
export function FloorProperties({ floors }: { floors: Floor[] }): ReactElement {
  const p = useProject();
  const ids = floors.map((f) => f.id);
  const typeId = common(floors, (f) => f.typeId);
  const offset = common(floors, (f) => f.heightOffset);
  const mark = common(floors, (f) => f.mark);
  const comments = common(floors, (f) => f.comments);
  const single = floors.length === 1 ? floors[0]! : null;
  const type = typeId.mixed ? null : p.floorTypes[typeId.value];
  const area = floors.reduce((s, f) => s + floorArea(f), 0);
  const perimeter = floors.reduce((s, f) => s + ringPerimeter(f.boundary), 0);

  return (
    <>
      <div className="typesel">
        <div className="row">
          <select id="prop-floortype" className="select" value={typeId.mixed ? '' : typeId.value} onChange={(e) => e.target.value && patch(ids, { typeId: e.target.value })} aria-label="Tipo de piso">
            {typeId.mixed && <option value="">variados</option>}
            {Object.values(p.floorTypes).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <button className="btn small" disabled={typeId.mixed} onClick={() => useUi.setState({ dialog: 'floorType', dialogArg: typeId.value })}>Editar tipo…</button>
        </div>
      </div>
      <Group title="Restrições">
        <LevelField ids={ids} />
        <Row label="Desloc. do topo" htmlFor="p-foff">
          <NumField id="p-foff" value={offset.value} mixed={offset.mixed} onCommit={(v) => patch(ids, { heightOffset: v })} unit="m" />
        </Row>
      </Group>
      <Group title="Construção">
        {type ? (
          <>
            <Row label="Espessura total"><span className="val">{fmt(floorTypeThickness(type) * 100, 1)} cm</span></Row>
            {type.layers.map((l, i) => (
              <div className="prow" key={i} style={{ minHeight: 22 }}>
                <span className="lbl" title={FUNCTION_LABEL[l.function]}>{FUNCTION_LABEL[l.function]}</span>
                <span className="val soft" title={p.materials[l.materialId]?.name}>{fmt(l.thickness * 100, 1)} cm</span>
              </div>
            ))}
          </>
        ) : (
          <div className="hint">Selecione pisos do mesmo tipo para ver as camadas.</div>
        )}
      </Group>
      <Group title="Dimensões">
        {single ? (
          <>
            <Row label="Área líquida"><span className="val">{fmt(floorArea(single))} m²</span></Row>
            <Row label="Perímetro"><span className="val">{fmt(ringPerimeter(single.boundary))} m</span></Row>
            <Row label="Furos"><span className="val">{single.holes.length}</span></Row>
          </>
        ) : (
          <>
            <Row label="Área líquida total"><span className="val">{fmt(area)} m²</span></Row>
            <Row label="Perímetro total"><span className="val">{fmt(perimeter)} m</span></Row>
          </>
        )}
      </Group>
      <Group title="Identidade" open={false}>
        <Row label="Marca" htmlFor="p-fmark"><TextField id="p-fmark" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
        <Row label="Comentários" htmlFor="p-fcomm"><TextField id="p-fcomm" value={comments.value} mixed={comments.mixed} onCommit={(v) => patch(ids, { comments: v })} /></Row>
      </Group>
    </>
  );
}
