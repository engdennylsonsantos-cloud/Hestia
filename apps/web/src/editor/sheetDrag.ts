import type { SheetViewSource } from '@hestia/model';

/**
 * Arraste de uma vista do Navegador de projeto para a prancha (estilo Revit). O `dataTransfer` protege o conteúdo
 * durante o `dragover`, então o dado também fica aqui: a prancha lê o rascunho para desenhar o retângulo de prévia
 * enquanto o ponteiro passa por cima.
 */

/** Tipo próprio no `dataTransfer` (o mesmo em `Node.drag`). */
export const SHEET_VIEW_MIME = 'application/x-hestia-view';

export interface SheetDragSource {
  view: SheetViewSource;
  label: string;
}

let current: SheetDragSource | null = null;

export function beginSheetDrag(source: SheetDragSource): void {
  current = source;
}

export function endSheetDrag(): void {
  current = null;
}

/** Vista sendo arrastada agora, ou null. */
export function draggedSheetView(): SheetDragSource | null {
  return current;
}
