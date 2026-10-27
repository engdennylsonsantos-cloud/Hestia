import { describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  makeWall,
  ProjectStore,
  type Opening,
  type OpeningType,
  type Project,
} from '@hestia/model';
import { buildOpeningModel, partTransformed } from './openingModel.ts';
import { projectParts } from './openingModelTransforms.ts';
import { CLOSED, type OpeningModel, type OpeningPart, type PartBox } from './openingModelTypes.ts';
import { openingGeometry, frameOfWall } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

function cena(base: string, extra: Partial<OpeningType> = {}, flips: { flipHand?: boolean; flipFacing?: boolean } = {}): Cena {
  const s = new ProjectStore(createEmptyProject());
  const t = s.project.openingTypes[base];
  if (!t) throw new Error(`tipo padrão ausente: ${base}`);
  s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_x', ...extra } });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({
    type: 'addOpening',
    opening: {
      id: 'v',
      kind: t.kind,
      typeId: 'ot_x',
      hostId: 'w',
      offset: 2,
      flipHand: flips.flipHand ?? false,
      flipFacing: flips.flipFacing ?? false,
      sillOverride: null,
      mark: '',
    },
  });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f), t: p.openingTypes.ot_x! };
}

const modelo = (c: Cena): OpeningModel => buildOpeningModel(c.p, c.o, c.g, frameOfWall(c.p, 'w')!);
const combos = [
  { flipHand: false, flipFacing: false },
  { flipHand: false, flipFacing: true },
  { flipHand: true, flipFacing: false },
  { flipHand: true, flipFacing: true },
] as const;

const TOL = 0.01;
const EPS = 1e-9;

const volumeComum = (a: PartBox, b: PartBox): boolean =>
  Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > EPS &&
  Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > EPS &&
  Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;

/** Grupo físico da peça para o teste de sobreposição (caixilho × folha × vidro × bandeira). */
function grupoFisico(part: OpeningPart): string | null {
  if (part.id.startsWith('transom-bar')) return 'frame';
  if (part.role === 'jamb' || part.role === 'head' || part.role === 'sillFrame') return 'frame';
  if (part.role === 'muntin') return null;
  if (part.id.startsWith('sidelight')) return 'sidelight';
  if (part.role === 'leaf' || part.role === 'glass') {
    if (part.id.startsWith('transom-')) return 'transom';
    if (part.leaf !== undefined) return `leaf-${part.leaf}`;
    return 'fixed';
  }
  return null;
}

const cobre = (part: OpeningPart): boolean =>
  part.role === 'jamb' ||
  part.role === 'head' ||
  part.role === 'sillFrame' ||
  part.role === 'leaf' ||
  part.role === 'glass' ||
  part.role === 'muntin';

interface Retangulo {
  u0: number;
  u1: number;
  z0: number;
  z1: number;
}

const retangulo = (ring: Array<{ u: number; z: number }>): Retangulo => ({
  u0: Math.min(...ring.map((p) => p.u)),
  u1: Math.max(...ring.map((p) => p.u)),
  z0: Math.min(...ring.map((p) => p.z)),
  z1: Math.max(...ring.map((p) => p.z)),
});

function cobertura(m: OpeningModel): { faltando: Array<{ u: number; z: number }>; fora: OpeningPart[] } {
  const hw = m.width / 2;
  const rets = projectParts(m, 's', CLOSED)
    .filter((x) => cobre(x.part))
    .map((x) => retangulo(x.ring));
  const faltando: Array<{ u: number; z: number }> = [];
  const passo = 0.01;
  for (let u = -hw; u <= hw + 1e-9; u += passo) {
    for (let z = 0; z <= m.height + 1e-9; z += passo) {
      const ok = rets.some((r) => u >= r.u0 - TOL && u <= r.u1 + TOL && z >= r.z0 - TOL && z <= r.z1 + TOL);
      if (!ok) faltando.push({ u, z });
    }
  }
  const fora: OpeningPart[] = [];
  for (const x of projectParts(m, 's', CLOSED)) {
    if (!cobre(x.part)) continue;
    const r = retangulo(x.ring);
    if (r.u0 < -hw - EPS || r.u1 > hw + EPS || r.z0 < -EPS || r.z1 > m.height + EPS) fora.push(x.part);
  }
  return { faltando, fora };
}

const familiasCobertura: Array<{ nome: string; base: string; extra?: Partial<OpeningType> }> = [
  { nome: 'fixa', base: 'ot_jfixa60' },
  { nome: 'de abrir 1', base: 'ot_ja120', extra: { leaves: 1 } },
  { nome: 'de abrir 2', base: 'ot_ja120' },
  { nome: 'maxim-ar', base: 'ot_j60' },
  { nome: 'correr 2', base: 'ot_j120' },
  { nome: 'correr 3', base: 'ot_j240' },
  { nome: 'correr 4', base: 'ot_j120', extra: { leaves: 4 } },
  { nome: 'basculante', base: 'ot_jb80' },
  { nome: 'pivotante', base: 'ot_jp80' },
];

