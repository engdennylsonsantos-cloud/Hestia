import type { ReactElement } from 'react';
import { levelGraphicsOf, sectionGraphicsOf } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { editLevelGraphics, editSectionGraphics, editThinLines, thinLinesOn } from '../editor/graphicsActions.ts';
import { useUi } from '../editor/state.ts';
import { useI18n, I18N } from '../editor/i18n.ts';
import { Icon } from './Icon.tsx';

/**
 * Barra de Controle de Vista (View Control Bar do Autodesk Revit):
 * Ancorada na borda inferior esquerda do canvas de desenho, oferece
 * acesso rápido à escala da vista (1:20, 1:50, 1:100, 1:200), linhas finas (TL) e enquadramento.
 */
export function ViewControlBar(): ReactElement {
  const p = useProject();
  const s = useUi();
  const lang = useI18n((s) => s.lang);
  const t = I18N[lang];

  // Escala efetiva da vista ativa (lida de levelGraphicsOf ou sectionGraphicsOf)
  const isSection = s.view === 'section';
  const currentScale = isSection
    ? sectionGraphicsOf(p).scale
    : levelGraphicsOf(p, s.levelId).scale;

  const scales = [20, 50, 100, 200];

  const setScale = (scale: number): void => {
    if (isSection) {
      editSectionGraphics(editor.store, { scale }, 'Alterar escala do corte');
    } else {
      editLevelGraphics(editor.store, s.levelId, { scale }, 'Alterar escala do nível');
    }
  };

  const thinAvailable = s.view === 'plan' || s.view === 'section';
  const thinTarget = isSection ? 'section' : { levelId: s.levelId };
  const thin = thinAvailable && thinLinesOn(p, thinTarget);
  const toggleThin = (): void => {
    const r = editThinLines(editor.store, thinTarget, !thin);
    if (!r.ok) useUi.setState({ status: r.error ?? 'Não foi possível alterar linhas finas.' });
  };

  return (
    <div className="view-control-bar" role="toolbar" aria-label="Barra de controle da vista">
      {/* Escala (1:50, 1:100...) */}
      <div className="vc-group">
        <label htmlFor="vc-scale-select" className="vc-label">{t.scale}:</label>
        <select
          id="vc-scale-select"
          className="vc-select"
          value={currentScale}
          onChange={(e) => setScale(Number(e.target.value))}
          title={lang === 'pt' ? 'Escala da vista ativa' : 'Active view scale'}
        >
          {scales.map((sc) => (
            <option key={sc} value={sc}>
              1 : {sc}
            </option>
          ))}
        </select>
      </div>

      <span className="vc-sep" />

      {/* Linhas Finas (Thin Lines TL do Revit) */}
      <button
        className={`vc-btn${thin ? ' on' : ''}`}
        disabled={!thinAvailable}
        onClick={toggleThin}
        title={lang === 'pt' ? 'Linhas finas (TL) — 1px na tela' : 'Thin lines (TL)'}
      >
        <Icon name="plan" size={14} />
        <span>TL</span>
      </button>

      {/* Enquadrar Tudo (Fit) */}
      <button
        className="vc-btn"
        onClick={() => (s.view !== '3d' ? editor.zoomExtents() : useUi.setState({ previewTick: s.previewTick + 1 }))}
        title={lang === 'pt' ? 'Enquadrar vista (ZF)' : 'Zoom to fit (ZF)'}
      >
        <Icon name="fit" size={14} />
      </button>
    </div>
  );
}
