import { describe, expect, it, vi } from 'vitest';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { projetoComPavimentos } from '@hestia/engine/src/worker/fixturePavimentos.ts';
import type { Id, Project } from '@hestia/model';
import { CacheGeometria, criarArmazenamentoMemoria, ehSerializavel, type ArmazenamentoGeometria } from './geometryCache.ts';
import { abrirComCache, abrirNiveisComCache, chaveDoNivel, chaveDoProjeto, INTERVALO_GRAVACAO_MS, TETO_GEOMETRIA_BYTES, type PortasAbertura } from './geometriaAbertura.ts';

/** Espera o fim das gravações em segundo plano (o cache grava depois da abertura). */
async function esperar(condicao: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !condicao(); i++) await new Promise((r) => setTimeout(r, 1));
}

/** Portas de uma abertura simulada: `prontos` é o que a resolução já calculou em segundo plano. */
function simular(cache: CacheGeometria, projetoAtual: () => Project, prontos: Map<Id, ResolvedLevel>) {
  const semeados: Id[] = [];
  const lotes: Array<ReadonlyArray<readonly [Id, ResolvedLevel]>> = [];
  const portas: PortasAbertura = {
    cache,
    atual: projetoAtual,
    lerNivel: (id) => prontos.get(id) ?? null,
    pendente: (id) => !prontos.has(id),
    semear: (id, valor) => {
      semeados.push(id);
      prontos.set(id, valor);
    },
    semearVarios: (itens) => {
      lotes.push(itens);
      for (const [id, valor] of itens) {
        semeados.push(id);
        prontos.set(id, valor);
      }
      return itens.length;
    },
    agendar: (tarefa, ms) => setTimeout(tarefa, ms),
  };
  return { portas, semeados, lotes };
}

/** Resultado direto do engine para cada nível, como a resolução o entregaria (sem o cache). */
function calculoDireto(p: Project): Map<Id, ResolvedLevel> {
  return new Map(p.levels.map((l) => [l.id, resolveLevel(p, l.id)] as const));
}

/** O que sai do cache ao voltar do armazenamento: a ida e volta por JSON, para comparar com igualdade. */
const ida = (v: ResolvedLevel): ResolvedLevel => JSON.parse(JSON.stringify(v)) as ResolvedLevel;

describe('abrirComCache: o cache devolve a geometria igual ao cálculo direto', () => {
  for (const pavimentos of [1, 20]) {
    it(`${pavimentos} nível(is): a primeira abertura grava; a segunda restaura, e cada nível é igual ao cálculo direto`, async () => {
      const p = projetoComPavimentos(pavimentos);
      const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });

      // Primeira abertura: nada no cache; os níveis ficam prontos e o cache grava na abertura.
      const primeira = simular(cache, () => p, calculoDireto(p));
      await abrirComCache(primeira.portas, p);
      expect(primeira.semeados).toEqual([]);
      await esperar(() => cache.quantidade === pavimentos);
      expect(cache.quantidade).toBe(pavimentos);

      // Segunda abertura (mesmo conteúdo): restaura do cache, sem nada pronto de antemão.
      const segunda = simular(cache, () => p, new Map());
      await abrirComCache(segunda.portas, p);
      expect(segunda.semeados).toEqual(p.levels.map((l) => l.id));
      const direto = calculoDireto(p);
      for (const l of p.levels) {
        const restaurado = segunda.portas.lerNivel(l.id);
        expect(restaurado).toEqual(ida(direto.get(l.id)!));
      }
    });
  }

  it('o resultado de resolveLevel é serializável sem perda (senão o cache nunca guardaria nada)', () => {
    const p = projetoComPavimentos(1);
    for (const nivel of calculoDireto(p).values()) expect(ehSerializavel(nivel)).toBe(true);
  });

  it('projeto com outro conteúdo tem outra chave: o cache não devolve a geometria antiga', async () => {
    const p = projetoComPavimentos(2);
    const outro = projetoComPavimentos(3);
    expect(chaveDoProjeto(outro)).not.toBe(chaveDoProjeto(p));

    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
    const gravado = simular(cache, () => p, calculoDireto(p));
    await abrirComCache(gravado.portas, p);
    await esperar(() => cache.quantidade === 2);

    const aberto = simular(cache, () => outro, new Map());
    await abrirComCache(aberto.portas, outro);
    expect(aberto.semeados).toEqual([]);
  });

  it('o projeto mudou antes da restauração: nada é semeado (a abertura não age sobre um projeto que saiu)', async () => {
    const p = projetoComPavimentos(2);
    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
    const gravado = simular(cache, () => p, calculoDireto(p));
    await abrirComCache(gravado.portas, p);
    await esperar(() => cache.quantidade === 2);

    const depois = projetoComPavimentos(2);
    const aberto = simular(cache, () => depois, new Map());
    await abrirComCache(aberto.portas, p);
    expect(aberto.semeados).toEqual([]);
  });

  it('armazenamento que falha em tudo: a abertura não lança e segue pelo cálculo (fallback)', async () => {
    const quebrado: ArmazenamentoGeometria = {
      ler: async () => {
        throw new Error('disco indisponível');
      },
      gravar: async () => {
        throw new Error('disco indisponível');
      },
      apagar: async () => {
        throw new Error('disco indisponível');
      },
    };
    const p = projetoComPavimentos(3);
    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: quebrado });
    const aberto = simular(cache, () => p, calculoDireto(p));
    await expect(abrirComCache(aberto.portas, p)).resolves.toEqual(p.levels.map((l) => l.id));
    expect(aberto.semeados).toEqual([]);
  });

  it('a abertura devolve só os níveis que faltam, e restaura o resto num lote só', async () => {
    const p = projetoComPavimentos(3);
    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
    // Grava só o nível do meio.
    const meio = p.levels[1]!.id;
    await cache.gravar(chaveDoNivel(chaveDoProjeto(p), meio), resolveLevel(p, meio));

    const aberto = simular(cache, () => p, new Map());
    const faltam = await abrirComCache(aberto.portas, p);
    expect(faltam).toEqual([p.levels[0]!.id, p.levels[2]!.id]);
    expect(aberto.semeados).toEqual([meio]);
    expect(aberto.lotes).toHaveLength(1);
    expect(aberto.lotes[0]).toEqual([[meio, ida(resolveLevel(p, meio))]]);
  });

  it('grava cada nível assim que ele fica pronto, sem esperar os outros', async () => {
    const p = projetoComPavimentos(2);
    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
    const [primeiro, segundo] = p.levels.map((l) => l.id) as [Id, Id];
    const prontos = new Map<Id, ResolvedLevel>([[primeiro, resolveLevel(p, primeiro)]]);
    const aberto = simular(cache, () => p, prontos);
    expect(await abrirComCache(aberto.portas, p)).toEqual([primeiro, segundo]);

    // O primeiro nível já está pronto: entra no cache sem esperar o segundo.
    await esperar(() => cache.quantidade === 1);
    expect(cache.quantidade).toBe(1);
    // O segundo ainda não ficou pronto: nada novo é gravado.
    await new Promise((r) => setTimeout(r, INTERVALO_GRAVACAO_MS * 2));
    expect(cache.quantidade).toBe(1);

    // Quando ele fica pronto, entra sozinho.
    prontos.set(segundo, resolveLevel(p, segundo));
    await esperar(() => cache.quantidade === 2);
    expect(cache.quantidade).toBe(2);
  });
});

