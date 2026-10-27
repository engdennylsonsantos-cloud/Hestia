import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Roof } from '@hestia/model';
import { roofGripAt } from './roofPick.ts';
import { roofOverhangPatch, roofRingPatch } from './roofEdges.ts';
import { roofSagHold } from './roofSagGrip.ts';
import { ringHandlePreview } from './selectGrips.ts';
import type { PointerInfo, ToolEnv } from './types.ts';

const R: Vec2[] = [
  { x: 0, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 6 },
  { x: 0, y: 6 },
];
// Aresta 0 (y = 0) em arco que abaula para baixo (direita do percurso), flecha 1,5.
const arco = (extra: Partial<Roof> = {}): Roof => ({ ...makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary: R, shape: 'edges', slopePercent: 30, edgeSag: [-1.5, 0, 0, 0], ...extra }), order: 0 });

function env(roof: Roof) {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addRoof', roof: { ...roof, order: undefined } as never });
  const said: string[] = [];
  const e = {
    project: () => store.project,
    levelId: () => 'lv_0',
    selection: () => ['r1'],
    exec: (c: Parameters<ToolEnv['exec']>[0]) => store.exec(c),
    say: (m: string) => said.push(m),
  } as unknown as ToolEnv;
  return { e, store, said };
}
const ptr = (x: number, y: number): PointerInfo => ({ raw: { x, y } }) as unknown as PointerInfo;

describe('alças do telhado com arco', () => {
  it('o meio do arco vira alça de flecha; o meio de reta continua inserindo vértice', () => {
    const { store } = env(arco());
    const sag = roofGripAt(store.project, ['r1'], { x: 4, y: -1.5 }, 0.01);
    expect(sag?.kind).toBe('sag');
    expect(sag?.index).toBe(0);
    const reta = roofGripAt(store.project, ['r1'], { x: 8, y: 3 }, 0.01);
    expect(reta?.kind).toBe('edge');
    // O meio da corda (4, 0) já não é alça.
    expect(roofGripAt(store.project, ['r1'], { x: 4, y: 0 }, 0.01)).toBeNull();
    // Cantos lógicos e uma alça por aresta: 4 + 4 pontos; o do arco está no meio do arco.
    const pts = ringHandlePreview(store.project, ['r1'], null).filter((i) => i.kind === 'point');
    expect(pts).toHaveLength(8);
    expect(pts.some((i) => i.kind === 'point' && Math.abs(i.at.x - 4) < 1e-6 && Math.abs(i.at.y + 1.5) < 1e-6)).toBe(true);
  });

  it('arrastar o meio altera edgeSag; passar de metade da corda é recusado', () => {
    const { e, store, said } = env(arco());
    const g = roofGripAt(store.project, ['r1'], { x: 4, y: -1.5 }, 0.01)!;
    if (g.kind !== 'sag') throw new Error('esperava alça de flecha');
    const hold = roofSagHold(e, g);
    hold.drag(ptr(4, -2.5), () => ({ x: 0, y: 0 }));
    hold.release(ptr(4, -2.5), () => undefined);
    expect((store.project.elements.r1 as Roof).edgeSag![0]).toBeCloseTo(-2.5, 2);

    const g2 = roofGripAt(store.project, ['r1'], { x: 4, y: -2.5 }, 0.01)!;
    if (g2.kind !== 'sag') throw new Error('esperava alça de flecha');
    const hold2 = roofSagHold(e, g2);
    hold2.drag(ptr(4, -5), () => ({ x: 0, y: 0 }));
    hold2.release(ptr(4, -5), () => undefined);
    expect((store.project.elements.r1 as Roof).edgeSag![0]).toBeCloseTo(-2.5, 2);
    expect(said.join(' ')).toMatch(/metade da corda/);
  });

  it('inserir e remover vértice mantém edgeSag do tamanho do contorno', () => {
    const r = arco();
    const ins = roofRingPatch(r, [R[0]!, { x: 4, y: -1.5 }, R[1]!, R[2]!, R[3]!], { kind: 'insert', edge: 0 });
    expect(ins.edgeSag).toHaveLength(5);
    expect(ins.edgeSag![0]).toBeLessThan(0);
    expect(ins.edgeSag![1]).toBeLessThan(0);
    const rem = roofRingPatch(r, [R[0]!, R[2]!, R[3]!], { kind: 'remove', vertex: 1 });
    expect(rem.edgeSag).toHaveLength(3);
    const mv = roofRingPatch(r, [R[0]!, { x: 1, y: 0 }, R[2]!, R[3]!], null);
    expect(mv.edgeSag![0]).toBeLessThan(0);
    expect(Math.abs(mv.edgeSag![0]!)).toBeLessThanOrEqual(3.5 + 1e-9);
  });

  it('balanço por aresta num telhado com arco refaz o beiral e mantém o tamanho das listas', () => {
    const r = arco();
    const patch = roofOverhangPatch(r, 1, 0.5)!;
    expect(patch.boundary).toHaveLength(4);
    expect(patch.edgeSag).toHaveLength(4);
    // A aresta 1 anda 0,5 m: a corda do arco cresce e a flecha (mesmo raio) acompanha, sem passar da metade da corda.
    expect(patch.edgeSag![0]).toBeLessThan(-1.4);
    expect(Math.abs(patch.edgeSag![0]!)).toBeLessThanOrEqual(Math.hypot(patch.boundary![1]!.x - patch.boundary![0]!.x, patch.boundary![1]!.y - patch.boundary![0]!.y) / 2);
  });
});
