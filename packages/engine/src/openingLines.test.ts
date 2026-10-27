import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { buildOpeningModel } from './openingModel.ts';
import { openingLinePaths } from './openingLines.ts';
import { frameOfWall, openingGeometry } from './resolve.ts';

interface Cena {
  p: Project;
  o: Opening;
  t: OpeningType;
}

function cena(base: string, extra: Partial<OpeningType> = {}, flips: { flipHand?: boolean; flipFacing?: boolean } = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset: 2,
      flipHand: flips.flipHand ?? false,
      flipFacing: flips.flipFacing ?? false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  return { p, o: p.elements.v as Opening, t: p.openingTypes.ot_x! };
}

const modelo = (c: Cena) => buildOpeningModel(c.p, c.o, openingGeometry(c.p, c.o, frameOfWall(c.p, 'w')!), frameOfWall(c.p, 'w')!);
const PADRAO = { apex: 'latch', dashed: 'toward' } as const;
const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('openingLinePaths: giro lateral', () => {
  it('padrão: vértice no trinco a meia altura e pontas nos cantos da dobradiça', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const a = m.openings[0]!;
    expect(a.hingeT).toBeCloseTo(-0.411, 9);
    expect(a.latchT).toBeCloseTo(0.411, 9);
    const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(1);
    const linha = linhas[0]!;
    // x = −viewSide·t: o trinco em t = +0,411 aparece em u = −0,411.
    expect(linha.pts[1]!.u).toBeCloseTo(-0.411, 9);
    expect(linha.pts[1]!.z).toBeCloseTo((a.z0 + a.z1) / 2, 9);
    expect(linha.pts[0]!.u).toBeCloseTo(0.411, 9);
    expect(linha.pts[0]!.z).toBeCloseTo(a.z1, 9);
    expect(linha.pts[2]!.u).toBeCloseTo(0.411, 9);
    expect(linha.pts[2]!.z).toBeCloseTo(a.z0, 9);
  });

  it('tracejado quando a folha abre para o observador e contínuo quando abre para longe', () => {
    const pertoDe = modelo(cena('ot_p90', {}, { flipFacing: false }));
    const longe = modelo(cena('ot_p90', {}, { flipFacing: true }));
    expect(openingLinePaths(pertoDe, 1, PADRAO, 'elevation')[0]!.dashed).toBe(true);
    expect(openingLinePaths(longe, 1, PADRAO, 'elevation')[0]!.dashed).toBe(false);
    expect(openingLinePaths(pertoDe, -1, PADRAO, 'elevation')[0]!.dashed).toBe(false);
  });

  it("apex: 'hinge' e dashed: 'away' invertem exatamente", () => {
    const m = modelo(cena('ot_p90', {}, { flipFacing: false }));
    const padrao = openingLinePaths(m, 1, PADRAO, 'elevation')[0]!;
    const invertido = openingLinePaths(m, 1, { apex: 'hinge', dashed: 'away' }, 'elevation')[0]!;
    expect(padrao.dashed).toBe(true);
    expect(invertido.dashed).toBe(false);
    expect(invertido.pts[1]!.u).toBeCloseTo(-padrao.pts[1]!.u, 9);
    expect(invertido.pts[1]!.z).toBeCloseTo(padrao.pts[1]!.z, 9);
    expect(invertido.pts[0]!.u).toBeCloseTo(-padrao.pts[0]!.u, 9);
    expect(invertido.pts[2]!.u).toBeCloseTo(-padrao.pts[2]!.u, 9);
  });

  it('flipHand espelha o V em t e a linha de tela em u', () => {
    const esq = openingLinePaths(modelo(cena('ot_p90')), 1, PADRAO, 'elevation')[0]!;
    const dir = openingLinePaths(modelo(cena('ot_p90', {}, { flipHand: true })), 1, PADRAO, 'elevation')[0]!;
    expect(dir.pts[1]!.u).toBeCloseTo(-esq.pts[1]!.u, 9);
    expect(dir.pts[0]!.u).toBeCloseTo(-esq.pts[0]!.u, 9);
    expect(dir.pts[2]!.u).toBeCloseTo(-esq.pts[2]!.u, 9);
    expect(dir.pts[0]!.z).toBeCloseTo(esq.pts[0]!.z, 9);
  });
});

