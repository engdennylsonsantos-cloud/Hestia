import { sheetOf, type Id, type Project } from '@hestia/model';
import { editor } from './controller.ts';
import { activeViewOf, addView, closeView, levelToRelease, removeView, type OpenView } from './openViews.ts';
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

/**
 * Libera o nível de uma planta fechada (a frente de edição cria `editor.releaseLevel`). Enquanto o método não
 * existir, não faz nada. Depois do merge, pode virar a chamada direta `editor.releaseLevel(id)`.
 */
function releaseLevel(levelId: Id): void {
  const ed = editor as unknown as { releaseLevel?: (id: Id) => void };
  if (typeof ed.releaseLevel === 'function') ed.releaseLevel(levelId);
}

/**
 * Abre ou ativa uma vista (aba). Plantas passam por `selectLevel`, que já aponta a planta.
 * Garante a aba na lista mesmo quando a vista já é a ativa (caso de reabrir depois de fechar a última aba,
 * em que a vista ativa não muda e a sincronização de `state.ts` não percebe a mudança).
 */
export function activateView(v: OpenView): void {
  switch (v.kind) {
    case 'plan':
      editor.selectLevel(v.levelId);
      break;
    case '3d':
      editor.setView('3d');
      break;
    case 'section':
      editor.openSection(v.viewId);
      break;
    case 'sheet':
      useUi.setState({ view: 'sheet', sheetId: v.sheetId });
      break;
  }
  const s = useUi.getState();
  if (!tabOf(editor.project, v)) return;
  const next = addView(s.openViews, v);
  if (next !== s.openViews) useUi.setState({ openViews: next });
}

/**
 * Fecha uma aba. Qualquer aba fecha, inclusive a última: a área de desenho mostra o estado vazio.
 * Fechar a ativa ativa a vizinha; sem vizinha (lista vazia), limpa a seleção. Fechar uma planta libera o nível.
 */
export function closeTab(target: OpenView): void {
  const s = useUi.getState();
  const r = closeView(s.openViews, target, activeViewOf(s));
  useUi.setState({ openViews: r.list });
  const level = levelToRelease(target);
  if (level) releaseLevel(level);
  if (r.activate) activateView(r.activate);
  else if (r.list.length === 0) useUi.setState({ selection: [], hover: null });
}

/** Mantém em openViews só as vistas que o projeto ainda tem. Lista vazia é um estado válido (estado vazio na área de desenho). */
export function dropMissingViews(p: Project): void {
  const cur = useUi.getState();
  const missing = cur.openViews.filter((v) => tabOf(p, v) === null);
  if (!missing.length) return;
  let list = cur.openViews;
  for (const v of missing) list = removeView(list, v);
  useUi.setState({ openViews: list });
}
