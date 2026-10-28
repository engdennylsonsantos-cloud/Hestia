import type { Vec2 } from '@hestia/geom';
import {
  openingTypeById,
  coreSpan,
  isWall,
  type Dimension,
  type DimensionRef,
  type Id,
  type Opening,
  type Project,
  type Wall,
} from '@hestia/model';
import { buildFrame, type WallFrame } from './frame.ts';

/**
 * Cotas automáticas de planta (inspirado no `generateAutoDimensions` do ArquiFácil). O gerador monta **camadas** de
 * coordenadas por lado da edificação, uma cota por trecho entre coordenadas vizinhas. As camadas são escolhidas pelo
 * usuário, de dentro para fora: **aberturas → paredes (estruturas) → contorno (geometria) → total (geral)**.
 *
 * Um lado só é cotado quando tem parede **paralela** a ele: sem parede vertical não nascem cotas verticais. As
 * aberturas entram só no lado da parede que as hospeda, e `somenteExternas` descarta as divisórias escondidas atrás do
 * contorno. As pontas de parede viram `refs` projetadas no eixo do lado, então a cota acompanha a parede e continua reta.
 */

/** Tolerância para considerar duas coordenadas iguais (m). */
const MESMA = 0.02;
/** Abaixo disto a cota não vale a pena (m). */
const MIN_TRECHO = 0.01;
/** Folga para reconhecer uma junção de parede (m). */
const TOL_JUNCAO = 0.05;
/** Folga do teste de sombra (m). */
const TOL_SOMBRA = 0.05;

export type LadoCota = 'sul' | 'norte' | 'oeste' | 'leste';
export type ReferenciaParede = 'externa' | 'nucleo' | 'eixo';

export interface AutoCotaOptions {
  /** Lados cotados: os quatro (padrão), um lado só ou o mais próximo do clique. */
  lados?: 'todos' | LadoCota | 'maisProximo';
  /** Ponto do clique na planta, usado por `lados: 'maisProximo'`. */
  clique?: Vec2;
  /** Distância da primeira camada à face de referência (m). Padrão 0,60. */
  offset?: number;
  /** Espaçamento entre camadas (m). Padrão 0,45. */
  espacamento?: number;
  /** Cotagem geral: o total do lado. Padrão `true`. */
  geral?: boolean;
  /** Geometria exterior: degraus do contorno, uma face por parede. Padrão `true`. */
  geometria?: boolean;
  /** Estruturas: as duas faces de cada parede perpendicular (espessuras e vãos). Padrão `true`. */
  paredes?: boolean;
  /** Cotar as aberturas. Padrão `true`. */
  aberturas?: boolean;
  /** Abertura pelo centro ou pelas arestas. Padrão `arestas`. */
  modoAberturas?: 'centro' | 'arestas';
  /** Face usada como referência da parede. Padrão `externa`. */
  referencia?: ReferenciaParede;
  /** Só o contorno externo, ignorando divisórias internas. Padrão `true`. */
  somenteExternas?: boolean;
  /** Só estas paredes (padrão: todas as do nível). */
  apenasParedes?: readonly Id[];
}

interface Trecho {
  /** Coordenada ao longo do lado (x para sul/norte, y para oeste/leste). */
  t: number;
  ref?: DimensionRef;
}

interface Lado {
  nome: LadoCota;
  horizontal: boolean;
  /** Coordenada perpendicular da linha de referência (face/eixo) do lado. */
  base: number;
}

interface Caixa {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

type FrameDe = (w: Wall) => WallFrame | null;

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

const mesmaLista = (a: readonly Trecho[], b: readonly Trecho[]): boolean =>
  a.length === b.length && a.every((x, i) => igual(x.t, b[i]!.t));

/** Uma cota por trecho entre coordenadas vizinhas, na linha de referência do lado. */
function cadeia(trechos: readonly Trecho[], lado: Lado, dist: number, pre: string): Dimension[] {
  const out: Dimension[] = [];
  for (let i = 0; i + 1 < trechos.length; i++) {
    const t0 = trechos[i]!.t;
    const t1 = trechos[i + 1]!.t;
    if (t1 - t0 < MIN_TRECHO) continue;
    const a: Vec2 = lado.horizontal ? { x: t0, y: lado.base } : { x: lado.base, y: t0 };
    const b: Vec2 = lado.horizontal ? { x: t1, y: lado.base } : { x: lado.base, y: t1 };
    // `dist` é medido na normal esquerda de a→b: +x pede −dist para descer, +y pede +dist para ir à esquerda.
    const sinal = lado.nome === 'sul' ? -1 : lado.nome === 'norte' ? 1 : lado.nome === 'oeste' ? 1 : -1;
    const refs: Dimension['refs'] = {};
    if (trechos[i]!.ref) refs.a = trechos[i]!.ref;
    if (trechos[i + 1]!.ref) refs.b = trechos[i + 1]!.ref;
    out.push({ id: `auto-${pre}-${i}`, a, b, offset: sinal * dist, ...(refs.a || refs.b ? { refs } : {}) });
  }
  return out;
}

const ehHorizontal = (w: Wall): boolean => Math.abs(w.a.y - w.b.y) <= MESMA;
const ehVertical = (w: Wall): boolean => Math.abs(w.a.x - w.b.x) <= MESMA;
const comprimento = (w: Wall): number => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);

