import type { ReactElement } from 'react';
import { quantifyRoofs, resolveRoofs, ROOF_SHAPE_LABEL } from '@hestia/engine';
import { FUNCTION_LABEL, roofTypeThickness, type Id, type Roof, type RoofShape } from '@hestia/model';
import { roofSlopeError, degToPercent, percentToDeg } from '@hestia/tools';
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

function patch(ids: Id[], p: Partial<Roof>): void {
  editor.store.exec({ type: 'updateElements', ids, patch: p });
}

/** Ângulo do eixo da cumeeira (ou da subida) em graus, entre 0° e 180°. */
const axisDeg = (r: Roof): number => {
  const a = (Math.atan2(r.dir.y, r.dir.x) * 180) / Math.PI;
  return ((a % 180) + 180) % 180;
};

/** Gira a direção do telhado em `deg` graus, mantendo-a unitária. */
const rotatedDir = (r: Roof, deg: number): { x: number; y: number } => {
  const t = (deg * Math.PI) / 180;
  return { x: r.dir.x * Math.cos(t) - r.dir.y * Math.sin(t), y: r.dir.x * Math.sin(t) + r.dir.y * Math.cos(t) };
};

/**
 * Propriedades de um ou mais telhados (tipo, nível, cota do beiral, forma, inclinação, direção da cumeeira, camadas,
 * quantitativos e identidade). O balanço do beiral é definido ao criar e não se edita depois; o contorno se edita pelas alças.
 */
