import polygonClipping from 'polygon-clipping';
import * as ClipperLib from 'clipper-lib';
import { multiArea, ringArea, type MultiPolygon, type Polygon, type Ring } from './polygon.ts';

type Pair = [number, number];
type PcRing = Pair[];
type PcPolygon = PcRing[];
type PcMulti = PcPolygon[];

/** Resolução de arredondamento: 1e-7 m (0,1 µm) estabiliza coordenadas quase coincidentes. */
const SNAP = 1e7;
const snap = (n: number): number => Math.round(n * SNAP) / SNAP;

function toPc(m: MultiPolygon): PcMulti {
  return m
    .map((p) => p.filter((r) => r.length >= 3).map((r): PcRing => r.map((v): Pair => [snap(v.x), snap(v.y)])))
    .filter((p) => p.length > 0);
}

function fromPc(m: PcMulti): MultiPolygon {
  return m.map(
    (p): Polygon =>
      p.map((r): Ring => {
        const pts = r.map(([x, y]) => ({ x, y }));
        const first = pts[0];
        const last = pts[pts.length - 1];
        if (first && last && first.x === last.x && first.y === last.y) pts.pop();
        return pts;
      }),
  );
}

export const asMulti = (r: Ring): MultiPolygon => [[r]];

/**
 * polygon-clipping é exato, mas lança em entradas quase degeneradas (anéis que quase se tocam, arestas
 * colineares com erro de micrômetros). Nesse caso refazemos a operação com Clipper, que trabalha em inteiros e
 * nunca lança: o resultado perde a precisão abaixo de 1 µm, o que é irrelevante para paredes.
 */
function robust(exact: () => PcMulti, fallback: () => MultiPolygon): MultiPolygon {
  try {
    return fromPc(exact());
  } catch {
    return fallback();
  }
}

export function union(...ms: MultiPolygon[]): MultiPolygon {
  const parts = ms.filter((m) => m.length > 0);
  if (parts.length === 0) return [];
  const [first, ...rest] = parts.map(toPc);
  return robust(
    () => polygonClipping.union(first!, ...rest),
    () => parts.slice(1).reduce((acc, m) => clipperBinary(acc, m, ClipperLib.ClipType.ctUnion), parts[0]!),
  );
}

export function difference(a: MultiPolygon, ...bs: MultiPolygon[]): MultiPolygon {
  if (a.length === 0) return [];
  const subs = bs.filter((m) => m.length > 0);
  if (subs.length === 0) return a;
  return robust(
    () => polygonClipping.difference(toPc(a), ...subs.map(toPc)),
    () => subs.reduce((acc, m) => clipperBinary(acc, m, ClipperLib.ClipType.ctDifference), a),
  );
}

export function intersection(a: MultiPolygon, b: MultiPolygon): MultiPolygon {
  if (a.length === 0 || b.length === 0) return [];
  return robust(
    () => polygonClipping.intersection(toPc(a), toPc(b)),
    () => clipperBinary(a, b, ClipperLib.ClipType.ctIntersection),
  );
}

const CLIP_SCALE = 1e6;

const toClipPath = (r: Ring): Array<{ X: number; Y: number }> => r.map((v) => ({ X: Math.round(v.x * CLIP_SCALE), Y: Math.round(v.y * CLIP_SCALE) }));

/** Resultado do Clipper (árvore) como multipolígono com furos. */
function fromTree(tree: ClipperLib.PolyTree): MultiPolygon {
  const out: MultiPolygon = [];
  const toRing = (path: Array<{ X: number; Y: number }>): Ring => path.map((q) => ({ x: q.X / CLIP_SCALE, y: q.Y / CLIP_SCALE }));
  const walk = (node: ClipperLib.PolyNode): void => {
    for (const child of node.Childs()) {
      if (child.IsHole()) continue;
      const poly: Polygon = [toRing(child.Contour())];
      for (const h of child.Childs()) {
        poly.push(toRing(h.Contour()));
        walk(h);
      }
      out.push(poly);
    }
  };
  walk(tree);
  return out;
}

/**
 * Caminhos de um operando com orientação normalizada (externo anti-horário, furos horários) para a regra de
 * enrolamento não-zero: polígonos sobrepostos dentro do mesmo operando somam (não se anulam, como na regra
 * par-ímpar) e cada furo só vale dentro do seu próprio polígono.
 */
