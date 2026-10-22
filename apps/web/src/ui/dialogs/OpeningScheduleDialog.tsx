import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildOpeningSchedule, filterOpeningRows, openingScheduleToCsv, sumOpeningRows, type OpeningScheduleRow } from '@hestia/engine';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof OpeningScheduleRow;
  label: string;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
}

const COLS: Col[] = [
  { key: 'code', label: 'Código' },
  { key: 'typeName', label: 'Tipo' },
  { key: 'familyName', label: 'Família' },
  { key: 'kind', label: 'Categoria' },
  { key: 'width', label: 'Largura (m)', decimals: 2 },
  { key: 'height', label: 'Altura (m)', decimals: 2 },
  { key: 'sill', label: 'Peitoril (m)', decimals: 2 },
  { key: 'leaves', label: 'Folhas', decimals: 0 },
  { key: 'count', label: 'Quantidade', decimals: 0 },
  { key: 'unitArea', label: 'Área unitária (m²)', decimals: 2 },
  { key: 'totalArea', label: 'Área total (m²)', decimals: 2 },
];

interface Sort {
  key: keyof OpeningScheduleRow;
  dir: 1 | -1;
}

const fmt = (v: number, decimals: number): string => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: OpeningScheduleRow, b: OpeningScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
  return r * s.dir;
};

const cellValue = (r: OpeningScheduleRow, c: Col): ReactNode => {
  if (c.key === 'kind') return r.kind === 'door' ? 'Porta' : 'Janela';
  const v = r[c.key];
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

/** Tabela de portas e janelas com ordenação, filtro por categoria, totais e exportação CSV (padrão da tabela de escadas). */
export function OpeningScheduleDialog(): ReactElement {
  const p = useProject();
  const schedule = useMemo(() => buildOpeningSchedule(p), [p]);
  const [kind, setKind] = useState<'' | 'door' | 'window'>('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [msg, setMsg] = useState('');

  const visible = useMemo(() => {
    const list = filterOpeningRows(schedule.rows, { kind: kind || undefined });
    return sort ? [...list].sort((a, b) => compare(a, b, sort)) : list;
  }, [schedule, kind, sort]);

  const totals = useMemo(() => sumOpeningRows(visible), [visible]);

  const toggleSort = (key: keyof OpeningScheduleRow): void =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

  const exportCsv = async (): Promise<void> => {
    const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
    const status = await saveText(`${base}-portas-e-janelas.csv`, openingScheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title="Tabela de portas e janelas"
      sub={`${visible.length} de ${schedule.rows.length} tipos`}
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
        <label htmlFor="osc-kind">Categoria</label>
        <select id="osc-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as '' | 'door' | 'window')}>
          <option value="">Portas e janelas</option>
          <option value="door">Somente portas</option>
          <option value="window">Somente janelas</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? 'Não há portas nem janelas neste projeto.' : 'Nenhum tipo com este filtro.'}</p>
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
                  <tr key={r.typeId}>
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
            <span>{totals.count} {totals.count === 1 ? 'abertura' : 'aberturas'}</span>
            <span>Portas {totals.doorCount}</span>
            <span>Janelas {totals.windowCount}</span>
            <span>Área total {fmt(totals.totalArea, 2)} m²</span>
          </div>
        </>
      )}
    </Dialog>
  );
}
