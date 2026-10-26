import { describe, expect, it } from 'vitest';
import { resolverRotulo } from './zoomOps.ts';
import { createEmptyProject, makeWall, type Project, type Wall, type Opening } from '@hestia/model';
import { joinDebugLabels } from './joinDebug.ts';
import { wallTagLabels } from './tags.ts';
import { defaultPaint } from './style.ts';

const withWalls = (walls: Array<Omit<Wall, 'order'> & { order: number }>, openings: Opening[] = []): Project => {
  const p = createEmptyProject();
  for (const w of walls) p.elements[w.id] = w as Wall;
  for (const o of openings) p.elements[o.id] = o;
  p.nextOrder = walls.length + 1;
  return p;
};
const wall = (id: string, a: [number, number], b: [number, number], order: number, extra: Partial<Wall> = {}): Omit<Wall, 'order'> & { order: number } => ({
  ...makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] }, ...extra }),
  order,
});
const door = (hostId: string, offset: number, typeId = 'ot_p80'): Opening => ({
  id: `d_${hostId}_${offset}`,
  kind: 'door',
  typeId,
  hostId,
  offset,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
});

describe('etiquetas de parede (G4)', () => {
  it('sem vão, a etiqueta fica no ponto médio do eixo', () => {
    const labels = wallTagLabels(withWalls([wall('w', [0, 0], [4, 0], 1)]), 'lv_0', defaultPaint('annotation', 100), 100);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.text).toBe('PA-14');
    expect(labels[0]!.at.x).toBeCloseTo(2, 6);
    expect(labels[0]!.at.y).toBeCloseTo(0, 6);
  });
  it('com vão no meio, a etiqueta vai para o trecho cheio mais longo', () => {
    // Vão de 80 cm em t = 0,5: com folga do texto, bloqueia de -0,135 a 1,135 m; sobra 1,135 a 4 m.
    const labels = wallTagLabels(withWalls([wall('w', [0, 0], [4, 0], 1)], [door('w', 0.5)]), 'lv_0', defaultPaint('annotation', 100), 100);
    expect(labels).toHaveLength(1);
    expect(labels[0]!.at.x).toBeGreaterThanOrEqual(1.135);
    expect(labels[0]!.at.x).toBeLessThan(4);
  });
  it('parede totalmente coberta por vãos não recebe etiqueta', () => {
    const labels = wallTagLabels(withWalls([wall('w', [0, 0], [1, 0], 1)], [door('w', 0.5, 'ot_p160')]), 'lv_0', defaultPaint('annotation', 100), 100);
    expect(labels).toHaveLength(0);
  });
  it('tipo sem código não gera etiqueta', () => {
    const p = withWalls([wall('w', [0, 0], [4, 0], 1)]);
    p.wallTypes = { ...p.wallTypes, wt_alv14: { ...p.wallTypes.wt_alv14!, code: '' } };
    expect(wallTagLabels(p, 'lv_0', defaultPaint('annotation', 100), 100)).toHaveLength(0);
  });
  it('a fonte da etiqueta acompanha a escala do papel', () => {
    const p = withWalls([wall('w', [0, 0], [4, 0], 1)]);
    const fontAt = (scale: number): number => resolverRotulo(wallTagLabels(p, 'lv_0', defaultPaint('annotation', 100), scale)[0]!, 100).fontPx!;
    expect(fontAt(100) / fontAt(50)).toBeCloseTo(2, 6);
  });
});

describe('depuração de junção (G6)', () => {
  it('L com encosto: marcador B e ordem da parede mais antiga, uma só vez por ponto', () => {
    const labels = joinDebugLabels(withWalls([wall('a', [0, 0], [4, 0], 1), wall('b', [4, 0], [4, 3], 2)]), 'lv_0');
    expect(labels).toHaveLength(1);
    expect(labels[0]!.at).toEqual({ x: 4, y: 0 });
    expect(labels[0]!.text).toBe('B·1');
  });
  it('L com esquadria na parede mais antiga', () => {
    const miter = joinDebugLabels(withWalls([wall('a', [0, 0], [4, 0], 1, { joinEnd: { kind: 'miter', flip: false } }), wall('b', [4, 0], [4, 3], 2)]), 'lv_0');
    expect(miter.map((l) => l.text)).toEqual(['E·1']);
  });
  it('inverter a ordem (flip) troca a parede dominante', () => {
    const labels = joinDebugLabels(withWalls([wall('a', [0, 0], [4, 0], 1, { joinEnd: { kind: 'butt', flip: true } }), wall('b', [4, 0], [4, 3], 2)]), 'lv_0');
    expect(labels.map((l) => l.text)).toEqual(['B·2']);
  });
  it('T: marcador T no encontro, com a ordem da parede atravessada', () => {
    const labels = joinDebugLabels(withWalls([wall('a', [0, 0], [4, 0], 1), wall('b', [2, 0], [2, 3], 2)]), 'lv_0');
    expect(labels).toHaveLength(1);
    expect(labels[0]!.at).toEqual({ x: 2, y: 0 });
    expect(labels[0]!.text).toBe('T·1');
  });
  it('extremidade sem vizinho não gera marcador', () => {
    expect(joinDebugLabels(withWalls([wall('a', [0, 0], [4, 0], 1)]), 'lv_0')).toHaveLength(0);
  });
});
