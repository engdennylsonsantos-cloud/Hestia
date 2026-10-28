import { describe, expect, it } from 'vitest';
import { buildTemplate, defaultUnits, isWall } from '@hestia/model';
import { buildWallSchedule, quantifyLevel, resolveLevel, scheduleToCsv, sumWallRows, type WallScheduleRow } from './index.ts';

const project = buildTemplate('house2');
const schedule = buildWallSchedule(project);
const walls = Object.values(project.elements).filter(isWall);

const quantityVolume = project.levels.reduce((s, l) => s + quantifyLevel(project, resolveLevel(project, l.id)).walls.reduce((a, w) => a + w.volume, 0), 0);

describe('tabela de paredes', () => {
  it('uma linha por parede', () => {
    expect(schedule.rows).toHaveLength(walls.length);
    expect(new Set(schedule.rows.map((r) => r.wallId))).toEqual(new Set(walls.map((w) => w.id)));
  });

  it('soma dos volumes das linhas == soma dos volumes do quantitativo', () => {
    const sum = schedule.rows.reduce((s, r) => s + r.volume, 0);
    expect(sum).toBeCloseTo(quantityVolume, 9);
    expect(schedule.totals.volume).toBeCloseTo(quantityVolume, 9);
  });

  it('área líquida = bruta - vãos em cada linha, e totais batem com as linhas', () => {
    for (const r of schedule.rows) expect(r.netFaceArea).toBeCloseTo(r.grossFaceArea - r.openingsArea, 9);
    expect(schedule.totals.count).toBe(schedule.rows.length);
    expect(schedule.totals.netFaceArea).toBeCloseTo(schedule.rows.reduce((s, r) => s + r.netFaceArea, 0), 9);
    expect(schedule.totals.length).toBeCloseTo(schedule.rows.reduce((s, r) => s + r.length, 0), 9);
  });

  it('espessura é a soma das camadas do tipo, e o resumo traz cada camada em cm', () => {
    const r = schedule.rows.find((x) => x.typeId === 'wt_ext19')!;
    const layers = project.wallTypes['wt_ext19']!.layers;
    expect(r.thickness).toBeCloseTo(layers.reduce((s, l) => s + l.thickness, 0), 9);
    expect(r.layersSummary.split(' | ')).toHaveLength(layers.length);
    expect(r.layersSummary).toMatch(/ \d+,\d$/);
  });

  it('volume por material fecha com o total', () => {
    const sum = schedule.volumeByMaterial.reduce((s, m) => s + m.volume, 0);
    expect(sum).toBeCloseTo(schedule.totals.volume, 9);
    expect(schedule.volumeByMaterial.every((m) => m.name.length > 0)).toBe(true);
  });

  it('sumWallRows com subconjunto soma só o subconjunto', () => {
    const half = schedule.rows.slice(0, 3);
    expect(sumWallRows(half).count).toBe(3);
    expect(sumWallRows(half).volume).toBeCloseTo(half.reduce((s, r) => s + r.volume, 0), 9);
  });
});

describe('CSV da tabela de paredes', () => {
  const csv = scheduleToCsv(schedule.rows, schedule.totals, defaultUnits());
  const lines = csv.replace(/^\uFEFF/, '').split('\r\n').filter((l) => l.length > 0);

  it('começa com BOM UTF-8', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('tem cabeçalho, uma linha por parede e a linha de total', () => {
    expect(lines).toHaveLength(schedule.rows.length + 2);
    expect(lines[0]!.startsWith('Marca;Tipo;Nível;')).toBe(true);
    expect(lines[lines.length - 1]!.startsWith('Total;')).toBe(true);
  });

  it('usa ";" como separador e tem o mesmo número de campos em todas as linhas', () => {
    const counts = new Set(lines.map((l) => l.split(';').length));
    expect(counts).toEqual(new Set([11]));
  });

  it('decimal com vírgula, sem ponto nos números', () => {
    const fields = lines[1]!.split(';');
    expect(fields[4]).toMatch(/^\d+,\d{2}$/);
    expect(fields[9]).toMatch(/^\d+,\d{3}$/);
    expect(csv).not.toMatch(/\d\.\d/);
  });

  it('texto com ";", aspas ou quebra vai entre aspas, e fórmula é neutralizada', () => {
    const row: WallScheduleRow = { ...schedule.rows[0]!, mark: 'A;"B"', typeName: '=SOMA(1)' };
    const out = scheduleToCsv([row], sumWallRows([row]), defaultUnits());
    expect(out).toContain(`"A;""B"""`);
    expect(out).toContain(`'=SOMA(1)`);
  });
});
