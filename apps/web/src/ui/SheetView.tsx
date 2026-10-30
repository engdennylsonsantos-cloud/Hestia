import type { ReactElement } from 'react';
import { SheetStage } from './sheet/SheetStage.tsx';

/**
 * Aba de uma prancha (decisão 0022): delega ao palco do editor de layout, que cuida da câmera (zoom/pan), da seleção
 * com alças, do pan do conteúdo, do encaixe e da barra inferior. O `key` remonta o palco ao trocar de prancha, para a
 * câmera e a seleção serem as da prancha aberta.
 */
export function SheetView({ sheetId }: { sheetId: string }): ReactElement {
  return <SheetStage key={sheetId} sheetId={sheetId} />;
}
