import { useEffect, useMemo, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProject } from '../editor/controller.ts';
import { useI18n } from '../editor/i18n.ts';
import { useUi } from '../editor/state.ts';
import { txt, type RibbonTab, type RibbonTabId } from './ribbon/model.ts';
import { PanelView } from './ribbon/parts.tsx';
import { contextTab } from './ribbon/context.ts';
import { TABS } from './ribbon/tabs.ts';
import type { RibbonCtx } from './ribbon/actions.ts';

/**
 * Faixa de ferramentas no padrão Revit: aba Arquivo, 14 abas na ordem do Revit e, depois de Modificar, a aba contextual
 * verde. Todo o conteúdo vem dos dados de `ribbon/` (abas → painéis → itens); aqui só se escolhe a aba e se desenha.
 */
export function Ribbon(): ReactElement {
  const lang = useI18n((s) => s.lang);
  const p = useProject();
  const ui = useUi(useShallow((s) => ({
    ribbon: s.ribbon, ribbonBack: s.ribbonBack, tool: s.tool, selection: s.selection, view: s.view, levelId: s.levelId, showGrid: s.showGrid,
    showUnderlay: s.showUnderlay, showRoofProjection: s.showRoofProjection, leftOpen: s.leftOpen, rightOpen: s.rightOpen, options: s.options,
  })));
  const ctxTab = useMemo(() => contextTab(ui.tool, ui.selection, p), [ui.tool, ui.selection, p]);
  const key = ctxTab?.key ?? null;

  // A aba contextual é selecionada sozinha quando nasce (ou quando o assunto muda) e, ao sumir, devolve a aba de antes.
  useEffect(() => {
    const s = useUi.getState();
    if (key && s.ribbon !== 'ctx') useUi.setState({ ribbonBack: s.ribbon, ribbon: 'ctx' });
    else if (!key && s.ribbon === 'ctx') useUi.setState({ ribbon: s.ribbonBack });
  }, [key]);

  const activeId: RibbonTabId = ui.ribbon === 'ctx' && !ctxTab ? ui.ribbonBack : ui.ribbon;
  const active: RibbonTab | undefined = activeId === 'ctx' ? ctxTab?.tab : TABS.find((tb) => tb.id === activeId);
  const ctx: RibbonCtx = { ...ui, p };
  const select = (id: RibbonTabId): void => useUi.setState({ ribbon: id });

  return (
    <>
      <nav className="ribbon-tabs" aria-label={lang === 'pt' ? 'Abas da faixa de ferramentas' : 'Ribbon tabs'}>
        <button className="rtab file" onClick={() => useUi.setState({ fileMenu: true })} aria-haspopup="dialog">
          {lang === 'pt' ? 'Arquivo' : 'File'}
        </button>
        {TABS.map((tb) => (
          <button key={tb.id} className={`rtab${activeId === tb.id ? ' on' : ''}`} onClick={() => select(tb.id)}>
            {txt(tb.label, lang)}
          </button>
        ))}
        {ctxTab && (
          <button className={`rtab contextual${activeId === 'ctx' ? ' on' : ''}`} onClick={() => select('ctx')}>
            {txt(ctxTab.tab.label, lang)}
          </button>
        )}
      </nav>
      <div className={`ribbon${activeId === 'ctx' ? ' ctx' : ''}`} role="toolbar" aria-label={lang === 'pt' ? 'Ferramentas' : 'Tools'}>
        {active?.panels.map((panel) => <PanelView key={panel.id} panel={panel} ctx={ctx} lang={lang} />)}
      </div>
    </>
  );
}
