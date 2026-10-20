import { elementLevelId, hasLevel, type Id, type LevelKeep, type Project, type ProjectStore } from '@hestia/model';

/** Preferência da tela (não do projeto): como manter a cota ao trocar de nível. Padrão: manter a cota. */
export const LEVEL_KEEP_KEY = 'hestia.levelKeep';

export const LEVEL_KEEP_LABEL: Record<LevelKeep, string> = { elevation: 'Manter a cota', offset: 'Levar o deslocamento' };

export function readLevelKeep(): LevelKeep {
  try {
    const v = localStorage.getItem(LEVEL_KEEP_KEY);
    if (v === 'elevation' || v === 'offset') return v;
  } catch {
    /* armazenamento indisponível: vale o padrão */
  }
  return 'elevation';
}

export function writeLevelKeep(keep: LevelKeep): void {
  try {
    localStorage.setItem(LEVEL_KEEP_KEY, keep);
  } catch {
    /* sem armazenamento: a escolha vale só nesta sessão */
  }
}

export interface LevelMove {
  ok: boolean;
  /** Elementos que mudaram de nível. */
  moved: number;
  /** Mensagem para a barra de status. */
  message: string;
}

/** Ids que têm nível próprio. Aberturas ficam de fora: acompanham a parede anfitriã. */
export function levelBearingIds(p: Project, ids: Id[]): Id[] {
  return ids.filter((id) => hasLevel(p.elements[id]));
}

/**
 * Move os elementos para o nível dado, em um único passo de desfazer ("Mudar de nível").
 * A seleção e a vista não mudam; se o nível novo não for o da vista, a mensagem avisa.
 */
export function moveToLevel(store: ProjectStore, ids: Id[], levelId: Id, keep: LevelKeep, activeLevelId: Id): LevelMove {
  const p = store.project;
  const target = p.levels.find((l) => l.id === levelId);
  if (!target) return { ok: false, moved: 0, message: 'Nível inexistente.' };
  const unique = [...new Set(ids)];
  const targets = levelBearingIds(p, unique);
  const skippedOpenings = unique.length > targets.length;
  if (targets.length === 0) return { ok: false, moved: 0, message: 'Nada a mover: selecione paredes, pisos, lajes ou telhados.' };
  const moved = targets.filter((id) => elementLevelId(p.elements[id]) !== levelId).length;
  if (moved === 0) return { ok: true, moved: 0, message: `Já ${targets.length === 1 ? 'está' : 'estão'} em ${target.name}.` };
  try {
    store.exec({ type: 'setElementLevel', ids: targets, levelId, keep });
  } catch (e) {
    return { ok: false, moved: 0, message: e instanceof Error ? e.message : 'Falha ao mudar de nível.' };
  }
  const noun = moved === 1 ? 'elemento movido' : 'elementos movidos';
  const off = levelId !== activeLevelId ? ', fora do nível da vista' : '';
  const openings = skippedOpenings ? ' Aberturas acompanham a parede.' : '';
  return { ok: true, moved, message: `${moved} ${noun} para ${target.name}${off}.${openings} Ctrl+Z desfaz.` };
}
