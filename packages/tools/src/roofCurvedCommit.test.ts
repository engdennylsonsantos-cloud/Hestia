import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, type Roof } from '@hestia/model';
import { expandRoofArcs, resolveRoofs, roofTopAt } from '@hestia/engine';
import { addSegs, newDraft, setSegSlope, type NewSeg } from './perimeterSession.ts';
import { commitPerimeter, draftFromElement } from './perimeterCommit.ts';
import { edgeGroupsOf, waterGroupCount } from './roofGeom.ts';

/**
 * Telhado com pegada em arco (linha curva do esboço). O arco é gravado como uma aresta lógica com flecha (`edgeSag`); o
 * motor a subdivide só por dentro (`expandRoofArcs`). O balanço e a inclinação valem por trecho lógico, e o beiral de um
 * arco tem que ser concêntrico ao arco.
 */

const P = (x: number, y: number): Vec2 => ({ x, y });
/** Tolerância de corda do esboço (m): o arco amostrado não se afasta mais que isso do arco verdadeiro. */
const CHORD_TOL = 0.002;

/** Retângulo 10 × 6 com o lado esquerdo em semicírculo de raio 3 (centro (0; 3)), bulge para fora: três retas e um arco. */
function semicircleAndLines(): NewSeg[] {
  return [
    { a: P(0, 0), b: P(10, 0) },
    { a: P(10, 0), b: P(10, 6) },
    { a: P(10, 6), b: P(0, 6) },
    { a: P(0, 6), b: P(0, 0), sag: -3 },
  ];
}

/** Esboço com flags: `arcSlope` (null = empena) e `lineSlope` nos trechos retos (null = empena). */
function sketch(segs: NewSeg[], flags: Array<{ definesSlope: boolean; slopePct?: number }>, slopeDefault = 30) {
  let d = addSegs(newDraft('roof', { slopePct: slopeDefault }), segs);
  flags.forEach((f, i) => {
    d = setSegSlope(d, d.segs[i]!.id, f.definesSlope ? { definesSlope: true, slopePct: f.slopePct } : { definesSlope: false });
  });
  return d;
}

const ALL_EAVE = (n: number): Array<{ definesSlope: boolean }> => Array.from({ length: n }, () => ({ definesSlope: true }));

/** Cria o telhado pelo esboço, aplica ao projeto e resolve o motor; devolve também o tempo do commit e da resolução. */
function createRoof(segs: NewSeg[], flags: Array<{ definesSlope: boolean; slopePct?: number }>, overhang = 0.5) {
  const store = new ProjectStore(createEmptyProject());
  const t0 = performance.now();
  const r = commitPerimeter(store.project, sketch(segs, flags), { typeId: 'rt_ceramica', levelId: 'lv_0', overhang });
  if (!r.ok) return { ok: false as const, message: r.message };
  store.exec(r.commands[0]!);
  const roof = store.project.elements[r.id] as Roof;
  const t1 = performance.now();
  const res = resolveRoofs(store.project, 'lv_0')[0]!;
  return { ok: true as const, id: r.id, message: r.message, roof, res, store, ms: t1 - t0, msResolve: performance.now() - t1 };
}

/** Distância do ponto ao centro do arco. */
const radialOf = (p: Vec2, c: Vec2): number => Math.hypot(p.x - c.x, p.y - c.y);

