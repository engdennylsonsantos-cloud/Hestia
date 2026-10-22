import { describe, expect, it } from 'vitest';
import { DEFAULT_OPENING_TYPES, ProjectStore, buildTemplate, createEmptyProject, makeWall, type Opening, type OpeningType } from '@hestia/model';
import { buildOpeningSchedule, frameOfWall, openingGeometry, type OpeningGeometry, type OpeningScheduleRow } from '@hestia/engine';
import { openingPieces, type OpeningPiece } from '@hestia/render';
import { alternarAcabamento, applyFamily, familyOptionsFor, leavesChoicesFor, leavesLabel, newOpeningTypeFromFamily } from './openingTypeForm.ts';

const store = (): ProjectStore => new ProjectStore(buildTemplate('house2'));

describe('famílias de abertura no formulário', () => {
  it('oferece só as famílias do tipo, na ordem da interface', () => {
    expect(familyOptionsFor('door').map((f) => f.id)).toEqual(['door_swing', 'door_double', 'door_sliding', 'door_pivot', 'door_void']);
    expect(familyOptionsFor('window').map((f) => f.id)).toEqual(['window_fixed', 'window_tilt', 'window_casement', 'window_sliding', 'window_void']);
  });

  it('rótulo de folhas e opções aceitas pela família (janela de correr: 2 ou 3)', () => {
    expect(leavesLabel(0)).toBe('Vão livre (sem folha)');
    expect(leavesLabel(1)).toBe('1 folha');
    expect(leavesLabel(2)).toBe('2 folhas');
    expect(leavesLabel(3)).toBe('3 folhas');
    const correr = familyOptionsFor('window').find((f) => f.id === 'window_sliding')!;
    expect(leavesChoicesFor(correr).map((o) => o.value)).toEqual([2, 3]);
    const fixa = familyOptionsFor('window').find((f) => f.id === 'window_fixed')!;
    expect(leavesChoicesFor(fixa)).toHaveLength(1);
  });

  it('escolher a família grava o símbolo e a 1ª contagem de folhas aceita', () => {
    const base = newOpeningTypeFromFamily(familyOptionsFor('door').find((f) => f.id === 'door_swing')!);
    const correr = familyOptionsFor('door').find((f) => f.id === 'door_sliding')!;
    const next = applyFamily(base, correr);
    expect(next.plan).toBe('sliding');
    expect(next.leaves).toBe(2);
  });
});

describe('tipo novo pelo comando', () => {
  it('cria um tipo da família escolhida e o comando aceita', () => {
    const s = store();
    const t = newOpeningTypeFromFamily(familyOptionsFor('door').find((f) => f.id === 'door_pivot')!);
    s.exec({ type: 'upsertOpeningType', openingType: t });
    const saved = s.project.openingTypes[t.id];
    expect(saved?.plan).toBe('pivot');
    expect(saved?.leaves).toBe(1);
    expect(saved?.name).toBe('Nova porta');
  });

  it('o comando recusa combinação fora das famílias', () => {
    const s = store();
    const base = newOpeningTypeFromFamily(familyOptionsFor('window')[0]!);
    const bad: OpeningType = { ...base, plan: 'fixed', leaves: 3 };
    expect(() => s.exec({ type: 'upsertOpeningType', openingType: bad })).toThrow('Combinação inválida');
    expect(s.project.openingTypes[bad.id]).toBeUndefined();
  });
});

