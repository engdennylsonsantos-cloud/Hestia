import { describe, expect, it } from 'vitest';
import { frameOfWall, openingGeometry, type OpeningGeometry } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeWall, type Opening, type OpeningType, type Project } from '@hestia/model';
import { openingPieces, type OpeningPiece } from './openingParts.ts';

/** Parede de 4 m com um vão no meio. `extra` completa o tipo base (acabamento, vão bruto, verga) antes de inseri-lo. */
function cena(base: 'ot_p80' | 'ot_j120', extra: Partial<OpeningType> = {}): { p: Project; o: Opening; g: OpeningGeometry } {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base]!;
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'v', kind: t.kind, typeId: 'ot_x', hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
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
