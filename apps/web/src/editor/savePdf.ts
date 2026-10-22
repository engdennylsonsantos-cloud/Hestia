import { entregarArquivo } from './entregarArquivo.ts';
import { safeFilename } from './nomeArquivo.ts';

/**
 * Salva um PDF (bytes) pela mesma entrega dos demais arquivos (`entregarArquivo`: capacidade `downloads` ou âncora).
 * Devolve a frase de status em português.
 */
export async function savePdf(filename: string, bytes: Uint8Array): Promise<string> {
  const name = safeFilename(filename);
  const entrega = await entregarArquivo({ nome: name, conteudo: bytes });
  if (entrega === 'salvo' || entrega === 'baixado') return `Salvo como ${name}.`;
  if (entrega === 'cancelado') return 'Exportação cancelada. Nenhum arquivo foi salvo.';
  return 'Não foi possível salvar o PDF neste navegador.';
}
