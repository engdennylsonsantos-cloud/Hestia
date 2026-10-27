// Cache persistente de geometria por projeto (onda 6, frente de desempenho).
// Guarda o resultado calculado de cada nível (só listas serializáveis), por projeto, com teto de bytes e política LRU.
// A persistência é o IndexedDB quando existe, com reserva em memória; sem IndexedDB, fica só em memória. Toda leitura e
// escrita tolera falha (try/catch): o cache acelera, nunca é a fonte da verdade. Na dúvida, a resposta é "não achei" e o
// chamador calcula de novo. Não ligado ao controller: o ponto de integração está no relatório da frente.

/** Armazenamento de textos por chave: a camada de persistência (IndexedDB ou memória). */
export interface ArmazenamentoGeometria {
  ler(chave: string): Promise<string | null>;
  gravar(chave: string, texto: string): Promise<boolean>;
  apagar(chave: string): Promise<void>;
  /** Lê várias chaves de uma vez (o IndexedDB faz numa transação). Opcional: sem ela, o cache lê uma a uma. */
  lerVarios?(chaves: readonly string[]): Promise<(string | null)[]>;
}

/** Armazenamento só em memória (Map). Reserva do IndexedDB e base do teste. */
export function criarArmazenamentoMemoria(): ArmazenamentoGeometria {
  const mapa = new Map<string, string>();
  return {
    async ler(chave) {
      return mapa.get(chave) ?? null;
    },
    async lerVarios(chaves) {
      return chaves.map((c) => mapa.get(c) ?? null);
    },
    async gravar(chave, texto) {
      mapa.set(chave, texto);
      return true;
    },
    async apagar(chave) {
      mapa.delete(chave);
    },
  };
}

/**
 * Armazenamento no IndexedDB. Se o IndexedDB não existir ou falhar (janela privada, dados bloqueados), passa a usar a
 * reserva em memória a partir da primeira falha: a leitura de uma chave gravada antes da falha dá "não achei".
 */
