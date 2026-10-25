import type { ReactElement } from 'react';
import { PLAN_VISUAL_STYLES, levelGraphicsOf, sectionGraphicsOf, view3dOf, type View3DSettings, type ViewGraphics } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { editLevelGraphics, editSectionGraphics, editView3D, type GraphicsEdit } from '../editor/graphicsActions.ts';
import { useI18n } from '../editor/i18n.ts';
import { useUi } from '../editor/state.ts';
import { DETAIL_LABEL, PLAN_SCALES, VISUAL_STYLE_LABEL } from './graphicsLabels.ts';
import { Icon } from './Icon.tsx';

/**
 * Barra de Controle de Vista (como no Revit): faixa fixa na base da vista, com escala, nível de detalhe, estilo visual,
 * sombras e os controles ainda não disponíveis (caminho do sol, região de corte, ocultar/isolar, revelar ocultos).
 * Cada controle grava na vista ativa (planta, corte ou 3D) com um passo de desfazer.
 */

const SOON = ['Caminho do sol', 'Cortar vista', 'Mostrar região de corte', 'Ocultar/isolar temporário', 'Revelar elementos ocultos', 'Propriedades temporárias da vista'] as const;
const SOON_EN = ['Sun Path', 'Crop View', 'Show Crop Region', 'Temporary Hide/Isolate', 'Reveal Hidden Elements', 'Temporary View Properties'] as const;
const SOON_ICON = ['sun', 'crop', 'crop', 'isolate', 'eye', 'soon'] as const;

export function ViewControlBar(): ReactElement | null {
  const p = useProject();
  const view = useUi((s) => s.view);
  const levelId = useUi((s) => s.levelId);
  const lang = useI18n((s) => s.lang);
  const pt = lang === 'pt';
  if (view === 'sheet') return null;

  const is3d = view === '3d';
  const g: ViewGraphics | View3DSettings = is3d ? view3dOf(p) : view === 'section' ? sectionGraphicsOf(p) : levelGraphicsOf(p, levelId);
  const report = (r: GraphicsEdit): void => {
    if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar a vista.' });
  };
  const editPlan = (patch: Partial<Pick<ViewGraphics, 'scale' | 'detail' | 'style'>>): void =>
    report(view === 'section' ? editSectionGraphics(editor.store, patch) : editLevelGraphics(editor.store, levelId, patch));
  const edit3d = (patch: Partial<Pick<View3DSettings, 'style' | 'shadows' | 'edges' | 'openOpenings'>>): void => report(editView3D(editor.store, patch));

  const scale = !is3d ? (g as ViewGraphics).scale : 0;
  const v3 = is3d ? (g as View3DSettings) : null;
  const toggle = (label: string, icon: string, on: boolean, onClick: () => void, tip: string): ReactElement => (
    <button className={`vcb-btn${on ? ' on' : ''}`} aria-pressed={on} title={tip} onClick={onClick}>
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="vcb" role="toolbar" aria-label={pt ? 'Barra de controle da vista' : 'View control bar'}>
      {!is3d && (
        <label className="vcb-field" title={pt ? 'Escala da vista ativa' : 'Active view scale'}>
          <Icon name="scale" size={14} />
          <select id="vc-scale-select" className="vcb-select" value={PLAN_SCALES.includes(scale) ? String(scale) : ''} aria-label={pt ? 'Escala' : 'Scale'} onChange={(e) => e.target.value && editPlan({ scale: Number(e.target.value) })}>
            {!PLAN_SCALES.includes(scale) && <option value="">1 : {scale}</option>}
            {PLAN_SCALES.map((n) => <option key={n} value={n}>{`1 : ${n}`}</option>)}
          </select>
        </label>
      )}
      {!is3d && (
        <label className="vcb-field" title={pt ? 'Nível de detalhe' : 'Detail level'}>
          <Icon name="detail" size={14} />
          <select className="vcb-select" value={(g as ViewGraphics).detail} aria-label={pt ? 'Nível de detalhe' : 'Detail level'} onChange={(e) => editPlan({ detail: e.target.value as ViewGraphics['detail'] })}>
            {(Object.keys(DETAIL_LABEL) as Array<keyof typeof DETAIL_LABEL>).map((k) => <option key={k} value={k}>{DETAIL_LABEL[k]}</option>)}
          </select>
        </label>
      )}
      <label className="vcb-field" title={pt ? 'Estilo visual' : 'Visual style'}>
        <Icon name="style" size={14} />
        <select
          className="vcb-select"
          value={g.style}
          aria-label={pt ? 'Estilo visual' : 'Visual style'}
          onChange={(e) => (is3d ? edit3d({ style: e.target.value as View3DSettings['style'] }) : editPlan({ style: e.target.value as ViewGraphics['style'] }))}
        >
          {(is3d ? (Object.keys(VISUAL_STYLE_LABEL) as Array<keyof typeof VISUAL_STYLE_LABEL>) : PLAN_VISUAL_STYLES).map((k) => <option key={k} value={k}>{VISUAL_STYLE_LABEL[k]}</option>)}
        </select>
      </label>
      <span className="vcb-sep" />
      {v3 && toggle(pt ? 'Sombras' : 'Shadows', 'sun', v3.shadows, () => edit3d({ shadows: !v3.shadows }), pt ? 'Liga ou desliga as sombras do sol' : 'Toggle sun shadows')}
      {v3 && toggle(pt ? 'Arestas' : 'Edges', 'cube', v3.edges, () => edit3d({ edges: !v3.edges }), pt ? 'Mostra as arestas dos elementos' : 'Show element edges')}
      {v3 && toggle(pt ? 'Abrir vãos' : 'Open openings', 'door', v3.openOpenings === true, () => edit3d({ openOpenings: !(v3.openOpenings === true) }), pt ? 'Mostra portas e janelas abertas' : 'Show doors and windows open')}
      {v3 && <span className="vcb-sep" />}
      {SOON.map((label, i) => (
        <button key={label} className="vcb-btn soon" disabled title={`${pt ? label : SOON_EN[i]}\n— ${pt ? 'ainda não disponível' : 'not available yet'}`} aria-label={pt ? label : SOON_EN[i]}>
          <Icon name={SOON_ICON[i] ?? 'soon'} size={14} />
        </button>
      ))}
    </div>
  );
}
