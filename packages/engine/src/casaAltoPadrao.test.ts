import { describe, expect, it } from 'vitest';
import { closeGapsSafe, multiArea, offsetMulti, pointInMulti, ringArea, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import {
  TEMPLATES,
  buildTemplate,
  isOpening,
  isWall,
  migrateProject,
  validateProject,
  type Opening,
  type Project,
  type Wall,
} from '@hestia/model';
import {
  computeSection,
  frameOfWall,
  generateStraightRun,
  openingGeometry,
  resolveLevel,
  resolveRoofs,
  resolveSlabs,
  resolveStairs,
  roofSurfaceIssues,
  roofTopAt,
  roofWallIssues,
  stairValidationIssues,
  wallZRange,
  type ResolvedLevel,
} from './index.ts';

/**
 * Verificação da casa de alto padrão (template `house-premium`, docs/projetos/casa-alto-padrao/B-projeto-planta.md, v2,
 * com as alterações do coordenador). Cada bloco mede o modelo montado, sem depender de números da tabela do B além dos
 * que estão no próprio documento. Avisos de validação são listados no teste, não bloqueiam.
 */

const P = (x: number, y: number): Vec2 => ({ x, y });
const TOL = 5e-4;
const rel = (got: number, want: number): number => Math.abs(got - want) / Math.abs(want);

const project = (): Project => buildTemplate('house-premium');

/** Paredes de um nível, na ordem de criação. */
const paredes = (p: Project, levelId: string): Wall[] =>
  Object.values(p.elements).filter(isWall).filter((w) => w.levelId === levelId).sort((a, b) => a.order - b.order);

/** Eixo de parede como segmento (a, b) para a grade de cômodos. */
interface Seg {
  a: Vec2;
  b: Vec2;
}

/** Separadores sem parede: a planta de B fecha cômodos que a tabela de paredes deixa abertos (passagens e pé da escada). */
const SEPARADORES_TERREO: Seg[] = [
  // Passagem entre vestíbulo e hall, ancorada em T-I-05 (agora x = 6,854 — DEC-3): a linha do pé da escada e a da passagem.
  { a: P(6.854, 2.0), b: P(8.9, 2.0) },
  { a: P(5.5, 2.0), b: P(6.854, 2.0) },
  // Lado do lance no trecho de passagem livre (y 5,9 a 6,56).
  { a: P(6.854, 5.9), b: P(6.854, 6.56) },
];
const SEPARADORES_PAV2: Seg[] = [
  // Borda do vazio da escada no topo do lance (ligação com o corredor).
  { a: P(5.5, 6.56), b: P(6.7, 6.56) },
];

/**
 * Cômodos por grade de eixos: a grade tem as coordenadas de todos os extremos; cada aresta entre duas células é bloqueada
 * se uma parede (eixo) a cobre inteira. Vãos de porta não bloqueiam (cômodo é o que as paredes fecham). Componentes que
 * tocam a borda da grade sem parede são "externos" (pátio, varanda aberta). A área é a do eixo, como no B.
 */
function comodos(segs: Seg[]): { area: (pt: Vec2) => number; externo: (pt: Vec2) => boolean; fechados: number; componentes: number } {
  const q = (v: number): number => Math.round(v * 1e6) / 1e6;
  const xs = [...new Set(segs.flatMap((s) => [q(s.a.x), q(s.b.x)]))].sort((a, b) => a - b);
  const ys = [...new Set(segs.flatMap((s) => [q(s.a.y), q(s.b.y)]))].sort((a, b) => a - b);
  const verts = segs.filter((s) => Math.abs(s.a.x - s.b.x) < 1e-9).map((s) => ({ x: q(s.a.x), y0: Math.min(s.a.y, s.b.y), y1: Math.max(s.a.y, s.b.y) }));
  const hors = segs.filter((s) => Math.abs(s.a.y - s.b.y) < 1e-9).map((s) => ({ y: q(s.a.y), x0: Math.min(s.a.x, s.b.x), x1: Math.max(s.a.x, s.b.x) }));
  const diag = segs.filter((s) => Math.abs(s.a.x - s.b.x) >= 1e-9 && Math.abs(s.a.y - s.b.y) >= 1e-9);
  if (diag.length) throw new Error('eixo diagonal na grade de cômodos');
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  // Aresta vertical em x = xs[i], entre ys[j] e ys[j+1].
  const bloqV = (i: number, j: number): boolean => verts.some((v) => Math.abs(v.x - xs[i]!) < 1e-6 && v.y0 <= ys[j]! + 1e-6 && v.y1 >= ys[j + 1]! - 1e-6);
  const bloqH = (j: number, i: number): boolean => hors.some((h) => Math.abs(h.y - ys[j]!) < 1e-6 && h.x0 <= xs[i]! + 1e-6 && h.x1 >= xs[i + 1]! - 1e-6);
  const id = (i: number, j: number): number => i * ny + j;
  const comp = new Int32Array(nx * ny).fill(-1);
  const info: Array<{ area: number; externo: boolean }> = [];
  for (let s = 0; s < nx * ny; s++) {
    if ((comp[s] ?? -1) >= 0) continue;
    const c = info.length;
    let area = 0;
    let externo = false;
    const pilha = [s];
    comp[s] = c;
    while (pilha.length) {
      const k = pilha.pop()!;
      const i = Math.floor(k / ny);
      const j = k % ny;
      area += (xs[i + 1]! - xs[i]!) * (ys[j + 1]! - ys[j]!);
      const viz: Array<[number, number, boolean]> = [];
      // Esquerda, direita, abaixo, acima: (vizinho i, j, aresta bloqueada?). Aresta de borda sem parede leva ao exterior.
      if (i === 0) { if (!bloqV(0, j)) externo = true; } else viz.push([i - 1, j, bloqV(i, j)]);
      if (i === nx - 1) { if (!bloqV(nx, j)) externo = true; } else viz.push([i + 1, j, bloqV(i + 1, j)]);
      if (j === 0) { if (!bloqH(0, i)) externo = true; } else viz.push([i, j - 1, bloqH(j, i)]);
      if (j === ny - 1) { if (!bloqH(ny, i)) externo = true; } else viz.push([i, j + 1, bloqH(j + 1, i)]);
      for (const [vi, vj, bloq] of viz) {
        if (bloq) continue;
        const t = id(vi, vj);
        if ((comp[t] ?? -1) < 0) {
          comp[t] = c;
          pilha.push(t);
        }
      }
    }
    info.push({ area, externo });
  }
  const achar = (pt: Vec2): number => {
    let i = -1;
    let j = -1;
    for (let k = 0; k < nx; k++) if (pt.x >= xs[k]! && pt.x < xs[k + 1]!) i = k;
    for (let k = 0; k < ny; k++) if (pt.y >= ys[k]! && pt.y < ys[k + 1]!) j = k;
    if (i < 0 || j < 0) throw new Error(`ponto (${pt.x}; ${pt.y}) fora da grade`);
    return comp[id(i, j)]!;
  };
  return {
    area: (pt) => info[achar(pt)]!.area,
    externo: (pt) => info[achar(pt)]!.externo,
    fechados: info.filter((c) => !c.externo).length,
    componentes: info.length,
  };
}

const segsDo = (p: Project, levelId: string, extra: Seg[] = []): Seg[] => [...paredes(p, levelId).map((w) => ({ a: w.a, b: w.b })), ...extra];

/** Cômodo de cada nível: ponto dentro do cômodo e área esperada (eixo a eixo, do B seções 5.1). */
const COMODOS_TERREO: Array<[string, Vec2, number]> = [
  ['garagem', P(2.75, 2.75), 30.25],
  ['cozinha', P(2.75, 7.5), 22.0],
  ['despensa', P(2.75, 10.5), 11.0],
  ['área de serviço', P(2.75, 12.75), 13.75],
  ['vestíbulo', P(7.8, 1.0), 6.8],
  ['hall', P(7.8, 4.0), 9.32976],
  ['escada (projeção)', P(6.1, 4.0), 6.17424],
  ['lavabo', P(9.85, 1.0), 3.8],
  ['sala de estar (em L)', P(10.0, 6.0), 25.84],
  ['sala de jantar', P(7.2, 8.5), 13.056],
];
const COMODOS_PAV2: Array<[string, Vec2, number]> = [
  ['SUÍTE MASTER (NE, quarto)', P(9.9, 10.9), 23.4],
  ['SUÍTE 3 (SE, quarto)', P(10.3, 3.3), 18.696],
  ['banheiro da SUÍTE 3', P(7.2, 1.6), 10.88],
  ['closet da SUÍTE 3', P(7.8, 4.9), 7.392],
  ['SUÍTE 2 (quarto)', P(2.75, 9.6), 20.57],
  ['banheiro da SUÍTE 2', P(1.4, 12.75), 7.0],
  ['closet da SUÍTE 2', P(4.1, 12.75), 6.75],
  ['closet da SUÍTE MASTER', P(6.75, 8.9), 5.6],
  ['banheiro da SUÍTE MASTER', P(6.75, 12.0), 10.0],
  ['home office', P(2.75, 3.25), 36.08],
  ['corredor íntimo', P(3.0, 7.16), 14.1],
  ['vazio da escada (projeção)', P(6.1, 4.9), 4.032],
];

/** Contorno externo: união das faces de todas as paredes do grupo principal, sem os vãos (fragment). */
function contornoExterno(r: ResolvedLevel, ancora: string): MultiPolygon {
  const grupo = r.clusters.find((c) => c.wallIds.includes(ancora));
  if (!grupo) throw new Error(`grupo de ${ancora} não encontrado`);
  const faces: MultiPolygon[] = grupo.wallIds.flatMap((id) => r.walls[id]!.layers.map((l) => l.fragment));
  return union(...faces);
}

/** Junções: fresta aberta (fecho de 1,5 mm) e soma das camadas x união, como em juntasInvariantes.test.ts. */
function juntas(r: ResolvedLevel): { fresta: number; sobreposicao: number } {
  const polys: MultiPolygon = Object.values(r.walls).flatMap((w) => w.layers.flatMap((l) => l.cut));
  const soma = Object.values(r.walls).reduce((s, w) => s + w.layers.reduce((t, l) => t + multiArea(l.cut), 0), 0);
  const u = closeGapsSafe(union(...polys.map((poly) => [poly] as MultiPolygon)), 2e-5, 1e-4);
  const fecho = offsetMulti(offsetMulti(u, 0.0015), -0.0015);
  return { fresta: multiArea(fecho) - multiArea(u), sobreposicao: soma - multiArea(u) };
}

/** Caixa de contorno de um anel. */
const caixa = (ring: Vec2[]): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: Math.min(...ring.map((q) => q.x)),
  minY: Math.min(...ring.map((q) => q.y)),
  maxX: Math.max(...ring.map((q) => q.x)),
  maxY: Math.max(...ring.map((q) => q.y)),
});

