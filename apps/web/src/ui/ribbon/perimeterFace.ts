import { COMANDO_DO_ESBOCO, SEM_ESBOCO, SEM_ESBOCO_AINDA } from '../../editor/perimeterComandos.ts';
import type { RibbonCtx } from './actions.ts';
import type { RibbonItem } from './model.ts';

/** Como um item da faixa aparece com o modo de perímetro aberto: pressionado, desabilitado e o motivo do tooltip. */
export interface FaceNoEsboco {
  on: boolean;
  disabled: boolean;
  /** Motivo que vai no tooltip (segunda linha), quando o item não se aplica ao esboço. */
  motivo?: string;
}

/**
 * Estado de um item da faixa com o modo de perímetro aberto. Os comandos de Modificar ficam pressionados quando são o
 * comando ligado; os que não se aplicam ao esboço ficam desabilitados com o motivo. Fora do modo (ou para item sem regra
 * própria), devolve null e o item segue o estado normal.
 */
export function estadoNoEsboco(item: RibbonItem, ctx: RibbonCtx): FaceNoEsboco | null {
  const perim = ctx.perimetro;
  if (!perim) return null;
  if (item.kind === 'tool') {
    const comando = COMANDO_DO_ESBOCO[item.tool];
    if (comando) return { on: perim.modify === comando, disabled: false };
    const motivo = SEM_ESBOCO[item.tool];
    return motivo ? { on: false, disabled: true, motivo } : null;
  }
  if (item.kind === 'action' && item.action === 'delete') return { on: perim.modify === 'delete', disabled: false };
  if (item.kind === 'soon') return { on: false, disabled: true, motivo: SEM_ESBOCO_AINDA };
  return null;
}