describe('openingLinePaths: janelas e famílias sem linha', () => {
  it('maxim-ar: vértice embaixo, no meio, e pontas em cima nas bordas do eixo', () => {
    const m = modelo(cena('ot_j60'));
    const a = m.openings[0]!;
    expect(a.kind).toBe('top');
    const linha = openingLinePaths(m, 1, PADRAO, 'elevation')[0]!;
    expect(linha.pts[1]!.z).toBeCloseTo(a.z0, 9);
    expect(linha.pts[0]!.z).toBeCloseTo(a.z1, 9);
    expect(linha.pts[2]!.z).toBeCloseTo(a.z1, 9);
    expect(linha.pts[1]!.u).toBeCloseTo(0, 9);
    expect(Math.min(linha.pts[0]!.u, linha.pts[2]!.u)).toBeLessThan(0);
    expect(Math.max(linha.pts[0]!.u, linha.pts[2]!.u)).toBeGreaterThan(0);
  });

  it('basculante: dois V com vértice no eixo central, pontas nos cantos superiores e inferiores', () => {
    const m = modelo(cena('ot_j60', { plan: 'tilt' }));
    const a = m.openings[0]!;
    expect(a.kind).toBe('tilt');
    const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(2);
    const eixo = a.axisZ!;
    expect(linhas[0]!.pts[1]!.z).toBeCloseTo(eixo, 9);
    expect(linhas[0]!.pts[0]!.z).toBeCloseTo(a.z1, 9);
    expect(linhas[0]!.pts[2]!.z).toBeCloseTo(a.z1, 9);
    expect(linhas[1]!.pts[1]!.z).toBeCloseTo(eixo, 9);
    expect(linhas[1]!.pts[0]!.z).toBeCloseTo(a.z0, 9);
    expect(linhas[1]!.pts[2]!.z).toBeCloseTo(a.z0, 9);
    expect(linhas[0]!.pts[1]!.u).toBeCloseTo(0, 9);
    expect(linhas[1]!.pts[1]!.u).toBeCloseTo(0, 9);
    // Metade superior abre para o observador (tracejada); a inferior, para o lado oposto (contínua).
    expect(linhas[0]!.dashed).toBe(true);
    expect(linhas[1]!.dashed).toBe(false);
  });

  it('basculante: com a folha longe do observador o traço inverte entre as metades', () => {
    const linhas = openingLinePaths(modelo(cena('ot_j60', { plan: 'tilt' }, { flipFacing: true })), 1, PADRAO, 'elevation');
    expect(linhas[0]!.dashed).toBe(false);
    expect(linhas[1]!.dashed).toBe(true);
  });

  it('vidro fixo e bandeira superior fixos não geram linha', () => {
    expect(openingLinePaths(modelo(cena('ot_jfixa60')), 1, PADRAO, 'elevation')).toHaveLength(0);
    expect(openingLinePaths(modelo(cena('ot_jfixa60', { transom: { height: 0.2 } })), 1, PADRAO, 'elevation')).toHaveLength(0);
  });

  it('correr gera seta horizontal (haste e ponta)', () => {
    const m = modelo(cena('ot_j120'));
    const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.pts).toHaveLength(2);
    expect(perto(linhas[0]!.pts[0]!.z, linhas[0]!.pts[1]!.z)).toBe(true);
    expect(linhas[1]!.pts).toHaveLength(3);
    expect(perto(linhas[1]!.pts[1]!.z, linhas[0]!.pts[0]!.z)).toBe(true);
  });
});

describe('openingLinePaths: portas novas (spec E §3.5)', () => {
  it('vai-e-vem: V contínuo e V tracejado superpostos', () => {
    const linhas = openingLinePaths(modelo(cena('ot_pvv90')), 1, PADRAO, 'elevation');
    expect(linhas).toHaveLength(2);
    expect(linhas.filter((l) => l.dashed)).toHaveLength(1);
    expect(linhas[0]!.pts).toEqual(linhas[1]!.pts);
    expect(linhas[0]!.pts).toHaveLength(3);
  });

  it('embutir: seta horizontal aponta para a cavidade', () => {
    for (const flipHand of [false, true]) {
      const m = modelo(cena('ot_pe80', {}, { flipHand }));
      const folha = m.parts.find((p) => p.role === 'leaf' && p.motion?.kind === 'slide')!;
      const motion = folha.motion;
      if (!motion || motion.kind !== 'slide') throw new Error('folha sem deslizamento');
      const linhas = openingLinePaths(m, 1, PADRAO, 'elevation');
      expect(linhas).toHaveLength(2);
      expect(linhas[0]!.pts).toHaveLength(2);
      expect(linhas[0]!.dashed).toBe(true);
      const destino = -1 * motion.dt * motion.travel;
      const chegada = linhas[0]!.pts[1]!;
      expect(chegada.u).toBeCloseTo(destino, 9);
      expect(linhas[1]!.pts).toHaveLength(3);
    }
  });

  it('dobrável e sanfonada: zigue-zague com um segmento por painel e sem V', () => {
    for (const [base, extra, cadeias, paineis] of [
      ['ot_pd120', {}, 1, 2],
      ['ot_pd120', { leaves: 4 }, 2, 2],
      ['ot_ps90', {}, 1, 9],
    ] as const) {
      const linhas = openingLinePaths(modelo(cena(base, extra as never)), 1, PADRAO, 'elevation');
      expect(linhas, base).toHaveLength(cadeias);
      for (const l of linhas) expect(l.pts.length - 1).toBe(paineis);
    }
  });

  it('seccionada: juntas horizontais e seta para cima', () => {
    const linhas = openingLinePaths(modelo(cena('ot_pg300')), 1, PADRAO, 'elevation');
    const horizontais = linhas.filter((l) => l.pts.length === 2 && perto(l.pts[0]!.z, l.pts[1]!.z));
    expect(horizontais).toHaveLength(4);
    const haste = linhas.find((l) => l.pts.length === 2 && !perto(l.pts[0]!.z, l.pts[1]!.z))!;
    expect(haste).toBeDefined();
    expect(haste.pts[1]!.z).toBeGreaterThan(haste.pts[0]!.z);
    expect(haste.pts[1]!.u).toBeCloseTo(haste.pts[0]!.u, 9);
    const ponta = linhas.find((l) => l.pts.length === 3 && perto(l.pts[0]!.z, l.pts[2]!.z))!;
    expect(ponta).toBeDefined();
    expect(ponta.pts[1]!.z).toBeCloseTo(haste.pts[1]!.z, 9);
  });
});
