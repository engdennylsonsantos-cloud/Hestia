import { offsetEdge, roofPatchProblem, roofSlopeError, type RoofEdgeSel } from '@hestia/tools';
import { isRoof, type Id, type Project, type ProjectStore, type Roof } from '@hestia/model';
import { useUi } from './state.ts';

const say = (msg: string): void => useUi.setState({ status: msg });

/**
 * Aplica `patch` aos telhados `ids` só se o motor ainda gerar águas para eles; senão não aplica e diz o motivo na barra
 * de status. Única porta de alteração de telhado pela interface de Propriedades e pelo atalho de aresta.
 */
export function applyRoofPatch(store: ProjectStore, ids: Id[], patch: Partial<Roof>): boolean {
  if (Object.keys(patch).length === 0) return true;
  const problem = roofPatchProblem(store.project, ids, patch);
  if (problem) {
    say(`Alteração não aplicada: ${problem}`);
    return false;
  }
  store.exec({ type: 'updateElements', ids, patch });
  return true;
}

/** Telhado da aresta escolhida, se o telhado e a aresta ainda existem. */
export function edgeRoof(p: Project, sel: RoofEdgeSel | null): Roof | null {
  if (!sel) return null;
  const r = p.elements[sel.roofId];
  return isRoof(r) && sel.index >= 0 && sel.index < r.boundary.length ? r : null;
}

/** Forma de "por arestas" para a aresta: telhado de águas livres ou extrusão mantêm a forma; os demais passam a 'edges'. */
const edgeShape = (r: Roof): Partial<Roof> => (r.shape === 'free' || r.shape === 'extrusion' ? {} : { shape: 'edges' });

/** Liga ("define inclinação" com a inclinação padrão do telhado) ou desliga (empena) a aresta. */
export function setEdgeDefines(store: ProjectStore, r: Roof, index: number, on: boolean): boolean {
  const edgeSlopes = r.edgeSlopes.map((v, k) => (k === index ? (on ? r.slopePercent : null) : v));
  return applyRoofPatch(store, [r.id], { ...edgeShape(r), edgeSlopes });
}

/** Inclinação da aresta (só numa aresta que define inclinação), validada como a do telhado. */
export function setEdgeSlope(store: ProjectStore, r: Roof, index: number, percent: number): boolean {
  const err = roofSlopeError(percent);
  if (err) {
    say(err);
    return false;
  }
  const edgeSlopes = r.edgeSlopes.map((v, k) => (k === index ? percent : v));
  return applyRoofPatch(store, [r.id], { ...edgeShape(r), edgeSlopes });
}

/**
 * Balanço da aresta: a aresta anda para fora (positivo) ou para dentro, pela diferença para o balanço anterior, e o
 * vetor `edgeOverhangs` guarda o novo valor. Se a aresta não puder andar (vizinhas paralelas), não altera nada.
 */
export function setEdgeOverhang(store: ProjectStore, r: Roof, index: number, overhang: number): boolean {
  const delta = overhang - (r.edgeOverhangs[index] ?? 0);
  const ring = Math.abs(delta) < 1e-9 ? r.boundary : offsetEdge(r.boundary, index, delta);
  if (!ring) {
    say('Esta aresta não pode ser deslocada: a aresta vizinha é paralela a ela.');
    return false;
  }
  const edgeOverhangs = r.edgeOverhangs.map((v, k) => (k === index ? overhang : v));
  return applyRoofPatch(store, [r.id], { boundary: ring, edgeOverhangs });
}

/** Alterna "define inclinação" da aresta escolhida na planta. */
export function toggleRoofEdgeDefines(store: ProjectStore, sel: RoofEdgeSel | null): boolean {
  const r = edgeRoof(store.project, sel);
  if (!r || !sel) return false;
  const on = r.edgeSlopes[sel.index] === null || r.edgeSlopes[sel.index] === undefined;
  return setEdgeDefines(store, r, sel.index, on);
}

/** Tecla "I" com uma aresta escolhida na planta: alterna "define inclinação". Devolve true quando consumiu a tecla. */
export function roofEdgeKey(key: string, store: ProjectStore): boolean {
  const sel = useUi.getState().roofEdge;
  if (!sel || !/^i$/i.test(key)) return false;
  toggleRoofEdgeDefines(store, sel);
  return true;
}