export function criarArmazenamentoIndexedDB(nome = 'hestia-geometria', loja = 'niveis'): ArmazenamentoGeometria {
  const reserva = criarArmazenamentoMemoria();
  let banco: Promise<IDBDatabase> | null = null;
  let quebrou = false;
  const abrir = (): Promise<IDBDatabase> => {
    banco ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(nome, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(loja);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return banco;
  };
  /** Roda uma operação numa transação da loja e devolve o resultado do pedido. */
  const transacao = async <T>(modo: IDBTransactionMode, operacao: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await abrir();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(loja, modo);
      const req = operacao(tx.objectStore(loja));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  const quebrar = (): void => {
    quebrou = true;
    banco = null;
  };
  return {
    async ler(chave) {
      if (quebrou) return reserva.ler(chave);
      try {
        const valor = await transacao('readonly', (st) => st.get(chave));
        return typeof valor === 'string' ? valor : null;
      } catch {
        quebrar();
        return null;
      }
    },
    async lerVarios(chaves) {
      if (quebrou) return reserva.lerVarios!(chaves);
      try {
        const db = await abrir();
        return await new Promise<(string | null)[]>((resolve, reject) => {
          const tx = db.transaction(loja, 'readonly');
          const st = tx.objectStore(loja);
          const pedidos = chaves.map((c) => st.get(c));
          tx.oncomplete = () => resolve(pedidos.map((r) => (typeof r.result === 'string' ? r.result : null)));
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        });
      } catch {
        quebrar();
        return reserva.lerVarios!(chaves);
      }
    },
    async gravar(chave, texto) {
      if (quebrou) return reserva.gravar(chave, texto);
      try {
        await transacao('readwrite', (st) => st.put(texto, chave));
        return true;
      } catch {
        quebrar();
        return reserva.gravar(chave, texto);
      }
    },
    async apagar(chave) {
      if (quebrou) return reserva.apagar(chave);
      try {
        await transacao('readwrite', (st) => st.delete(chave));
      } catch {
        quebrar();
        await reserva.apagar(chave);
      }
    },
  };
}

/** Escolhe o IndexedDB quando o ambiente tem um; senão, a memória. Nunca lança. */
export function criarArmazenamentoPersistente(): ArmazenamentoGeometria {
  try {
    if (typeof indexedDB !== 'undefined' && indexedDB) return criarArmazenamentoIndexedDB();
  } catch {
    /* ambiente sem IndexedDB utilizável: cai na memória */
  }
  return criarArmazenamentoMemoria();
}

/** Hash FNV-1a de 64 bits (duas passadas de 32 bits com sementes distintas), com o tamanho do texto na frente. */
export function hashDoConteudo(texto: string): string {
  const fnv = (semente: number): number => {
    let h = semente >>> 0;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };
  const a = fnv(0x811c9dc5).toString(16).padStart(8, '0');
  const b = fnv(0x2f8a1d3b).toString(16).padStart(8, '0');
  return `${texto.length.toString(36)}-${a}${b}`;
}

/** Chave de uma lista de um nível dentro de um projeto (JSON evita colisão com ids que contêm separadores). */
export function chaveDaLista(chaveProjeto: string, nivelId: string, lista: string): string {
  return JSON.stringify([chaveProjeto, nivelId, lista]);
}

const PROFUNDIDADE_MAXIMA = 64;

/**
 * Verdadeiro se o valor sobrevive a JSON sem perda relevante: objetos planos, arrays, texto, booleanos e números
 * finitos, sem funções, símbolos, undefined, Map, Set, Date, instâncias de classe nem ciclos. Só esses valores entram no
 * cache. Ressalva: JSON troca -0 por 0. Nenhuma conta de geometria muda com isso (são iguais em comparações e somas),
 * mas a igualdade estrita de Object.is distingue os dois; por isso o teste compara depois de uma ida e volta por JSON.
 */
export function ehSerializavel(valor: unknown, profundidade = 0): boolean {
  if (profundidade > PROFUNDIDADE_MAXIMA) return false;
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return true;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor !== 'object') return false;
  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) if (!ehSerializavel(valor[i], profundidade + 1)) return false;
    return true;
  }
  const proto = Object.getPrototypeOf(valor);
  if (proto !== Object.prototype && proto !== null) return false;
  for (const v of Object.values(valor as Record<string, unknown>)) if (!ehSerializavel(v, profundidade + 1)) return false;
  return true;
}

/** Bytes de um texto em UTF-8 (ou, sem TextEncoder, duas vezes o comprimento em UTF-16). */
export function bytesDe(texto: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(texto).length : texto.length * 2;
}

interface EntradaIndice {
  bytes: number;
  uso: number;
}

/**
 * Índice LRU com teto de bytes. Não guarda valores, só tamanho e ordem de uso. `uso` é um contador monotônico (não o
 * relógio), para a ordem ser determinística e sobreviver a recarregamentos.
 */
export class IndiceLru {
  private readonly entradas = new Map<string, EntradaIndice>();
  private total = 0;
  private relogio = 0;

  constructor(readonly teto: number) {}

  get bytes(): number {
    return this.total;
  }

  get quantidade(): number {
    return this.entradas.size;
  }

  has(chave: string): boolean {
    return this.entradas.has(chave);
  }

  /** Marca a chave como usada agora (sobe para o topo da ordem de uso). */
  tocar(chave: string): void {
    const e = this.entradas.get(chave);
    if (e) e.uso = ++this.relogio;
  }

  /**
   * Registra (ou troca) uma entrada e devolve as chaves despejadas para caber no teto, da menos usada. Null se a entrada
   * sozinha passa do teto (não entra e nada é despejado).
   */
  registrar(chave: string, bytes: number): string[] | null {
    if (bytes > this.teto) return null;
    const antiga = this.entradas.get(chave);
    if (antiga) {
      this.total -= antiga.bytes;
      this.entradas.delete(chave);
    }
    this.entradas.set(chave, { bytes, uso: ++this.relogio });
    this.total += bytes;
    return this.despejar();
  }

