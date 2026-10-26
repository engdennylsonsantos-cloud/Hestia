import type { SketchResult, SketchSeg } from './sketchTypes.ts';

/** Agrupa as linhas em laços e aplica as regras de validação do esboço. (Stub: implementação na onda 1.) */
export function validateSketch(_segs: SketchSeg[]): SketchResult {
  return { loops: [], issues: [{ code: 'empty', message: 'Esboço vazio.', segIds: [] }], ok: false };
}
