import { entregarArquivo } from './entregarArquivo.ts';
import { safeFilename } from './nomeArquivo.ts';

/**
 * Entrega um arquivo de texto ao usuário e devolve uma frase de status em português.
 * Ordem (em `entregarArquivo`): capacidade `downloads` do artefato, download direto; por último, área de transferência.
 */
export async function saveText(nomeOriginal: string, text: string): Promise<string> {
  const filename = safeFilename(nomeOriginal);
  const entrega = await entregarArquivo({ nome: filename, conteudo: text });
  if (entrega === 'salvo') return `Salvo como ${filename}.`;
  if (entrega === 'cancelado') return 'Exportação cancelada. Nenhum arquivo foi salvo.';
  if (entrega === 'baixado') return `Arquivo ${filename} gerado.`;
  try {
    await navigator.clipboard.writeText(text);
    return 'Download indisponível: o conteúdo foi copiado para a área de transferência.';
  } catch {
    return 'Não foi possível exportar o arquivo.';
  }
}