describe('bandeira em janela: cobertura e grupos físicos', () => {
  for (const f of familiasCobertura) {
    for (const bandeira of [false, true]) {
      it(`${f.nome} ${bandeira ? 'com' : 'sem'} bandeira: elevação cobre o vão nos 4 flips e não há volume em comum`, () => {
        for (const flips of combos) {
          const extra = { ...(f.extra ?? {}), ...(bandeira ? { transom: { height: 0.3 } } : {}) } as Partial<OpeningType>;
          const c = cena(f.base, extra, flips);
          const m = modelo(c);
          const caso = `${f.nome} bandeira=${bandeira} hand=${flips.flipHand} facing=${flips.flipFacing}`;
          const { faltando, fora } = cobertura(m);
          expect(faltando.slice(0, 5), caso).toEqual([]);
          expect(fora.map((p) => p.id), caso).toEqual([]);
          const grupos = m.parts
            .map((p) => ({ p, g: grupoFisico(p) }))
            .filter((x): x is { p: OpeningPart; g: string } => x.g !== null);
          for (let i = 0; i < grupos.length; i++) {
            for (let j = i + 1; j < grupos.length; j++) {
              if (grupos[i]!.g === grupos[j]!.g) continue;
              expect(volumeComum(grupos[i]!.p.box, grupos[j]!.p.box), `${caso} ${grupos[i]!.p.id} × ${grupos[j]!.p.id}`).toBe(false);
            }
          }
        }
      });
    }
  }

  it('guilhotina e veneziana ignoram a bandeira: modelo idêntico ao sem bandeira', () => {
    for (const base of ['ot_jg90', 'ot_jv80']) {
      for (const flips of combos) {
        const sem = modelo(cena(base, {}, flips));
        const com = modelo(cena(base, { transom: { height: 0.3 } }, flips));
        expect(com.parts, `${base} hand=${flips.flipHand} facing=${flips.flipFacing}`).toEqual(sem.parts);
        expect(com.openings).toEqual(sem.openings);
      }
    }
  });

  it('bandeira lateral é ignorada nas janelas que não são fixas', () => {
    for (const base of ['ot_j60', 'ot_j120', 'ot_ja120', 'ot_jb80', 'ot_jp80']) {
      const sem = modelo(cena(base));
      const com = modelo(cena(base, { sidelights: { left: true, right: true, width: 0.2 } }));
      expect(com.parts, base).toEqual(sem.parts);
    }
    const fixa = modelo(cena('ot_jfixa60', { sidelights: { left: true, width: 0.2 } }));
    expect(fixa.parts.some((p) => p.id === 'sidelight-glass-left')).toBe(true);
  });

  it('transom.fixed = false vira folha maxim-ar pequena (kind top), sem perder a cobertura', () => {
    for (const base of ['ot_jfixa60', 'ot_j120', 'ot_jb80']) {
      for (const flips of combos) {
        const c = cena(base, { transom: { height: 0.3, fixed: false } }, flips);
        const m = modelo(c);
        const bandeira = m.openings.find((o) => o.kind === 'top')!;
        expect(bandeira, base).toBeDefined();
        const folha = m.parts.filter((p) => p.leaf === bandeira.leaf && (p.role === 'leaf' || p.role === 'glass'));
        expect(folha.length, base).toBe(5);
        for (const p of folha) {
          const motion = p.motion;
          if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('bandeira sem giro em t');
          expect(motion.z).toBeCloseTo(bandeira.z1, 9);
        }
        const { faltando, fora } = cobertura(m);
        expect(faltando.slice(0, 5), base).toEqual([]);
        expect(fora, base).toEqual([]);
      }
    }
  });
});

