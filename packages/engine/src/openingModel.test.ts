import { describe, expect, it } from 'vitest';
import { coreSpan, createEmptyProject, makeWall, openingFrame, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel, partTransformed, projectParts, slicePartsAtZ } from './openingModel.ts';
import { CLOSED, type OpeningPart, type PartBox } from './openingModelTypes.ts';

interface Cena {
  p: Project;
  o: Opening;
  g: OpeningGeometry;
  t: OpeningType;
}

/** Parede de 4 m com um vão no meio, como nos testes do 3D. */
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

const modelo = (c: Cena) => buildOpeningModel(c.p, c.o, c.g, frameOfWall(c.p, 'w')!);
const de = (parts: OpeningPart[], role: OpeningPart['role']) => parts.filter((x) => x.role === role);
const folha = (parts: OpeningPart[]) => parts.find((x) => x.role === 'leaf')!;
const largura = (b: PartBox) => b.t1 - b.t0;
const altura = (b: PartBox) => b.z1 - b.z0;

function volumeComum(a: PartBox, b: PartBox): boolean {
  const e = 1e-9;
  return (
    Math.min(a.t1, b.t1) - Math.max(a.t0, b.t0) > e &&
    Math.min(a.s1, b.s1) - Math.max(a.s0, b.s0) > e &&
    Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > e
  );
}

describe('buildOpeningModel: porta de giro padrão ot_p90', () => {
  it('medidas exatas da folha, altura e dobradiça nas quatro combinações', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const f = folha(m.parts);
    expect(largura(f.box)).toBeCloseTo(2 * 0.411, 9);
    expect(f.box.t0).toBeCloseTo(-0.411, 9);
    expect(f.box.t1).toBeCloseTo(0.411, 9);
    expect(f.box.z0).toBeCloseTo(0.008, 9);
    expect(f.box.z1).toBeCloseTo(2.061, 9);
    expect(f.box.s1 - f.box.s0).toBeCloseTo(0.04, 9);

    for (const flipHand of [false, true]) {
      const ch = cena('ot_p90', {}, { flipHand });
      const abertura = modelo(ch).openings[0]!;
      expect(abertura.kind).toBe('side');
      expect(abertura.hingeT).toBeCloseTo(flipHand ? 0.411 : -0.411, 9);
      expect(abertura.latchT).toBeCloseTo(flipHand ? -0.411 : 0.411, 9);
      expect(abertura.radius).toBeCloseTo(2 * 0.411, 9);
      const hf = folha(modelo(ch).parts);
      const motion = hf.motion;
      if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('folha sem giro em z');
      expect(motion.t).toBeCloseTo(flipHand ? 0.411 : -0.411, 9);
    }
  });

  it('flipFacing troca o lado s da folha e da abertura', () => {
    const c1 = cena('ot_p90', {}, { flipFacing: false });
    const c2 = cena('ot_p90', {}, { flipFacing: true });
    const f1 = folha(modelo(c1).parts);
    const f2 = folha(modelo(c2).parts);
    expect(Math.sign((f1.box.s0 + f1.box.s1) / 2)).toBe(1);
    expect(Math.sign((f2.box.s0 + f2.box.s1) / 2)).toBe(-1);
    expect(modelo(c1).openings[0]!.side).toBe(1);
    expect(modelo(c2).openings[0]!.side).toBe(-1);
  });

  it('a folha fechada não tem volume em comum com ombreira, batedor ou travessa', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const m = modelo(cena('ot_p90', {}, { flipHand, flipFacing }));
        const f = folha(m.parts);
        for (const p of m.parts) {
          if (p.role !== 'jamb' && p.role !== 'stop' && p.role !== 'head') continue;
          expect(volumeComum(f.box, p.box), `${p.id} hand=${flipHand} facing=${flipFacing}`).toBe(false);
        }
      }
    }
  });

  it('a folha fica dentro do vão em t e z', () => {
    const c = cena('ot_p90');
    const f = folha(modelo(c).parts);
    expect(f.box.t0).toBeGreaterThanOrEqual(-c.g.width / 2 - 1e-9);
    expect(f.box.t1).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
    expect(f.box.z0).toBeGreaterThanOrEqual(0);
    expect(f.box.z1).toBeLessThanOrEqual(c.g.height + 1e-9);
  });

  it('peças de batente ficam dentro do núcleo e do vão', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_p90', {}, { flipHand, flipFacing });
        const m = modelo(c);
        expect(m.core.s1 - m.core.s0).toBeCloseTo(0.14, 9);
        for (const p of m.parts.filter((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head')) {
          expect(p.box.s0, p.id).toBeGreaterThanOrEqual(m.core.s0 - 1e-9);
          expect(p.box.s1, p.id).toBeLessThanOrEqual(m.core.s1 + 1e-9);
          expect(Math.abs(p.box.t0), p.id).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
          expect(Math.abs(p.box.t1), p.id).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
          expect(p.box.z0, p.id).toBeGreaterThanOrEqual(0);
          expect(p.box.z1, p.id).toBeLessThanOrEqual(c.g.height + 1e-9);
        }
      }
    }
  });

  it('ids únicos e determinismo (comparação profunda)', () => {
    const c = cena('ot_p90');
    const a = modelo(c);
    const b = modelo(c);
    expect(a).toEqual(b);
    expect(new Set(a.parts.map((x) => x.id)).size).toBe(a.parts.length);
  });
});

