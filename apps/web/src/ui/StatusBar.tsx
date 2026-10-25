import type { ReactElement } from 'react';
import { useUi } from '../editor/state.ts';
import { useAtalhos } from '../editor/shortcutConfig.ts';
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
  return (
    <footer className="statusbar" role="status">
      <span className="msg" title={status}>{status}</span>
      {pendente ? <span className="mono" aria-label="Sequência de atalho em andamento">{pendente}…</span> : null}
      {view === 'plan' && cursor ? <span className="mono">x {f(cursor.x)}  y {f(cursor.y)} m</span> : null}
      {view === 'plan' && snap && SNAP[snap] ? <span className="mono" style={{ color: 'var(--accent)' }}>{SNAP[snap]}</span> : null}
      <SnapButton />
      <IssuesButton />
    </footer>
  );
}
