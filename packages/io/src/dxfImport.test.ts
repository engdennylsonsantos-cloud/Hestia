import { describe, expect, it } from 'vitest';
import { writeDxf2000 } from './dxfDoc.ts';
import { parseDxfText } from './dxfImport.ts';

/**
 * Importador de DXF: ida e volta com o escritor R2000 do Hestia, mais arquivos R12 montados à mão (ARC, CIRCLE, TEXT,
 * BLOCK/INSERT), unidades em mm e entidades não suportadas (HATCH).
 */

/** DXF mínimo montado à mão: pares código/valor, um por linha, terminado em CRLF. */
function montar(pares: Array<[number, string | number]>): string {
  return `${pares.map(([codigo, valor]) => `${codigo}\r\n${valor}`).join('\r\n')}\r\n`;
}

describe('parseDxfText com o escritor R2000 do Hestia', () => {
  const dxf = writeDxf2000({
    layers: [
      { name: 'PAREDES', color: 1, linetype: 'CONTINUOUS', lineWeight: 50 },
      { name: 'MOBILIARIO', color: 5, linetype: 'CONTINUOUS', lineWeight: 25 },
    ],
    entities: [
      { kind: 'polyline', layer: 'PAREDES', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }], closed: true },
      { kind: 'polyline', layer: 'MOBILIARIO', points: [{ x: 1, y: 1 }, { x: 2, y: 1 }], closed: false },
      { kind: 'line', layer: 'PAREDES', a: { x: 0, y: 0 }, b: { x: 1, y: 1 } },
      { kind: 'line', layer: 'MOBILIARIO', a: { x: 2, y: 2 }, b: { x: 3, y: 3 } },
      { kind: 'text', layer: 'MOBILIARIO', at: { x: 1, y: 2 }, height: 0.25, text: 'Sala de estar — açaí', rotation: 0 },
    ],
  });
  const resultado = parseDxfText(dxf, 'planta');

  it('lê as camadas com nome e cor ACI', () => {
    expect(resultado.layers.find((l) => l.name === 'PAREDES')?.color).toBe(1);
    expect(resultado.layers.find((l) => l.name === 'MOBILIARIO')?.color).toBe(5);
  });

  it('conta os traços e os textos, e respeita o fechamento', () => {
    expect(resultado.paths).toHaveLength(4);
    expect(resultado.paths.filter((p) => p.closed)).toHaveLength(1);
    expect(resultado.paths.find((p) => p.closed)?.pts).toHaveLength(4);
    expect(resultado.texts).toHaveLength(1);
    expect(resultado.paths.filter((p) => p.layer === 'PAREDES')).toHaveLength(2);
  });

  it('a unidade ausente no header é metro e a extensão vem do header', () => {
    expect(resultado.unit).toBe('m');
    expect(resultado.unitScale).toBe(1);
    expect(resultado.extents).toEqual({ min: { x: 0, y: 0 }, max: { x: 4, y: 3 } });
  });

  it('o texto volta com o acento decodificado de \\U+XXXX', () => {
    expect(resultado.texts[0]!.text).toBe('Sala de estar — açaí');
    expect(resultado.texts[0]!.height).toBeCloseTo(0.25);
  });

  it('não gera avisos para o que o escritor grava', () => {
    expect(resultado.warnings).toEqual([]);
  });
});

describe('parseDxfText em R12 montado à mão', () => {
  const r12 = montar([
    [0, 'SECTION'], [2, 'HEADER'],
    [9, '$INSUNITS'], [70, 6],
    [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'TABLES'],
    [0, 'TABLE'], [2, 'LAYER'], [70, 1],
    [0, 'LAYER'], [2, 'DESENHO'], [70, 0], [62, 3], [6, 'CONTINUOUS'],
    [0, 'ENDTAB'],
    [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'BLOCKS'],
    [0, 'BLOCK'], [8, '0'], [2, 'SIMBOLO'], [70, 0], [10, 1], [20, 1], [30, 0],
    [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 2], [21, 0],
    [0, 'CIRCLE'], [8, '0'], [10, 0], [20, 0], [40, 0.5],
    [0, 'ENDBLK'],
    [0, 'ENDSEC'],
    [0, 'SECTION'], [2, 'ENTITIES'],
    [0, 'ARC'], [8, 'DESENHO'], [10, 0], [20, 0], [40, 2], [50, 0], [51, 90],
    [0, 'CIRCLE'], [8, 'DESENHO'], [10, 10], [20, 0], [40, 1],
    [0, 'TEXT'], [8, 'DESENHO'], [10, 5], [20, 5], [40, 0.5], [50, 0], [1, 'Sala'],
    [0, 'INSERT'], [8, 'DESENHO'], [2, 'SIMBOLO'], [10, 20], [20, 10], [41, 2], [42, 2], [50, 0],
    [0, 'ENDSEC'],
    [0, 'EOF'],
  ]);
  const resultado = parseDxfText(r12);

  it('tesselou o ARC (48 segmentos) e o CIRCLE (48 lados)', () => {
    const arco = resultado.paths.find((p) => !p.closed && p.pts.length === 49)!;
    expect(arco.pts[0]!.x).toBeCloseTo(2);
    expect(arco.pts[0]!.y).toBeCloseTo(0);
    expect(arco.pts.at(-1)!.x).toBeCloseTo(0);
    expect(arco.pts.at(-1)!.y).toBeCloseTo(2);
    const circulo = resultado.paths.find((p) => p.closed && p.pts.length === 48 && p.pts[0]!.x > 10)!;
    expect(circulo.pts.length).toBeGreaterThanOrEqual(48);
    expect(circulo.pts[0]!.x).toBeCloseTo(11);
  });

  it('lê o TEXT com altura e rotação', () => {
    expect(resultado.texts).toHaveLength(1);
    expect(resultado.texts[0]!.text).toBe('Sala');
    expect(resultado.texts[0]!.at).toEqual({ x: 5, y: 5 });
    expect(resultado.texts[0]!.height).toBeCloseTo(0.5);
    expect(resultado.texts[0]!.rotation).toBe(0);
  });

  it('expande o INSERT com a posição, a escala e o ponto base do bloco', () => {
    // O bloco tem base (1,1); o LINE vai de (0,0) a (2,0) e entra em (20,10) com escala 2.
    const linha = resultado.paths.find((p) => p.pts.length === 2)!;
    expect(linha.pts[0]!.x).toBeCloseTo(18);
    expect(linha.pts[0]!.y).toBeCloseTo(8);
    expect(linha.pts[1]!.x).toBeCloseTo(22);
    expect(linha.pts[1]!.y).toBeCloseTo(8);
    // O CIRCLE do bloco (centro 0,0 e raio 0,5) sai em (18,8) com raio 1.
    const circuloDoBloco = resultado.paths.find((p) => p.closed && p.pts[0]!.x > 18 && p.pts[0]!.x < 20)!;
    expect(circuloDoBloco.pts[0]!.x).toBeCloseTo(19);
    expect(circuloDoBloco.pts[0]!.y).toBeCloseTo(8);
  });

  it('as entidades do bloco herdam a camada do INSERT quando estão na camada 0', () => {
    expect(resultado.paths.filter((p) => p.layer === 'DESENHO')).toHaveLength(4);
  });
});

