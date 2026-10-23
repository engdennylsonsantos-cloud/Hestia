import type { Vec2 } from '@hestia/geom';
import { isWall, type Dimension, type DimensionRef, type Id, type Opening, type Project } from '@hestia/model';

/**
 * Cotas automáticas de planta (inspirado no `generateAutoDimensions` do ArquiFácil): em vez de cotar parede por parede,
 * o gerador monta **camadas** de coordenadas por lado da edificação e emite uma cota por trecho entre coordenadas
 * vizinhas. A ordem das camadas é sempre a mesma, de dentro para fora: **aberturas → paredes → total**. Camadas com a
 * mesma lista de coordenadas são descartadas (o total só aparece quando é diferente das paredes).
 *
 * Cada cota sai com `refs` quando a extremidade vem de uma ponta de parede: a cota acompanha a parede se ela mudar de
 * posição (associativa), como o `witnesses` do ArquiFácil.
 */

/** Tolerância para considerar duas coordenadas iguais (m). */
const MESMA = 0.02;
/** Abaixo disto a cota não vale a pena (m). */
const MIN_TRECHO = 0.01;

export type LadoCota = 'sul' | 'norte' | 'oeste' | 'leste';

export interface AutoCotaOptions {
  /** Lados cotados: os quatro (padrão) ou só o mais próximo do clique. */
  lados?: 'todos' | 'maisProximo';
  /** Ponto do clique na planta, usado por `lados: 'maisProximo'`. */
  clique?: Vec2;
  /** Distância da primeira camada ao eixo das paredes (m). Padrão 0,60. */
  offset?: number;
  /** Espaçamento entre camadas (m). Padrão 0,45. */
  espacamento?: number;
  /** Cotar as aberturas (portas e janelas). Padrão `true`. */
  aberturas?: boolean;
  /** Só estas paredes (padrão: todas as do nível). */
  paredes?: readonly Id[];
}

interface Trecho {
  /** Coordenada ao longo do lado (x para sul/norte, y para oeste/leste). */
  t: number;
  ref?: DimensionRef;
}

const igual = (a: number, b: number): boolean => Math.abs(a - b) <= MESMA;

