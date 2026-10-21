import { describe, expect, it } from 'vitest';
import { type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeStair, type StairCurve, type StairRun } from '@hestia/model';
import { buildStairSchedule, filterStairRows, stairScheduleToCsv, sumStairRows } from './index.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });
const ln = (ax: number, ay: number, bx: number, by: number): StairCurve => ({ a: v(ax, ay), b: v(bx, by), sag: 0 });

/** Lance reto de 16 espelhos a cada 0,28 m, largura 1,20 m (como em stairQuantities.test.ts). */
function straight(): StairRun {
  return {
    id: 'run',
    kind: 'run',
    boundaryLeft: [ln(-0.5, 0.6, 4.7, 0.6)],
    boundaryRight: [ln(-0.5, -0.6, 4.7, -0.6)],
    risers: Array.from({ length: 16 }, (_, k) => ln(k * 0.28, -1, k * 0.28, 1)),
    path: [],
  };
}

/**
 * Térreo → pavimento 2 com a escada monolítica `E1` (topo no pavimento 2 com deslocamento −0,20 m, H = 2,80 m) e uma
 * escada de piso e espelho `E;2` no pavimento 2 (topo sem nível acima: base + 2,80 m).
 */
const store = new ProjectStore(createEmptyProject());
store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0', components: [straight()], topOffset: -0.2, mark: 'E1' }) });
store.exec({ type: 'addStair', stair: makeStair({ id: 'st2', typeId: 'stt_piso_espelho', levelId: 'lv_1', components: [straight()], mark: 'E;2' }) });
const schedule = buildStairSchedule(store.project);

describe('tabela de escadas', () => {
  it('uma linha por escada, nível a nível (térreo primeiro)', () => {
    expect(schedule.rows.map((r) => r.stairId)).toEqual(['st1', 'st2']);
  });

  it('colunas: marca, tipo, níveis de base e de topo, espelhos, altura, piso, largura, área e volume', () => {
    const [a, b] = schedule.rows;
    expect(a).toMatchObject({
      mark: 'E1',
      typeName: 'Escada monolítica concreto',
      typeCode: 'ES-01',
      baseLevelName: 'Térreo',
      topLevelId: 'lv_1',
      topLevelName: 'Pavimento 2',
      riserCount: 16,
    });
    expect(a!.riserHeight).toBeCloseTo(0.175, 9);
    expect(a!.treadMean).toBeCloseTo(0.28, 9);
    expect(a!.width).toBeCloseTo(1.2, 9);
    expect(a!.planArea).toBeCloseTo(5.04, 9);
    // Monolítico liso (decisão 0012): 1,5763 m³ com o corte pelo piso base (ver stairQuantities.test.ts).
    expect(a!.volume).toBeCloseTo(1.5763, 4);
    expect(b).toMatchObject({ mark: 'E;2', typeCode: 'ES-02', baseLevelName: 'Pavimento 2', topLevelId: null, topLevelName: '' });
    expect(b!.volume).toBeCloseTo(0.2184, 9);
  });

  it('totais fecham com a soma das linhas', () => {
    expect(schedule.totals.count).toBe(2);
    expect(schedule.totals.planArea).toBeCloseTo(10.08, 9);
    expect(schedule.totals.volume).toBeCloseTo(1.7947, 4);
    expect(sumStairRows(schedule.rows.slice(0, 1)).volume).toBeCloseTo(1.5763, 4);
  });

  it('filtra por tipo e por nível de base, separadamente e juntos', () => {
    expect(filterStairRows(schedule.rows, { typeId: 'stt_piso_espelho' }).map((r) => r.stairId)).toEqual(['st2']);
    expect(filterStairRows(schedule.rows, { levelId: 'lv_0' }).map((r) => r.stairId)).toEqual(['st1']);
    expect(filterStairRows(schedule.rows, { typeId: 'stt_monolitica', levelId: 'lv_1' })).toEqual([]);
    expect(filterStairRows(schedule.rows, {})).toHaveLength(2);
  });
});

describe('CSV da tabela de escadas', () => {
  const text = stairScheduleToCsv(schedule.rows, schedule.totals);
  const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);

  it('BOM UTF-8, separador ";", cabeçalho, uma linha por escada e total', () => {
    expect(text.startsWith('﻿')).toBe(true);
    expect(lines).toHaveLength(schedule.rows.length + 2);
    expect(lines[0]).toBe(
      'Marca;Tipo;Código;Nível de base;Nível de topo;Espelhos;Altura do espelho (m);Piso médio (m);Largura (m);Área em planta (m²);Volume (m³)',
    );
  });

  it('decimal com vírgula; marca com ";" entre aspas; nível de topo vazio sem nível acima', () => {
    expect(lines[1]).toBe('E1;Escada monolítica concreto;ES-01;Térreo;Pavimento 2;16;0,175;0,280;1,20;5,04;1,576');
    expect(lines[2]).toBe('"E;2";Escada de piso e espelho;ES-02;Pavimento 2;;16;0,175;0,280;1,20;5,04;0,218');
  });

  it('a linha de total traz a área em planta e o volume somados', () => {
    expect(lines.at(-1)).toBe(['Total', '', '', '', '', '', '', '', '', '10,08', '1,795'].join(';'));
  });
});
