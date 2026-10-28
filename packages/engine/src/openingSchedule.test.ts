import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, makeWall, openingSpanOf, type Opening, type OpeningType } from '@hestia/model';
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
    expect(lines[0]).toBe('Código;Tipo;Família;Categoria;Largura (m);Altura (m);Largura bruta (m);Altura bruta (m);Peitoril (m);Folhas;Verga (m);Contraverga (m);Quantidade;Área unitária (m²);Área total (m²);Folha largura (m);Folha altura (m);Material do batente;Sentido;Material da folha;Ferragens');
  });

  it('decimal com vírgula e categoria Porta/Janela', () => {
    expect(lines[1]).toBe('P-02;Porta 80 x 210;Porta de giro;Porta;0,80;2,10;0,80;2,10;0,00;1;0,00;0,00;1;1,68;1,68;0,72;2,05;Madeira;dobradiça padrão, abre à esquerda de a→b;;"maçaneta a 1,00 m; 3 dobradiças; folga inferior 7 mm"');
    expect(lines[5]).toBe('J-06;Janela de correr 240 x 120 (3 folhas);Janela de correr;Janela;2,40;1,20;2,40;1,20;1,10;3;0,00;0,00;1;2,88;2,88;2,32;1,15;Alumínio;dobradiça padrão, abre à esquerda de a→b;;');
  });

  it('a linha de total traz a quantidade de instâncias e a área total', () => {
    expect(lines.at(-1)).toBe(['Total', '', '', '', '', '', '', '', '', '', '', '', '5', '', '13,17', '', '', '', '', '', ''].join(';'));
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

describe('folha, material, ferragens e sentido no quadro', () => {
  const base = createEmptyProject();
  const s = new ProjectStore(base);
  s.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 8, y: 0 } }) });
  // Porta de giro pelo catálogo (P-14, nominalRef 'leaf'): 80 x 210 é a folha; o vão sai do motor.
  const folha = base.openingTypes.ot_pgiro80!;
  const colocada = (id: string, offset: number, flipHand: boolean, flipFacing: boolean): void =>
    s.exec({ type: 'addOpening', opening: opening({ id, kind: 'door', typeId: 'ot_pgiro80', hostId: 'w', offset, flipHand, flipFacing }) });
  colocada('a', 1, false, false);
  colocada('b', 2.5, false, true);
  colocada('c', 4, true, false);
  colocada('d', 5.5, true, true);
  colocada('e', 7, false, false); // repete o sentido de 'a': não entra de novo na lista
  const row = buildOpeningSchedule(s.project).rows.find((r) => r.typeId === 'ot_pgiro80')!;

  it('porta de folha: folha vem do tipo e o vão é o do motor (maior que a folha)', () => {
    expect(row.count).toBe(5);
    expect(row.leafWidth).toBeCloseTo(0.8, 9);
    expect(row.leafHeight).toBeCloseTo(2.1, 9);
    expect(row.width).toBeCloseTo(openingSpanOf(folha).width, 9);
    expect(row.width).toBeGreaterThan(row.leafWidth);
  });

  it('sentido: os 4 casos de flipHand × flipFacing, distintos e na ordem de inserção', () => {
    expect(row.sense.split('; ')).toEqual([
      'dobradiça padrão, abre à esquerda de a→b',
      'dobradiça padrão, abre à direita de a→b',
      'dobradiça invertida, abre à esquerda de a→b',
      'dobradiça invertida, abre à direita de a→b',
    ]);
  });

  it('ferragens só do que a família oferece: maçaneta, dobradiças e folga inferior', () => {
    expect(row.hardware).toBe('maçaneta a 1,00 m; 3 dobradiças; folga inferior 7 mm');
  });

  it('material do batente vem do tipo; material da folha fica vazio quando o tipo não informa', () => {
    expect(row.frameMaterial).toBe(base.materials[folha.frameMaterialId]!.name);
    expect(row.leafMaterial).toBe('');
  });

  it('material da folha resolve pelo nome quando o tipo informa leafMaterialId', () => {
    const s2 = new ProjectStore(createEmptyProject());
    s2.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } }) });
    s2.exec({ type: 'upsertOpeningType', openingType: { ...folha, leafMaterialId: 'mat_aco' } });
    s2.exec({ type: 'addOpening', opening: opening({ id: 'x', kind: 'door', typeId: 'ot_pgiro80', hostId: 'w', offset: 1 }) });
    const r = buildOpeningSchedule(s2.project).rows[0]!;
    expect(r.leafMaterial).toBe(s2.project.materials.mat_aco!.name);
  });

  it('janela não tem ferragens; vão livre não tem sentido, ferragens nem material da folha', () => {
    const j = schedule.rows.find((r) => r.typeId === 'ot_j240')!;
    expect(j.hardware).toBe('');
    const v = schedule.rows.find((r) => r.typeId === 'ot_vao90')!;
    expect(v).toMatchObject({ familyName: 'Vão livre', sense: '', hardware: '', leafMaterial: '' });
  });
});