describe('unidades do DXF', () => {
  it('$INSUNITS 4 (mm) aplica o fator 0,001 em coordenadas e alturas', () => {
    const dxf = montar([
      [0, 'SECTION'], [2, 'HEADER'],
      [9, '$INSUNITS'], [70, 4],
      [0, 'ENDSEC'],
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LINE'], [8, '0'], [10, 1000], [20, 500], [11, 2000], [21, 500],
      [0, 'TEXT'], [8, '0'], [10, 1500], [20, 500], [40, 250], [1, 'Cota'],
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    const resultado = parseDxfText(dxf);
    expect(resultado.unit).toBe('mm');
    expect(resultado.unitScale).toBeCloseTo(0.001);
    expect(resultado.paths[0]!.pts[0]!.x).toBeCloseTo(1);
    expect(resultado.paths[0]!.pts[0]!.y).toBeCloseTo(0.5);
    expect(resultado.texts[0]!.height).toBeCloseTo(0.25);
    expect(resultado.extents.min.x).toBeCloseTo(1);
    expect(resultado.extents.min.y).toBeCloseTo(0.5);
    expect(resultado.extents.max.x).toBeCloseTo(2);
    expect(resultado.extents.max.y).toBeCloseTo(0.5);
  });

  it('sem $INSUNITS, assume metros', () => {
    const dxf = montar([
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'LINE'], [8, '0'], [10, 3], [20, 4], [11, 5], [21, 6],
      [0, 'ENDSEC'], [0, 'EOF'],
    ]);
    const resultado = parseDxfText(dxf);
    expect(resultado.unit).toBe('m');
    expect(resultado.unitScale).toBe(1);
    expect(resultado.paths[0]!.pts[1]).toEqual({ x: 5, y: 6 });
  });
});

describe('entidades não suportadas e MTEXT', () => {
  it('HATCH gera um aviso por tipo e não quebra o parse', () => {
    const dxf = montar([
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'HATCH'], [8, '0'], [10, 0], [20, 0], [2, 'SOLID'], [70, 1],
      [0, 'HATCH'], [8, '0'], [10, 1], [20, 1], [2, 'SOLID'], [70, 1],
      [0, 'LINE'], [8, '0'], [10, 0], [20, 0], [11, 1], [21, 0],
      [0, 'ENDSEC'], [0, 'EOF'],
    ]);
    const resultado = parseDxfText(dxf);
    expect(resultado.warnings.filter((w) => w.includes('HATCH'))).toHaveLength(1);
    expect(resultado.paths).toHaveLength(1);
  });

  it('MTEXT junta os fragmentos 3 + 1, tira a formatação e decodifica o acento', () => {
    const dxf = montar([
      [0, 'SECTION'], [2, 'ENTITIES'],
      [0, 'MTEXT'], [8, 'TXT'], [10, 1], [20, 2], [40, 0.3], [50, 1.5707963267948966],
      [3, 'Sala \\fArial|b0|i0;de'], [3, ' estar\\Pcom {açaí}'], [1, ' \\U+00E7'],
      [0, 'ENDSEC'], [0, 'EOF'],
    ]);
    const resultado = parseDxfText(dxf);
    expect(resultado.texts).toHaveLength(1);
    expect(resultado.texts[0]!.text).toBe('Sala de estar\ncom açaí ç');
    expect(resultado.texts[0]!.rotation).toBeCloseTo(90);
    expect(resultado.texts[0]!.height).toBeCloseTo(0.3);
  });
});
