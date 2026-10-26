import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { SketchResult, SketchTarget } from '@hestia/geom';
import type { RibbonPanel } from '../ribbon/model.ts';
import { P_MEASURE, P_MODIFY, P_PROPS, P_SELECT } from '../ribbon/panelsShared.ts';
import { finishTitle, PERIMETER_TOOL, PERIMETER_TOOL_EN } from './PerimeterStatus.ts';

/** Forma da galeria "Desenhar". `isNew` marca o que o programa ainda não tem (ponto azul no canto). */
export type PerimeterShape =
  | 'line' | 'rect' | 'poly-inscribed' | 'poly-circumscribed' | 'circle' | 'arc-3pt' | 'arc-center' | 'arc-tangent'
  | 'fillet' | 'ellipse' | 'pick-face' | 'by-perimeter';

/** Linha que o próximo clique desenha: linha de limite (padrão) ou seta de inclinação (só telhado). */
export type PerimeterLineKind = 'boundary' | 'slope';

interface ShapeDef {
  id: PerimeterShape;
  label: string;
  isNew: boolean;
  icon: ReactNode;
}

const cls = (...c: Array<string | false | null | undefined>): string => c.filter(Boolean).join(' ');

/** Ícone 32×32 no estilo da faixa: as cores vêm das classes `ic-*` de styles.css. */
function Ic({ size = 20, children }: { size?: number; children: ReactNode }): ReactElement {
  return (
    <svg className="ic" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Galeria de formas, na ordem da proposta. Não há furo aqui: furo é uma ferramenta própria de cada elemento. */
export const PERIMETER_SHAPES: readonly ShapeDef[] = [
  {
    id: 'line', label: 'Linha (contorno por pontos)', isNew: false,
    icon: <><path className="ic-s1" d="M5 27L27 5" /><rect className="ic-bl" x="3" y="25" width="4" height="4" /><rect className="ic-bl" x="25" y="3" width="4" height="4" /></>,
  },
  { id: 'rect', label: 'Retângulo', isNew: false, icon: <path className="ic-s1" d="M4 8H28V24H4Z" /> },
  {
    id: 'poly-inscribed', label: 'Polígono inscrito', isNew: true,
    icon: <><circle className="ic-ln" cx="16" cy="17" r="12" /><path className="ic-s1" d="M16 5L27.4 13.3L23 26.7H9L4.6 13.3Z" /></>,
  },
  {
    id: 'poly-circumscribed', label: 'Polígono circunscrito', isNew: true,
    icon: <><circle className="ic-ln" cx="16" cy="17" r="9.7" /><path className="ic-s1" d="M16 4L28.5 13L23.8 27.5H8.2L3.5 13Z" /></>,
  },
  { id: 'circle', label: 'Círculo', isNew: true, icon: <circle className="ic-s1" cx="16" cy="16" r="12" /> },
  {
    id: 'arc-3pt', label: 'Arco (3 pontos)', isNew: true,
    icon: <><path className="ic-s1" d="M4 24A14 14 0 0 1 28 24" /><rect className="ic-bl" x="2" y="22" width="4" height="4" /><rect className="ic-bl" x="26" y="22" width="4" height="4" /></>,
  },
  {
    id: 'arc-center', label: 'Arco (centro e extremidades)', isNew: true,
    icon: <><path className="ic-s1" d="M6 22A14 14 0 0 1 26 22" /><path className="ic-ln" d="M16 28L6 22M16 28L26 22" /></>,
  },
  { id: 'arc-tangent', label: 'Arco tangente', isNew: true, icon: <path className="ic-s1" d="M3 26H13A11 11 0 0 0 27 10" /> },
  { id: 'fillet', label: 'Filete', isNew: true, icon: <path className="ic-s1" d="M5 28V14A9 9 0 0 1 14 5H28" /> },
  { id: 'ellipse', label: 'Elipse', isNew: true, icon: <ellipse className="ic-s1" cx="16" cy="16" rx="13" ry="8" /> },
  {
    id: 'pick-face', label: 'Escolher face ou eixo (parede, piso, referência)', isNew: true,
    icon: <><path className="ic-ln" d="M4 8H28V24H4Z" /><path className="ic-s1" d="M4 8H28" /><path className="ic-ac" d="M20 14L28 28L24 22L18 24Z" /></>,
  },
  {
    id: 'by-perimeter', label: 'Por perímetro (caixa de seleção, contorno externo)', isNew: true,
    icon: <><path className="ic-ln" d="M3 3H29V29H3Z" strokeDasharray="3 2" /><path className="ic-s1" d="M8 9H24V16H20V23H8Z" /></>,
  },
];

export interface PerimeterRibbonProps {
  target: SketchTarget;
  /** Resultado da dedução do contorno; Concluir só habilita com `ok`. */
  result: SketchResult | null;
  lineKind: PerimeterLineKind;
  shape: PerimeterShape;
  onLineKind: (kind: PerimeterLineKind) => void;
  onShape: (shape: PerimeterShape) => void;
  onFinish: () => void;
  onCancel: () => void;
}

/** Passo de rolagem da galeria (uma linha de 30 px, com folga). */
const STEP = 30;

/**
 * Painéis "Modo" (Concluir/Cancelar) e "Desenhar" (linha de limite, seta de inclinação só no telhado, e a galeria de
 * formas em caixa com rolagem). Vêm na aba contextual: ver `perimeterContextTab`.
 */
export function PerimeterRibbonPanels({ target, result, lineKind, shape, onLineKind, onShape, onFinish, onCancel }: PerimeterRibbonProps): ReactElement {
  const roof = target === 'roof';
  const kind: PerimeterLineKind = roof ? lineKind : 'boundary';
  const canFinish = result?.ok === true;
  const galRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const scroll = (dy: number): void => galRef.current?.scrollBy({ top: dy, behavior: 'smooth' });

  return (
    <>
      <div className="rb-panel" role="group" aria-label="Modo">
        <div className="rb-cols">
          <button className="rb-btn rb-large" title={finishTitle(target, result)} aria-label="Concluir" disabled={!canFinish} onClick={onFinish}>
            <Ic size={32}>
              <path d="M5 17L12.5 24.5L27 7" fill="none" style={{ stroke: 'var(--revit-green)' }} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
            </Ic>
            <span className="rb-lbl">Concluir</span>
          </button>
          <button className="rb-btn rb-large" title="Cancelar (descarta o rascunho)" aria-label="Cancelar" onClick={onCancel}>
            <Ic size={32}>
              <path d="M7 7L25 25M25 7L7 25" fill="none" style={{ stroke: 'var(--danger)' }} strokeWidth={3.2} strokeLinecap="round" />
            </Ic>
            <span className="rb-lbl">Cancelar</span>
          </button>
        </div>
        <div className="rb-title">Modo</div>
      </div>

      <div className="rb-panel" role="group" aria-label="Desenhar">
        <div className="rb-cols">
          <div className="rb-stack">
            <button className={cls('rb-btn rb-small', kind === 'boundary' && 'on')} title="Linha de limite" aria-label="Linha de limite" aria-pressed={kind === 'boundary'} onClick={() => onLineKind('boundary')}>
              <Ic size={16}>
                <path className="ic-s1" d="M4 8H28V24H4Z" />
                <path className="ic-ac" d="M4 8H28V24H4Z" strokeDasharray="3 2" />
              </Ic>
              <span className="rb-lbl">Linha de limite</span>
            </button>
            {roof && (
              <button className={cls('rb-btn rb-small', kind === 'slope' && 'on')} title="Seta de inclinação" aria-label="Seta de inclinação" aria-pressed={kind === 'slope'} onClick={() => onLineKind('slope')}>
                <Ic size={16}>
                  <path className="ic-s1" d="M4 24L28 8" />
                  <path className="ic-ac" d="M28 8L21 8M28 8L28 15" />
                </Ic>
                <span className="rb-lbl">Seta de inclinação</span>
              </button>
            )}
          </div>
          <div className={cls('pm-galbox', expanded && 'pm-expanded')} role="group" aria-label="Formas de desenho">
            <div className="pm-gal" ref={galRef}>
              {PERIMETER_SHAPES.map((s) => (
                <button
                  key={s.id}
                  className={cls('pm-gi', s.isNew && 'new', shape === s.id && 'on')}
                  title={s.label}
                  aria-label={s.label}
                  aria-pressed={shape === s.id}
                  onClick={() => onShape(s.id)}
                >
                  <Ic>{s.icon}</Ic>
                </button>
              ))}
            </div>
            <div className="pm-gscroll">
              <button type="button" title="Rolar para cima" aria-label="Rolar para cima" onClick={() => scroll(-STEP)}>▴</button>
              <button type="button" title="Rolar para baixo" aria-label="Rolar para baixo" onClick={() => scroll(STEP)}>▾</button>
              <button
                type="button"
                title={expanded ? 'Recolher a galeria' : 'Expandir a galeria'}
                aria-label={expanded ? 'Recolher a galeria' : 'Expandir a galeria'}
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
              >
                ▿
              </button>
            </div>
          </div>
        </div>
        <div className="rb-title">Desenhar</div>
      </div>
    </>
  );
}

/** Item da aba contextual: um painel de dados da faixa, ou o lugar dos painéis Modo e Desenhar (`PerimeterRibbonPanels`). */
export type PerimeterTabSlot = { kind: 'panel'; panel: RibbonPanel } | { kind: 'perimetro' };

/** Descrição da aba "Modificar | Criar perímetro …". `key` identifica o assunto, como em `contextTab`. */
export interface PerimeterContextTab {
  key: string;
  label: { pt: string; en: string };
  slots: PerimeterTabSlot[];
}

/**
 * Aba contextual do modo de perímetro. Reaproveita Selecionar, Propriedades, Modificar e Medir (panelsShared.ts) e põe
 * Modo e Desenhar no lugar do slot `perimetro`. O integrador desenha cada slot: `panel` com PanelView, `perimetro`
 * com PerimeterRibbonPanels.
 */
export function perimeterContextTab(target: SketchTarget): PerimeterContextTab {
  return {
    key: `perimeter:${target}`,
    label: { pt: `Modificar | ${PERIMETER_TOOL[target]}`, en: `Modify | ${PERIMETER_TOOL_EN[target]}` },
    slots: [
      { kind: 'panel', panel: P_SELECT },
      { kind: 'panel', panel: P_PROPS },
      { kind: 'panel', panel: P_MODIFY },
      { kind: 'panel', panel: P_MEASURE },
      { kind: 'perimetro' },
    ],
  };
}
