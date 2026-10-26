import { equal, len, multiArea, norm, type SketchDraft, type Vec2 } from '@hestia/geom';
import { resolveRoofs } from '@hestia/engine';
import { validateProject, type Element, type Id, type Project, type ValidationIssue } from '@hestia/model';
import { setDefaults } from './perimeterSession.ts';
import type { CommitPerimeterOptions, CommitPerimeterResult } from './perimeterCommitTypes.ts';

/** Recusa: nada é criado nem alterado; a mensagem diz o motivo. */
export const refuse = (message: string): CommitPerimeterResult => ({ ok: false, message });

/** Projeto com `el` no lugar do guardado (ou acrescentado): a versão que o modelo teria depois do comando. */
export function withElement(p: Project, el: Element): Project {
  return { ...p, elements: { ...p.elements, [el.id]: el } };
}

/** Mensagens dos erros do validador que citam o elemento `id`. */
function ownErrors(issues: ValidationIssue[], id: Id): Set<string> {
  return new Set(issues.filter((i) => i.severity === 'error' && (i.elementId === id || i.ids?.includes(id))).map((i) => i.message));
}

/**
 * Primeiro erro que `after` traz para `id` e `before` não tinha. Erro que já existia não recusa a edição: só o que a
 * alteração cria. `before` ausente (criação) conta como projeto sem o elemento.
 */
export function newError(before: Project, after: Project, id: Id, check: (p: Project) => ValidationIssue[] = validateProject): string | null {
  const old = ownErrors(check(before), id);
  for (const m of ownErrors(check(after), id)) if (!old.has(m)) return m;
  return null;
}

/** Mesmos vértices (como conjunto, a menos de 1 µm), sem levar em conta a ordem. */
export function sameVertexSet(a: Vec2[], b: Vec2[]): boolean {
  return a.length === b.length && a.every((p) => b.some((q) => equal(p, q)));
}

/**
 * Devolve os laços `got` na ordem de `orig` (casados pelos vértices). O esboço reordena os laços por área; ao editar,
 * a ordem original volta para que um elemento não editado saia igual. Laço sem par vai ao fim, na ordem dada.
 */
export function keepOrder(orig: Vec2[][], got: Vec2[][]): Vec2[][] {
  const rest = got.slice();
  const out: Vec2[][] = [];
  for (const o of orig) {
    const k = rest.findIndex((g) => sameVertexSet(o, g));
    if (k >= 0) out.push(rest.splice(k, 1)[0]!);
  }
  return [...out, ...rest];
}

/** Rascunho com o balanço e a inclinação padrão das opções, quando vierem nelas. */
export function withDefaults(d: SketchDraft, opts: CommitPerimeterOptions): SketchDraft {
  const patch: Partial<SketchDraft['defaults']> = {};
  if (opts.overhang !== undefined) patch.overhang = opts.overhang;
  if (opts.slopePct !== undefined) patch.slopePct = opts.slopePct;
  return Object.keys(patch).length > 0 ? setDefaults(d, patch) : d;
}

/** `want` quando existe no registro; senão a primeira chave (o primeiro tipo do projeto); undefined sem tipos. */
export function pickTypeId(types: Record<Id, unknown>, want?: Id): Id | undefined {
  if (want && types[want]) return want;
  return Object.keys(types)[0];
}

/** Eixo unitário do valor dado, ou `fallback` quando o vetor é nulo ou ausente. */
export function axisOr(axis: Vec2 | undefined, fallback: Vec2): Vec2 {
  if (!axis || len(axis) < 1e-9) return fallback;
  return norm(axis);
}

/** Número de águas que o motor gera para o telhado `id` no projeto dado (0 quando não gera). */
export function waterCount(p: Project, levelId: Id, id: Id): number {
  return resolveRoofs(p, levelId).find((x) => x.roofId === id)?.planes.length ?? 0;
}

/** Área líquida (contorno menos furos) em m², com vírgula decimal. */
export function areaText(outer: Vec2[], holes: Vec2[][]): string {
  return `${multiArea([[outer, ...holes]]).toFixed(2).replace('.', ',')} m²`;
}
