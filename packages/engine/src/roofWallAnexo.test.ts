import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeRoof, makeWall, type Project, type Roof, type Wall } from '@hestia/model';
import { resolveLevel, roofWallIssues, wallZRange } from './index.ts';

/**
 * "Topo no telhado" pelo fluxo da UI (checkbox `#p-attachroof` em Properties.tsx, que grava `attachTopToRoof: true` por
 * `updateElements`). A parede nasce sem anexo e o topo resolvido tem de passar a seguir a face inferior do telhado.
 *
 * Telhado de 8 × 10 m (x −1..7, y −1..9), duas águas em y, beiral em 3 m (heightOffset 3), 30 %, tipo rt_ceramica
 * (espessura 0,095 m). Parede de (0,0) a (6,0): em y = 0 a água está em 3,30 m e a face inferior em 3,205 m; a cumeeira
 * (y = 4) fica em 4,50 m, face inferior 4,405 m. Parede perpendicular à cumeeira (dir em y): topo em V, 3,205 m nas
 * pontas e 4,105 m no meio.
 */
const T_ROOF = 0.095;
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function build(walls: Array<Omit<Wall, 'order'>>, roof: Partial<Roof> = {}): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({
      id: 'r1',
      typeId: 'rt_ceramica',
      levelId: 'lv_0',
      boundary: rect(-1, -1, 7, 9),
      shape: 'gable',
      slopePercent: 30,
      dir: { x: 0, y: 1 },
      heightOffset: 3,
      ...roof,
    }),
  });
  for (const w of walls) s.exec({ type: 'addWall', wall: w });
  return s.project;
}

const wall = (extra: Partial<Wall> = {}): Omit<Wall, 'order'> =>
  makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3, ...extra });

const zOf = (p: Project) => wallZRange(p, p.elements.w1 as Wall);

/** Marca "Topo no telhado" como a UI faz (um `updateElements`, sem telhado escolhido). */
const marcar = (p: Project): Project => {
  const s = new ProjectStore(p);
  s.exec({ type: 'updateElements', ids: ['w1'], patch: { attachTopToRoof: true } });
  return s.project;
};

describe('marcar "Topo no telhado" (fluxo da UI)', () => {
  it('parede perpendicular à cumeeira: antes reta em 3 m; depois do patch o topo segue a face inferior (V)', () => {
    const p = build([wall()]);
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });

    const z = zOf(marcar(p));
    expect(z.profile).toBeDefined();
    expect(z.height).toBeCloseTo(4.2 - T_ROOF, 6);
    const at = (t: number) => z.profile!.find((q) => Math.abs(q.t - t) < 1e-9)?.h;
    expect(at(0)).toBeCloseTo(3.205, 6);
    expect(at(3)).toBeCloseTo(4.105, 6);
    expect(at(6)).toBeCloseTo(3.205, 6);
  });

  it('o nível resolvido reflete o patch: a altura e as faixas da parede mudam', () => {
    const p = build([wall()]);
    expect(resolveLevel(p, 'lv_0').walls.w1!.height).toBe(3);

    const rw = resolveLevel(marcar(p), 'lv_0').walls.w1!;
    expect(rw.height).toBeCloseTo(4.105, 6);
    const topMax = Math.max(...rw.layers.flatMap((l) => l.bands.map((b) => b.z1)));
    expect(topMax).toBeCloseTo(4.105, 6);
  });

  it('telhado desenhado no nível de cima (a cobertura costuma ficar acima das paredes): o topo também acompanha', () => {
    // Mesmo telhado em lv_1 (cota 3): a face sobe 3 m. Na cumeeira (x = 3) fica em 3 + 3 + 0,3 × 4 = 7,20 m → 7,105 m.
    const p = build([wall()], { levelId: 'lv_1' });
    expect(zOf(p)).toEqual({ z0: 0, height: 3 });

    const z = zOf(marcar(p));
    expect(z.profile).toBeDefined();
    expect(z.height).toBeCloseTo(4.2 + 3 - T_ROOF, 6);
  });

  it('mudar o nível do telhado não desanexa a parede (setElementLevel mantém a cota)', () => {
    const p = build([wall({ attachTopToRoof: true })]);
    const h0 = zOf(p).height;
    const s = new ProjectStore(p);
    s.exec({ type: 'setElementLevel', ids: ['r1'], levelId: 'lv_1', keep: 'elevation' });
    expect(zOf(s.project).height).toBeCloseTo(h0, 9);
  });

  it('face de telhado abaixo da base não anexa: a parede não fica sem altura', () => {
    // Parede em lv_1 (base 3 m) sob um telhado de lv_0 com beiral em 0,5 m: a face fica abaixo da base.
    const p = build([wall({ levelId: 'lv_1', height: 2.8, attachTopToRoof: true })], { levelId: 'lv_0', heightOffset: 0.5 });
    const z = zOf(p);
    expect(z).toEqual({ z0: 3, height: 2.8 });
  });

  it('parede anexada sob telhado do nível de cima não gera o aviso de eixo fora do telhado', () => {
    const p = marcar(build([wall()], { levelId: 'lv_1' }));
    expect(roofWallIssues(p).map((i) => i.code)).toEqual([]);
  });
});
