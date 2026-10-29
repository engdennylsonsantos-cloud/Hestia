import { beforeEach, describe, expect, it } from 'vitest';
import {
  createEmptyProject,
  dimensionSettingsOf,
  makeWall,
  ProjectStore,
  type DimensionSettings,
  type OpeningComposition,
  type Opening,
  type OpeningDimRef,
  type Project,
  type WallDimRef,
} from '@hestia/model';
import { clearDimProviders, registerBuiltinDimProviders, selectionDims } from '../registry.ts';
import type { DimContext, DimRef } from '../types.ts';
import { openingDimProvider, type OpeningDimSubject } from './opening.ts';

/**
 * Cena fixa: hospedeira `h` de (0,0) a (6,0) em alvenaria 14 (espessura 0,184: acabamento 0,092 de cada lado do eixo e
 * núcleo de 0,14, isto é, 0,07 de cada lado). Vizinhas `v1` em x = 1 e `v2` em x = 5 (mesma parede). Porta P-02 (0,80)
 * com centro em 3,00. Batente de 5 cm: meia-largura 0,40 (frame) e 0,35 (clear).
 */
function cena(extra: (s: ProjectStore) => void = () => undefined): Project {
  const s = new ProjectStore(createEmptyProject());
  const wall = (id: string, a: [number, number], b: [number, number]) =>
    s.exec({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } }) });
  wall('h', [0, 0], [6, 0]);
  wall('v1', [1, 0], [1, 3]);
  wall('v2', [5, 0], [5, -3]);
  s.exec({ type: 'addOpening', opening: { id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'h', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  extra(s);
  return s.project;
}

const ctxOf = (p: Project, dims?: DimensionSettings, overrides: Record<string, DimRef> = {}): DimContext => {
  const q: Project = dims ? { ...p, settings: { ...p.settings, dimensions: dims } } : p;
  return { project: q, levelId: 'lv_0', settings: dimensionSettingsOf(q), overrides };
};

const subject = (over: Partial<OpeningDimSubject> = {}): OpeningDimSubject => ({ hostId: 'h', offset: 3, typeId: 'ot_p80', flipFacing: false, id: 'd1', side: 1, ...over });

// Alvos (t) da parede vizinha por referência, calculados à mão: eixo 1 e 5; face acabada ±0,092; núcleo ±0,07.
const ESQ: Record<WallDimRef, number> = { axis: 1, finish: 1.092, coreCenter: 1, coreFace: 1.07 };
const DIR: Record<WallDimRef, number> = { axis: 5, finish: 4.908, coreCenter: 5, coreFace: 4.93 };
const BORDA: Record<OpeningDimRef, number> = { center: 0, clear: 0.35, frame: 0.4, casing: 0.4 };

describe('provedor da esquadria', () => {
  beforeEach(() => clearDimProviders());

  for (const w of Object.keys(ESQ) as WallDimRef[]) {
    for (const o of Object.keys(BORDA) as OpeningDimRef[]) {
      it(`valores com parede=${w} e esquadria=${o}`, () => {
        const [esq, dir] = openingDimProvider.compute(ctxOf(cena(), { wallRef: w, openingRef: o }), subject());
        expect(esq!.value).toBeCloseTo(3 - BORDA[o] - ESQ[w], 6);
        expect(dir!.value).toBeCloseTo(DIR[w] - (3 + BORDA[o]), 6);
        expect(esq!.ends[0]).toMatchObject({ kind: 'wall', current: w, slot: 'wallLeft' });
        expect(esq!.ends[1]).toMatchObject({ kind: 'opening', current: o, slot: 'openLeft' });
        expect(esq!.ends[0].options).toHaveLength(4);
        expect(esq!.ends[1].options).toHaveLength(4);
      });
    }
  }

  it('geometria: a ponta da parede e a da esquadria ficam na face do lado da cota', () => {
    const [esq, dir] = openingDimProvider.compute(ctxOf(cena()), subject());
    // Padrão: face acabada × vão externo. Lado +1 = face de y = +0,092; linha de cota afastada para +n.
    expect(esq!.a.x).toBeCloseTo(1.092, 6);
    expect(esq!.b.x).toBeCloseTo(2.6, 6);
    expect(esq!.a.y).toBeCloseTo(0.092, 6);
    expect(esq!.offset).toBeGreaterThan(0);
    expect(dir!.a.x).toBeCloseTo(4.908, 6);
    expect(dir!.b.x).toBeCloseTo(3.4, 6);
    expect(dir!.offset).toBeLessThan(0);
    const [e2] = openingDimProvider.compute(ctxOf(cena()), subject({ side: -1 }));
    expect(e2!.a.y).toBeCloseTo(-0.092, 6);
    expect(e2!.offset).toBeLessThan(0);
  });

  it('sem vizinha a cota vai até a ponta da hospedeira', () => {
    const p = cena((s) => s.exec({ type: 'deleteElements', ids: ['v1', 'v2'] }));
    const [esq, dir] = openingDimProvider.compute(ctxOf(p), subject());
    expect(esq!.value).toBeCloseTo(2.6, 6);
    expect(dir!.value).toBeCloseTo(2.6, 6);
  });

  it('prévia (sem id): cotas só de leitura e chave de prévia', () => {
    const dims = openingDimProvider.compute(ctxOf(cena()), subject({ id: undefined }));
    expect(dims).toHaveLength(2);
    expect(dims.every((d) => d.edit === undefined)).toBe(true);
    expect(dims[0]!.key).toBe('opening:preview:left');
  });

  it('override de uma ponta troca só a referência daquela ponta', () => {
    const [esq, dir] = openingDimProvider.compute(ctxOf(cena(), undefined, { 'opening:wallLeft': 'axis', 'opening:openRight': 'center' }), subject());
    expect(esq!.value).toBeCloseTo(3 - 0.4 - 1, 6);
    expect(esq!.ends[0].current).toBe('axis');
    expect(dir!.value).toBeCloseTo(4.908 - 3, 6);
    expect(dir!.ends[1].current).toBe('center');
  });

  it('chave global troca todas as pontas de parede; a específica vence', () => {
    const [esq, dir] = openingDimProvider.compute(ctxOf(cena(), undefined, { 'opening:wall': 'coreFace', 'opening:wallRight': 'axis' }), subject());
    expect(esq!.ends[0].current).toBe('coreFace');
    expect(dir!.ends[0].current).toBe('axis');
  });

  it('lado da cota decide qual alizar conta', () => {
    const p = cena((s) => {
      const t = s.project.openingTypes['ot_p80']!;
      s.exec({ type: 'upsertOpeningType', openingType: { ...t, id: 'ot_c', casing: { width: 0.07, thickness: 0.015 } } });
      s.exec({ type: 'updateElements', ids: ['d1'], patch: { typeId: 'ot_c' } as Partial<Opening> });
    });
    const c = ctxOf(p, { openingRef: 'casing' });
    const [esq] = openingDimProvider.compute(c, subject({ typeId: 'ot_c' }));
    const [ref] = openingDimProvider.compute(ctxOf(p, { openingRef: 'frame' }), subject({ typeId: 'ot_c' }));
    // Alizar de 7 cm a partir da luz (0,35): borda em 0,42, mais o recuo de 14,5 mm no lado em que a folha abre (+1).
    expect(ref!.value).toBeCloseTo(3 - 0.4 - 1.092, 6);
    expect(esq!.value).toBeCloseTo(3 - 0.4345 - 1.092, 4);
    const [outro] = openingDimProvider.compute(c, subject({ typeId: 'ot_c', side: -1 }));
    expect(outro!.value).toBeCloseTo(3 - 0.42 - 1.092, 4);
  });

  it('porta com composição usa o vão externo do conjunto (frame), não a largura da folha', () => {
    // Composição de uma célula com folha: batente de 5 cm, nominal pela folha (0,90) + folgas = vão de 0,98.
    const comp: OpeningComposition = {
      version: 1,
      nominal: { ref: 'leaf', width: 0.9, height: 2.1, gap: { w: 0.08, h: 0.05 } },
      frame: { style: 'rebate', profile: { inline: { material: 'wood', section: 'rect_rebate', visibleWidth: 0.05, depth: 0.09, stopWidth: 0.015 } }, depthMode: 'core' },
      layout: { kind: 'cell', id: 'folha', content: { kind: 'leaf', family: 'door_swing', plan: 'swing', leaves: 1, options: {} } },
    };
    const base = cena();
    const t = base.openingTypes['ot_p90']!;
    const p: Project = { ...base, openingTypes: { ...base.openingTypes, ot_x: { ...t, id: 'ot_x', composition: comp } } };
    const [esq, dir] = openingDimProvider.compute(ctxOf(p, { wallRef: 'axis', openingRef: 'frame' }), { hostId: 'h', offset: 3, typeId: 'ot_x', flipFacing: false, id: 'd1', side: 1 });
    expect(esq!.value).toBeCloseTo(3 - 0.49 - 1, 6);
    expect(dir!.value).toBeCloseTo(5 - 3.49, 6);
  });
});

describe('edição (edit)', () => {
  const dimsDe = (p: Project, s = subject(), c = ctxOf(p)) => openingDimProvider.compute(c, s);

  it('esquerda: novo offset = alvo + medida + meia-largura', () => {
    const p = cena();
    const r = dimsDe(p)[0]!.edit!(1);
    expect(r).toEqual({ commands: [{ type: 'updateElements', ids: ['d1'], patch: { offset: expect.closeTo(1.092 + 1 + 0.4, 6) } }] });
  });

  it('direita: novo offset = alvo − medida − meia-largura', () => {
    const r = dimsDe(cena())[1]!.edit!(1.5);
    expect(r).toEqual({ commands: [{ type: 'updateElements', ids: ['d1'], patch: { offset: expect.closeTo(4.908 - 1.5 - 0.4, 6) } }] });
  });

  it('referência da esquadria no centro: offset = alvo + medida', () => {
    const c = ctxOf(cena(), { openingRef: 'center', wallRef: 'axis' });
    const r = dimsDe(cena(), subject(), c)[0]!.edit!(2);
    expect(r).toEqual({ commands: [{ type: 'updateElements', ids: ['d1'], patch: { offset: expect.closeTo(3, 6) } }] });
  });

  it('o comando aplicado deixa a cota com o valor digitado', () => {
    const s = new ProjectStore(cena());
    const r = dimsDe(s.project)[0]!.edit!(0.9);
    if (!('commands' in r)) throw new Error('esperava comandos');
    for (const cmd of r.commands) s.exec(cmd);
    const depois = openingDimProvider.selectionSubject!(s.project, 'd1')!;
    expect(openingDimProvider.compute(ctxOf(s.project), depois)[0]!.value).toBeCloseTo(0.9, 6);
  });

  it('fora da parede: porta sairia', () => {
    const r = dimsDe(cena())[1]!.edit!(5);
    expect(r).toEqual({ error: 'A porta P-02 sairia da parede.' });
  });

  it('sobrepõe outra esquadria', () => {
    const p = cena((s) =>
      s.exec({ type: 'addOpening', opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'h', offset: 4.2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } }),
    );
    const r = dimsDe(p)[0]!.edit!(2.708);
    expect(r).toEqual({ error: 'Sobrepõe a janela J-01.' });
  });

  it('atravessa a parede perpendicular', () => {
    const r = dimsDe(cena())[0]!.edit!(3.308);
    expect(r).toEqual({ error: 'Atravessa a parede perpendicular.' });
  });

  it('medida inválida (negativa ou NaN) é recusada e nada é emitido', () => {
    const d = dimsDe(cena())[0]!;
    expect('error' in d.edit!(-1)).toBe(true);
    expect('error' in d.edit!(Number.NaN)).toBe(true);
  });
});

describe('seleção pelo registro', () => {
  beforeEach(() => {
    clearDimProviders();
    registerBuiltinDimProviders();
  });

  it('porta selecionada devolve 2 cotas; janela também', () => {
    const p = cena((s) =>
      s.exec({ type: 'addOpening', opening: { id: 'j1', kind: 'window', typeId: 'ot_j120', hostId: 'h', offset: 4.2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } }),
    );
    expect(selectionDims(ctxOf(p), ['d1'])).toHaveLength(2);
    expect(selectionDims(ctxOf(p), ['j1'])).toHaveLength(2);
  });

  it('só com um elemento selecionado, com provedor e com showOnSelection', () => {
    const p = cena();
    expect(selectionDims(ctxOf(p), [])).toEqual([]);
    expect(selectionDims(ctxOf(p), ['d1', 'h'])).toEqual([]);
    expect(selectionDims(ctxOf(p), ['h']).every((d) => d.key.startsWith('wall:'))).toBe(true);
    expect(selectionDims(ctxOf(p), ['nada'])).toEqual([]);
    expect(selectionDims(ctxOf(p, { showOnSelection: false }), ['d1'])).toEqual([]);
  });

  it('o registro é idempotente', () => {
    registerBuiltinDimProviders();
    expect(selectionDims(ctxOf(cena()), ['d1'])).toHaveLength(2);
  });
});
