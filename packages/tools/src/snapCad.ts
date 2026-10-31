import { closestOnSegment, dist, intersectSegments, type Vec2 } from '@hestia/geom';
import { isCad, type CadDrawing, type Id, type Project } from '@hestia/model';
import type { AddCandidate } from './snapExtras.ts';
import type { SnapOptions, SnapKind } from './types.ts';

/**
 * Captura nos desenhos CAD importados (DXF): vértices, pontos médios, o ponto sobre a linha e os cruzamentos entre
 * linhas. O DXF entra como um objeto só (`CadDrawing`), então sem isto as linhas dele não servem de referência.
 *
 * O índice espacial (células de 1 m) é montado uma vez por desenho: o `CadDrawing` é imutável entre edições (qualquer
 * alteração cria outro objeto), então o cache por identidade acompanha o projeto e um DXF com milhares de traços não
 * pesa no movimento do mouse.
 */

/** Lado da célula do índice espacial (m). */
const CELULA = 1;
/** Trechos avaliados por consulta: um desenho muito denso perto do cursor não trava a captura. */
const MAX_TRECHOS = 64;
/** Pontos (vértices e meios) avaliados por consulta. */
const MAX_PONTOS = 256;

/** Trecho de um traço do desenho, com a caixa para o índice. */
interface Trecho {
  a: Vec2;
  b: Vec2;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Ponto de captura de um traço: ponta (extremidade) ou meio. */
interface Ponto {
  p: Vec2;
  kind: 'endpoint' | 'midpoint';
}

/** Desenho indexado para a captura. `segs` e `pontos` são referenciados pelas células. */
export interface CadSnapIndex {
  id: Id;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  segs: Trecho[];
  pontos: Ponto[];
  /** Célula ("x|y") → índices de `segs`. */
  celulas: Map<string, number[]>;
  /** Célula ("x|y") → índices de `pontos`. */
  celulasPonto: Map<string, number[]>;
}

const chave = (ix: number, iy: number): string => `${ix}|${iy}`;
const celulaDe = (v: number): number => Math.floor(v / CELULA);

function empurrar(mapa: Map<string, number[]>, ix: number, iy: number, i: number): void {
  const k = chave(ix, iy);
  const lista = mapa.get(k);
  if (lista) lista.push(i);
  else mapa.set(k, [i]);
}

/** Índice do desenho; montado uma vez por instância do `CadDrawing` (ver o cache em `indexOf`). */
function indexar(d: CadDrawing): CadSnapIndex {
  const segs: Trecho[] = [];
  const pontos: Ponto[] = [];
  const vistos = new Set<string>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const ponto = (q: Vec2, kind: Ponto['kind']): void => {
    // Vértices repetidos (traços encadeados) entram uma vez só.
    // units-ok: chave numérica de deduplicação, não é texto de medida
    const k = `${kind}:${q.x.toFixed(6)}:${q.y.toFixed(6)}`;
    if (vistos.has(k)) return;
    vistos.add(k);
    pontos.push({ p: { x: q.x, y: q.y }, kind });
  };
  const trecho = (a: Vec2, b: Vec2): void => {
    if (dist(a, b) < 1e-9) return;
    segs.push({ a, b, minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) });
    ponto(a, 'endpoint');
    ponto(b, 'endpoint');
    ponto({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 'midpoint');
  };

  for (const path of d.paths) {
    const pts = path.pts;
    for (const q of pts) {
      if (q.x < minX) minX = q.x;
      if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y;
      if (q.y > maxY) maxY = q.y;
    }
    for (let i = 1; i < pts.length; i++) trecho(pts[i - 1]!, pts[i]!);
    if (path.closed && pts.length > 2) trecho(pts[pts.length - 1]!, pts[0]!);
  }
  if (segs.length === 0) return { id: d.id, minX: 0, minY: 0, maxX: 0, maxY: 0, segs, pontos, celulas: new Map(), celulasPonto: new Map() };

  const celulas = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (let ix = celulaDe(s.minX); ix <= celulaDe(s.maxX); ix++) {
      for (let iy = celulaDe(s.minY); iy <= celulaDe(s.maxY); iy++) empurrar(celulas, ix, iy, i);
    }
  });
  const celulasPonto = new Map<string, number[]>();
  pontos.forEach((p, i) => empurrar(celulasPonto, celulaDe(p.p.x), celulaDe(p.p.y), i));

  return { id: d.id, minX, minY, maxX, maxY, segs, pontos, celulas, celulasPonto };
}

const cache = new WeakMap<CadDrawing, CadSnapIndex>();

function indexOf(d: CadDrawing): CadSnapIndex {
  let ix = cache.get(d);
  if (!ix) {
    ix = indexar(d);
    cache.set(d, ix);
  }
  return ix;
}

/**
 * Desenhos visíveis dos níveis dados, indexados para a captura. Desenho oculto (`visible: false`) não entra: o que não
 * se vê não se captura. A ocultação temporária/permanente da vista é filtrada por quem chama (pelo `id`).
 */
