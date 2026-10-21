import { describe, expect, it } from 'vitest';
import { multiArea, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoof, type Project, type Roof, type RoofProfilePoint } from '@hestia/model';
import { quantifyRoofs, resolveRoofs, roofTopAt, type ResolvedRoof, type RoofLine } from './index.ts';
import { defaultExtrusionProfile, extrusionFrame, extrusionLines, extrusionPlanes } from './roofExtrusion.ts';
import { presetArco, presetDenteSerra, presetMansarda, shiftProfile } from './roofProfilePresets.ts';

const rect = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
/** Contorno 10 x 8 (x 0..10 é o eixo, y 0..8 é a transversal): com dir (1, 0), t = y e s = x. */
const B10x8 = rect(0, 0, 10, 8);
const ARC_LEN = 2 * 8.5 * Math.asin(4 / 8.5);

const lines = (ls: RoofLine[], kind: RoofLine['kind']): RoofLine[] => ls.filter((l) => l.kind === kind);
const len = (l: RoofLine): number => Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y);
const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);
/** Área sob um perfil linear por trechos com z ≥ 0 (regra do trapézio, exata nesse caso). */
const underProfile = (pts: RoofProfilePoint[]): number => pts.slice(1).reduce((s, q, i) => s + ((q.t - pts[i]!.t) * (q.z + pts[i]!.z)) / 2, 0);

/** Projeto com um telhado por extrusão (addRoof, como na aplicação) e o telhado resolvido. */
function resolved(boundary: Vec2[], profile: RoofProfilePoint[], extra: Partial<Roof> = {}): { p: Project; rr: ResolvedRoof } {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addRoof', roof: makeRoof({ id: 'r1', typeId: 'rt_ceramica', levelId: 'lv_0', boundary, shape: 'extrusion', dir: { x: 1, y: 0 }, profile, ...extra }) });
  const rr = resolveRoofs(s.project, 'lv_0')[0]!;
  return { p: s.project, rr };
}

describe('referencial da extrusão', () => {
  it('eixo (1, 0): transversal (0, 1), t = y, s = x; o eixo nulo não tem referencial', () => {
    const f = extrusionFrame(B10x8, { x: 1, y: 0 })!;
    expect(f.across.x).toBeCloseTo(0, 12);
    expect(f.across.y).toBeCloseTo(1, 12);
    expect(f.tMin).toBeCloseTo(0, 12);
    expect(f.tMax).toBeCloseTo(8, 12);
    expect(f.sMid).toBeCloseTo(5, 12);
    expect(extrusionFrame(B10x8, { x: 0, y: 0 })).toBeNull();
  });
});

describe('uma água: perfil de 0 a 2 m em 8 m de transversal', () => {
  const { rr } = resolved(B10x8, [{ t: 0, z: 0 }, { t: 8, z: 2 }]);
  it('uma água de 80 m², inclinação 25 %, subindo na transversal', () => {
    expect(rr.planes).toHaveLength(1);
    const pl = rr.planes[0]!;
    expect(multiArea(pl.polygon)).toBeCloseTo(80, 9);
    expect(pl.percent).toBeCloseTo(25, 9);
    expect(pl.up.x).toBeCloseTo(0, 12);
    expect(pl.up.y).toBeCloseTo(1, 12);
  });

  it('cota da face: 0 na borda t = 0, 1 m em t = 4 e 2 m na borda t = 8, acima da cota do beiral', () => {
    expect(rr.eaveZ).toBeCloseTo(0, 9);
    expect(roofTopAt(rr, { x: 5, y: 0 })).toBeCloseTo(0, 9);
    expect(roofTopAt(rr, { x: 5, y: 4 })).toBeCloseTo(1, 9);
    expect(roofTopAt(rr, { x: 5, y: 8 })).toBeCloseTo(2, 9);
  });

  it('cota do beiral soma o deslocamento', () => {
    const { rr: high } = resolved(B10x8, [{ t: 0, z: 0 }, { t: 8, z: 2 }], { heightOffset: 3 });
    expect(roofTopAt(high, { x: 5, y: 8 })).toBeCloseTo(5, 9);
  });

  it('a água não tem linhas além do beiral (nenhum vértice interno, nenhuma cumeeira)', () => {
    expect(lines(rr.lines, 'ridge')).toHaveLength(0);
    expect(lines(rr.lines, 'valley')).toHaveLength(0);
    // As extremidades (x = 0 e x = 10) têm seção de 2 m no fim do perfil: são empenas. Antes contavam como beirais
    // (defeito corrigido: 4 beirais), então esta asserção mudou de 4 para 2 beirais e 2 empenas.
    expect(lines(rr.lines, 'eave')).toHaveLength(2);
    expect(lines(rr.lines, 'gable')).toHaveLength(2);
  });
});

