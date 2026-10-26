import type { Vec2 } from '@hestia/geom';
import { isRoof, makeRoof, newId, validateProject, type Project, type Roof } from '@hestia/model';
import { roofProblem } from './roofCheck.ts';
import { defaultRoofDir, eaveOutlinePerEdge, roofAutoOffset, roofSlopeError } from './roofGeom.ts';
import type { EditFlags, FinishEdge } from './perimeterSession.ts';
import { axisOr, keepOrder, newError, pickTypeId, refuse, waterCount, withElement } from './perimeterCommitShared.ts';
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
  const outer = roof.footprint ?? eaveOutlinePerEdge(roof.boundary, overhangs.map((d) => -d));
  return {
    outer: outer.slice(),
    holes: roof.holes.map((h) => h.slice()),
    flags: {
      outer: outer.map((_, i) => {
        const s = roof.edgeSlopes[i] ?? null;
        return { definesSlope: s !== null, slopePct: s ?? roof.slopePercent, overhang: overhangs[i] ?? 0 };
      }),
    },
  };
}

/** O que o telhado grava: beiral, pegada, furos, inclinação e balanço por aresta. */
interface RoofFields {
  boundary: Vec2[];
  footprint: Vec2[];
  holes: Vec2[][];
  edgeSlopes: Array<number | null>;
  edgeOverhangs: number[];
}

/** Traduz o resultado do esboço (lados na ordem do anel) em campos do telhado. Recusa balanço ou inclinação inválidos. */
function fieldsOf(outer: Vec2[], holes: Vec2[][], edges: FinishEdge[]): RoofFields | string {
  const overhangs = edges.map((e) => e.overhang);
  if (overhangs.some((v) => !Number.isFinite(v) || v < 0)) return 'Balanço inválido: use zero ou um valor positivo.';
  for (const e of edges) {
    const err = e.definesSlope ? roofSlopeError(e.slopePct) : null;
    if (err) return err;
  }
  return {
    boundary: eaveOutlinePerEdge(outer, overhangs),
    footprint: outer.slice(),
    holes,
    edgeSlopes: edges.map((e) => (e.definesSlope ? e.slopePct : null)),
    edgeOverhangs: overhangs,
  };
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
): CommitPerimeterResult {
  const f = fieldsOf(outer, holes, edges);
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
  const n = waterCount(after, levelId, id);
  return { ok: true, id, commands: [{ type: 'addRoof', roof }], message: `Telhado criado: ${n} ${n === 1 ? 'água' : 'águas'}.` };
}

function editRoof(p: Project, id: string, f: RoofFields, opts: CommitPerimeterOptions): CommitPerimeterResult {
  const el = p.elements[id];
  if (!el || !isRoof(el)) return refuse('Telhado não encontrado.');
  if (!isEdgeRoof(el)) return refuse('Este telhado não tem forma por arestas: edite-o pela própria ferramenta.');
  const patch: Partial<Roof> = { ...f, holes: keepOrder(el.holes, f.holes) };
  if (opts.heightOffset !== undefined) patch.heightOffset = opts.heightOffset;
  if (opts.axis) patch.dir = axisOr(opts.axis, el.dir);
  if (opts.mark !== undefined) patch.mark = opts.mark;
  if (opts.comments !== undefined) patch.comments = opts.comments;
  const next: Roof = { ...el, ...patch };
  const after = withElement(p, next);
  const problem = roofProblem(p, [next]) ?? newError(p, after, id, validateProject);
  if (problem) return refuse(`Alteração não aplicada: ${problem}`);
  const n = waterCount(after, el.levelId, id);
  return { ok: true, id, commands: [{ type: 'updateElements', ids: [id], patch }], message: `Telhado atualizado: ${n} ${n === 1 ? 'água' : 'águas'}.` };
}