function operandPaths(m: MultiPolygon): Array<Array<{ X: number; Y: number }>> {
  return m.flatMap((poly) =>
    poly.map((ring, i) => {
      const ccw = ringArea(ring) > 0;
      const oriented = ccw === (i === 0) ? ring : [...ring].reverse();
      return toClipPath(oriented);
    }),
  );
}

/**
 * União de vários multipolígonos numa única chamada do Clipper (inteiros a 1 µm, enrolamento não-zero).
 * Mais lenta que `union`, mas não perde área em silêncio: o polygon-clipping, em uniões grandes de peças quase
 * coincidentes, às vezes devolve um resultado menor sem lançar erro (medido nas sementes 3, 9, 10 e 14 dos testes
 * de propriedade). Use onde a área total importa: regiões e silhuetas do aglomerado.
 */
export function unionClipper(...ms: MultiPolygon[]): MultiPolygon {
  const parts = ms.filter((m) => m.length > 0);
  if (parts.length === 0) return [];
  const clip = new ClipperLib.Clipper();
  clip.AddPaths(parts.flatMap(operandPaths), ClipperLib.PolyType.ptSubject, true);
  const tree = new ClipperLib.PolyTree();
  clip.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return fromTree(tree);
}

/** Operação booleana binária com Clipper (inteiros, não lança). */
function clipperBinary(a: MultiPolygon, b: MultiPolygon, type: ClipperLib.ClipType): MultiPolygon {
  const clip = new ClipperLib.Clipper();
  clip.AddPaths(operandPaths(a), ClipperLib.PolyType.ptSubject, true);
  clip.AddPaths(operandPaths(b), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  clip.Execute(type, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return fromTree(tree);
}

/**
 * Fechamento morfológico (dilata e contrai por `eps` metros) com Clipper, que trabalha em inteiros.
 * Cola polígonos que se tocam por frestas numéricas de micrômetros — as junções de paredes produzem
 * vértices em "T" que o arredondamento deixa levemente fora da aresta vizinha.
 */
export function closeGaps(m: MultiPolygon, eps = 3e-6): MultiPolygon {
  if (m.length === 0) return m;
  const toPath = (r: Ring): Array<{ X: number; Y: number }> => r.map((v) => ({ X: Math.round(v.x * CLIP_SCALE), Y: Math.round(v.y * CLIP_SCALE) }));
  const paths = m.flatMap((p) => p.map(toPath));
  const up: ClipperLib.Paths = [];
  const co = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_SCALE * eps);
  co.AddPaths(paths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  co.Execute(up, eps * CLIP_SCALE);
  // união dos caminhos dilatados (preenchimento não-zero) e depois contração
  const clip = new ClipperLib.Clipper();
  clip.AddPaths(up, ClipperLib.PolyType.ptSubject, true);
  const merged: ClipperLib.Paths = [];
  clip.Execute(ClipperLib.ClipType.ctUnion, merged, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const down: ClipperLib.Paths = [];
  const co2 = new ClipperLib.ClipperOffset(2, 0.25 * CLIP_SCALE * eps);
  co2.AddPaths(merged, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  co2.Execute(down, -eps * CLIP_SCALE);
  const tree = new ClipperLib.PolyTree();
  const clip2 = new ClipperLib.Clipper();
  clip2.AddPaths(down, ClipperLib.PolyType.ptSubject, true);
  clip2.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  const out: MultiPolygon = [];
  const toRing = (path: Array<{ X: number; Y: number }>): Ring => path.map((q) => ({ x: q.X / CLIP_SCALE, y: q.Y / CLIP_SCALE }));
  const walk = (node: ClipperLib.PolyNode): void => {
    for (const child of node.Childs()) {
      if (!child.IsHole()) {
        const poly: Polygon = [toRing(child.Contour())];
        for (const h of child.Childs()) {
          poly.push(toRing(h.Contour()));
          walk(h);
        }
        out.push(poly);
      }
    }
  };
  walk(tree);
  return out;
}

/**
 * `closeGaps` que nunca perde área: o fechamento morfológico descarta anéis finos em zigue-zague (quase
 * colineares), o que apagaria trechos reais de parede da silhueta. Se a área mudar além do ruído de
 * micrômetros, devolve a entrada intacta.
 */
export function closeGapsSafe(m: MultiPolygon, eps = 3e-6, maxLoss = 2e-5): MultiPolygon {
  const closed = closeGaps(m, eps);
  const delta = multiArea(closed) - multiArea(m);
  // Ganho = frestas coladas (esperado, micrômetros); perda = anéis finos descartados (inaceitável).
  return delta >= -maxLoss && delta <= 1e-3 ? closed : m;
}
