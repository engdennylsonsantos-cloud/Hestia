import { describe, expect, it } from 'vitest';
import { operands } from './__fixtures__/sweepLoop.ts';
import { type MultiPolygon } from './polygon.ts';
import { type Vec2 } from './vec.ts';

/**
 * Regressão do defeito do sweep line do polygon-clipping num caso real do motor de paredes.
 *
 * O dump (`hestia-dump.json (arquivo local, fora do repositório)`) foi gravado da chamada exata que estourava: `a` (dois anéis,
 * 8 pontos) menos 33 polígonos (`bs`, 900 pontos). Com o snap padrão de 1e-7 a chamada entra em laço e só lança
 * depois de ~1e6 segmentos de sweep line (~30 s) — por isso o fixture é a única forma rápida de reproduzir.
 *
 * O fixture é um módulo TS (`__fixtures__/sweepLoop.ts`), não o .json original: o repositório não tem @types/node
 * (um `readFileSync` no teste não passa no typecheck) e `import ... from './sweep-loop.json'` daria ao typecheck um
 * tipo literal gigante para inferir. Os números do módulo saem de `JSON.stringify` do dump, sem perda decimal.
 */

interface GeoEnv {
  process: { env: Record<string, string | undefined> };
}

/**
 * Limites do polygon-clipping baixados para o teste terminar em ms. Ele lê estas variáveis **uma única vez, no
 * import do módulo** (node_modules/polygon-clipping/dist/polygon-clipping.cjs.js:1678), por isso o import de
 * `./index.ts` é dinâmico e vem depois destas linhas (um import estático seria içado e leria o ambiente antes).
 * Os 3000 segmentos bastam para o caso real: a tentativa condenada estoura em milissegundos em vez de 30 s, e o
 * resultado correto vem do plano B (Clipper) de `difference`.
 */
const env = (globalThis as unknown as GeoEnv).process.env;
env.POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS = '3000';
env.POLYGON_CLIPPING_MAX_QUEUE_SIZE = '3000';

const { differenceClipper, multiArea } = await import('./index.ts');

type Par = [number, number];
type PcMulti = Par[][][];

/** `[a, ...bs]` do dump, já tipado como MultiPolygon pelo módulo do fixture. */
const [a, ...bs] = operands;

/**
 * Área de `difference(a, ...bs)` com o cap ligado, ou seja, o resultado do plano B (Clipper), que é quem responde
 * quando o polygon-clipping desiste. Medida neste fixture: 0,002319941982005247 m² (3 polígonos).
 */
const AREA_REF = 0.002319941982005247;

/** polygon-clipping fica fora do import estático de propósito: o env acima tem de valer antes dele. */
const polygonClipping = (
  (await import('polygon-clipping')) as unknown as { default: { difference: (geom: PcMulti, ...rest: PcMulti[]) => PcMulti } }
).default;

/** Operando no formato do polygon-clipping, com os vértices encaixados na grade `1 / g` e anéis curtos fora. */
function snapMulti(m: MultiPolygon, g: number): PcMulti {
  return m
    .map((p) =>
      p.filter((r) => r.length >= 3).map((r): Par[] => r.map((v): Par => [Math.round(v.x * g) / g, Math.round(v.y * g) / g])),
    )
    .filter((p) => p.length > 0);
}

describe('sweep line do polygon-clipping', () => {
  it('o caso real do motor resolve sem travar o sweep line', () => {
    // O fixture é a chamada de `clipReturn` (retorno de acabamento menos as paredes pintadas): o motor agora a faz
    // direto pelo Clipper (`differenceClipper`), então este teste mede esse caminho.
    const t0 = performance.now();
    const out = differenceClipper(a!, ...bs);
    const wallMs = performance.now() - t0;

    // Medido no dump: ~30 s com o cap padrão de 1e6 segmentos; com 3000, a tentativa condenada morre em ms.
    console.log(`diferença do caso real: ${out.length} polígonos, ${multiArea(out)} m², ${wallMs.toFixed(1)} ms`);

    expect(out.length, 'diferença vazia: o resultado do motor se perdeu').toBeGreaterThan(0);
    const area = multiArea(out);
    expect(Number.isFinite(area), `área não finita: ${area}`).toBe(true);
    expect(area).toBeCloseTo(AREA_REF, 6);
    expect(wallMs, `parede de ${wallMs.toFixed(1)} ms`).toBeLessThan(1000);

    // Nenhum vértice pode escapar da caixa de `a` inflada de 1e-3 (o Clipper arredonda a 1 µm).
    const pts = a!.flatMap((p) => p.flatMap((r) => r));
    const minX = Math.min(...pts.map((v) => v.x)) - 1e-3;
    const maxX = Math.max(...pts.map((v) => v.x)) + 1e-3;
    const minY = Math.min(...pts.map((v) => v.y)) - 1e-3;
    const maxY = Math.max(...pts.map((v) => v.y)) + 1e-3;
    const fora = out
      .flatMap((p) => p.flatMap((r) => r))
      .filter((v: Vec2) => v.x < minX || v.x > maxX || v.y < minY || v.y > maxY);
    expect(fora, `vértices fora da caixa de a: ${JSON.stringify(fora.slice(0, 3))}`).toEqual([]);
  });

  it('diagnóstico das grades de snap', () => {
    // Só diagnóstico (sem asserção de sucesso): mostra em que grades o sweep line ainda estoura. A ÚNICA
    // asserção é de tempo — o cap de 3000 segmentos garante que toda tentativa termina rápido.
    for (const g of [1e6, 1e7, 1e8, 1e9, 1e12]) {
      const [head, ...rest] = [a!, ...bs].map((m) => snapMulti(m, g));
      const t0 = performance.now();
      let erro: Error | undefined;
      try {
        polygonClipping.difference(head!, ...rest);
      } catch (e) {
        erro = e as Error;
      }
      const ms = performance.now() - t0;
      const detalhe = erro ? `estoura (${erro.message})` : 'passa';
      console.log(`grade 1e${Math.log10(1 / g)}: ${detalhe} em ${ms.toFixed(1)} ms`);
      expect(ms, `grade ${g}: ${ms.toFixed(1)} ms`).toBeLessThan(2000);
    }
  });

  // Guarda do defeito: enquanto o sweep line estourar com o snap padrão de 1e-7 (1e7), este corpo lança e o
  // `it.fails` registra a falha esperada. Quando a correção entrar, a chamada passa, o corpo não lança e este
  // teste falha DE PROPÓSITO — sinal para removê-lo (ou convertê-lo num `it` que espera sucesso).
  it.fails('guarda do defeito: com o snap padrão de 1e-7 o polygon-clipping ainda estoura', () => {
    // 1e7 é o SNAP de boolean.ts: 1e-7 m (0,1 µm).
    const [head, ...rest] = [a!, ...bs].map((m) => snapMulti(m, 1e7));
    let erro: Error | undefined;
    try {
      polygonClipping.difference(head!, ...rest);
    } catch (e) {
      erro = e as Error;
    }
    // Mensagem exata do dump. Se o polygon-clipping mudar o texto, a asserção falha aqui (o `it.fails` fica
    // verde de qualquer jeito): é diagnóstico, não passaporte.
    expect(erro, 'sem erro: o defeito sumiu, remova ou converta este teste').toBeInstanceOf(Error);
    expect(erro!.message).toContain('Infinite loop when passing sweep line over endpoints');
    // `it.fails` só fica verde se o corpo lançar: reafirmamos o sintoma conhecido.
    throw erro!;
  });
});
