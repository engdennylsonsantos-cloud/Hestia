import type { OpeningComponent } from '../components.ts';
import { CompositionPanel } from './CompositionPanel.tsx';

/*
 * Descritor do componente "Módulos" (composição de células), no mesmo formato de `OPENING_COMPONENTS` em components.ts.
 * O coordenador só o acrescenta ao registro: `...COMPOSITION_COMPONENTS` (o id 'composition' entra em `OpeningComponentId`).
 * Vale para porta e janela: a lista de ações muda por tipo dentro do painel.
 */
export type CompositionComponent = Omit<OpeningComponent, 'id' | 'labelKey'> & { id: 'composition'; labelKey: 'oc_composition' };

export const COMPOSITION_COMPONENTS: readonly CompositionComponent[] = [
  {
    id: 'composition',
    labelKey: 'oc_composition',
    icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h16v7H4z',
    visible: () => true,
    Panel: CompositionPanel,
  },
];