describe('casa de alto padrão: montagem', () => {
  it('está registrada em TEMPLATES como "Casa de alto padrão, 2 pavimentos"', () => {
    const t = TEMPLATES.find((x) => x.id === 'house-premium');
    expect(t?.name).toBe('Casa de alto padrão, 2 pavimentos');
    expect(t?.description.length).toBeGreaterThan(0);
    expect(t?.area).toBe('330 m²');
  });

  it('tem 2 níveis, 32 paredes, 38 aberturas (18 no térreo e 20 no pavimento 2), 2 pisos, 1 laje, 1 telhado, 1 escada e 6 vistas', () => {
    const p = project();
    expect(p.levels.map((l) => l.id)).toEqual(['lv_0', 'lv_1']);
    const els = Object.values(p.elements);
    expect(els.filter(isWall)).toHaveLength(32);
    expect(els.filter(isOpening)).toHaveLength(38);
    expect(paredes(p, 'lv_0')).toHaveLength(15);
    expect(paredes(p, 'lv_1')).toHaveLength(17);
    expect(els.filter((e) => e.kind === 'floor')).toHaveLength(2);
    expect(els.filter((e) => e.kind === 'slab')).toHaveLength(1);
    expect(els.filter((e) => e.kind === 'roof')).toHaveLength(1);
    expect(els.filter((e) => e.kind === 'stair')).toHaveLength(1);
    expect(p.views.map((v) => `${v.kind}:${v.name}`)).toEqual([
      'section:Corte AA',
      'section:Corte BB',
      'elevation:Norte',
      'elevation:Sul',
      'elevation:Leste',
      'elevation:Oeste',
    ]);
  });

  it('marcas de portas e janelas são únicas', () => {
    const marcas = Object.values(project().elements).filter(isOpening).map((o) => o.mark);
    expect(new Set(marcas).size).toBe(marcas.length);
    expect(marcas.every((m) => /^(P|J|V)-\d{2}$/.test(m))).toBe(true);
  });

  it('validateProject sem erros (avisos listados no teste)', () => {
    const issues = validateProject(project());
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    // Avisos do modelo: nenhum. Avisos de escada e telhado, do engine: também nenhum (ver os testes abaixo).
    expect(issues.map((i) => i.code)).toEqual([]);
  });

  it('abre e salva: serialização de ida e volta idêntica', () => {
    const p = project();
    const texto = JSON.stringify(p, null, 1);
    const volta = migrateProject(JSON.parse(texto));
    expect(JSON.parse(JSON.stringify(volta, null, 1))).toEqual(JSON.parse(texto));
  });
});

