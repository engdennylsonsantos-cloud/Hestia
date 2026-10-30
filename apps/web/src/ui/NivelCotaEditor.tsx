import { forwardRef, useImperativeHandle, useRef, useState, type ReactElement } from 'react';
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
}

/** O que a vista chama para abrir/fechar o editor da cota. */
export interface NivelCotaEditorHandle {
  abrir: (hit: DimensionHit, rect: { width: number; height: number }) => void;
  /** Fecha aplicando, se estiver aberto; devolve true se havia um editor aberto (o clique é consumido). */
  fecharSeAberto: () => boolean;
}

/**
 * Editor da cota entre os eixos das bolhas: um input posicionado sobre a etiqueta no 3D. Editar a cota move o nível
 * **selecionado** (o vizinho fica fixo). Enter aplica, Esc cancela; clicar fora também aplica (a vista chama
 * `fecharSeAberto` no `pointerdown`).
 */
export const NivelCotaEditor = forwardRef<NivelCotaEditorHandle>(function NivelCotaEditor(_props, ref): ReactElement | null {
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const edicaoRef = useRef<Edicao | null>(null);
  edicaoRef.current = edicao;

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
  };

  useImperativeHandle(ref, () => ({
    abrir: (hit, rect) => {
      setEdicao({
        left: ((hit.ndc.x + 1) / 2) * rect.width,
        top: ((1 - hit.ndc.y) / 2) * rect.height,
        // units-ok: valor da cota no editor 3D (m)
        value: hit.value.toFixed(2).replace('.', ','),
        levelId: hit.levelId,
        neighborId: hit.neighborId,
        side: hit.side,
      });
    },
    fecharSeAberto: () => {
      if (!edicaoRef.current) return false;
      fechar(true);
      return true;
    },
  }));

  if (!edicao) return null;
  return (
    <div
      className="level-dim-edit"
      style={{ left: edicao.left, top: edicao.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
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
