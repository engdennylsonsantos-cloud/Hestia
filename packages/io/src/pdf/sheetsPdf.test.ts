import { describe, expect, it } from 'vitest';
import { exportSheetsPdf } from './sheetsPdf.ts';
import { textWidthMm, winAnsiCode } from './helvetica.ts';
import type { PdfSheet } from './types.ts';

const sheet = (over: Partial<PdfSheet> = {}): PdfSheet => ({
  widthMm: 420,
  heightMm: 297,
  groups: [
    {
      clip: { x: 20, y: 20, w: 200, h: 150 },
      fills: [{ polygons: [[[{ x: 30, y: 30 }, { x: 70, y: 30 }, { x: 70, y: 60 }, { x: 30, y: 60 }]]], color: '#c8d0da' }],
      paths: [{ pts: [{ x: 0, y: 0 }, { x: 100, y: 0 }], closed: false, widthMm: 0.5, color: '#16181c' }],
      texts: [],
    },
    {
      clip: null,
      fills: [],
      paths: [],
      texts: [{ at: { x: 10, y: 10 }, text: 'Projeto: Casa (rev. 1)', sizeMm: 2.5, rotation: 0, center: false, color: '#16181c' }],
    },
  ],
  ...over,
});

/** Lê o PDF como latin1 (um caractere por byte), para conferir a estrutura. */
const textOf = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
};

/** Confere cada entrada do xref: o offset aponta para "N 0 obj". */
function xrefOffsets(s: string): { offsets: number[]; ok: boolean } {
  const start = Number(/startxref\n(\d+)\n%%EOF/.exec(s)![1]);
  expect(s.slice(start, start + 4)).toBe('xref');
  const lines = s.slice(start).split('\n');
  const count = Number(/^0 (\d+)$/.exec(lines[1]!)![1]);
  const offsets: number[] = [];
  let ok = true;
  for (let i = 1; i < count; i++) {
    const entry = lines[2 + i]!;
    const off = Number(entry.slice(0, 10));
    offsets.push(off);
    if (!s.startsWith(`${i} 0 obj`, off)) ok = false;
  }
  return { offsets, ok };
}

describe('PDF de pranchas', () => {
  it('começa com %PDF-1.4 e termina com %%EOF', () => {
    const s = textOf(exportSheetsPdf([sheet()]));
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
  });

  it('os offsets do xref apontam para "N 0 obj" de cada objeto', () => {
    const s = textOf(exportSheetsPdf([sheet(), sheet()]));
    const { offsets, ok } = xrefOffsets(s);
    expect(offsets.length).toBeGreaterThan(5);
    expect(ok).toBe(true);
  });

  it('uma página por prancha, com o tamanho da folha em pontos', () => {
    const s = textOf(exportSheetsPdf([sheet(), sheet(), sheet()]));
    expect(s.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(s).toContain('/Count 3');
    // A3 deitada: 420 × 297 mm = 1190.551 × 841.890 pt.
    expect(s).toContain(`/MediaBox [0 0 ${(420 * 72 / 25.4).toFixed(3)} ${(297 * 72 / 25.4).toFixed(3)}]`);
  });

  it('linha de 0,5 mm vira 1.417 pt de largura', () => {
    const s = textOf(exportSheetsPdf([sheet()]));
    expect(s).toContain(' 1.417 w ');
    expect(s).toContain(' RG ');
  });

  it('recorte da vista é um retângulo W n dentro do grupo', () => {
    const s = textOf(exportSheetsPdf([sheet()]));
    expect(s).toMatch(/re W n/);
    expect(s).toContain('f*');
  });

  it('textos saem escapados e em WinAnsi (parênteses e acentos)', () => {
    const s = textOf(exportSheetsPdf([sheet()]));
    expect(s).toContain('(Projeto: Casa \\(rev. 1\\)) Tj');
    expect(winAnsiCode('ç')).toBe(0xe7);
    const acento = textOf(exportSheetsPdf([sheet({ groups: [{ clip: null, fills: [], paths: [], texts: [{ at: { x: 0, y: 0 }, text: 'Revisão', sizeMm: 2.5, rotation: 0, center: false, color: '#000000' }] }] })]));
    expect(acento).toContain('(Revis\\343o) Tj');
  });

  it('centralizar usa a largura de Helvetica', () => {
    // "Casa" em Helvetica: C 722 + a 556 + s 500 + a 556 = 2334 milésimos de em; a 10 mm = 23,34 mm.
    expect(textWidthMm('Casa', 10)).toBeCloseTo(23.34, 6);
  });

  it('sem pranchas, ainda sai um PDF válido sem páginas', () => {
    const s = textOf(exportSheetsPdf([]));
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(xrefOffsets(s).ok).toBe(true);
    expect(s).toContain('/Count 0');
  });
});
