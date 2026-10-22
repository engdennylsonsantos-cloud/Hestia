import { describe, expect, it } from 'vitest';
import { frameOfWall, openingGeometry, type OpeningGeometry } from '@hestia/engine';
import { openingSymbolPaths } from '@hestia/geom';
import { DEFAULT_OPENING_TYPES, ProjectStore, coreSpan, createEmptyProject, makeWall, openingFrame, type Opening, type OpeningType, type Project } from '@hestia/model';
import { openingPieces, type OpeningPiece } from './openingParts.ts';

/** Dobradiça/sentido da instância; o padrão é o mesmo das demais cenas. */
interface Flips {
  flipHand?: boolean;
  flipFacing?: boolean;
}

/** Parede de 4 m com um vão no meio. `extra` completa o tipo base (acabamento, vão bruto, verga) antes de inseri-lo. */
function cena(base: string, extra: Partial<OpeningType> = {}, flips: Flips = {}): { p: Project; o: Opening; g: OpeningGeometry } {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: { id: 'v', kind: t.kind, typeId: 'ot_x', hostId: 'w', offset: 2, flipHand: flips.flipHand ?? false, flipFacing: flips.flipFacing ?? false, sillOverride: null, mark: '' },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f) };
}

/** Peças do vão com a parede de 2,80 m (altura padrão do projeto). */
function pecas(c: { p: Project; o: Opening }, open = false): OpeningPiece[] {
  return openingPieces(c.p, c.o, openingGeometry(c.p, c.o, frameOfWall(c.p, 'w')!), frameOfWall(c.p, 'w')!, 2.8, open);
}

describe('peças 3D do vão: acabamento, peitoril e vergas', () => {
  it('sem campos novos, a porta de giro fechada é batente (3) mais uma folha', () => {
    const pc = pecas(cena('ot_p80'));
    expect(pc).toHaveLength(4);
    expect(pc.some((x) => x.hinge)).toBe(false);
  });

  it('alizar: quatro peças por lado na porta e cinco na janela (inclui a peça de baixo do vão)', () => {
    const base = pecas(cena('ot_p80'));
    const com = pecas(cena('ot_p80', { casing: { width: 0.05, thickness: 0.015 } }));
    const novas = com.slice(base.length);
    expect(novas).toHaveLength(6); // 3 peças por lado: ombreiras e verga do alizar, sem soleira na porta
    expect(novas.every((x) => Math.abs(x.d - 0.015) < 1e-9)).toBe(true);
    const baseJ = pecas(cena('ot_j120'));
    const comJ = pecas(cena('ot_j120', { casing: { width: 0.05, thickness: 0.015 } }));
    expect(comJ.length - baseJ.length).toBe(8); // janela: 4 peças por lado, a de baixo incluída
  });

  it('peitoril saliente só existe em janela: projeta além das duas faces da parede, abaixo do vão', () => {
    const c = cena('ot_j120', { sillBoard: { projection: 0.03, thickness: 0.02 } });
    const base = pecas(cena('ot_j120'));
    const peca = pecas(c).slice(base.length)[0]!;
    expect(peca.w).toBeCloseTo(c.g.width, 9);
    expect(peca.d).toBeCloseTo(c.g.thickness + 0.06, 9);
    expect(peca.h).toBeCloseTo(0.02, 9);
    expect(peca.z).toBeCloseTo(-0.01, 9);
    const porta = pecas(cena('ot_p80', { sillBoard: { projection: 0.03, thickness: 0.02 } }));
    expect(porta).toHaveLength(pecas(cena('ot_p80')).length);
  });

  it('verga e contraverga: peças de concreto com transpasse; sem o campo, nenhuma', () => {
    const c = cena('ot_p80', { lintel: {}, sillBeam: { over: 0.2, height: 0.25 } });
    const base = pecas(cena('ot_p80'));
    const [verga, contra] = pecas(c).slice(base.length);
    expect(verga!.w).toBeCloseTo(c.g.width + 0.6, 9); // transpasse padrão 0,30 m para cada lado
    expect(verga!.h).toBeCloseTo(0.2, 9);
    expect(verga!.z).toBeCloseTo(c.g.height + 0.1, 9);
    expect(contra!.w).toBeCloseTo(c.g.width + 0.4, 9);
    expect(contra!.h).toBeCloseTo(0.25, 9);
    expect(contra!.z).toBeCloseTo(-0.125, 9);
    expect(verga!.materialId).toBe('mat_concreto');
    expect(contra!.materialId).toBe('mat_concreto');
  });
});

