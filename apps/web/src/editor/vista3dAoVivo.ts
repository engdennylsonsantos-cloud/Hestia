import type { SheetView3DCamera } from '@hestia/model';
import { cameraDaOrbita, type OrbitCamera } from '@hestia/render';
import { useUi } from './state.ts';
import { activateView } from './viewTabActions.ts';

/**
 * Ponte entre a vista 3D ao vivo (a órbita do `ViewportCanvas`) e o catálogo de pontos de vista 3D (decisão 0040).
 *
 * O projeto guarda só o retrato serializável da câmera (`SheetView3DCamera`); a órbita viva continua dona da tela.
 * O `ViewportCanvas` registra a órbita quando a vista 3D monta e consome a câmera pendente depois de trocar para ela.
 */
let orbita: OrbitCamera | null = null;
/** Câmera pedida por "ir para o ponto", à espera da vista 3D montar (ou já montada). */
let pendente: SheetView3DCamera | null = null;

/** Registra a órbita viva da vista 3D; null quando a vista 3D desmonta. */
export function registrarOrbita3D(o: OrbitCamera | null): void {
  orbita = o;
}

/** Há uma vista 3D viva de onde ler a câmera atual? */
export function temVista3DAoVivo(): boolean {
  return orbita !== null;
}

/** Retrato da órbita viva, ou null quando a vista 3D não está aberta. */
export function camera3DAtual(): SheetView3DCamera | null {
  return orbita ? cameraDaOrbita(orbita) : null;
}

/**
 * Pede que a vista 3D abra na câmera dada (usado por "ir para o ponto"). A cópia é desligada do projeto: a tela não
 * compartilha objeto com o ponto salvo. Se a navegação for recusada (modo de perímetro aberto), o pedido é descartado.
 */
export function pedirCamera3D(c: SheetView3DCamera): void {
  pendente = { ...c, target: { ...c.target } };
  activateView({ kind: '3d' });
  if (useUi.getState().view !== '3d') pendente = null;
}

/** Câmera pendente (e limpa o pedido), ou null se não havia nenhum. */
export function consumirCameraPendente(): SheetView3DCamera | null {
  const c = pendente;
  pendente = null;
  return c;
}
