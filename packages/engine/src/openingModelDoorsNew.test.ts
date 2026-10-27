import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel, partTransformed } from './openingModel.ts';
import { CLOSED, type LeafOpening, type OpeningModel, type OpeningPart, type PartBox, type PartMotion } from './openingModelTypes.ts';

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
const de = (parts: OpeningPart[], role: OpeningPart['role']) => parts.filter((x) => x.role === role);
const folha = (parts: OpeningPart[]) => parts.find((x) => x.role === 'leaf')!;

function volumeComum(a: PartBox, b: PartBox): boolean {
  const e = 1e-9;
  return (
    Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > e &&
    Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > e &&
    Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > e
  );
}

const combos = [
  { flipHand: false, flipFacing: false },
  { flipHand: false, flipFacing: true },
  { flipHand: true, flipFacing: false },
  { flipHand: true, flipFacing: true },
];

const FAMILIAS: Array<{ nome: string; base: string; extra?: Partial<OpeningType>; kind: LeafOpening['kind'] }> = [
  { nome: 'vai-e-vem', base: 'ot_pvv90', kind: 'side' },
  { nome: 'embutir', base: 'ot_pe80', kind: 'slide' },
  { nome: 'dobrável', base: 'ot_pd120', kind: 'fold' },
  { nome: 'sanfonada', base: 'ot_ps90', kind: 'fold' },
  { nome: 'seccionada', base: 'ot_pg300', kind: 'overhead' },
];

