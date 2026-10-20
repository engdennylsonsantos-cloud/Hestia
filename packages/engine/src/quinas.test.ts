import { describe, expect, it } from 'vitest';
import { difference, intersection, multiArea, pointInMulti, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ProjectStore, buildTemplate, createEmptyProject, makeWall, validateProject, wallType, wallsOnLevel, type JoinKind, type Project, type Wall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/** Ponto dentro da ponta que o encosto deixava exposta: o núcleo da parede que passa chega à face externa da outra. */
const CAP: Vec2 = { x: -0.05, y: -0.118 };

/** Cenário L 4 m: grossa 19 (0,0)-(4,0), fina 14 (4,0)-(4,3), canto em (4,0), as duas pontas do canto em `kind`. */
function lQuatroMetros(kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'g', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'f', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 } }) });
  const p = s.project;
  return {
    ...p,
    elements: {
      ...p.elements,
      g: { ...p.elements['g']!, joinEnd: { kind, flip: false } },
      f: { ...p.elements['f']!, joinStart: { kind, flip: false } },
    },
  } as Project;
}

/**
 * Guarda acabamento/substrato x acabamento/substrato (T-1): área de sobreposição de cada par (camada não estrutural da
 * fina, camada não estrutural da grossa), medida sobre `raw` (forma antes do pintor). Sobre `cut` a interseção é zero
 * por construção: o pintor já separou as camadas. Só tinta e cerâmica davam 2e-5 m² em encosto; com reboco e argamassa
 * o par chega a 4e-4 m², então a guarda inclui o substrato.
 */
function paresNaoEstrutura(kind: JoinKind): Array<{ nome: string; area: number }> {
  const q = lQuatroMetros(kind);
  const r = resolveLevel(q, 'lv_0', new Map());
  const acabamentos = (id: string) => {
    const t = wallType(q, q.elements[id] as Wall);
    return r.walls[id]!.layers.filter((l) => l.layerIndex < 0 || t.layers[l.layerIndex]!.function !== 'structure');
  };
  const fina = acabamentos('f');
  const grossa = acabamentos('g');
  expect(fina.length).toBeGreaterThan(0);
  expect(grossa.length).toBeGreaterThan(0);
  return fina.flatMap((a) => grossa.map((b) => ({ nome: `${a.materialId} x ${b.materialId}`, area: multiArea(intersection(a.raw, b.raw)) })));
}

