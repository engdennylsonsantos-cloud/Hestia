import type { ResolvedLevel, ResolvedRamp, ResolvedStair } from '@hestia/engine';
import type { Id, Project } from '@hestia/model';
import { ambientesDoNivel, escadasDoNivel, lajesDoNivel, pisosDoNivel, rampasDoNivel, telhadosDoNivel } from './resolucao.ts';
import { planStyleOf, type PlanStyle } from './style.ts';
import { planViewOf, type PlanView } from './view.ts';
import type { PlanInput } from './build.ts';

/**
 * Pavimento de baixo como referência apagada (D1–D4): o nível e o que ele tem de desenhar. `on` desliga a referência
 * (opção "mostrar o nível de baixo"); `resolve` é a resolução do nível (o app a guarda em cache).
 */
/**
 * Pavimento de referência da planta: a escolha do usuário, se for um nível abaixo do atual; senão o de baixo, que é o
 * automático. Desligado (`on` falso) ou sem nível abaixo, não há referência. A planta e a captura usam esta função.
 */
export function underlayIdOf(p: Project, levelId: Id, on: boolean, choice: Id | null = null): Id | null {
  const idx = p.levels.findIndex((l) => l.id === levelId);
  if (!on || idx <= 0) return null;
  const ci = choice ? p.levels.findIndex((l) => l.id === choice) : -1;
  return ci >= 0 && ci < idx ? p.levels[ci]!.id : p.levels[idx - 1]!.id;
}

export function planBelowOf(p: Project, levelId: Id, resolve: (id: Id) => ResolvedLevel, on: boolean, choice: Id | null = null): Pick<PlanInput, 'below' | 'belowFloors' | 'belowSlabs' | 'belowRoofs' | 'belowRooms'> {
  const id = underlayIdOf(p, levelId, on, choice);
  if (!id) return { below: null };
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
  /** Rampas do nível que a planta mostra (sem as ocultas pela vista). */
  ramps: ResolvedRamp[];
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
  const ramps = rampasDoNivel(p, input.levelId).filter((r) => !hidden?.has(r.id));
  return { style, rp, view, up, geo, hidden, roofOff, roofHidden, stairs, ramps };
}
