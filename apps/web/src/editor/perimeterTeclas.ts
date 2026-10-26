import type { PerimeterMode } from './perimeterMode.ts';

/**
 * Ctrl+A (ou Cmd+A) com o modo de perímetro aberto seleciona as linhas do esboço, nunca o texto da página. Devolve
 * false fora do modo, para o controlador seguir o caminho do projeto.
 */
export function atalhoSelecionarTudo(mode: PerimeterMode, e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'a') return false;
  return mode.selecionarTudo();
}
