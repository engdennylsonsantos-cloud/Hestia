import type { SketchDraft, SketchSeg } from '@hestia/geom';
import { withGeom, type Geom } from './perimeterModifyCurve.ts';

/** Linha pelo id, ou undefined. */
export function findSeg(d: SketchDraft, id: string): SketchSeg | undefined {
  return d.segs.find((s) => s.id === id);
}

/** Id `sN` livre no rascunho, registrado em `taken`. Mesmo critério de `addSegs`. */
export function freshId(taken: Set<string>): string {
  let k = 1;
  while (taken.has(`s${k}`)) k++;
  const id = `s${k}`;
  taken.add(id);
  return id;
}

/** Troca as linhas com o mesmo id pelas novas (ordem e demais linhas preservadas). Seleção intacta. */
export function replaceById(d: SketchDraft, next: Map<string, SketchSeg>): SketchDraft {
  return { ...d, segs: d.segs.map((s) => next.get(s.id) ?? s) };
}

/**
 * Troca uma linha por uma ou mais partes, na mesma posição. A primeira parte fica com o id original; as demais ganham
 * ids novos. Todas herdam os flags de telhado da linha original. Null se o id não existe.
 */
export function spliceSeg(d: SketchDraft, id: string, parts: Geom[]): SketchDraft | null {
  const at = d.segs.findIndex((s) => s.id === id);
  if (at < 0 || parts.length === 0) return null;
  const seg = d.segs[at]!;
  const taken = new Set(d.segs.map((s) => s.id));
  const made = parts.map((g, i): SketchSeg => {
    const next = withGeom(seg, g);
    return i === 0 ? next : { ...next, id: freshId(taken) };
  });
  return { ...d, segs: [...d.segs.slice(0, at), ...made, ...d.segs.slice(at + 1)] };
}
