import { useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { buildRoofSchedule, filterRoofRows, roofScheduleToCsv, ROOF_SHAPE_LABEL, sumRoofRows, type RoofScheduleRow } from '@hestia/engine';
import type { RoofShape } from '@hestia/model';
import { useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { saveText } from '../../editor/saveText.ts';
import { Icon } from '../Icon.tsx';
import { Dialog } from './Dialog.tsx';

interface Col {
  key: keyof RoofScheduleRow;
  label: string;
  /** Presente nas colunas numéricas: casas decimais e alinhamento à direita. */
  decimals?: number;
}

const COLS: Col[] = [
  { key: 'mark', label: 'Marca' },
  { key: 'typeName', label: 'Tipo' },
  { key: 'typeCode', label: 'Código' },
  { key: 'levelName', label: 'Nível' },
  { key: 'shapeLabel', label: 'Forma' },
  { key: 'slopePercent', label: 'Inclinação (%)', decimals: 1 },
  { key: 'planArea', label: 'Área em planta (m²)', decimals: 2 },
  { key: 'faceArea', label: 'Área real (m²)', decimals: 2 },
  { key: 'ridgeLength', label: 'Cumeeira (m)', decimals: 2 },
  { key: 'eaveLength', label: 'Beiral (m)', decimals: 2 },
  { key: 'volume', label: 'Volume (m³)', decimals: 3 },
];

interface Sort {
  key: keyof RoofScheduleRow;
  dir: 1 | -1;
}

const fmt = (v: number, decimals: number): string => v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const compare = (a: RoofScheduleRow, b: RoofScheduleRow, s: Sort): number => {
  const x = a[s.key];
  const y = b[s.key];
  const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt-BR', { numeric: true });
  return r * s.dir;
};

const cellValue = (r: RoofScheduleRow, c: Col): ReactNode => {
  const v = r[c.key];
  if (v === null) return '—';
  return typeof v === 'number' ? fmt(v, c.decimals ?? 2) : v;
};

const SHAPES = Object.keys(ROOF_SHAPE_LABEL) as RoofShape[];

/** Tabela de telhados com ordenação, filtros por nível, tipo e forma, totais e exportação CSV (padrão da tabela de lajes). */
export function RoofScheduleDialog(): ReactElement {
  const p = useProject();
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
      title="Tabela de telhados"
      sub={`${visible.length} de ${schedule.rows.length} telhados`}
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
        <label htmlFor="rsc-type">Tipo</label>
        <select id="rsc-type" className="select" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <label htmlFor="rsc-shape">Forma</label>
        <select id="rsc-shape" className="select" value={shape} onChange={(e) => setShape(e.target.value as RoofShape | '')}>
          <option value="">Todas as formas</option>
          {SHAPES.map((s) => <option key={s} value={s}>{ROOF_SHAPE_LABEL[s]}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="hint">{schedule.rows.length === 0 ? 'Não há telhados neste projeto.' : 'Nenhum telhado com estes filtros.'}</p>
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
                  <tr key={r.roofId}>
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
            <span>{totals.count} {totals.count === 1 ? 'telhado' : 'telhados'}</span>
            <span>Área em planta {fmt(totals.planArea, 2)} m²</span>
            <span>Área real {fmt(totals.faceArea, 2)} m²</span>
            <span>Cumeeira {fmt(totals.ridgeLength, 2)} m</span>
            <span>Beiral {fmt(totals.eaveLength, 2)} m</span>
            <span>Volume {fmt(totals.volume, 3)} m³</span>
          </div>
        </>
      )}
    </Dialog>
  );
}
