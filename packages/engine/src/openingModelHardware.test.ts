import { describe, expect, it } from 'vitest';
import { createEmptyProject, makeWall, ProjectStore, type Opening, type OpeningType, type Project } from '@hestia/model';
import { frameOfWall, openingGeometry } from './resolve.ts';
import type { OpeningGeometry } from './types.ts';
import { buildOpeningModel } from './openingModel.ts';
import { openingPlanPaths } from './openingPlan.ts';
import type { OpeningModel, OpeningPart } from './openingModelTypes.ts';

/** Parede de 4 m com um vão no meio; `extra` completa o tipo base antes de inseri-lo (como em `openingModel.test.ts`). */
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
/** Modelo com o tipo trocado por `extra` (sem passar pelo comando, que recusaria o valor fora da faixa). */
const modeloCom = (c: ReturnType<typeof cena>, extra: Partial<OpeningType>): OpeningModel => {
  const p: Project = { ...c.p, openingTypes: { ...c.p.openingTypes, ot_x: { ...c.t, ...extra } } };
  return buildOpeningModel(p, c.o, c.g, c.f);
};
const de = (parts: OpeningPart[], role: OpeningPart['role']): OpeningPart[] => parts.filter((x) => x.role === role);
const centroZ = (b: { z0: number; z1: number }): number => (b.z0 + b.z1) / 2;
const centroT = (b: { t0: number; t1: number }): number => (b.t0 + b.t1) / 2;

describe('dobradiças da porta de giro', () => {
  it('padrão 3, fixas (sem movimento), a 0,25 m das bordas da folha e uma no meio', () => {
    const m = modelo(cena('ot_p90'));
    const folha = m.parts.find((x) => x.role === 'leaf' && x.leaf === 0)!;
    const dobradicas = de(m.parts, 'hinge');
    expect(dobradicas).toHaveLength(3);
    expect(dobradicas.every((x) => x.motion === undefined && x.leaf === undefined)).toBe(true);
    const z = dobradicas.map((x) => centroZ(x.box)).sort((a, b) => a - b);
    expect(z[0]).toBeCloseTo(folha.box.z0 + 0.25, 9);
    expect(z[1]).toBeCloseTo((folha.box.z0 + folha.box.z1) / 2, 9);
    expect(z[2]).toBeCloseTo(folha.box.z1 - 0.25, 9);
  });

  it('fica na junta do lado da dobradiça (eixo da folha), e troca de lado com o flipHand', () => {
    const esquerda = de(modelo(cena('ot_p90')).parts, 'hinge');
    const direita = de(modelo(cena('ot_p90', {}, { flipHand: true })).parts, 'hinge');
    for (const x of esquerda) expect(centroT(x.box)).toBeCloseTo(-0.411, 2);
    for (const x of direita) expect(centroT(x.box)).toBeCloseTo(0.411, 2);
  });

  it('quantidade do tipo: 0 não desenha; 2 ficam nas bordas; ids únicos', () => {
    expect(de(modelo(cena('ot_p90', { hinges: 0 })).parts, 'hinge')).toHaveLength(0);
    const dois = de(modelo(cena('ot_p90', { hinges: 2 })).parts, 'hinge');
    expect(dois).toHaveLength(2);
    const folha = modelo(cena('ot_p90', { hinges: 2 })).parts.find((x) => x.role === 'leaf')!;
    const zs = dois.map((x) => centroZ(x.box)).sort((a, b) => a - b);
    expect(zs[0]).toBeCloseTo(folha.box.z0 + 0.25, 9);
    expect(zs[1]).toBeCloseTo(folha.box.z1 - 0.25, 9);
    expect(new Set(dois.map((x) => x.id)).size).toBe(2);
  });

  it('dupla: três dobradiças por folha, uma em cada ombreira', () => {
    const m = modelo(cena('ot_p160'));
    const dobradicas = de(m.parts, 'hinge');
    expect(dobradicas).toHaveLength(6);
    const esquerda = dobradicas.filter((x) => centroT(x.box) < 0);
    const direita = dobradicas.filter((x) => centroT(x.box) > 0);
    expect(esquerda).toHaveLength(3);
    expect(direita).toHaveLength(3);
  });

  it('pivotante, correr e vão livre não têm dobradiça de batente (a tabela não as oferece)', () => {
    expect(de(modelo(cena('ot_pp80')).parts, 'hinge')).toHaveLength(0);
    expect(de(modelo(cena('ot_pc160')).parts, 'hinge')).toHaveLength(0);
    expect(de(modelo(cena('ot_vao90')).parts, 'hinge')).toHaveLength(0);
  });

  it('vai-e-vem sem dobradiça de batente, como a pivotante (d6ce597: a folha gira no pivô de piso)', () => {
    const m = modelo(cena('ot_pvv90'));
    expect(de(m.parts, 'hinge')).toHaveLength(0);
  });
});

