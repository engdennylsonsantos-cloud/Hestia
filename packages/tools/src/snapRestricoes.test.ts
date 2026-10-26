import { describe, expect, it } from 'vitest';
import { arcFromSagitta, dist, v2 } from '@hestia/geom';
import { createEmptyProject, type Project, type Wall } from '@hestia/model';
import { infer, type InferContext } from './infer.ts';
import { DEFAULT_SNAP } from './types.ts';
import { drawWall, makeEnv } from './testEnv.ts';

/** 1 px = 0,005 m: tolerância de captura de 10 px = 0,05 m (o padrão dos testes de snap). */
const MPP = 0.005;

const at = (p: Project, x: number, y: number, extra: Partial<InferContext> = {}) =>
  infer({ x, y }, { project: p, levelId: 'lv_0', mpp: MPP, gridStep: 0.1, ...extra });

/** Projeto com paredes desenhadas pela ferramenta Parede. Cada par de pontos é uma parede. */
function walls(...pairs: Array<[[number, number], [number, number]]>) {
  const ctx = makeEnv();
  for (const [a, b] of pairs) drawWall(ctx.env, a, b);
  return ctx.store.project;
}

/** Troca o eixo da parede pelo arco de flecha `sag` (mesma corda). */
function curved(p: Project, sag: number): Project {
  const id = Object.keys(p.elements).find((k) => p.elements[k]!.kind === 'wall')!;
  const w = p.elements[id] as Wall;
  return { ...p, elements: { ...p.elements, [id]: { ...w, sag } } };
}


describe('snap por restrições (S-01): alinhamentos se combinam', () => {
  it('duas referências, x e y, produzem o ponto de interseção (2; 3)', () => {
    // Paredes curtas e separadas: os eixos não se cruzam, então só as referências de alinhamento contam.
    const p = walls([[2, 5], [2, 8]], [[0, 3], [1, 3]]);
    const r = at(p, 2.03, 3.03, { snap: { ...DEFAULT_SNAP, grid: false, faces: false } });
    expect(r.kind).toBe('alignment');
    expect(dist(r.point, v2(2, 3))).toBeLessThan(1e-6);
    expect(r.guides.length).toBe(2);
  });

  it('face + alinhamento: o cruzamento da linha de referência com a face vira o ponto', () => {
    // Face y = 0,092 de uma parede em y = 0; referência vertical x = 1 vinda de outra parede, longe da face.
    // O cruzamento (1; 0,092) é o ponto que o usuário mira: vence a aresta da face mais próxima.
    const p = walls([[0, 0], [4, 0]], [[1, 3], [1, 6]]);
    const r = at(p, 1.01, 0.095, { snap: { ...DEFAULT_SNAP, grid: false } });
    expect(r.kind).toBe('alignment');
    expect(dist(r.point, v2(1, 0.092))).toBeLessThan(1e-6);
  });
});

describe('grade e captura de eixo (S-03 e S-04)', () => {
  it('grade desligada não quantiza o alinhamento (x livre = 1,03)', () => {
    const p = walls([[0, 2], [0, 3]]);
    // Referência extra horizontal em y = 0 (sem parede perto do cursor): só o alinhamento responde.
    const r = at(p, 1.03, 0.03, { snap: { ...DEFAULT_SNAP, grid: false, faces: false }, extraPoints: [v2(2, 0)] });
    expect(r.kind).toBe('alignment');
    expect(r.point.x).toBeCloseTo(1.03, 9);
  });

  it('grade ligada quantiza o mesmo alinhamento (x = 1,0)', () => {
    const p = walls([[0, 2], [0, 3]]);
    const r = at(p, 1.03, 0.03, { snap: { ...DEFAULT_SNAP, faces: false }, extraPoints: [v2(2, 0)] });
    expect(r.kind).toBe('alignment');
    expect(r.point.x).toBeCloseTo(1.0, 9);
  });

  it('“Nenhum” + “Extremidade” captura a ponta da parede mesmo com o eixo desligado', () => {
    const p = walls([[0, 0], [4, 0]]);
    const r = at(p, 4.01, 0.01, { snap: { ...DEFAULT_SNAP, axis: false, faces: false, core: false, intersections: false, midpoint: false, perpendicular: false, alignment: false, grid: false, endpoint: true } });
    expect(r.kind).toBe('endpoint');
    expect(dist(r.point, v2(4, 0))).toBeLessThan(1e-9);
  });

  it('eixo desligado não captura o eixo da parede (sem endpoint, sem nearest)', () => {
    const p = walls([[0, 0], [4, 0]]);
    const r = at(p, 2.01, 0.01, { snap: { ...DEFAULT_SNAP, axis: false, endpoint: false, midpoint: false, faces: false, core: false, intersections: false, alignment: false, grid: false } });
    expect(r.kind).toBe('none');
  });
});

