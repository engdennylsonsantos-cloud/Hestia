import type { Id, Project } from '@hestia/model';

/** Pavimento de referência da planta: o de baixo, quando o Subpavimento está ligado e há um abaixo. */
export function underlayLevelOf(p: Project, levelId: Id, on: boolean): Id | null {
  const idx = p.levels.findIndex((l) => l.id === levelId);
  return on && idx > 0 ? p.levels[idx - 1]!.id : null;
}