describe('soleira da porta', () => {
  it('padrão sem soleira: nenhuma peça de soleira e a folha sobe só a folga de 7 mm', () => {
    const m = modelo(cena('ot_p90'));
    expect(de(m.parts, 'threshold')).toHaveLength(0);
    expect(m.parts.find((x) => x.role === 'leaf')!.box.z0).toBeCloseTo(0.007, 9);
  });

  it('com soleira de 15 mm: prisma sob a folha entre as ombreiras, na profundidade do batente', () => {
    const c = cena('ot_p90', { threshold: { thickness: 0.015 } });
    const m = modelo(c);
    const [sill] = de(m.parts, 'threshold');
    expect(sill).toBeDefined();
    expect(sill!.box.z0).toBeCloseTo(0, 9);
    expect(sill!.box.z1).toBeCloseTo(0.015, 9);
    const jamb = m.parts.find((x) => x.role === 'jamb')!;
    expect(sill!.box.s0).toBeCloseTo(jamb.box.s0, 9);
    expect(sill!.box.s1).toBeCloseTo(jamb.box.s1, 9);
    // ot_p90: vão de 0,90 m (hw 0,45) e batente de 5 cm: a soleira vai entre as ombreiras, de −0,40 a 0,40.
    expect(sill!.box.t0).toBeCloseTo(-0.4, 6);
    expect(sill!.box.t1).toBeCloseTo(0.4, 6);
    // A folha sobe da soleira pela folga: face inferior em 15 mm + 7 mm.
    expect(m.parts.find((x) => x.role === 'leaf')!.box.z0).toBeCloseTo(0.022, 9);
  });

  it('a soleira vale para correr e embutir, e não para janela, vão livre nem portão', () => {
    expect(de(modelo(cena('ot_pc160', { threshold: { thickness: 0.015 } })).parts, 'threshold')).toHaveLength(1);
    expect(de(modelo(cena('ot_pe80', { threshold: { thickness: 0.015 } })).parts, 'threshold')).toHaveLength(1);
    expect(de(modelo(cena('ot_j120', { threshold: { thickness: 0.015 } })).parts, 'threshold')).toHaveLength(0);
    expect(de(modelo(cena('ot_vao90', { threshold: { thickness: 0.015 } })).parts, 'threshold')).toHaveLength(0);
    expect(de(modelo(cena('ot_pg300', { threshold: { thickness: 0.015 } })).parts, 'threshold')).toHaveLength(0);
  });

  it('espessura zero ou fora da faixa (0 a 15 cm) não desenha a soleira', () => {
    expect(de(modelo(cena('ot_p90', { threshold: { thickness: 0 } })).parts, 'threshold')).toHaveLength(0);
    // Acima de 15 cm o comando recusa o tipo; o motor, se receber o valor, não desenha.
    expect(de(modeloCom(cena('ot_p90'), { threshold: { thickness: 0.2 } }).parts, 'threshold')).toHaveLength(0);
  });
});

describe('folga inferior da folha', () => {
  it('leafUndercut troca a face inferior da folha: 17 mm para piso úmido', () => {
    const m = modelo(cena('ot_p90', { leafUndercut: 0.017 }));
    expect(m.parts.find((x) => x.role === 'leaf')!.box.z0).toBeCloseTo(0.017, 9);
  });

  it('vale para correr e embutir (a folha não encosta no piso)', () => {
    expect(modelo(cena('ot_pc160', { leafUndercut: 0.017 })).parts.filter((x) => x.role === 'leaf').every((x) => Math.abs(x.box.z0 - 0.017) < 1e-9)).toBe(true);
    expect(modelo(cena('ot_pe80', { leafUndercut: 0.027 })).parts.find((x) => x.role === 'leaf')!.box.z0).toBeCloseTo(0.027, 9);
  });

  it('o portão seccionado mantém a folga antiga (fora da tabela da folga)', () => {
    const m = modelo(cena('ot_pg300', { leafUndercut: 0.027 }));
    expect(m.parts.find((x) => x.role === 'leaf')!.box.z0).toBeCloseTo(0.008, 9);
  });
});

