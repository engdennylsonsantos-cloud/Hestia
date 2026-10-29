import { describe, expect, it } from 'vitest';
import { frameOfWall, pointAt } from '@hestia/engine';
import { createEmptyProject, makeWall, ProjectStore, type LocationLine, type Project, type WallDimRef } from '@hestia/model';
import { hostTargets } from './refs.ts';

interface Viz {
  id: string;
  a: [number, number];
  b: [number, number];
  typeId?: string;
  locationLine?: LocationLine;
  sag?: number;
}

/** Projeto com a parede `h` (hospedeira) e as vizinhas dadas. `wt_assim` = reboco de 2 cm + núcleo de 14 cm. */
function cena(walls: Viz[]): Project {
  const s = new ProjectStore(createEmptyProject());
  const base = s.project.wallTypes['wt_alv14']!;
  const layers = [
    { function: 'finish2' as const, materialId: 'mat_reboco', thickness: 0.02, wraps: false },
    { function: 'structure' as const, materialId: 'mat_bloco14', thickness: 0.14, wraps: false },
  ];
  s.exec({ type: 'upsertWallType', wallType: { ...base, id: 'wt_assim', layers } });
  for (const w of walls) {
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: w.id, typeId: w.typeId ?? 'wt_alv14', levelId: 'lv_0', a: { x: w.a[0], y: w.a[1] }, b: { x: w.b[0], y: w.b[1] }, locationLine: w.locationLine ?? 'wallCenter', sag: w.sag ?? 0 }),
    });
  }
  return s.project;
}

const alvo = (p: Project, t0: number, ref: WallDimRef) => hostTargets(p, frameOfWall(p, 'h')!, t0, ref);

describe('hostTargets', () => {
  it('cruz em T: eixo e faces da vizinha de cada lado, nas 4 referências', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [6, 0] },
      { id: 'e', a: [2, 0], b: [2, 4] },
      { id: 'd', a: [5, -3], b: [5, 0] },
    ]);
    const T = frameOfWall(p, 'e')!.thickness;
    const core = 0.14;
    expect(alvo(p, 3.5, 'axis').left.t).toBeCloseTo(2, 6);
    expect(alvo(p, 3.5, 'axis').right.t).toBeCloseTo(5, 6);
    expect(alvo(p, 3.5, 'finish').left.t).toBeCloseTo(2 + T / 2, 6);
    expect(alvo(p, 3.5, 'finish').right.t).toBeCloseTo(5 - T / 2, 6);
    expect(alvo(p, 3.5, 'coreCenter').left.t).toBeCloseTo(2, 6);
    expect(alvo(p, 3.5, 'coreFace').left.t).toBeCloseTo(2 + core / 2, 6);
    expect(alvo(p, 3.5, 'coreFace').right.t).toBeCloseTo(5 - core / 2, 6);
    expect(alvo(p, 3.5, 'finish').left).toMatchObject({ ownerId: 'e', kind: 'wall' });
    expect(alvo(p, 3.5, 'finish').right).toMatchObject({ ownerId: 'd', kind: 'wall' });
  });

  it('vizinha de 2 camadas assimétricas: a face voltada para a abertura depende do lado', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [8, 0] },
      // a→b para cima: n aponta para −x; locationLine na face externa (s = 0) e espessura para s negativo → x de 2,00 a 2,16.
      { id: 'v', a: [2, 0], b: [2, 4], typeId: 'wt_assim', locationLine: 'finishExterior' },
    ]);
    // Abertura à direita da vizinha: a face voltada para ela é a de x = 2,16 (acabada) ou de núcleo (também 2,16).
    expect(alvo(p, 4, 'finish').left.t).toBeCloseTo(2.16, 6);
    expect(alvo(p, 4, 'coreFace').left.t).toBeCloseTo(2.16, 6);
    expect(alvo(p, 4, 'axis').left.t).toBeCloseTo(2.08, 6);
    expect(alvo(p, 4, 'coreCenter').left.t).toBeCloseTo(2.09, 6);
    // Abertura à esquerda: a face voltada é a de x = 2,00 (acabada) ou a do núcleo, a 2,02.
    expect(alvo(p, 1, 'finish').right.t).toBeCloseTo(2, 6);
    expect(alvo(p, 1, 'coreFace').right.t).toBeCloseTo(2.02, 6);
  });

  it('L na ponta do hospedeiro: o canto vale como vizinha à esquerda', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [6, 0] },
      { id: 'l', a: [0, 0], b: [0, 4] },
    ]);
    const T = frameOfWall(p, 'l')!.thickness;
    const r = alvo(p, 3, 'finish');
    expect(r.left).toMatchObject({ ownerId: 'l', kind: 'wall' });
    expect(r.left.t).toBeCloseTo(T / 2, 6);
    expect(r.right).toEqual({ t: 6, ownerId: null, kind: 'end' });
  });

  it('sem vizinha: extremidades do hospedeiro, para qualquer referência', () => {
    const p = cena([{ id: 'h', a: [0, 0], b: [5, 0] }]);
    for (const ref of ['axis', 'finish', 'coreCenter', 'coreFace'] as const) {
      expect(alvo(p, 2, ref)).toEqual({ left: { t: 0, ownerId: null, kind: 'end' }, right: { t: 5, ownerId: null, kind: 'end' } });
    }
  });

  it('abertura próxima da ponta: só o outro lado tem vizinha', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [6, 0] },
      { id: 'v', a: [4, 0], b: [4, 3] },
    ]);
    const r = alvo(p, 0.5, 'axis');
    expect(r.left).toEqual({ t: 0, ownerId: null, kind: 'end' });
    expect(r.right).toMatchObject({ ownerId: 'v' });
    expect(r.right.t).toBeCloseTo(4, 6);
  });

  it('ignora paredes paralelas e escolhe a vizinha mais próxima', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [8, 0] },
      { id: 'par', a: [0, 2], b: [8, 2] },
      { id: 'v1', a: [1, 0], b: [1, 3] },
      { id: 'v2', a: [3, 0], b: [3, 3] },
      { id: 'v3', a: [7, 0], b: [7, 3] },
    ]);
    const r = alvo(p, 4, 'axis');
    expect(r.left).toMatchObject({ ownerId: 'v2', t: expect.closeTo(3, 6) });
    expect(r.right).toMatchObject({ ownerId: 'v3', t: expect.closeTo(7, 6) });
  });

  it('hospedeiro curvo: o alvo cai sobre o arco, na face da vizinha', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [6, 0], sag: 0.6 },
      { id: 'v', a: [3, -2], b: [3, 3] },
    ]);
    const f = frameOfWall(p, 'h')!;
    expect(f.arc).not.toBeNull();
    const r = hostTargets(p, f, 0.2, 'axis');
    // Abertura perto do início: a vizinha em x = 3 fica à direita; o ponto do arco no alvo tem x ≈ 3.
    expect(r.right.kind).toBe('wall');
    expect(r.right.t).toBeGreaterThan(0.2);
    expect(r.right.t).toBeLessThan(f.length);
    expect(pointAt(f, r.right.t, f.sMid).x).toBeCloseTo(3, 2);
  });

  it('vizinha que não alcança o hospedeiro não conta', () => {
    const p = cena([
      { id: 'h', a: [0, 0], b: [6, 0] },
      { id: 'v', a: [3, 1], b: [3, 4] },
    ]);
    const r = alvo(p, 1, 'finish');
    expect(r.right).toEqual({ t: 6, ownerId: null, kind: 'end' });
  });
});