export function cadSnapIndexes(p: Project, levelIds: readonly Id[]): CadSnapIndex[] {
  const out: CadSnapIndex[] = [];
  for (const e of Object.values(p.elements)) {
    if (!isCad(e) || e.visible === false || !levelIds.includes(e.levelId)) continue;
    out.push(indexOf(e));
  }
  return out;
}

/** Células em volta do cursor (a tolerância pode cobrir mais de uma). */
function celulasEm(cursor: Vec2, tol: number, run: (ix: number, iy: number) => void): void {
  for (let ix = celulaDe(cursor.x - tol); ix <= celulaDe(cursor.x + tol); ix++) {
    for (let iy = celulaDe(cursor.y - tol); iy <= celulaDe(cursor.y + tol); iy++) run(ix, iy);
  }
}

/** Índices únicos das células em volta do cursor, com o teto de candidatos. */
function reunir(mapa: Map<string, number[]>, cursor: Vec2, tol: number, max: number): number[] {
  const fora: number[] = [];
  const vistos = new Set<number>();
  celulasEm(cursor, tol, (ix, iy) => {
    for (const i of mapa.get(chave(ix, iy)) ?? []) {
      if (vistos.has(i)) continue;
      vistos.add(i);
      if (fora.length < max) fora.push(i);
    }
  });
  return fora;
}

/**
 * Candidatos de captura do CAD: extremidade, ponto médio, ponto sobre a linha e cruzamento de linhas. O peso de cada
 * tipo é o mesmo da captura do modelo (ver `WEIGHT` em `infer.ts`).
 */
export function addCadSnaps(
  indexes: readonly CadSnapIndex[] | undefined,
  sn: SnapOptions,
  cursor: Vec2,
  tol: number,
  from: Vec2 | undefined,
  add: AddCandidate,
  ignore?: ReadonlySet<Id>,
): void {
  if (sn.cad === false) return;
  for (const ix of indexes ?? []) {
    if (ignore?.has(ix.id)) continue;
    if (cursor.x < ix.minX - tol || cursor.x > ix.maxX + tol || cursor.y < ix.minY - tol || cursor.y > ix.maxY + tol) continue;

    if (sn.endpoint !== false || sn.midpoint !== false) {
      for (const i of reunir(ix.celulasPonto, cursor, tol, MAX_PONTOS)) {
        const p = ix.pontos[i]!;
        if (p.kind === 'endpoint' && sn.endpoint === false) continue;
        if (p.kind === 'midpoint' && sn.midpoint === false) continue;
        if (dist(cursor, p.p) <= tol) add(p.p, p.kind, [], ix.id);
      }
    }

    const perto = reunir(ix.celulas, cursor, tol, MAX_TRECHOS);
    if (perto.length === 0) continue;
    for (const i of perto) {
      const s = ix.segs[i]!;
      const foot = closestOnSegment(cursor, s.a, s.b);
      if (dist(cursor, foot) <= tol) add(foot, 'nearest', [], ix.id);
      if (sn.perpendicular && from) {
        const pf = closestOnSegment(from, s.a, s.b);
        if (dist(cursor, pf) <= tol && dist(pf, from) > 1e-6) add(pf, 'perpendicular', [{ from, to: pf, kind: 'perpendicular' }], ix.id);
      }
    }

    if (sn.intersections) {
      for (let i = 0; i < perto.length; i++) {
        for (let j = i + 1; j < perto.length; j++) {
          const s1 = ix.segs[perto[i]!]!;
          const s2 = ix.segs[perto[j]!]!;
          if (s1.maxX < s2.minX || s2.maxX < s1.minX || s1.maxY < s2.minY || s2.maxY < s1.minY) continue;
          const p = intersectSegments(s1.a, s1.b, s2.a, s2.b);
          if (p && dist(cursor, p) <= tol) add(p, 'intersection', [], ix.id);
        }
      }
    }
  }
}

/** Tipos de captura que um desenho CAD oferece (documentação do gerenciador). */
export const CAD_SNAP_KINDS: readonly SnapKind[] = ['endpoint', 'midpoint', 'nearest', 'intersection', 'perpendicular'];

/** Desenho cujo traço passa a até `tol` do ponto (clique na linha do CAD). */
export function cadNear(indexes: readonly CadSnapIndex[], at: Vec2, tol: number): Id | null {
  let best: { id: Id; d: number } | null = null;
  for (const ix of indexes) {
    if (at.x < ix.minX - tol || at.x > ix.maxX + tol || at.y < ix.minY - tol || at.y > ix.maxY + tol) continue;
    for (const i of reunir(ix.celulas, at, tol, MAX_TRECHOS)) {
      const s = ix.segs[i]!;
      const d = dist(at, closestOnSegment(at, s.a, s.b));
      if (d <= tol && (!best || d < best.d)) best = { id: ix.id, d };
    }
  }
  return best?.id ?? null;
}

/** Desenhos inteiramente dentro da janela (seleção de janela esq→dir). */
export function cadDrawingIdsInBox(indexes: readonly CadSnapIndex[], a: Vec2, b: Vec2): Id[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return indexes.filter((ix) => ix.minX >= minX && ix.maxX <= maxX && ix.minY >= minY && ix.maxY <= maxY).map((ix) => ix.id);
}