describe('arco de raio 8,5 (largura 8, flecha 1) sobre 10 m de comprimento', () => {
  const profile = presetArco(8, 1);
  const { rr } = resolved(B10x8, profile);

  it('12 águas, soma das áreas em planta de 80 m²', () => {
    expect(rr.planes).toHaveLength(12);
    expect(sum(rr.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(80, 9);
  });

  it('área real = comprimento do arco × 10 m (a soma dos trechos é a do arco, a menos de 0,2 %)', () => {
    const real = sum(rr.planes.map((pl) => multiArea(pl.polygon) * Math.sqrt(1 + (pl.percent / 100) ** 2)));
    expect(Math.abs(real - ARC_LEN * 10) / (ARC_LEN * 10)).toBeLessThan(0.002);
    expect(real).toBeCloseTo(ARC_LEN * 10, 0);
  });

  it('o topo no centro (t = 4) é a flecha: 1 m acima do beiral; no beiral, 0', () => {
    expect(roofTopAt(rr, { x: 5, y: 4 })).toBeCloseTo(1, 9);
    expect(roofTopAt(rr, { x: 5, y: 0.0001 })).toBeCloseTo(0, 3);
  });

  it('uma única cumeeira de 10 m no centro, sem rincões', () => {
    const ridges = lines(rr.lines, 'ridge');
    expect(ridges).toHaveLength(1);
    expect(len(ridges[0]!)).toBeCloseTo(10, 9);
    expect(ridges[0]!.a.y).toBeCloseTo(4, 9);
    expect(lines(rr.lines, 'valley')).toHaveLength(0);
  });

  it('quantitativos: área real, cumeeira, beiral e cota máxima pelo mesmo caminho do painel', () => {
    const q = quantifyRoofs(resolved(B10x8, profile).p, 'lv_0').roofs[0]!;
    expect(q.planArea).toBeCloseTo(80, 9);
    expect(q.faceArea).toBeCloseTo(ARC_LEN * 10, 1);
    expect(q.ridgeLength).toBeCloseTo(10, 9);
    // Beiral: só os dois lados de 10 m, em z 0. As extremidades (8 m, seguem o arco) são empenas: antes entravam no
    // beiral (20 + 2 × 8,33 m), defeito corrigido. Empena em planta: 2 × 8 m; frontão: a seção do arco nas duas pontas.
    expect(q.eaveLength).toBeCloseTo(20, 9);
    expect(q.gableLength).toBeCloseTo(16, 9);
    expect(q.gableArea).toBeCloseTo(2 * underProfile(profile), 9);
    expect(q.maxHeight).toBeCloseTo(1, 9);
    expect(q.ridgeHeight).toBeCloseTo(1, 9);
  });
});

describe('furos cortam as águas e a cumeeira', () => {
  it('furo 2 x 4 no meio: área em planta 72 m² e a cumeeira some 2 m', () => {
    const hole = rect(4, 2, 6, 6);
    const { rr } = resolved(B10x8, presetArco(8, 1), { holes: [hole] });
    expect(sum(rr.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(72, 9);
    expect(sum(lines(rr.lines, 'ridge').map(len))).toBeCloseTo(8, 9);
  });
});

describe('dente de serra: cumes e vales', () => {
  it('3 dentes em 6 m: 3 cumes e 2 vales de 10 m, e 60 m² em planta', () => {
    const boundary = rect(0, 0, 10, 6);
    const { rr } = resolved(boundary, presetDenteSerra(6, 3, 2));
    expect(sum(rr.planes.map((pl) => multiArea(pl.polygon)))).toBeCloseTo(60, 9);
    expect(lines(rr.lines, 'ridge')).toHaveLength(3);
    expect(lines(rr.lines, 'valley')).toHaveLength(2);
    expect(sum(lines(rr.lines, 'valley').map(len))).toBeCloseTo(20, 9);
    expect(roofTopAt(rr, { x: 5, y: 1 })).toBeCloseTo(2, 9);
    expect(roofTopAt(rr, { x: 5, y: 2 })).toBeCloseTo(0, 9);
  });
});

describe('fora do intervalo de t: cota do ponto mais próximo (faixas planas)', () => {
  const { rr } = resolved(B10x8, [{ t: 2, z: 0 }, { t: 6, z: 1 }]);

  it('três águas: plana de 0 a 2, subida de 2 a 6 (25 %), plana de 6 a 8 na cota 1', () => {
    expect(rr.planes).toHaveLength(3);
    expect(rr.planes.map((pl) => multiArea(pl.polygon)).map((a) => Math.round(a * 1000) / 1000)).toEqual([20, 40, 20]);
    expect(rr.planes.map((pl) => pl.percent)).toEqual([0, 25, 0]);
    expect(roofTopAt(rr, { x: 5, y: 1 })).toBeCloseTo(0, 9);
    expect(roofTopAt(rr, { x: 5, y: 4 })).toBeCloseTo(0.5, 9);
    expect(roofTopAt(rr, { x: 5, y: 7 })).toBeCloseTo(1, 9);
  });

  it('um vale em t = 2 (plana para subida) e uma cumeeira em t = 6 (subida para plana)', () => {
    expect(lines(rr.lines, 'valley').map((l) => l.a.y)).toEqual([2]);
    expect(lines(rr.lines, 'ridge').map((l) => l.a.y)).toEqual([6]);
  });
});

describe('perfil inválido ou eixo nulo: nenhuma água', () => {
  it('t decrescente não gera águas; as linhas ficam só no beiral', () => {
    const { rr } = resolved(B10x8, [{ t: 4, z: 0 }, { t: 2, z: 1 }]);
    expect(rr.planes).toHaveLength(0);
    expect(rr.lines.every((l) => l.kind === 'eave')).toBe(true);
  });

  it('eixo nulo não gera águas', () => {
    expect(extrusionPlanes({ ...makeRoof({ id: 'x', typeId: 't', levelId: 'l', boundary: B10x8, shape: 'extrusion', dir: { x: 0, y: 0 }, profile: presetArco(8, 1) }), order: 0 }, 0)).toEqual([]);
  });
});

describe('perfil padrão', () => {
  it('arco de 1 m sobre a largura do contorno na transversal, com t começando no mínimo do contorno', () => {
    const pts = defaultExtrusionProfile(B10x8, { x: 1, y: 0 });
    expect(pts).toHaveLength(13);
    expect(pts[0]!.t).toBeCloseTo(0, 12);
    expect(pts[12]!.t).toBeCloseTo(8, 12);
    expect(pts[6]!.z).toBeCloseTo(1, 12);
    // Contorno que começa no meio da transversal: boundary[0] = (0, 3) e a faixa do contorno é y ∈ [−5, 3], ou seja t ∈ [−8, 0].
    const shifted = rect(0, 3, 10, -5);
    const q = defaultExtrusionProfile(shifted, { x: 1, y: 0 });
    expect(extrusionFrame(shifted, { x: 1, y: 0 })!.tMin).toBeCloseTo(-8, 12);
    expect(extrusionFrame(shifted, { x: 1, y: 0 })!.tMax).toBeCloseTo(0, 12);
    expect(q[0]!.t).toBeCloseTo(-8, 12);
    expect(q[12]!.t).toBeCloseTo(0, 12);
  });

  it('vértices do perfil fora do contorno não geram cumeeira nem rincão', () => {
    const r: Roof = { ...makeRoof({ id: 'x', typeId: 't', levelId: 'l', boundary: B10x8, shape: 'extrusion', dir: { x: 1, y: 0 }, profile: [{ t: -5, z: 0 }, { t: -1, z: 1 }] }), order: 0 };
    expect(extrusionLines(r).filter((l) => l.kind === 'ridge' || l.kind === 'valley')).toHaveLength(0);
    // A faixa plana a 1 m cobre as extremidades (t de 0 a 8): são empenas de 1 m. Antes eram beirais (defeito corrigido).
    expect(extrusionLines(r).filter((l) => l.kind === 'gable')).toHaveLength(2);
    expect(extrusionLines(r).filter((l) => l.kind === 'eave')).toHaveLength(2);
  });
});

describe('extremidades: empena só com seção acima do beiral', () => {
  it('mansarda (4 trechos): beirais de 10 m nos lados; extremidades de 8 m são empenas com frontão de 9 m² cada', () => {
    const profile = shiftProfile(presetMansarda(8, 1, 2, 2.5), extrusionFrame(B10x8, { x: 1, y: 0 })!.tMin);
    const { p, rr } = resolved(B10x8, profile);
    expect(lines(rr.lines, 'eave')).toHaveLength(2);
    expect(lines(rr.lines, 'gable')).toHaveLength(2);
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.eaveLength).toBeCloseTo(20, 9);
    expect(q.gableLength).toBeCloseTo(16, 9);
    // Trapézios do perfil: 1 + 3,5 + 3,5 + 1 = 9 m² por extremidade.
    expect(q.gableArea).toBeCloseTo(18, 9);
  });

  it('dente de serra (3 dentes de 2 m de altura): extremidades são empenas, com a área dos dentes (6 m² cada)', () => {
    const boundary = rect(0, 0, 10, 6);
    const { p, rr } = resolved(boundary, presetDenteSerra(6, 3, 2));
    expect(lines(rr.lines, 'gable')).toHaveLength(2);
    expect(lines(rr.lines, 'eave')).toHaveLength(2);
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.eaveLength).toBeCloseTo(20, 9);
    expect(q.gableLength).toBeCloseTo(12, 9);
    expect(q.gableArea).toBeCloseTo(12, 9);
  });

  it('perfil rente à cota do beiral sob a extremidade (seção zero no trecho dela): a extremidade é beiral, sem empena', () => {
    // Contorno 10 x 2: a extremidade cobre t de 0 a 2, onde o perfil fica em z 0 (sobe só depois de t = 2, fora do contorno).
    const { p, rr } = resolved(rect(0, 0, 10, 2), [{ t: 0, z: 0 }, { t: 2, z: 0 }, { t: 6, z: 2 }]);
    expect(lines(rr.lines, 'gable')).toHaveLength(0);
    const q = quantifyRoofs(p, 'lv_0').roofs[0]!;
    expect(q.gableLength).toBeCloseTo(0, 9);
    expect(q.gableArea).toBeCloseTo(0, 9);
    // Beiral em z 0: os dois lados de 10 m e as duas extremidades de 2 m, todos planos.
    expect(q.eaveLength).toBeCloseTo(24, 9);
  });
});
