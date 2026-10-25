import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildWallSchedule, scheduleToCsv, sumWallRows, type WallScheduleRow } from '@hestia/engine';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { useI18n, I18N } from '../../editor/i18n.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof WallScheduleRow;
  /** Chave do rótulo em I18N (PT/EN). */
  labelKey: keyof typeof I18N.pt;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
  sortable?: boolean;
}

const COLS: Col[] = [
  { key: 'mark', labelKey: 'col_mark' },
  { key: 'typeName', labelKey: 'col_type' },
  { key: 'levelName', labelKey: 'col_level' },
  { key: 'thickness', labelKey: 'col_thickness', decimals: 3 },
  { key: 'length', labelKey: 'col_length', decimals: 2 },
  { key: 'height', labelKey: 'col_height', decimals: 2 },
  { key: 'grossFaceArea', labelKey: 'col_gross_area', decimals: 2 },
  { key: 'openingsArea', labelKey: 'col_openings_area', decimals: 2 },
  { key: 'netFaceArea', labelKey: 'col_net_area', decimals: 2 },
  { key: 'volume', labelKey: 'col_volume', decimals: 3 },
  { key: 'layersSummary', labelKey: 'col_layers', sortable: false },
];

interface Sort {
  key: keyof WallScheduleRow;
  dir: 1 | -1;
}

/** Números seguem o idioma ativo (vírgula decimal em PT, ponto em EN). */
const fmt = (v: number, decimals: number): string =>
  v.toLocaleString(useI18n.getState().lang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

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
  const t = I18N[useI18n((s) => s.lang)];
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
    const base = p.name.trim() || 'projeto';
    const status = await saveText(`${base}-paredes.csv`, scheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title={t.sched_title_wall}
      sub={`${visible.length} ${t.sched_of} ${schedule.rows.length} ${t.sched_noun_wall}`}
      onClose={close}
      footer={
        <>
          <span className="wsched-msg" role="status">{msg}</span>
          <button className="btn primary" onClick={() => void exportCsv()} disabled={visible.length === 0} title={t.sched_export_tip}>
            {t.sched_export_csv}
          </button>
          <button className="btn" onClick={close}>{t.sched_close}</button>
        </>
      }
    >
      <div className="wsched-bar">
        <label htmlFor="wsc-level">{t.col_level}</label>
        <select id="wsc-level" className="select" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">{t.sched_all_levels}</option>
          {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label htmlFor="wsc-type">{t.col_type}</label>
        <select id="wsc-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">{t.sched_all_types}</option>
          {types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? t.sched_empty_wall : t.sched_none_wall}</p>
      ) : (
        <>
          <div className="wsched-scroll">
            <table className="layers wsched">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className={c.decimals !== undefined ? 'num' : undefined} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                      {c.sortable === false ? (
                        t[c.labelKey]
                      ) : (
                        <button type="button" className="sortbtn" onClick={() => toggleSort(c.key)} title={t.sched_sort_col}>
                          {t[c.labelKey]}
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
            <span>{totals.count} {totals.count === 1 ? t.sched_noun_wall_one : t.sched_noun_wall}</span>
            <span>{t.sched_total_length} {fmt(totals.length, 2)} m</span>
            <span>{t.sched_total_net_area} {fmt(totals.netFaceArea, 2)} m²</span>
            <span>{t.sched_total_volume} {fmt(totals.volume, 3)} m³</span>
            {Math.abs(totals.grossVolume - totals.volume) > 1e-9 && <span>{t.sched_total_gross_volume} {fmt(totals.grossVolume, 3)} m³</span>}
          </div>
        </>
      )}

      <h3 className="wsched-h">{t.sched_material_volume}</h3>
      <table className="layers">
        <thead>
          <tr>
            <th>{t.sched_material}</th>
            <th className="num">{t.col_volume}</th>
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