describe('abrirNiveisComCache: cache quente resolve menos, cache frio resolve igual', () => {
  it('cache carregado com o projeto: semeia os níveis, resolve só os que faltam e a geometria é a do cálculo direto', async () => {
    const p = projetoComPavimentos(3);
    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
    const direto = calculoDireto(p);
    for (const l of p.levels) await cache.gravar(chaveDoNivel(chaveDoProjeto(p), l.id), direto.get(l.id)!);
    await cache.preparar();

    const aberto = simular(cache, () => p, new Map());
    const resolvidos: Id[] = [];
    abrirNiveisComCache(aberto.portas, p, p.levels.map((l) => l.id), (id) => {
      resolvidos.push(id);
      aberto.portas.semear(id, direto.get(id)!);
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(resolvidos).toEqual([]);
    expect(aberto.semeados).toEqual(p.levels.map((l) => l.id));
    for (const l of p.levels) expect(aberto.portas.lerNivel(l.id)).toEqual(ida(direto.get(l.id)!));
  });

  it('cache carregado e vazio: resolve o visível e o vizinho na hora e só grava depois das pinturas', async () => {
    vi.useFakeTimers();
    try {
      const p = projetoComPavimentos(2);
      const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
      await cache.preparar();
      expect(cache.quantidade).toBe(0);
      const aberto = simular(cache, () => p, calculoDireto(p));
      const resolvidos: Id[] = [];
      abrirNiveisComCache(aberto.portas, p, p.levels.map((l) => l.id), (id) => resolvidos.push(id));
      expect(resolvidos).toEqual(p.levels.map((l) => l.id));
      // Nada de cache antes das duas pinturas (a chave do projeto nem foi calculada).
      expect(cache.quantidade).toBe(0);
      vi.advanceTimersByTime(31);
      expect(cache.quantidade).toBe(0);
      // Depois das pinturas, a gravação começa e escreve os níveis prontos.
      vi.advanceTimersByTime(1);
      await vi.waitFor(() => expect(cache.quantidade).toBe(2));
    } finally {
      vi.useRealTimers();
    }
  });

  it('índice ainda não lido: resolve na hora e ainda lê o cache para os outros níveis', async () => {
    const arm = criarArmazenamentoMemoria();
    const p = projetoComPavimentos(3);
    const direto = calculoDireto(p);
    const terceiro = p.levels[2]!.id;
    const gravador = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: arm });
    await gravador.gravar(chaveDoNivel(chaveDoProjeto(p), terceiro), direto.get(terceiro)!);

    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: arm });
    expect(cache.carregado).toBe(false);
    const aberto = simular(cache, () => p, new Map());
    const resolvidos: Id[] = [];
    abrirNiveisComCache(aberto.portas, p, p.levels.slice(0, 2).map((l) => l.id), (id) => resolvidos.push(id));
    expect(resolvidos).toEqual(p.levels.slice(0, 2).map((l) => l.id));
    await esperar(() => aberto.semeados.length === 1);
    expect(aberto.semeados).toEqual([terceiro]);
  });

  it('projeto trocado durante a restauração: não resolve nem semeia nada no projeto novo', async () => {
    const p = projetoComPavimentos(2);
    const outro = projetoComPavimentos(3);
    const cache = new CacheGeometria({ tetoBytes: TETO_GEOMETRIA_BYTES, armazenamento: criarArmazenamentoMemoria() });
    const direto = calculoDireto(p);
    for (const l of p.levels) await cache.gravar(chaveDoNivel(chaveDoProjeto(p), l.id), direto.get(l.id)!);
    await cache.preparar();

    let atual: Project = p;
    const aberto = simular(cache, () => atual, new Map());
    const resolvidos: Id[] = [];
    abrirNiveisComCache(aberto.portas, p, p.levels.map((l) => l.id), (id) => resolvidos.push(id));
    atual = outro; // a abertura seguinte troca o projeto antes da leitura terminar
    await new Promise((r) => setTimeout(r, 10));
    expect(resolvidos).toEqual([]);
    expect(aberto.semeados).toEqual([]);
  });
});
