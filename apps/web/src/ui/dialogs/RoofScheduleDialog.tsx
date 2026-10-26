import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildRoofSchedule, filterRoofRows, roofScheduleToCsv, ROOF_SHAPE_LABEL, sumRoofRows, type RoofScheduleRow } from '@hestia/engine';
import type { RoofShape } from '@hestia/model';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { useI18n, I18N } from '../../editor/i18n.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof RoofScheduleRow;
  /** Chave do rótulo em I18N (PT/EN). */
  labelKey: keyof typeof I18N.pt;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
}

const COLS: Col[] = [
  { key: 'mark', labelKey: 'col_mark' },
  { key: 'typeName', labelKey: 'col_type' },
  { key: 'typeCode', labelKey: 'col_code' },
  { key: 'levelName', labelKey: 'col_level' },
  { key: 'shapeLabel', labelKey: 'col_shape' },
  { key: 'slopePercent', labelKey: 'col_slope', decimals: 1 },
  { key: 'planArea', labelKey: 'col_plan_area', decimals: 2 },
  { key: 'faceArea', labelKey: 'col_real_area', decimals: 2 },
  { key: 'ridgeLength', labelKey: 'col_ridge', decimals: 2 },
  { key: 'eaveLength', labelKey: 'col_eave', decimals: 2 },
  { key: 'volume', labelKey: 'col_volume', decimals: 3 },
];

interface Sort {
  key: keyof RoofScheduleRow;
  dir: 1 | -1;
}

/** Números seguem o idioma ativo (vírgula decimal em PT, ponto em EN). */
const fmt = (v: number, decimals: number): string =>
  v.toLocaleString(useI18n.getState().lang === 'en' ? 'en-US' : 'pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: RoofScheduleRow, b: RoofScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
  return r * s.dir;
};

const cellValue = (r: RoofScheduleRow, c: Col, shapeName: (s: RoofShape) => string): ReactNode => {
  if (c.key === 'shapeLabel') return shapeName(r.shape);
  const v = r[c.key];
  if (v === null) return '—';
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

const SHAPES = Object.keys(ROOF_SHAPE_LABEL) as RoofShape[];

/** Tabela de telhados com ordenação, filtros por nível, tipo e forma, totais e exportação CSV (padrão da tabela de lajes). */
export function RoofScheduleDialog(): ReactElement {
  const p = useProject();
  const t = I18N[useI18n((s) => s.lang)];
  /** Nome da forma no idioma ativo (o rótulo do engine é só PT). */
  const shapeName = (s: RoofShape): string => t[`roof_shape_${s}` as keyof typeof I18N.pt];
  const schedule = useMemo(() => buildRoofSchedule(p), [p]);
  const [levelId, setLevelId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [shape, setShape] = useState<RoofShape | ''>('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [msg, setMsg] = useState('');

  const types = useMemo(() => {
    const byId = new Map(schedule.rows.map((r) => [r.typeId, r.typeName] as const));
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [schedule]);

  const visible = useMemo(() => {
    const list = filterRoofRows(schedule.rows, { levelId: levelId || undefined, typeId: typeId || undefined, shape: shape || undefined });
    return sort ? [...list].sort((a, b) => compare(a, b, sort)) : list;
  }, [schedule, levelId, typeId, shape, sort]);

  const totals = useMemo(() => sumRoofRows(visible), [visible]);

  const toggleSort = (key: keyof RoofScheduleRow): void =>
    setSort((s) => (s && s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

  const exportCsv = async (): Promise<void> => {
    const base = p.name.trim() || 'projeto';
    const status = await saveText(`${base}-telhados.csv`, roofScheduleToCsv(visible, totals));
    setMsg(status);
    useUi.setState({ status });
  };

  return (
    <Dialog
      title={t.sched_title_roof}
      sub={`${visible.length} ${t.sched_of} ${schedule.rows.length} ${t.sched_noun_roof}`}
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
        <label htmlFor="rsc-level">{t.col_level}</label>
        <select id="rsc-level" className="select" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">{t.sched_all_levels}</option>
          {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <label htmlFor="rsc-type">{t.col_type}</label>
        <select id="rsc-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">{t.sched_all_types}</option>
          {types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select>
        <label htmlFor="rsc-shape">{t.col_shape}</label>
        <select id="rsc-shape" className="select" value={shape} onChange={(e) => setShape(e.target.value as RoofShape | '')}>
          <option value="">{t.sched_all_shapes}</option>
          {SHAPES.map((s) => <option key={s} value={s}>{shapeName(s)}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? t.sched_empty_roof : t.sched_none_roof}</p>
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
                  <tr key={r.roofId}>
                    {COLS.map((c) => (
                      <td key={c.key} className={c.decimals !== undefined ? 'num' : undefined}>
                        {cellValue(r, c, shapeName)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="total">
            <span>{totals.count} {totals.count === 1 ? t.sched_noun_roof_one : t.sched_noun_roof}</span>
            <span>{t.sched_total_plan_area} {fmt(totals.planArea, 2)} m²</span>
            <span>{t.sched_total_face_area} {fmt(totals.faceArea, 2)} m²</span>
            <span>{t.sched_total_ridge} {fmt(totals.ridgeLength, 2)} m</span>
            <span>{t.sched_total_eave} {fmt(totals.eaveLength, 2)} m</span>
            <span>{t.sched_total_volume} {fmt(totals.volume, 3)} m³</span>
          </div>
        </>
      )}
    </Dialog>
  );
}