describe('buildOpeningModel: estilos de batente da porta de giro', () => {
  it('simple: caixa única J×D, sem batedor; folha centrada em s', () => {
    const c = cena('ot_p90', { frameStyle: 'simple' });
    const m = modelo(c);
    expect(de(m.parts, 'stop')).toHaveLength(0);
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'head')).toHaveLength(1);
    const f = folha(m.parts);
    expect((f.box.s0 + f.box.s1) / 2).toBeCloseTo(0, 9);
    expect(f.box.z1).toBeCloseTo(c.g.height - 0.05 - 0.004, 9);
  });

  it('aduela: batente de 0,03 m de largura e profundidade do núcleo inteiro', () => {
    const c = cena('ot_p90', { frameStyle: 'aduela' });
    const m = modelo(c);
    const jamb = de(m.parts, 'jamb')[0]!;
    const stop = de(m.parts, 'stop')[0]!;
    const larguraTotal = Math.max(jamb.box.t1, stop.box.t1) - Math.min(jamb.box.t0, stop.box.t0);
    expect(larguraTotal).toBeCloseTo(0.03, 9);
    expect(jamb.box.s1 - jamb.box.s0).toBeCloseTo(0.14, 9);
    expect(de(m.parts, 'stop')).toHaveLength(3);
  });

  it('block: sem batente, folha ocupa |t| ≤ hw − gap e articula em ±(hw − gap)', () => {
    const c = cena('ot_p90', { frameStyle: 'block' });
    const m = modelo(c);
    expect(m.parts.filter((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head')).toHaveLength(0);
    const f = folha(m.parts);
    expect(f.box.t0).toBeCloseTo(-(c.g.width / 2 - 0.004), 9);
    expect(f.box.t1).toBeCloseTo(c.g.width / 2 - 0.004, 9);
    expect(m.openings[0]!.hingeT).toBeCloseTo(-(c.g.width / 2 - 0.004), 9);
  });
});

describe('buildOpeningModel: porta dupla, pivotante, correr e vão livre', () => {
  it('dupla: duas folhas de lh − 0,002, dobradiças em ±lh e dois itens de abertura', () => {
    const c = cena('ot_p160');
    const m = modelo(c);
    const folhas = de(m.parts, 'leaf');
    expect(folhas).toHaveLength(2);
    for (const f of folhas) expect(largura(f.box)).toBeCloseTo(0.761 - 0.002, 9);
    expect(m.openings).toHaveLength(2);
    expect(m.openings.map((x) => x.hingeT).sort((a, b) => a - b)).toEqual([-0.761, 0.761]);
    expect(m.openings.every((x) => x.kind === 'side' && x.side === 1)).toBe(true);
  });

  it('pivotante: folha inteira, eixo a W/4 da ombreira da dobradiça e raio 3·hw/2', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_pp80', {}, { flipHand, flipFacing });
        const m = modelo(c);
        const f = folha(m.parts);
        expect(largura(f.box)).toBeCloseTo(2 * 0.361, 9);
        const a = m.openings[0]!;
        expect(a.kind).toBe('pivot');
        expect(a.hingeT).toBeCloseTo((flipHand ? 1 : -1) * (c.g.width / 4), 9);
        expect(a.radius).toBeCloseTo((3 * c.g.width) / 4, 9);
        expect(a.side).toBe(flipFacing ? -1 : 1);
      }
    }
  });

  it('correr: batente sem batedor, dois trilhos, duas folhas em pistas opostas e uma móvel', () => {
    const c = cena('ot_pc160');
    const m = modelo(c);
    expect(de(m.parts, 'stop')).toHaveLength(0);
    expect(de(m.parts, 'track')).toHaveLength(2);
    const folhas = de(m.parts, 'leaf');
    expect(folhas).toHaveLength(2);
    for (const f of folhas) {
      expect(largura(f.box)).toBeCloseTo(0.78, 9);
      expect(f.box.s1 - f.box.s0).toBeCloseTo(0.04, 9);
    }
    expect(Math.abs(folhas[0]!.box.s0 - folhas[1]!.box.s0)).toBeGreaterThan(0.02);
    const movel = folhas.find((f) => f.motion?.kind === 'slide' && (f.motion.dt !== 0 || f.motion.travel > 0));
    if (!movel || movel.motion?.kind !== 'slide') throw new Error('sem folha móvel');
    expect(Math.abs(movel.motion.dt)).toBe(1);
    expect(movel.motion.travel).toBeCloseTo(0.72, 9);
  });

  it('vão livre: void = true e nenhuma peça de batente, folha ou vidro', () => {
    const c = cena('ot_vao90');
    const m = modelo(c);
    expect(m.void).toBe(true);
    expect(m.parts.some((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head' || x.role === 'leaf' || x.role === 'glass')).toBe(false);
    expect(m.openings).toHaveLength(0);
  });
});

describe('buildOpeningModel: janelas', () => {
  it('fixa: caixilho, vidro no vão interno e item kind fixed', () => {
    const c = cena('ot_jfixa60');
    const m = modelo(c);
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'head')).toHaveLength(1);
    expect(de(m.parts, 'sillFrame')).toHaveLength(1);
    expect(de(m.parts, 'glass')).toHaveLength(1);
    expect(de(m.parts, 'leaf')).toHaveLength(0);
    const g = de(m.parts, 'glass')[0]!;
    expect(largura(g.box)).toBeCloseTo(0.5, 9);
    expect(g.box.z0).toBeCloseTo(0.05, 9);
    expect(g.box.z1).toBeCloseTo(0.55, 9);
    expect(m.openings[0]!.kind).toBe('fixed');
  });

  it('maxim-ar: moldura de folha com vidro, eixo no topo e kind top', () => {
    const c = cena('ot_j60');
    const m = modelo(c);
    expect(de(m.parts, 'leaf')).toHaveLength(4);
    expect(de(m.parts, 'glass')).toHaveLength(1);
    const a = m.openings[0]!;
    expect(a.kind).toBe('top');
    const folha = de(m.parts, 'leaf')[0]!;
    const motion = folha.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('maxim-ar sem giro em t');
    expect(motion.z).toBeCloseTo(c.g.height - 0.05, 9);
    expect(motion.s).toBeCloseTo(0, 9);
    expect(motion.sign).toBe(1);
  });

  it('basculante: eixo na base e kind bottom', () => {
    const c = cena('ot_j60', { plan: 'tilt' });
    const m = modelo(c);
    expect(m.openings[0]!.kind).toBe('bottom');
    const motion = de(m.parts, 'leaf')[0]!.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('basculante sem giro em t');
    expect(motion.z).toBeCloseTo(0.05, 9);
    expect(motion.sign).toBe(-1);
  });

  it('correr 2 e 3 folhas: folhas em pistas defasadas, trilhos e itens de correr', () => {
    for (const [id, n] of [
      ['ot_j120', 2],
      ['ot_j240', 3],
    ] as const) {
      const c = cena(id);
      const m = modelo(c);
      expect(de(m.parts, 'glass'), id).toHaveLength(n);
      expect(de(m.parts, 'leaf'), id).toHaveLength(4 * n);
      expect(de(m.parts, 'track'), id).toHaveLength(2);
      expect(m.openings.filter((x) => x.kind === 'slide'), id).toHaveLength(n);
      const vidros = de(m.parts, 'glass');
      const sCenters = vidros.map((x) => (x.box.s0 + x.box.s1) / 2);
      expect(new Set(sCenters.map((x) => Math.round(x * 1000))).size, id).toBe(n);
    }
  });

  it('vão livre de janela: só a soleira, sem batente, folha ou vidro', () => {
    const c = cena('ot_jv120');
    const m = modelo(c);
    expect(m.void).toBe(true);
    expect(de(m.parts, 'sillFrame')).toHaveLength(1);
    expect(m.parts.some((x) => x.role === 'jamb' || x.role === 'head' || x.role === 'leaf' || x.role === 'glass')).toBe(false);
    expect(m.openings).toHaveLength(0);
  });
});

