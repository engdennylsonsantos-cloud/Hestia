import { useState, type ReactElement } from 'react';
import { GRAPHICS_CATEGORIES, PLAN_VISUAL_STYLES, levelGraphicsOf, sectionGraphicsOf, view3dOf, type Id, type View3DSettings, type ViewGraphics } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { editLevelGraphics, editSectionGraphics, editView3D, restoreLevelGraphicsDefault, restoreSectionGraphicsDefault, restoreView3DDefault, type LevelGraphicsPatch, type SectionGraphicsPatch, type View3DPatch } from '../editor/graphicsActions.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row } from './fields.tsx';
import { CATEGORY_LABEL, DETAIL_LABEL, PARTIAL_LABEL, PLAN_SCALES, VISUAL_STYLE_LABEL } from './graphicsLabels.ts';

/** Gráficos da planta do nível (decisão 0015 §3): escala, detalhe, estilo visual e exibição parcial. Recusas aparecem aqui. */
export function LevelGraphicsGroup({ levelId }: { levelId: Id }): ReactElement {
  const p = useProject();
  const g = levelGraphicsOf(p, levelId);
  const [error, setError] = useState<string | null>(null);
  const edit = (patch: LevelGraphicsPatch): void => setError(editLevelGraphics(editor.store, levelId, patch).error);
  const hidden = GRAPHICS_CATEGORIES.filter((c) => !g.overrides[c].visible);
  const isPreset = PLAN_SCALES.includes(g.scale);
  return (
    <Group title="Gráficos da vista" open={false}>
      <Row label="Escala" htmlFor="lg-scale">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select id="lg-scale" className="select" value={isPreset ? String(g.scale) : ''} onChange={(e) => e.target.value && edit({ scale: Number(e.target.value) })} aria-label="Escala da planta">
            {!isPreset && <option value="">Outra</option>}
            {PLAN_SCALES.map((n) => <option key={n} value={n}>{`1:${n}`}</option>)}
          </select>
          <span className="val soft">1:</span>
          <NumField id="lg-scale-free" value={g.scale} decimals={0} min={1} width={64} onCommit={(v) => edit({ scale: v })} />
        </span>
      </Row>
      <Row label="Detalhe" htmlFor="lg-detail">
        <select id="lg-detail" className="select" value={g.detail} onChange={(e) => edit({ detail: e.target.value as ViewGraphics['detail'] })}>
          {(Object.keys(DETAIL_LABEL) as Array<keyof typeof DETAIL_LABEL>).map((k) => <option key={k} value={k}>{DETAIL_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Estilo visual" htmlFor="lg-style">
        <select id="lg-style" className="select" value={g.style} onChange={(e) => edit({ style: e.target.value as ViewGraphics['style'] })}>
          {PLAN_VISUAL_STYLES.map((k) => <option key={k} value={k}>{VISUAL_STYLE_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Parcial de estrutura" htmlFor="lg-partial">
        <select id="lg-partial" className="select" value={g.partialStructure} onChange={(e) => edit({ partialStructure: e.target.value as ViewGraphics['partialStructure'] })}>
          {(Object.keys(PARTIAL_LABEL) as Array<keyof typeof PARTIAL_LABEL>).map((k) => <option key={k} value={k}>{PARTIAL_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Linhas finas (tela)"><Check id="lg-thin" checked={g.thinLines === true} onChange={(x) => edit({ thinLines: x })} /></Row>
      <div className="hint">A plotagem (prancha, PDF e DXF) mantém os pesos de linha reais.</div>
      {error && <div className="vr-error" role="alert">{error}</div>}
      <div className="prow"><span /><button className="btn small" onClick={() => useUi.setState({ dialog: 'graphicsVisibility', dialogArg: levelId })}>Visibilidade e gráficos…</button></div>
      <div className="prow"><span /><button className="btn small" onClick={() => setError(restoreLevelGraphicsDefault(editor.store, levelId).error)}>Restaurar padrão</button></div>
      {hidden.length > 0 ? (
        <div className="hint">Oculto nesta vista: {hidden.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')}.</div>
      ) : null}
    </Group>
  );
}

/** Gráficos do corte/elevação (decisão 0015 §3): os mesmos controles da planta, guardados no projeto. */
export function SectionGraphicsGroup(): ReactElement {
  const p = useProject();
  const g = sectionGraphicsOf(p);
  const [error, setError] = useState<string | null>(null);
  const edit = (patch: SectionGraphicsPatch): void => setError(editSectionGraphics(editor.store, patch).error);
  const hidden = GRAPHICS_CATEGORIES.filter((c) => !g.overrides[c].visible);
  const isPreset = PLAN_SCALES.includes(g.scale);
  return (
    <Group title="Gráficos da vista" open={false}>
      <Row label="Escala" htmlFor="sg-scale">
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select id="sg-scale" className="select" value={isPreset ? String(g.scale) : ''} onChange={(e) => e.target.value && edit({ scale: Number(e.target.value) })} aria-label="Escala do corte">
            {!isPreset && <option value="">Outra</option>}
            {PLAN_SCALES.map((n) => <option key={n} value={n}>{`1:${n}`}</option>)}
          </select>
          <span className="val soft">1:</span>
          <NumField id="sg-scale-free" value={g.scale} decimals={0} min={1} width={64} onCommit={(v) => edit({ scale: v })} />
        </span>
      </Row>
      <Row label="Detalhe" htmlFor="sg-detail">
        <select id="sg-detail" className="select" value={g.detail} onChange={(e) => edit({ detail: e.target.value as ViewGraphics['detail'] })}>
          {(Object.keys(DETAIL_LABEL) as Array<keyof typeof DETAIL_LABEL>).map((k) => <option key={k} value={k}>{DETAIL_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Estilo visual" htmlFor="sg-style">
        <select id="sg-style" className="select" value={g.style} onChange={(e) => edit({ style: e.target.value as ViewGraphics['style'] })}>
          {PLAN_VISUAL_STYLES.map((k) => <option key={k} value={k}>{VISUAL_STYLE_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Parcial de estrutura" htmlFor="sg-partial">
        <select id="sg-partial" className="select" value={g.partialStructure} onChange={(e) => edit({ partialStructure: e.target.value as ViewGraphics['partialStructure'] })}>
          {(Object.keys(PARTIAL_LABEL) as Array<keyof typeof PARTIAL_LABEL>).map((k) => <option key={k} value={k}>{PARTIAL_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Linhas finas (tela)"><Check id="sg-thin" checked={g.thinLines === true} onChange={(x) => edit({ thinLines: x })} /></Row>
      <div className="hint">A plotagem (prancha, PDF e DXF) mantém os pesos de linha reais.</div>
      {error && <div className="vr-error" role="alert">{error}</div>}
      <div className="prow"><span /><button className="btn small" onClick={() => useUi.setState({ dialog: 'graphicsVisibility', dialogArg: 'section' })}>Visibilidade e gráficos…</button></div>
      <div className="prow"><span /><button className="btn small" onClick={() => setError(restoreSectionGraphicsDefault(editor.store).error)}>Restaurar padrão</button></div>
      {hidden.length > 0 ? (
        <div className="hint">Oculto nesta vista: {hidden.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')}.</div>
      ) : null}
    </Group>
  );
}

/** Cor de fundo do 3D: campo de cor que grava ao sair (cada escolha de cor seria um passo de desfazer). */
function BackgroundField({ value, onCommit }: { value: string; onCommit: (v: string) => void }): ReactElement {
  const [draft, setDraft] = useState(value);
  return (
    <input
      id="v3-bg"
      type="color"
      className="input"
      value={draft}
      aria-label="Cor do fundo do 3D"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  );
}

/** Gráficos do modelo 3D (decisão 0015 §3): estilo, parcial, sombras, arestas, sol e fundo. Sombras e arestas são do projeto. */
export function View3DGroup(): ReactElement {
  const p = useProject();
  const v = view3dOf(p);
  const [error, setError] = useState<string | null>(null);
  const edit = (patch: View3DPatch): void => setError(editView3D(editor.store, patch).error);
  const hidden = GRAPHICS_CATEGORIES.filter((c) => !v.overrides[c].visible);
  return (
    <Group title="Gráficos do 3D">
      <Row label="Estilo visual" htmlFor="v3-style">
        <select id="v3-style" className="select" value={v.style} onChange={(e) => edit({ style: e.target.value as View3DSettings['style'] })}>
          {(Object.keys(VISUAL_STYLE_LABEL) as Array<keyof typeof VISUAL_STYLE_LABEL>).map((k) => <option key={k} value={k}>{VISUAL_STYLE_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Exibição parcial" htmlFor="v3-partial">
        <select id="v3-partial" className="select" value={v.partialStructure} onChange={(e) => edit({ partialStructure: e.target.value as View3DSettings['partialStructure'] })}>
          {(Object.keys(PARTIAL_LABEL) as Array<keyof typeof PARTIAL_LABEL>).map((k) => <option key={k} value={k}>{PARTIAL_LABEL[k]}</option>)}
        </select>
      </Row>
      <Row label="Sombras"><Check id="v3-shadows" checked={v.shadows} onChange={(x) => edit({ shadows: x })} /></Row>
      <Row label="Arestas"><Check id="v3-edges" checked={v.edges} onChange={(x) => edit({ edges: x })} /></Row>
      <Row label="Sol: azimute" htmlFor="v3-az"><NumField id="v3-az" value={v.sunAzimuth} decimals={0} unit="°" min={0} max={360} onCommit={(x) => edit({ sunAzimuth: x })} /></Row>
      <Row label="Sol: elevação" htmlFor="v3-el"><NumField id="v3-el" value={v.sunElevation} decimals={0} unit="°" min={0} max={90} onCommit={(x) => edit({ sunElevation: x })} /></Row>
      <Row label="Fundo">
        <span className="numwrap">
          <Check id="v3-bg-theme" checked={v.background === null} onChange={(x) => edit({ background: x ? null : '#f4f6f8' })}>Padrão do tema</Check>
          {v.background !== null && <BackgroundField key={v.background} value={v.background} onCommit={(x) => edit({ background: x })} />}
        </span>
      </Row>
      {error && <div className="vr-error" role="alert">{error}</div>}
      <div className="prow"><span /><button className="btn small" onClick={() => useUi.setState({ dialog: 'graphicsVisibility', dialogArg: '3d' })}>Visibilidade e gráficos…</button></div>
      <div className="prow"><span /><button className="btn small" onClick={() => setError(restoreView3DDefault(editor.store).error)}>Restaurar padrão</button></div>
      {hidden.length > 0 ? (
        <div className="hint">Oculto no 3D: {hidden.map((c) => CATEGORY_LABEL[c].toLowerCase()).join(', ')}.</div>
      ) : null}
    </Group>
  );
}
