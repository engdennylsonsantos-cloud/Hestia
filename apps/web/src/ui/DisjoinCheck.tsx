import type { ReactElement } from 'react';
import { Check } from './fields.tsx';

/** Dica do "Desconectar" (Revit) nas ferramentas de transformação de paredes. */
export const DISJOIN_HINT = 'A parede se solta das paredes ligadas às suas pontas em vez de esticá-las';

/** Caixa "Desconectar" da barra de opções de Mover, Rotacionar e Espelhar. */
export function DisjoinCheck({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }): ReactElement {
  return (
    <Check id={id} checked={checked} onChange={onChange}>
      <span title={DISJOIN_HINT}>Desconectar</span>
    </Check>
  );
}