describe('basculante: eixo, metades e varredura sem interseção', () => {
  it('ot_jb80 tem 80 × 50, peitoril 1,70, código J-11 e família window_tilt', () => {
    const c = cena('ot_jb80');
    expect(c.t.code).toBe('J-11');
    expect(c.t.width).toBeCloseTo(0.8, 9);
    expect(c.t.height).toBeCloseTo(0.5, 9);
    expect(c.t.sill).toBeCloseTo(1.7, 9);
    expect(c.t.plan).toBe('tilt');
  });

  for (const tiltAxis of [0.3, 0.5, 0.7]) {
    it(`tiltAxis ${tiltAxis}: eixo em z = J + eixo·(H − 2J) e metades opostas a 30°`, () => {
      for (const flips of combos) {
        const c = cena('ot_jb80', { tiltAxis }, flips);
        const m = modelo(c);
        const a = m.openings[0]!;
        const eixo = 0.05 + tiltAxis * (c.g.height - 0.1);
        expect(a.kind, `${tiltAxis}`).toBe('tilt');
        expect(a.axisZ, `${tiltAxis}`).toBeCloseTo(eixo, 9);
        const angle = (30 * Math.PI) / 180;
        const topo = m.parts.find((p) => p.id === 'leaf-0-top')!;
        const baixo = m.parts.find((p) => p.id === 'leaf-0-bottom')!;
        const ot = partTransformed(topo, { angle, slide: 0 });
        const ob = partTransformed(baixo, { angle, slide: 0 });
        const side = flips.flipFacing ? -1 : 1;
        expect(Math.sign(ot.center.s), `${tiltAxis} topo`).toBe(side);
        expect(Math.sign(ob.center.s), `${tiltAxis} baixo`).toBe(-side);
        expect(ot.center.z, `${tiltAxis} topo z`).toBeGreaterThan(eixo);
        expect(ob.center.z, `${tiltAxis} baixo z`).toBeLessThan(eixo);
      }
    });
  }

  it('a metade superior vai para o lado side e a inferior para o oposto, em todos os flips', () => {
    for (const tiltAxis of [0.2, 0.5, 0.8]) {
      for (const flips of combos) {
        const c = cena('ot_jb80', { tiltAxis }, flips);
        const m = modelo(c);
        const side = c.g.flipFacing ? -1 : 1;
        const topo = m.parts.find((p) => p.id === 'leaf-0-top')!;
        const baixo = m.parts.find((p) => p.id === 'leaf-0-bottom')!;
        const angle = (30 * Math.PI) / 180;
        const ot = partTransformed(topo, { angle, slide: 0 });
        const ob = partTransformed(baixo, { angle, slide: 0 });
        const eixo = m.openings[0]!.axisZ!;
        expect(Math.sign(ot.center.s), `${tiltAxis} topo`).toBe(side);
        expect(Math.sign(ob.center.s), `${tiltAxis} baixo`).toBe(-side);
        expect(Math.sign(ot.center.z - eixo), `${tiltAxis} topo z`).toBe(1);
        expect(Math.sign(ob.center.z - eixo), `${tiltAxis} baixo z`).toBe(-1);
      }
    }
  });

  it('folha × caixilho: nenhuma interseção de 0 a 60° (a cada 5°), nos 4 flips', () => {
    for (const tiltAxis of [0.2, 0.5, 0.8]) {
      for (const flips of combos) {
        const c = cena('ot_jb80', { tiltAxis }, flips);
        const m = modelo(c);
        const fixos = m.parts.filter((p) => p.role === 'jamb' || p.role === 'head' || p.role === 'sillFrame');
        const folhas = m.parts.filter((p) => p.leaf === 0 && (p.role === 'leaf' || p.role === 'glass'));
        for (let graus = 0; graus <= 60; graus += 5) {
          const angle = (graus * Math.PI) / 180;
          for (const folha of folhas) {
            for (const fixo of fixos) {
              expect(intersectaObb(folha, fixo, angle), `eixo=${tiltAxis} ${graus}° ${folha.id} × ${fixo.id}`).toBe(false);
            }
          }
        }
      }
    }
  });
});

/** Interseção de volume entre a peça girada (eixo t) e um caixilho fixo (caixa alinhada). */
function intersectaObb(part: OpeningPart, fixo: OpeningPart, angle: number): boolean {
  const motion = part.motion;
  if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('folha sem giro em t');
  const b = part.box;
  const f = fixo.box;
  if (Math.min(b.t1, f.t1) - Math.max(b.t0, f.t0) <= EPS) return false;
  const phi = motion.sign * angle;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const cs = (b.s0 + b.s1) / 2;
  const cz = (b.z0 + b.z1) / 2;
  const center = { s: motion.s + (cs - motion.s) * cos - (cz - motion.z) * sin, z: motion.z + (cs - motion.s) * sin + (cz - motion.z) * cos };
  const hs = (b.s1 - b.s0) / 2;
  const hz = (b.z1 - b.z0) / 2;
  const fc = { s: (f.s0 + f.s1) / 2, z: (f.z0 + f.z1) / 2 };
  const fhs = (f.s1 - f.s0) / 2;
  const fhz = (f.z1 - f.z0) / 2;
  const axes: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [cos, sin],
    [-sin, cos],
  ];
  for (const [as, az] of axes) {
    const ra = hs * Math.abs(cos * as + sin * az) + hz * Math.abs(-sin * as + cos * az);
    const rb = fhs * Math.abs(as) + fhz * Math.abs(az);
    const dist = Math.abs((center.s - fc.s) * as + (center.z - fc.z) * az);
    if (dist > ra + rb + EPS) return false;
  }
  return true;
}
