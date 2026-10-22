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

describe('folhas de correr abertas dentro do vão', () => {
  const jambDe = (c: { p: Project; o: Opening }): number => {
    const f = frameOfWall(c.p, 'w')!;
    const core = coreSpan(f.type);
    return openingFrame(c.p.openingTypes[c.o.typeId]!, core.to - core.from).frameWidth;
  };
  const alturaDe = (c: { g: OpeningGeometry }): number => Math.min(c.g.height, 2.8 - c.g.sill);
  const sobrepoe = (a: OpeningPiece, b: OpeningPiece): boolean => {
    const ax = [a.x - a.w / 2, a.x + a.w / 2] as const;
    const bx = [b.x - b.w / 2, b.x + b.w / 2] as const;
    const ay = [a.y - a.d / 2, a.y + a.d / 2] as const;
    const by = [b.y - b.d / 2, b.y + b.d / 2] as const;
    const az = [a.z - a.h / 2, a.z + a.h / 2] as const;
    const bz = [b.z - b.h / 2, b.z + b.h / 2] as const;
    return ax[0] < bx[1] - 1e-9 && bx[0] < ax[1] - 1e-9 && ay[0] < by[1] - 1e-9 && by[0] < ay[1] - 1e-9 && az[0] < bz[1] - 1e-9 && bz[0] < az[1] - 1e-9;
  };

  it('janela de correr 2 e 3 folhas: fechada lado a lado; aberta, as folhas empilham dentro do caixilho', () => {
    for (const id of ['ot_j120', 'ot_j150', 'ot_j200', 'ot_j240']) {
      const c = cena(id);
      const t = c.p.openingTypes[c.o.typeId]!;
      const jamb = jambDe(c);
      const inner = c.g.width - 2 * jamb;
      const n = t.leaves;
      const panel = inner / n;
      const fechada = pecas(c, false).filter((x) => x.materialId === t.glassMaterialId);
      const aberta = pecas(c, true).filter((x) => x.materialId === t.glassMaterialId);
      expect(fechada, id).toHaveLength(n);
      expect(aberta, id).toHaveLength(n);
      // Fechado: folhas lado a lado cobrindo o vão interno, como antes.
      for (let k = 0; k < n; k++) {
        expect(fechada[k]!.x, id).toBeCloseTo(-inner / 2 + (k + 0.5) * panel, 9);
        expect(fechada[k]!.w, id).toBeCloseTo(panel, 9);
      }
      // Aberto: todas as folhas dentro de `±(W/2 − jamb)`; as que se movem empilham sobre a primeira.
      for (const v of aberta) {
        expect(v.x - v.w / 2, id).toBeGreaterThanOrEqual(-inner / 2 - 1e-9);
        expect(v.x + v.w / 2, id).toBeLessThanOrEqual(inner / 2 + 1e-9);
      }
      expect(aberta[0]!.x, id).toBeCloseTo(-inner / 2 + panel / 2, 9);
      for (let k = 1; k < n; k++) expect(aberta[k]!.x, id).toBeCloseTo(aberta[0]!.x, 9);
      // Os montantes não ficam no percurso das folhas abertas.
      const montantes = pecas(c, true).filter((x) => x.materialId === t.frameMaterialId && Math.abs(x.h - (alturaDe(c) - 2 * jamb)) < 1e-9);
      expect(montantes, id).toHaveLength(n - 1);
      for (const m of montantes) for (const v of aberta) expect(sobrepoe(v, m), id).toBe(false);
    }
  });

  it('janela de correr: no estado fechado o montante central continua no limite entre as folhas', () => {
    const c = cena('ot_j120');
    const t = c.p.openingTypes[c.o.typeId]!;
    const jamb = jambDe(c);
    const montantes = pecas(c, false).filter((x) => x.materialId === t.frameMaterialId && Math.abs(x.h - (alturaDe(c) - 2 * jamb)) < 1e-9);
    expect(montantes).toHaveLength(1);
    expect(montantes[0]!.x).toBeCloseTo(0, 9);
  });

  it('porta de correr: aberta, um painel corre sobre o outro dentro do vão livre', () => {
    const c = cena('ot_pc160');
    const jamb = jambDe(c);
    const leafW = c.g.width - 2 * jamb;
    const painel = (open: boolean): OpeningPiece[] => pecas(c, open).filter((x) => Math.abs(x.w - leafW / 2) < 1e-9);
    const fechada = painel(false);
    const aberta = painel(true);
    expect(fechada).toHaveLength(2);
    expect(aberta).toHaveLength(2);
    expect(fechada.map((x) => x.x).sort((a, b) => a - b)[0]!).toBeCloseTo(-leafW / 4, 9);
    expect(fechada.map((x) => x.x).sort((a, b) => a - b)[1]!).toBeCloseTo(leafW / 4, 9);
    for (const p of aberta) {
      expect(p.x - p.w / 2).toBeGreaterThanOrEqual(-leafW / 2 - 1e-9);
      expect(p.x + p.w / 2).toBeLessThanOrEqual(leafW / 2 + 1e-9);
      expect(p.x).toBeCloseTo(-leafW / 4, 9);
    }
    // Trilhos distintos: os dois painéis continuam defasados na profundidade.
    expect(Math.abs(aberta[0]!.y - aberta[1]!.y)).toBeGreaterThan(0.01);
    // Nenhum painel entra no núcleo da parede (profundidade limitada ao núcleo).
    const f = frameOfWall(c.p, 'w')!;
    const core = coreSpan(f.type);
    const half = f.thickness / 2;
    for (const p of aberta) {
      expect(p.y - p.d / 2).toBeGreaterThanOrEqual(core.from - half - 1e-9);
      expect(p.y + p.d / 2).toBeLessThanOrEqual(core.to - half + 1e-9);
    }
  });
});

