import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeWall } from '@hestia/model';
import {
  CacheGeometria,
  IndiceLru,
  bytesDe,
  chaveDaLista,
  criarArmazenamentoIndexedDB,
  criarArmazenamentoMemoria,
  criarArmazenamentoPersistente,
  ehSerializavel,
  hashDoConteudo,
  type ArmazenamentoGeometria,
} from './geometryCache.ts';

/** Projeto pequeno com duas paredes no térreo: o resultado de resolveLevel é um dado real do engine. */
function projetoComParedes(yFimDaSegunda = 3) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: yFimDaSegunda } }) });
  return s.project;
}

/** Armazenamento que falha em tudo, para provar que o cache não lança. */
function armazenamentoQuebrado(): ArmazenamentoGeometria {
  const erro = () => {
    throw new Error('disco indisponível');
  };
  return {
    ler: async () => erro(),
    gravar: async () => erro(),
    apagar: async () => erro(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Ida e volta por JSON: o que o cache devolve de fato (troca -0 por 0, como o armazenamento). */
const comoOCacheDevolve = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('igualdade: resultado do cache = cálculo direto', () => {
  it('resolveLevel de um nível real volta igual do cache (acerto) e o segundo acesso não recalcula', async () => {
    const p = projetoComParedes();
    const direto = resolveLevel(p, 'lv_0');
    expect(ehSerializavel(direto)).toBe(true);

    const cache = new CacheGeometria({ tetoBytes: 10_000_000, armazenamento: criarArmazenamentoMemoria() });
    const chave = chaveDaLista(hashDoConteudo(JSON.stringify(p)), 'lv_0', 'planta');
    const primeiro = await cache.obterOuCalcular(chave, () => resolveLevel(p, 'lv_0'));
    expect(primeiro).toEqual(direto);

    let chamadas = 0;
    const segundo = await cache.obterOuCalcular(chave, () => {
      chamadas++;
      return resolveLevel(p, 'lv_0');
    });
    expect(chamadas).toBe(0);
    expect(segundo).toEqual(comoOCacheDevolve(direto));
  });

  it('valor não serializável não entra no cache e o cálculo direto é devolvido', async () => {
    const cache = new CacheGeometria({ tetoBytes: 10_000, armazenamento: criarArmazenamentoMemoria() });
    const comMapa = { id: 'x', mapa: new Map([['a', 1]]) };
    const devolvido = await cache.obterOuCalcular('k', () => comMapa);
    expect(devolvido).toBe(comMapa);
    expect(cache.quantidade).toBe(0);
    expect((await cache.obter('k')).achou).toBe(false);
  });
});

describe('ehSerializavel', () => {
  it('aceita objetos planos, arrays, texto, booleanos, números finitos e null', () => {
    expect(ehSerializavel({ a: [1, 'x', true, null, { b: [] }] })).toBe(true);
    expect(ehSerializavel(0)).toBe(true);
    expect(ehSerializavel(Object.create(null))).toBe(true);
  });

  it('recusa Map, Set, Date, função, NaN, undefined, instância de classe e ciclo', () => {
    class Ponto {
      x = 1;
    }
    const ciclo: Record<string, unknown> = {};
    ciclo.eu = ciclo;
    expect(ehSerializavel(new Map())).toBe(false);
    expect(ehSerializavel(new Set([1]))).toBe(false);
    expect(ehSerializavel(new Date(0))).toBe(false);
    expect(ehSerializavel(() => 1)).toBe(false);
    expect(ehSerializavel(Number.NaN)).toBe(false);
    expect(ehSerializavel({ a: undefined })).toBe(false);
    expect(ehSerializavel(new Ponto())).toBe(false);
    expect(ehSerializavel(ciclo)).toBe(false);
  });
});

describe('hash do conteúdo e chave da lista', () => {
  it('é estável para o mesmo texto e diferente para textos diferentes', () => {
    expect(hashDoConteudo('projeto A')).toBe(hashDoConteudo('projeto A'));
    expect(hashDoConteudo('projeto A')).not.toBe(hashDoConteudo('projeto B'));
    expect(hashDoConteudo('ab')).not.toBe(hashDoConteudo('ba'));
  });

  it('separa projeto, nível e lista sem colisão por separadores no id', () => {
    expect(chaveDaLista('p', 'a|b', 'c')).not.toBe(chaveDaLista('p', 'a', 'b|c'));
  });
});

describe('teto de bytes e política LRU', () => {
  it('nunca passa do teto e despeja a entrada menos usada', async () => {
    const pedaco = 'x'.repeat(300);
    const bytes = bytesDe(JSON.stringify(pedaco));
    const cache = new CacheGeometria({ tetoBytes: bytes * 3, armazenamento: criarArmazenamentoMemoria() });
    await cache.gravar('a', pedaco);
    await cache.gravar('b', pedaco);
    await cache.gravar('c', pedaco);
    expect(cache.bytesOcupados).toBeLessThanOrEqual(bytes * 3);
    await cache.gravar('d', pedaco);
    expect(cache.bytesOcupados).toBeLessThanOrEqual(bytes * 3);
    expect(cache.quantidade).toBe(3);
    expect((await cache.obter('a')).achou).toBe(false);
    expect((await cache.obter('d')).achou).toBe(true);
  });

  it('um acesso de leitura torna a entrada recente e a salva do despejo', async () => {
    const pedaco = 'y'.repeat(300);
    const bytes = bytesDe(JSON.stringify(pedaco));
    const cache = new CacheGeometria({ tetoBytes: bytes * 3, armazenamento: criarArmazenamentoMemoria() });
    await cache.gravar('a', pedaco);
    await cache.gravar('b', pedaco);
    await cache.gravar('c', pedaco);
    expect((await cache.obter('a')).achou).toBe(true);
    await cache.gravar('d', pedaco);
    expect((await cache.obter('a')).achou).toBe(true);
    expect((await cache.obter('b')).achou).toBe(false);
  });

  it('valor maior que o teto inteiro não entra e não derruba o que já está lá', async () => {
    const cache = new CacheGeometria({ tetoBytes: 200, armazenamento: criarArmazenamentoMemoria() });
    expect(await cache.gravar('pequeno', 'ok')).toBe(true);
    expect(await cache.gravar('grande', 'z'.repeat(5000))).toBe(false);
    expect((await cache.obter('pequeno')).achou).toBe(true);
    expect(cache.bytesOcupados).toBeLessThanOrEqual(200);
  });

  it('o índice LRU soma e subtrai bytes ao trocar e remover entradas', () => {
    const idx = new IndiceLru(100);
    expect(idx.registrar('a', 40)).toEqual([]);
    expect(idx.registrar('b', 40)).toEqual([]);
    expect(idx.registrar('a', 30)).toEqual([]);
    expect(idx.bytes).toBe(70);
    expect(idx.remover('b')).toBe(true);
    expect(idx.bytes).toBe(30);
    expect(idx.registrar('grande', 101)).toBeNull();
  });
});

describe('persistência e falhas', () => {
  it('uma segunda instância sobre o mesmo armazenamento reaproveita o índice e os valores', async () => {
    const arm = criarArmazenamentoMemoria();
    const primeira = new CacheGeometria({ tetoBytes: 10_000, armazenamento: arm });
    await primeira.gravar('k', { nivel: 'lv_0', n: 3 });
    const segunda = new CacheGeometria({ tetoBytes: 10_000, armazenamento: arm });
    let chamadas = 0;
    const v = await segunda.obterOuCalcular('k', () => {
      chamadas++;
      return { nivel: 'x', n: 0 };
    });
    expect(chamadas).toBe(0);
    expect(v).toEqual({ nivel: 'lv_0', n: 3 });
    expect(segunda.quantidade).toBe(1);
  });

  it('armazenamento que lança não quebra leitura nem cálculo (devolve o cálculo direto)', async () => {
    const cache = new CacheGeometria({ tetoBytes: 10_000, armazenamento: armazenamentoQuebrado() });
    await expect(cache.obterOuCalcular('k', () => ({ ok: 1 }))).resolves.toEqual({ ok: 1 });
    expect((await cache.obter('k')).achou).toBe(false);
    expect(await cache.gravar('k2', { ok: 2 })).toBe(false);
  });

  it('sem IndexedDB, a escolha padrão é a memória e funciona', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const arm = criarArmazenamentoPersistente();
    expect(await arm.gravar('x', '"1"')).toBe(true);
    expect(await arm.ler('x')).toBe('"1"');
  });

  it('IndexedDB que falha ao abrir cai na reserva em memória sem lançar', async () => {
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('modo privado');
      },
    });
    const arm = criarArmazenamentoIndexedDB();
    expect(await arm.ler('x')).toBeNull();
    expect(await arm.gravar('x', 'valor')).toBe(true);
    expect(await arm.ler('x')).toBe('valor');
  });

  it('limpar esvazia o índice e o armazenamento', async () => {
    const arm = criarArmazenamentoMemoria();
    const cache = new CacheGeometria({ tetoBytes: 10_000, armazenamento: arm });
    await cache.gravar('a', [1]);
    await cache.gravar('b', [2]);
    await cache.limpar();
    expect(cache.quantidade).toBe(0);
    expect(cache.bytesOcupados).toBe(0);
    expect(await arm.ler('a')).toBeNull();
  });

  it('valor novo que não cabe no teto tira a versão antiga da mesma chave (não é devolvida)', async () => {
    const arm = criarArmazenamentoMemoria();
    const cache = new CacheGeometria({ tetoBytes: 200, armazenamento: arm });
    expect(await cache.gravar('k', 'antigo')).toBe(true);
    expect(await cache.gravar('k', 'z'.repeat(5000))).toBe(false);
    expect((await cache.obter('k')).achou).toBe(false);
    expect(await arm.ler('k')).toBeNull();
    expect(cache.bytesOcupados).toBe(0);
  });

  it('entrada corrompida no armazenamento sai do cache e o chamador calcula de novo', async () => {
    const arm = criarArmazenamentoMemoria();
    const cache = new CacheGeometria({ tetoBytes: 10_000, armazenamento: arm });
    await cache.gravar('k', { ok: 1 });
    await arm.gravar('k', '{ texto quebrado');
    let chamadas = 0;
    const v = await cache.obterOuCalcular('k', () => {
      chamadas++;
      return { ok: 1 };
    });
    expect(chamadas).toBe(1);
    expect(v).toEqual({ ok: 1 });
    expect(JSON.parse((await arm.ler('k')) ?? 'null')).toEqual({ ok: 1 });
  });

  it('projeto alterado tem outra chave (hash do conteúdo): o cache antigo não serve para o novo', async () => {
    const cache = new CacheGeometria({ tetoBytes: 1_000_000, armazenamento: criarArmazenamentoMemoria() });
    const pAntes = projetoComParedes(3);
    const pDepois = projetoComParedes(5);
    const kAntes = chaveDaLista(hashDoConteudo(JSON.stringify(pAntes)), 'lv_0', 'planta');
    const kDepois = chaveDaLista(hashDoConteudo(JSON.stringify(pDepois)), 'lv_0', 'planta');
    expect(kAntes).not.toBe(kDepois);
    await cache.obterOuCalcular(kAntes, () => resolveLevel(pAntes, 'lv_0'));
    let chamadas = 0;
    const depois = await cache.obterOuCalcular(kDepois, () => {
      chamadas++;
      return resolveLevel(pDepois, 'lv_0');
    });
    expect(chamadas).toBe(1);
    // Erro: o cálculo direto é devolvido tal como foi feito (sem ida e volta por JSON).
    expect(depois).toEqual(resolveLevel(pDepois, 'lv_0'));
    expect(depois).not.toEqual(resolveLevel(pAntes, 'lv_0'));
  });

  it('sob muitas gravações o teto vale o tempo todo e o índice bate com o armazenamento', async () => {
    const arm = criarArmazenamentoMemoria();
    const teto = 4_000;
    const cache = new CacheGeometria({ tetoBytes: teto, armazenamento: arm });
    for (let i = 0; i < 200; i++) {
      await cache.gravar(`k${i}`, { i, pad: 'p'.repeat((i * 37) % 500) });
      expect(cache.bytesOcupados).toBeLessThanOrEqual(teto);
    }
    // Cada chave que sobrou no índice tem valor no armazenamento; as despejadas não têm.
    let presentes = 0;
    for (let i = 0; i < 200; i++) {
      const no = (await arm.ler(`k${i}`)) !== null;
      if (no) presentes++;
    }
    expect(presentes).toBe(cache.quantidade);
  });

  it('o despejo persiste: outra instância sobre o mesmo armazenamento não acha o que foi despejado', async () => {
    const arm = criarArmazenamentoMemoria();
    const pedaco = 'q'.repeat(300);
    const bytes = bytesDe(JSON.stringify(pedaco));
    const primeira = new CacheGeometria({ tetoBytes: bytes * 2, armazenamento: arm });
    await primeira.gravar('a', pedaco);
    await primeira.gravar('b', pedaco);
    await primeira.gravar('c', pedaco);
    const segunda = new CacheGeometria({ tetoBytes: bytes * 2, armazenamento: arm });
    expect((await segunda.obter('a')).achou).toBe(false);
    expect((await segunda.obter('c')).achou).toBe(true);
    expect(segunda.bytesOcupados).toBeLessThanOrEqual(bytes * 2);
  });
});
