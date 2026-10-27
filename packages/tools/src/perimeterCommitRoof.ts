import type { SketchSeg, Vec2 } from '@hestia/geom';
import { expandRoofArcs } from '@hestia/engine';
import { isRoof, makeRoof, newId, validateProject, type Project, type Roof } from '@hestia/model';
import { roofProblem } from './roofCheck.ts';
import { defaultRoofDir, eaveOutlinePerEdge, roofAutoOffset, roofSlopeError, waterGroupCount } from './roofGeom.ts';
import type { EditFlags, FinishEdge } from './perimeterSession.ts';
import { axisOr, keepOrder, newError, pickTypeId, refuse, withElement } from './perimeterCommitShared.ts';
import { arcCuspProblem, collapseSketchArcs, eaveOutlineArcs, footprintOf, footprintSag, hasRoofArcs, isCcw, offsetSag, sampleSagRing } from './perimeterRoofArcs.ts';
import type { CommitPerimeterOptions, CommitPerimeterResult } from './perimeterCommitTypes.ts';

/** Telhado com forma por arestas: as únicas que o perímetro sabe ler e regravar. Livre e extrusão têm ferramenta própria. */
const isEdgeRoof = (r: Roof): boolean => r.shape !== 'free' && r.shape !== 'extrusion';

/**
 * Lados e furos de um telhado para o rascunho. A pegada (sem balanço) é o laço externo: se o telhado não a guarda
 * (antigo, ou editado no beiral), ela sai do beiral desfazendo o balanço por aresta, e o beiral recalculado volta igual.
 * Null quando a forma não é por arestas.
 */
export function roofSides(roof: Roof): { outer: Vec2[]; holes: Vec2[][]; flags: EditFlags } | null {
  if (!isEdgeRoof(roof)) return null;
  const overhangs = roof.boundary.map((_, i) => roof.edgeOverhangs[i] ?? 0);
  const foot = footprintOf(roof);
  const flagOf = (i: number) => {
    const s = roof.edgeSlopes[i] ?? null;
    return { definesSlope: s !== null, slopePct: s ?? roof.slopePercent, overhang: overhangs[i] ?? 0 };
  };
  const holes = roof.holes.map((h) => h.slice());
  if (!hasRoofArcs(roof)) {
    return { outer: foot.slice(), holes, flags: { outer: foot.map((_, i) => flagOf(i)) } };
  }
  // Arcos: a pegada ganha a flecha do arco do beiral (desfeito o balanço) e volta amostrada, para o esboço reencontrar o arco.
  const footSag = footprintSag(roof, foot);
  const { pts, edgeOf } = sampleSagRing(foot, footSag);
  return { outer: pts, holes, flags: { outer: edgeOf.map(flagOf) } };
}

/** Águas do telhado: trechos lógicos que definem inclinação, contados no contorno com os arcos subdivididos. */
function waterCount(r: Omit<Roof, 'order'>): number {
  const e = expandRoofArcs({ ...r, order: 0 });
  return waterGroupCount(e.boundary, e.edgeSlopes, e.edgeOverhangs);
}

/** O que o telhado grava: beiral, pegada, furos, inclinação e balanço por aresta. */
interface RoofFields {
  boundary: Vec2[];
  footprint: Vec2[];
  holes: Vec2[][];
  edgeSlopes: Array<number | null>;
  edgeOverhangs: number[];
  /** Flechas por aresta lógica; ausente quando o esboço não tem arco (então o campo do telhado é limpo). */
  edgeSag?: number[];
}

/** Traduz o resultado do esboço (lados na ordem do anel) em campos do telhado. Recusa balanço ou inclinação inválidos. */
function fieldsOf(outer: Vec2[], holes: Vec2[][], edges: FinishEdge[], segs: SketchSeg[]): RoofFields | string {
  const overhangsAll = edges.map((e) => e.overhang);
  if (overhangsAll.some((v) => !Number.isFinite(v) || v < 0)) return 'Balanço inválido: use zero ou um valor positivo.';
  for (const e of edges) {
    const err = e.definesSlope ? roofSlopeError(e.slopePct) : null;
    if (err) return err;
  }
  // Arcos amostrados do esboço voltam a ser uma aresta lógica com flecha (vértices só nos cantos).
  const logical = collapseSketchArcs(outer, edges.map((e) => e.segId), segs);
  const ring = logical ? logical.outer : outer;
  const es = logical ? logical.groups.map((g) => edges[g[0]!]!) : edges;
  const overhangs = es.map((e) => e.overhang);
  const cusp = logical ? arcCuspProblem(ring, logical.sag, overhangs) : null;
  if (cusp) return cusp;
  const boundary = logical ? eaveOutlineArcs(ring, logical.sag, overhangs) : eaveOutlinePerEdge(ring, overhangs);
  const out: RoofFields = {
    boundary,
    footprint: ring.slice(),
    holes,
    edgeSlopes: es.map((e) => (e.definesSlope ? e.slopePct : null)),
    edgeOverhangs: overhangs,
  };
  if (logical) {
    const ccw = isCcw(ring);
    const n = ring.length;
    out.edgeSag = logical.sag.map((sg, i) => offsetSag(ring[i]!, ring[(i + 1) % n]!, sg, boundary[i]!, boundary[(i + 1) % n]!, overhangs[i]!, ccw));
  }
  return out;
}

