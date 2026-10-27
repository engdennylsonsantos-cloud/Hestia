import { describe, expect, it } from 'vitest';
import { v2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project } from '@hestia/model';
import { resolveRoofs, roofSurfaceIssues } from './index.ts';

/** Projeto com um telhado 'edges' sobre o contorno dado (o esqueleto real, sem stub). */
function project(boundary: { x: number; y: number }[], edgeSlopes: Array<number | null>, mark = ''): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary, shape: 'edges', edgeSlopes, heightOffset: 0, mark }) });
  return s.project;
}

describe('superfície em canto reentrante com empena (degrau que a envoltória fecha)', () => {
  // Caso da auditoria: vértice (1;6) com cotas 0, 0,6 e 0,6 (empena (1;6)-(2;5) encosta no beiral (3;7)-(1;6)).
  const FIXED = [v2(2, 5), v2(0, 5), v2(0, 7), v2(3, 7), v2(1, 6)];

  it('canto reentrante com empena: a superfície fecha sem degrau, então não há aviso de degrau', () => {
    // Antes, o esqueleto deixava degrau de 60 cm aqui e o aviso roof-surface-step apontava o telhado. Agora a envoltória
    // dos planos das arestas inclinadas fecha a superfície (Revit), e o aviso só existiria se o degrau sobrevivesse.
    const p = project(FIXED, [60, 60, null, 60, null]);
    expect(roofSurfaceIssues(p)).toEqual([]);
  });

  it('o telhado continua criado e com águas, sem degrau', () => {
    const p = project(FIXED, [60, 60, null, 60, null]);
    const r = resolveRoofs(p, 'lv_0')[0]!;
    expect(r.planes.length).toBeGreaterThan(0);
    expect(r.problem).toBeUndefined();
    expect(r.steps).toBeUndefined();
  });

  it('retângulo com duas águas (superfície contínua): sem aviso', () => {
    const rect = [v2(0, 0), v2(8, 0), v2(8, 6), v2(0, 6)];
    expect(roofSurfaceIssues(project(rect, [30, null, 30, null]))).toEqual([]);
  });
});