/** Coordenadas ordenadas, sem duplicata; a referência da primeira ocorrência é mantida. */
function ordenar(trechos: readonly Trecho[]): Trecho[] {
  const out: Trecho[] = [];
  for (const t of [...trechos].sort((a, b) => a.t - b.t)) {
    if (out.length && igual(out[out.length - 1]!.t, t.t)) {
      if (!out[out.length - 1]!.ref && t.ref) out[out.length - 1] = { t: out[out.length - 1]!.t, ref: t.ref };
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Uma cota por trecho entre coordenadas vizinhas. */
function cadeia(trechos: readonly Trecho[], lado: LadoCota, eixo: number, offset: number, pre: string): Dimension[] {
  const out: Dimension[] = [];
  for (let i = 0; i + 1 < trechos.length; i++) {
    const t0 = trechos[i]!.t;
    const t1 = trechos[i + 1]!.t;
    if (t1 - t0 < MIN_TRECHO) continue;
    const horizontal = lado === 'sul' || lado === 'norte';
    const a: Vec2 = horizontal ? { x: t0, y: eixo } : { x: eixo, y: t0 };
    const b: Vec2 = horizontal ? { x: t1, y: eixo } : { x: eixo, y: t1 };
    // `offset` é medido na normal esquerda de a→b: +x pede −offset para descer, +y pede +offset para ir à esquerda.
    const sinal = lado === 'sul' ? -1 : lado === 'norte' ? 1 : lado === 'oeste' ? 1 : -1;
    const refs: Dimension['refs'] = {};
    if (trechos[i]!.ref) refs.a = trechos[i]!.ref;
    if (trechos[i + 1]!.ref) refs.b = trechos[i + 1]!.ref;
    out.push({ id: `auto-${pre}-${i}`, a, b, offset: sinal * offset, ...(refs.a || refs.b ? { refs } : {}) });
  }
  return out;
}

/**
 * Cotas automáticas do nível. Devolve as cotas prontas para entrarem no modelo (mesmo formato do desenho manual), em
 * camadas por lado, sem repetir camada de coordenadas iguais.
 */
export function cotasAutomaticas(p: Project, levelId: Id, opts: AutoCotaOptions = {}): Dimension[] {
  const offset = opts.offset ?? 0.6;
  const espacamento = opts.espacamento ?? 0.45;
  const cotarAberturas = opts.aberturas ?? true;
  const so = opts.paredes ? new Set(opts.paredes) : null;

  const paredes = Object.values(p.elements).filter(isWall).filter((e) => e.levelId === levelId && (!so || so.has(e.id)));
  if (paredes.length === 0) return [];
  const aberturas = Object.values(p.elements)
    .filter((e): e is Opening => e.kind === 'door' || e.kind === 'window')
    .filter((o) => paredes.some((w) => w.id === o.hostId));

  const xs = paredes.flatMap((w) => [w.a.x, w.b.x]);
  const ys = paredes.flatMap((w) => [w.a.y, w.b.y]);
  const caixa = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };

  const lados: LadoCota[] = opts.lados === 'maisProximo' && opts.clique
    ? [maisProximo(caixa, opts.clique)]
    : ['sul', 'norte', 'oeste', 'leste'];

  const out: Dimension[] = [];
  for (const lado of lados) {
    const horizontal = lado === 'sul' || lado === 'norte';
    const eixo = lado === 'sul' ? caixa.y0 : lado === 'norte' ? caixa.y1 : lado === 'oeste' ? caixa.x0 : caixa.x1;
    const dentro = (v: number): boolean => (horizontal ? v >= caixa.x0 - MESMA && v <= caixa.x1 + MESMA : v >= caixa.y0 - MESMA && v <= caixa.y1 + MESMA);
    const paralela = (w: (typeof paredes)[number]): boolean => (horizontal ? Math.abs(w.a.y - w.b.y) <= MESMA : Math.abs(w.a.x - w.b.x) <= MESMA);

    // camada das paredes: pontas das paredes paralelas ao lado
    const pontas: Trecho[] = [];
    for (const w of paredes.filter(paralela)) {
      for (const [ponto, ponta] of [[w.a, 'a'], [w.b, 'b']] as const) {
        const t = horizontal ? ponto.x : ponto.y;
        if (dentro(t)) pontas.push({ t, ref: { wallId: w.id, end: ponta } });
      }
    }
    // camada das aberturas: início e fim do vão de cada abertura na parede hospedeira
    const vaos: Trecho[] = [];
    if (cotarAberturas) {
      for (const o of aberturas) {
        const host = paredes.find((w) => w.id === o.hostId);
        const tipo = p.openingTypes[o.typeId];
        if (!host || !tipo) continue;
        const comp = Math.hypot(host.b.x - host.a.x, host.b.y - host.a.y);
        if (comp <= 0) continue;
        const ux = (host.b.x - host.a.x) / comp;
        const uy = (host.b.y - host.a.y) / comp;
        for (const d of [o.offset, o.offset + tipo.width]) {
          const ponto = { x: host.a.x + ux * d, y: host.a.y + uy * d };
          const t = horizontal ? ponto.x : ponto.y;
          if (dentro(t)) vaos.push({ t });
        }
      }
    }

    const camadas = [ordenar(vaos), ordenar(pontas)];
    // a camada do total é só a extensão (mínimo e máximo), como no ArquiFácil: se coincidir com as paredes, não entra
    const todos = [...vaos, ...pontas];
    const total = todos.length ? ordenar([{ t: Math.min(...todos.map((x) => x.t)) }, { t: Math.max(...todos.map((x) => x.t)) }]) : [];
    if (!camadas.some((c) => c.length === total.length && c.every((x, i) => igual(x.t, total[i]!.t)))) camadas.push(total);

    camadas.filter((c) => c.length >= 2).forEach((c, idx) => {
      out.push(...cadeia(c, lado, eixo, offset + idx * espacamento, `${levelId}-${lado}-${idx}`));
    });
  }
  return out;
}

const maisProximo = (caixa: { x0: number; x1: number; y0: number; y1: number }, q: Vec2): LadoCota => {
  const d: Array<[LadoCota, number]> = [
    ['sul', Math.abs(q.y - caixa.y0)],
    ['norte', Math.abs(q.y - caixa.y1)],
    ['oeste', Math.abs(q.x - caixa.x0)],
    ['leste', Math.abs(q.x - caixa.x1)],
  ];
  return d.reduce((melhor, atual) => (atual[1] < melhor[1] ? atual : melhor))[0];
};