/**
 * Telhado a partir do esboço: cria (com `addRoof`) ou altera (`updateElements`) conforme `editing`. Mesmas verificações
 * da ferramenta: se o motor não gera águas (ou o validador acusa erro novo), recusa e não gera comando.
 */
export function commitRoof(
  p: Project,
  s: { editing?: string; slopeDefault: number },
  outer: Vec2[],
  holes: Vec2[][],
  edges: FinishEdge[],
  opts: CommitPerimeterOptions,
  segs: SketchSeg[] = [],
): CommitPerimeterResult {
  const f = fieldsOf(outer, holes, edges, segs);
  if (typeof f === 'string') return refuse(f);
  return s.editing ? editRoof(p, s.editing, f, opts) : createRoof(p, f, s.slopeDefault, opts);
}

function createRoof(p: Project, f: RoofFields, slopeDefault: number, opts: CommitPerimeterOptions): CommitPerimeterResult {
  const levelId = opts.levelId;
  if (!levelId) return refuse('Nível não informado.');
  if (!p.levels.some((l) => l.id === levelId)) return refuse('O nível não existe no projeto.');
  const typeId = pickTypeId(p.roofTypes, opts.typeId);
  if (!typeId) return refuse('O projeto não tem tipo de telhado.');
  const id = newId('t');
  const roof = makeRoof({
    id,
    typeId,
    levelId,
    ...f,
    heightOffset: opts.heightOffset ?? roofAutoOffset(p, levelId),
    shape: 'edges',
    slopePercent: slopeDefault,
    dir: axisOr(opts.axis, defaultRoofDir(f.boundary)),
    mark: opts.mark ?? '',
    comments: opts.comments ?? '',
  });
  const candidate: Roof = { ...roof, order: p.nextOrder };
  const after = withElement(p, candidate);
  const problem = roofProblem(p, [candidate]) ?? newError(p, after, id, validateProject);
  if (problem) return refuse(`Não foi possível criar o telhado: ${problem}`);
  const n = waterCount(roof);
  return { ok: true, id, commands: [{ type: 'addRoof', roof }], message: `Telhado criado: ${n} ${n === 1 ? 'água' : 'águas'}.` };
}

function editRoof(p: Project, id: string, f: RoofFields, opts: CommitPerimeterOptions): CommitPerimeterResult {
  const el = p.elements[id];
  if (!el || !isRoof(el)) return refuse('Telhado não encontrado.');
  if (!isEdgeRoof(el)) return refuse('Este telhado não tem forma por arestas: edite-o pela própria ferramenta.');
  const patch: Partial<Roof> = { ...f, holes: keepOrder(el.holes, f.holes) };
  // Sem arco no esboço, a flecha antiga sai do telhado (o campo some ao gravar).
  if (!f.edgeSag) patch.edgeSag = undefined;
  if (opts.heightOffset !== undefined) patch.heightOffset = opts.heightOffset;
  if (opts.axis) patch.dir = axisOr(opts.axis, el.dir);
  if (opts.mark !== undefined) patch.mark = opts.mark;
  if (opts.comments !== undefined) patch.comments = opts.comments;
  const next: Roof = { ...el, ...patch };
  const after = withElement(p, next);
  const problem = roofProblem(p, [next]) ?? newError(p, after, id, validateProject);
  if (problem) return refuse(`Alteração não aplicada: ${problem}`);
  const n = waterCount(next);
  return { ok: true, id, commands: [{ type: 'updateElements', ids: [id], patch }], message: `Telhado atualizado: ${n} ${n === 1 ? 'água' : 'águas'}.` };
}
