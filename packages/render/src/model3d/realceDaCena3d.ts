import * as THREE from 'three';
import type { Id } from '@hestia/model';
import { disposeHighlight, highlightOf, type HighlightStyle } from './highlight3d.ts';

/** Ranhuras do realce: a seleção (`sel`) e o elemento sob o cursor (`hov`). */
export type RanhuraDoRealce = 'sel' | 'hov';

/** Sobreposição de realce (seleção ou elemento sob o cursor) e a chave que a identifica, para não refazê-la à toa. */
interface Realce {
  key: string;
  obj: THREE.Object3D;
}

/**
 * Realces da cena (decisão 0016 §4): uma sobreposição por ranhura, num objeto à parte (`camada`), fora do modelo, para não
 * entrar nas malhas do modelo nem no picking por faixas. Só refaz a sobreposição cuja chave mudou.
 */
export class RealcesDaCena {
  /** Onde as sobreposições ficam; a cena a põe como filha. */
  readonly camada = new THREE.Object3D();
  private slots: Record<RanhuraDoRealce, Realce | null> = { sel: null, hov: null };

  /** `raiz` é de onde as sobreposições copiam os triângulos (a cena inteira). */
  constructor(private readonly raiz: THREE.Object3D) {}

  /** Troca a sobreposição da ranhura pelos elementos `ids`, se a cor ou os ids mudaram. */
  definir(slot: RanhuraDoRealce, ids: readonly Id[], style: HighlightStyle): void {
    const key = `${String(style.color)}|${ids.join(',')}`;
    const cur = this.slots[slot];
    if (cur?.key === key) return;
    if (cur) this.soltar(slot);
    if (!ids.length) return;
    const obj = highlightOf(this.raiz, ids, style);
    this.camada.add(obj);
    this.slots[slot] = { key, obj };
  }

  soltar(slot: RanhuraDoRealce): void {
    const cur = this.slots[slot];
    if (!cur) return;
    this.camada.remove(cur.obj);
    disposeHighlight(cur.obj);
    this.slots[slot] = null;
  }

  /** Tira as duas sobreposições (o modelo foi refeito, ou a cena será descartada). */
  soltarTodos(): void {
    this.soltar('sel');
    this.soltar('hov');
  }
}