describe('prioridade por distância (S-02)', () => {
  it('canto visível mais perto vence a extremidade do eixo a uma distância maior (zoom fora)', () => {
    // Tolerância 0,1 m (mpp 0,01). Ponta do eixo em (4;0) a 0,07 m; canto da face em (4;0,092) a 0,022 m.
    const p = walls([[0, 0], [4, 0]]);
    const r = at(p, 4, 0.07, { mpp: 0.01 });
    expect(r.kind).toBe('face');
    expect(dist(r.point, v2(4, 0.092))).toBeLessThan(1e-6);
  });

  it('canto visível a meio pixel vence em qualquer zoom (não some nem perde para o eixo)', () => {
    // Canto da face em (4; 0,092); cursor a meio pixel dele. A tolerância muda com o zoom, a escolha não.
    const p = walls([[0, 0], [4, 0]]);
    for (const m of [0.005, 0.01, 0.02]) {
      const r = at(p, 4, 0.092 + 0.5 * m, { mpp: m });
      expect(r.kind, `mpp ${m}`).toBe('face');
      expect(dist(r.point, v2(4, 0.092))).toBeLessThan(1e-9);
    }
  });

  it('Tab percorre os candidatos ao alcance, do melhor para o pior, e volta ao início', () => {
    // Em (4; 0,03): a extremidade (4;0) é o melhor; depois a aresta da tampa sob o cursor, e assim por diante.
    const p = walls([[0, 0], [4, 0]]);
    const first = at(p, 4, 0.03);
    const second = at(p, 4, 0.03, { cycle: 1 });
    const third = at(p, 4, 0.03, { cycle: 2 });
    expect(first.kind).toBe('endpoint');
    expect(second.kind).toBe('nearest');
    expect(dist(second.point, first.point)).toBeGreaterThan(1e-6);
    expect(third.kind).toBe('midpoint');
    // O ciclo tem tamanho finito: depois de N passos volta à primeira captura.
    const n = [...Array(30).keys()].map((k) => k + 1).find((k) => {
      const r = at(p, 4, 0.03, { cycle: k });
      return r.kind === first.kind && dist(r.point, first.point) < 1e-9;
    });
    expect(n).toBeGreaterThan(2);
  });

  it('histerese: a captura anterior se mantém quando ainda vale', () => {
    const p = walls([[0, 0], [4, 0]]);
    const prev = at(p, 4, 0.03);
    const kept = at(p, 4, 0.03, { previous: prev });
    expect(kept.kind).toBe(prev.kind);
    expect(dist(kept.point, prev.point)).toBeLessThan(1e-9);
  });
});

describe('ignore cobre os pontos extras (S-10)', () => {
  it('vértice de um piso que está em ignore não é captura', () => {
    const p = walls([[0, 0], [1, 0]]);
    const r = at(p, 5, 5, { extraPoints: [{ x: 5, y: 5, hostId: 'f1' }], ignore: new Set(['f1']) });
    expect(r.kind).not.toBe('endpoint');
  });

  it('o mesmo vértice sem ignore é captura', () => {
    const p = walls([[0, 0], [1, 0]]);
    const r = at(p, 5, 5, { extraPoints: [{ x: 5, y: 5, hostId: 'f1' }] });
    expect(r.kind).toBe('endpoint');
  });
});

describe('paredes curvas (S-09): a perpendicular cai sobre o arco', () => {
  it('pé da perpendicular em arco cai sobre o próprio arco (não sobre a corda)', () => {
    // Arco com flecha de 1 m sobre a corda (0;0)–(4;0), bulge para +y. A partir de (4,5; -4), o pé radial está
    // perto de (0,2; 0,3): sobre o arco, fora da corda reta. A reta da corda daria um ponto diferente.
    const p = curved(walls([[0, 0], [4, 0]]), 1);
    const arc = arcFromSagitta(v2(0, 0), v2(4, 0), 1)!;
    const from = v2(4.5, -4);
    const u = { x: from.x - arc.center.x, y: from.y - arc.center.y };
    const n = Math.hypot(u.x, u.y);
    const foot = v2(arc.center.x - (u.x / n) * arc.radius, arc.center.y - (u.y / n) * arc.radius);
    const r = at(p, foot.x + 0.01, foot.y, { from, snap: { ...DEFAULT_SNAP, grid: false, faces: false, core: false, alignment: false, intersections: false, endpoint: false, midpoint: false } });
    expect(r.kind).toBe('perpendicular');
    expect(dist(r.point, foot)).toBeLessThan(1e-6);
    expect(Math.abs(dist(r.point, arc.center) - arc.radius)).toBeLessThan(1e-6);
  });
});

describe('projeto vazio', () => {
  it('sem elementos cai na grade (grade ligada por padrão)', () => {
    expect(at(createEmptyProject(), 1.04, 1.06).kind).toBe('grid');
  });
});

describe('faces de parede curva (S-09): arcos concêntricos, não a corda', () => {
  it('cursor sobre a face externa do arco cai no arco de raio R ± meia espessura', () => {
    // Arco de flecha 1 m sobre (0;0)–(4;0); espessura 0,184 m, meia 0,092 m. Pé radial do cursor no arco externo.
    const p = curved(walls([[0, 0], [4, 0]]), 1);
    const arc = arcFromSagitta(v2(0, 0), v2(4, 0), 1)!;
    const u = { x: 0.6, y: 0.8 };
    const onFace = v2(arc.center.x + u.x * (arc.radius + 0.092), arc.center.y + u.y * (arc.radius + 0.092));
    const r = at(p, onFace.x + 0.005, onFace.y + 0.005, { snap: { ...DEFAULT_SNAP, grid: false, alignment: false, intersections: false, perpendicular: false, endpoint: false, midpoint: false } });
    const d = dist(r.point, arc.center);
    const onOuter = Math.abs(d - (arc.radius + 0.092)) < 1e-6;
    const onInner = Math.abs(d - (arc.radius - 0.092)) < 1e-6;
    expect(onOuter || onInner).toBe(true);
    expect(r.kind).toBe('nearest');
  });
});

describe('visibilidade (S-07): elemento oculto não é alvo de captura', () => {
  it('parede fora da vista não gera ponta de captura', () => {
    const p = walls([[0, 0], [4, 0]]);
    const id = Object.keys(p.elements).find((k) => p.elements[k]!.kind === 'wall')!;
    const cursorAtEnd = { x: 4, y: 0.01 };
    expect(at(p, cursorAtEnd.x, cursorAtEnd.y).kind).toBe('endpoint');
    expect(at(p, cursorAtEnd.x, cursorAtEnd.y, { isVisible: (w) => w.id !== id }).kind).not.toBe('endpoint');
  });
});
