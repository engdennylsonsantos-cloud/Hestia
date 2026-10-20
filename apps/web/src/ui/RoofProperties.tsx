import type { ReactElement } from 'react';
import { quantifyRoofs, ROOF_SHAPE_LABEL } from '@hestia/engine';
import { FUNCTION_LABEL, roofTypeThickness, type Id, type Roof, type RoofShape } from '@hestia/model';
import { defaultExtrusionProfile } from '@hestia/engine';
import { roofShapePatch, roofSlopeError, degToPercent, percentToDeg } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { applyRoofPatch } from '../editor/roofEdgeActions.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';
import { LevelField } from './LevelField.tsx';
import { RoofEdgeSection, RoofEdgeTable } from './RoofEdgeProps.tsx';
import { RoofPlanesSection } from './RoofPlanesProps.tsx';
import { RoofProfileRow } from './RoofProfileRow.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

/** Valor comum a todos os selecionados, ou `mixed` quando divergem. */
function common<T, K>(items: T[], get: (t: T) => K): { value: K; mixed: boolean } {
  const first = get(items[0]!);
  return { value: first, mixed: items.some((x) => get(x) !== first) };
}

/** Alteração pelas Propriedades: guardada pelo motor (não aplica se a alteração deixar o telhado sem águas). */
function patch(ids: Id[], p: Partial<Roof>): void {
  applyRoofPatch(editor.store, ids, p);
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

const SHAPE_OPTIONS: RoofShape[] = ['shed', 'gable', 'hip', 'edges', 'free', 'extrusion'];

/**
 * Propriedades de um ou mais telhados: tipo, nível, cota do beiral, forma (predefinições por aresta ou águas livres),
 * inclinação, cumeeira, beiral e acabamentos, camadas, quantitativos e identidade. Com uma aresta escolhida na planta,
 * mostra a seção "Aresta N"; a tabela de arestas lista todas. O contorno se edita pelas alças na planta.
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
  const joinOthers = common(roofs, (r) => r.joinOthers);
  const rafterCut = common(roofs, (r) => r.rafterCut);
  const fascia = common(roofs, (r) => r.eave.fascia);
  const fasciaHeight = common(roofs, (r) => r.eave.fasciaHeight);
  const gutter = common(roofs, (r) => r.eave.gutter);
  const soffit = common(roofs, (r) => r.eave.soffit);
  const type = typeId.mixed ? null : p.roofTypes[typeId.value];
  const hasRidge = single !== null && (single.shape === 'gable' || single.shape === 'shed');
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
  const roofEdge = useUi((s) => s.roofEdge);
  const edgeSel = single && roofEdge && roofEdge.roofId === single.id && roofEdge.index < single.boundary.length ? roofEdge : null;
  const edgeCapable = single !== null && single.shape !== 'free' && single.shape !== 'extrusion';

  const setSlope = (v: number): void => {
    const err = roofSlopeError(v);
    if (err) {
      useUi.setState({ status: err });
      return;
    }
    // Por arestas: a inclinação nova vale para as arestas que definem inclinação (cada uma se ajusta na planta).
    for (const r of roofs) patch([r.id], { slopePercent: v, ...(r.shape === 'edges' ? { edgeSlopes: r.edgeSlopes.map((x) => (x === null ? null : v)) } : {}) });
  };

  const setShape = (v: RoofShape): void => {
    editor.store.transaction('Forma do telhado', () => {
      for (const r of roofs) {
        // Por extrusão: começa com o perfil padrão (arco de 1 m) se o telhado ainda não tem um; a água é conferida pelo motor.
        const next: Partial<Roof> = v === 'extrusion' ? { shape: 'extrusion', profile: r.profile.length >= 2 ? r.profile : defaultExtrusionProfile(r.boundary, r.dir) } : roofShapePatch(r, v);
        if (Object.keys(next).length) patch([r.id], next);
      }
    });
  };

  /** Acabamentos do beiral: cada telhado guarda o seu, então a alteração vai telhado a telhado numa transação. */
  const setEave = (change: Partial<Roof['eave']>): void => {
    editor.store.transaction('Acabamento do beiral', () => {
      for (const r of roofs) editor.store.exec({ type: 'updateElements', ids: [r.id], patch: { eave: { ...r.eave, ...change } } });
    });
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
          <select id="p-rshape" className="select" value={shape.mixed ? '' : shape.value} onChange={(e) => e.target.value && setShape(e.target.value as RoofShape)} aria-label="Forma do telhado">
            {shape.mixed && <option value="">variadas</option>}
            {SHAPE_OPTIONS.map((s) => (
              <option key={s} value={s}>{ROOF_SHAPE_LABEL[s]}</option>
            ))}
          </select>
        </Row>
        <Row label="Inclinação" htmlFor="p-rslope">
          <NumField id="p-rslope" value={slope.value} mixed={slope.mixed} onCommit={setSlope} unit="%" min={0.1} max={200} />
        </Row>
        <Row label="Inclinação (°)" htmlFor="p-rdeg">
          <NumField id="p-rdeg" value={percentToDeg(slope.value)} mixed={slope.mixed} decimals={1} unit="°" min={0.1} max={63.4} onCommit={(v) => setSlope(degToPercent(v))} />
        </Row>
        {hasRidge && single ? (
          <>
            <Row label={single.shape === 'shed' ? 'Subida (°)' : 'Cumeeira (°)'} htmlFor="p-rdir">
              <NumField id="p-rdir" value={axisDeg(single)} decimals={1} unit="°" onCommit={(v) => patch(ids, { dir: { x: Math.cos((v * Math.PI) / 180), y: Math.sin((v * Math.PI) / 180) } })} />
            </Row>
            <div className="row">
              <button className="btn small" onClick={() => patch(ids, { dir: rotatedDir(single, 90) })}>Girar 90°</button>
            </div>
          </>
        ) : (
          <div className="hint">
            {freeRoof ? 'Águas livres: cada água tem inclinação e subida próprias (lista abaixo).'
              : single?.shape === 'edges' ? 'Por arestas: inclinação só nas arestas que a definem. Escolha uma aresta na planta para editá-la.'
              : single?.shape === 'extrusion' ? 'Telhado por extrusão: o perfil (altura por transversal) se edita pelo botão abaixo.'
              : single ? 'Forma de uma água, duas águas ou quatro águas: troque por Por arestas para editar cada aresta.'
              : 'Selecione um telhado para editar a direção da cumeeira.'}
          </div>
        )}
        {single?.shape === 'extrusion' && <RoofProfileRow key={single.id} roof={single} />}
        <div className="hint">O balanço do beiral se define por aresta na planta. O contorno se ajusta pelas alças.</div>
      </Group>
      {edgeSel && single && <RoofEdgeSection roof={single} index={edgeSel.index} />}
      {edgeCapable && single && <RoofEdgeTable roof={single} />}
      {freeRoof && <RoofPlanesSection roof={freeRoof} />}
      <Group title="Beiral e acabamentos">
        <Row label="Unir telhados" htmlFor="p-rjoin">
          <Check id="p-rjoin" checked={joinOthers.value} mixed={joinOthers.mixed} onChange={(v) => patch(ids, { joinOthers: v })}>Unir telhados que se sobrepõem</Check>
        </Row>
        <Row label="Corte do caibro" htmlFor="p-rcut">
          <select id="p-rcut" className="select" value={rafterCut.mixed ? '' : rafterCut.value} onChange={(e) => e.target.value && patch(ids, { rafterCut: e.target.value as Roof['rafterCut'] })} aria-label="Corte do caibro">
            {rafterCut.mixed && <option value="">variados</option>}
            <option value="plumb">Prumo</option>
            <option value="square">Esquadro</option>
          </select>
        </Row>
        <Row label="Testeira" htmlFor="p-rfascia">
          <Check id="p-rfascia" checked={fascia.value} mixed={fascia.mixed} onChange={(v) => setEave({ fascia: v })}>Testeira</Check>
        </Row>
        <Row label="Altura da testeira" htmlFor="p-rfh">
          <NumField id="p-rfh" value={fasciaHeight.value} mixed={fasciaHeight.mixed} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => setEave({ fasciaHeight: v })} />
        </Row>
        <Row label="Calha" htmlFor="p-rgutter">
          <Check id="p-rgutter" checked={gutter.value} mixed={gutter.mixed} onChange={(v) => setEave({ gutter: v })}>Calha</Check>
        </Row>
        <Row label="Forro de beiral" htmlFor="p-rsoffit">
          <Check id="p-rsoffit" checked={soffit.value} mixed={soffit.mixed} onChange={(v) => setEave({ soffit: v })}>Forro de beiral</Check>
        </Row>
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