describe('modelo das portas novas: invariantes', () => {
  it('ids únicos e determinismo, caixas válidas e dentro do vão (exceto pocket e acabamentos)', () => {
    const fora = new Set<OpeningPart['role']>(['casing', 'sillBoard', 'lintel', 'sillBeam', 'pocket']);
    for (const familia of FAMILIAS) {
      for (const flips of combos) {
        const c = cena(familia.base, familia.extra ?? {}, flips);
        const m = modelo(c);
        const caso = `${familia.nome} hand=${flips.flipHand} facing=${flips.flipFacing}`;
        expect(new Set(m.parts.map((x) => x.id)).size, caso).toBe(m.parts.length);
        expect(m, caso).toEqual(modelo(c));
        for (const p of m.parts) {
          expect(p.box.t1 - p.box.t0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
          expect(p.box.s1 - p.box.s0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
          expect(p.box.z1 - p.box.z0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
          if (fora.has(p.role)) continue;
          expect(Math.abs(p.box.t0), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
          expect(Math.abs(p.box.t1), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
          expect(p.box.z0, `${caso} ${p.id}`).toBeGreaterThanOrEqual(-1e-9);
          expect(p.box.z1, `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.height + 1e-9);
        }
      }
    }
  });

  it('folha fechada não tem volume comum com ombreira, batedor ou travessa', () => {
    for (const familia of FAMILIAS) {
      for (const flips of combos) {
        const m = modelo(cena(familia.base, familia.extra ?? {}, flips));
        const caso = `${familia.nome} hand=${flips.flipHand} facing=${flips.flipFacing}`;
        for (const p of m.parts) {
          if (p.role !== 'jamb' && p.role !== 'stop' && p.role !== 'head') continue;
          for (const f of de(m.parts, 'leaf')) expect(volumeComum(f.box, p.box), `${caso} ${f.id} × ${p.id}`).toBe(false);
        }
      }
    }
  });

  it('openings[] com kind, both e slideAxis conforme a spec', () => {
    const vv = modelo(cena('ot_pvv90'));
    expect(vv.openings).toHaveLength(1);
    expect(vv.openings[0]!.kind).toBe('side');
    expect(vv.openings[0]!.both).toBe(true);
    const vv2 = modelo(cena('ot_pvv90', { leaves: 2 }));
    expect(vv2.openings).toHaveLength(2);
    expect(vv2.openings.every((o) => o.kind === 'side' && o.both === true)).toBe(true);

    const pe = modelo(cena('ot_pe80'));
    expect(pe.openings[0]!).toMatchObject({ kind: 'slide', slideAxis: 't' });

    const pd = modelo(cena('ot_pd120'));
    expect(pd.openings).toHaveLength(1);
    expect(pd.openings[0]!.kind).toBe('fold');
    const pd4 = modelo(cena('ot_pd120', { leaves: 4 }));
    expect(pd4.openings).toHaveLength(2);
    expect(pd4.openings.every((o) => o.kind === 'fold')).toBe(true);

    const ps = modelo(cena('ot_ps90'));
    expect(ps.openings[0]!.kind).toBe('fold');
    expect(de(ps.parts, 'leaf')).toHaveLength(9);

    const pg = modelo(cena('ot_pg300'));
    expect(pg.openings[0]!).toMatchObject({ kind: 'overhead', slideAxis: 'z' });
  });
});

/** Dobradiça acumulada e ângulo do painel `index` de uma cadeia. */
function dobra(motion: Extract<PartMotion, { kind: 'fold' }>, theta: number): { t: number; s: number; phi: number } {
  let t = motion.tAnchor;
  let s = motion.s;
  for (let j = 0; j < motion.index; j++) {
    const a = (j % 2 === 0 ? 1 : -1) * motion.sign * theta;
    t += motion.panelWidth * motion.dir * Math.cos(a);
    s += motion.panelWidth * Math.sin(a);
  }
  const alpha = (motion.index % 2 === 0 ? 1 : -1) * motion.sign * theta;
  return { t, s, phi: motion.dir * alpha };
}

/** Centro das duas faces de topo da folha (as arestas de `t0` e `t1`). */
function facesDaFolha(part: OpeningPart, theta: number): { t0: { t: number; s: number }; t1: { t: number; s: number } } {
  const ob = partTransformed(part, { angle: theta, slide: 0 });
  const media = (idx: number[]) => {
    let t = 0;
    let s = 0;
    for (const i of idx) {
      t += ob.corners[i]!.t;
      s += ob.corners[i]!.s;
    }
    return { t: t / idx.length, s: s / idx.length };
  };
  return { t0: media([0, 3, 4, 7]), t1: media([1, 2, 5, 6]) };
}

describe('partTransformed: famílias novas', () => {
  it('vai-e-vem gira nos dois sentidos em torno da dobradiça', () => {
    for (const flips of combos) {
      const c = cena('ot_pvv90', {}, flips);
      const m = modelo(c);
      const f = folha(m.parts);
      const motion = f.motion;
      if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('vai-e-vem sem giro em z');
      const a = partTransformed(f, { angle: Math.PI / 4, slide: 0 });
      const b = partTransformed(f, { angle: -Math.PI / 4, slide: 0 });
      const reta = partTransformed(f, { angle: Math.PI / 2, slide: 0 });
      const caso = `hand=${flips.flipHand} facing=${flips.flipFacing}`;
      const side = flips.flipFacing ? -1 : 1;
      expect(reta.center.t, caso).toBeCloseTo(motion.t, 9);
      expect(Math.sign(a.center.s - motion.s), caso).toBe(side);
      expect(Math.sign(b.center.s - motion.s), caso).toBe(-side);
    }
  });

  it('embutir desliza a largura da folha para a cavidade, que contém a folha aberta', () => {
    for (const flips of combos) {
      const c = cena('ot_pe80', {}, flips);
      const m = modelo(c);
      const f = folha(m.parts);
      const motion = f.motion;
      if (!motion || motion.kind !== 'slide') throw new Error('embutir sem deslizamento');
      const aberta = partTransformed(f, { angle: 0, slide: 1 });
      const caso = `hand=${flips.flipHand} facing=${flips.flipFacing}`;
      expect(aberta.center.t - partTransformed(f, CLOSED).center.t, caso).toBeCloseTo(motion.dt * motion.travel, 9);
      expect(motion.travel, caso).toBeCloseTo(f.box.t1 - f.box.t0, 9);
      const pocket = de(m.parts, 'pocket')[0]!;
      expect(Math.min(pocket.box.t0, pocket.box.t1), caso).toBeLessThanOrEqual(aberta.bounds.t0 + 1e-9);
      expect(Math.max(pocket.box.t0, pocket.box.t1), caso).toBeGreaterThanOrEqual(aberta.bounds.t1 - 1e-9);
      expect(Math.abs(aberta.bounds.s0)).toBeLessThanOrEqual(Math.abs(c.g.width / 2) + c.g.thickness);
    }
  });

  for (const [base, paineis] of [
    ['ot_pd120', 2],
    ['ot_pd120', 4],
    ['ot_ps90', 9],
  ] as const) {
    it(`dobrável/sanfonada ${base} com ${paineis} painéis: cadeia contínua e ponta recua com cos θ`, () => {
      const c = cena(base, paineis === 4 ? { leaves: 4 } : {});
      const m = modelo(c);
      const theta = Math.PI / 4;
      const folhas = de(m.parts, 'leaf');
      expect(folhas).toHaveLength(paineis);
      const cadeias = new Map<number, OpeningPart[]>();
      for (const p of folhas) {
        const motion = p.motion;
        if (!motion || motion.kind !== 'fold') throw new Error('painel sem fold');
        const lista = cadeias.get(motion.tAnchor) ?? [];
        lista.push(p);
        cadeias.set(motion.tAnchor, lista);
      }
      expect(cadeias.size).toBe(paineis === 4 ? 2 : 1);
      for (const [anchor, painel] of cadeias) {
        const ordenados = [...painel].sort((a, b) => {
          const ma = a.motion as Extract<PartMotion, { kind: 'fold' }>;
          const mb = b.motion as Extract<PartMotion, { kind: 'fold' }>;
          return ma.index - mb.index;
        });
        for (let i = 0; i + 1 < ordenados.length; i++) {
          const a = ordenados[i]!;
          const b = ordenados[i + 1]!;
          const fa = facesDaFolha(a, theta);
          const fb = facesDaFolha(b, theta);
          const dist = Math.min(
            Math.hypot(fa.t0.t - fb.t0.t, fa.t0.s - fb.t0.s),
            Math.hypot(fa.t0.t - fb.t1.t, fa.t0.s - fb.t1.s),
            Math.hypot(fa.t1.t - fb.t0.t, fa.t1.s - fb.t0.s),
            Math.hypot(fa.t1.t - fb.t1.t, fa.t1.s - fb.t1.s),
          );
          expect(dist, `painel ${i} → ${i + 1}`).toBeCloseTo(0, 9);
        }
        for (const p of ordenados) {
          const motion = p.motion as Extract<PartMotion, { kind: 'fold' }>;
          const f = facesDaFolha(p, theta);
          expect(Math.hypot(f.t1.t - f.t0.t, f.t1.s - f.t0.s)).toBeCloseTo(motion.panelWidth, 9);
        }
        const ultimo = ordenados[ordenados.length - 1]!;
        const motion = ultimo.motion as Extract<PartMotion, { kind: 'fold' }>;
        const dobraFinal = dobra(motion, theta);
        const esperado = dobraFinal.t + motion.dir * motion.panelWidth * Math.cos(dobraFinal.phi);
        const f = facesDaFolha(ultimo, theta);
        const ponta = motion.dir > 0 ? Math.max(f.t0.t, f.t1.t) : Math.min(f.t0.t, f.t1.t);
        expect(Math.abs(ponta - anchor)).toBeCloseTo(ordenados.length * motion.panelWidth * Math.cos(theta), 9);
        expect(esperado).toBeCloseTo(ponta, 9);
      }
    });
  }

  it('seccionada sobe travel = H em z e mantém o resto parado', () => {
    const c = cena('ot_pg300');
    const m = modelo(c);
    const folhas = de(m.parts, 'leaf');
    expect(folhas).toHaveLength(5);
    for (const f of folhas) {
      const motion = f.motion;
      if (!motion || motion.kind !== 'slide') throw new Error('faixa sem deslizamento');
      const antes = partTransformed(f, CLOSED);
      const depois = partTransformed(f, { angle: 0, slide: 1 });
      expect(depois.center.z - antes.center.z).toBeCloseTo(motion.travel, 9);
      expect(depois.center.t).toBeCloseTo(antes.center.t, 9);
      expect(depois.center.s).toBeCloseTo(antes.center.s, 9);
    }
    expect(folhas[0]!.motion).toMatchObject({ dt: 0, ds: 0, dz: 1 });
    expect(m.openings[0]!.kind).toBe('overhead');
  });
});
