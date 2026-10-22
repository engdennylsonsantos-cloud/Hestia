import { entregarArquivo } from './entregarArquivo.ts';

/**
 * Nome de arquivo seguro para o download: sem acento nem caractere fora do ASCII. Com "é" no nome (ex.: "Casa térrea")
 * o navegador ignora o `download` e salva como "download", então o nome vai sem diacríticos.
 */
export function safeFilename(name: string): string {
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ._,()-]+/g, '-').replace(/^[-. ]+|[-. ]+$/g, '');
  return ascii || 'projeto.pdf';
}

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
