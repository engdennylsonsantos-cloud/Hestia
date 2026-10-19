import type { ReactElement } from 'react';
import { buildSectionDrawList, DARK, LIGHT, type PlanDrawList, type Viewport } from '@hestia/render';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Icon } from './Icon.tsx';

/**
 * Quadro da vista de corte ou elevação: a mesma lista de desenho da planta, desenhada pelo mesmo canvas.
 * Só leitura: não há ferramentas nesta vista; o cálculo do corte é cacheado pelo controlador por projeto.
 */
export function buildSectionFrame(v: Viewport, dark: boolean): PlanDrawList | null {
  const st = useUi.getState();
  const section = editor.sectionOf(st.sectionId);
  if (!section) return null;
  return buildSectionDrawList({ project: editor.project, section, viewport: v, theme: dark ? DARK : LIGHT, dark, showGrid: st.showGrid });
}

/** Nome da vista aberta, no canto, com saída para a planta. */
export function SectionBadge(): ReactElement | null {
  const p = useProject();
  const id = useUi((s) => s.sectionId);
  const view = p.views.find((x) => x.id === id);
  if (!view) return null;
  const isSection = view.kind === 'section';
  return (
    <div className="section-badge">
      <Icon name={isSection ? 'section' : 'elevation'} size={14} />
      <span className="section-name">{view.name}</span>
      <span className="section-kind">{isSection ? 'Corte' : 'Elevação'}</span>
      <button className="ibtn" title="Voltar à planta (Esc)" aria-label="Voltar à planta" onClick={() => editor.closeSection()}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
