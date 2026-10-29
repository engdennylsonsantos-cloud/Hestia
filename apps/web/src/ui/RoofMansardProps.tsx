import type { ReactElement } from 'react';
import type { Id, Roof, RoofMansard } from '@hestia/model';
import { editor } from '../editor/controller.ts';
import { applyRoofPatch } from '../editor/roofEdgeActions.ts';
import { Check, Group, NumField, Row } from './fields.tsx';

/** Formas por contorno: as únicas em que a mansarda se aplica (as águas saem do esqueleto). */
const SHAPES = new Set<Roof['shape']>(['edges', 'hip', 'gable', 'shed']);

/** Valores iniciais ao ligar: faixa de baixo íngreme (100 %), de cima na inclinação atual do telhado, 1 m de largura. */
const initialMansard = (r: Roof): RoofMansard => ({ lowerPercent: 100, upperPercent: Math.min(300, Math.max(0.1, r.slopePercent)), run: 1 });

/**
 * Mansarda automática (Propriedades > Forma): liga e desliga e edita a inclinação de baixo e de cima e a largura da
 * faixa de baixo. A alteração passa pelo motor (`applyRoofPatch`), que recusa valores que deixam o telhado sem água.
 */
export function RoofMansardSection({ roof }: { roof: Roof }): ReactElement | null {
  if (!SHAPES.has(roof.shape)) return null;
  const ids: Id[] = [roof.id];
  const m = roof.mansard;
  const set = (change: Partial<RoofMansard>): void => {
    if (m) applyRoofPatch(editor.store, ids, { mansard: { ...m, ...change } });
  };
  return (
    <Group title="Mansarda">
      <Row label="Mansarda" htmlFor="p-rmansard">
        <Check id="p-rmansard" checked={m !== undefined} onChange={(v) => applyRoofPatch(editor.store, ids, { mansard: v ? initialMansard(roof) : undefined })}>
          Duas faixas por água
        </Check>
      </Row>
      {m && (
        <>
          <Row label="Inclinação de baixo" htmlFor="p-rmlow">
            <NumField id="p-rmlow" value={m.lowerPercent / 100} quantity="slope" min={0.001} max={3} onCommit={(v) => set({ lowerPercent: v * 100 })} />
          </Row>
          <Row label="Inclinação de cima" htmlFor="p-rmup">
            <NumField id="p-rmup" value={m.upperPercent / 100} quantity="slope" min={0.001} max={3} onCommit={(v) => set({ upperPercent: v * 100 })} />
          </Row>
          <Row label="Largura da faixa de baixo" htmlFor="p-rmrun">
            <NumField id="p-rmrun" value={m.run} quantity="length" min={0.01} onCommit={(v) => set({ run: v })} />
          </Row>
        </>
      )}
    </Group>
  );
}
