import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Project } from '@hestia/model';
import { cotasAutomaticas } from './autoCotas.ts';

/**
 * Cotas automáticas (camadas por lado): aberturas → paredes → total, uma cota por trecho, com referência associativa às
 * pontas de parede. Sala de 6 × 4 m com uma porta de 0,90 na parede sul, com offset 2,00.
 */
const RECT: Array<[number, number, number, number]> = [
  [0, 0, 6, 0],
  [6, 0, 6, 4],
  [6, 4, 0, 4],
  [0, 4, 0, 0],
];

function sala(porta = true): Project {
  const s = new ProjectStore(createEmptyProject());
  const ids = ['s', 'l', 'n', 'o'];
  RECT.forEach(([x0, y0, x1, y1], i) => {
    s.exec({ type: 'addWall', wall: makeWall({ id: ids[i]!, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: x0, y: y0 }, b: { x: x1, y: y1 }, joinStart: { kind: 'butt', flip: false }, joinEnd: { kind: 'butt', flip: false } }) });
  });
  if (porta) s.exec({ type: 'addOpening', opening: { id: 'p1', kind: 'door', typeId: 'ot_p90', hostId: 's', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  return s.project;
}

const comprimento = (d: { a: { x: number; y: number }; b: { x: number; y: number } }): number => Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);

describe('cotas automáticas', () => {
  it('sem parede no nível, nenhuma cota', () => {
    expect(cotasAutomaticas(createEmptyProject(), 'lv_0')).toEqual([]);
  });

  it('a porta gera uma camada própria com a largura do vão, e a camada de paredes fecha o total', () => {
    const cotas = cotasAutomaticas(sala(), 'lv_0', { lados: 'maisProximo', clique: { x: 3, y: -1 } });
    // só o lado sul: camada da abertura (0,90) + camada das paredes (6,00); o total coincide com as paredes e não entra
    expect(cotas.map((c) => Math.round(comprimento(c) * 100) / 100).sort((a, b) => a - b)).toEqual([0.9, 6]);
    // as cotas ficam fora da sala (offset negativo no lado sul)
    for (const c of cotas) expect(c.offset).toBeLessThan(0);
  });

  it('cada cota leva a referência da ponta de parede (associativa)', () => {
    const cotas = cotasAutomaticas(sala(), 'lv_0', { lados: 'maisProximo', clique: { x: 3, y: -1 } });
    const comRef = cotas.filter((c) => c.refs?.a || c.refs?.b);
    expect(comRef.length).toBeGreaterThan(0);
    for (const c of comRef) expect(['a', 'b']).toContain((c.refs?.a ?? c.refs?.b)!.end);
  });

  it('os quatro lados: duas cotas de parede por lado, sem repetir a camada do total', () => {
    const cotas = cotasAutomaticas(sala(false), 'lv_0');
    // sem aberturas: cada lado tem uma camada só (paredes), com uma cota de 6,00 (sul/norte) ou 4,00 (leste/oeste)
    expect(cotas).toHaveLength(4);
    expect(cotas.map((c) => Math.round(comprimento(c) * 100) / 100).sort((a, b) => a - b)).toEqual([4, 4, 6, 6]);
  });

  it('as camadas se afastam: a segunda camada fica mais longe que a primeira', () => {
    const cotas = cotasAutomaticas(sala(), 'lv_0', { lados: 'maisProximo', clique: { x: 3, y: -1 }, offset: 0.6, espacamento: 0.45 });
    const offsets = [...new Set(cotas.map((c) => Math.abs(c.offset)))].sort((a, b) => a - b);
    expect(offsets[0]).toBeCloseTo(0.6, 6);
    expect(offsets[1]).toBeCloseTo(1.05, 6);
  });

  it('sem cotar aberturas, sobra só a camada de paredes', () => {
    const cotas = cotasAutomaticas(sala(), 'lv_0', { lados: 'maisProximo', clique: { x: 3, y: -1 }, aberturas: false });
    expect(cotas).toHaveLength(1);
    expect(comprimento(cotas[0]!)).toBeCloseTo(6, 6);
  });
});
