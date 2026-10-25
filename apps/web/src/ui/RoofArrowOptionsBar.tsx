import type { ReactElement } from 'react';
import { isRoof } from '@hestia/model';
import { roofShapePatch } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';

/**
 * Barra da seta de inclinação: a seta só vale em telhado de águas livres. Com um telhado selecionado que não é de
 * águas livres, oferece convertê-lo com um clique (mesma troca de Propriedades > Forma) e reinicia a ferramenta,
 * para que a barra de status diga o próximo passo.
 */
export function RoofArrowOptionsBar(): ReactElement | null {
  const p = useProject();
  const sel = useUi((s) => s.selection);
  const el = sel.length === 1 ? p.elements[sel[0]!] : undefined;
  const roof = el && isRoof(el) ? el : null;
  if (!roof || roof.shape === 'free') return null;
  const convert = (): void => {
    editor.store.exec({ type: 'updateElements', ids: [roof.id], patch: roofShapePatch(roof, 'free', roof.slopePercent) });
    editor.setTool('roofarrow');
  };
  return (
    <button type="button" className="btn" id="opt-roofarrow-free" onClick={convert}>
      Converter para águas livres
    </button>
  );
}