describe('quinas externas (decisão 0009)', () => {
  it('a casa padrão tem as quatro quinas externas em esquadria e nenhum aviso de encosto', () => {
    const p = buildTemplate('house2');
    const corners = wallsOnLevel(p, 'lv_0').filter((w) => ['h_w', 'h_n', 'h_e', 'h_s'].includes(w.id));
    for (const w of corners) expect([w.joinStart.kind, w.joinEnd.kind].includes('miter'), w.id).toBe(true);
    expect(validateProject(p).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
  });

  it('a quina externa da casa padrão não deixa o núcleo da parede que passa na face externa', () => {
    const p = buildTemplate('house2');
    const r = resolveLevel(p, 'lv_0', new Map());
    const bloco = r.walls['h_w']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    expect(pointInMulti(CAP, bloco.cut)).toBe(false);
  });

  it('o mesmo canto em encosto já não deixa o núcleo aparecer (J-1 corrigido); em esquadro ainda deixa', () => {
    const p = buildTemplate('house2');
    const hw = { ...p.elements['h_w']! } as typeof p.elements['h_w'];
    const hs = { ...p.elements['h_s']! } as typeof p.elements['h_s'];
    const com = (kind: JoinKind) => {
      const q = {
        ...p,
        elements: {
          ...p.elements,
          h_w: { ...hw, joinStart: { kind, flip: false }, joinEnd: { kind, flip: false } },
          h_s: { ...hs, joinStart: { kind, flip: false }, joinEnd: { kind, flip: false } },
        },
      };
      return resolveLevel(q, 'lv_0', new Map()).walls['h_w']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    };
    // O encosto pareia por face (docs/08 §5.4 passo 3): a ponta do núcleo para na face do outro núcleo.
    expect(pointInMulti(CAP, com('butt').cut)).toBe(false);
    // O esquadro é um plano só e não consegue respeitar as camadas: continua com a ponta exposta (decisão 0009 #10).
    expect(pointInMulti(CAP, com('square').cut)).toBe(true);
  });

  it('aviso de quina em encosto: 90° com acabamento sim, T e paredes colineares não', () => {
    const s = new ProjectStore(createEmptyProject());
    const W = (id: string, a: [number, number], b: [number, number]) => makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } });
    s.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    s.exec({ type: 'addWall', wall: W('b', [4, 0], [4, 3]) });
    expect(validateProject(s.project).filter((i) => i.code === 'wall-corner-butt-finish')).toHaveLength(1);
    const t = new ProjectStore(createEmptyProject());
    t.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    t.exec({ type: 'addWall', wall: W('c', [2, 0], [2, 3]) });
    expect(validateProject(t.project).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
    const c = new ProjectStore(createEmptyProject());
    c.exec({ type: 'addWall', wall: W('a', [0, 0], [4, 0]) });
    c.exec({ type: 'addWall', wall: W('d', [4, 0], [8, 0]) });
    expect(validateProject(c.project).filter((i) => i.code === 'wall-corner-butt-finish')).toEqual([]);
  });

  it('L em esquadria entre parede de 19 cm e de 14 cm: o acabamento da fina para na face da grossa', () => {
    for (const par of paresNaoEstrutura('miter')) expect(par.area, par.nome).toBeLessThan(1e-6);
  });
  // Encosto pareado por face: a guarda fica verde (era o defeito J-1). O esquadro é um plano só, não pareia, e a
  // guarda continua acusando — é o que o aviso de quina em esquadro (decisão 0009 #10) sinaliza ao usuário.
  it('butt: a guarda acabamento/substrato x acabamento/substrato fica zerada (encosto pareado por face)', () => {
    for (const par of paresNaoEstrutura('butt')) expect(par.area, par.nome).toBeLessThan(1e-6);
  });
  it('square: a guarda acabamento/substrato x acabamento/substrato continua reportando sobreposição', () => {
    const maior = Math.max(...paresNaoEstrutura('square').map((par) => par.area));
    expect(maior).toBeGreaterThan(1e-4);
  });
  it('L em esquadria 19 cm x 14 cm: a tinta e o substrato da fina não descem abaixo da face do núcleo da grossa (y = 0,091)', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'g', typeId: 'wt_ext19', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'f', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 4, y: 0 }, b: { x: 4, y: 3 } }) });
    const p = s.project;
    const miter: JoinKind = 'miter';
    const q = {
      ...p,
      elements: {
        ...p.elements,
        g: { ...p.elements['g']!, joinEnd: { kind: miter, flip: false } },
        f: { ...p.elements['f']!, joinStart: { kind: miter, flip: false } },
      },
    } as typeof p;
    const r = resolveLevel(q, 'lv_0', new Map());
    const retangulo = (x0: number, y0: number, x1: number, y1: number): MultiPolygon => [
      [[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]],
    ];
    // Face do núcleo da grossa no ambiente: y = 0,091 (núcleo de -0,099 a 0,091; o acabamento dela ocupa 0,091 a 0,121).
    // Pelo pareamento em duas pontas (decisão 0009) o acabamento da fina termina na diagonal entre essa face e a face
    // do acabamento (0,091 em x = 3,930 até 0,111 em x = 3,910): nada dele desce abaixo de 0,091.
    const FACE_NUCLEO = 0.091;
    const FACE_G = 0.121;
    // Camadas 0 e 1 da fina (tinta e reboco do lado do ambiente, x = 3,908 a 3,930): não podem entrar no núcleo da grossa.
    const finaAcabamento = r.walls['f']!.layers.filter((l) => l.layerIndex >= 0 && l.layerIndex <= 1);
    expect(finaAcabamento.length).toBe(2);
    for (const a of finaAcabamento) {
      expect(multiArea(intersection(a.cut, retangulo(3.9, -1, 3.95, FACE_NUCLEO - 1e-6))), a.materialId).toBeLessThan(1e-9);
    }
    // Sem vazio na quina: a caixa 0,022 x 0,03 é dividida pela diagonal entre o acabamento da grossa (ceramica +
    // argamassa, abaixo) e o da fina (tinta + reboco, acima). Sem sobreposição (teste acima), a soma é a caixa inteira.
    // Antes a grossa cobria a caixa sozinha porque a fina parava em y = 0,121; agora a fina avança até a diagonal.
    const grossaAcabamento = r.walls['g']!.layers.filter((l) => l.layerIndex >= 0 && l.layerIndex <= 1);
    const caixa = retangulo(3.908, 0.091, 3.93, FACE_G);
    const cobertura = [...grossaAcabamento, ...finaAcabamento].reduce((soma, l) => soma + multiArea(intersection(l.cut, caixa)), 0);
    expect(cobertura).toBeCloseTo(0.022 * 0.03, 6);
  });
});