/** Cena de uma janela (ot_j120) numa parede de 4 m: a peça 3D do vão e a linha do quadro, como o app as calcula. */
function cenaJanela(t: OpeningType): { g: OpeningGeometry; pecas: OpeningPiece[]; linha: OpeningScheduleRow } {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'upsertOpeningType', openingType: t });
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  s.exec({ type: 'addOpening', opening: { id: 'v', kind: 'window', typeId: t.id, hostId: 'w', offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
  const p = s.project;
  const o = p.elements.v as Opening;
  const f = frameOfWall(p, 'w')!;
  const g = openingGeometry(p, o, f);
  return { g, pecas: openingPieces(p, o, g, f, 2.8, false), linha: buildOpeningSchedule(p).rows[0]! };
}

const perto = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

describe('alternar acabamento (ligar grava o padrão, desligar tira o campo)', () => {
  const base = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_j120')!;

  it('ligar grava o padrão sem mexer no resto do tipo; desligar tira a chave', () => {
    const ligado = alternarAcabamento(base, 'lintel', true);
    expect(ligado.lintel).toEqual({ over: 0.3, height: 0.2 });
    expect(ligado.width).toBe(base.width);
    expect(base.lintel).toBeUndefined();
    const desligado = alternarAcabamento(ligado, 'lintel', false);
    expect('lintel' in desligado).toBe(false);
  });
});

describe('campos de acabamento: cada um muda a peça no 3D e o quadro', () => {
  const base = DEFAULT_OPENING_TYPES.find((t) => t.id === 'ot_j120')!;
  const W = base.width;
  const sem = cenaJanela(base);

  it('folga do vão: o vão bruto cresce no quadro e no corte da parede; a esquadria não muda', () => {
    const c = cenaJanela({ ...base, roughOversize: { w: 0.02, h: 0.01 } });
    expect(c.g.roughWidth).toBeCloseTo(W + 0.02, 9);
    expect(c.g.width).toBe(W);
    expect(c.linha.roughWidth).toBeCloseTo(W + 0.02, 9);
    expect(c.linha.roughHeight).toBeCloseTo(base.height + 0.01, 9);
    expect(c.pecas).toHaveLength(sem.pecas.length);
  });

  it('alizar: largura e espessura viram as peças em volta do vão (8 a mais na janela)', () => {
    const c = cenaJanela({ ...alternarAcabamento(base, 'casing', true), casing: { width: 0.08, thickness: 0.02 } });
    expect(c.pecas.length - sem.pecas.length).toBe(8);
    expect(c.pecas.some((x) => perto(x.w, W + 0.16) && perto(x.d, 0.02))).toBe(true);
    expect(sem.pecas.some((x) => perto(x.d, 0.02))).toBe(false);
  });

  it('soleira saliente: projeção e espessura viram o peitoril além das duas faces da parede', () => {
    const c = cenaJanela({ ...base, sillBoard: { projection: 0.04, thickness: 0.03 } });
    expect(c.pecas.length - sem.pecas.length).toBe(1);
    expect(c.pecas.some((x) => perto(x.w, W) && perto(x.d, c.g.thickness + 0.08) && perto(x.h, 0.03))).toBe(true);
  });

  it('verga: transpasse e altura viram a peça sobre o vão e o comprimento total no quadro', () => {
    const c = cenaJanela({ ...base, lintel: { over: 0.25, height: 0.15 } });
    expect(c.pecas.length - sem.pecas.length).toBe(1);
    expect(c.pecas.some((x) => perto(x.w, W + 0.5) && perto(x.h, 0.15))).toBe(true);
    expect(c.linha.lintel?.over).toBeCloseTo(0.25, 9);
    expect(c.linha.lintelLength).toBeCloseTo(W + 0.5, 9);
  });

  it('contraverga: transpasse e altura viram a peça sob o vão e entram no quadro', () => {
    const c = cenaJanela({ ...base, sillBeam: { over: 0.1, height: 0.12 } });
    expect(c.pecas.length - sem.pecas.length).toBe(1);
    expect(c.pecas.some((x) => perto(x.w, W + 0.2) && perto(x.h, 0.12))).toBe(true);
    expect(c.linha.sillBeam?.height).toBeCloseTo(0.12, 9);
  });

  it('desligar a verga tira a peça e a coluna do quadro volta ao padrão (sem verga)', () => {
    const c = cenaJanela(alternarAcabamento(alternarAcabamento(base, 'lintel', true), 'lintel', false));
    expect(c.pecas).toHaveLength(sem.pecas.length);
    expect(c.linha.lintel).toBeNull();
  });

  it('a validação do modelo recusa folga negativa com a mensagem que o diálogo mostra', () => {
    const s = new ProjectStore(createEmptyProject());
    expect(() => s.exec({ type: 'upsertOpeningType', openingType: { ...base, id: 'ot_x', roughOversize: { w: -0.01, h: 0 } } })).toThrow(
      'Folga do vão, largura: use um valor de 0 a 20 cm.',
    );
    expect(s.project.openingTypes['ot_x']).toBeUndefined();
  });
});
