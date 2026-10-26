import { useEffect, useMemo, type ReactElement } from 'react';
import { useI18n } from '../editor/i18n.ts';
import { perimeterActions, usePerimeter } from '../editor/perimeter.ts';
import { useUi } from '../editor/state.ts';
import { txt, type RibbonTab, type RibbonTabId } from './ribbon/model.ts';
import { PanelView } from './ribbon/parts.tsx';
import { contextTab, perimeterTab } from './ribbon/context.ts';
import { TABS } from './ribbon/tabs.ts';
import { useRibbonCtx } from './ribbon/useCtx.ts';
import { PerimeterRibbonPanels } from './perimeter/PerimeterRibbonPanels.tsx';
import './perimeter/perimeter.css';

/**
 * Faixa de ferramentas no padrão Revit: aba Arquivo, 14 abas na ordem do Revit e, depois de Modificar, a aba contextual
 * verde. Todo o conteúdo vem dos dados de `ribbon/` (abas → painéis → itens); aqui só se escolhe a aba e se desenha.
 * Com o modo de perímetro aberto, a aba contextual é a dele (Modo e Desenhar no lugar do slot `perimetro`).
 */
export function Ribbon(): ReactElement {
  const lang = useI18n((s) => s.lang);
  const ctx = useRibbonCtx();
  const ribbon = useUi((st) => st.ribbon);
  const ribbonBack = useUi((st) => st.ribbonBack);
  const perim = usePerimeter();
  const pTab = useMemo(() => (perim.active ? perimeterTab(perim.target, perim.editing) : null), [perim.active, perim.target, perim.editing]);
  const ctxTab = useMemo(() => (pTab ? null : contextTab(ctx.tool, ctx.selection, ctx.p)), [pTab, ctx.tool, ctx.selection, ctx.p]);
  const key = pTab?.key ?? ctxTab?.key ?? null;
  const ctxLabel = pTab?.label ?? ctxTab?.tab.label;

  // A aba contextual é selecionada sozinha quando nasce (ou quando o assunto muda) e, ao sumir, devolve a aba de antes.
  useEffect(() => {
    const s = useUi.getState();
    if (key && s.ribbon !== 'ctx') useUi.setState({ ribbonBack: s.ribbon, ribbon: 'ctx' });
    else if (!key && s.ribbon === 'ctx') useUi.setState({ ribbon: s.ribbonBack });
  }, [key]);

  const activeId: RibbonTabId = ribbon === 'ctx' && !key ? ribbonBack : ribbon;
  const active: RibbonTab | undefined = activeId === 'ctx' ? ctxTab?.tab : TABS.find((tb) => tb.id === activeId);
  const select = (id: RibbonTabId): void => useUi.setState({ ribbon: id });

  const body = (): ReactElement[] | undefined => {
    if (activeId !== 'ctx' || !pTab) return active?.panels.map((panel) => <PanelView key={panel.id} panel={panel} ctx={ctx} lang={lang} />);
    return pTab.slots.map((slot) => slot.kind === 'panel'
      ? <PanelView key={slot.panel.id} panel={slot.panel} ctx={ctx} lang={lang} />
      : (
        <PerimeterRibbonPanels
          key="perimetro"
          target={perim.target}
          result={perim.result}
          lineKind={perim.lineKind}
          shape={perim.shape}
          onLineKind={perimeterActions.setLineKind}
          onShape={perimeterActions.setShape}
          onFinish={perimeterActions.finish}
          onCancel={perimeterActions.cancel}
        />
      ));
  };

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
        {ctxLabel && (
          <button className={`rtab contextual${activeId === 'ctx' ? ' on' : ''}`} onClick={() => select('ctx')}>
            {txt(ctxLabel, lang)}
          </button>
        )}
      </nav>
      <div className={`ribbon${activeId === 'ctx' ? ' ctx' : ''}`} role="toolbar" aria-label={lang === 'pt' ? 'Ferramentas' : 'Tools'}>
        {body()}
      </div>
    </>
  );
}