describe('maçaneta: altura e recuo do tipo; placa da fechadura', () => {
  it('altura 0,90 m e recuo 0,10 m: a roseta e a haste ficam nesse eixo', () => {
    // Sem flipHand: o trinco fica em t = +0,411; a maçaneta sai 0,10 m para dentro dele.
    const m = modelo(cena('ot_p90', { handleHeight: 0.9, handleInset: 0.1 }));
    const rosetas = de(m.parts, 'handle').filter((x) => x.id.includes('rosette'));
    expect(rosetas).toHaveLength(2);
    for (const r of rosetas) {
      expect(centroZ(r.box)).toBeCloseTo(0.9, 9);
      expect(centroT(r.box)).toBeCloseTo(0.311, 6);
    }
  });

  it('a placa da fechadura fica 50 a 90 mm abaixo da maçaneta, no mesmo eixo, nas duas faces', () => {
    const m = modelo(cena('ot_p90', { handleHeight: 0.9, handleInset: 0.1 }));
    const travas = de(m.parts, 'handle').filter((x) => x.id.includes('lock'));
    expect(travas).toHaveLength(2);
    expect(new Set(travas.map((x) => x.id.slice(-1))).size).toBe(2);
    for (const l of travas) {
      expect(centroZ(l.box)).toBeCloseTo(0.9 - 0.07, 9);
      expect(centroT(l.box)).toBeCloseTo(0.311, 6);
      expect(l.box.z1).toBeLessThan(0.9 - 0.05 + 1e-9);
      expect(l.leaf).toBe(0);
      expect(l.motion).toBeDefined();
    }
  });

  it('botão tem placa; puxador e sem maçaneta não têm', () => {
    expect(de(modelo(cena('ot_p90', { handle: 'knob' })).parts, 'handle').filter((x) => x.id.includes('lock'))).toHaveLength(2);
    expect(de(modelo(cena('ot_p90', { handle: 'pull' })).parts, 'handle').filter((x) => x.id.includes('lock'))).toHaveLength(0);
    expect(de(modelo(cena('ot_p90', { handle: 'none' })).parts, 'handle')).toHaveLength(0);
  });

  it('altura inválida (fora de 0,50 a 1,50) cai no padrão de 1,00 m', () => {
    // Valor fora da faixa de erro não passa pelo comando (o tipo é recusado ao salvar): o motor recebe o tipo direto.
    const m = modeloCom(cena('ot_p90'), { handleHeight: 0.3 });
    const roseta = de(m.parts, 'handle').find((x) => x.id.includes('rosette'))!;
    expect(centroZ(roseta.box)).toBeCloseTo(1, 9);
  });
});

describe('soleira na planta', () => {
  const opcoes = (detail: 'low' | 'mid' | 'high') => ({
    detail,
    angle: 0,
    planDisplay: 'symbolic' as const,
    showSwing: true,
    swingStyle: 'arc' as const,
    cutZ: 1.1,
  });
  const traco = (m: OpeningModel, detail: 'low' | 'mid' | 'high') => openingPlanPaths(m, opcoes(detail)).filter((x) => x.role === 'threshold');

  it('médio e alto desenham a soleira entre as ombreiras (duas linhas); o baixo não', () => {
    const m = modelo(cena('ot_p90', { threshold: { thickness: 0.015 } }));
    expect(traco(m, 'low')).toHaveLength(0);
    for (const d of ['mid', 'high'] as const) {
      const linhas = traco(m, d);
      expect(linhas).toHaveLength(2);
      for (const l of linhas) {
        expect(l.pts[0]!.t).toBeCloseTo(-0.4, 6);
        expect(l.pts[1]!.t).toBeCloseTo(0.4, 6);
      }
    }
  });

  it('sem soleira não há traço; a família nova de embutir também desenha', () => {
    expect(traco(modelo(cena('ot_p90')), 'high')).toHaveLength(0);
    expect(traco(modelo(cena('ot_pe80', { threshold: { thickness: 0.015 } })), 'mid')).toHaveLength(2);
  });
});
