import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel } from './openingModel.ts';
import { handleParts, type HandlePiece, type HandleSpec } from './openingModelHandles.ts';
import type { OpeningModel, OpeningPart } from './openingModelTypes.ts';

/** Parede de 4 m com um vão no meio; `extra` completa o tipo base e os flips vão no opening. */
function cena(base: string, extra: Partial<OpeningType> = {}, flips: { flipHand?: boolean; flipFacing?: boolean } = {}) {
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
  const p: Project = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  return { p, o, g: openingGeometry(p, o, f) as OpeningGeometry, f, t: p.openingTypes.ot_x! };
}

const modelo = (c: ReturnType<typeof cena>): OpeningModel => buildOpeningModel(c.p, c.o, c.g, c.f);
const de = (parts: OpeningPart[], role: string): OpeningPart[] => parts.filter((x) => x.role === role);
const dim = (b: HandlePiece['box']) => ({ t: b.t1 - b.t0, s: b.s1 - b.s0, z: b.z1 - b.z0 });
const centroT = (b: HandlePiece['box']): number => (b.t0 + b.t1) / 2;
const centroZ = (b: HandlePiece['box']): number => (b.z0 + b.z1) / 2;

/** Entrada de teste: folha de 4 cm (plano médio em s = 0), eixo em t = 0,3, altura 1,0. */
const base = (style: HandleSpec['style'], side: 1 | -1 = 1, inward: 1 | -1 = 1): HandleSpec => ({
  index: 0,
  style,
  tR: 0.3,
  z: 1,
  sMid: 0,
  L: 0.04,
  side,
  inward,
});

