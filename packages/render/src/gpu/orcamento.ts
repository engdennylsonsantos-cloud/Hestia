/**
 * Orçamento de VRAM da cena 3D (Fase 2.1). O navegador não informa o consumo real (ver `gpu-capacidade.md`), então o
 * orçamento é contábil: cada lote de GPU registra os bytes das suas arrays de capacidade e o gestor soma. O teto padrão
 * fica bem abaixo dos 2 GB do plano e serve de alarme para reallocação/regressão, não de limite de hardware.
 *
 * A residência (o que fica montado em cada nível) continua no `CacheMalhas` por nível, que já é LRU em bytes; aqui só se
 * mede o que foi para a GPU, inclusive os buffers globais que atravessam vários níveis.
 */
export const TETO_VRAM_PADRAO = 256 * 2 ** 20;

/** Contabilidade por chave (categoria/material ou linha). */
export class OrcamentoVram {
  private por = new Map<string, number>();

  constructor(readonly teto: number = TETO_VRAM_PADRAO) {}

  /** Registra o tamanho atual da chave (0 remove). */
  definir(chave: string, bytes: number): void {
    if (bytes <= 0) this.por.delete(chave);
    else this.por.set(chave, bytes);
  }

  remover(chave: string): void {
    this.por.delete(chave);
  }

  /** Bytes somados de todas as chaves. */
  get usado(): number {
    let t = 0;
    for (const b of this.por.values()) t += b;
    return t;
  }

  get livre(): number {
    return Math.max(0, this.teto - this.usado);
  }

  get excedido(): boolean {
    return this.usado > this.teto;
  }

  /** Cópia das chaves e dos bytes, para diagnóstico (ordem de inserção). */
  get entradas(): ReadonlyArray<readonly [string, number]> {
    return [...this.por.entries()];
  }

  limpar(): void {
    this.por.clear();
  }
}
