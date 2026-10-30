import { entregarArquivo } from './entregarArquivo.ts';
import { safeFilename } from './nomeArquivo.ts';

/**
 * Entrega um arquivo binário (o ZIP do lote de DXF) e devolve a frase de status, como `saveText`.
 * Ordem (em `entregarArquivo`): capacidade `downloads` do artefato, download direto; bytes não vão para a área de
 * transferência.
 */
export async function saveBytes(nomeOriginal: string, bytes: Uint8Array): Promise<string> {
  const filename = safeFilename(nomeOriginal);
  const entrega = await entregarArquivo({ nome: filename, conteudo: bytes });
  if (entrega === 'salvo') return `Salvo como ${filename}.`;
  if (entrega === 'cancelado') return 'Exportação cancelada. Nenhum arquivo foi salvo.';
  if (entrega === 'baixado') return `Arquivo ${filename} gerado.`;
  return 'Não foi possível exportar o arquivo.';
}