describe('porta pivotante aberta', () => {
  const jambDe = (c: { p: Project; o: Opening }): number => {
    const f = frameOfWall(c.p, 'w')!;
    const core = coreSpan(f.type);
    return openingFrame(c.p.openingTypes[c.o.typeId]!, core.to - core.from).frameWidth;
  };
  const sOf = (g: OpeningGeometry, pt: { x: number; y: number }): number => (pt.x - g.center.x) * g.n.x + (pt.y - g.center.y) * g.n.y;

  it('eixo a W/4 da ombreira de flipHand e lado da banda curta igual ao da planta nas 4 combinações', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_pp80', {}, { flipHand, flipFacing });
        const leafW = c.g.width - 2 * jambDe(c);
        const folha = pecas(c, true).find((x) => x.hinge)!;
        const caso = `hand=${flipHand} facing=${flipFacing}`;
        expect(folha.hinge!.axis, caso).toBe('z');
        expect(folha.hinge!.at, caso).toBeCloseTo((flipHand ? 1 : -1) * (c.g.width / 4), 9);
        expect(Math.abs(folha.hinge!.angle), caso).toBeCloseTo(Math.PI / 2, 9);
        // Planta: o primeiro arco suave é o da banda curta, que termina na ombreira da dobradiça.
        const curta = openingSymbolPaths(c.g).filter((s) => s.tone === 'soft')[0]!;
        const ladoPlanta = Math.sign(sOf(c.g, curta.pts[0]!));
        expect(ladoPlanta, caso).toBe(flipFacing ? -1 : 1);
        // 3D: lado da ponta da folha do lado da dobradiça, depois do giro em torno do eixo z.
        const pontaDobradica = (flipHand ? 1 : -1) * (leafW / 2);
        const lado3D = Math.sign((pontaDobradica - folha.hinge!.at) * Math.sin(folha.hinge!.angle));
        expect(lado3D, caso).toBe(ladoPlanta);
      }
    }
  });

  it('fechada continua igual a hoje: folha no centro, sem dobradiça e com a largura do vão livre', () => {
    const c = cena('ot_pp80');
    const fechada = pecas(c, false);
    expect(fechada.some((x) => x.hinge)).toBe(false);
    const folha = fechada.find((x) => Math.abs(x.w - (c.g.width - 2 * jambDe(c))) < 1e-9)!;
    expect(folha.x).toBeCloseTo(0, 9);
    expect(folha.y).toBeCloseTo(0, 9);
  });
});
