import { sheetOf, type Project } from '@hestia/model';
import { editor } from './controller.ts';
import { activeViewOf, closeView, removeView, type OpenView } from './openViews.ts';
import { useUi } from './state.ts';

/** Rótulo e ícone de uma aba; null quando a vista não existe mais no projeto (nível, corte ou prancha excluídos). */
export function tabOf(p: Project, v: OpenView): { icon: 'plan' | 'cube' | 'section' | 'elevation'; label: string } | null {
  switch (v.kind) {
    case 'plan': {
      const l = p.levels.find((x) => x.id === v.levelId);
      return l ? { icon: 'plan', label: l.name } : null;
    }
    case '3d':
      return { icon: 'cube', label: 'Modelo 3D' };
    case 'section': {
      const sv = p.views.find((x) => x.id === v.viewId);
      return sv ? { icon: sv.kind === 'section' ? 'section' : 'elevation', label: sv.name } : null;
    }
    case 'sheet': {
      const sh = sheetOf(p, v.sheetId);
      return sh ? { icon: 'plan', label: `${sh.number} ${sh.name}` } : null;
    }
  }
}

/** Abre ou ativa uma vista (aba). Plantas passam por `selectLevel`, que já aponta a planta. */
export function activateView(v: OpenView): void {
  switch (v.kind) {
    case 'plan':
      editor.selectLevel(v.levelId);
      return;
    case '3d':
      editor.setView('3d');
      return;
    case 'section':
      editor.openSection(v.viewId);
      return;
    case 'sheet':
      useUi.setState({ view: 'sheet', sheetId: v.sheetId });
      return;
  }
}

/**
 * Fecha uma aba. A última não fecha: a mensagem vai para a barra de status. Fechar a ativa ativa a vizinha.
 * A lista é atualizada antes de ativar, para que a vizinha já esteja na lista quando a ativação acontecer.
 */
export function closeTab(target: OpenView): void {
  const s = useUi.getState();
  const r = closeView(s.openViews, target, activeViewOf(s));
  if (!r.ok) {
    useUi.setState({ status: r.message });
    return;
  }
  useUi.setState({ openViews: r.list });
  if (r.activate) activateView(r.activate);
}

/** Mantém em openViews só as vistas que o projeto ainda tem. Quem chama decide o que fazer se a lista esvaziar. */
export function dropMissingViews(p: Project): void {
  const cur = useUi.getState();
  const missing = cur.openViews.filter((v) => tabOf(p, v) === null);
  if (!missing.length) return;
  let list = cur.openViews;
  for (const v of missing) list = removeView(list, v);
  const act = activeViewOf(cur);
  const fallback: OpenView[] = act && tabOf(p, act) ? [act] : [{ kind: 'plan', levelId: p.levels[0]?.id ?? 'lv_0' }];
  useUi.setState({ openViews: list.length ? list : fallback });
}
