import type { ReactElement } from 'react';
import { useUi } from '../editor/state.ts';
import { useAtalhos } from '../editor/shortcutConfig.ts';
import { useI18n } from '../editor/i18n.ts';
import { Icon } from './Icon.tsx';
import { IssuesButton } from './IssuesButton.tsx';
import { SnapButton } from './SnapButton.tsx';

const SNAP: Record<string, string> = {
  endpoint: 'Extremidade',
  face: 'Canto da face',
  core: 'Face do núcleo',
  midpoint: 'Ponto médio',
  intersection: 'Interseção',
  perpendicular: 'Perpendicular',
  nearest: 'Sobre a parede',
  alignment: 'Alinhamento',
  ortho: 'Ortogonal',
  grid: 'Grade',
};

const f = (n: number): string => n.toFixed(2).replace('.', ',');

export function StatusBar(): ReactElement {
  const status = useUi((s) => s.status);
  const cursor = useUi((s) => s.cursor);
  const snap = useUi((s) => s.snapKind);
  const view = useUi((s) => s.view);
  const pendente = useAtalhos((s) => s.pendente);
  const nSel = useUi((s) => s.selection.length);
  const gpu = useUi((s) => s.gpu);
  const pt = useI18n((s) => s.lang) === 'pt';
  const engine = gpu === 'pending' ? '…' : gpu === 'cpu' ? 'CPU' : gpu === 'webgpu' ? 'WebGPU' : 'WebGL2';
  return (
    <footer className="statusbar" role="status">
      <span className="msg" title={status}>{status}</span>
      {pendente ? <span className="mono" aria-label="Sequência de atalho em andamento">{pendente}…</span> : null}
      {view === 'plan' && cursor ? <span className="mono sb-coords">x {f(cursor.x)}  y {f(cursor.y)} m</span> : null}
      <span className="mono sb-snap">{view === 'plan' && snap && SNAP[snap] ? SNAP[snap] : ''}</span>
      <SnapButton />
      <span className="sb-filter" title={pt ? `Filtro de seleção: ${nSel} elemento${nSel === 1 ? '' : 's'} selecionado${nSel === 1 ? '' : 's'}` : `Selection filter: ${nSel} selected`}>
        <Icon name="funnel" size={12} />
        <span className="mono">:{nSel}</span>
      </span>
      <IssuesButton />
      <span className={`badge sb-engine ${gpu === 'cpu' ? 'cpu' : 'gpu'}`} title={pt ? 'Motor de desenho em uso' : 'Rendering engine in use'}>{engine}</span>
    </footer>
  );
}
