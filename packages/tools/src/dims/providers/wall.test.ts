import { describe, expect, it } from 'vitest';
import { createEmptyProject, dimensionSettingsOf, makeWall, ProjectStore, type Opening, type Project } from '@hestia/model';
import { wallDimProvider } from './wall.ts';
import type { DimContext, TempDim } from '../types.ts';

type Seg = [string, [number, number], [number, number]];

/** Projeto com as paredes dadas (alvenaria 14: face acabada a 0,092 do eixo) e a hospedeira `host` de (0,0) a (4,0). */
function cena(outras: Seg[], hostSeg: Seg = ['host', [0, 0], [4, 0]]): { ctx: DimContext; project: Project } {
  const s = new ProjectStore(createEmptyProject());
  for (const [id, a, b] of [hostSeg, ...outras]) {
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }) });
  }
  const door: Opening = { id: 'd', kind: 'door', typeId: 'ot_p80', hostId: 'host', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: 'P1' };
  if (hostSeg[2][0] - hostSeg[1][0] >= 1) s.exec({ type: 'addOpening', opening: door });
  const p = s.project;
  return { ctx: { project: p, levelId: 'lv_0', settings: dimensionSettingsOf(p), overrides: {} }, project: p };
}

const dimsOf = (ctx: DimContext): TempDim[] => wallDimProvider.compute(ctx, { wallId: 'host' });
const translate = (d: TempDim, v: number): { x: number; y: number } => {
  const r = d.edit!(v);
  if (!('commands' in r)) throw new Error('esperava comandos');
  const c = r.commands[0]!;
  if (c.type !== 'transform' || c.transform.kind !== 'translate') throw new Error('esperava translação');
  return c.transform.d;
};

describe('cota temporária da parede: ponta até a perpendicular mais próxima', () => {
  it('nunca cota o comprimento da própria parede', () => {
    const { ctx } = cena([]);
    expect(dimsOf(ctx)).toEqual([]);
    const { ctx: c2 } = cena([['p', [5, -2], [5, 2]]]);
    expect(dimsOf(c2).some((d) => Math.abs(d.value - 4) < 1e-9 || d.key.endsWith(':length'))).toBe(false);
  });

  it('perpendicular além da ponta b: mede da ponta até a face acabada voltada para a parede', () => {
    const { ctx } = cena([['p', [5, -2], [5, 2]]]);
    const dims = dimsOf(ctx);
    expect(dims).toHaveLength(1);
    expect(dims[0]!.value).toBeCloseTo(1 - 0.092, 9);
    expect(dims[0]!.a.x).toBeCloseTo(4, 9);
    expect(dims[0]!.b.x).toBeCloseTo(4.908, 9);
    expect(dims[0]!.ends.every((e) => e.kind === 'wall')).toBe(true);
  });

  it('perpendiculares dos dois lados: uma cota por ponta, cada uma até a mais próxima', () => {
    const { ctx } = cena([['p1', [5, -2], [5, 2]], ['p2', [7, -2], [7, 2]], ['q', [-0.5, -2], [-0.5, 2]]]);
    const dims = dimsOf(ctx);
    expect(dims).toHaveLength(2);
    const vals = dims.map((d) => d.value).sort((x, y) => x - y);
    expect(vals[0]).toBeCloseTo(0.5 - 0.092, 9);
    expect(vals[1]).toBeCloseTo(1 - 0.092, 9);
  });

  it('em T e em L (perpendicular encostada na ponta) não há vão a cotar', () => {
    expect(dimsOf(cena([['t', [4, -2], [4, 2]]]).ctx)).toEqual([]);
    expect(dimsOf(cena([['l', [4, 0], [4, 3]]]).ctx)).toEqual([]);
  });

  it('perpendicular que o prolongamento do eixo não alcança não é alvo', () => {
    const { ctx } = cena([['p', [5, 1], [5, 3]]]);
    expect(dimsOf(ctx)).toEqual([]);
  });

  it('com referência de sessão no eixo mede até o eixo da perpendicular', () => {
    const { ctx } = cena([['p', [5, -2], [5, 2]]]);
    const dims = dimsOf({ ...ctx, overrides: { 'wall:wall': 'axis' } });
    expect(dims[0]!.value).toBeCloseTo(1, 9);
  });

  it('parede curta (0,3 m) também cota até a perpendicular', () => {
    const { ctx } = cena([['p', [1, -2], [1, 2]]], ['host', [0, 0], [0.3, 0]]);
    const dims = dimsOf(ctx);
    expect(dims).toHaveLength(1);
    expect(dims[0]!.value).toBeCloseTo(0.7 - 0.092, 9);
  });

  it('editar a ponta b translada a parede para mudar o vão (hospedados acompanham)', () => {
    const { ctx } = cena([['p', [5, -2], [5, 2]]]);
    const t = translate(dimsOf(ctx)[0]!, 0.5);
    expect(t.x).toBeCloseTo(0.908 - 0.5, 9);
    expect(t.y).toBeCloseTo(0, 9);
  });

  it('editar a ponta a translada no sentido contrário', () => {
    const { ctx } = cena([['q', [-1, -2], [-1, 2]]]);
    const d = dimsOf(ctx)[0]!;
    expect(d.value).toBeCloseTo(0.908, 9);
    expect(translate(d, 0.5).x).toBeCloseTo(-(0.908 - 0.5), 9);
  });

  it('zero, negativo e NaN são recusados sem comando', () => {
    const { ctx } = cena([['p', [5, -2], [5, 2]]]);
    const d = dimsOf(ctx)[0]!;
    for (const v of [0, -1, Number.NaN]) expect(d.edit!(v)).toEqual({ error: expect.stringContaining('maior que zero') });
  });
});

