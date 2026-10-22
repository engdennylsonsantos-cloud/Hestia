import type { ReactElement } from 'react';
import { quantifyFloors } from '@hestia/engine';
import { FUNCTION_LABEL, floorArea, floorTypeThickness, type Floor, type Id, type Project } from '@hestia/model';
import { ringPerimeter } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Group, NumField, Row, TextField } from './fields.tsx';
import { LevelField } from './LevelField.tsx';
import { OutlineGroup } from './OutlineGroup.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

/** Valor comum a todos os selecionados, ou `mixed` quando divergem. */
function common<T, K>(items: T[], get: (t: T) => K): { value: K; mixed: boolean } {
  const first = get(items[0]!);
  return { value: first, mixed: items.some((x) => get(x) !== first) };
}

function patch(ids: Id[], p: Partial<Floor>): void {
  editor.store.exec({ type: 'updateElements', ids, patch: p });
}

/** Área líquida resolvida (com as aberturas de escada) de cada piso; o que não resolve cai na área crua. */
function resolvedAreas(p: Project, floors: Floor[]): Map<Id, number> {
  const levels = [...new Set(floors.map((f) => f.levelId))];
  return new Map(levels.flatMap((levelId) => quantifyFloors(p, levelId).floors.map((q) => [q.floorId, q.area] as const)));
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
  const resolved = resolvedAreas(p, floors);
  const areaOf = (f: Floor): number => resolved.get(f.id) ?? floorArea(f);
  const area = floors.reduce((s, f) => s + areaOf(f), 0);
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
      <OutlineGroup elements={floors} />
      <Group title="Construção" open={false}>
        {type ? (
          <>
            <Row label="Espessura total"><span className="val">{fmt(floorTypeThickness(type) * 100, 1)} cm</span></Row>
            {type.layers.map((l, i) => (
              <div className="prow" key={i}>
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
            <Row label="Área líquida"><span className="val">{fmt(areaOf(single))} m²</span></Row>
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
