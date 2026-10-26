import type { ReactElement } from 'react';
import { useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Row } from './fields.tsx';

/** Pavimento de referência do Subpavimento: o de baixo (automático) ou qualquer nível abaixo do atual. */
export function UnderlayRow(): ReactElement {
  const p = useProject();
  const s = useUi();
  const idx = p.levels.findIndex((l) => l.id === s.levelId);
  const abaixo = idx > 0 ? p.levels.slice(0, idx) : [];
  return (
    <Row label="Pavimento de referência" htmlFor="v-underlay-level">
      <select
        id="v-underlay-level"
        className="select"
        disabled={!s.showUnderlay || abaixo.length === 0}
        value={s.underlayLevel ?? ''}
        onChange={(e) => useUi.setState({ underlayLevel: e.target.value || null })}
      >
        <option value="">Abaixo (automático)</option>
        {abaixo.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </Row>
  );
}