/**
 * Acabamentos de espessuras diferentes em esquadria (decisão 0009, pareamento em duas pontas): nenhuma camada que não
 * seja de estrutura da parede fina entra no núcleo da grossa, em qualquer orientação nem no canto interno.
 * As guardas medem sobre `raw` (T-1): `cut` já vem recortado pelo pintor e a interseção com ele dá zero por construção.
 */
describe('L 19 x 14 em esquadria: acabamentos da fina fora do núcleo da grossa (decisão 0009)', () => {
  type Pt = [number, number];
  const rot90 = ([x, y]: Pt): Pt => [-y, x];
  const mirror = ([x, y]: Pt): Pt => [-x, y];
  const BASE_GROSSA: Pt[] = [[0, 0], [0, 7]];
  const BASE_FINA: Pt[] = [[10, 0], [0, 0]];
  const CASES: Array<{ name: string; grossa: Pt[]; fina: Pt[]; flipped: boolean }> = [
    { name: 'caso do usuário (19 vertical, 14 horizontal)', grossa: BASE_GROSSA, fina: BASE_FINA, flipped: false },
    { name: 'girado 90°', grossa: BASE_GROSSA.map(rot90), fina: BASE_FINA.map(rot90), flipped: false },
    { name: 'espelhado', grossa: BASE_GROSSA.map(mirror), fina: BASE_FINA.map(mirror), flipped: false },
    { name: 'papéis trocados (19 horizontal, 14 vertical)', grossa: [[10, 0], [0, 0]], fina: [[0, 0], [0, 7]], flipped: false },
    { name: 'canto interno (faces externas dos tipos voltadas para dentro)', grossa: BASE_GROSSA, fina: BASE_FINA, flipped: true },
  ];
  const build = (c: (typeof CASES)[number], kind: JoinKind = 'miter') => {
    const s = new ProjectStore(createEmptyProject());
    const at = ([a, b]: Pt[]) => ({ a: { x: a![0], y: a![1] }, b: { x: b![0], y: b![1] } });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'g', typeId: 'wt_ext19', levelId: 'lv_0', flipped: c.flipped, ...at(c.grossa) }) });
    s.exec({ type: 'addWall', wall: makeWall({ id: 'f', typeId: 'wt_alv14', levelId: 'lv_0', flipped: c.flipped, ...at(c.fina) }) });
    const p = s.project;
    return {
      ...p,
      elements: {
        ...p.elements,
        g: { ...p.elements['g']!, joinStart: { kind, flip: false }, joinEnd: { kind, flip: false } },
        f: { ...p.elements['f']!, joinStart: { kind, flip: false }, joinEnd: { kind, flip: false } },
      },
    } as typeof p;
  };
  /**
   * Referência do canto sobre `raw`: a caixa cheia do núcleo da grossa (0,5 m a partir do canto, entre as faces do
   * núcleo) e a estrutura real da grossa (raw) nessa mesma zona. Eixo da grossa a partir do canto (0,0).
   */
  const referencia = (q: Project, c: (typeof CASES)[number]) => {
    const r = resolveLevel(q, 'lv_0', new Map());
    const fnOf = (id: string, layerIndex: number) => wallType(q, q.elements[id] as Wall).layers[layerIndex]!.function;
    const far = c.grossa.find(([x, y]) => x !== 0 || y !== 0)!;
    const len = Math.hypot(far[0], far[1]);
    const u: Vec2 = { x: far[0] / len, y: far[1] / len };
    const n: Vec2 = { x: -u.y, y: u.x };
    const proj = (v: Vec2, e: Vec2): number => v.x * e.x + v.y * e.y;
    const at = (t: number, s: number): Vec2 => ({ x: t * u.x + s * n.x, y: t * u.y + s * n.y });
    const estrutura = r.walls['g']!.layers.filter((l) => l.layerIndex >= 0 && fnOf('g', l.layerIndex) === 'structure');
    const nucleoRaw = estrutura.flatMap((l) => l.raw);
    const ss = nucleoRaw.flatMap((poly) => poly.flat()).map((v) => proj(v, n));
    const sLo = Math.min(...ss);
    const sHi = Math.max(...ss);
    // Retângulo cheio do núcleo, do eixo do canto até 0,5 m, do lado da grossa: a parede fina passa pelo canto e
    // o lado oposto (t < 0) é o corpo dela, não o núcleo da grossa. Também não pega a ponta livre das paredes.
    const caixa: MultiPolygon = [[[at(0, sLo), at(0.5, sLo), at(0.5, sHi), at(0, sHi)]]];
    const zona: MultiPolygon = [[[at(0, sLo - 1), at(0.5, sLo - 1), at(0.5, sHi + 1), at(0, sHi + 1)]]];
    const nucleo = intersection(nucleoRaw, zona);
    const finas = r.walls['f']!.layers.filter((l) => l.layerIndex >= 0 && fnOf('f', l.layerIndex) !== 'structure');
    return { caixa, nucleo, finas };
  };
  /** Maior área de `raw` de cada camada dentro de `alvo` (0 sem camadas): é o valor que a guarda compara com 1e-6. */
  const maiorSobreposicao = (camadas: Array<{ raw: MultiPolygon }>, alvo: MultiPolygon): number =>
    Math.max(0, ...camadas.map((l) => (alvo.length ? multiArea(intersection(l.raw, alvo)) : 0)));

  for (const c of CASES) {
    it(`${c.name}: nenhuma camada de acabamento da fina tem área dentro do núcleo cheio da grossa`, () => {
      const { caixa, nucleo, finas } = referencia(build(c), c);
      expect(finas.length).toBeGreaterThan(0);
      for (const l of finas) {
        expect(multiArea(intersection(l.raw, caixa)), `${l.materialId} dentro do núcleo cheio da grossa`).toBeLessThan(1e-6);
        expect(multiArea(intersection(l.raw, nucleo)), `${l.materialId} dentro da estrutura (raw) da grossa`).toBeLessThan(1e-6);
      }
    });
  }

  // Teste do teste (T-1, §7.3): o esquadro não pareia, então a guarda tem de acusar sobreposição sobre raw.
  it('square: a guarda do núcleo cheio (caixa de 0,5 m) reporta área do acabamento da fina dentro dele', () => {
    const c = CASES[0]!;
    const { caixa, finas } = referencia(build(c, 'square'), c);
    expect(maiorSobreposicao(finas, caixa)).toBeGreaterThan(1e-4);
  });
  it('square: a guarda da estrutura da grossa (raw) reporta área do acabamento da fina dentro dela', () => {
    const c = CASES[0]!;
    const { nucleo, finas } = referencia(build(c, 'square'), c);
    expect(maiorSobreposicao(finas, nucleo)).toBeGreaterThan(1e-4);
  });
  // J-1 corrigido: no encosto pareado as duas guardas de núcleo ficam zeradas.
  for (const alvo of ['caixa', 'nucleo'] as const) {
    it(`butt: a guarda do ${alvo === 'caixa' ? 'núcleo cheio (caixa de 0,5 m)' : 'estrutura da grossa (raw)'} fica zerada`, () => {
      const c = CASES[0]!;
      const { caixa, nucleo, finas } = referencia(build(c, 'butt'), c);
      expect(maiorSobreposicao(finas, alvo === 'caixa' ? caixa : nucleo)).toBeLessThan(1e-6);
    });
  }

  it('caso do usuário: o bloco da grossa contém o ponto (0,06; 0,08) (o núcleo não recua por causa da fina)', () => {
    const q = build(CASES[0]!);
    const r = resolveLevel(q, 'lv_0', new Map());
    const bloco = r.walls['g']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    expect(pointInMulti({ x: 0.06, y: 0.08 }, bloco.cut)).toBe(true);
  });
});