  remover(chave: string): boolean {
    const e = this.entradas.get(chave);
    if (!e) return false;
    this.total -= e.bytes;
    this.entradas.delete(chave);
    return true;
  }

  /** Chaves em ordem de uso, da menos recente para a mais recente. */
  chavesPorUso(): string[] {
    return [...this.entradas.entries()].sort((a, b) => a[1].uso - b[1].uso).map(([k]) => k);
  }

  exportar(): Record<string, EntradaIndice> {
    return Object.fromEntries(this.entradas);
  }

  /** Recarrega um índice exportado. Entradas malformadas são ignoradas. */
  importar(dados: unknown): void {
    if (!dados || typeof dados !== 'object') return;
    this.entradas.clear();
    this.total = 0;
    this.relogio = 0;
    for (const [chave, v] of Object.entries(dados as Record<string, unknown>)) {
      const e = v as Partial<EntradaIndice> | null;
      if (!e || typeof e.bytes !== 'number' || typeof e.uso !== 'number' || !Number.isFinite(e.bytes) || e.bytes < 0) continue;
      this.entradas.set(chave, { bytes: e.bytes, uso: e.uso });
      this.total += e.bytes;
      this.relogio = Math.max(this.relogio, e.uso);
    }
  }

  private despejar(): string[] {
    const removidas: string[] = [];
    for (const chave of this.chavesPorUso()) {
      if (this.total <= this.teto) break;
      this.remover(chave);
      removidas.push(chave);
    }
    return removidas;
  }
}

const CHAVE_INDICE = '__indice__';

export interface OpcoesCacheGeometria {
  /** Teto total do cache, em bytes de texto serializado. */
  tetoBytes: number;
  /** Armazenamento de persistência. Padrão: IndexedDB quando existe, senão memória. */
  armazenamento?: ArmazenamentoGeometria;
}

/** Cache de resultados por (projeto, nível, lista), com LRU e teto de bytes. Leituras e escritas nunca lançam. */
export class CacheGeometria {
  private readonly indice: IndiceLru;
  private readonly armazenamento: ArmazenamentoGeometria;
  private carregando: Promise<void> | null = null;
  private indiceLido = false;

  constructor(opcoes: OpcoesCacheGeometria) {
    this.indice = new IndiceLru(opcoes.tetoBytes);
    this.armazenamento = opcoes.armazenamento ?? criarArmazenamentoPersistente();
  }

  get bytesOcupados(): number {
    return this.indice.bytes;
  }

  get quantidade(): number {
    return this.indice.quantidade;
  }

  /** Verdadeiro depois que o índice persistido foi lido: as leituras seguintes não esperam a abertura do armazenamento. */
  get carregado(): boolean {
    return this.indiceLido;
  }

  /** Lê o índice agora (a abertura pode chamar antes, para a primeira leitura não esperar). Nunca lança. */
  preparar(): Promise<void> {
    return this.carregar();
  }

  /** Lê o índice persistido uma vez. Índice ilegível começa vazio. */
  private carregar(): Promise<void> {
    this.carregando ??= (async () => {
      try {
        const texto = await this.armazenamento.ler(CHAVE_INDICE);
        if (texto) this.indice.importar(JSON.parse(texto));
      } catch {
        /* índice ilegível ou armazenamento indisponível: começa vazio */
      } finally {
        this.indiceLido = true;
      }
    })();
    return this.carregando;
  }

  private async salvarIndice(): Promise<void> {
    try {
      await this.armazenamento.gravar(CHAVE_INDICE, JSON.stringify(this.indice.exportar()));
    } catch {
      /* o índice é reconstruído pelas próximas gravações */
    }
  }

