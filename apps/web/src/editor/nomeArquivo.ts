/** Extensão final do nome (ex.: ".pdf", ".json"), só com letras e números. */
const EXTENSAO = /\.[A-Za-z0-9]+$/;

/**
 * Nome de arquivo seguro para o download: sem acento, espaço e demais caracteres viram "-", e sobram só
 * [A-Za-z0-9._-]. Com "é" no nome o navegador ignora o `download` e salva como "download". A extensão é
 * preservada; sem nome-base utilizável o nome cai em "projeto".
 */
export function safeFilename(name: string): string {
  const limpo = name.trim();
  const ext = EXTENSAO.exec(limpo)?.[0] ?? '';
  const corpo = ext ? limpo.slice(0, -ext.length) : limpo;
  const base = corpo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return (base || 'projeto') + ext;
}
