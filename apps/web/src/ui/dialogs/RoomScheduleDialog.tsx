import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildRoomSchedule, filterRoomRows, roomScheduleToCsv, sumRoomRows, type RoomScheduleRow } from '@hestia/engine';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof RoomScheduleRow;
  label: string;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
}

const COLS: Col[] = [
  { key: 'number', label: 'Número' },
  { key: 'name', label: 'Nome' },
  { key: 'levelName', label: 'Nível' },
  { key: 'area', label: 'Área (m²)', decimals: 2 },
  { key: 'perimeter', label: 'Perímetro (m)', decimals: 2 },
  { key: 'ceilingHeight', label: 'Pé-direito (m)', decimals: 2 },
  { key: 'volume', label: 'Volume (m³)', decimals: 3 },
  { key: 'floorFinish', label: 'Piso' },
  { key: 'wallFinish', label: 'Parede' },
  { key: 'ceilingFinish', label: 'Forro' },
];

interface Sort {
  key: keyof RoomScheduleRow;
  dir: 1 | -1;
}

const fmt = (v: number, decimals: number): string => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: RoomScheduleRow, b: RoomScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
  return r * s.dir;
};

const cellValue = (r: RoomScheduleRow, c: Col): ReactNode => {
  const v = r[c.key];
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

/** Tabela de ambientes com ordenação, filtro por nível, totais e exportação CSV (padrão da tabela de pisos). */
export function RoomScheduleDialog(): ReactElement {
  const p = useProject();
  const schedule = useMemo(() => buildRoomSchedule(p), [p]);
  const [levelId, setLevelId] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [msg, setMsg] = useState('');

  const visible = useMemo(() => {
    const list = filterRoomRows(schedule.rows, { levelId: levelId || undefined });
    return sort ? [...list].sort((a, b) => compare(a, b, sort)) : list;
  }, [schedule, levelId, sort]);

  const totals = useMemo(() => sumRoomRows(visible), [visible]);

  const toggleSort = (key: keyof RoomScheduleRow): void =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

  const exportCsv = async (): Promise<void> => {
    const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
    const status = await saveText(`${base}-ambientes.csv`, roomScheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title="Tabela de ambientes"
      sub={`${visible.length} de ${schedule.rows.length} ambientes`}
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
        <label htmlFor="rsc-level">Nível</label>
        <select id="rsc-level" className="select" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Todos os níveis</option>
          {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? 'Não há ambientes neste projeto. Use a ferramenta Ambiente (Z) para criá-los.' : 'Nenhum ambiente com este filtro.'}</p>
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
                  <tr key={r.roomId}>
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
            <span>{totals.count} {totals.count === 1 ? 'ambiente' : 'ambientes'}</span>
            <span>Área {fmt(totals.area, 2)} m²</span>
            <span>Perímetro {fmt(totals.perimeter, 2)} m</span>
            <span>Volume {fmt(totals.volume, 3)} m³</span>
          </div>
        </>
      )}
    </Dialog>
  );
}
