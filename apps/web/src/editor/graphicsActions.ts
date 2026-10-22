import { DEFAULT_CATEGORY_STYLES, DEFAULT_LINE_WEIGHTS, DEFAULT_PROJECT_GRAPHICS, graphicsOf, levelGraphicsOf, sectionGraphicsOf, view3dOf, type Command, type Id, type ProjectStore } from '@hestia/model';

/** Resultado de uma edição de gráficos: `error` traz a mensagem pt-BR de quem recusou (nada é gravado). */
export interface GraphicsEdit {
  ok: boolean;
  error: string | null;
}

/** Patches parciais e profundos (o comando faz o merge): só as chaves dadas mudam. */
export type LevelGraphicsPatch = Extract<Command, { type: 'setLevelGraphics' }>['patch'];
export type View3DPatch = Extract<Command, { type: 'setView3D' }>['patch'];
export type SectionGraphicsPatch = Extract<Command, { type: 'setSectionGraphics' }>['patch'];
export type ProjectGraphicsPatch = Extract<Command, { type: 'setProjectGraphics' }>['patch'];

const OK: GraphicsEdit = { ok: true, error: null };

const failed = (e: unknown): GraphicsEdit => ({ ok: false, error: e instanceof Error ? e.message : 'Gráficos inválidos.' });

/**
 * Verdadeiro quando cada valor do patch já é o efetivo na vista (valores com padrão aplicado). Usado para não chamar o
 * comando à toa: sem mudança real, não há passo de desfazer vazio.
 */
export function alreadyApplied(patch: unknown, current: unknown): boolean {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return JSON.stringify(patch) === JSON.stringify(current);
  if (current === null || typeof current !== 'object') return false;
  return Object.entries(patch as Record<string, unknown>).every(([k, v]) => alreadyApplied(v, (current as Record<string, unknown>)[k]));
}

/** Aplica os gráficos de uma planta (um nível). O comando valida; a mensagem dele vira o erro. */
export function editLevelGraphics(store: ProjectStore, levelId: Id, patch: LevelGraphicsPatch, label = 'Alterar gráficos da vista'): GraphicsEdit {
  try {
    const exists = store.project.levels.some((l) => l.id === levelId);
    if (exists && alreadyApplied(patch, levelGraphicsOf(store.project, levelId))) return OK;
    store.exec({ type: 'setLevelGraphics', levelId, patch }, label);
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Aplica os gráficos da vista 3D (também sombras, arestas, sol e fundo). */
export function editView3D(store: ProjectStore, patch: View3DPatch, label = 'Alterar gráficos do 3D'): GraphicsEdit {
  try {
    if (alreadyApplied(patch, view3dOf(store.project))) return OK;
    store.exec({ type: 'setView3D', patch }, label);
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Aplica a tabela de pesos, os pesos por categoria e os limites de detalhe do projeto. */
export function editProjectGraphics(store: ProjectStore, patch: ProjectGraphicsPatch, label = 'Alterar pesos de linha'): GraphicsEdit {
  try {
    if (alreadyApplied(patch, graphicsOf(store.project))) return OK;
    store.exec({ type: 'setProjectGraphics', patch }, label);
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Volta os gráficos da planta do nível ao padrão (apaga o que o nível guardou). Sem nada guardado, não faz nada. */
export function restoreLevelGraphicsDefault(store: ProjectStore, levelId: Id): GraphicsEdit {
  try {
    const lv = store.project.levels.find((l) => l.id === levelId);
    if (lv && !lv.graphics) return OK;
    store.exec({ type: 'resetLevelGraphics', levelId }, 'Restaurar gráficos da vista');
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Volta a vista 3D ao padrão (estilo, sol, fundo, sombras e arestas). Sem nada guardado, não faz nada. */
export function restoreView3DDefault(store: ProjectStore): GraphicsEdit {
  try {
    if (!store.project.view3d) return OK;
    store.exec({ type: 'resetView3D' }, 'Restaurar gráficos do 3D');
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Aplica os gráficos do corte/elevação (um único conjunto para todas as vistas de corte). */
export function editSectionGraphics(store: ProjectStore, patch: SectionGraphicsPatch, label = 'Alterar gráficos do corte'): GraphicsEdit {
  try {
    if (alreadyApplied(patch, sectionGraphicsOf(store.project))) return OK;
    store.exec({ type: 'setSectionGraphics', patch }, label);
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Volta os gráficos do corte/elevação ao padrão (apaga o que o projeto guardou). */
export function restoreSectionGraphicsDefault(store: ProjectStore): GraphicsEdit {
  try {
    if (!store.project.sectionGraphics) return OK;
    store.exec({ type: 'resetSectionGraphics' }, 'Restaurar gráficos do corte');
    return OK;
  } catch (e) {
    return failed(e);
  }
}

/** Volta a tabela de pesos e os pesos por categoria ao padrão (escolha do Hestia, 0015 §2). */
export function restoreProjectGraphicsDefault(store: ProjectStore): GraphicsEdit {
  return editProjectGraphics(
    store,
    {
      lineWeights: structuredClone(DEFAULT_LINE_WEIGHTS) as ProjectGraphicsPatch['lineWeights'],
      categories: structuredClone(DEFAULT_CATEGORY_STYLES),
      detailByScale: { ...DEFAULT_PROJECT_GRAPHICS.detailByScale },
    },
    'Restaurar pesos de linha',
  );
}
