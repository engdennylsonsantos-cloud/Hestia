import { useRef, useSyncExternalStore } from 'react';
import type { Project } from '@hestia/model';
import { editor } from './controller.ts';

/** Assinatura do documento: constante para o `useSyncExternalStore` não reassinar a cada render. */
const assinarProjeto = (cb: () => void): (() => void) => editor.store.subscribe(cb);

/**
 * Valor derivado do projeto que re-renderiza quem lê **só quando ele muda de fato** (`igual` decide; padrão `Object.is`).
 *
 * É para a interface quente: `useProject()` assina o projeto inteiro, então um só elemento novo (inserir uma porta) ou
 * um quadro de pan redesenha quem só mostra nome, níveis ou tipos. O seletor devolve a mesma referência enquanto o
 * valor derivado não mudar — e aí o componente não é redesenhado. O projeto em si não muda: nada aqui altera geometria.
 */
export function useProjetoDerivado<T>(selecionar: (p: Project) => T, igual: (a: T, b: T) => boolean = Object.is): T {
  const cache = useRef<{ valor: T } | null>(null);
  const ler = (): T => {
    const valor = selecionar(editor.project);
    const guardado = cache.current;
    if (guardado && igual(guardado.valor, valor)) return guardado.valor;
    cache.current = { valor };
    return valor;
  };
  return useSyncExternalStore(assinarProjeto, ler, ler);
}
