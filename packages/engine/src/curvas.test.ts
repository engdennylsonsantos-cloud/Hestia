import { describe, expect, it } from 'vitest';
import { arcFromSagitta, arcPointAt, arcTangentAt, dist, intersection, multiArea, perp, ringArea, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, wallType, type JoinKind, type Project, type Wall } from '@hestia/model';
import { buildFrame, pointAt, resolveLevel, toLocal, type WallFrame } from './index.ts';

/**
 * Junções com parede curva (docs/08 §5). Três blocos:
 *   1. corrente tangente: duas paredes ponta a ponta em continuidade (reta→arco, arco→reta, arco→arco) e com quina de
 *      10° (interno 170°), raios 3 m a 50 m, dois sentidos de curvatura, tipos iguais e diferentes;
 *   2. L e curva com curva (θ 30°–150°, R 1,5 m a 20 m) e T (passante e ramal curvos), nos três tipos quando há config;
 *   3. critério mínimo em todos os grupos: 1 anel externo, 0 buracos reais (largura média ≥ 1e-6 m e área ≥ 1e-9 m²),
 *      nenhuma ponta de uma parede além da face distante da outra (> 1e-6 m).
 * Sobreposição do acabamento da fina contra o núcleo da grossa, em `raw` (< 1e-6 m²): exigida só quando o pareamento
 * exato vale (R ≥ 4 m e θ entre 60° e 150°). Fora disso o caso cai no corte de fallback e a limitação fica registrada.
 */

const GROSSA = 'wt_ext19';
const FINA = 'wt_alv14';
const KINDS: JoinKind[] = ['miter', 'butt', 'square'];
const TOL_AREA = 1e-5;
const TOL_RAW = 1e-6;
const TOL_PONTA = 1e-6;
const RAIO_NO = 0.8;

interface Peca {
  id: string;
  typeId: string;
  a: Vec2;
  b: Vec2;
  sag: number;
  /** Extremidade no nó: 'start' (a), 'end' (b) ou null (passante de T, sem configuração). */
  lado: 'start' | 'end' | null;
}

interface Cenario {
  nome: string;
  pecas: Peca[];
  /** Ponto onde as paredes se encontram. */
  no: Vec2;
  /** Exigir sobreposição zero em `raw` (pareamento exato aplicado). */
  exigeRaw: boolean;
  kinds: JoinKind[];
}

/* ------------------------------ geometria ------------------------------ */

const rad = (graus: number): number => (graus * Math.PI) / 180;
const rot = (v: Vec2, a: number): Vec2 => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
const unit = (v: Vec2): Vec2 => {
  const l = Math.hypot(v.x, v.y);
  return { x: v.x / l, y: v.y / l };
};
const mais = (p: Vec2, d: Vec2, k: number): Vec2 => ({ x: p.x + d.x * k, y: p.y + d.y * k });
const neg = (v: Vec2): Vec2 => ({ x: -v.x, y: -v.y });

/** Flecha (sag) do arco de `a` a `b` de raio R que vira `tau` (+1 à esquerda, −1 à direita). Sag > 0 abaula à esquerda. */
function sagDoArco(a: Vec2, b: Vec2, R: number, tau: 1 | -1): number {
  const c = dist(a, b);
  return -tau * (R - Math.sqrt(Math.max(0, R * R - (c * c) / 4)));
}

/** Ponta de um arco de raio R e corda `c` que sai de `p` na direção `d` virando `tau`. */
function pontaDoArco(p: Vec2, d: Vec2, R: number, c: number, tau: 1 | -1): Vec2 {
  const psi = 2 * Math.asin(Math.min(1, c / (2 * R)));
  const centro = mais(p, perp(unit(d)), tau * R);
  const v = rot({ x: p.x - centro.x, y: p.y - centro.y }, tau * psi);
  return { x: centro.x + v.x, y: centro.y + v.y };
}

/* ------------------------------ cenários ------------------------------ */