describe('arco no contorno: ponta a ponta (esboço + motor)', () => {
  it('semicírculo + 3 retas: cria sem problema; o arco é tangente às retas de cima e de baixo, então vira um trecho com elas', () => {
    const out = createRoof(semicircleAndLines(), ALL_EAVE(4));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.res.problem).toBeUndefined();
    expect(out.res.steps).toBeUndefined();
    // Facetas do arco e das retas (subdivisão interna do motor): muitas águas no motor, mas 2 trechos lógicos (varrida curva + lado direito).
    expect(out.res.planes.length).toBeGreaterThan(20);
    expect(out.message).toBe('Telhado criado: 2 águas.');
  });

  it('a água do arco fica do lado de fora da reta de origem: a cota no meio do arco é a do beiral', () => {
    const out = createRoof(semicircleAndLines(), ALL_EAVE(4));
    if (!out.ok) throw new Error(out.message);
    // Ponto a 0,3 m do beiral do arco (raio 3,5 m, centro (0; 3)): cota = 2,80 m + 0,30 × 0,3 m, com a faceta do arco.
    const z = roofTopAt(out.res, P(-3.2, 3));
    expect(z).not.toBeNull();
    expect(z!).toBeGreaterThan(2.8 + 0.3 * 0.25);
    expect(z!).toBeLessThan(2.8 + 0.3 * 0.35);
  });

  it('o motor leva menos de 1 s (commit e resolução) para um semicírculo + 3 retas', () => {
    const out = createRoof(semicircleAndLines(), ALL_EAVE(4));
    if (!out.ok) throw new Error(out.message);
    expect(out.ms + out.msResolve).toBeLessThan(1000);
  });

  it('alterar pela própria pegada (editar sem mudar nada) mantém o arco e as águas', () => {
    const out = createRoof(semicircleAndLines(), ALL_EAVE(4));
    if (!out.ok) throw new Error(out.message);
    const draft = draftFromElement(out.store.project, out.id);
    expect(draft).not.toBeNull();
    const r = commitPerimeter(out.store.project, draft!, { typeId: 'rt_ceramica', levelId: 'lv_0' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.message).toBe('Telhado atualizado: 2 águas.');
    const patch = r.commands[0]!;
    expect(patch.type).toBe('updateElements');
  });
});

describe('balanço sobre arco: beiral concêntrico (raio R + d na face externa, tolerância 2 mm)', () => {
  // Centro do arco de semicírculo: (0; 3), raio 3. O balanço d afasta o beiral para fora: raio R + d.
  it.each([0.5, 1])('arco convexo de raio 3 m com balanço de %s m: os vértices do beiral ficam a R + d do centro', (d) => {
    const out = createRoof(semicircleAndLines(), ALL_EAVE(4), d);
    if (!out.ok) throw new Error(out.message);
    const c = P(0, 3);
    // O contorno gravado só tem os cantos; os pontos do arco vêm da subdivisão interna do motor.
    expect(out.roof.boundary).toHaveLength(4);
    const pts = expandRoofArcs({ ...out.roof }).boundary.filter((q) => q.x <= 1e-6);
    expect(pts.length).toBeGreaterThan(20);
    for (const q of pts) expect(Math.abs(radialOf(q, c) - (3 + d))).toBeLessThanOrEqual(CHORD_TOL);
  });

  it('arco côncavo (bocado de raio 1,133 m) com balanço de 0,5 m: o beiral é concêntrico com raio 0,633 m', () => {
    // Bocado na base: arco de (4; 0) a (6; 0) com flecha 0,6 m para dentro. Raio 1/(2·0,6) + 0,6/2 = 1,1333; centro (5; -0,5333).
    const s = 0.6;
    const r = 1 / (2 * s) + s / 2;
    const c = P(5, s - r);
    const segs: NewSeg[] = [
      { a: P(0, 0), b: P(4, 0) },
      { a: P(4, 0), b: P(6, 0), sag: s },
      { a: P(6, 0), b: P(10, 0) },
      { a: P(10, 0), b: P(10, 6) },
      { a: P(10, 6), b: P(0, 6) },
      { a: P(0, 6), b: P(0, 0) },
    ];
    const out = createRoof(segs, ALL_EAVE(6));
    if (!out.ok) throw new Error(out.message);
    const bite = expandRoofArcs({ ...out.roof }).boundary.filter((q) => q.y > 1e-6 && q.x > 3 && q.x < 7);
    expect(bite.length).toBeGreaterThan(5);
    for (const q of bite) expect(Math.abs(radialOf(q, c) - (r - 0.5))).toBeLessThanOrEqual(CHORD_TOL);
  });
});

