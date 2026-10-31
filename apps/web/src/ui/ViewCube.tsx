import { useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactElement } from 'react';
import { HOME_VIEW, type ModelScene } from '@hestia/render';
import { useUi } from '../editor/state.ts';
import {
  CUBE_FACES,
  CUBE_HALF_PX,
  FACE_TRANSFORM,
  cubeMatrix,
  faceCells,
  turnAzimuth,
  viewForZone,
  zoneAtPoint,
  type CubeZone,
} from './viewcube.ts';
import { ringHit, type CompassLetter } from './viewcube-ring.ts';
import { ViewCubeRing } from './ViewCubeRing.tsx';

/** Distância (px) a partir da qual um toque no cubo vira arrasto (órbita) e não clique. */
const DRAG_PX = 4;

/** Só o botão esquerdo pertence aos controles; meio (pan) e direito (menu) seguem para o canvas. */
const conterSeEsquerdo = (e: RPointerEvent<HTMLElement>): void => {
  if (e.button === 0) e.stopPropagation();
};

interface ViewCubeProps {
  model: ModelScene;
}

/** Células de cada face, calculadas uma vez. */
const FACES = CUBE_FACES.map((face) => ({ face, cells: faceCells(face) }));

/**
 * ViewCube: cubo em CSS 3D sobre a vista 3D, com as 26 zonas (6 faces, 12 arestas, 8 cantos) e um anel de bússola
 * (N, L, S, O) no chão. Gira com a câmera. O palco resolve o ponteiro pela geometria (`zoneAtPoint` para o cubo,
 * `ringHit` para o anel), e não pelo teste de acerto do navegador, que falha em costuras de faces giradas. Arrastar
 * sobre o cubo orbita; sobre o anel, gira só o azimute. Clicar numa zona anima até a vista dela; clicar numa letra
 * leva ao azimute dela. As células são botões para o teclado (Tab e Enter). Não cria um renderizador WebGL.
 */