export function RoofProperties({ roofs }: { roofs: Roof[] }): ReactElement {
  const p = useProject();
  const ids = roofs.map((r) => r.id);
  const single = roofs.length === 1 ? roofs[0]! : null;
  const typeId = common(roofs, (r) => r.typeId);
  const offset = common(roofs, (r) => r.heightOffset);
  const shape = common(roofs, (r) => r.shape);
  const slope = common(roofs, (r) => r.slopePercent);
  const mark = common(roofs, (r) => r.mark);
  const comments = common(roofs, (r) => r.comments);
  const type = typeId.mixed ? null : p.roofTypes[typeId.value];
  const hasRidge = roofs.some((r) => r.shape === 'gable' || r.shape === 'shed');
  const quantities = quantifyRoofs(p, roofs[0]!.levelId);
  const picked = roofs.map((r) => quantities.roofs.find((q) => q.roofId === r.id)).filter((q): q is NonNullable<typeof q> => q !== undefined);
  const sum = (f: (q: (typeof picked)[number]) => number): number => picked.reduce((s, q) => s + f(q), 0);
  const planArea = sum((q) => q.planArea);
  const realArea = sum((q) => q.faceArea);
  const eaveLength = sum((q) => q.eaveLength);
  const ridgeLength = sum((q) => q.ridgeLength);
  const hipLength = sum((q) => q.hipLength);
  const valleyLength = sum((q) => q.valleyLength);
  const planes = sum((q) => q.planes.length);
  const resolved = picked.length > 0 && picked.some((q) => q.planes.length > 0);
  const freeRoof = single?.shape === 'free' ? single : null;
  const freePlanes = freeRoof ? (picked.find((q) => q.roofId === freeRoof.id)?.planes ?? []) : [];

  const setSlope = (v: number): void => {
    const err = roofSlopeError(v);
    if (err) {
      useUi.setState({ status: err });
      return;
    }
    patch(ids, { slopePercent: v });
  };

  return (
    <>
      <div className="typesel">
        <div className="row">
          <select id="prop-rooftype" className="select" value={typeId.mixed ? '' : typeId.value} onChange={(e) => e.target.value && patch(ids, { typeId: e.target.value })} aria-label="Tipo de telhado">
            {typeId.mixed && <option value="">variados</option>}
            {Object.values(p.roofTypes).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="row">
          <button className="btn small" disabled={typeId.mixed} onClick={() => useUi.setState({ dialog: 'roofType', dialogArg: typeId.value })}>Editar tipo…</button>
        </div>
      </div>
      <Group title="Restrições">
        <LevelField ids={ids} />
        <Row label="Cota do beiral" htmlFor="p-roff">
          <NumField id="p-roff" value={offset.value} mixed={offset.mixed} onCommit={(v) => patch(ids, { heightOffset: v })} unit="m" />
        </Row>
      </Group>
      <Group title="Forma">
        <Row label="Forma" htmlFor="p-rshape">
          <select id="p-rshape" className="select" value={shape.mixed ? '' : shape.value} onChange={(e) => e.target.value && patch(ids, { shape: e.target.value as RoofShape })} aria-label="Forma do telhado">
            {shape.mixed && <option value="">variadas</option>}
            {shape.value === 'free' && <option value="free">{ROOF_SHAPE_LABEL.free}</option>}
            <option value="shed">{ROOF_SHAPE_LABEL.shed}</option>
            <option value="gable">{ROOF_SHAPE_LABEL.gable}</option>
            <option value="hip">{ROOF_SHAPE_LABEL.hip}</option>
          </select>
        </Row>
        <Row label="Inclinação" htmlFor="p-rslope">
          <NumField id="p-rslope" value={slope.value} mixed={slope.mixed} onCommit={setSlope} unit="%" min={0.1} max={200} />
        </Row>
        <Row label="Inclinação (°)" htmlFor="p-rdeg">
          <NumField id="p-rdeg" value={percentToDeg(slope.value)} mixed={slope.mixed} decimals={1} unit="°" min={0.1} max={63.4} onCommit={(v) => setSlope(degToPercent(v))} />
        </Row>
        {hasRidge && single && single.shape !== 'hip' ? (
          <>
            <Row label={single.shape === 'shed' ? 'Subida (°)' : 'Cumeeira (°)'} htmlFor="p-rdir">
              <NumField id="p-rdir" value={axisDeg(single)} decimals={1} unit="°" onCommit={(v) => patch(ids, { dir: { x: Math.cos((v * Math.PI) / 180), y: Math.sin((v * Math.PI) / 180) } })} />
            </Row>
            <div className="row">
              <button className="btn small" onClick={() => patch(ids, { dir: rotatedDir(single, 90) })}>Girar 90°</button>
            </div>
          </>
        ) : (
          <div className="hint">{freeRoof ? 'Águas livres: a forma vem da lista de águas, somente leitura nesta versão.' : single?.shape === 'hip' ? 'Quatro águas: sem cumeeira editável.' : 'Selecione um telhado para editar a direção da cumeeira.'}</div>
        )}
        {freeRoof && (
          <>
            {freePlanes.length === 0 && <div className="hint">Sem águas resolvidas para este telhado.</div>}
            {freePlanes.map((pl, i) => (
              <Row key={i} label={`Água ${i + 1}`}><span className="val">{fmt(pl.percent, 1)} % · área {fmt(pl.faceArea)} m²</span></Row>
            ))}
          </>
        )}
        <div className="hint">O balanço do beiral foi definido na criação e não se edita depois. O contorno se ajusta pelas alças na planta.</div>
      </Group>
      <Group title="Construção">
        {type ? (
          <>
            <Row label="Espessura total"><span className="val">{fmt(roofTypeThickness(type) * 100, 1)} cm</span></Row>
            {type.layers.map((l, i) => (
              <div className="prow" key={i} style={{ minHeight: 22 }}>
                <span className="lbl" title={FUNCTION_LABEL[l.function]}>{FUNCTION_LABEL[l.function]}</span>
                <span className="val soft" title={p.materials[l.materialId]?.name}>{fmt(l.thickness * 100, 1)} cm</span>
              </div>
            ))}
          </>
        ) : (
          <div className="hint">Selecione telhados do mesmo tipo para ver as camadas.</div>
        )}
      </Group>
      <Group title="Quantitativos">
        <Row label="Área em planta"><span className="val">{fmt(planArea)} m²</span></Row>
        <Row label="Área real"><span className="val">{resolved ? `${fmt(realArea)} m²` : '—'}</span></Row>
        <Row label="Águas"><span className="val">{planes || '—'}</span></Row>
        <Row label="Beiral"><span className="val">{fmt(eaveLength)} m</span></Row>
        <Row label="Cumeeira"><span className="val">{fmt(ridgeLength)} m</span></Row>
        <Row label="Espigão"><span className="val">{fmt(hipLength)} m</span></Row>
        <Row label="Rincão"><span className="val">{fmt(valleyLength)} m</span></Row>
      </Group>
      <Group title="Identidade" open={false}>
        <Row label="Marca" htmlFor="p-rmark"><TextField id="p-rmark" value={mark.value} mixed={mark.mixed} onCommit={(v) => patch(ids, { mark: v })} /></Row>
        <Row label="Comentários" htmlFor="p-rcomm"><TextField id="p-rcomm" value={comments.value} mixed={comments.mixed} onCommit={(v) => patch(ids, { comments: v })} /></Row>
      </Group>
    </>
  );
}