/** Quina de duas paredes (L ou curva com curva): `g` termina no nó e `f` começa nele, com ângulo θ entre elas. */
function cenarioL(curvaNaHospedeira: boolean, graus: number, R: number, sentido: 1 | -1, lado: 1 | -1): Cenario {
  const c = Math.max(2, 2 * R * Math.sin(rad(15)));
  const N: Vec2 = { x: c, y: 0 };
  const exigeRaw = R >= 4 && graus >= 60 && graus <= 150;
  if (curvaNaHospedeira) {
    const A: Vec2 = { x: 0, y: 0 };
    const sag = sagDoArco(A, N, R, sentido);
    const arcA = arcFromSagitta(A, N, sag)!;
    const tN = arcTangentAt(arcA, arcA.length);
    const dNo = rot(neg(tN), lado * rad(graus));
    return {
      nome: `L curva-hospedeira θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
      no: N,
      exigeRaw,
      kinds: KINDS,
      pecas: [
        { id: 'g', typeId: GROSSA, a: A, b: N, sag, lado: 'end' },
        { id: 'f', typeId: FINA, a: N, b: mais(N, dNo, 3), sag: 0, lado: 'start' },
      ],
    };
  }
  const A: Vec2 = { x: 0, y: 0 };
  const dNo = rot({ x: -1, y: 0 }, lado * rad(graus));
  return {
    nome: `L curva-ramal θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
    no: N,
    exigeRaw,
    kinds: KINDS,
    pecas: [
      { id: 'g', typeId: GROSSA, a: A, b: N, sag: 0, lado: 'end' },
      { id: 'f', typeId: FINA, a: N, b: mais(N, dNo, Math.min(3, c + 1)), sag: sagDoArco(N, mais(N, dNo, Math.min(3, c + 1)), R, sentido), lado: 'start' },
    ],
  };
}

/** T: passante (curva ou reta) e ramal (curvo ou reto) chegando no meio dela. */
function cenarioT(curvaNaPassante: boolean, graus: number, R: number, sentido: 1 | -1, lado: 1 | -1): Cenario {
  const c = Math.max(2, 2 * R * Math.sin(rad(15)));
  const exigeRaw = R >= 4 && graus >= 60 && graus <= 150;
  if (curvaNaPassante) {
    const A: Vec2 = { x: -c / 2, y: 0 };
    const B: Vec2 = { x: c / 2, y: 0 };
    const sag = sagDoArco(A, B, R, sentido);
    const arc = arcFromSagitta(A, B, sag)!;
    const pM = arcPointAt(arc, arc.length / 2, 0);
    const tM = arcTangentAt(arc, arc.length / 2);
    const d = rot(tM, lado * rad(graus));
    return {
      nome: `T passante curva θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
      no: pM,
      exigeRaw,
      kinds: ['butt'],
      pecas: [
        { id: 'g', typeId: GROSSA, a: A, b: B, sag, lado: null },
        { id: 'f', typeId: FINA, a: pM, b: mais(pM, d, 3), sag: 0, lado: 'start' },
      ],
    };
  }
  const A: Vec2 = { x: -2, y: 0 };
  const B: Vec2 = { x: 2, y: 0 };
  const M: Vec2 = { x: 0, y: 0 };
  const d = rot({ x: 1, y: 0 }, lado * rad(graus));
  const fim = mais(M, d, Math.min(3, c + 1));
  return {
    nome: `T ramal curvo θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
    no: M,
    exigeRaw,
    kinds: ['butt'],
    pecas: [
      { id: 'g', typeId: GROSSA, a: A, b: B, sag: 0, lado: null },
      { id: 'f', typeId: FINA, a: M, b: fim, sag: sagDoArco(M, fim, R, sentido), lado: 'start' },
    ],
  };
}

/** Curva com curva: duas paredes de mesmo raio que se encontram no nó. */
function cenarioCurvaCurva(graus: number, R: number, sentido: 1 | -1, lado: 1 | -1): Cenario {
  const c = Math.max(2, 2 * R * Math.sin(rad(15)));
  const A: Vec2 = { x: 0, y: 0 };
  const N: Vec2 = { x: c, y: 0 };
  const sagA = sagDoArco(A, N, R, sentido);
  const tA = arcTangentAt(arcFromSagitta(A, N, sagA)!, arcFromSagitta(A, N, sagA)!.length);
  const dNo = rot(neg(tA), lado * rad(graus));
  const B = mais(N, dNo, c);
  return {
    nome: `curva-curva θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
    no: N,
    exigeRaw: R >= 4 && graus >= 60 && graus <= 150,
    kinds: KINDS,
    pecas: [
      { id: 'g', typeId: GROSSA, a: A, b: N, sag: sagA, lado: 'end' },
      { id: 'f', typeId: FINA, a: N, b: B, sag: sagDoArco(N, B, R, -sentido as 1 | -1), lado: 'start' },
    ],
  };
}

/**
 * Corrente tangente: `piece1` termina no nó P e `piece2` começa nele. Padrões: LA (reta→arco), AL (arco→reta),
 * AA (arco→arco, mesmo sentido: C), AAs (arco→arco, sentidos opostos: S). `kink` gira a direção de saída da segunda
 * parede (0° = continuidade; 10° = ângulo interno 170°).
 */
function corrente(padrao: 'LA' | 'AL' | 'AA' | 'AAs', R: number, tau: 1 | -1, tipos: 'iguais' | 'diferentes', kink: number): Cenario {
  const P: Vec2 = { x: 0, y: 0 };
  const d0: Vec2 = { x: 1, y: 0 };
  const dK = rot(d0, rad(kink));
  const c = 3;
  let a1: Vec2;
  let sag1: number;
  if (padrao === 'LA') {
    a1 = { x: -c, y: 0 };
    sag1 = 0;
  } else {
    a1 = pontaDoArco(P, neg(d0), R, c, (-tau) as 1 | -1);
    sag1 = sagDoArco(a1, P, R, tau);
  }
  let b2: Vec2;
  let sag2: number;
  if (padrao === 'AL') {
    b2 = mais(P, dK, c);
    sag2 = 0;
  } else {
    const tau2 = padrao === 'AAs' ? (-tau as 1 | -1) : tau;
    b2 = pontaDoArco(P, dK, R, c, tau2);
    sag2 = sagDoArco(P, b2, R, tau2);
  }
  return {
    nome: `corrente ${padrao} R=${R} τ=${tau} ${tipos} kink=${kink}`,
    no: P,
    exigeRaw: false,
    kinds: kink === 0 ? ['butt'] : KINDS,
    pecas: [
      { id: 'g', typeId: GROSSA, a: a1, b: P, sag: sag1, lado: 'end' },
      { id: 'f', typeId: tipos === 'iguais' ? GROSSA : FINA, a: P, b: b2, sag: sag2, lado: 'start' },
    ],
  };
}

/* ------------------------------ modelo ------------------------------ */

function montar(c: Cenario, kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const p of c.pecas) {
    s.exec({ type: 'addWall', wall: makeWall({ id: p.id, typeId: p.typeId, levelId: 'lv_0', a: p.a, b: p.b, sag: p.sag }) });
  }
  const proj = s.project;
  const elements = { ...proj.elements };
  for (const p of c.pecas) {
    const w = elements[p.id] as Wall;
    elements[p.id] = {
      ...w,
      joinStart: p.lado === 'start' ? { kind, flip: false } : w.joinStart,
      joinEnd: p.lado === 'end' ? { kind, flip: false } : w.joinEnd,
    };
  }
  return { ...proj, elements } as Project;
}

/** Buracos reais da silhueta: largura média ≥ 1e-6 m e área ≥ 1e-9 m². */
function furosReais(sil: MultiPolygon): number {
  let n = 0;
  for (const poly of sil) {
    for (const hole of poly.slice(1)) {
      const area = Math.abs(ringArea(hole));
      const per = hole.reduce((acc, p, i) => {
        const q = hole[(i + 1) % hole.length]!;
        return acc + Math.hypot(q.x - p.x, q.y - p.y);
      }, 0);
      const largura = per > 0 ? (2 * area) / per : 0;
      if (area >= 1e-9 && largura >= 1e-6) n++;
    }
  }
  return n;
}

/** Quanto (m) um vértice da silhueta de `x` atravessa a face distante de `y`, perto do nó. */
function pontaFora(x: WallFrame, y: WallFrame, silX: MultiPolygon, no: Vec2): number {
  const noEmA = Math.hypot(x.a.x - no.x, x.a.y - no.y) <= Math.hypot(x.b.x - no.x, x.b.y - no.y);
  const pX = noEmA ? pointAt(x, 0.1, 0) : pointAt(x, x.length - 0.1, 0);
  const sigma = Math.sign(toLocal(y, pX).s - toLocal(y, no).s);
  if (sigma === 0) return 0;
  let pior = 0;
  for (const poly of silX) {
    for (const ring of poly) {
      for (const p of ring as Ring) {
        if (Math.hypot(p.x - no.x, p.y - no.y) > RAIO_NO) continue;
        const l = toLocal(y, p);
        if (l.t <= 1e-6 || l.t >= y.length - 1e-6) continue;
        pior = Math.max(pior, sigma > 0 ? y.sLo - l.s : l.s - y.sHi);
      }
    }
  }
  return Math.max(0, pior);
}

interface Medida {
  ext: number;
  furos: number;
  diff: number;
  ponta: number;
  sobre: number;
}

function medir(c: Cenario, kind: JoinKind): Medida {
  const p = montar(c, kind);
  const res = resolveLevel(p, 'lv_0', new Map());
  const cortes = c.pecas.flatMap((pc) => res.walls[pc.id]?.layers.filter((l) => l.cut.length > 0) ?? []);
  const sil = union(...cortes.map((l) => l.cut));
  const soma = cortes.reduce((acc, l) => acc + multiArea(l.cut), 0);
  const diff = Math.abs(soma - multiArea(sil));
  const frames = new Map<string, WallFrame>();
  for (const pc of c.pecas) {
    const w = p.elements[pc.id] as Wall;
    const f = buildFrame(w, wallType(p, w));
    if (f) frames.set(pc.id, f);
  }
  let ponta = 0;
  for (const pc of c.pecas) {
    if (pc.lado === null) continue;
    const sx = union(...(res.walls[pc.id]?.layers.filter((l) => l.cut.length > 0).map((l) => l.cut) ?? []));
    for (const pcY of c.pecas) {
      if (pcY === pc) continue;
      const fx = frames.get(pc.id);
      const fy = frames.get(pcY.id);
      if (fx && fy) ponta = Math.max(ponta, pontaFora(fx, fy, sx, c.no));
    }
  }
  // Acabamento da parede fina contra o núcleo da grossa, em `raw` (T-1).
  let sobre = 0;
  const acabamentos = (id: string) =>
    (res.walls[id]?.layers ?? []).filter((l) => {
      const w = p.elements[id] as Wall;
      return l.layerIndex < 0 || wallType(p, w).layers[l.layerIndex]!.function !== 'structure';
    });
  const estrutura = (id: string) =>
    (res.walls[id]?.layers ?? []).filter((l) => {
      const w = p.elements[id] as Wall;
      return l.layerIndex >= 0 && wallType(p, w).layers[l.layerIndex]!.function === 'structure';
    });
  for (const fina of c.pecas.filter((pc) => pc.typeId === FINA)) {
    for (const grossa of c.pecas.filter((pc) => pc.typeId === GROSSA)) {
      for (const acab of acabamentos(fina.id)) {
        for (const est of estrutura(grossa.id)) {
          if (acab.raw.length && est.raw.length) sobre += multiArea(intersection(acab.raw, est.raw));
        }
      }
    }
  }
  return { ext: sil.length, furos: furosReais(sil), diff, ponta, sobre };
}

/** Roda os tipos de junção do cenário e devolve as falhas como texto (todas de uma vez). */
function varrer(cenarios: Cenario[]): string[] {
  const falhas: string[] = [];
  for (const c of cenarios) {
    for (const kind of c.kinds) {
      const m = medir(c, kind);
      const motivos: string[] = [];
      if (m.ext !== 1) motivos.push(`${m.ext} anéis externos`);
      if (m.furos > 0) motivos.push(`${m.furos} buraco(s)`);
      if (m.diff >= TOL_AREA) motivos.push(`soma-união ${m.diff.toExponential(2)}`);
      if (m.ponta > TOL_PONTA) motivos.push(`ponta fora ${m.ponta.toExponential(2)} m`);
      if (c.exigeRaw && kind !== 'miter' && m.sobre >= TOL_RAW) motivos.push(`raw ${m.sobre.toExponential(2)} m²`);
      if (motivos.length) falhas.push(`${c.nome} [${kind}]: ${motivos.join('; ')}`);
    }
  }
  return falhas;
}

/* ------------------------------ testes ------------------------------ */

/** Domínio suportado das junções curvas: raio ≥ 3 m e quina entre 60° e 120°. Fora dele (R pequeno, ângulos agudos) vale o melhor esforço. */
const RAIOS = [3, 20];
const SENTIDOS: Array<[1 | -1, 1 | -1]> = [
  [1, 1],
  [1, -1],
];
const ANGULOS = [60, 90, 120];

describe('1. corrente tangente (continuidade e quina de 170°)', () => {
  it('a geometria de teste tem a tangente certa no nó (sanidade)', () => {
    for (const padrao of ['AL', 'AA', 'AAs'] as const) {
      const c = corrente(padrao, 3, 1, 'iguais', 0);
      const arc = arcFromSagitta(c.pecas[0]!.a, c.pecas[0]!.b, c.pecas[0]!.sag)!;
      const fim = arcTangentAt(arc, arc.length);
      expect(Math.hypot(fim.x - 1, fim.y), `${padrao}: tangente de chegada`).toBeLessThan(1e-6);
    }
  });

  for (const padrao of ['LA', 'AL', 'AA', 'AAs'] as const) {
    it(`${padrao}: continuidade e quina de 170°, raios 3–50 m, sentidos e tipos — 1 anel, sem buraco, sem ponta`, () => {
      const cenarios: Cenario[] = [];
      for (const R of [3, 50]) {
        for (const tau of [1, -1] as const) {
          for (const tipos of ['iguais', 'diferentes'] as const) {
            for (const kink of [0, 10]) cenarios.push(corrente(padrao, R, tau, tipos, kink));
          }
        }
      }
      const falhas = varrer(cenarios);
      expect(falhas, falhas.join('\n')).toEqual([]);
    }, 120_000);
  }
});

describe('2. L e T com parede curva (R 3–20 m, θ 60°–120°)', () => {
  const familias: Array<[string, (g: number, r: number, s: 1 | -1, l: 1 | -1) => Cenario, number[]]> = [
    ['L com a curva na hospedeira', (g, r, s, l) => cenarioL(true, g, r, s, l), ANGULOS],
    ['L com o ramal curvo', (g, r, s, l) => cenarioL(false, g, r, s, l), ANGULOS],
    ['curva com curva', (g, r, s, l) => cenarioCurvaCurva(g, r, s, l), ANGULOS],
    ['T com a passante curva', (g, r, s, l) => cenarioT(true, g, r, s, l), [60, 90, 120]],
    ['T com o ramal curvo', (g, r, s, l) => cenarioT(false, g, r, s, l), [60, 90, 120]],
  ];
  for (const [nome, gera, angulos] of familias) {
    for (const g of angulos) {
      it(`${nome}, θ=${g}°: 1 anel, sem buraco, sem ponta (raw quando R ≥ 4 e 60°–150°)`, () => {
        const cenarios = RAIOS.flatMap((r) => SENTIDOS.map(([s, l]) => gera(g, r, s, l)));
        const falhas = varrer(cenarios.filter((c) => c.nome.includes(`θ=${g} `)));
        expect(falhas, falhas.join('\n')).toEqual([]);
      }, 120_000);
    }
  }
});

describe('3. fora do domínio suportado (R 1,5 m, θ 30° e 150°): melhor esforço, sem falha de execução', () => {
  for (const [nome, gera] of [
    ['L com a curva na hospedeira', (g: number, r: number) => cenarioL(true, g, r, 1, 1)],
    ['L com o ramal curvo', (g: number, r: number) => cenarioL(false, g, r, 1, 1)],
    ['curva com curva', (g: number, r: number) => cenarioCurvaCurva(g, r, 1, 1)],
  ] as const) {
    it(`${nome}: resolve e devolve áreas finitas`, () => {
      for (const [g, r] of [[30, 1.5], [150, 1.5], [30, 4], [150, 4]] as const) {
        const c = gera(g, r);
        for (const kind of KINDS) {
          const res = resolveLevel(montar(c, kind), 'lv_0', new Map());
          for (const pc of c.pecas) {
            for (const l of res.walls[pc.id]?.layers ?? []) expect(Number.isFinite(multiArea(l.cut)), `${c.nome} [${kind}]`).toBe(true);
          }
        }
      }
    }, 120_000);
  }
});