  /** Valor guardado, ou `{ achou: false }`. Um valor sumido do armazenamento sai do índice. */
  async obter(chave: string): Promise<{ achou: true; valor: unknown } | { achou: false }> {
    await this.carregar();
    try {
      const texto = await this.armazenamento.ler(chave);
      if (texto === null) {
        this.indice.remover(chave);
        return { achou: false };
      }
      const valor: unknown = JSON.parse(texto);
      this.indice.tocar(chave);
      return { achou: true, valor };
    } catch {
      // Texto corrompido ou armazenamento falhou na leitura: a entrada sai e o chamador calcula de novo.
      await this.descartar(chave);
      return { achou: false };
    }
  }

  /**
   * Versão de `obter` para várias chaves: uma transação no IndexedDB em vez de uma por chave (a abertura lê todos os níveis
   * de uma vez). Uma leitura que falha vale "não achei"; a chave sai do índice.
   */
  async obterVarios(chaves: readonly string[]): Promise<({ achou: true; valor: unknown } | { achou: false })[]> {
    await this.carregar();
    let textos: (string | null)[];
    try {
      textos = this.armazenamento.lerVarios
        ? await this.armazenamento.lerVarios(chaves)
        : await Promise.all(chaves.map((c) => this.armazenamento.ler(c)));
    } catch {
      textos = chaves.map(() => null);
    }
    const resultados: ({ achou: true; valor: unknown } | { achou: false })[] = [];
    chaves.forEach((chave, i) => {
      const texto = textos[i];
      if (texto === null || texto === undefined) {
        this.indice.remover(chave);
        resultados.push({ achou: false });
        return;
      }
      try {
        const valor: unknown = JSON.parse(texto);
        this.indice.tocar(chave);
        resultados.push({ achou: true, valor });
      } catch {
        void this.descartar(chave);
        resultados.push({ achou: false });
      }
    });
    return resultados;
  }

  /**
   * Guarda um valor. Devolve false se o valor não é serializável sem perda, se passa do teto ou se a gravação falhou.
   * Despeja as entradas menos usadas para caber.
   */
  async gravar(chave: string, valor: unknown): Promise<boolean> {
    await this.carregar();
    if (!ehSerializavel(valor)) return false;
    const texto = JSON.stringify(valor);
    const despejadas = this.indice.registrar(chave, bytesDe(texto));
    if (despejadas === null) {
      // Não cabe nem sozinho: a versão antiga desta chave sairia do cache, senão seria devolvida no lugar da nova.
      await this.descartar(chave);
      return false;
    }
    for (const d of despejadas) {
      try {
        await this.armazenamento.apagar(d);
      } catch {
        /* a chave já saiu do índice; uma sobra no armazenamento não afeta o teto */
      }
    }
    try {
      const ok = await this.armazenamento.gravar(chave, texto);
      if (!ok) {
        await this.descartar(chave);
        return false;
      }
    } catch {
      await this.descartar(chave);
      return false;
    }
    await this.salvarIndice();
    return true;
  }

  /** Tira uma chave do índice e do armazenamento (sem lançar). */
  private async descartar(chave: string): Promise<void> {
    this.indice.remover(chave);
    try {
      await this.armazenamento.apagar(chave);
    } catch {
      /* sem índice, a chave não é mais devolvida: uma sobra no armazenamento é inofensiva */
    }
  }

  /**
   * Devolve o valor guardado para a chave, ou calcula, guarda (se couber) e devolve. Em acerto, o valor é a cópia lida do
   * armazenamento, que é igual ao cálculo direto (só listas serializáveis chegam aqui).
   */
  async obterOuCalcular<T>(chave: string, calcular: () => T): Promise<T> {
    const achado = await this.obter(chave);
    if (achado.achou) return achado.valor as T;
    const valor = calcular();
    await this.gravar(chave, valor).catch(() => false);
    return valor;
  }

  /** Esvazia o cache e o índice. */
  async limpar(): Promise<void> {
    await this.carregar();
    for (const chave of this.indice.chavesPorUso()) {
      try {
        await this.armazenamento.apagar(chave);
      } catch {
        /* segue apagando as outras */
      }
      this.indice.remover(chave);
    }
    await this.salvarIndice();
  }
}
