import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactElement } from 'react';
import type { DimensionHit } from '@hestia/render';
import { editor } from '../editor/controller.ts';

/** Cota aberta para edição no 3D: posição no canvas (px) e o intervalo. */
interface Edicao {
  left: number;
  top: number;
  value: string;
  levelId: string;
  neighborId: string;
  side: 'below' | 'above';
  /** Contador da abertura: o efeito de foco roda a cada abertura, mesmo repetindo a mesma cota. */
  abertura: number;
}

/** O que a vista chama para abrir/fechar o editor da cota. */
export interface NivelCotaEditorHandle {
  abrir: (hit: DimensionHit, rect: { width: number; height: number }) => void;
  /** Fecha aplicando, se estiver aberto; devolve true se havia um editor aberto (o clique é consumido). */
  fecharSeAberto: () => boolean;
}

/**
 * Editor da cota entre os eixos das bolhas: um input **no lugar** da etiqueta no 3D. Enquanto o input está aberto a
 * etiqueta 3D (sprite) fica escondida, para não aparecerem dois elementos sobrepostos. Editar a cota move o nível
 * **selecionado** (o vizinho fica fixo). Enter aplica, Esc cancela; clicar fora também aplica (a vista chama
 * `fecharSeAberto` no `pointerdown`).
 */
export const NivelCotaEditor = forwardRef<NivelCotaEditorHandle>(function NivelCotaEditor(_props, ref): ReactElement | null {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const edicaoRef = useRef<Edicao | null>(null);
  edicaoRef.current = edicao;
  // Etiqueta 3D escondida pelo editor aberto (o sprite continua no grupo; só a visibilidade muda).
  const etiquetaRef = useRef<DimensionHit['label'] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aberturas = useRef(0);

  /** Devolve a etiqueta 3D à cena (se ela ainda existir) e esquece a referência. */
  const mostrarEtiqueta = (): void => {
    const label = etiquetaRef.current;
    etiquetaRef.current = null;
    if (label) label.visible = true;
  };

  const fechar = (aplicar: boolean): void => {
    const d = edicaoRef.current;
    if (!d) return;
    if (aplicar) {
      const valor = Number(d.value.replace(',', '.'));
      const sel = editor.project.levels.find((l) => l.id === d.levelId);
      const viz = editor.project.levels.find((l) => l.id === d.neighborId);
      if (sel && viz && Number.isFinite(valor) && valor > 0.01) {
        // O nível selecionado é o que se move; o vizinho fica fixo (a cota é a distância entre os eixos).
        const elevacao = d.side === 'below' ? viz.elevation + valor : viz.elevation - valor;
        editor.store.exec({ type: 'upsertLevel', level: { ...sel, elevation: elevacao } });
      }
    }
    setEdicao(null);
    // A etiqueta volta ao 3D: o input sai de cena no mesmo quadro.
    mostrarEtiqueta();
  };

  useImperativeHandle(ref, () => ({
    abrir: (hit, rect) => {
      // Uma cota por vez: se outra estava aberta, a etiqueta dela volta antes.
      mostrarEtiqueta();
      // A etiqueta 3D sai de cena: o input ocupa exatamente o lugar dela (um elemento só na tela).
      hit.label.visible = false;
      etiquetaRef.current = hit.label;
      aberturas.current += 1;
      setEdicao({
        left: ((hit.ndc.x + 1) / 2) * rect.width,
        top: ((1 - hit.ndc.y) / 2) * rect.height,
        // units-ok: valor da cota no editor 3D (m)
        value: hit.value.toFixed(2).replace('.', ','),
        levelId: hit.levelId,
        neighborId: hit.neighborId,
        side: hit.side,
        abertura: aberturas.current,
      });
    },
    fecharSeAberto: () => {
      if (!edicaoRef.current) return false;
      fechar(true);
      return true;
    },
  }));

  // O `autoFocus` pode se perder com o pointer capture do canvas (o foco padrão do clique vem depois do handler):
  // reforça o foco (e a seleção) no quadro seguinte a cada abertura.
  const abertura = edicao?.abertura;
  useEffect(() => {
    if (abertura === undefined) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, [abertura]);

  // Se o componente sair da tela com a cota aberta, a etiqueta não pode ficar escondida para sempre.
  useEffect(() => () => {
    const label = etiquetaRef.current;
    etiquetaRef.current = null;
    if (label) label.visible = true;
  }, []);

  if (!edicao) return null;
  return (
    <div
      className="level-dim-edit"
      style={{ left: edicao.left, top: edicao.top, fontSize: 14 }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        autoFocus
        style={{ width: 90, fontSize: 14 }}
        value={edicao.value}
        onChange={(e) => setEdicao({ ...edicao, value: e.target.value })}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            fechar(true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            fechar(false);
          }
        }}
      />
      <span>m</span>
    </div>
  );
});
