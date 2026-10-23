import { describe, expect, it } from 'vitest';
import { multiArea } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeFloor, makeWall, type Layer, type LayerTermino } from '@hestia/model';
import { resolveFloors } from './floors.ts';

/**
 * Piso vinculado às paredes (circuito) com regra de parede (decisão 0025). Paredes `wt_alv14` (0,184 m: 2,2 cm de
 * reboco de cada lado e núcleo de 14 cm) formando um cômodo de 4 × 3 m. Circuito de acabamento: 3,816 × 2,816 m =
 * 10,745856 m² (o mesmo número de 0023 §9.2). Circuito de núcleo: 3,86 × 2,86 m = 11,0396 m².
 */

const M = { kind: 'miter' as const, flip: false };
const RETANGULO = [[0, 0], [4, 0], [4, 3], [0, 3]] as const;

function vinculado(termos: LayerTermino[]) {
  const base = createEmptyProject();
  const camadas: Layer[] = [
    { function: 'finish1', materialId: 'mat_ceramica', thickness: 0.01, wraps: false, termino: termos[0] },
    { function: 'substrate', materialId: 'mat_argamassa', thickness: 0.02, wraps: false, termino: termos[1] },
    { function: 'structure', materialId: 'mat_concreto', thickness: 0.1, wraps: false, termino: termos[2] },
  ];
  base.floorTypes.ft_t = { ...base.floorTypes.ft_unico!, id: 'ft_t', layers: camadas };
  const s = new ProjectStore(base);
  RETANGULO.forEach(([x, y], i) => {
    const [x2, y2] = RETANGULO[(i + 1) % 4]!;
    s.exec({ type: 'addWall', wall: makeWall({ id: `w${i}`, typeId: 'wt_alv14', levelId: 'lv_0', a: { x, y }, b: { x: x2, y: y2 }, height: 2.8, joinStart: M, joinEnd: M }) });
  });
  s.exec({
    type: 'addFloor',
    floor: makeFloor({
      id: 'f1',
      typeId: 'ft_t',
      levelId: 'lv_0',
      boundary: RETANGULO.map(([x, y]) => ({ x, y })),
      outlineSource: { mode: 'walls-finish', seed: { x: 2, y: 1.5 }, linked: true },
    }),
  });
  return resolveFloors(s.project, 'lv_0')[0]!;
}

describe('piso vinculado com regra de parede (decisão 0025)', () => {
  it('até a face: o circuito de acabamento, 10,745856 m² (o mesmo de 0023 §9.2)', () => {
    const f = vinculado(['face', 'face', 'passa']);
    expect(multiArea(f.layers[0]!.polygon)).toBeCloseTo(3.816 * 2.816, 6);
  });

  it('até a prioridade 1 (só o núcleo tem prioridade ≤ 1): o circuito de núcleo, 11,0396 m²', () => {
    const f = vinculado([{ ate: { prioridade: 1 } }, 'face', 'passa']);
    expect(multiArea(f.layers[0]!.polygon)).toBeCloseTo(3.86 * 2.86, 6);
  });

  it('passa por baixo: o cômodo mais a pegada das paredes que o cercam (4,184 × 3,184 m), maior que qualquer corte', () => {
    const f = vinculado(['passa', 'face', 'passa']);
    expect(multiArea(f.layers[0]!.polygon)).toBeCloseTo(4.184 * 3.184, 2);
    expect(multiArea(f.layers[0]!.polygon)).toBeGreaterThan(multiArea(vinculado([{ ate: { prioridade: 1 } }, 'face', 'passa']).layers[0]!.polygon));
    // A estrutura `passa` está abaixo do contato da parede (base no topo do piso): ancora no ELEMENTO, senão perde a
    // união da pegada das paredes (revisão de 2026-10-22).
    expect(multiArea(f.layers[2]!.polygon)).toBeCloseTo(4.184 * 3.184, 2);
  });
});
