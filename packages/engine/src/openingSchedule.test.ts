import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, type Opening, type OpeningType } from '@hestia/model';
import { buildOpeningSchedule, filterOpeningRows, openingScheduleToCsv, sumOpeningRows } from './index.ts';

const opening = (o: Partial<Opening> & Pick<Opening, 'id' | 'kind' | 'typeId' | 'hostId'>): Opening => ({
  offset: 1.5,
  flipHand: false,
  flipFacing: false,
  sillOverride: null,
  mark: '',
  ...o,
});

/**
 * Duas paredes no térreo com: porta de giro (P-02), porta dupla (P-04), porta de correr (P-05), vão livre (V-01) e uma
 * janela de correr de 3 folhas (J-06). Cada abertura usa um tipo distinto, então há uma linha por tipo.
 */
const store = new ProjectStore(createEmptyProject());
store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 3 }, b: { x: 4, y: 3 } }) });
store.exec({ type: 'addOpening', opening: opening({ id: 'd1', kind: 'door', typeId: 'ot_p80', hostId: 'w1', offset: 1 }) });
store.exec({ type: 'addOpening', opening: opening({ id: 'd2', kind: 'door', typeId: 'ot_p160', hostId: 'w1', offset: 2.5 }) });
store.exec({ type: 'addOpening', opening: opening({ id: 'd3', kind: 'door', typeId: 'ot_pc160', hostId: 'w2', offset: 1 }) });
store.exec({ type: 'addOpening', opening: opening({ id: 'v1', kind: 'door', typeId: 'ot_vao90', hostId: 'w2', offset: 2.5 }) });
store.exec({ type: 'addOpening', opening: opening({ id: 'j1', kind: 'window', typeId: 'ot_j240', hostId: 'w2', offset: 3.5 }) });
const schedule = buildOpeningSchedule(store.project);

describe('tabela de portas e janelas', () => {
  it('uma linha por tipo, portas antes de janelas e ordenadas pelo código', () => {
    expect(schedule.rows.map((r) => r.typeId)).toEqual(['ot_p80', 'ot_p160', 'ot_pc160', 'ot_vao90', 'ot_j240']);
    expect(schedule.rows.map((r) => r.kind)).toEqual(['door', 'door', 'door', 'door', 'window']);
  });

  it('colunas: código, tipo, família, dimensões, folhas, quantidade e áreas', () => {
    const [giro, dupla, correr, vao, janela] = schedule.rows;
    expect(giro).toMatchObject({ code: 'P-02', typeName: 'Porta 80 x 210', familyName: 'Porta de giro', leaves: 1, count: 1 });
    expect(giro!.width).toBeCloseTo(0.8, 9);
    expect(giro!.height).toBeCloseTo(2.1, 9);
    expect(giro!.sill).toBeCloseTo(0, 9);
    expect(giro!.unitArea).toBeCloseTo(1.68, 9);
    expect(giro!.totalArea).toBeCloseTo(1.68, 9);
    expect(dupla).toMatchObject({ code: 'P-04', familyName: 'Porta dupla', leaves: 2 });
    expect(dupla!.unitArea).toBeCloseTo(1.6 * 2.1, 9);
    expect(correr).toMatchObject({ code: 'P-05', familyName: 'Porta de correr', leaves: 2 });
    expect(vao).toMatchObject({ code: 'V-01', familyName: 'Vão livre', leaves: 0 });
    expect(vao!.unitArea).toBeCloseTo(0.9 * 2.1, 9);
    expect(janela).toMatchObject({ kind: 'window', code: 'J-06', familyName: 'Janela de correr', leaves: 3 });
    expect(janela!.width).toBeCloseTo(2.4, 9);
    expect(janela!.height).toBeCloseTo(1.2, 9);
    expect(janela!.sill).toBeCloseTo(1.1, 9);
    expect(janela!.unitArea).toBeCloseTo(2.88, 9);
  });

  it('totais: quantidade de portas e de janelas e área total', () => {
    expect(schedule.totals.count).toBe(5);
    expect(schedule.totals.doorCount).toBe(4);
    expect(schedule.totals.windowCount).toBe(1);
    expect(schedule.totals.totalArea).toBeCloseTo(13.17, 9);
    expect(sumOpeningRows(schedule.rows.slice(0, 1)).totalArea).toBeCloseTo(1.68, 9);
  });

  it('filtra por categoria (só portas ou só janelas)', () => {
    expect(filterOpeningRows(schedule.rows, { kind: 'door' })).toHaveLength(4);
    expect(filterOpeningRows(schedule.rows, { kind: 'window' }).map((r) => r.typeId)).toEqual(['ot_j240']);
    expect(filterOpeningRows(schedule.rows, {})).toHaveLength(5);
  });
});