describe('handleParts: ids e formas', () => {
  it.each(['lever', 'knob', 'pull'] as const)('%s: ids únicos por folha', (style) => {
    const ids = handleParts(base(style)).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('alavanca: roseta, pescoço, braço e placa nas duas faces, com as medidas reais', () => {
    const pecas = handleParts(base('lever'));
    expect(pecas.map((p) => p.id).sort()).toEqual(
      [
        'handle-0-rosette-a',
        'handle-0-rosette-b',
        'handle-0-neck-a',
        'handle-0-neck-b',
        'handle-0-lever-a',
        'handle-0-lever-b',
        'handle-0-lock-a',
        'handle-0-lock-b',
      ].sort(),
    );
    const roseta = pecas.find((p) => p.id === 'handle-0-rosette-b')!;
    expect(dim(roseta.box).t).toBeCloseTo(0.052, 9);
    expect(dim(roseta.box).z).toBeCloseTo(0.052, 9);
    expect(dim(roseta.box).s).toBeCloseTo(0.008, 9);
    const haste = pecas.find((p) => p.id === 'handle-0-neck-b')!;
    expect(dim(haste.box).t).toBeCloseTo(0.016, 9);
    // Pescoço da face b (s = 0,02) até 0,046 da face.
    expect(haste.box.s1).toBeCloseTo(0.02 + 0.046, 9);
    const placa = pecas.find((p) => p.id === 'handle-0-lock-b')!;
    expect(dim(placa.box).t).toBeCloseTo(0.03, 9);
    expect(dim(placa.box).z).toBeCloseTo(0.075, 9);
    expect(dim(placa.box).s).toBeCloseTo(0.004, 9);
    expect(centroZ(placa.box)).toBeCloseTo(1 - 0.07, 9);
  });

  it('bola: roseta e haste, e 5 discos empilhados nas duas faces', () => {
    const pecas = handleParts(base('knob'));
    expect(pecas.filter((p) => p.id.includes('knob'))).toHaveLength(10);
    for (const k of [0, 1, 2, 3, 4]) expect(pecas.find((p) => p.id === `handle-0-knob-${k}-a`)).toBeDefined();
    expect(dim(pecas.find((p) => p.id === 'handle-0-rosette-a')!.box).t).toBeCloseTo(0.055, 9);
    expect(dim(pecas.find((p) => p.id === 'handle-0-neck-a')!.box).t).toBeCloseTo(0.022, 9);
  });

  it('puxador: barra vertical 0,40 a 0,050 da face, com 2 hastes em z ± 0,16', () => {
    const pecas = handleParts(base('pull', 1));
    expect(pecas.map((p) => p.id).sort()).toEqual(['handle-0-pull-bar', 'handle-0-pull-post-0', 'handle-0-pull-post-1']);
    const barra = pecas.find((p) => p.id === 'handle-0-pull-bar')!;
    expect(dim(barra.box).z).toBeCloseTo(0.4, 9);
    expect(dim(barra.box).t).toBeCloseTo(0.025, 9);
    expect(barra.box.s0).toBeCloseTo(0.02 + 0.05 - 0.0125, 9);
    expect(barra.box.s1).toBeCloseTo(0.02 + 0.05 + 0.0125, 9);
    const hastes = pecas.filter((p) => p.id.includes('post')).map((p) => centroZ(p.box)).sort((a, b) => a - b);
    expect(hastes).toHaveLength(2);
    expect(hastes[0]).toBeCloseTo(1 - 0.16, 9);
    expect(hastes[1]).toBeCloseTo(1 + 0.16, 9);
  });

  it('cada peça redonda traz seção; a projeção a partir da face fica nos limites de cada estilo', () => {
    // Face em s = ±0,02 (sMid = 0, L = 0,04). Distância de cada peça à face a que pertence.
    const meia = 0.02;
    const limite: Record<HandleSpec['style'], number> = { lever: 0.046, knob: 0.072, pull: 0.0625 };
    for (const style of ['lever', 'knob', 'pull'] as const) {
      for (const side of [1, -1] as const) {
        for (const p of handleParts(base(style, side))) {
          expect(p.profile).toBeDefined();
          const lado = p.id.endsWith('-a') ? -1 : p.id.endsWith('-b') ? 1 : side;
          const ext = lado > 0 ? Math.max(p.box.s1 - meia, 0) : Math.max(-meia - p.box.s0, 0);
          expect(ext).toBeLessThanOrEqual(limite[style] + 1e-9);
        }
      }
    }
  });

  it('simetria: cada peça de uma face tem a mesma forma na outra, espelhada em s', () => {
    for (const style of ['lever', 'knob'] as const) {
      const pecas = handleParts(base(style));
      for (const a of pecas.filter((p) => p.id.endsWith('-a'))) {
        const b = pecas.find((p) => p.id === a.id.replace(/-a$/, '-b'))!;
        expect(b).toBeDefined();
        const da = dim(a.box);
        const db = dim(b.box);
        expect(db.t).toBeCloseTo(da.t, 9);
        expect(db.z).toBeCloseTo(da.z, 9);
        expect(db.s).toBeCloseTo(da.s, 9);
        expect(b.box.s0).toBeCloseTo(-a.box.s1, 9);
        expect(b.box.s1).toBeCloseTo(-a.box.s0, 9);
      }
    }
  });

  it('o braço da alavanca aponta para o lado da dobradiça nas duas direções', () => {
    for (const inward of [1, -1] as const) {
      const braco = handleParts(base('lever', 1, inward)).find((p) => p.id === 'handle-0-lever-a')!;
      const ponta = inward > 0 ? braco.box.t1 : braco.box.t0;
      expect(Math.sign(ponta - 0.3)).toBe(inward);
      expect(Math.abs(ponta - 0.3)).toBeCloseTo(0.125, 9);
    }
  });
});

describe('maçaneta no modelo do vão', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('flipHand=%s, flipFacing=%s: o braço aponta para a dobradiça', (flipHand, flipFacing) => {
    const m = modelo(cena('ot_p90', {}, { flipHand, flipFacing }));
    const handles = de(m.parts, 'handle');
    const roseta = handles.find((x) => x.id === 'handle-0-rosette-a')!;
    const dobradica = de(m.parts, 'hinge')[0]!;
    const ladoDobradica = Math.sign(centroT(dobradica.box) - centroT(roseta.box));
    const braco = handles.find((x) => x.id === 'handle-0-lever-a')!;
    expect(Math.sign(centroT(braco.box) - centroT(roseta.box))).toBe(ladoDobradica);
  });

  it('a maçaneta acompanha a folha: mesmo motion e leaf', () => {
    const m = modelo(cena('ot_p90'));
    const folha = de(m.parts, 'leaf').find((x) => x.leaf === 0)!;
    const maçanetas = de(m.parts, 'handle');
    expect(maçanetas.length).toBeGreaterThan(0);
    for (const h of maçanetas) {
      expect(h.leaf).toBe(folha.leaf);
      expect(h.motion).toEqual(folha.motion);
    }
  });

  it('altura e recuo do tipo mandam na posição (eixo em z e em t)', () => {
    const m = modelo(cena('ot_p90', { handleHeight: 0.9, handleInset: 0.1 }));
    const roseta = de(m.parts, 'handle').find((x) => x.id === 'handle-0-rosette-a')!;
    expect(centroZ(roseta.box)).toBeCloseTo(0.9, 9);
    expect(centroT(roseta.box)).toBeCloseTo(0.311, 6);
  });
});