describe('balanço que não cabe no arco: recusa em vez de beiral invertido', () => {
  it('bocado côncavo de raio 0,4 m com balanço de 0,5 m: recusa (o beiral se cruza)', () => {
    // Semicírculo de corda 0,8 m: raio 0,4 m, menor que o balanço. A pegada inteira ficaria dentro do beiral.
    const segs: NewSeg[] = [
      { a: P(0, 0), b: P(1.6, 0) },
      { a: P(1.6, 0), b: P(2.4, 0), sag: 0.4 },
      { a: P(2.4, 0), b: P(4, 0) },
      { a: P(4, 0), b: P(4, 4) },
      { a: P(4, 4), b: P(0, 4) },
      { a: P(0, 4), b: P(0, 0) },
    ];
    const out = createRoof(segs, ALL_EAVE(6));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message).toMatch(/o balanço é maior que o raio de um trecho côncavo/);
  });

  it('arco tangente ao lado (cúspide de 180°): recusa, a esquadria do beiral dispara', () => {
    // Arco de (0; 0) a (2; 0) com flecha 1: sai tangente ao lado esquerdo, que volta sobre si mesmo no canto.
    const segs: NewSeg[] = [
      { a: P(0, 0), b: P(2, 0), sag: 1 },
      { a: P(2, 0), b: P(6, 0) },
      { a: P(6, 0), b: P(6, 4) },
      { a: P(6, 4), b: P(0, 4) },
      { a: P(0, 4), b: P(0, 0) },
    ];
    const out = createRoof(segs, ALL_EAVE(5));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.message).toMatch(/canto agudo/);
  });
});

describe('arestas de um arco são um trecho lógico só', () => {
  it('um arco amostrado em muitos lados é um trecho; a reta de cima e a de baixo, tangentes ao arco, entram nele', () => {
    const out = createRoof(semicircleAndLines(), ALL_EAVE(4));
    if (!out.ok) throw new Error(out.message);
    const e = expandRoofArcs({ ...out.roof });
    const groups = edgeGroupsOf(e.boundary, e.edgeSlopes, e.edgeOverhangs);
    expect(out.roof.edgeSlopes).toHaveLength(4);
    expect(e.edgeSlopes.length).toBeGreaterThan(20);
    // Lados do arco e as duas retas tangentes no mesmo trecho; o lado direito (canto de 90°) é outro.
    const sweep = groups[0];
    expect(groups[1]).not.toBe(sweep);
    expect(groups[2]).toBe(sweep);
    expect(new Set(groups).size).toBe(2);
    expect(waterGroupCount(e.boundary, e.edgeSlopes, e.edgeOverhangs)).toBe(2);
  });

  it('arco de empena (sem inclinação) com três retas que definem: três águas, o arco é parede', () => {
    const flags = [
      { definesSlope: true },
      { definesSlope: true },
      { definesSlope: true },
      { definesSlope: false },
    ];
    const out = createRoof(semicircleAndLines(), flags);
    if (!out.ok) throw new Error(out.message);
    expect(out.res.problem).toBeUndefined();
    expect(out.message).toBe('Telhado criado: 3 águas.');
  });

  it('um lado reto dividido em dois pontos com a mesma inclinação conta como uma água (4 trechos, não 5)', () => {
    const segs: NewSeg[] = [
      { a: P(0, 0), b: P(5, 0) },
      { a: P(5, 0), b: P(10, 0) },
      { a: P(10, 0), b: P(10, 6) },
      { a: P(10, 6), b: P(0, 6) },
      { a: P(0, 6), b: P(0, 0) },
    ];
    const out = createRoof(segs, ALL_EAVE(5));
    if (!out.ok) throw new Error(out.message);
    expect(waterGroupCount(out.roof.boundary, out.roof.edgeSlopes, out.roof.edgeOverhangs)).toBe(4);
  });
});
