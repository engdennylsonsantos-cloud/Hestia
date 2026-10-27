import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { MenuEntry } from '../editor/contextMenu.ts';

export interface PopupMenuProps {
  x: number;
  y: number;
  items: MenuEntry[];
  /** Escolheu um item habilitado sem submenu. O menu fecha logo depois. */
  onPick: (id: string) => void;
  onClose: () => void;
}

interface Pos {
  left: number;
  top: number;
}
const LONGE: Pos = { left: -9999, top: -9999 };
const MARGEM = 4;

/** Próximo índice habilitado a partir de `from` no passo `dir` (sem dar a volta). -1 se não há. */
function passo(itens: MenuEntry[], from: number, dir: 1 | -1): number {
  for (let i = from + dir; i >= 0 && i < itens.length; i += dir) if (!itens[i]!.disabled) return i;
  return -1;
}

/** Níveis visíveis: o primeiro é o menu; cada índice de `path` abre o submenu do item ativo do nível anterior. */
function niveisDe(itens: MenuEntry[], path: number[]): MenuEntry[][] {
  const out = [itens];
  for (let i = 0; i < path.length - 1; i++) {
    const kids = out[i]![path[i]!]?.children;
    if (!kids?.length) break;
    out.push(kids);
  }
  return out;
}

