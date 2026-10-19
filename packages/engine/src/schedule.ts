import { totalThickness, wallType, wallsOnLevel, type Id, type Project, type Wall, type WallType } from '@hestia/model';
import { quantifyLevel, type WallQuantity } from './quantities.ts';
import { resolveLevel } from './resolve.ts';

/** Uma parede na tabela de quantitativos. Unidades: m, m² e m³. */
export interface WallScheduleRow {
  wallId: Id;
  mark: string;
  typeId: Id;
  typeName: string;
  levelId: Id;
  levelName: string;
  /** Espessura total do tipo (soma das camadas). */
  thickness: number;
  length: number;
  height: number;
  grossFaceArea: number;
  openingsArea: number;
  netFaceArea: number;
  volume: number;
  /** Camadas da face externa para a interna, em cm: "Reboco 2,0 | Bloco 14,0 | ...". */
  layersSummary: string;
}

export interface WallScheduleTotals {
  count: number;
  length: number;
  grossFaceArea: number;
  openingsArea: number;
  netFaceArea: number;
  volume: number;
}

export interface MaterialVolume {
  materialId: Id;
  name: string;
  volume: number;
}

export interface WallSchedule {
  rows: WallScheduleRow[];
  totals: WallScheduleTotals;
  /** Volume total por material em todo o projeto (segunda tabela). */
  volumeByMaterial: MaterialVolume[];
}

const layersSummary = (p: Project, t: WallType): string =>
  t.layers.map((l) => `${p.materials[l.materialId]?.name ?? l.materialId} ${formatDecimal(l.thickness * 100, 1)}`).join(' | ');

/** Número com vírgula decimal e sem separador de milhar (formato do CSV). */
function formatDecimal(v: number, decimals: number): string {
  const x = Number(v.toFixed(decimals));
  return (x === 0 ? 0 : x).toFixed(decimals).replace('.', ',');
}

function rowOf(p: Project, wall: Wall, levelName: string, q: WallQuantity): WallScheduleRow {
  const t = wallType(p, wall);
  return {
    wallId: wall.id,
    mark: wall.mark,
    typeId: t.id,
    typeName: t.name,
    levelId: wall.levelId,
    levelName,
    thickness: totalThickness(t),
    length: q.length,
    height: q.height,
    grossFaceArea: q.grossFaceArea,
    openingsArea: q.openingsArea,
    netFaceArea: q.netFaceArea,
    volume: q.volume,
    layersSummary: layersSummary(p, t),
  };
}

/** Somatórios de um conjunto de linhas (o da tabela inteira ou só o filtrado). */
export function sumWallRows(rows: WallScheduleRow[]): WallScheduleTotals {
  const t: WallScheduleTotals = { count: rows.length, length: 0, grossFaceArea: 0, openingsArea: 0, netFaceArea: 0, volume: 0 };
  for (const r of rows) {
    t.length += r.length;
    t.grossFaceArea += r.grossFaceArea;
    t.openingsArea += r.openingsArea;
    t.netFaceArea += r.netFaceArea;
    t.volume += r.volume;
  }
  return t;
}

/** Tabela de paredes do projeto inteiro, nível a nível (ordem de criação dentro de cada nível). */
export function buildWallSchedule(p: Project): WallSchedule {
  const rows: WallScheduleRow[] = [];
  const volumes = new Map<Id, number>();
  for (const level of p.levels) {
    const q = quantifyLevel(p, resolveLevel(p, level.id));
    const byWall = new Map<Id, WallQuantity>(q.walls.map((x) => [x.wallId, x]));
    for (const wall of wallsOnLevel(p, level.id)) {
      const wq = byWall.get(wall.id);
      if (wq) rows.push(rowOf(p, wall, level.name, wq));
    }
    for (const [materialId, vol] of Object.entries(q.volumeByMaterial)) {
      volumes.set(materialId, (volumes.get(materialId) ?? 0) + vol);
    }
  }
  const volumeByMaterial = [...volumes]
    .map(([materialId, volume]) => ({ materialId, name: p.materials[materialId]?.name ?? materialId, volume }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  return { rows, totals: sumWallRows(rows), volumeByMaterial };
}

const CSV_HEADER = [
  'Marca',
  'Tipo',
  'Nível',
  'Espessura (m)',
  'Comprimento (m)',
  'Altura (m)',
  'Área bruta (m²)',
  'Área de vãos (m²)',
  'Área líquida (m²)',
  'Volume (m³)',
  'Camadas (cm)',
];

/** Texto com ';' , aspas ou quebra de linha vai entre aspas; fórmula não sai do CSV (Excel). */
const csvText = (s: string): string => {
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/**
 * CSV com separador ';', decimal com vírgula, cabeçalho em português e BOM UTF-8.
 * Uma linha por parede, seguida de uma linha de total.
 */
export function scheduleToCsv(rows: WallScheduleRow[], totals: WallScheduleTotals): string {
  const n = (v: number, d: number): string => formatDecimal(v, d);
  const body = rows.map((r) => [
    csvText(r.mark),
    csvText(r.typeName),
    csvText(r.levelName),
    n(r.thickness, 3),
    n(r.length, 2),
    n(r.height, 2),
    n(r.grossFaceArea, 2),
    n(r.openingsArea, 2),
    n(r.netFaceArea, 2),
    n(r.volume, 3),
    csvText(r.layersSummary),
  ]);
  const total = ['Total', '', '', '', n(totals.length, 2), '', n(totals.grossFaceArea, 2), n(totals.openingsArea, 2), n(totals.netFaceArea, 2), n(totals.volume, 3), ''];
  const lines = [CSV_HEADER, ...body, total].map((cells) => cells.join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