/** Campo `raw` de ResolvedLayer (T-1): a forma da camada antes do pintor, base das guardas de sobreposição. */
describe('campo raw da camada (T-1)', () => {
  it('parede sem junção: o cut cabe inteiro dentro do raw e as áreas são iguais', () => {
    const s = new ProjectStore(createEmptyProject());
    s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    const r = resolveLevel(s.project, 'lv_0', new Map());
    const camadas = r.walls['w']!.layers;
    expect(camadas.length).toBeGreaterThan(0);
    for (const l of camadas) {
      expect(multiArea(difference(l.cut, l.raw)), `${l.materialId}: cut fora do raw`).toBeLessThan(1e-9);
      expect(multiArea(l.raw), l.materialId).toBeCloseTo(multiArea(l.cut), 9);
    }
  });

  it('no encosto pareado o pintor já não recorta o bloco da fina: raw e cut coincidem e os raws não se sobrepõem', () => {
    // Cada núcleo para na face do outro (docs/08 §5.4 passo 3), então não sobra área para o pintor resolver.
    const r = resolveLevel(lQuatroMetros('butt'), 'lv_0', new Map());
    const bloco14 = r.walls['f']!.layers.find((l) => l.materialId === 'mat_bloco14')!;
    const bloco19 = r.walls['g']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    expect(multiArea(bloco14.raw)).toBeCloseTo(multiArea(bloco14.cut), 9);
    expect(multiArea(intersection(bloco14.raw, bloco19.raw))).toBeLessThan(1e-9);
  });

  it('no esquadro o pintor ainda recorta: o raw do bloco da fina é maior que o cut e os raws se sobrepõem', () => {
    // O esquadro é um plano só (decisão 0009 #10): a sobreposição continua e é o aviso que a sinaliza.
    const r = resolveLevel(lQuatroMetros('square'), 'lv_0', new Map());
    const bloco14 = r.walls['f']!.layers.find((l) => l.materialId === 'mat_bloco14')!;
    const bloco19 = r.walls['g']!.layers.find((l) => l.materialId === 'mat_bloco19')!;
    expect(multiArea(bloco14.raw)).toBeGreaterThan(multiArea(bloco14.cut) + 1e-3);
    expect(multiArea(intersection(bloco14.raw, bloco19.raw))).toBeGreaterThan(1e-3);
  });
});

describe('aviso de quina em esquadro (decisão 0009 #10)', () => {
  it('casa padrão com as quatro quinas em esquadro: quatro avisos, todos dizendo esquadro', () => {
    const p = buildTemplate('house2');
    const sq = { kind: 'square' as const, flip: false };
    const elements = { ...p.elements };
    for (const id of ['h_w', 'h_n', 'h_e', 'h_s']) elements[id] = { ...(p.elements[id] as Wall), joinStart: sq, joinEnd: sq };
    const issues = validateProject({ ...p, elements }).filter((i) => i.code === 'wall-corner-butt-finish');
    expect(issues).toHaveLength(4);
    for (const i of issues) expect(i.message).toContain('em esquadro,');
  });
});
