import { describe, expect, it } from 'vitest';
import { resolveRoofs } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof, type Roof } from '@hestia/model';
import { cantosLogicos, roofFootprint } from './roofs.ts';
import { gripsDoTelhado, pegadaDoTelhado, pontosDeAlca } from './roofsArcoEdge.ts';

const R = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];

function projeto(extra: Partial<Roof>) {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: R, shape: 'hip', slopePercent: 30, ...extra }) });
  return s.project;
}

describe('alças e pegada do telhado com arco', () => {
  it('só os cantos lógicos e o meio do arco levam alça no anel resolvido', () => {
    const p = projeto({ edgeSag: [-1.5, 0, 0, 0], footprint: R, edgeOverhangs: [0, 0, 0, 0] });
    const roof = p.elements.r1 as Roof;
    const res = resolveRoofs(p, 'lv_0')[0]!;
    const poly = roofFootprint(res)[0]![0]!;
    expect(poly.length).toBeGreaterThan(10);
    const flags = gripsDoTelhado(roof, cantosLogicos)(poly);
    expect(flags.filter(Boolean)).toHaveLength(pontosDeAlca(roof).length);
    expect(pontosDeAlca(roof)).toHaveLength(5);
  });

  it('telhado sem arco usa o critério antigo', () => {
    const roof = projeto({}).elements.r1 as Roof;
    expect(gripsDoTelhado(roof, cantosLogicos)).toBe(cantosLogicos);
  });

  it('pegada com arco vem amostrada; sem arco é a própria pegada', () => {
    const arco = projeto({ edgeSag: [-1.5, 0, 0, 0], footprint: R, edgeOverhangs: [0, 0, 0, 0] }).elements.r1 as Roof;
    expect(pegadaDoTelhado(arco)!.length).toBeGreaterThan(10);
    const reto = projeto({ footprint: R }).elements.r1 as Roof;
    expect(pegadaDoTelhado(reto)).toBe(reto.footprint);
    expect(pegadaDoTelhado(projeto({}).elements.r1 as Roof)).toBeNull();
  });
});
