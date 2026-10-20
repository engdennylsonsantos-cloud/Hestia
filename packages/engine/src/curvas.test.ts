import { describe, expect, it } from 'vitest';
import { arcFromSagitta, arcPointAt, arcTangentAt, intersection, multiArea, norm, ringArea, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, wallType, type JoinKind, type Project, type Wall } from '@hestia/model';
import { buildFrame, pointAt, resolveLevel, toLocal, type WallFrame } from './index.ts';

/**
 * Junções com parede curva (docs/08 §5): L, T e curva com curva, nos três tipos de junção, em ângulos de 30° a 150°,
 * raios de 1,5 m a 20 m e os dois sentidos de curvatura. Critérios por cenário:
 *   - silhueta (união dos `cut`) com 1 anel externo e 0 buracos reais (largura média 2·área/perímetro ≥ 1e-6 e
 *     área ≥ 1e-9 contam como buraco);
 *   - |soma das áreas dos cut − área da união| < 1e-5 m²;
 *   - nenhuma ponta de uma parede além das faces da outra (vértices da silhueta de uma parede, dentro do vão da
 *     outra, fora das faces dela: > 1e-6 m);
 *   - em encosto e esquadro, o acabamento de uma parede não se sobrepõe ao estrutural da outra em `raw` (< 1e-6 m²).
 * Medição numérica: os cenários de canto reto e os dourados continuam em seus próprios arquivos de teste.
 */

const GROSSA = 'wt_ext19';
const FINA = 'wt_alv14';
const KINDS: JoinKind[] = ['miter', 'butt', 'square'];
const ANGULOS = [30, 60, 90, 120, 150];
const RAIOS = [1.5, 4, 20];
const TOL_AREA = 1e-5;
const TOL_RAW = 1e-6;
const TOL_PONTA = 1e-6;
/** Raio (m) em volta do nó em que as pontas são medidas. */
const RAIO_NO = 0.8;

interface Peca {
  id: string;
  typeId: string;
  a: Vec2;
  b: Vec2;
  sag: number;
  /** Extremidade que está no nó: 'start' (a), 'end' (b) ou null (passante de T, sem configuração). */
  lado: 'start' | 'end' | null;
}

interface Cenario {
  nome: string;
  pecas: Peca[];
  /** Ponto onde as paredes se encontram (a ponta de uma parede é medida perto dele). */
  no: Vec2;
}

const rad = (graus: number): number => (graus * Math.PI) / 180;
const girar = (d: Vec2, graus: number): Vec2 => {
  const a = rad(graus);
  return { x: d.x * Math.cos(a) - d.y * Math.sin(a), y: d.x * Math.sin(a) + d.y * Math.cos(a) };
};
const mais = (p: Vec2, d: Vec2, k: number): Vec2 => ({ x: p.x + d.x * k, y: p.y + d.y * k });

/** Corda e flecha de um arco de raio R: a corda vale ao menos 2 m e nunca passa de 2R (flecha h = R − √(R² − c²/4)). */
function arcoDeRaio(R: number): { c: number; h: number } {
  const c = Math.max(2, 2 * R * Math.sin(rad(15)));
  const h = R - Math.sqrt(R * R - (c * c) / 4);
  return { c, h };
}

/** Direção unitária da parede (a→b) na extremidade `a` (início) ou `b` (fim); reta se a flecha é zero. */
function direcaoNaPonta(a: Vec2, b: Vec2, sag: number, ponta: 'a' | 'b'): Vec2 {
  const arc = arcFromSagitta(a, b, sag);
  if (!arc) return norm({ x: b.x - a.x, y: b.y - a.y });
  return arcTangentAt(arc, ponta === 'a' ? 0 : arc.length);
}

/* ----------------------------- cenários ----------------------------- */

