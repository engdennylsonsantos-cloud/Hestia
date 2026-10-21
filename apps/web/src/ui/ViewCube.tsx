import { useRef, type PointerEvent as RPointerEvent, type ReactElement } from 'react';
import { HOME_VIEW, type ModelScene } from '@hestia/render';
import { useUi } from '../editor/state.ts';
import { CUBE_FACES, FACE_TRANSFORM, cubeMatrix, faceCells, turnAzimuth, viewForZone, type CubeZone } from './viewcube.ts';

/** Distância (px) a partir da qual um toque no cubo vira arrasto (órbita) e não clique. */
const DRAG_PX = 4;

interface ViewCubeProps {
  model: ModelScene;
}

/** Células de cada face, calculadas uma vez. */
const FACES = CUBE_FACES.map((face) => ({ face, cells: faceCells(face) }));

/**
 * ViewCube: cubo em CSS 3D sobre a vista 3D, com as 26 zonas clicáveis (6 faces, 12 arestas, 8 cantos). Gira com a
 * câmera; arrastar sobre ele orbita; clicar numa zona anima a câmera até a vista dela. Não cria um renderizador WebGL.
 */
export function ViewCube({ model }: ViewCubeProps): ReactElement {
  const orbit = model.orbit;
  // Lê a câmera a cada redesenho (arrasto, animação e Início mudam o contador de desenho).
  useUi((s) => s.previewTick);
  const redraw = (): void => useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
  // Um arrasto sobre o cubo não pode virar clique na zona sob o ponteiro ao soltar.
  const suppressClick = useRef(false);

  const go = (v: { azimuth: number; elevation: number }): void => {
    orbit.animateTo(v);
    redraw();
  };

  const onStagePointerDown = (e: RPointerEvent<HTMLDivElement>): void => {
    // O canvas por baixo não deve iniciar a órbita nem a ferramenta: o arrasto aqui é do cubo.
    e.stopPropagation();
    if (e.button !== 0) return;
    suppressClick.current = false;
    const start = { x: e.clientX, y: e.clientY };
    let last = start;
    let moved = false;
    const move = (ev: PointerEvent): void => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= DRAG_PX) return;
      moved = true;
      orbit.orbit(ev.clientX - last.x, ev.clientY - last.y);
      last = { x: ev.clientX, y: ev.clientY };
      redraw();
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      suppressClick.current = moved;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onZone = (zone: CubeZone) => (): void => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    go(viewForZone(zone.sign, orbit.azimuth));
  };

  const turn = (dir: 1 | -1) => (): void => go({ azimuth: turnAzimuth(orbit.azimuth, dir), elevation: orbit.elevation });

  // Início: vista padrão do app e enquadramento do modelo, animados.
  const home = (): void => go({ ...HOME_VIEW, ...orbit.framing(model.bounds()) });

  const toggleOrtho = (): void => {
    orbit.setOrtho(!orbit.ortho);
    redraw();
  };

  return (
    <div className="viewcube" role="group" aria-label="Controle da vista 3D">
      <div className="vc-stage" onPointerDown={onStagePointerDown}>
        <div className="vc-cube" style={{ transform: cubeMatrix(orbit.azimuth, orbit.elevation) }}>
          {FACES.map(({ face, cells }) => (
            <div key={face} className={`vc-face vc-face--${face}`} style={{ transform: FACE_TRANSFORM[face] }}>
              {cells.map(({ row, col, zone }) => (
                <button
                  key={`${row}${col}`}
                  type="button"
                  data-testid="viewcube"
                  data-face={zone.id}
                  className={`vc-cell vc-cell--${zone.kind}`}
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  aria-label={zone.name}
                  title={zone.name}
                  onClick={onZone(zone)}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="vc-tools">
        <button type="button" className="vc-btn" aria-label="Girar a vista 90° para a esquerda" title="Girar 90° para a esquerda" onClick={turn(1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="vc-btn" aria-label="Início: vista padrão e enquadrar o modelo" title="Início: vista padrão e enquadrar" onClick={home}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 7.5 8 3l5.5 4.5M4 6.8V13h8V6.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </button>
        <button type="button" className="vc-btn vc-btn--wide" aria-pressed={orbit.ortho} aria-label={orbit.ortho ? 'Projeção ortogonal: alternar para perspectiva' : 'Projeção em perspectiva: alternar para ortogonal'} title="Alternar entre perspectiva e ortogonal" onClick={toggleOrtho}>
          {orbit.ortho ? 'Ortogonal' : 'Perspectiva'}
        </button>
        <button type="button" className="vc-btn" aria-label="Girar a vista 90° para a direita" title="Girar 90° para a direita" onClick={turn(-1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  );
}
