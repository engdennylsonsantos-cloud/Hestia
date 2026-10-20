import { describe, expect, it } from 'vitest';
import { intersection, multiArea, ringArea, union, type MultiPolygon, type Ring, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, wallType, type JoinKind, type Project, type Wall } from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * Junções em ângulo (docs/08 §5.4 passo 3, cortes oblíquos por faixa). Em ângulo, o corte perpendicular da parede que
 * para deixava um triângulo vazio entre a fina e a grossa. Com o corte acompanhando a face da outra parede, a silhueta
 * tem de fechar sem fresta e sem buraco, as áreas dos cortes têm de somar a área da união, e o acabamento da parede
 * que para não pode entrar no núcleo da outra.
 *
 * Ângulo do L é o interno entre as paredes (30° a 150°). O ramal do T é medido a partir da passante.
 *
 * Tolerâncias: a união (`geom/boolean.ts`) arredonda os vértices a 1e-6 m (grade do Clipper) e a 1e-7 m (snap). Daí
 * saem dois tipos de ruído que não são fresta: (i) anéis de buraco com largura média (2·área/perímetro) abaixo de
 * 1e-6 m, que são fatias de 1e-8 m entre cortes colineares; (ii) diferença entre soma e união proporcional ao
 * perímetro da silhueta. Buraco de largura real, ou soma maior que a união com folga maior que a do ruído, reprova.
 */

const GROSSA = 'wt_ext19';
const FINA = 'wt_alv14';
const LARGURA_MIN_BURACO = 1e-6;
const AREA_MIN_BURACO = 1e-9;
const TOL_OVERLAP = 1e-6;
const TOL_SOMA = 1e-6;
const GRADE_UNIAO = 1e-6;

const O: Vec2 = { x: 0, y: 0 };
const P4: Vec2 = { x: 4, y: 0 };
const polar = (c: Vec2, graus: number, comprimento: number): Vec2 => {
  const r = (graus * Math.PI) / 180;
  return { x: c.x + comprimento * Math.cos(r), y: c.y + comprimento * Math.sin(r) };
};

interface Peca {
  id: string;
  typeId: string;
  a: Vec2;
  b: Vec2;
}

/** Projeto com as paredes e a configuração de junção nas extremidades listadas. */
function montar(pecas: Peca[], juntas: Array<{ id: string; lado: 'start' | 'end' }>, kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const peca of pecas) {
    s.exec({ type: 'addWall', wall: makeWall({ id: peca.id, typeId: peca.typeId, levelId: 'lv_0', a: peca.a, b: peca.b }) });
  }
  const p = s.project;
  const elements = { ...p.elements };
  for (const j of juntas) {
    const w = elements[j.id] as Wall;
    elements[j.id] = j.lado === 'start' ? { ...w, joinStart: { kind, flip: false } } : { ...w, joinEnd: { kind, flip: false } };
  }
  return { ...p, elements } as Project;
}

/** L: grossa (0,0)-(4,0) e fina no canto (4,0). `ordem` diz qual parede vem primeiro (quem domina, docs/05 §9). */
function lProjeto(theta: number, ordem: 'gf' | 'fg', kind: JoinKind): { p: Project; seguidora: string; dominante: string } {
  const braco = polar(P4, 180 - theta, 3);
  if (ordem === 'gf') {
    const p = montar(
      [
        { id: 'g', typeId: GROSSA, a: O, b: P4 },
        { id: 'f', typeId: FINA, a: P4, b: braco },
      ],
      [
        { id: 'g', lado: 'end' },
        { id: 'f', lado: 'start' },
      ],
      kind,
    );
    return { p, seguidora: 'f', dominante: 'g' };
  }
  const p = montar(
    [
      { id: 'f', typeId: FINA, a: O, b: P4 },
      { id: 'g', typeId: GROSSA, a: P4, b: braco },
    ],
    [
      { id: 'f', lado: 'end' },
      { id: 'g', lado: 'start' },
    ],
    kind,
  );
  return { p, seguidora: 'g', dominante: 'f' };
}

/** T: grossa passante (-2,0)-(2,0), fina chegando no eixo, a `theta` graus da passante. */
function tProjeto(theta: number): Project {
  return montar(
    [
      { id: 'g', typeId: GROSSA, a: { x: -2, y: 0 }, b: { x: 2, y: 0 } },
      { id: 'f', typeId: FINA, a: O, b: polar(O, theta, 3) },
    ],
    [{ id: 'f', lado: 'start' }],
    'butt',
  );
}

