import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, createEmptyProject, makeWall, openingFamilyOf, openingTypeIssue, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel, partTransformed } from './openingModel.ts';
import { CLOSED, type OpeningModel, type OpeningPart, type PartBox } from './openingModelTypes.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

/** Parede de 4 m com um vão no meio, como nos testes do modelo único. */
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

function volumeComum(a: PartBox, b: PartBox): boolean {
  const e = 1e-9;
  return (
    Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > e &&
    Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > e &&
    Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > e
  );
}

const familias = [
  { nome: 'janela de abrir', base: 'ot_ja120', family: 'window_hinged' },
  { nome: 'guilhotina', base: 'ot_jg90', family: 'window_hung' },
  { nome: 'pivotante', base: 'ot_jp80', family: 'window_pivot' },
  { nome: 'veneziana', base: 'ot_jv80', family: 'window_louver' },
] as const;

describe('janelas novas: modelo, caixas e aberturas', () => {
  it('as quatro famílias caem na família certa e passam na regra do tipo', () => {
    for (const f of familias) {
      const t = DEFAULT_OPENING_TYPES.find((x) => x.id === f.base)!;
      expect(openingFamilyOf(t)?.id, f.base).toBe(f.family);
      expect(openingTypeIssue(t), f.base).toBeNull();
    }
  });

  it('ids únicos e estáveis, caixas válidas e tudo dentro do vão nas 4 combinações', () => {
    for (const familia of familias) {
      for (const flipHand of [false, true]) {
        for (const flipFacing of [false, true]) {
          const c = cena(familia.base, {}, { flipHand, flipFacing });
          const m = modelo(c);
          const caso = `${familia.nome} hand=${flipHand} facing=${flipFacing}`;
          expect(new Set(m.parts.map((x) => x.id)).size, caso).toBe(m.parts.length);
          expect(m.parts.map((x) => x.id), caso).toEqual(modelo(c).parts.map((x) => x.id));
          expect(m, caso).toEqual(modelo(c));
          for (const p of m.parts) {
            expect(p.box.t1 - p.box.t0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(p.box.s1 - p.box.s0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(p.box.z1 - p.box.z0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(Math.abs(p.box.t0), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
            expect(Math.abs(p.box.t1), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
            expect(p.box.z0, `${caso} ${p.id}`).toBeGreaterThanOrEqual(-1e-9);
            expect(p.box.z1, `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.height + 1e-9);
          }
          // Folhas (e aletas) não atravessam o caixilho.
          const fixos = m.parts.filter((x) => x.role === 'jamb' || x.role === 'head' || x.role === 'sillFrame');
          for (const folha of m.parts.filter((x) => x.role === 'leaf' || x.role === 'leafPanel')) {
            for (const b of fixos) expect(volumeComum(folha.box, b.box), `${caso} ${folha.id} × ${b.id}`).toBe(false);
          }
        }
      }
    }
  });

  it('janela de abrir: 2 folhas, kind side e dobradiças nas duas ombreiras', () => {
    const c = cena('ot_ja120');
    const m = modelo(c);
    expect(m.openings).toHaveLength(2);
    expect(m.openings.every((o) => o.kind === 'side' && o.side === 1)).toBe(true);
    expect(m.openings.map((o) => o.hingeT).sort((a, b) => a - b)).toEqual([-(c.g.width / 2 - 0.05), c.g.width / 2 - 0.05]);
    expect(m.parts.filter((x) => x.role === 'glass')).toHaveLength(2);
  });

  it('guilhotina: a folha de baixo desliza em z e a de cima fica sem movimento', () => {
    const c = cena('ot_jg90');
    const m = modelo(c);
    const slides = m.openings.filter((o) => o.kind === 'slide');
    expect(slides).toHaveLength(1);
    expect(slides[0]!.slideAxis).toBe('z');
    expect(slides[0]!.leaf).toBe(0);
    const inferior = m.parts.filter((x) => x.leaf === 0 && (x.role === 'leaf' || x.role === 'glass'));
    const superior = m.parts.filter((x) => x.leaf === 1 && (x.role === 'leaf' || x.role === 'glass'));
    expect(inferior.length).toBeGreaterThan(0);
    expect(superior.length).toBeGreaterThan(0);
    for (const p of inferior) {
      const motion = p.motion;
      if (!motion || motion.kind !== 'slide') throw new Error('folha de baixo sem deslizamento');
      expect(motion.dz).toBe(1);
      expect(motion.travel).toBeCloseTo((c.g.height - 2 * 0.05) / 2 - 0.02, 9);
    }
    for (const p of superior) expect(p.motion, p.id).toBeUndefined();
  });

  it('pivotante: uma folha, kind pivot e eixo vertical em t = 0', () => {
    const c = cena('ot_jp80');
    const m = modelo(c);
    const a = m.openings[0]!;
    expect(a.kind).toBe('pivot');
    expect(a.hingeT).toBeCloseTo(0, 9);
    expect(a.radius).toBeCloseTo(c.g.width / 2 - 0.05, 9);
    for (const p of m.parts.filter((x) => x.role === 'leaf' || x.role === 'glass')) {
      const motion = p.motion;
      if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('folha sem giro em z');
      expect(motion.t).toBeCloseTo(0, 9);
    }
  });

  it('veneziana: aletas em leafPanel, kind louver, cada uma com o próprio eixo central em t', () => {
    const c = cena('ot_jv80');
    const m = modelo(c);
    const aletas = de(m.parts, 'leafPanel');
    expect(aletas.length).toBeGreaterThan(5);
    expect(de(m.parts, 'glass')).toHaveLength(0);
    expect(m.openings[0]!.kind).toBe('louver');
    for (const aleta of aletas) {
      const motion = aleta.motion;
      if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('aleta sem giro em t');
      expect(motion.z).toBeCloseTo((aleta.box.z0 + aleta.box.z1) / 2, 9);
      expect(motion.s).toBeCloseTo(0, 9);
      expect(motion.sign).toBe(1);
    }
  });
});

describe('janelas novas: movimento das peças', () => {
  it('janela de abrir: a folha e o vidro giram 90° em torno da ombreira certa', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_ja120', {}, { flipHand, flipFacing });
        const m = modelo(c);
        const caso = `hand=${flipHand} facing=${flipFacing}`;
        for (const a of m.openings) {
          const folhas = m.parts.filter((x) => x.leaf === a.leaf && (x.role === 'leaf' || x.role === 'glass'));
          expect(folhas.length, caso).toBe(5);
          for (const p of folhas) {
            const motion = p.motion;
            if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('folha sem giro em z');
            const ob = partTransformed(p, { angle: Math.PI / 2, slide: 0 });
            expect(ob.center.t, `${caso} ${p.id}`).toBeCloseTo(motion.t, 9);
            expect(Math.sign(ob.center.s - motion.s), `${caso} ${p.id}`).toBe(flipFacing ? -1 : 1);
          }
        }
      }
    }
  });

  it('guilhotina: a folha de baixo sobe travel e a de cima não se move', () => {
    const c = cena('ot_jg90');
    const m = modelo(c);
    const inferior = m.parts.find((x) => x.leaf === 0 && x.role === 'leaf')!;
    const superior = m.parts.find((x) => x.leaf === 1 && x.role === 'leaf')!;
    const travel = (c.g.height - 2 * 0.05) / 2 - 0.02;
    const antes = partTransformed(inferior, CLOSED);
    const depois = partTransformed(inferior, { angle: 0, slide: 1 });
    expect(depois.center.z - antes.center.z).toBeCloseTo(travel, 9);
    expect(depois.bounds.z1).toBeLessThanOrEqual(c.g.height + 1e-9);
    const fixaAntes = partTransformed(superior, CLOSED);
    const fixaDepois = partTransformed(superior, { angle: 0, slide: 1 });
    expect(fixaDepois.center).toEqual(fixaAntes.center);
  });

  it('pivotante: gira em torno de t = 0 sem sair do vão', () => {
    const c = cena('ot_jp80');
    const m = modelo(c);
    for (const p of m.parts.filter((x) => x.role === 'leaf' || x.role === 'glass')) {
      const ob = partTransformed(p, { angle: Math.PI / 2, slide: 0 });
      expect(Math.abs(ob.center.t)).toBeLessThan(1e-9);
      expect(ob.bounds.t0).toBeGreaterThanOrEqual(-c.g.width / 2 - 1e-9);
      expect(ob.bounds.t1).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
      expect(ob.bounds.z0).toBeGreaterThanOrEqual(-1e-9);
      expect(ob.bounds.z1).toBeLessThanOrEqual(c.g.height + 1e-9);
    }
  });

  it('veneziana: cada aleta gira em torno do próprio centro e continua no vão', () => {
    const c = cena('ot_jv80');
    const m = modelo(c);
    for (const aleta of de(m.parts, 'leafPanel')) {
      const motion = aleta.motion;
      if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('aleta sem giro em t');
      const ob = partTransformed(aleta, { angle: (45 * Math.PI) / 180, slide: 0 });
      expect(ob.center.z).toBeCloseTo(motion.z, 9);
      expect(ob.bounds.z0).toBeGreaterThanOrEqual(-1e-9);
      expect(ob.bounds.z1).toBeLessThanOrEqual(c.g.height + 1e-9);
      expect(ob.bounds.t0).toBeGreaterThanOrEqual(-c.g.width / 2 - 1e-9);
      expect(ob.bounds.t1).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
    }
  });
});

describe('catálogo novo de janelas', () => {
  it('os 4 tipos novos têm código, dimensões e peitoril pedidos', () => {
    const esperado = [
      { id: 'ot_ja120', code: 'J-07', width: 1.2, height: 1.2, sill: 1.1 },
      { id: 'ot_jg90', code: 'J-08', width: 0.9, height: 1.5, sill: 0.9 },
      { id: 'ot_jp80', code: 'J-09', width: 0.8, height: 1.2, sill: 1.0 },
      { id: 'ot_jv80', code: 'J-10', width: 0.8, height: 0.6, sill: 1.5 },
    ] as const;
    for (const e of esperado) {
      const t = DEFAULT_OPENING_TYPES.find((x) => x.id === e.id)!;
      expect(t.code).toBe(e.code);
      expect(t.width).toBeCloseTo(e.width, 9);
      expect(t.height).toBeCloseTo(e.height, 9);
      expect(t.sill).toBeCloseTo(e.sill, 9);
      expect(modelo(cena(e.id)).parts.length).toBeGreaterThan(0);
    }
  });
});