describe('buildOpeningModel: detalhes (estilo, maçaneta, grade, bandeiras, alizar, peitoril e vergas)', () => {
  it('leafStyle panel: quatro almofadas em relevo de 0,006 nas duas faces', () => {
    const c = cena('ot_p90', { leafStyle: 'panel' });
    const m = modelo(c);
    const paineis = de(m.parts, 'leafPanel');
    expect(paineis).toHaveLength(4);
    const f = folha(m.parts);
    for (const p of paineis) {
      expect(p.box.s0).toBeCloseTo(f.box.s0 - 0.006, 9);
      expect(p.box.s1).toBeCloseTo(f.box.s1 + 0.006, 9);
    }
  });

  it('maçaneta lever padrão da porta de giro: roseta e haste nas duas faces', () => {
    const m = modelo(cena('ot_p90'));
    const handles = de(m.parts, 'handle');
    expect(handles).toHaveLength(4);
    expect(handles.every((x) => x.leaf === 0 && x.motion)).toBe(true);
    const rosetas = handles.filter((x) => x.id.includes('rosette'));
    expect(rosetas).toHaveLength(2);
    for (const r of rosetas) {
      expect(r.box.s1 - r.box.s0).toBeCloseTo(0.012, 9);
      expect(r.box.t1 - r.box.t0).toBeCloseTo(0.05, 9);
      expect(Math.abs((r.box.z0 + r.box.z1) / 2 - 1)).toBeLessThan(1e-9);
    }
  });

  it('maçaneta knob e pull respeitam a forma e o lado', () => {
    const knob = modelo(cena('ot_p90', { handle: 'knob' }));
    expect(de(knob.parts, 'handle')).toHaveLength(2);
    for (const k of de(knob.parts, 'handle')) expect(k.box.t1 - k.box.t0).toBeCloseTo(0.05, 9);
    const pull = modelo(cena('ot_p90', { handle: 'pull' }));
    const barra = de(pull.parts, 'handle')[0]!;
    expect(barra.box.z1 - barra.box.z0).toBeCloseTo(0.4, 9);
    expect(barra.box.s0).toBeGreaterThan(0);
  });

  it('grid 2×2 na janela fixa: um montante vertical e um horizontal', () => {
    const c = cena('ot_jfixa60', { grid: { cols: 2, rows: 2 } });
    const m = modelo(c);
    const muntins = de(m.parts, 'muntin');
    expect(muntins).toHaveLength(2);
    const vertical = muntins.find((x) => x.box.t1 - x.box.t0 < x.box.z1 - x.box.z0)!;
    const horizontal = muntins.find((x) => x.box.z1 - x.box.z0 < x.box.t1 - x.box.t0)!;
    expect(vertical).toBeDefined();
    expect(horizontal).toBeDefined();
  });

  it('bandeira superior: travessa e vidro fixo acima; a folha desce e não gera item', () => {
    const c = cena('ot_p90', { transom: { height: 0.3 } });
    const m = modelo(c);
    const barra = m.parts.find((x) => x.id === 'transom-bar')!;
    const vidro = m.parts.find((x) => x.id === 'transom-glass')!;
    expect(barra).toBeDefined();
    expect(vidro).toBeDefined();
    expect(vidro.box.z1).toBeCloseTo(c.g.height - 0.05, 9);
    expect(barra.box.z0).toBeCloseTo(c.g.height - 0.05 - 0.3 - 0.04, 9);
    expect(folha(m.parts).box.z1).toBeLessThan(barra.box.z0);
    expect(m.openings).toHaveLength(1);
  });

  it('bandeiras laterais: vidro fixo e montante de 0,04; a folha diminui e não gera item', () => {
    const base = modelo(cena('ot_p90'));
    const c = cena('ot_p90', { sidelights: { left: true, right: true, width: 0.2 } });
    const m = modelo(c);
    expect(m.parts.filter((x) => x.id.startsWith('sidelight-glass'))).toHaveLength(2);
    const mullions = m.parts.filter((x) => x.id.startsWith('sidelight-mullion'));
    expect(mullions).toHaveLength(2);
    for (const x of mullions) expect(x.box.t1 - x.box.t0).toBeCloseTo(0.04, 9);
    expect(largura(folha(m.parts).box)).toBeLessThan(largura(folha(base.parts).box));
    expect(m.openings).toHaveLength(1);
  });

  it('alizar: 3 peças por face na porta e 4 na janela, encostadas nas faces', () => {
    const porta = modelo(cena('ot_p90', { casing: { width: 0.05, thickness: 0.015 } }));
    expect(de(porta.parts, 'casing')).toHaveLength(6);
    const janela = modelo(cena('ot_j120', { casing: { width: 0.05, thickness: 0.015 } }));
    expect(de(janela.parts, 'casing')).toHaveLength(8);
    for (const x of de(janela.parts, 'casing')) {
      expect(Math.min(Math.abs(x.box.s0), Math.abs(x.box.s1))).toBeGreaterThanOrEqual(0.184 / 2 - 1e-9);
    }
  });

  it('peitoril saliente só em janela: projeta além das duas faces', () => {
    const m = modelo(cena('ot_j120', { sillBoard: { projection: 0.03, thickness: 0.02 } }));
    const s = de(m.parts, 'sillBoard');
    expect(s).toHaveLength(1);
    expect(s[0]!.box.t1 - s[0]!.box.t0).toBeCloseTo(1.2 + 0.06, 9);
    expect(s[0]!.box.s1 - s[0]!.box.s0).toBeCloseTo(0.184 + 0.06, 9);
    expect(s[0]!.box.z0).toBeCloseTo(-0.02, 9);
    const porta = modelo(cena('ot_p90', { sillBoard: { projection: 0.03, thickness: 0.02 } }));
    expect(de(porta.parts, 'sillBoard')).toHaveLength(0);
  });

  it('verga e contraverga de concreto com transpasse, fora do vão', () => {
    const m = modelo(cena('ot_p90', { lintel: {}, sillBeam: { over: 0.2, height: 0.25 } }));
    const verga = de(m.parts, 'lintel')[0]!;
    const contra = de(m.parts, 'sillBeam')[0]!;
    expect(verga.material).toBe('concrete');
    expect(verga.box.t1 - verga.box.t0).toBeCloseTo(0.9 + 0.6, 9);
    expect(verga.box.z0).toBeCloseTo(2.1, 9);
    expect(contra.box.t1 - contra.box.t0).toBeCloseTo(0.9 + 0.4, 9);
    expect(contra.box.z1).toBeCloseTo(0, 9);
  });
});

