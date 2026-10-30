import { describe, expect, it } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeRoof, makeWall, type Project } from '@hestia/model';
import { chavesDeNivel } from './chaveNivel3d.ts';
import { buildLevelSolidsComCaixas } from './paredesInstanciadas3d.ts';
import { buildLevelSolids } from './solids.ts';

/**
 * 3D da parede anexada ao telhado: a malha tem de acompanhar a face inferior do telhado (topo em V na empena), inclusive
 * com o telhado desenhado no nível de cima, e a chave do nível tem de mudar quando o usuário marca "Topo no telhado"
 * (senão a cena reaproveita a malha reta).
 *
 * Telhado 8 × 10 m (x −1..7, y −1..9), duas águas com cumeeira em y (dir em y), beiral em 3 m, 30 %, tipo rt_ceramica
 * (0,095 m). Parede de (0,0) a (6,0) sob ele, perpendicular à cumeeira: a cumeeira em x = 3 fica em 3 + 0,3 × 4 = 4,20 m,
 * face inferior 4,105 m; as pontas em x = 0 e x = 6 ficam em 3,205 m.
 */
const rect = (x0: number, y0: number, x1: number, y1: number) => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

function build(attach: boolean, roofLevel = 'lv_0'): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({
    type: 'addRoof',
    roof: makeRoof({
      id: 'r1',
      typeId: 'rt_ceramica',
      levelId: roofLevel,
      boundary: rect(-1, -1, 7, 9),
      shape: 'gable',
      slopePercent: 30,
      dir: { x: 0, y: 1 },
      heightOffset: 3,
    }),
  });
  s.exec({
    type: 'addWall',
    wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 }, height: 3, attachTopToRoof: attach }),
  });
  return s.project;
}

/** Cotas z das posições (eixo Z do mundo: a parede já sai no mundo). */
const zs = (posicoes: readonly number[]): number[] => {
  const out: number[] = [];
  for (let i = 2; i < posicoes.length; i += 3) out.push(posicoes[i]!);
  return out;
};

describe('3D · parede anexada ao telhado', () => {
  it('sem anexo a malha é reta em 3 m', () => {
    const lv = resolveLevel(build(false), 'lv_0');
    const { batches } = buildLevelSolids(lv);
    const z = zs(batches.flatMap((b) => b.positions));
    expect(Math.min(...z)).toBeCloseTo(0, 6);
    expect(Math.max(...z)).toBeCloseTo(3, 6);
  });

  it('com anexo a malha segue o telhado: topo em 4,105 m na cumeeira e 3,205 m nas pontas', () => {
    const lv = resolveLevel(build(true), 'lv_0');
    const { batches, caixas } = buildLevelSolidsComCaixas(lv, undefined, false);
    // Topo inclinado não vira caixa instanciada: tem de ir pela geometria.
    expect(caixas).toEqual([]);
    const z = zs(batches.flatMap((b) => b.positions));
    expect(Math.max(...z)).toBeCloseTo(4.105, 6);
    expect(Math.min(...z)).toBeCloseTo(0, 6);
    // As pontas do eixo (x = 0 e x = 6) chegam a 3,205 m: existe vértice nessa cota.
    expect(z.some((v) => Math.abs(v - 3.205) < 1e-6)).toBe(true);
  });

  it('telhado no nível de cima: a malha acompanha a face 3 m acima (o nível do telhado não decide o anexo)', () => {
    const lv = resolveLevel(build(true, 'lv_1'), 'lv_0');
    const { batches } = buildLevelSolids(lv);
    const z = zs(batches.flatMap((b) => b.positions));
    expect(Math.max(...z)).toBeCloseTo(4.105 + 3, 6);
    expect(z.some((v) => Math.abs(v - 3.205 - 3) < 1e-6)).toBe(true);
  });

  it('a chave do nível muda ao marcar "Topo no telhado" (a cena 3D não reaproveita a malha reta)', () => {
    const antes = chavesDeNivel(build(false), 'marca');
    const depois = chavesDeNivel(build(true), 'marca');
    expect(depois.get('lv_0')).not.toBe(antes.get('lv_0'));
  });
});