/** L com parede curva: a curva é a `host` (termina no nó) ou o `arm` curvo (começa no nó). */
function cenarioL(curvaNaHospedeira: boolean, graus: number, R: number, sentido: 1 | -1, lado: 1 | -1): Cenario {
  const { c, h } = arcoDeRaio(R);
  const N: Vec2 = { x: c, y: 0 };
  if (curvaNaHospedeira) {
    const A: Vec2 = { x: 0, y: 0 };
    const sag = sentido * h;
    const tN = direcaoNaPonta(A, N, sag, 'b');
    const dNo = girar({ x: -tN.x, y: -tN.y }, lado * graus);
    return {
      nome: `L curva-hospedeira θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
      no: N,
      pecas: [
        { id: 'g', typeId: GROSSA, a: A, b: N, sag, lado: 'end' },
        { id: 'f', typeId: FINA, a: N, b: mais(N, dNo, 3), sag: 0, lado: 'start' },
      ],
    };
  }
  // Ramal curvo: a hospedeira é reta de (0,0) ao nó (c,0) e o ramal curvo parte do nó.
  const A: Vec2 = { x: 0, y: 0 };
  const dNo = girar({ x: -1, y: 0 }, lado * graus);
  const chord = Math.min(3, c + 1);
  return {
    nome: `L curva-ramal θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
    no: N,
    pecas: [
      { id: 'g', typeId: GROSSA, a: A, b: N, sag: 0, lado: 'end' },
      { id: 'f', typeId: FINA, a: N, b: mais(N, dNo, chord), sag: sentido * h, lado: 'start' },
    ],
  };
}

/** T: a passante (curva ou reta) e o ramal chegando no meio dela (ramal curvo ou reto). */
function cenarioT(curvaNaPassante: boolean, graus: number, R: number, sentido: 1 | -1, lado: 1 | -1): Cenario {
  const { c, h } = arcoDeRaio(R);
  if (curvaNaPassante) {
    const A: Vec2 = { x: -c / 2, y: 0 };
    const B: Vec2 = { x: c / 2, y: 0 };
    const sag = sentido * h;
    const arc = arcFromSagitta(A, B, sag)!;
    const M = arcPointAt(arc, arc.length / 2, 0);
    const tM = arcTangentAt(arc, arc.length / 2);
    const d = girar(tM, lado * graus);
    return {
      nome: `T passante curva θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
      no: M,
      pecas: [
        { id: 'g', typeId: GROSSA, a: A, b: B, sag, lado: null },
        { id: 'f', typeId: FINA, a: M, b: mais(M, d, 3), sag: 0, lado: 'start' },
      ],
    };
  }
  const A: Vec2 = { x: -2, y: 0 };
  const B: Vec2 = { x: 2, y: 0 };
  const M: Vec2 = { x: 0, y: 0 };
  const d = girar({ x: 1, y: 0 }, lado * graus);
  const chord = Math.min(3, c + 1);
  return {
    nome: `T ramal curvo θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
    no: M,
    pecas: [
      { id: 'g', typeId: GROSSA, a: A, b: B, sag: 0, lado: null },
      { id: 'f', typeId: FINA, a: M, b: mais(M, d, chord), sag: sentido * h, lado: 'start' },
    ],
  };
}

/** Curva com curva: as duas paredes são arcos de mesmo raio que se encontram no nó. */
function cenarioCurvaCurva(graus: number, R: number, sentido: 1 | -1, lado: 1 | -1): Cenario {
  const { c, h } = arcoDeRaio(R);
  const A: Vec2 = { x: 0, y: 0 };
  const N: Vec2 = { x: c, y: 0 };
  const sagA = sentido * h;
  const tA = direcaoNaPonta(A, N, sagA, 'b');
  const dNo = girar({ x: -tA.x, y: -tA.y }, lado * graus);
  const B = mais(N, dNo, c);
  return {
    nome: `curva-curva θ=${graus} R=${R} sentido=${sentido} lado=${lado}`,
    no: N,
    pecas: [
      { id: 'g', typeId: GROSSA, a: A, b: N, sag: sagA, lado: 'end' },
      { id: 'f', typeId: FINA, a: N, b: B, sag: -sentido * h, lado: 'start' },
    ],
  };
}

/* ----------------------------- modelo ----------------------------- */

function montar(c: Cenario, kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const p of c.pecas) {
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: p.id, typeId: p.typeId, levelId: 'lv_0', a: p.a, b: p.b, sag: p.sag }),
    });
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

