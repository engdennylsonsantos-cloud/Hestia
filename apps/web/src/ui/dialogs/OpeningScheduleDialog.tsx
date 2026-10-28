import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildOpeningSchedule, filterOpeningRows, openingScheduleToCsv, sumOpeningRows, type OpeningScheduleRow } from '@hestia/engine';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { useI18n, I18N } from '../../editor/i18n.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof OpeningScheduleRow;
  /** Chave do rótulo em I18N (PT/EN). */
  labelKey: keyof typeof I18N.pt;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
}

const COLS: Col[] = [
  { key: 'code', labelKey: 'col_code' },
  { key: 'typeName', labelKey: 'col_type' },
  { key: 'familyName', labelKey: 'col_family' },
  { key: 'kind', labelKey: 'col_category' },
  { key: 'width', labelKey: 'col_width', decimals: 2 },
  { key: 'height', labelKey: 'col_height', decimals: 2 },
  { key: 'roughWidth', labelKey: 'col_rough_width', decimals: 2 },
  { key: 'roughHeight', labelKey: 'col_rough_height', decimals: 2 },
  { key: 'sill', labelKey: 'col_sill', decimals: 2 },
  { key: 'leaves', labelKey: 'col_leaves', decimals: 0 },
  { key: 'lintelLength', labelKey: 'col_lintel', decimals: 2 },
  { key: 'sillBeamLength', labelKey: 'col_sill_beam', decimals: 2 },
  { key: 'count', labelKey: 'col_count', decimals: 0 },
  { key: 'unitArea', labelKey: 'col_unit_area', decimals: 2 },
  { key: 'totalArea', labelKey: 'col_total_area', decimals: 2 },
  { key: 'leafWidth', labelKey: 'col_leaf_width', decimals: 2 },
  { key: 'leafHeight', labelKey: 'col_leaf_height', decimals: 2 },
  { key: 'frameMaterial', labelKey: 'col_frame_material' },
  { key: 'sense', labelKey: 'col_sense' },
];

interface Sort {
  key: keyof OpeningScheduleRow;
  dir: 1 | -1;
}

/** Números seguem o idioma ativo (vírgula decimal em PT, ponto em EN). */
const fmt = (v: number, decimals: number): string =>
  v.toLocaleString(useI18n.getState().lang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: OpeningScheduleRow, b: OpeningScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
  return r * s.dir;
};

/** Textos das células de categoria e de valores vazios; PT/EN passados pelo diálogo. */
const cellValue = (r: OpeningScheduleRow, c: Col, kindText: (k: string) => string): ReactNode => {
  if (c.key === 'kind') return kindText(r.kind);
  const v = r[c.key];
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return '—';
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

/** Tabela de portas e janelas com ordenação, filtro por categoria, totais e exportação CSV (padrão da tabela de escadas). */
export function OpeningScheduleDialog(): ReactElement {
  const p = useProject();
  const t = I18N[useI18n((s) => s.lang)];
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
    const base = p.name.trim() || 'projeto';
    const status = await saveText(`${base}-portas-e-janelas.csv`, openingScheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title={t.sched_title_opening}
      sub={`${visible.length} ${t.sched_of} ${schedule.rows.length} ${t.sched_noun_opening}`}
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
        <label htmlFor="osc-kind">{t.col_category}</label>
        <select id="osc-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as '' | 'door' | 'window')}>
          <option value="">{t.sched_cat_both}</option>
          <option value="door">{t.sched_cat_door}</option>
          <option value="window">{t.sched_cat_window}</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? t.sched_empty_opening : t.sched_none_opening}</p>
      ) : (
        <>
          <div className="wsched-scroll">
            <table className="layers wsched">
              <thead>
                <tr>
                  {COLS.map((c) => (
                    <th key={c.key} className={c.decimals !== undefined ? 'num' : undefined} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                      <button type="button" className="sortbtn" onClick={() => toggleSort(c.key)} title={t.sched_sort_col}>
                        {t[c.labelKey]}
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
                        {cellValue(r, c, (k) => (k === 'door' ? t.sched_kind_door : t.sched_kind_window))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="total">
            <span>{totals.count} {totals.count === 1 ? t.sched_noun_opening_one : t.sched_noun_opening}</span>
            <span>{t.sched_total_doors} {totals.doorCount}</span>
            <span>{t.sched_total_windows} {totals.windowCount}</span>
            <span>{t.sched_total_total_area} {fmt(totals.totalArea, 2)} m²</span>
          </div>
        </>
      )}
    </Dialog>
  );
}