describe('casa de alto padrão: níveis, junções e contorno', () => {
  it('resolveLevel sem exceção nos dois níveis, com as junções limpas', () => {
    const p = project();
    for (const lv of ['lv_0', 'lv_1']) {
      const r = resolveLevel(p, lv);
      expect(Object.keys(r.walls)).toHaveLength(lv === 'lv_0' ? 15 : 17);
      const j = juntas(r);
      expect(j.fresta, `${lv}: fresta aberta`).toBeLessThan(2e-5);
      expect(Math.abs(j.sobreposicao), `${lv}: camadas x união`).toBeLessThan(1e-5);
    }
  });

  it('pavimento 2: contorno externo é 1 anel e a área é a das faces externas (11,99 × 14,24 m)', () => {
    const p = project();
    const c = contornoExterno(resolveLevel(p, 'lv_1'), 'S-EXT-O');
    expect(c).toHaveLength(1);
    const anel = c[0]![0]!;
    const caixaAnel = caixa(anel);
    expect(rel(caixaAnel.maxX - caixaAnel.minX, 11.992)).toBeLessThan(1e-4);
    expect(rel(caixaAnel.maxY - caixaAnel.minY, 14.242)).toBeLessThan(1e-4);
    expect(rel(Math.abs(ringArea(anel)), 11.992 * 14.242)).toBeLessThan(TOL);
  });

  it('térreo: contorno externo é 1 anel e a área é a da caixa menos a varanda aberta ao norte', () => {
    const p = project();
    const c = contornoExterno(resolveLevel(p, 'lv_0'), 'T-EXT-O');
    expect(c).toHaveLength(1);
    // Varanda gourmet aberta: x 5,592 a 11,629 (faces de T-I-01 e de T-EXT-L) e y 10,462 a 14,121 (sem parede no norte).
    const recorte = (11.629 - 5.592) * (14.121 - 10.462) + 0.242 * 0.121;
    const esperado = 11.992 * 14.242 - recorte;
    expect(rel(Math.abs(ringArea(c[0]![0]!)), esperado)).toBeLessThan(TOL);
  });

  it('cômodos fechados pelas paredes: nº de furos do contorno = nº de cômodos fechados (grade de eixos)', () => {
    const p = project();
    // O grupo principal do térreo exclui o pé da escada (T-I-05), que é parede solta por projeto.
    const furosTerreo = contornoExterno(resolveLevel(p, 'lv_0'), 'T-EXT-O')[0]!.length - 1;
    const furosPav2 = contornoExterno(resolveLevel(p, 'lv_1'), 'S-EXT-O')[0]!.length - 1;
    // Com os separadores de passagem, vestíbulo, hall e escada viram cômodos próprios: a grade tem mais cômodos
    // fechados que o contorno de faces (que não vê passagem sem parede). Por isso a conferência é só a de paredes.
    expect(furosTerreo).toBe(comodos(segsDo(p, 'lv_0')).fechados);
    expect(furosPav2).toBe(comodos(segsDo(p, 'lv_1')).fechados);
  });

  it('cada cômodo do térreo tem a área do B (eixo a eixo)', () => {
    const p = project();
    const g = comodos(segsDo(p, 'lv_0', SEPARADORES_TERREO));
    for (const [nome, pt, area] of COMODOS_TERREO) {
      expect(g.externo(pt), `${nome} não pode ser externo`).toBe(false);
      expect(rel(g.area(pt), area), `${nome}: ${g.area(pt)} m² (esperado ${area})`).toBeLessThan(1e-6);
    }
    // Varanda gourmet: cômodo aberto ao norte, portanto externo pela grade (22,50 m² do B).
    expect(g.externo(P(8.0, 12.0))).toBe(true);
  });

  it('cada cômodo do pavimento 2 tem a área do B (eixo a eixo), com a parede S-I-13 que separa closet e banheiro 3', () => {
    const p = project();
    const g = comodos(segsDo(p, 'lv_1', SEPARADORES_PAV2));
    for (const [nome, pt, area] of COMODOS_PAV2) {
      expect(g.externo(pt), `${nome} não pode ser externo`).toBe(false);
      expect(rel(g.area(pt), area), `${nome}: ${g.area(pt)} m² (esperado ${area})`).toBeLessThan(1e-6);
    }
  });

  it('sem a S-I-13, closet 3 e banheiro 3 virariam um cômodo só (lacuna da tabela do B, corrigida)', () => {
    const p = project();
    const sem = segsDo(p, 'lv_1', SEPARADORES_PAV2).filter((s) => !(s.a.y === 10 && s.b.y === 10));
    const g = comodos(sem);
    expect(rel(g.area(P(6.75, 8.9)), 5.6 + 10.0)).toBeLessThan(1e-6);
  });
});

