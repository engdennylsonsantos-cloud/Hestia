import type { ReactElement } from 'react';
import { perimeterActions, usePerimeter } from '../../editor/perimeter.ts';
import { PerimeterProps, type PerimeterEdgeInfo } from './PerimeterProps.tsx';

/** Grupo "Perímetro do …" das Propriedades enquanto o modo está aberto: a aresta selecionada, ligada às ações do modo. */
export function PerimeterEdgePanel(): ReactElement | null {
  const perim = usePerimeter();
  if (!perim.active) return null;
  const e = perim.selectedEdge;
  const edge: PerimeterEdgeInfo | null = e
    ? { index: e.index, count: e.total, lengthM: e.length, definesSlope: e.definesSlope, slopePct: e.slopePct, overhangM: e.overhang }
    : null;
  return (
    <PerimeterProps
      target={perim.target}
      edge={edge}
      onDefinesSlope={(v) => perimeterActions.setEdge({ definesSlope: v })}
      onSlopePct={(v) => perimeterActions.setEdge({ slopePct: v })}
      onOverhang={(v) => perimeterActions.setEdge({ overhang: v })}
    />
  );
}