/** Anéis de buraco reais (largura média ≥ 1e-6 m e área ≥ 1e-9 m²) da silhueta. */
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

/**
 * Maior distância (m) com que um vértice da silhueta `silX` atravessa a face distante de `y` (a face do lado oposto ao
 * que `x` ocupa), no vão de `y`, perto do nó. Ponta = a parede que passa pela outra e sai do outro lado.
 */
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
    if (pc.lado === null) continue; // a passante de T não tem nó na extremidade
    const sx = union(...(res.walls[pc.id]?.layers.filter((l) => l.cut.length > 0).map((l) => l.cut) ?? []));
    for (const pcY of c.pecas) {
      if (pcY === pc) continue;
      const fx = frames.get(pc.id);
      const fy = frames.get(pcY.id);
      if (fx && fy) ponta = Math.max(ponta, pontaFora(fx, fy, sx, c.no));
    }
  }
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
  for (const pc of c.pecas) {
    for (const pcY of c.pecas) {
      if (pcY === pc) continue;
      for (const acab of acabamentos(pc.id)) {
        for (const est of estrutura(pcY.id)) {
          if (acab.raw.length && est.raw.length) sobre += multiArea(intersection(acab.raw, est.raw));
        }
      }
    }
  }
  return { ext: sil.length, furos: furosReais(sil), diff, ponta, sobre };
}

/** Roda a matriz e devolve as falhas como texto, para que o teste mostre todos os casos de uma vez. */
function varrer(cenarios: Cenario[], exigeRaw: (kind: JoinKind) => boolean): string[] {
  const falhas: string[] = [];
  for (const c of cenarios) {
    for (const kind of KINDS) {
      const m = medir(c, kind);
      const motivos: string[] = [];
      if (m.ext !== 1) motivos.push(`${m.ext} anéis externos`);
      if (m.furos > 0) motivos.push(`${m.furos} buraco(s)`);
      if (m.diff >= TOL_AREA) motivos.push(`soma-união ${m.diff.toExponential(2)}`);
      if (m.ponta > TOL_PONTA) motivos.push(`ponta fora ${m.ponta.toExponential(2)} m`);
      if (exigeRaw(kind) && m.sobre >= TOL_RAW) motivos.push(`raw ${m.sobre.toExponential(2)} m²`);
      if (motivos.length) falhas.push(`${c.nome} [${kind}]: ${motivos.join('; ')}`);
    }
  }
  return falhas;
}

const todos = (f: (g: number, r: number, s: 1 | -1, l: 1 | -1) => Cenario, angulos: number[] = ANGULOS): Cenario[] =>
  angulos.flatMap((g) => RAIOS.flatMap((r) => ([1, -1] as const).flatMap((s) => ([1, -1] as const).map((l) => f(g, r, s, l)))));

const CASOS: Array<[string, (g: number, r: number, s: 1 | -1, l: 1 | -1) => Cenario, number[], (k: JoinKind) => boolean]> = [
  ['L com a curva na hospedeira', (g, r, s, l) => cenarioL(true, g, r, s, l), ANGULOS, (k) => k !== 'miter'],
  ['L com o ramal curvo', (g, r, s, l) => cenarioL(false, g, r, s, l), ANGULOS, (k) => k !== 'miter'],
  ['T com a passante curva', (g, r, s, l) => cenarioT(true, g, r, s, l), [60, 90, 120], () => true],
  ['T com o ramal curvo', (g, r, s, l) => cenarioT(false, g, r, s, l), [60, 90, 120], () => true],
  ['curva com curva', (g, r, s, l) => cenarioCurvaCurva(g, r, s, l), ANGULOS, (k) => k !== 'miter'],
];

describe('junções com parede curva (L, T, curva com curva)', () => {
  for (const [nome, gera, angulos, exigeRaw] of CASOS) {
    for (const g of angulos) {
      it(`${nome}, θ=${g}°: 1 anel, sem buraco, sem ponta, sem sobreposição`, () => {
        const falhas = varrer(todos(gera, [g]), exigeRaw);
        expect(falhas, falhas.join('\n')).toEqual([]);
      }, 120_000);
    }
  }
});