describe('casa de alto padrão: escada, laje e telhado', () => {
  it('escada: 17 espelhos e h ≈ 0,176 m; sem erro nem aviso de norma', () => {
    const p = project();
    const [st] = resolveStairs(p);
    expect(st).toBeDefined();
    expect(st!.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(st!.issues.map((i) => i.code)).toEqual([]);
    expect(st!.riserCount).toBe(17);
    expect(st!.riserHeight).toBeCloseTo(3 / 17, 6);
    expect(st!.baseZ).toBeCloseTo(0, 9);
    expect(st!.topZ).toBeCloseTo(3, 9);
    // 2e + p = 2 × 0,176 + 0,285 = 0,637 m, dentro da faixa 0,63 a 0,64.
    const e = st!.riserHeight;
    expect(2 * e + 0.285).toBeGreaterThan(0.63);
    expect(2 * e + 0.285).toBeLessThan(0.64);
    expect(stairValidationIssues(p)).toEqual([]);
  });

  it('o lance do modelo é o mesmo croqui de generateStraightRun (eixo 6,10; 2,00, subindo para o norte)', () => {
    const p = project();
    const st = Object.values(p.elements).find((e) => e.kind === 'stair');
    if (!st || st.kind !== 'stair') throw new Error('escada não encontrada');
    const run = st.components[0];
    if (!run || !('boundaryLeft' in run)) throw new Error('lance não encontrado');
    const ref = generateStraightRun({ start: P(6.1, 2.0), dir: P(0, 1), width: 1.2, risers: 17, tread: 0.285 });
    const ordena = (cs: Array<{ a: Vec2; b: Vec2 }>): number[] => cs.flatMap((c) => [c.a.x, c.a.y, c.b.x, c.b.y]).sort((x, y) => x - y);
    for (const [k, v] of [
      ['boundaryLeft', run.boundaryLeft],
      ['boundaryRight', run.boundaryRight],
      ['risers', run.risers],
    ] as const) {
      const a = ordena(v);
      const b = ordena(ref[k as 'boundaryLeft' | 'boundaryRight' | 'risers']);
      expect(a.length, k).toBe(b.length);
      a.forEach((x, i) => expect(Math.abs(x - b[i]!), k).toBeLessThan(1e-9));
    }
  });

  it('laje do pavimento 2: furo da escada com área > 0, fora de banheiro master, closet master e home office', () => {
    const p = project();
    const [laje] = resolveSlabs(p, 'lv_1');
    expect(laje).toBeDefined();
    const cheia = 11.992 * 14.242;
    const furo = cheia - multiArea(laje!.polygon);
    expect(furo).toBeGreaterThan(3.5);
    expect(furo).toBeLessThan(5.5);
    // Cômodos com 5 cm de folga para dentro de cada parede (meia espessura do PA-14): o furo não pode entrar neles.
    const folga = 0.092;
    const dentro = (x0: number, y0: number, x1: number, y1: number): Vec2[] => {
      const pts: Vec2[] = [];
      for (let x = x0 + folga; x <= x1 - folga + 1e-9; x += 0.02) for (let y = y0 + folga; y <= y1 - folga + 1e-9; y += 0.02) pts.push(P(x, y));
      return pts;
    };
    const salas = {
      'banheiro da SUÍTE 3': dentro(5.5, 0, 8.9, 3.2),
      'closet da SUÍTE 3': dentro(6.7, 3.2, 8.9, 6.56),
      'home office': dentro(0, 0, 5.5, 6.56),
    };
    for (const [nome, pts] of Object.entries(salas)) {
      expect(pts.every((q) => pointInMulti(q, laje!.polygon)), `${nome} invadido pelo furo`).toBe(true);
    }
    // O vazio está na projeção da escada: o centro do lance (6,10; 4,9) não pode estar na laje.
    expect(pointInMulti(P(6.1, 4.9), laje!.polygon)).toBe(false);
  });

  it('laje sob o pavimento 2 a 2,83 m; paredes do térreo com topo nessa cota', () => {
    const p = project();
    const [laje] = resolveSlabs(p, 'lv_1');
    expect(laje!.bottomZ).toBeCloseTo(2.83, 9);
    for (const w of paredes(p, 'lv_0')) {
      const z = wallZRange(p, w);
      expect(z.z0 + z.height, `${w.id}: topo`).toBeCloseTo(2.83, 6);
    }
    for (const w of paredes(p, 'lv_1')) {
      const z = wallZRange(p, w);
      expect(z.z0 + z.height, `${w.id}: topo`).toBeCloseTo(5.8, 6);
    }
  });

  it('telhado de 4 águas a 30 %: beiral 5,80 m e cumeeira ≈ 7,78 m, sem aviso bloqueante', () => {
    const p = project();
    const [telhado] = resolveRoofs(p, 'lv_1');
    expect(telhado).toBeDefined();
    expect(telhado!.planes).toHaveLength(4);
    expect(telhado!.eaveZ).toBeCloseTo(5.8, 6);
    // Centro da planta: meia largura menor (6,596) × 0,30.
    const cumeeira = roofTopAt(telhado!, P(5.875, 7.0));
    expect(cumeeira).not.toBeNull();
    expect(cumeeira!).toBeCloseTo(5.8 + 0.3 * 6.596, 2);
    expect(roofSurfaceIssues(p).filter((i) => i.severity === 'error')).toEqual([]);
    expect(roofWallIssues(p).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('casa de alto padrão: aberturas', () => {
  it('nenhuma abertura sobreposta a outra na mesma parede; folga ≥ 0,10 m entre vãos', () => {
    const p = project();
    const porParede = new Map<string, Array<{ id: string; lo: number; hi: number }>>();
    for (const o of Object.values(p.elements).filter(isOpening)) {
      const t = p.openingTypes[o.typeId]!;
      const lista = porParede.get(o.hostId) ?? [];
      lista.push({ id: o.id, lo: o.offset - t.width / 2, hi: o.offset + t.width / 2 });
      porParede.set(o.hostId, lista);
    }
    for (const [host, lista] of porParede) {
      lista.sort((a, b) => a.lo - b.lo);
      for (let i = 1; i < lista.length; i++) {
        const gap = lista[i]!.lo - lista[i - 1]!.hi;
        expect(gap, `${host}: ${lista[i - 1]!.id} e ${lista[i]!.id}`).toBeGreaterThanOrEqual(0.1 - 1e-9);
      }
    }
  });

  it('nenhuma abertura a 0,15 m ou menos de uma quina da parede', () => {
    const p = project();
    for (const o of Object.values(p.elements).filter(isOpening)) {
      const w = p.elements[o.hostId] as Wall;
      const t = p.openingTypes[o.typeId]!;
      const L = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
      const ini = o.offset - t.width / 2;
      const fim = o.offset + t.width / 2;
      expect(ini, `${o.mark} (${o.id})`).toBeGreaterThan(0.15);
      expect(L - fim, `${o.mark} (${o.id})`).toBeGreaterThan(0.15);
    }
  });

  it('folhas de porta com folga: nenhuma colisão com parede ou outra folha (varredura de 0° a 90°)', () => {
    const p = project();
    const folhas: Array<{ id: string; level: string; pts: Vec2[]; c: Vec2; w: number }> = [];
    for (const lv of ['lv_0', 'lv_1']) {
      const r = resolveLevel(p, lv);
      const cortes: MultiPolygon = Object.values(r.walls).flatMap((w) => w.layers.flatMap((l) => l.cut));
      for (const o of Object.values(p.elements).filter(isOpening) as Opening[]) {
        const host = p.elements[o.hostId] as Wall;
        if (host.levelId !== lv) continue;
        const t = p.openingTypes[o.typeId]!;
        // Só folhas de batente e pivotante varrem: vão livre não tem folha e portão de correr não gira.
        if (o.kind !== 'door' || t.leaves !== 1 || (t.plan !== 'swing' && t.plan !== 'pivot')) continue;
        const f = frameOfWall(p, o.hostId)!;
        const g = openingGeometry(p, o, f);
        const sinal = g.flipFacing ? -1 : 1;
        const ladoAbre: Vec2 = { x: g.n.x * sinal, y: g.n.y * sinal };
        // Dobradiça 3 cm dentro do vão, além do retorno do reboco no batente (≈ 2 cm): caixilho de folga real.
        const eps = 0.03;
        const pts: Vec2[] = [];
        let base: Vec2;
        let comp: number;
        if (g.plan === 'pivot') {
          // Pivotante: eixo no centro, folha de meia largura.
          base = g.center;
          comp = g.width / 2 - 0.03;
        } else {
          // Dobradiça no batente do início (a) quando flipHand é falso; folha de largura menos a folga do caixilho.
          const hs = g.flipHand ? 1 : -1;
          base = { x: g.center.x + g.u.x * hs * (g.width / 2 - eps), y: g.center.y + g.u.y * hs * (g.width / 2 - eps) };
          comp = g.width - 0.06;
        }
        // Direção de fechamento: do batente para o outro lado do vão (ao longo do vão).
        const hs2 = g.plan === 'pivot' ? 1 : g.flipHand ? 1 : -1;
        const fech: Vec2 = { x: -g.u.x * hs2, y: -g.u.y * hs2 };
        for (let th = 0; th <= 90; th += 3) {
          const cs = Math.cos((th * Math.PI) / 180);
          const sn = Math.sin((th * Math.PI) / 180);
          const dir: Vec2 = { x: fech.x * cs + ladoAbre.x * sn, y: fech.y * cs + ladoAbre.y * sn };
          for (let r = 0.05; r <= comp + 1e-9; r += 0.02) pts.push({ x: base.x + dir.x * r, y: base.y + dir.y * r });
        }
        for (const q of pts) {
          if (pointInMulti(q, cortes)) throw new Error(`folha de ${o.mark} (${o.id}) colide com parede em (${q.x.toFixed(3)}; ${q.y.toFixed(3)})`);
        }
        folhas.push({ id: o.id, level: lv, pts, c: g.center, w: g.width });
      }
    }
    // Folhas entre si: duas folhas próximas não se cruzam (distância entre amostras ≥ 2 cm).
    for (let i = 0; i < folhas.length; i++) {
      for (let j = i + 1; j < folhas.length; j++) {
        const a = folhas[i]!;
        const b = folhas[j]!;
        if (a.level !== b.level) continue;
        if (Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y) > a.w + b.w + 2.4) continue;
        let minD = Infinity;
        for (const x of a.pts) for (const y of b.pts) minD = Math.min(minD, Math.hypot(x.x - y.x, x.y - y.y));
        expect(minD, `folhas ${a.id} e ${b.id}`).toBeGreaterThanOrEqual(0.02);
      }
    }
    expect(folhas.length).toBeGreaterThan(10);
  });
});

describe('casa de alto padrão: cortes e elevações', () => {
  // Corte AA, Corte BB e as quatro elevações resolvem o modelo inteiro: nesta máquina passa de 5 s (o padrão do vitest),
  // por isso o limite explícito (o mesmo recurso do teste de alça do caracol).
  it('cortes AA e BB e as quatro elevações calculam sem exceção', { timeout: 30000 }, () => {
    const p = project();
    for (const v of p.views) {
      const r = computeSection(p, { a: v.a, b: v.b, depth: v.depth });
      expect(r.length, v.name).toBeGreaterThan(0);
    }
  });

  it('elevação Sul: vãos visíveis são só os da fachada sul (T-EXT-S e S-EXT-S)', () => {
    const p = project();
    const sul = p.views.find((v) => v.name === 'Sul')!;
    const r = computeSection(p, { a: sul.a, b: sul.b, depth: sul.depth });
    const visiveis = r.openings.filter((o) => o.polygons.length > 0);
    expect(visiveis.length).toBeGreaterThan(0);
    const hospedeiros = new Set(visiveis.map((o) => (p.elements[o.openingId] as Opening).hostId));
    expect([...hospedeiros].sort()).toEqual(['S-EXT-S', 'T-EXT-S']);
  });
});
