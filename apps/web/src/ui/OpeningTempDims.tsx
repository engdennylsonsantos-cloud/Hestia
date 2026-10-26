import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { frameOfWall } from '@hestia/engine';
import { isOpening, type Id } from '@hestia/model';
import { worldToScreen } from '@hestia/render';
import { editOpeningDim, formatMeters, occupiedRanges, openingDimLines, parseNumber, perpendicularNeighbors, type OpeningDimSide } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';

const BOX: CSSProperties = {
  position: 'absolute',
  transform: 'translate(-50%, -50%)',
  width: 62,
  height: 22,
  padding: '0 4px',
  textAlign: 'center',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  background: 'var(--panel)',
  color: 'var(--fg)',
  pointerEvents: 'auto',
  zIndex: 13,
};

const stop = (e: { stopPropagation(): void }): void => e.stopPropagation();

/**
 * Cotas temporárias editáveis da abertura selecionada (Revit): duas medidas ao longo da parede, do eixo ao eixo das
 * perpendiculares ou da face à face do batente. Clicar, digitar e Enter move a abertura (`offset`); a validação é a
 * mesma da colocação, e o erro só aparece na barra de status.
 */
export function OpeningTempDims({ openingId }: { openingId: Id }): ReactElement | null {
  const p = useProject();
  const tick = useUi((s) => s.previewTick);
  const mode = useUi((s) => s.options.openingDimMode ?? 'axis');
  const [editing, setEditing] = useState<{ side: OpeningDimSide; text: string } | null>(null);
  const viewport = useMemo(() => editor.viewport(), [tick]);
  const opening = p.elements[openingId];
  if (!opening || !isOpening(opening) || !viewport) return null;
  const frame = frameOfWall(p, opening.hostId);
  const type = p.openingTypes[opening.typeId];
  if (!frame || !type) return null;
  // Cotas do lado da abertura (as alças de inversão ficam do lado oposto, para não se sobreporem).
  const dims = openingDimLines(frame, opening.offset, type.width, perpendicularNeighbors(p, opening.hostId, frame.wall.levelId), mode, opening.flipFacing ? -1 : 1);

  const commit = (side: OpeningDimSide, text: string): void => {
    const value = parseNumber(text);
    if (value === null) {
      useUi.setState({ status: 'Medida inválida: digite uma distância em metros, como 1,20.' });
      setEditing(null);
      return;
    }
    const current = editor.project.elements[openingId];
    if (!current || !isOpening(current)) return;
    const f = frameOfWall(editor.project, current.hostId);
    const t = editor.project.openingTypes[current.typeId];
    if (!f || !t) return;
    const currentDims = openingDimLines(f, current.offset, t.width, perpendicularNeighbors(editor.project, current.hostId, f.wall.levelId), mode, current.flipFacing ? -1 : 1);
    const result = editOpeningDim(currentDims, side, value, {
      neighbors: perpendicularNeighbors(editor.project, current.hostId, f.wall.levelId),
      occupied: occupiedRanges(editor.project, current.hostId, current.id, [t.sill, t.sill + t.height]),
    });
    if ('error' in result) {
      useUi.setState({ status: result.error });
      setEditing(null);
      return;
    }
    if (Math.abs(result.offset - current.offset) > 1e-9) {
      editor.store.exec({ type: 'updateElements', ids: [current.id], patch: { offset: result.offset } });
      useUi.setState({ status: `Distância atualizada para ${formatMeters(value)} m.` });
    }
    setEditing(null);
  };

  const field = (side: OpeningDimSide): ReactElement => {
    const line = dims[side];
    const at = worldToScreen(viewport, line.at);
    const active = editing?.side === side;
    return (
      <input
        key={side}
        className="input num"
        aria-label={side === 'left' ? 'Distância à esquerda' : 'Distância à direita'}
        title="Digite a distância e pressione Enter"
        style={{ ...BOX, left: at.x, top: at.y }}
        value={active ? editing.text : formatMeters(line.value)}
        onPointerDown={stop}
        onPointerUp={stop}
        onClick={stop}
        onFocus={(e) => { setEditing({ side, text: formatMeters(line.value) }); e.currentTarget.select(); }}
        onBlur={() => setEditing(null)}
        onChange={(e) => setEditing({ side, text: e.target.value })}
        onKeyDown={(e) => {
          stop(e);
          if (e.key === 'Enter') {
            commit(side, e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setEditing(null);
            e.currentTarget.blur();
          }
        }}
      />
    );
  };

  const points = (i: 0 | 1): [ReturnType<typeof worldToScreen>, ReturnType<typeof worldToScreen>] => {
    const line = i === 0 ? dims.left : dims.right;
    return [worldToScreen(viewport, line.a), worldToScreen(viewport, line.b)];
  };
  const [leftA, leftB] = points(0);
  const [rightA, rightB] = points(1);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      <svg width={viewport.width} height={viewport.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
        <line x1={leftA.x} y1={leftA.y} x2={leftB.x} y2={leftB.y} stroke="var(--accent)" strokeWidth={1} />
        <line x1={rightA.x} y1={rightA.y} x2={rightB.x} y2={rightB.y} stroke="var(--accent)" strokeWidth={1} />
      </svg>
      {field('left')}
      {field('right')}
    </div>
  );
}