describe('cota temporária da parede: distância lateral até as paralelas', () => {
  it('mede até a paralela mais próxima de CADA lado, entre faces acabadas', () => {
    const { ctx } = cena([['viz', [0, 2], [4, 2]], ['longe', [0, -5], [4, -5]], ['mais', [0, 6], [4, 6]]]);
    const dims = dimsOf(ctx);
    expect(dims).toHaveLength(2);
    const dir = dims.find((d) => d.key.endsWith(':right'))!;
    const esq = dims.find((d) => d.key.endsWith(':left'))!;
    // 2 m entre eixos − 0,092 − 0,092; do outro lado 5 − 0,184.
    expect(dir.value).toBeCloseTo(1.816, 9);
    expect(esq.value).toBeCloseTo(4.816, 9);
    expect(Math.abs(dir.a.y - dir.b.y)).toBeCloseTo(1.816, 9);
    expect(dir.a.x).toBeCloseTo(dir.b.x, 9);
  });

  it('a paralela do lado esquerdo é medida pela face voltada para ela', () => {
    const { ctx } = cena([['viz', [0, -2], [4, -2]]]);
    expect(dimsOf(ctx)[0]!.value).toBeCloseTo(1.816, 9);
  });

  it('a lateral tem preferência sobre o vão axial até a perpendicular', () => {
    const { ctx } = cena([['viz', [0, 2], [4, 2]], ['p', [5, -2], [5, 2]]]);
    const dims = dimsOf(ctx);
    expect(dims).toHaveLength(1);
    expect(dims[0]!.key.endsWith(':right')).toBe(true);
    expect(dims[0]!.value).toBeCloseTo(1.816, 9);
  });

  it('paralela que não se sobrepõe ao longo do eixo não conta', () => {
    const { ctx } = cena([['fora', [6, 2], [9, 2]]]);
    expect(dimsOf(ctx)).toEqual([]);
  });

  it('parede vertical selecionada: cotas laterais até as paralelas vizinhas (e não até o fim da parede)', () => {
    const s: Seg[] = [['esq', [-3, -2], [-3, 6]], ['dir', [2, -1], [2, 5]], ['topo', [-3, 8], [2, 8]]];
    const { ctx } = cena(s, ['host', [0, 0], [0, 4]]);
    const dims = dimsOf(ctx);
    expect(dims.map((d) => d.key.split(':')[2]).sort()).toEqual(['left', 'right']);
    for (const d of dims) expect(Math.abs(d.a.y - d.b.y)).toBeCloseTo(0, 9);
    expect(dims.map((d) => d.value).sort()).toEqual([expect.closeTo(1.816, 9), expect.closeTo(2.816, 9)]);
  });

  it('ida e volta: digitar v deixa exatamente v, nos dois lados e em ângulo qualquer', () => {
    const ang = Math.PI / 6;
    const c = Math.cos(ang);
    const sn = Math.sin(ang);
    const rot = (x: number, y: number): [number, number] => [x * c - y * sn, x * sn + y * c];
    for (const v of [0.4, 1.816, 3]) {
      const outras: Seg[] = [['up', rot(0, 2), rot(4, 2)], ['dn', rot(0, -3), rot(4, -3)]];
      const { ctx } = cena(outras, ['host', rot(0, 0), rot(4, 0)]);
      for (const sufixo of ['right', 'left']) {
        const dim = dimsOf(ctx).find((d) => d.key.endsWith(`:${sufixo}`))!;
        const d = translate(dim, v);
        const mov = cena(outras, ['host', [rot(0, 0)[0] + d.x, rot(0, 0)[1] + d.y], [rot(4, 0)[0] + d.x, rot(4, 0)[1] + d.y]]);
        expect(dimsOf(mov.ctx).find((x) => x.key.endsWith(`:${sufixo}`))!.value).toBeCloseTo(v, 6);
      }
    }
  });

  it('editar aproxima a parede quando o valor diminui e afasta quando aumenta', () => {
    const { ctx } = cena([['viz', [0, 2], [4, 2]]]);
    const aproxima = translate(dimsOf(ctx)[0]!, 1.5);
    expect(aproxima.x).toBeCloseTo(0, 9);
    expect(aproxima.y).toBeCloseTo(0.316, 9);
    expect(translate(dimsOf(ctx)[0]!, 3).y).toBeCloseTo(-1.184, 9);
  });

  it('valor não positivo é recusado', () => {
    const { ctx } = cena([['viz', [0, 2], [4, 2]]]);
    expect(dimsOf(ctx)[0]!.edit!(0)).toEqual({ error: expect.stringContaining('maior que zero') });
    expect(dimsOf(ctx)[0]!.edit!(Number.NaN)).toEqual({ error: expect.stringContaining('maior que zero') });
  });
});

describe('seleção', () => {
  it('seleciona só parede', () => {
    const { ctx } = cena([]);
    expect(wallDimProvider.selectionSubject!(ctx.project, 'host')).toEqual({ wallId: 'host' });
    expect(wallDimProvider.selectionSubject!(ctx.project, 'd')).toBeNull();
  });
});