describe('folha aberta no 3D', () => {
  it('porta de giro aberta gira a folha 90° na dobradiça; fechada, nenhuma peça tem dobradiça', () => {
    const c = cena('ot_p80');
    const fechada = pecas(c, false);
    const aberta = pecas(c, true);
    expect(fechada.some((x) => x.hinge)).toBe(false);
    const folha = aberta.find((x) => x.hinge);
    expect(folha).toBeDefined();
    expect(folha!.hinge!.axis).toBe('z');
    expect(Math.abs(folha!.hinge!.angle)).toBeCloseTo(Math.PI / 2, 9);
    expect(aberta).toHaveLength(fechada.length);
  });

  it('janela de correr aberta: as folhas se deslocam no trilho, sem dobradiça', () => {
    const c = cena('ot_j120');
    const fechada = pecas(c, false);
    const aberta = pecas(c, true);
    expect(aberta.some((x) => x.hinge)).toBe(false);
    expect(aberta.map((x) => x.x)).not.toEqual(fechada.map((x) => x.x));
  });
});

describe('regressão do 3D aberto', () => {
  const r6 = (n: number): number => Math.round(n * 1e6) / 1e6;
  const dimensoes = (pc: OpeningPiece[]): string[] => pc.map((x) => `${r6(x.w)}x${r6(x.d)}x${r6(x.h)}`).sort();
  const jambDe = (c: { p: Project; o: Opening }): number => {
    const f = frameOfWall(c.p, 'w')!;
    const core = coreSpan(f.type);
    return openingFrame(c.p.openingTypes[c.o.typeId]!, core.to - core.from).frameWidth;
  };
  const alturaDe = (c: { g: OpeningGeometry }): number => Math.min(c.g.height, 2.8 - c.g.sill);

  /** Lado do arco/folha da planta em relação a +n, pelo traço da folha (peso 1,3). */
  function ladoDaPlanta(g: OpeningGeometry): number {
    const folha = openingSymbolPaths(g).find((s) => s.weight === 1.3);
    if (!folha) throw new Error('símbolo sem traço de folha');
    const s = (pt: { x: number; y: number }): number => (pt.x - g.center.x) * g.n.x + (pt.y - g.center.y) * g.n.y;
    const extremo = folha.pts.reduce((a, b) => (Math.abs(s(b)) > Math.abs(s(a)) ? b : a));
    return Math.sign(s(extremo));
  }

  /** Lado para onde a folha aberta vai no 3D: sinal de y depois do giro em torno do eixo z. */
  function ladoDoGiro(pc: OpeningPiece[]): number {
    const folha = pc.find((x) => x.hinge);
    if (!folha?.hinge) throw new Error('folha aberta sem dobradiça');
    return Math.sign((folha.x - folha.hinge.at) * Math.sin(folha.hinge.angle));
  }

  it('dimensões das peças iguais fechado × aberto nos 14 tipos padrão', () => {
    expect(DEFAULT_OPENING_TYPES).toHaveLength(14);
    for (const t of DEFAULT_OPENING_TYPES) {
      const c = cena(t.id);
      expect(dimensoes(pecas(c, true)), t.id).toEqual(dimensoes(pecas(c, false)));
    }
  });

  it('vidro e montantes ocupam exatamente jamb…h−jamb em todas as janelas com vidro', () => {
    for (const t of DEFAULT_OPENING_TYPES.filter((x) => x.kind === 'window' && x.leaves > 0)) {
      const c = cena(t.id);
      const jamb = jambDe(c);
      const h = alturaDe(c);
      const pc = pecas(c);
      const vidros = pc.filter((x) => x.materialId === t.glassMaterialId);
      expect(vidros.length, t.id).toBeGreaterThan(0);
      for (const v of vidros) {
        expect(v.z - v.h / 2, t.id).toBeCloseTo(jamb, 9);
        expect(v.z + v.h / 2, t.id).toBeCloseTo(h - jamb, 9);
      }
      const montantes = pc.filter((x) => x.materialId === t.frameMaterialId && Math.abs(x.h - (h - 2 * jamb)) < 1e-9);
      for (const m of montantes) {
        expect(m.z - m.h / 2, t.id).toBeCloseTo(jamb, 9);
        expect(m.z + m.h / 2, t.id).toBeCloseTo(h - jamb, 9);
      }
    }
  });

  it('maxim-ar: eixo de giro na face inferior da verga (jamb + glassH)', () => {
    const c = cena('ot_j60');
    const jamb = jambDe(c);
    const h = alturaDe(c);
    const folha = pecas(c, true).find((x) => x.hinge)!;
    expect(folha.hinge!.axis).toBe('x');
    expect(folha.hinge!.at).toBeCloseTo(jamb + (h - 2 * jamb), 9);
    expect(folha.hinge!.at).toBeCloseTo(h - jamb, 9);
  });

  it('porta de giro: o lado aberto no 3D confere com o arco da planta nas 4 combinações', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_p80', {}, { flipHand, flipFacing });
        const aberta = pecas(c, true);
        const caso = `hand=${flipHand} facing=${flipFacing}`;
        expect(ladoDoGiro(aberta), caso).toBe(ladoDaPlanta(c.g));
        expect(Math.abs(aberta.find((x) => x.hinge)!.hinge!.angle), caso).toBeCloseTo(Math.PI / 2, 9);
      }
    }
  });
});
