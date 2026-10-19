type Downloads = { save(r: { filename: string; data: string }): Promise<unknown> };
type ClaudeHost = { use?: (name: string) => Promise<Downloads | null> };

/** Baixa o texto pelo <a download>. Devolve false se o navegador não permitir. */
function downloadText(filename: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

const isDeclined = (e: unknown): boolean => typeof e === 'object' && e !== null && 'code' in e && e.code === 'declined';

/**
 * Entrega um arquivo de texto ao usuário e devolve uma frase de status em português.
 * Ordem: capacidade `downloads` do artefato (com confirmação), download direto, área de transferência.
 */
export async function saveText(filename: string, text: string): Promise<string> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  if (host?.use) {
    try {
      const dl = await host.use('downloads');
      if (dl) {
        await dl.save({ filename, data: text });
        return `Salvo como ${filename}.`;
      }
    } catch (e) {
      if (isDeclined(e)) return 'Exportação cancelada. Nenhum arquivo foi salvo.';
      // Qualquer outra falha: segue para o download direto.
    }
  }
  if (downloadText(filename, text)) return `Arquivo ${filename} gerado.`;
  try {
    await navigator.clipboard.writeText(text);
    return 'Download indisponível: o conteúdo foi copiado para a área de transferência.';
  } catch {
    return 'Não foi possível exportar o arquivo.';
  }
}