describe('tipo sem código na tabela de portas e janelas', () => {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  const tipo: OpeningType = { id: 'ot_sem', kind: 'door', name: 'Porta sem código', width: 0.85, height: 2.1, sill: 0, leaves: 1, plan: 'swing', frameMaterialId: 'mat_madeira', glassMaterialId: 'mat_vidro', closure: 'inherit' };
  s.exec({ type: 'upsertOpeningType', openingType: tipo });
  s.exec({ type: 'addOpening', opening: opening({ id: 'd', kind: 'door', typeId: 'ot_sem', hostId: 'w', offset: 2 }) });
  const tab = buildOpeningSchedule(s.project);

  it('o código fica vazio e a linha continua na tabela', () => {
    expect(tab.rows).toHaveLength(1);
    expect(tab.rows[0]).toMatchObject({ code: '', typeName: 'Porta sem código', familyName: 'Porta de giro', count: 1 });
    expect(openingScheduleToCsv(tab.rows, tab.totals)).toContain(';Porta sem código;');
  });
});

describe('CSV da tabela de portas e janelas', () => {
  const text = openingScheduleToCsv(schedule.rows, schedule.totals);
  const lines = text.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);

  it('BOM UTF-8, separador ";", cabeçalho, uma linha por tipo e total', () => {
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(lines).toHaveLength(schedule.rows.length + 2);
    expect(lines[0]).toBe('Código;Tipo;Família;Categoria;Largura (m);Altura (m);Largura bruta (m);Altura bruta (m);Peitoril (m);Folhas;Verga (m);Contraverga (m);Quantidade;Área unitária (m²);Área total (m²)');
  });

  it('decimal com vírgula e categoria Porta/Janela', () => {
    expect(lines[1]).toBe('P-02;Porta 80 x 210;Porta de giro;Porta;0,80;2,10;0,80;2,10;0,00;1;0,00;0,00;1;1,68;1,68');
    expect(lines[5]).toBe('J-06;Janela de correr 240 x 120 (3 folhas);Janela de correr;Janela;2,40;1,20;2,40;1,20;1,10;3;0,00;0,00;1;2,88;2,88');
  });

  it('a linha de total traz a quantidade de instâncias e a área total', () => {
    expect(lines.at(-1)).toBe(['Total', '', '', '', '', '', '', '', '', '', '', '', '5', '', '13,17'].join(';'));
  });
});


describe('vão bruto e vergas no quadro', () => {
  const s = new ProjectStore(createEmptyProject());
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
  const base = createEmptyProject().openingTypes.ot_j120!;
  s.exec({
    type: 'upsertOpeningType',
    openingType: { ...base, id: 'ot_bruto', roughOversize: { w: 0.04, h: 0.06 }, lintel: { over: 0.3, height: 0.2 }, sillBeam: {} },
  });
  s.exec({ type: 'addOpening', opening: opening({ id: 'j', kind: 'window', typeId: 'ot_bruto', hostId: 'w', offset: 2 }) });
  const tab = buildOpeningSchedule(s.project);
  const row = tab.rows[0]!;

  it('largura e altura brutas somam a folga do tipo; a área da esquadria não muda', () => {
    expect(row.width).toBeCloseTo(1.2, 9);
    expect(row.height).toBeCloseTo(1.2, 9);
    expect(row.roughWidth).toBeCloseTo(1.24, 9);
    expect(row.roughHeight).toBeCloseTo(1.26, 9);
    expect(row.unitArea).toBeCloseTo(1.44, 9);
  });

  it('verga e contraverga trazem transpasse, altura padrão e comprimento total', () => {
    expect(row.lintel).toEqual({ over: 0.3, height: 0.2 });
    expect(row.sillBeam).toEqual({ over: 0.3, height: 0.2 }); // presente sem valores usa o padrão
    expect(row.lintelLength).toBeCloseTo(1.8, 9);
    expect(row.sillBeamLength).toBeCloseTo(1.8, 9);
    expect(openingScheduleToCsv([row], sumOpeningRows([row]))).toContain('1,80;1,80;1;1,44;1,44');
  });
});
