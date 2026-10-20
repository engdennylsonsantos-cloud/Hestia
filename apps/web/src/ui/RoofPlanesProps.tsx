import type { ReactElement } from 'react';
import { applyRoofPatch } from '../editor/roofEdgeActions.ts';
import { editor } from '../editor/controller.ts';
import { lowestVertex, roofSlopeError } from '@hestia/tools';
import type { Roof, RoofPlaneDef } from '@hestia/model';
import { useUi } from '../editor/state.ts';
import { Group, NumField, Row } from './fields.tsx';

/** Ângulo da subida em graus, entre 0° e 360°. */
const upDeg = (pl: RoofPlaneDef): number => (((Math.atan2(pl.up.y, pl.up.x) * 180) / Math.PI) % 360 + 360) % 360;

/** Água livre a partir da direção (graus): a subida passa a ser essa direção e o beiral fica no vértice mais baixo. */
function planeWith(r: Roof, pl: RoofPlaneDef, patch: { percent?: number; deg?: number }): RoofPlaneDef {
  if (patch.deg === undefined) return { ...pl, percent: patch.percent ?? pl.percent };
  const t = (patch.deg * Math.PI) / 180;
  const up = { x: Math.cos(t), y: Math.sin(t) };
  return { ...pl, up, origin: lowestVertex(r.boundary, up), percent: patch.percent ?? pl.percent };
}

/**
 * Lista das águas livres do telhado (forma 'free'): inclinação e direção de subida de cada água, excluir e acrescentar.
 * Cada água cobre o contorno inteiro; a seta de inclinação da barra de ferramentas acrescenta águas por dois cliques.
 */
export function RoofPlanesSection({ roof }: { roof: Roof }): ReactElement {
  const set = (planes: RoofPlaneDef[]): void => void applyRoofPatch(editor.store, [roof.id], { planes });
  const setPlane = (i: number, patch: { percent?: number; deg?: number }): void => {
    if (patch.percent !== undefined) {
      const err = roofSlopeError(patch.percent);
      if (err) return void useUi.setState({ status: err });
    }
    set(roof.planes.map((pl, k) => (k === i ? planeWith(roof, pl, patch) : pl)));
  };
  const addPlane = (): void => {
    const up = { x: roof.dir.x, y: roof.dir.y };
    set([...roof.planes, { polygon: roof.boundary, origin: lowestVertex(roof.boundary, up), up, percent: roof.slopePercent, z0: 0 }]);
  };
  return (
    <Group title={`Águas (${roof.planes.length})`}>
      {roof.planes.length === 0 && <div className="hint">Sem águas: o telhado precisa de ao menos uma. Acrescente uma água abaixo.</div>}
      {roof.planes.map((pl, i) => (
        <div key={i}>
          <Row label={`Água ${i + 1} %`} htmlFor={`p-pl${i}`}>
            <NumField id={`p-pl${i}`} value={pl.percent} decimals={1} unit="%" min={0.1} max={200} onCommit={(v) => setPlane(i, { percent: v })} />
          </Row>
          <Row label={`Água ${i + 1} subida`} htmlFor={`p-pld${i}`}>
            <NumField id={`p-pld${i}`} value={upDeg(pl)} decimals={0} unit="°" onCommit={(v) => setPlane(i, { deg: v })} />
          </Row>
          <div className="row">
            <button className="btn small" aria-label={`Excluir água ${i + 1}`} onClick={() => set(roof.planes.filter((_, k) => k !== i))}>
              Excluir água {i + 1}
            </button>
          </div>
        </div>
      ))}
      <div className="row">
        <button className="btn small" onClick={addPlane}>+ água</button>
      </div>
      <div className="hint">Cada água cobre o contorno inteiro: águas acrescentadas se sobrepõem às outras, então exclua as que não quiser.</div>
    </Group>
  );
}
