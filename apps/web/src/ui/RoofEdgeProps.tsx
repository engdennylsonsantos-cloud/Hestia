import type { ReactElement } from 'react';
import { degToPercent, percentToDeg } from '@hestia/tools';
import type { Roof } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { setEdgeDefines, setEdgeOverhang, setEdgeSlope } from '../editor/roofEdgeActions.ts';
import { Check, Group, NumField, Row } from './fields.tsx';

const fmt = (n: number, d = 2): string => n.toFixed(d).replace('.', ',');

/** Comprimento da aresta i (de boundary[i] a boundary[i+1]). */
export const edgeLength = (r: Roof, i: number): number => {
  const a = r.boundary[i]!;
  const b = r.boundary[(i + 1) % r.boundary.length]!;
  return Math.hypot(b.x - a.x, b.y - a.y);
};

/** Seção "Aresta N": define inclinação (liga/desliga), inclinação em % e °, comprimento e balanço (move a aresta). */
export function RoofEdgeSection({ roof, index }: { roof: Roof; index: number }): ReactElement {
  const slope = roof.edgeSlopes[index] ?? null;
  const defines = slope !== null;
  return (
    <Group title={`Aresta ${index + 1}`}>
      <Row label="Define inclinação" htmlFor="p-edefine">
        <Check id="p-edefine" checked={defines} onChange={(v) => setEdgeDefines(editor.store, roof, index, v)}>
          {defines ? 'sim' : 'não (empena)'}
        </Check>
      </Row>
      <Row label="Inclinação" htmlFor="p-eslope">
        <NumField id="p-eslope" value={slope} onCommit={(v) => setEdgeSlope(editor.store, roof, index, v)} unit="%" min={0.1} max={200} disabled={!defines} />
      </Row>
      <Row label="Inclinação (°)" htmlFor="p-edeg">
        <NumField id="p-edeg" value={slope === null ? null : percentToDeg(slope)} decimals={1} unit="°" min={0.1} max={63.4} disabled={!defines} onCommit={(v) => setEdgeSlope(editor.store, roof, index, degToPercent(v))} />
      </Row>
      <Row label="Comprimento"><span className="val">{fmt(edgeLength(roof, index))} m</span></Row>
      <Row label="Balanço" htmlFor="p-eover">
        <NumField id="p-eover" value={roof.edgeOverhangs[index] ?? 0} onCommit={(v) => setEdgeOverhang(editor.store, roof, index, v)} unit="m" />
      </Row>
      <div className="hint">Desligar "define inclinação" torna a aresta empena (vertical). Balanço positivo afasta a aresta do centro e move o beiral.</div>
    </Group>
  );
}

/** Tabela de todas as arestas do telhado: nº (clique seleciona na planta), comprimento, define inclinação e %. */
export function RoofEdgeTable({ roof }: { roof: Roof }): ReactElement {
  const n = roof.boundary.length;
  const edge = useUi((s) => s.roofEdge);
  return (
    <Group title={`Arestas (${n})`} open={n > 4}>
      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Nº</th>
            <th style={{ textAlign: 'left' }}>Comp.</th>
            <th style={{ textAlign: 'left' }}>Define</th>
            <th style={{ textAlign: 'left' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => {
            const v = roof.edgeSlopes[i] ?? null;
            const current = edge?.roofId === roof.id && edge.index === i;
            return (
              <tr key={i} style={current ? { background: 'var(--accent-soft, rgba(0,120,255,0.12))' } : undefined}>
                <td>
                  <button className="btn small" aria-label={`Selecionar aresta ${i + 1}`} onClick={() => useUi.setState({ roofEdge: { roofId: roof.id, index: i }, selection: [roof.id] })}>
                    {i + 1}
                  </button>
                </td>
                <td>{fmt(edgeLength(roof, i))} m</td>
                <td>
                  <input type="checkbox" aria-label={`Aresta ${i + 1} define inclinação`} checked={v !== null} onChange={(e) => setEdgeDefines(editor.store, roof, i, e.target.checked)} />
                </td>
                <td>{v === null ? '—' : <NumField value={v} width={64} onCommit={(x) => setEdgeSlope(editor.store, roof, i, x)} min={0.1} max={200} />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Group>
  );
}