export function ViewCube({ model }: ViewCubeProps): ReactElement {
  const orbit = model.orbit;
  // Lê a câmera a cada redesenho (arrasto, animação e Início mudam o contador de desenho).
  useUi((s) => s.previewTick);
  const [hover, setHover] = useState<CubeZone | null>(null);
  const [ringHover, setRingHover] = useState<CompassLetter | null>(null);
  const redraw = (): void => useUi.setState((s) => ({ previewTick: s.previewTick + 1 }));
  const go = (v: { azimuth: number; elevation: number }): void => {
    orbit.animateTo(v);
    redraw();
  };

  /** Ponto do ponteiro no sistema do palco: o centro do palco é o centro do cubo. */
  const local = (stage: HTMLElement, ev: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = stage.getBoundingClientRect();
    return { x: ev.clientX - (r.left + r.width / 2), y: ev.clientY - (r.top + r.height / 2) };
  };
  /** Zona do cubo sob o ponteiro. */
  const zoneAt = (stage: HTMLElement, ev: { clientX: number; clientY: number }): CubeZone | null => {
    const p = local(stage, ev);
    return zoneAtPoint(orbit.azimuth, orbit.elevation, p.x, p.y, CUBE_HALF_PX);
  };
  /** Ponto da faixa do anel sob o ponteiro (só vale fora do cubo, que tem prioridade). */
  const ringAt = (stage: HTMLElement, ev: { clientX: number; clientY: number }) => {
    const p = local(stage, ev);
    return ringHit(orbit.azimuth, orbit.elevation, p.x, p.y, CUBE_HALF_PX);
  };

  const onStagePointerDown = (e: RPointerEvent<HTMLDivElement>): void => {
    // Meio e direito não são do palco: deixam o evento subir para o canvas (pan e menu de contexto).
    if (e.button !== 0) return;
    // O arrasto da vista nasce no palco; o canvas não pode iniciar outro por baixo.
    e.stopPropagation();
    const stage = e.currentTarget;
    const start = { x: e.clientX, y: e.clientY };
    let last = start;
    let moved = false;
    // Sobre o anel (e fora do cubo), o arrasto gira só o azimute.
    const onRing = !zoneAt(stage, e) && ringAt(stage, e) !== null;
    const move = (ev: PointerEvent): void => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= DRAG_PX) return;
      moved = true;
      orbit.orbit(ev.clientX - last.x, onRing ? 0 : ev.clientY - last.y);
      last = { x: ev.clientX, y: ev.clientY };
      redraw();
    };
    const finish = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', finish);
    };
    const onUp = (ev: PointerEvent): void => {
      finish();
      if (moved) return;
      const z = zoneAt(stage, ev);
      if (z) {
        go(viewForZone(z.sign, orbit.azimuth));
        return;
      }
      const ring = ringAt(stage, ev);
      if (ring?.letter) go({ azimuth: ring.letter.angle, elevation: orbit.elevation });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', finish);
  };

  const onStagePointerMove = (e: RPointerEvent<HTMLDivElement>): void => {
    if (e.buttons !== 0) return; // com botão apertado é arrasto, tratado pelo listener da janela
    const stage = e.currentTarget;
    const z = zoneAt(stage, e);
    setHover((h) => (h?.id === z?.id ? h : z));
    const letter = z ? null : (ringAt(stage, e)?.letter ?? null);
    setRingHover((h) => (h?.key === letter?.key ? h : letter));
  };

  const turn = (dir: 1 | -1) => (): void => go({ azimuth: turnAzimuth(orbit.azimuth, dir), elevation: orbit.elevation });

  // Início: vista padrão do app e enquadramento do modelo, animados.
  const home = (): void => go({ ...HOME_VIEW, ...orbit.framing(model.bounds()) });

  const toggleOrtho = (): void => {
    orbit.setOrtho(!orbit.ortho);
    redraw();
  };

  const cubeStyle = { transform: cubeMatrix(orbit.azimuth, orbit.elevation), '--vc-half': `${CUBE_HALF_PX}px` } as CSSProperties;
  const stageTitle = hover
    ? hover.name
    : ringHover
      ? `Vista para o ${ringHover.name}`
      : 'Clique numa zona ou letra para ir à vista; arraste para girar a vista';

  return (
    // O contêiner não recebe o ponteiro (CSS): só o palco e os botões são interativos. O vão transparente em volta do
    // cubo/anel deixa o clique chegar ao canvas (órbita, seleção e pan), em vez de sumir no contêiner.
    <div className="viewcube" role="group" aria-label="Controle da vista 3D">
      <div
        className="vc-stage"
        title={stageTitle}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerLeave={() => {
          setHover(null);
          setRingHover(null);
        }}
      >
        <ViewCubeRing azimuth={orbit.azimuth} elevation={orbit.elevation} hover={ringHover?.key ?? null} layer="back" />
        <div className="vc-cube" style={cubeStyle}>
          {FACES.map(({ face, cells }) => (
            <div key={face} className={`vc-face vc-face--${face}`} style={{ transform: FACE_TRANSFORM[face] }}>
              {cells.map(({ row, col, zone }) => (
                <button
                  key={`${row}${col}`}
                  type="button"
                  data-testid="viewcube"
                  data-face={zone.id}
                  className={`vc-cell vc-cell--${zone.kind}${hover?.id === zone.id ? ' is-hover' : ''}`}
                  style={{ gridRow: row + 1, gridColumn: col + 1 }}
                  aria-label={zone.name}
                  title={zone.name}
                  onClick={() => go(viewForZone(zone.sign, orbit.azimuth))}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <ViewCubeRing azimuth={orbit.azimuth} elevation={orbit.elevation} hover={ringHover?.key ?? null} layer="front" />
      </div>
      <div className="vc-tools" onPointerDown={conterSeEsquerdo}>
        <button type="button" className="vc-btn" aria-label="Girar a vista 90° para a esquerda" title="Girar 90° para a esquerda" onClick={turn(1)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <button type="button" className="vc-btn vc-btn--home" aria-label="Início: vista padrão e enquadrar o modelo" title="Início: vista padrão e enquadrar" onClick={home}>
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
