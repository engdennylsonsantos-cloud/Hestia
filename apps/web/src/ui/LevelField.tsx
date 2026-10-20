import { useState, type ReactElement } from 'react';
import { elementLevelId, type Id, type LevelKeep } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { moveToLevel, readLevelKeep, writeLevelKeep } from '../editor/levelActions.ts';
import { Row } from './fields.tsx';

const fmt = (n: number): string => n.toFixed(2).replace('.', ',');

/**
 * Linha "Nível" de paredes, pisos, lajes e telhados: troca o nível de todos os ids dados num único passo de desfazer.
 * Com seleção mista de níveis mostra "—". O controle "Ao trocar:" escolhe entre manter a cota e levar o deslocamento.
 */
export function LevelField({ ids, label = 'Nível' }: { ids: Id[]; label?: string }): ReactElement {
  const p = useProject();
  const active = useUi((s) => s.levelId);
  const [keep, setKeep] = useState<LevelKeep>(readLevelKeep);
  const levels = ids.map((id) => elementLevelId(p.elements[id]));
  const first = levels[0] ?? null;
  const mixed = levels.some((l) => l !== first);
  const value = mixed || first === null ? '' : first;
  const missing = first !== null && !p.levels.some((l) => l.id === first);

  const onLevel = (levelId: string): void => {
    if (!levelId) return;
    useUi.setState({ status: moveToLevel(editor.store, ids, levelId, keep, active).message });
  };
  const onKeep = (v: string): void => {
    const k: LevelKeep = v === 'offset' ? 'offset' : 'elevation';
    setKeep(k);
    writeLevelKeep(k);
  };

  return (
    <>
      <Row label={label} htmlFor="prop-level">
        <select id="prop-level" className="select" value={value} onChange={(e) => onLevel(e.target.value)} aria-label={label}>
          {(mixed || value === '') && (
            <option value="" disabled>
              {mixed ? '—' : 'Sem nível'}
            </option>
          )}
          {missing && <option value={first!}>{`Inexistente (${first})`}</option>}
          {p.levels.map((l) => (
            <option key={l.id} value={l.id}>{`${l.name} · ${fmt(l.elevation)} m`}</option>
          ))}
        </select>
      </Row>
      <Row label="Ao trocar:" htmlFor="prop-level-keep">
        <select id="prop-level-keep" className="select" value={keep} onChange={(e) => onKeep(e.target.value)} aria-label="Ao trocar de nível">
          <option value="elevation">Manter a cota</option>
          <option value="offset">Levar o deslocamento</option>
        </select>
      </Row>
    </>
  );
}