/** As duas faces da parede na referência escolhida: acabamento, núcleo ou eixo. */
function facesS(f: WallFrame, ref: ReferenciaParede): [number, number] {
  if (ref === 'eixo') return [0, 0];
  if (ref === 'externa') return [f.sExt, f.sInt];
  const core = coreSpan(f.type);
  return [f.sign * (f.extOffset - core.from), f.sign * (f.extOffset - core.to)];
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** A ponta encosta em outra parede (junção em L ou T)? */
function temJuncao(ponto: Vec2, id: Id, paredes: readonly Wall[], frame: FrameDe): boolean {
  return paredes.some((o) => {
    if (o.id === id) return false;
    const raio = (frame(o)?.thickness ?? 0.2) / 2 + TOL_JUNCAO;
    return distToSegment(ponto, o.a, o.b) < raio;
  });
}

/** Uma parede perpendicular encosta numa paralela do lado (para o filtro de contorno externo). */
function toca(a: Wall, b: Wall, frame: FrameDe): boolean {
  const raio = Math.max(frame(a)?.thickness ?? 0.2, frame(b)?.thickness ?? 0.2) / 2 + 0.3;
  return (
    distToSegment(a.a, b.a, b.b) < raio ||
    distToSegment(a.b, b.a, b.b) < raio ||
    distToSegment(b.a, a.a, a.b) < raio ||
    distToSegment(b.b, a.a, a.b) < raio
  );
}

/** Outra parede paralela está entre este ponto e o lado de fora? */
function bloqueia(o: Wall, px: number, py: number, lado: LadoCota): boolean {
  const horizontal = lado === 'sul' || lado === 'norte';
  if (horizontal) {
    const minX = Math.min(o.a.x, o.b.x);
    const maxX = Math.max(o.a.x, o.b.x);
    if (px < minX - 0.001 || px > maxX + 0.001) return false;
    const dx = o.b.x - o.a.x;
    const oy = Math.abs(dx) < 0.001
      ? (lado === 'norte' ? Math.max(o.a.y, o.b.y) : Math.min(o.a.y, o.b.y))
      : o.a.y + ((px - o.a.x) * (o.b.y - o.a.y)) / dx;
    return lado === 'norte' ? oy > py + TOL_SOMBRA : oy < py - TOL_SOMBRA;
  }
  const minY = Math.min(o.a.y, o.b.y);
  const maxY = Math.max(o.a.y, o.b.y);
  if (py < minY - 0.001 || py > maxY + 0.001) return false;
  const dy = o.b.y - o.a.y;
  const ox = Math.abs(dy) < 0.001
    ? (lado === 'leste' ? Math.max(o.a.x, o.b.x) : Math.min(o.a.x, o.b.x))
    : o.a.x + ((py - o.a.y) * (o.b.x - o.a.x)) / dy;
  return lado === 'leste' ? ox > px + TOL_SOMBRA : ox < px - TOL_SOMBRA;
}

/** Parede inteiramente escondida atrás de outra paralela (não é contorno daquele lado). */
function sombreada(w: Wall, paralelas: readonly Wall[], lado: LadoCota): boolean {
  const amostras = 5;
  let escondidas = 0;
  for (let i = 0; i <= amostras; i++) {
    const t = i / amostras;
    const px = w.a.x + (w.b.x - w.a.x) * t;
    const py = w.a.y + (w.b.y - w.a.y) * t;
    if (paralelas.some((o) => o.id !== w.id && bloqueia(o, px, py, lado))) escondidas++;
  }
  return escondidas / (amostras + 1) >= 0.99;
}

const caixaDe = (paredes: readonly Wall[]): Caixa => {
  const xs = paredes.flatMap((w) => [w.a.x, w.b.x]);
  const ys = paredes.flatMap((w) => [w.a.y, w.b.y]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

const maisProximo = (caixa: Caixa, q: Vec2): LadoCota => {
  const d: Array<[LadoCota, number]> = [
    ['sul', Math.abs(q.y - caixa.y0)],
    ['norte', Math.abs(q.y - caixa.y1)],
    ['oeste', Math.abs(q.x - caixa.x0)],
    ['leste', Math.abs(q.x - caixa.x1)],
  ];
  return d.reduce((melhor, atual) => (atual[1] < melhor[1] ? atual : melhor))[0];
};

function ladosDe(opts: AutoCotaOptions, caixa: Caixa): LadoCota[] {
  const escolha = opts.lados ?? 'todos';
  if (escolha === 'maisProximo' && opts.clique) return [maisProximo(caixa, opts.clique)];
  if (escolha !== 'todos' && escolha !== 'maisProximo') return [escolha];
  return ['sul', 'norte', 'oeste', 'leste'];
}

/** Paredes do lado: as da metade voltada para ele; só o contorno externo quando pedido. */
function paredesDoLado(
  paredes: readonly Wall[],
  lado: LadoCota,
  caixa: Caixa,
  somenteExternas: boolean,
  frame: FrameDe,
): { paralelas: Wall[]; perpendiculares: Wall[] } {
  const horizontal = lado === 'sul' || lado === 'norte';
  const midX = (caixa.x0 + caixa.x1) / 2;
  const midY = (caixa.y0 + caixa.y1) / 2;
  const perto = paredes.filter((w) => {
    const c0 = horizontal ? Math.min(w.a.y, w.b.y) : Math.min(w.a.x, w.b.x);
    const c1 = horizontal ? Math.max(w.a.y, w.b.y) : Math.max(w.a.x, w.b.x);
    if (horizontal) return lado === 'sul' ? c0 <= midY + MESMA : c1 >= midY - MESMA;
    return lado === 'oeste' ? c0 <= midX + MESMA : c1 >= midX - MESMA;
  });
  const paralelas = perto.filter((w) => (horizontal ? ehHorizontal(w) : ehVertical(w)));
  const perpendiculares = perto.filter((w) => (horizontal ? ehVertical(w) : ehHorizontal(w)));
  if (!somenteExternas) return { paralelas, perpendiculares };
  const visiveis = paralelas.filter((w) => !sombreada(w, paralelas, lado));
  const mantidas = visiveis.length > 0 ? visiveis : paralelas;
  return { paralelas: mantidas, perpendiculares: perpendiculares.filter((w) => mantidas.some((par) => toca(w, par, frame))) };
}

/** Coordenada perpendicular da face de referência mais externa do lado (independente do `flipped`). */
function baseDoLado(paralelas: readonly Wall[], lado: LadoCota, ref: ReferenciaParede, frame: FrameDe): number {
  const horizontal = lado === 'sul' || lado === 'norte';
  const paraFora = lado === 'norte' || lado === 'leste';
  let base = paraFora ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const w of paralelas) {
    const f = frame(w);
    if (!f) continue;
    const [s1, s2] = facesS(f, ref);
    const normal = horizontal ? f.n.y : f.n.x;
    const c1 = (horizontal ? w.a.y : w.a.x) + normal * s1;
    const c2 = (horizontal ? w.a.y : w.a.x) + normal * s2;
    const c = paraFora ? Math.max(c1, c2) : Math.min(c1, c2);
    base = paraFora ? Math.max(base, c) : Math.min(base, c);
  }
  return base;
}

/** Camadas de um lado, na ordem de afastamento, já sem repetição de coordenadas. */
function camadasDoLado(
  p: Project,
  lado: Lado,
  mid: number,
  paralelas: readonly Wall[],
  perpendiculares: readonly Wall[],
  aberturas: readonly Opening[],
  opts: AutoCotaOptions,
  frame: FrameDe,
): Trecho[][] {
  const ref = opts.referencia ?? 'externa';
  const coord = (v: Vec2): number => (lado.horizontal ? v.x : v.y);
  const ponta = (w: Wall, fim: 'a' | 'b'): Trecho => ({
    t: coord(fim === 'a' ? w.a : w.b),
    ref: { wallId: w.id, end: fim, axis: lado.horizontal ? 'x' : 'y' },
  });
  const todas = [...paralelas, ...perpendiculares];

  // Contorno: pontas livres das paralelas + a face externa de cada perpendicular (um degrau por parede).
  const livres: Trecho[] = [];
  for (const w of paralelas) {
    if (!temJuncao(w.a, w.id, todas, frame)) livres.push(ponta(w, 'a'));
    if (!temJuncao(w.b, w.id, todas, frame)) livres.push(ponta(w, 'b'));
  }
  const contornoPerp: Trecho[] = [];
  const facesPerp: Trecho[] = [];
  for (const w of perpendiculares) {
    const f = frame(w);
    if (!f) continue;
    const [s1, s2] = facesS(f, ref);
    const normal = lado.horizontal ? f.n.x : f.n.y;
    const c1 = coord(w.a) + normal * s1;
    const c2 = coord(w.a) + normal * s2;
    // A face do contorno é a que fica mais longe do centro da planta (o canto externo do degrau).
    contornoPerp.push({ t: Math.abs(c1 - mid) >= Math.abs(c2 - mid) ? c1 : c2 });
    facesPerp.push({ t: c1 }, { t: c2 });
  }
  const contorno = [...livres, ...contornoPerp];

  // Aberturas: a corrente vai de ponta a ponta da fachada e acrescenta o centro ou as arestas de cada vão.
  const vaos: Trecho[] = [];
  for (const o of aberturas) {
    const host = paralelas.find((w) => w.id === o.hostId);
    const tipo = openingTypeById(p, o.typeId);
    if (!host || !tipo) continue;
    const comp = comprimento(host);
    if (comp <= 0) continue;
    const ux = (host.b.x - host.a.x) / comp;
    const uy = (host.b.y - host.a.y) / comp;
    const pos = opts.modoAberturas === 'centro' ? [o.offset] : [o.offset - tipo.width / 2, o.offset + tipo.width / 2];
    for (const d of pos) vaos.push({ t: coord({ x: host.a.x + ux * d, y: host.a.y + uy * d }) });
  }

  const camadas: Array<{ trechos: Trecho[]; ativa: boolean }> = [
    { trechos: [...contorno, ...vaos], ativa: opts.aberturas !== false && vaos.length > 0 },
    { trechos: [...livres, ...facesPerp], ativa: opts.paredes !== false },
    { trechos: contorno, ativa: opts.geometria !== false },
    {
      trechos: contorno.length >= 2
        ? [{ t: Math.min(...contorno.map((x) => x.t)) }, { t: Math.max(...contorno.map((x) => x.t)) }]
        : [],
      ativa: opts.geral !== false,
    },
  ];
  const ativas = camadas.filter((c) => c.ativa).map((c) => ordenar(c.trechos)).filter((c) => c.length >= 2);
  return ativas.filter((c, i) => !ativas.slice(0, i).some((prev) => mesmaLista(prev, c)));
}

/**
 * Cotas automáticas do nível. Devolve as cotas prontas para entrarem no modelo (mesmo formato do desenho manual), em
 * camadas por lado, sem repetir camada de coordenadas iguais.
 */
export function cotasAutomaticas(p: Project, levelId: Id, opts: AutoCotaOptions = {}): Dimension[] {
  const offset = opts.offset ?? 0.6;
  const espacamento = opts.espacamento ?? 0.45;
  const somenteExternas = opts.somenteExternas ?? true;
  const so = opts.apenasParedes ? new Set(opts.apenasParedes) : null;
  const frames = new Map<Id, WallFrame | null>();
  const frame: FrameDe = (w) => {
    if (!frames.has(w.id)) {
      const tipo = p.wallTypes[w.typeId];
      frames.set(w.id, tipo ? buildFrame(w, tipo) : null);
    }
    return frames.get(w.id) ?? null;
  };

  const paredes = Object.values(p.elements)
    .filter(isWall)
    .filter((w) => w.levelId === levelId && (!so || so.has(w.id)))
    .filter((w) => w.sag === 0 && comprimento(w) > MIN_TRECHO && (ehHorizontal(w) || ehVertical(w)));
  if (paredes.length === 0) return [];
  const aberturas = Object.values(p.elements).filter((e): e is Opening => e.kind === 'door' || e.kind === 'window');
  const caixa = caixaDe(paredes);

  const out: Dimension[] = [];
  for (const nome of ladosDe(opts, caixa)) {
    const { paralelas, perpendiculares } = paredesDoLado(paredes, nome, caixa, somenteExternas, frame);
    if (paralelas.length === 0) continue;
    const base = baseDoLado(paralelas, nome, opts.referencia ?? 'externa', frame);
    if (!Number.isFinite(base)) continue;
    const lado: Lado = { nome, horizontal: nome === 'sul' || nome === 'norte', base };
    const mid = lado.horizontal ? (caixa.x0 + caixa.x1) / 2 : (caixa.y0 + caixa.y1) / 2;
    const camadas = camadasDoLado(p, lado, mid, paralelas, perpendiculares, aberturas, opts, frame);
    camadas.forEach((c, i) => {
      out.push(...cadeia(c, lado, offset + i * espacamento, `${levelId}-${nome}-${i}`));
    });
  }
  return out;
}
