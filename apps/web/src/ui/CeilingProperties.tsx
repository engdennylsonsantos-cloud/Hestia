import type { ReactElement } from 'react';
import { ceilingArea, ceilingTypeThickness, FUNCTION_LABEL, type Ceiling, type Id, type Project } from '@hestia/model';
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

function patch(ids: Id[], p: Partial<Ceiling>): void {
  editor.store.exec({ type: 'updateElements', ids, patch: p });
}

/** Nome do ambiente de origem (número e nome), ou vazio quando o forro foi desenhado livremente. */
function roomLabel(p: Project, c: Ceiling): string {
  const r = c.roomId ? p.elements[c.roomId] : undefined;
  return r && r.kind === 'room' ? [r.number, r.name].filter(Boolean).join(' · ') : '';
}

/** Propriedades de um ou mais forros selecionados (tipo, cota do topo, ambiente, construção, dimensões e marca). */
export function CeilingProperties({ ceilings }: { ceilings: Ceiling[] }): ReactElement {
  const p = useProject();
  const ids = ceilings.map((c) => c.id);
  const typeId = common(ceilings, (c) => c.typeId);
  const offset = common(ceilings, (c) => c.heightOffset);
  const mark = common(ceilings, (c) => c.mark);
  const comments = common(ceilings, (c) => c.comments);
  const single = ceilings.length === 1 ? ceilings[0]! : null;
  const type = typeId.mixed ? null : p.ceilingTypes[typeId.value];
  const area = ceilings.reduce((s, c) => s + ceilingArea(c), 0);
  const perimeter = ceilings.reduce((s, c) => s + ringPerimeter(c.boundary), 0);

  return (
    <>
      <div className="typesel">
        <div className="row">
          <select id="prop-ceilingtype" className="select" value={typeId.mixed ? '' : typeId.value} onChange={(e) => e.target.value && patch(ids, { typeId: e.target.value })} aria-label="Tipo de forro">
            {typeId.mixed && <option value="">variados</option>}
            {Object.values(p.ceilingTypes).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <button className="btn small" disabled={typeId.mixed} onClick={() => useUi.setState({ dialog: 'ceilingType', dialogArg: typeId.value })}>Editar tipo…</button>
        </div>
      </div>
      <Group title="Restrições">
        <LevelField ids={ids} />
        <Row label="Cota do topo" htmlFor="p-ctop">
          <NumField id="p-ctop" value={offset.value} mixed={offset.mixed} onCommit={(v) => patch(ids, { heightOffset: v })} unit="m" />
        </Row>
        {single ? <Row label="Face inferior"><span className="val">{fmt(single.heightOffset - (p.ceilingTypes[single.typeId] ? ceilingTypeThickness(p.ceilingTypes[single.typeId]!) : 0))} m</span></Row> : null}
      </Group>
      <Group title="Construção" open={false}>
        {type ? (
          <>
            <Row label="Espessura total"><span className="val">{fmt(ceilingTypeThickness(type) * 100, 1)} cm</span></Row>
            {type.layers.map((l, i) => (
              <div className="prow" key={i}>
                <span className="lbl" title={FUNCTION_LABEL[l.function]}>{FUNCTION_LABEL[l.function]}</span>
                <span className="val soft" title={p.materials[l.materialId]?.name}>{fmt(l.thickness * 100, 1)} cm</span>
              </div>
            ))}
          </>
        ) : (
          <div className="hint">Selecione forros do mesmo tipo para ver as camadas.</div>
        )}
      </Group>
      <Group title="Dimensões">
        {single ? (
          <>
            <Row label="Área"><span className="val">{fmt(ceilingArea(single))} m²</span></Row>
            <Row label="Perímetro"><span className="val">{fmt(ringPerimeter(single.boundary))} m</span></Row>
            <Row label="Furos"><span className="val">{single.holes.length}</span></Row>
            {roomLabel(p, single) ? <Row label="Ambiente"><span className="val">{roomLabel(p, single)}</span></Row> : null}
          </>
        ) : (
          <>
            <Row label="Área total"><span className="val">{fmt(area)} m²</span></Row>
            <Row label="Perímetro total"><span className="val">{fmt(perimeter)} m</span></Row>
          </>
        )}
      </Group>
      <Group title="Identidade" open={false}>
        <Row label="Marca" htmlFor="p-cmark"><TextField id="p-cmark" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
        <Row label="Comentários" htmlFor="p-ccomm"><TextField id="p-ccomm" value={comments.value} mixed={comments.mixed} onCommit={(v) => patch(ids, { comments: v })} /></Row>
      </Group>
    </>
  );
}
