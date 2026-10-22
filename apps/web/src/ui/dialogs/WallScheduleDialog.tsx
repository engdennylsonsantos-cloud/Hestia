import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildWallSchedule, scheduleToCsv, sumWallRows, type WallScheduleRow } from '@hestia/engine';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof WallScheduleRow;
  label: string;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
  sortable?: boolean;
}

const COLS: Col[] = [
  { key: 'mark', label: 'Marca' },
  { key: 'typeName', label: 'Tipo' },
  { key: 'levelName', label: 'Nível' },
  { key: 'thickness', label: 'Espessura (m)', decimals: 3 },
  { key: 'length', label: 'Comprimento (m)', decimals: 2 },
  { key: 'height', label: 'Altura (m)', decimals: 2 },
  { key: 'grossFaceArea', label: 'Área bruta (m²)', decimals: 2 },
  { key: 'openingsArea', label: 'Vãos (m²)', decimals: 2 },
  { key: 'netFaceArea', label: 'Área líquida (m²)', decimals: 2 },
  { key: 'volume', label: 'Volume (m³)', decimals: 3 },
  { key: 'layersSummary', label: 'Camadas (cm)', sortable: false },
];

interface Sort {
  key: keyof WallScheduleRow;
  dir: 1 | -1;
}

const fmt = (v: number, decimals: number): string => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: WallScheduleRow, b: WallScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
  return r * s.dir;
};

const cellValue = (r: WallScheduleRow, c: Col): ReactNode => {
  const v = r[c.key];
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

/** Tabela de paredes com ordenação, filtros por nível e tipo, totais e exportação CSV. */
export function WallScheduleDialog(): ReactElement {
  const p = useProject();
  const schedule = useMemo(() => buildWallSchedule(p), [p]);
  const [levelId, setLevelId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [msg, setMsg] = useState('');

  const types = useMemo(() => {
    const byId = new Map(schedule.rows.map((r) => [r.typeId, r.typeName] as const));
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [schedule]);

  const visible = useMemo(() => {
    const list = schedule.rows.filter((r) => (!levelId || r.levelId === levelId) && (!typeId || r.typeId === typeId));
    return sort ? list.sort((a, b) => compare(a, b, sort)) : list;
  }, [schedule, levelId, typeId, sort]);

  const totals = useMemo(() => sumWallRows(visible), [visible]);

  const toggleSort = (key: keyof WallScheduleRow): void =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

  const exportCsv = async (): Promise<void> => {
    const base = p.name.replace(/[^\w\- ]+/g, '').trim() || 'projeto';
    const status = await saveText(`${base}-paredes.csv`, scheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title="Tabela de paredes"
      sub={`${visible.length} de ${schedule.rows.length} paredes`}
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
        <label htmlFor="wsc-level">Nível</label>
        <select id="wsc-level" className="select" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">Todos os níveis</option>
          {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label htmlFor="wsc-type">Tipo</label>
        <select id="wsc-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? 'Não há paredes neste projeto.' : 'Nenhuma parede com estes filtros.'}</p>
      ) : (
        <>
          <div className="wsched-scroll">
            <table className="layers wsched">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className={c.decimals !== undefined ? 'num' : undefined} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                      {c.sortable === false ? (
                        c.label
                      ) : (
                        <button type="button" className="sortbtn" onClick={() => toggleSort(c.key)} title="Ordenar por esta coluna">
                          {c.label}
                          {sort?.key === c.key ? <Icon name={sort.dir === 1 ? 'up' : 'down'} size={11} /> : null}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.wallId}>
                    {COLS.map((c) => (
                      <td key={c.key} className={c.decimals !== undefined ? 'num' : c.sortable === false ? 'layers-cell' : undefined} title={c.sortable === false ? r.layersSummary : undefined}>
                        {cellValue(r, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="total">
            <span>{totals.count} {totals.count === 1 ? 'parede' : 'paredes'}</span>
            <span>Comprimento {fmt(totals.length, 2)} m</span>
            <span>Área líquida {fmt(totals.netFaceArea, 2)} m²</span>
            <span>Volume {fmt(totals.volume, 3)} m³</span>
            {Math.abs(totals.grossVolume - totals.volume) > 1e-9 && <span>Volume bruto {fmt(totals.grossVolume, 3)} m³</span>}
          </div>
        </>
      )}

      <h3 className="wsched-h">Volume por material (projeto inteiro, sem filtros)</h3>
      <table className="layers">
        <thead>
          <tr>
            <th>Material</th>
            <th className="num">Volume (m³)</th>
          </tr>
        </thead>
        <tbody>
          {schedule.volumeByMaterial.map((m) => (
            <tr key={m.materialId}>
              <td>{m.name}</td>
              <td className="num">{fmt(m.volume, 3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
