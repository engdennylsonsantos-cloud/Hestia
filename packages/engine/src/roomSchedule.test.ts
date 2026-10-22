import { describe, expect, it } from 'vitest';
import type { Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeRoom, makeWall, type Id, type Project } from '@hestia/model';
import { buildRoomSchedule, filterRoomRows, roomLevelTotals, roomScheduleToCsv, sumRoomRows } from './index.ts';

const rectRing = (x0: number, y0: number, x1: number, y1: number): Vec2[] => [{ x: x0, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }];

interface RoomSpec {
  id: string;
  levelId: Id;
  rect: [number, number, number, number];
  point: Vec2;
  name: string;
  number: string;
  ceilingHeight?: number;
  floorFinish?: string;
}

function roomSpec(over: Partial<RoomSpec> & Pick<RoomSpec, 'id' | 'rect' | 'point'>): RoomSpec {
  return { levelId: 'lv_0', name: 'Sala', number: '0', ...over };
}

function build(specs: RoomSpec[]): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const sp of specs) {
    const ring = rectRing(...sp.rect);
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      s.exec({ type: 'addWall', wall: makeWall({ id: `${sp.id}_w${i}`, typeId: 'wt_alv14', levelId: sp.levelId, a, b, locationLine: 'finishInterior' }) });
    });
    s.exec({
      type: 'addRoom',
      room: makeRoom({ id: sp.id, levelId: sp.levelId, name: sp.name, number: sp.number, point: sp.point, ceilingHeight: sp.ceilingHeight, floorFinish: sp.floorFinish }),
    });
  }
  return s.project;
}

const project = build([
  roomSpec({ id: 'r1', rect: [0, 0, 4, 5], point: { x: 2, y: 2.5 }, name: 'Sala', number: '101' }),
  roomSpec({ id: 'r2', rect: [25, 0, 28, 3], point: { x: 26.5, y: 1.5 }, name: 'Cozinha', number: '102', ceilingHeight: 3, floorFinish: 'Porcelanato' }),
  roomSpec({ id: 'r3', levelId: 'lv_1', rect: [0, 0, 4, 5], point: { x: 2, y: 2.5 }, name: 'Quarto', number: '201' }),
]);

describe('tabela de ambientes', () => {
  const schedule = buildRoomSchedule(project);

  it('uma linha por ambiente, nível a nível e na ordem de criação', () => {
    expect(schedule.rows.map((r) => r.roomId)).toEqual(['r1', 'r2', 'r3']);
    expect(schedule.rows.map((r) => r.levelName)).toEqual(['Térreo', 'Térreo', 'Pavimento 2']);
  });

  it('colunas: número, nome, nível, área, perímetro, pé-direito, volume e acabamentos', () => {
    const [a, b] = schedule.rows;
    expect(a).toMatchObject({ number: '101', name: 'Sala', levelName: 'Térreo', area: 20, perimeter: 18, ceilingHeight: 2.8, volume: 56, floorFinish: '', wallFinish: '', ceilingFinish: '' });
    expect(b).toMatchObject({ number: '102', name: 'Cozinha', ceilingHeight: 3, volume: 27, floorFinish: 'Porcelanato' });
  });

  it('totais por nível e geral fecham com a soma das linhas', () => {
    expect(schedule.totals).toEqual({ count: 3, area: 49, perimeter: 48, volume: 139 });
    expect(schedule.byLevel).toEqual([
      { levelId: 'lv_0', levelName: 'Térreo', count: 2, area: 29, perimeter: 30, volume: 83 },
      { levelId: 'lv_1', levelName: 'Pavimento 2', count: 1, area: 20, perimeter: 18, volume: 56 },
    ]);
    expect(roomLevelTotals(schedule.rows)).toEqual(schedule.byLevel);
    expect(sumRoomRows(schedule.rows.slice(0, 2))).toEqual({ count: 2, area: 29, perimeter: 30, volume: 83 });
  });

  it('filtra por nível', () => {
    expect(filterRoomRows(schedule.rows, { levelId: 'lv_0' }).map((r) => r.roomId)).toEqual(['r1', 'r2']);
    expect(filterRoomRows(schedule.rows, { levelId: 'lv_1' }).map((r) => r.roomId)).toEqual(['r3']);
    expect(filterRoomRows(schedule.rows, {})).toHaveLength(3);
  });
});

describe('CSV da tabela de ambientes', () => {
  const schedule = buildRoomSchedule(project);
  const text = roomScheduleToCsv(schedule.rows, schedule.totals);
  const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);

  it('tem BOM UTF-8, separador ";" e cabeçalho em português', () => {
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(lines[0]).toBe('Número;Nome;Nível;Área (m²);Perímetro (m);Pé-direito (m);Volume (m³);Piso;Parede;Forro');
  });

  it('decimal com vírgula, subtotal por nível e total geral', () => {
    expect(lines[1]).toBe('101;Sala;Térreo;20,00;18,00;2,80;56,000;;;');
    expect(lines[3]).toBe(';;Subtotal Térreo;29,00;30,00;;83,000;;;');
    expect(lines[5]).toBe(';;Subtotal Pavimento 2;20,00;18,00;;56,000;;;');
    expect(lines.at(-1)).toBe('Total;;;49,00;48,00;;139,000;;;');
  });
});