describe('buildOpeningModel: as dez famílias nas quatro combinações', () => {
  const familias: Array<{ nome: string; base: string; extra?: Partial<OpeningType> }> = [
    { nome: 'porta de giro', base: 'ot_p90' },
    { nome: 'porta dupla', base: 'ot_p160' },
    { nome: 'porta de correr', base: 'ot_pc160' },
    { nome: 'porta pivotante', base: 'ot_pp80' },
    { nome: 'vão de porta', base: 'ot_vao90' },
    { nome: 'janela fixa', base: 'ot_jfixa60' },
    { nome: 'janela basculante', base: 'ot_j60', extra: { plan: 'tilt' } },
    { nome: 'janela maxim-ar', base: 'ot_j60' },
    { nome: 'janela de correr 2', base: 'ot_j120' },
    { nome: 'janela de correr 3', base: 'ot_j240' },
    { nome: 'vão de janela', base: 'ot_jv120' },
  ];

  it('ids únicos e estáveis, caixas válidas e nada fora do vão exceto os acabamentos', () => {
    const permitidosFora = new Set<OpeningPart['role']>(['casing', 'sillBoard', 'lintel', 'sillBeam']);
    const deBatente = new Set<OpeningPart['role']>(['jamb', 'stop', 'head', 'sillFrame', 'track']);
    for (const familia of familias) {
      for (const flipHand of [false, true]) {
        for (const flipFacing of [false, true]) {
          const c = cena(familia.base, familia.extra ?? {}, { flipHand, flipFacing });
          const m = modelo(c);
          const caso = `${familia.nome} hand=${flipHand} facing=${flipFacing}`;
          expect(new Set(m.parts.map((x) => x.id)).size, caso).toBe(m.parts.length);
          expect(m.parts.map((x) => x.id)).toEqual(modelo(c).parts.map((x) => x.id));
          expect(m, caso).toEqual(modelo(c));
          const batente = m.parts.filter((x) => x.role === 'jamb' || x.role === 'stop' || x.role === 'head');
          for (const folhaPart of m.parts.filter((x) => x.role === 'leaf')) {
            for (const b of batente) expect(volumeComum(folhaPart.box, b.box), `${caso} ${folhaPart.id} × ${b.id}`).toBe(false);
          }
          for (const p of m.parts) {
            expect(p.box.t1 - p.box.t0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(p.box.s1 - p.box.s0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            expect(p.box.z1 - p.box.z0, `${caso} ${p.id}`).toBeGreaterThan(1e-9);
            if (!permitidosFora.has(p.role)) {
              expect(Math.abs(p.box.t0), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
              expect(Math.abs(p.box.t1), `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
              expect(p.box.z0, `${caso} ${p.id}`).toBeGreaterThanOrEqual(-1e-9);
              expect(p.box.z1, `${caso} ${p.id}`).toBeLessThanOrEqual(c.g.height + 1e-9);
            }
            if (deBatente.has(p.role)) {
              expect(p.box.s0, `${caso} ${p.id}`).toBeGreaterThanOrEqual(m.core.s0 - 1e-9);
              expect(p.box.s1, `${caso} ${p.id}`).toBeLessThanOrEqual(m.core.s1 + 1e-9);
            }
          }
        }
      }
    }
  });
});

describe('partTransformed, slicePartsAtZ e projectParts', () => {
  const media = (a: { t: number; s: number; z: number }, b: { t: number; s: number; z: number }) => ({
    t: (a.t + b.t) / 2,
    s: (a.s + b.s) / 2,
    z: (a.z + b.z) / 2,
  });

  it('folha de giro a π/2: centro vai para o lado side, a dobradiça fica e o comprimento se mantém', () => {
    for (const flipHand of [false, true]) {
      for (const flipFacing of [false, true]) {
        const c = cena('ot_p90', {}, { flipHand, flipFacing });
        const f = folha(modelo(c).parts);
        const motion = f.motion;
        if (!motion || motion.kind !== 'rotate' || motion.axis !== 'z') throw new Error('folha sem giro em z');
        const ob = partTransformed(f, { angle: Math.PI / 2, slide: 0 });
        const caso = `hand=${flipHand} facing=${flipFacing}`;
        expect(ob.center.t, caso).toBeCloseTo(motion.t, 9);
        expect(Math.sign(ob.center.s - motion.s), caso).toBe(flipFacing ? -1 : 1);
        expect(Math.abs(ob.center.s - motion.s), caso).toBeCloseTo((f.box.t1 - f.box.t0) / 2, 9);
        const hingeLeft = Math.abs(f.box.t0 - motion.t) < 1e-9;
        const [hi0, hi1, li0, li1] = hingeLeft ? [0, 3, 1, 2] : [1, 2, 0, 3];
        const hinge = media(ob.corners[hi0]!, ob.corners[hi1]!);
        expect(hinge.t, caso).toBeCloseTo(motion.t, 9);
        expect(hinge.s, caso).toBeCloseTo(motion.s, 9);
        expect(hinge.z, caso).toBeCloseTo(f.box.z0, 9);
        const latch = media(ob.corners[li0]!, ob.corners[li1]!);
        expect(Math.hypot(latch.t - hinge.t, latch.s - hinge.s), caso).toBeCloseTo(f.box.t1 - f.box.t0, 9);
      }
    }
  });

  it('maxim-ar: o eixo é o topo da folha e a folha aberta vai para side', () => {
    const c = cena('ot_j60');
    const m = modelo(c);
    const vidro = de(m.parts, 'glass')[0]!;
    const motion = vidro.motion;
    if (!motion || motion.kind !== 'rotate' || motion.axis !== 't') throw new Error('maxim-ar sem giro em t');
    expect(motion.z).toBeCloseTo(c.g.height - 0.05, 9);
    const ob = partTransformed(vidro, { angle: Math.PI / 2, slide: 0 });
    expect(ob.center.z).toBeCloseTo(motion.z, 9);
    expect(Math.sign(ob.center.s - motion.s)).toBe(c.g.flipFacing ? -1 : 1);
  });

  it('correr: a folha móvel desloca travel em t e continua dentro do vão', () => {
    const c = cena('ot_pc160');
    const m = modelo(c);
    const movel = de(m.parts, 'leaf').find((f) => f.motion?.kind === 'slide' && f.motion.travel > 0);
    if (!movel || movel.motion?.kind !== 'slide') throw new Error('sem folha móvel');
    const antes = partTransformed(movel, CLOSED);
    const depois = partTransformed(movel, { angle: 0, slide: 1 });
    expect(depois.center.t - antes.center.t).toBeCloseTo(movel.motion.dt * movel.motion.travel, 9);
    expect(depois.bounds.t0).toBeGreaterThanOrEqual(-c.g.width / 2 - 1e-9);
    expect(depois.bounds.t1).toBeLessThanOrEqual(c.g.width / 2 + 1e-9);
  });

  it('corte a 1,5 m da porta de giro: duas ombreiras (corpo e batedor, 4 anéis) e a folha', () => {
    const m = modelo(cena('ot_p90'));
    const corte = slicePartsAtZ(m, 1.5, CLOSED);
    expect(corte.filter((x) => x.part.role === 'jamb' || x.part.role === 'stop')).toHaveLength(4);
    expect(corte.some((x) => x.part.role === 'head')).toBe(false);
    const f = corte.find((x) => x.part.role === 'leaf')!;
    const ts = f.ring.map((p) => p.t);
    const ss = f.ring.map((p) => p.s);
    expect(Math.max(...ts) - Math.min(...ts)).toBeCloseTo(2 * 0.411, 9);
    expect(Math.max(...ss) - Math.min(...ss)).toBeCloseTo(0.04, 9);
  });

  it('corte a 2,3 m devolve só a verga quando o tipo tem', () => {
    const m = modelo(cena('ot_p90', { lintel: { height: 0.2 } }));
    const corte = slicePartsAtZ(m, 2.3, CLOSED);
    expect(corte).toHaveLength(1);
    expect(corte[0]!.part.role).toBe('lintel');
  });

  it('elevação (axis s): retângulos de batente, folha, vidro e maçaneta', () => {
    const proj = projectParts(modelo(cena('ot_p90', { leafStyle: 'glass' })), 's', CLOSED);
    const roles = new Set(proj.map((x) => x.part.role));
    for (const r of ['jamb', 'stop', 'head', 'leaf', 'glass', 'handle'] as const) expect(roles.has(r), r).toBe(true);
    for (const x of proj) expect(x.ring, x.part.id).toHaveLength(4);
  });

  it('elevação: leafStyle panel devolve as 4 almofadas', () => {
    const proj = projectParts(modelo(cena('ot_p90', { leafStyle: 'panel' })), 's', CLOSED);
    expect(proj.filter((x) => x.part.role === 'leafPanel')).toHaveLength(4);
  });

  it('elevação: grid 2×2 na janela fixa devolve 1 montante vertical e 1 horizontal', () => {
    const proj = projectParts(modelo(cena('ot_jfixa60', { grid: { cols: 2, rows: 2 } })), 's', CLOSED);
    const muntins = proj.filter((x) => x.part.role === 'muntin');
    expect(muntins).toHaveLength(2);
    const dimensoes = muntins.map((x) => {
      const us = x.ring.map((p) => p.u);
      const zs = x.ring.map((p) => p.z);
      return { w: Math.max(...us) - Math.min(...us), h: Math.max(...zs) - Math.min(...zs) };
    });
    expect(dimensoes.filter((d) => d.w < d.h)).toHaveLength(1);
    expect(dimensoes.filter((d) => d.h < d.w)).toHaveLength(1);
  });

  it('corte transversal (axis t) devolve anéis em (s, z) e profundidade ordenável', () => {
    const proj = projectParts(modelo(cena('ot_p90')), 't', CLOSED);
    const folhaProj = proj.find((x) => x.part.role === 'leaf')!;
    const ss = folhaProj.ring.map((p) => p.u);
    expect(Math.max(...ss) - Math.min(...ss)).toBeCloseTo(0.04, 9);
    expect(Number.isFinite(folhaProj.depth)).toBe(true);
  });
});

describe('buildOpeningModel: geometria do batente no núcleo', () => {
  it('profundidade do batente limitada ao núcleo (DEC-1): D = 0,09 < 0,14', () => {
    const c = cena('ot_p90');
    const m = modelo(c);
    const f = frameOfWall(c.p, 'w')!;
    const core = coreSpan(f.type);
    const fr = openingFrame(c.t, core.to - core.from);
    expect(fr.frameDepth).toBeCloseTo(0.09, 9);
    const jamb = de(m.parts, 'jamb')[0]!;
    expect(jamb.box.s1 - jamb.box.s0).toBeCloseTo(0.09, 9);
  });

  it('cada ombreira tem corpo e batedor; a travessa tem o batedor embaixo do corpo', () => {
    const m = modelo(cena('ot_p90'));
    expect(de(m.parts, 'jamb')).toHaveLength(2);
    expect(de(m.parts, 'stop')).toHaveLength(3);
    expect(de(m.parts, 'head')).toHaveLength(1);
    const head = de(m.parts, 'head')[0]!;
    const stopHead = m.parts.find((x) => x.id === 'stop-head')!;
    expect(stopHead.box.z1).toBeCloseTo(head.box.z0, 9);
    expect(altura(head.box)).toBeLessThan(0.05);
  });
});
