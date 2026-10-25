import type { ResolvedLevel, ResolvedStair } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { ambientesDoNivel, escadasDoNivel, lajesDoNivel, pisosDoNivel, telhadosDoNivel } from './resolucao.ts';
import { planStyleOf, type PlanStyle } from './style.ts';
import { planViewOf, type PlanView } from './view.ts';
import type { PlanInput } from './build.ts';

/**
 * Pavimento de baixo como referência apagada (D1–D4): o nível e o que ele tem de desenhar. `on` desliga a referência
 * (opção "mostrar o nível de baixo"); `resolve` é a resolução do nível (o app a guarda em cache).
 */
export function planBelowOf(p: Project, levelId: Id, resolve: (id: Id) => ResolvedLevel, on: boolean): Pick<PlanInput, 'below' | 'belowFloors' | 'belowSlabs' | 'belowRoofs' | 'belowRooms'> {
  const idx = p.levels.findIndex((l) => l.id === levelId);
  if (!on || idx <= 0) return { below: null };
  const id = p.levels[idx - 1]!.id;
  return { below: resolve(id), belowFloors: pisosDoNivel(p, id), belowSlabs: lajesDoNivel(p, id), belowRoofs: telhadosDoNivel(p, id), belowRooms: ambientesDoNivel(p, id) };
}

/**
 * Contexto derivado do nível e da vista: o mesmo para a geometria e para a sobreposição. Não depende de pan, de
 * seleção nem do cursor; só do projeto, do nível, do zoom e da planta de cobertura. Por isso a sobreposição pode ser
 * redesenhada sem refazer a geometria (ver `PlanFrame`).
 */
export interface PlanContext {
  style: PlanStyle;
  /** Planta de cobertura (D6). */
  rp: boolean;
  view: PlanView | null;
  /** Planta de forro (decisão 0021): vista para cima. */
  up: boolean;
  /** Geometria do nível que a planta desenha (com o intervalo de vista, ou a padrão). */
  geo: ResolvedLevel;
  hidden: ReadonlySet<Id> | undefined;
  /** Telhados ocultos pela categoria. */
  roofOff: ReadonlySet<Id> | undefined;
  /** Telhados ocultos para a seleção e o realce (a vista ou a categoria). */
  roofHidden: ReadonlySet<Id> | undefined;
  /** Escadas do nível que a planta mostra (sem as ocultas pela vista). */
  stairs: ResolvedStair[];
}

export function planContext(input: PlanInput): PlanContext {
  const { project: p, viewport: v } = input;
  const style = planStyleOf(p, input.levelId, v.zoom);
  const paint = style.paint;
  const rp = input.roofPlanMode === true;
  const view = rp ? null : planViewOf(p, input.levelId);
  const up = view?.range.direction === 'up';
  const geo: ResolvedLevel = view ? view.geo : input.resolved;
  const hidden = view?.hidden;
  const roofOff: ReadonlySet<Id> | undefined = view ? view.categoryHidden : paint.roof.visible ? undefined : new Set(telhadosDoNivel(p, input.levelId).map((r) => r.roofId));
  const roofHidden = view ? hidden : roofOff;
  const stairs = escadasDoNivel(p, input.levelId).filter((s) => !hidden?.has(s.id));
  return { style, rp, view, up, geo, hidden, roofOff, roofHidden, stairs };
}