/** Menu suspenso no padrão Windows (planta, corte e 3D): submenus à direita (ou à esquerda), teclado e atalhos. */
export function PopupMenu({ x, y, items, onPick, onClose }: PopupMenuProps): ReactElement {
  // path[i]: índice ativo no nível i (-1 = nenhum). O nível mais fundo é o que tem foco.
  const [path, setPath] = useState<number[]>([-1]);
  const [pos, setPos] = useState<Pos[]>([]);
  const itemEls = useRef(new Map<string, HTMLButtonElement>());
  const menuEls = useRef(new Map<number, HTMLDivElement>());
  const niveis = useMemo(() => niveisDe(items, path), [items, path]);
  const d = niveis.length - 1;
  const cur = useMemo(() => niveis.map((_, i) => path[i] ?? -1), [niveis, path]);

  // Posição: o menu principal cabe na janela; cada submenu abre ao lado do item ativo do nível anterior.
  useLayoutEffect(() => {
    const next = niveis.map((_, i): Pos => {
      const el = menuEls.current.get(i);
      const w = el?.offsetWidth ?? 240;
      const h = el?.offsetHeight ?? 0;
      if (i === 0) return { left: Math.max(MARGEM, Math.min(x, window.innerWidth - w - MARGEM)), top: Math.max(MARGEM, Math.min(y, window.innerHeight - h - MARGEM)) };
      const r = itemEls.current.get(`${i - 1}:${cur[i - 1]}`)?.getBoundingClientRect();
      if (!r) return LONGE;
      let left = r.right - 2;
      if (left + w > window.innerWidth - MARGEM) left = r.left - w + 2;
      const top = Math.max(MARGEM, Math.min(r.top - 4, window.innerHeight - h - MARGEM));
      return { left: Math.max(MARGEM, left), top };
    });
    if (next.length !== pos.length || next.some((p, i) => p.left !== pos[i]?.left || p.top !== pos[i]?.top)) setPos(next);
    // Só muda com o caminho, a posição ou o tamanho medido: a comparação acima encerra o ciclo.
  }, [niveis, cur, x, y, pos]);

  // Foco no item ativo do nível mais fundo (setas e Enter funcionam sem clique).
  const ativo = cur[d] ?? -1;
  useEffect(() => {
    if (ativo >= 0) itemEls.current.get(`${d}:${ativo}`)?.focus({ preventScroll: true });
  }, [d, ativo]);

  // Teclado: captura antes da tela, para as setas e Enter não irem ao canvas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const lista = niveis[d] ?? [];
      const atual = cur[d] ?? -1;
      const consome = (): void => { e.preventDefault(); e.stopPropagation(); };
      /** Move o item ativo do nível fundo para `n` (-1 = nenhum). */
      const vai = (n: number): void => { if (n >= 0) setPath([...cur.slice(0, d), n]); };
      switch (e.key) {
        case 'ArrowDown': consome(); vai(passo(lista, atual, 1)); return;
        case 'ArrowUp': consome(); vai(passo(lista, atual < 0 ? lista.length : atual, -1)); return;
        case 'Home': consome(); vai(passo(lista, -1, 1)); return;
        case 'End': consome(); vai(passo(lista, lista.length, -1)); return;
        case 'ArrowRight': {
          consome();
          const it = lista[atual];
          if (it && !it.disabled && it.children?.length) setPath([...cur.slice(0, d + 1), -1]);
          return;
        }
        case 'ArrowLeft':
          consome();
          if (d > 0) setPath(cur.slice(0, d));
          return;
        case 'Enter': {
          consome();
          const it = lista[atual];
          if (!it || it.disabled) return;
          if (it.children?.length) { setPath([...cur.slice(0, d + 1), -1]); return; }
          onPick(it.id);
          onClose();
          return;
        }
        case 'Escape':
          consome();
          if (d > 0) setPath(cur.slice(0, d));
          else onClose();
          return;
        default:
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // Fecha ao clicar fora de qualquer nível do menu ou ao perder o foco da janela.
  useEffect(() => {
    const fora = (e: PointerEvent): void => { if (!(e.target as Element | null)?.closest?.('[data-ctx-menu]')) onClose(); };
    window.addEventListener('pointerdown', fora, true);
    window.addEventListener('blur', onClose);
    return () => { window.removeEventListener('pointerdown', fora, true); window.removeEventListener('blur', onClose); };
  }, [onClose]);

  /** Mouse sobre um item habilitado: ele fica ativo e fecha os submenus de nível mais fundo; com submenu, abre-o. */
  const ativa = (nivel: number, idx: number, it: MenuEntry): void => {
    if (it.disabled) return;
    setPath([...cur.slice(0, nivel), idx, ...(it.children?.length ? [-1] : [])]);
  };
  const clica = (nivel: number, idx: number, it: MenuEntry): void => {
    if (it.disabled) return;
    if (it.children?.length) { ativa(nivel, idx, it); return; }
    onPick(it.id);
    onClose();
  };

  return createPortal(
    <>
      {niveis.map((lista, nivel) => (
        <div
          key={nivel}
          ref={(el) => { if (el) menuEls.current.set(nivel, el); else menuEls.current.delete(nivel); }}
          className="rb-menu ctx-menu"
          role="menu"
          data-ctx-menu=""
          onPointerDown={(e) => e.stopPropagation()}
          style={pos[nivel] ?? LONGE}
        >
          {lista.map((it, idx) => (
            <div key={it.id + idx} role="none">
              {it.separatorBefore && <hr className="rb-sep" />}
              <button
                ref={(el) => { const k = `${nivel}:${idx}`; if (el) itemEls.current.set(k, el); else itemEls.current.delete(k); }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                aria-disabled={it.disabled || undefined}
                aria-haspopup={it.children ? 'menu' : undefined}
                aria-expanded={it.children?.length ? cur[nivel] === idx && d > nivel : undefined}
                title={it.hint}
                className={`rb-menuitem ctx-item${it.soon ? ' soon' : ''}${it.checked ? ' on' : ''}${cur[nivel] === idx ? ' ctx-active' : ''}`}
                onMouseEnter={() => ativa(nivel, idx, it)}
                onClick={() => clica(nivel, idx, it)}
              >
                <span className="ctx-check" aria-hidden="true">{it.checked ? '✓' : ''}</span>
                <span className="ctx-label">{it.label}</span>
                {it.shortcut && <em>{it.shortcut}</em>}
                {it.children && <span className="ctx-sub" aria-hidden="true">▸</span>}
              </button>
            </div>
          ))}
        </div>
      ))}
    </>,
    document.body,
  );
}
