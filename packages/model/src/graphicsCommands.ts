import {
  GRAPHICS_CATEGORIES,
  graphicsIssues,
  graphicsOf,
  levelGraphicsOf,
  view3dOf,
  type CategoryLineStyle,
  type CategoryOverride,
  type DeepPartial,
  type GraphicsCategory,
  type ProjectGraphics,
  type View3DSettings,
  type ViewGraphics,
} from './graphics.ts';
import type { Id, Project } from './types.ts';

/**
 * Comandos de gráficos (decisão 0015). Cada um mescla o patch no valor efetivo atual e grava o objeto COMPLETO;
 * se houver qualquer problema, recusa com mensagens pt-BR e não altera o projeto.
 */

/** Cópia sem referências: rascunhos do immer e objetos do chamador não entram no estado. */
const copy = <T>(x: T): T => {
  if (Array.isArray(x)) return x.map(copy) as T;
  if (x !== null && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, copy(v)])) as T;
  return x;
};

/** Em substituições por categoria, `undefined` remove o campo opcional (volta a valer o do projeto). */
const withoutUndefined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function mergeOverrides(
  base: Record<GraphicsCategory, CategoryOverride>,
  patch: DeepPartial<Record<GraphicsCategory, CategoryOverride>> | undefined,
): Record<GraphicsCategory, CategoryOverride> {
  const out = {} as Record<GraphicsCategory, CategoryOverride>;
  for (const c of GRAPHICS_CATEGORIES) out[c] = withoutUndefined({ ...base[c], ...patch?.[c] }) as CategoryOverride;
  return out;
}

function mergeProject(cur: ProjectGraphics, patch: DeepPartial<ProjectGraphics>): ProjectGraphics {
  const categories = {} as Record<GraphicsCategory, CategoryLineStyle>;
  for (const c of GRAPHICS_CATEGORIES) categories[c] = { ...cur.categories[c], ...patch.categories?.[c] } as CategoryLineStyle;
  return { ...cur, ...patch, categories, detailByScale: { ...cur.detailByScale, ...patch.detailByScale } } as ProjectGraphics;
}

function mergeLevel(cur: ViewGraphics, patch: DeepPartial<ViewGraphics>): ViewGraphics {
  return { ...cur, ...patch, overrides: mergeOverrides(cur.overrides, patch.overrides) } as ViewGraphics;
}

function mergeView3D(cur: View3DSettings, patch: DeepPartial<View3DSettings>): View3DSettings {
  return { ...cur, ...patch, overrides: mergeOverrides(cur.overrides, patch.overrides) } as View3DSettings;
}

function refuse(issues: string[]): void {
  if (issues.length > 0) throw new Error(issues.join(' '));
}

function levelOf(p: Project, levelId: Id) {
  const l = p.levels.find((x) => x.id === levelId);
  if (!l) throw new Error('Nível inexistente');
  return l;
}

export function applyProjectGraphics(p: Project, patch: DeepPartial<ProjectGraphics>): void {
  const next = mergeProject(copy(graphicsOf(p)), copy(patch));
  refuse(graphicsIssues(next));
  p.graphics = next;
}

export function applyLevelGraphics(p: Project, levelId: Id, patch: DeepPartial<ViewGraphics>): void {
  const l = levelOf(p, levelId);
  const next = mergeLevel(copy(levelGraphicsOf(p, levelId)), copy(patch));
  refuse(graphicsIssues(next));
  l.graphics = next;
}

export function resetLevelGraphics(p: Project, levelId: Id): void {
  delete levelOf(p, levelId).graphics;
}

export function applyView3D(p: Project, patch: DeepPartial<View3DSettings>): void {
  const next = mergeView3D(copy(view3dOf(p)), copy(patch));
  refuse(graphicsIssues(next));
  p.view3d = next;
}

export function resetView3D(p: Project): void {
  delete p.view3d;
}
