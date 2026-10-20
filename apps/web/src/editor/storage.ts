/** Leitura e escrita no localStorage que nunca lançam: navegador sem armazenamento segue funcionando. */
export function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* armazenamento indisponível: o app segue funcionando sem autosave */
  }
}
