/**
 * Nome de arquivo seguro para o download: sem acento nem caractere fora do ASCII. Com "é" no nome (ex.: "Casa térrea")
 * o navegador ignora o `download` e salva como "download", então o nome vai sem diacríticos.
 */
export function safeFilename(name: string): string {
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9 ._,()-]+/g, '-').replace(/^[-. ]+|[-. ]+$/g, '');
  return ascii || 'projeto.pdf';
}

/**
 * Salva um PDF (bytes) pelo <a download>, como o DXF salva texto. Devolve a frase de status em português.
 */
export function savePdf(filename: string, bytes: Uint8Array): string {
  const name = safeFilename(filename);
  try {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return `Salvo como ${name}.`;
  } catch {
    return 'Não foi possível salvar o PDF neste navegador.';
  }
}
