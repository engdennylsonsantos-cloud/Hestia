import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildFloorSchedule, filterFloorRows, floorScheduleToCsv, sumFloorRows, type FloorScheduleRow } from '@hestia/engine';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof FloorScheduleRow;
  label: string;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
}

const COLS: Col[] = [
  { key: 'mark', label: 'Marca' },
  { key: 'typeName', label: 'Tipo' },
  { key: 'typeCode', label: 'Código' },
  { key: 'levelName', label: 'Nível' },
  { key: 'area', label: 'Área (m²)', decimals: 2 },
  { key: 'perimeter', label: 'Perímetro (m)', decimals: 2 },
  { key: 'thickness', label: 'Espessura (m)', decimals: 3 },
  { key: 'volume', label: 'Volume (m³)', decimals: 3 },
  { key: 'heightOffset', label: 'Deslocamento (m)', decimals: 3 },
];

interface Sort {
  key: keyof FloorScheduleRow;
  dir: 1 | -1;
}

const fmt = (v: number, decimals: number): string => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: FloorScheduleRow, b: FloorScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
  return r * s.dir;
};

const cellValue = (r: FloorScheduleRow, c: Col): ReactNode => {
  const v = r[c.key];
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

/** Tabela de pisos com ordenação, filtros por nível e tipo, totais e exportação CSV (padrão da tabela de paredes). */
export function FloorScheduleDialog(): ReactElement {
  const p = useProject();
  const schedule = useMemo(() => buildFloorSchedule(p), [p]);
  const [levelId, setLevelId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [msg, setMsg] = useState('');

  const types = useMemo(() => {
    const byId = new Map(schedule.rows.map((r) => [r.typeId, r.typeName] as const));
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [schedule]);

  const visible = useMemo(() => {
    const list = filterFloorRows(schedule.rows, { levelId: levelId || undefined, typeId: typeId || undefined });
    return sort ? [...list].sort((a, b) => compare(a, b, sort)) : list;
  }, [schedule, levelId, typeId, sort]);

  const totals = useMemo(() => sumFloorRows(visible), [visible]);

  const toggleSort = (key: keyof FloorScheduleRow): void =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

  const exportCsv = async (): Promise<void> => {
    const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
    const status = await saveText(`${base}-pisos.csv`, floorScheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title="Tabela de pisos"
      sub={`${visible.length} de ${schedule.rows.length} pisos`}
      onClose={close}
      footer={
        <>
          <span className="wsched-msg" role="status">{msg}</span>
          <button className="btn primary" onClick={() => void exportCsv()} disabled={visible.length === 0} title="Exporta as linhas filtradas, na ordem da tabela">
            Exportar CSV
          </button>
          <button className="btn" onClick={close}>Fechar</button>
        </>
      }
    >
      <div className="wsched-bar">
        <label htmlFor="fsc-level">Nível</label>
        <select id="fsc-level" className="select" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Todos os níveis</option>
          {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label htmlFor="fsc-type">Tipo</label>
        <select id="fsc-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? 'Não há pisos neste projeto.' : 'Nenhum piso com estes filtros.'}</p>
      ) : (
        <>
          <div className="wsched-scroll">
            <table className="layers wsched">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className={c.decimals !== undefined ? 'num' : undefined} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="sortbtn" onClick={() => toggleSort(c.key)} title="Ordenar por esta coluna">
                        {c.label}
                        {sort?.key === c.key ? <Icon name={sort.dir === 1 ? 'up' : 'down'} size={11} /> : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.floorId}>
                    {COLS.map((c) => (
                      <td key={c.key} className={c.decimals !== undefined ? 'num' : undefined}>
                        {cellValue(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="total">
            <span>{totals.count} {totals.count === 1 ? 'piso' : 'pisos'}</span>
            <span>Área {fmt(totals.area, 2)} m²</span>
            <span>Perímetro {fmt(totals.perimeter, 2)} m</span>
            <span>Volume {fmt(totals.volume, 3)} m³</span>
            {Math.abs(totals.grossVolume - totals.volume) > 1e-9 && <span>Volume bruto {fmt(totals.grossVolume, 3)} m³</span>}
          </div>
        </>
      )}
    </Dialog>
  );
}
