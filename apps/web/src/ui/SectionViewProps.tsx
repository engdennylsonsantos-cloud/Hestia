import type { ReactElement } from 'react';
import {
  SECTION_ARROW_MM,
  SECTION_LABEL_OFFSET_MM,
  SECTION_ROLE_LABEL,
  SECTION_TEXT_MM,
  sectionInvertPatch,
  type SectionMarkLineStyle,
  type SectionMarkPlacement,
  type SectionMarkStyle,
  type SectionView,
} from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';

const optional = (text: string): string | undefined => text.trim() || undefined;

/** Vista selecionada (uma só), ou null. A seleção de vistas usa o mesmo `Id[]` dos elementos. */
export function selectedView(p: { views: SectionView[] }, ids: string[]): SectionView | null {
  if (ids.length !== 1) return null;
  return p.views.find((v) => v.id === ids[0]) ?? null;
}

/** Propriedades de uma marca de corte/elevação: identidade, geometria, aparência e associação com paredes. */
export function SectionViewProps({ view }: { view: SectionView }): ReactElement {
  const update = (patch: Partial<Omit<SectionView, 'id'>>): void => {
    const err = editor.updateView(view.id, patch);
    if (err) useUi.setState({ status: err });
  };
  const setMark = (patch: Partial<SectionMarkStyle>): void => update({ mark: { ...view.mark, ...patch } });
  const kind = view.kind === 'elevation' ? 'Elevação' : 'Corte';
  const lineStyle: SectionMarkLineStyle = view.mark?.lineStyle ?? (view.kind === 'elevation' ? 'continuous' : 'dash-dot');
  const placement: SectionMarkPlacement = view.mark?.placement ?? 'both';
  const offset = view.mark?.labelOffsetMm ?? SECTION_LABEL_OFFSET_MM;
  const refs = view.refs?.a || view.refs?.b;
  const setA = (x: number, y: number): void => update({ a: { x, y }, refs: view.refs ? { ...view.refs, a: undefined } : undefined });
  const setB = (x: number, y: number): void => update({ b: { x, y }, refs: view.refs ? { ...view.refs, b: undefined } : undefined });

  return (
    <>
      <Group title="Dados de identidade">
        <Row label="Tipo"><span className="val">{kind}</span></Row>
        {view.kind === 'elevation' && view.role ? <Row label="Papel"><span className="val">{SECTION_ROLE_LABEL[view.role]}</span></Row> : null}
        <Row label="Nome" htmlFor="sv-name">
          <TextField id="sv-name" value={view.name} onCommit={(v) => update({ name: v.trim() })} />
        </Row>
        <Row label="Número" htmlFor="sv-number">
          <TextField id="sv-number" value={view.number ?? ''} placeholder="Ex.: A" onCommit={(v) => update({ number: optional(v) })} />
        </Row>
        <Row label="Título" htmlFor="sv-title">
          <TextField id="sv-title" value={view.title ?? ''} placeholder="Título na prancha" onCommit={(v) => update({ title: optional(v) })} />
        </Row>
        <Row label="Rótulo" htmlFor="sv-label">
          <TextField id="sv-label" value={view.label ?? ''} placeholder="Texto da marca" onCommit={(v) => update({ label: optional(v) })} />
        </Row>
      </Group>

      <Group title="Geometria">
        <Row label="Profundidade" htmlFor="sv-depth">
          <NumField id="sv-depth" value={view.depth} min={0.01} quantity="length" onCommit={(v) => update({ depth: v })} />
        </Row>
        <Row label="Início X" htmlFor="sv-ax">
          <NumField id="sv-ax" value={view.a.x} quantity="length" onCommit={(v) => setA(v, view.a.y)} />
        </Row>
        <Row label="Início Y" htmlFor="sv-ay">
          <NumField id="sv-ay" value={view.a.y} quantity="length" onCommit={(v) => setA(view.a.x, v)} />
        </Row>
        <Row label="Fim X" htmlFor="sv-bx">
          <NumField id="sv-bx" value={view.b.x} quantity="length" onCommit={(v) => setB(v, view.b.y)} />
        </Row>
        <Row label="Fim Y" htmlFor="sv-by">
          <NumField id="sv-by" value={view.b.y} quantity="length" onCommit={(v) => setB(view.b.x, v)} />
        </Row>
        <Row label="Sentido">
          <button className="btn" type="button" onClick={() => update(sectionInvertPatch(view))}>Inverter direção</button>
        </Row>
      </Group>

      <Group title="Marca">
        <Row label="Visível" htmlFor="sv-visible">
          <Check id="sv-visible" checked={view.mark?.visible !== false} onChange={(v) => setMark({ visible: v })} />
        </Row>
        <Row label="Setas" htmlFor="sv-arrows">
          <Check id="sv-arrows" checked={view.mark?.showArrow !== false} onChange={(v) => setMark({ showArrow: v })} />
        </Row>
        <Row label="Rótulo na marca" htmlFor="sv-showlabel">
          <Check id="sv-showlabel" checked={view.mark?.showLabel !== false} onChange={(v) => setMark({ showLabel: v })} />
        </Row>
        <Row label="Posição" htmlFor="sv-placement">
          <select id="sv-placement" className="select" value={placement} onChange={(e) => setMark({ placement: e.target.value as SectionMarkPlacement })}>
            <option value="both">Nas duas pontas</option>
            <option value="start">Só no início</option>
            <option value="end">Só no fim</option>
            <option value="middle">No meio</option>
          </select>
        </Row>
        <Row label="Traço" htmlFor="sv-linestyle">
          <select id="sv-linestyle" className="select" value={lineStyle} onChange={(e) => setMark({ lineStyle: e.target.value as SectionMarkLineStyle })}>
            <option value="dash-dot">Traço-ponto</option>
            <option value="continuous">Contínuo</option>
            <option value="dashed">Tracejado</option>
          </select>
        </Row>
        <Row label="Seta (mm)" htmlFor="sv-arrow">
          <NumField id="sv-arrow" value={(view.mark?.arrowMm ?? SECTION_ARROW_MM) / 1000} min={0.0005} max={0.02} quantity="smallLength" onCommit={(v) => setMark({ arrowMm: v * 1000 })} />
        </Row>
        <Row label="Texto (mm)" htmlFor="sv-text">
          <NumField id="sv-text" value={(view.mark?.textMm ?? SECTION_TEXT_MM) / 1000} min={0.001} max={0.02} quantity="smallLength" onCommit={(v) => setMark({ textMm: v * 1000 })} />
        </Row>
        <Row label="Desloc. X" htmlFor="sv-offx">
          <NumField id="sv-offx" value={offset.x / 1000} quantity="smallLength" onCommit={(v) => setMark({ labelOffsetMm: { ...offset, x: v * 1000 } })} />
        </Row>
        <Row label="Desloc. Y" htmlFor="sv-offy">
          <NumField id="sv-offy" value={offset.y / 1000} quantity="smallLength" onCommit={(v) => setMark({ labelOffsetMm: { ...offset, y: v * 1000 } })} />
        </Row>
      </Group>

      <Group title="Associação">
        <Row label="Extremidade A"><span className="val">{view.refs?.a ? 'Presa à parede' : 'Livre'}</span></Row>
        <Row label="Extremidade B"><span className="val">{view.refs?.b ? 'Presa à parede' : 'Livre'}</span></Row>
        {refs ? (
          <Row label="Referências">
            <button className="btn" type="button" onClick={() => update({ refs: undefined })}>Soltar</button>
          </Row>
        ) : null}
      </Group>
    </>
  );
}
