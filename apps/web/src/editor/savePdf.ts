/**
 * Salva um PDF (bytes) pelo <a download>, como o DXF salva texto. Devolve a frase de status em português.
 */
export function savePdf(filename: string, bytes: Uint8Array): string {
  try {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return `Salvo como ${filename}.`;
  } catch {
    return 'Não foi possível salvar o PDF neste navegador.';
  }
}
