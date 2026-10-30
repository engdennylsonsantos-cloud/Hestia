import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { generateStraightRun } from '@hestia/engine';
import { defaultStairTypeId, makeSlab, type Project, type ProjectStore, type StairType } from '@hestia/model';
import { makeEnv } from './testEnv.ts';
import { treadItems, type TreadPreviewContext } from './stairPreview.ts';
import type { StairPart } from './stairSketchState.ts';
import type { PreviewItem } from './types.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const box = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [v(x0, y0), v(x1, y0), v(x1, y1), v(x0, y1)];

/** Escada reta em +x, largura 1,20 m, a partir da origem (o 1º espelho em x = 0). */
function straight(risers: number, tread = 0.28): StairPart[] {
  return [{ kind: 'run', run: generateStraightRun({ start: v(0, 0), dir: v(1, 0), width: 1.2, tread, risers }) }];
}

/** Acrescenta ao projeto a laje do nível de topo cobrindo toda a escada (a cobertura tira a chegada da prévia). */
function addSlab(store: ProjectStore): Project {
  store.exec({ type: 'addSlab', slab: makeSlab({ id: 'laje_topo', typeId: 'ls_mac12', levelId: 'lv_1', boundary: box(-10, -10, 20, 10) }) });
  return store.project;
}

const treads = (items: PreviewItem[]): Array<Extract<PreviewItem, { kind: 'polygon' }>> =>
  items.filter((i): i is Extract<PreviewItem, { kind: 'polygon' }> => i.kind === 'polygon' && i.tone === 'tread');

const context = (p: Project, type: StairType | null, risers: number, topLevelId: string | null = 'lv_1'): TreadPreviewContext => ({
  project: p,
  type,
  topLevelId,
  risers,
  riserHeight: 2.8 / risers,
});

describe('prévia dos degraus: a chegada só aparece quando ela é um degrau', () => {
  it('reta monolítica sem laje: N pisos (N − 1 + chegada), com a chegada em min(próximo piso, 0,30 m)', () => {
    const p = makeEnv().store.project;
    const type = p.stairTypes[defaultStairTypeId]!;
    const items = treads(treadItems(straight(16), context(p, type, 16)));
    expect(items).toHaveLength(16);
    const xs = items[items.length - 1]!.ring.map((q) => q.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.28, 9);
  });

  it('reta monolítica sem laje: espelhos mais largos que 0,30 m limitam a chegada a 0,30 m', () => {
    const p = makeEnv().store.project;
    const type = p.stairTypes[defaultStairTypeId]!;
    const items = treads(treadItems(straight(8, 0.4), context(p, type, 8)));
    expect(items).toHaveLength(8);
    const xs = items[items.length - 1]!.ring.map((q) => q.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.3, 9);
  });

  it('reta monolítica com laje cobrindo o último espelho: N − 1 pisos, sem chegada', () => {
    const p = addSlab(makeEnv().store);
    const type = p.stairTypes[defaultStairTypeId]!;
    expect(treads(treadItems(straight(16), context(p, type, 16)))).toHaveLength(15);
  });

  it('barra sem nível de topo: `topLevelId` null vale "sem cobertura", como no modelo, e a chegada aparece', () => {
    const p = addSlab(makeEnv().store);
    const type = p.stairTypes[defaultStairTypeId]!;
    expect(treads(treadItems(straight(16), context(p, type, 16, null)))).toHaveLength(16);
  });

  it('montada e poste: N − 1 sempre, com ou sem laje', () => {
    for (const typeId of ['stt_piso_espelho', 'stt_caracol_poste']) {
      const sem = makeEnv().store.project;
      expect(treads(treadItems(straight(16), context(sem, sem.stairTypes[typeId]!, 16))), typeId).toHaveLength(15);
      const com = addSlab(makeEnv().store);
      expect(treads(treadItems(straight(16), context(com, com.stairTypes[typeId]!, 16))), typeId).toHaveLength(15);
    }
  });
});
