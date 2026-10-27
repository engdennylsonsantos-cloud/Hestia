import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { fitMask } from './fitCount.ts';

/**
 * Item recolhível de uma linha (painel da faixa ou aba). `node` aparece na linha; `menu`, se houver, é como ele aparece
 * no popup de "mais" (padrão: o próprio `node`).
 */
export interface FitItem {
  key: string;
  node: ReactElement;
  menu?: ReactElement;
  /** Item ativo (aba selecionada): se ele for recolhido, o botão "mais" fica marcado. */
  active?: boolean;
  /** Quanto maior, mais tarde o item é recolhido (padrão 0; empate recolhe o mais à direita primeiro). */
  priority?: number;
}

interface FitRowProps {
  items: FitItem[];
  className: string;
  role?: string;
  ariaLabel: string;
  /** Rótulo e conteúdo do botão que abre os itens que não cabem. */
  moreLabel: string;
  moreContent: ReactNode;
  /** Classe extra do popup ("panels" ou "tabs"). */
  popClass: string;
}

const MORE_FALLBACK = 30;

/**
 * Largura natural de cada item (medida numa linha escondida, uma célula por item) e quais cabem na largura útil da caixa
 * (descontado o padding; cada item leva o `gap` da caixa, como na linha de verdade).
 */
function countFit(box: HTMLElement | null, measure: HTMLElement | null, more: HTMLElement | null, moreW: { w: number }, priorities: readonly number[]): boolean[] {
  if (!box || !measure) return [];
  const cs = getComputedStyle(box);
  const gap = parseFloat(cs.columnGap) || 0;
  const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  if (more) moreW.w = more.getBoundingClientRect().width || moreW.w;
  const widths = Array.from(measure.children, (c) => c.getBoundingClientRect().width + gap);
  return fitMask(widths, priorities, box.clientWidth - pad, moreW.w + gap);
}

const mesmaMascara = (a: readonly boolean[], b: readonly boolean[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Linha que recolhe pelo fim: o que não cabe sai para um botão "mais", que abre um popup com esses itens. A medição
 * roda antes da pintura (useLayoutEffect), então não há quadro com itens cortados, e um ResizeObserver refaz a conta
 * quando a largura muda.
 */
export function FitRow({ items, className, role, ariaLabel, moreLabel, moreContent, popClass }: FitRowProps): ReactElement {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const moreW = useRef({ w: MORE_FALLBACK });
  const priorities = useRef<number[]>([]);
  priorities.current = items.map((it) => it.priority ?? 0);
  const [mask, setMaskState] = useState<boolean[]>(() => items.map(() => true));
  const setMask = (m: boolean[]): void => setMaskState((old) => (mesmaMascara(old, m) ? old : m));
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // Lista nova (o pai redesenhou): confere se cabe. Sem laço: o estado só muda quando o número muda.
  useLayoutEffect(() => {
    setMask(countFit(box.current, measure.current, more.current, moreW.current, priorities.current));
  }, [items]);

  // Largura da caixa muda (janela, painel acoplado): refaz a conta.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setMask(countFit(box.current, measure.current, more.current, moreW.current, priorities.current)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Popup posicionado sob o botão "mais", alinhado à direita e dentro da tela.
  useLayoutEffect(() => {
    if (!open || !pop.current || !more.current) return;
    const a = more.current.getBoundingClientRect();
    const w = pop.current.offsetWidth;
    const h = pop.current.offsetHeight;
    setPos({ left: Math.max(4, Math.min(a.right - w, window.innerWidth - w - 4)), top: Math.min(a.bottom + 1, window.innerHeight - h - 4) });
  }, [open]);

  // Ao abrir, o foco vai para o primeiro botão do popup (teclado).
  useEffect(() => {
    if (open) pop.current?.querySelector<HTMLElement>('button:not(:disabled), select:not(:disabled)')?.focus();
  }, [open]);

  // Fecha com Escape (devolve o foco ao botão "mais") ou com um clique fora do popup e do botão.
  useEffect(() => {
    if (!open) return undefined;
    const down = (e: PointerEvent): void => {
      const t = e.target as Element;
      if (pop.current?.contains(t) || more.current?.contains(t) || t.closest?.('.rb-menu')) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      more.current?.focus();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key, true);
    };
  }, [open]);

  const ok = mask.length === items.length;
  const shown = items.filter((_, i) => !ok || mask[i]);
  const hidden = items.filter((_, i) => ok && !mask[i]);
  const showPop = open && hidden.length > 0;

  return (
    <>
      <div className={className} ref={box} role={role} aria-label={ariaLabel}>
        <div className="fit-measure" ref={measure} aria-hidden="true">
          {items.map((it) => <div key={it.key} className="fit-cell">{it.node}</div>)}
        </div>
        {shown.map((it) => <Fragment key={it.key}>{it.node}</Fragment>)}
        {hidden.length > 0 && (
          <button ref={more} className={`fit-more${open ? ' on' : ''}${hidden.some((it) => it.active) ? ' has-active' : ''}`} aria-label={moreLabel} title={moreLabel} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {moreContent}
          </button>
        )}
      </div>
      {showPop && createPortal(
        <div
          ref={pop}
          className={`fit-pop ${popClass}`}
          role="dialog"
          aria-label={moreLabel}
          style={{ left: pos.left, top: pos.top }}
          onClick={(e) => {
            // Escolher um item fecha o popup; o botão que abre outro menu (▾) continua aberto. Na fase de borbulhamento
            // (não na de captura): fechar antes desmontava o botão e a ação do item não rodava.
            const b = (e.target as Element).closest('button');
            if (b && !b.hasAttribute('aria-haspopup') && !b.disabled) setOpen(false);
          }}
        >
          {hidden.map((it) => <Fragment key={it.key}>{it.menu ?? it.node}</Fragment>)}
        </div>,
        document.body,
      )}
    </>
  );
}