const ANGULOS = [30, 45, 60, 75, 90, 105, 120, 135, 150];
const ANGULOS_T = [45, 60, 75, 105, 120, 135];
const TIPOS: JoinKind[] = ['butt', 'square'];

const perimetro = (ring: Ring): number => ring.reduce((s, q, i) => {
  const r = ring[(i + 1) % ring.length]!;
  return s + Math.hypot(r.x - q.x, r.y - q.y);
}, 0);

/** Buracos da silhueta que não são ruído de grade (ver o cabeçalho). */
function buracosReais(silhueta: MultiPolygon): Ring[] {
  const out: Ring[] = [];
  for (const poly of silhueta) {
    for (let i = 1; i < poly.length; i++) {
      const anel = poly[i]!;
      const area = Math.abs(ringArea(anel));
      if (area < AREA_MIN_BURACO) continue;
      if ((2 * area) / perimetro(anel) < LARGURA_MIN_BURACO) continue;
      out.push(anel);
    }
  }
  return out;
}

interface Silhueta {
  camadas: MultiPolygon[];
  silhueta: MultiPolygon;
  soma: number;
  area: number;
  perimetroExterno: number;
}

function silhuetaDe(res: ReturnType<typeof resolveLevel>, ids: string[]): Silhueta {
  const cortes = ids.flatMap((id) => res.walls[id]!.layers.filter((l) => l.cut.length > 0).map((l) => l.cut));
  const silhueta = union(...cortes);
  return {
    camadas: cortes,
    silhueta,
    soma: cortes.reduce((s, c) => s + multiArea(c), 0),
    area: multiArea(silhueta),
    perimetroExterno: silhueta.reduce((s, poly) => s + perimetro(poly[0]!), 0),
  };
}

/** (a) um anel externo, sem buraco real; (b) soma dos cortes igual à área da união, a menos do ruído de grade. */
function verificarSilhueta(s: Silhueta): void {
  expect(s.silhueta.length).toBe(1);
  expect(buracosReais(s.silhueta)).toHaveLength(0);
  const diff = s.soma - s.area;
  // A união pode ficar maior que a soma pelo arredondamento da grade no contorno; sobreposição (soma maior) é erro.
  expect(diff).toBeLessThan(TOL_SOMA);
  expect(-diff).toBeLessThan(TOL_SOMA + s.perimetroExterno * GRADE_UNIAO);
}

/** (c) acabamento da parede que para (seguidora) sobre o núcleo da dominante, em `raw`. */
function sobreposicaoAcabamentoNucleo(p: Project, seguidora: string, dominante: string): number {
  const res = resolveLevel(p, 'lv_0', new Map());
  const tipo = (id: string) => wallType(p, p.elements[id] as Wall);
  const acabamentos = res.walls[seguidora]!.layers.filter((l) => l.layerIndex < 0 || tipo(seguidora).layers[l.layerIndex]!.function !== 'structure');
  const nucleo = res.walls[dominante]!.layers.filter((l) => l.layerIndex >= 0 && tipo(dominante).layers[l.layerIndex]!.function === 'structure');
  let maior = 0;
  for (const a of acabamentos) {
    for (const b of nucleo) {
      maior = Math.max(maior, multiArea(intersection(a.raw, b.raw)));
    }
  }
  return maior;
}

describe('junção em ângulo: L (grossa 19 + fina 14), butt e square', () => {
  for (const theta of ANGULOS) {
    for (const kind of TIPOS) {
      for (const ordem of ['gf', 'fg'] as const) {
        const nome = `${theta}° ${kind} ${ordem === 'gf' ? 'grossa→fina' : 'fina→grossa'}`;
        it(`fecha a silhueta sem fresta e sem buraco: ${nome}`, () => {
          const { p, seguidora, dominante } = lProjeto(theta, ordem, kind);
          const res = resolveLevel(p, 'lv_0', new Map());
          verificarSilhueta(silhuetaDe(res, [dominante, seguidora]));
        });
        it(`acabamento da parede que para não entra no núcleo da outra: ${nome}`, () => {
          const { p, seguidora, dominante } = lProjeto(theta, ordem, kind);
          expect(sobreposicaoAcabamentoNucleo(p, seguidora, dominante)).toBeLessThan(TOL_OVERLAP);
        });
      }
    }
  }
});

describe('junção em ângulo: T oblíquo (grossa passante + fina chegando)', () => {
  for (const theta of ANGULOS_T) {
    it(`fecha a silhueta sem fresta e sem buraco: T ${theta}°`, () => {
      const res = resolveLevel(tProjeto(theta), 'lv_0', new Map());
      verificarSilhueta(silhuetaDe(res, ['g', 'f']));
    });
  }
});
