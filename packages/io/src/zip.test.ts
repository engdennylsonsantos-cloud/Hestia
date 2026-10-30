import { describe, expect, it } from 'vitest';
import { createZip, type ZipFile } from './zip.ts';

interface Parsed {
  name: string;
  data: Uint8Array;
  method: number;
  crc: number;
}

/** Leitor mínimo do ZIP do teste: EOCD → diretório central → cabeçalho local de cada entrada. */
function parseZip(zip: Uint8Array): Parsed[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('EOCD ausente');
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out: Parsed[] = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('entrada do diretório central inválida');
    const method = view.getUint16(at + 10, true);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 24, true);
    const nameLen = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const localAt = view.getUint32(at + 42, true);
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLen));
    const localNameLen = view.getUint16(localAt + 26, true);
    const localExtra = view.getUint16(localAt + 28, true);
    const start = localAt + 30 + localNameLen + localExtra;
    out.push({ name, data: zip.subarray(start, start + size), method, crc });
    at += 46 + nameLen + extra + comment;
  }
  return out;
}

const text = (u: Uint8Array): string => new TextDecoder().decode(u);
const FIXED = new Date(Date.UTC(2026, 9, 30, 12, 0, 0));

describe('createZip', () => {
  it('empacota os arquivos na ordem, com nome e conteúdo preservados', () => {
    const files: ZipFile[] = [
      { path: 'PLANTAS/PLANTA-Terreo.dxf', data: '0\nSECTION\n' },
      { path: 'manifest.csv', data: 'arquivo;tipo\r\n' },
      { path: 'LEIA-ME.txt', data: 'R2000' },
    ];
    const parsed = parseZip(createZip(files, FIXED));
    expect(parsed.map((p) => p.name)).toEqual(['PLANTAS/PLANTA-Terreo.dxf', 'manifest.csv', 'LEIA-ME.txt']);
    expect(parsed.map((p) => text(p.data))).toEqual(['0\nSECTION\n', 'arquivo;tipo\r\n', 'R2000']);
    for (const p of parsed) expect(p.method).toBe(0);
  });

  it('aceita nome com acento (UTF-8) e normaliza a barra invertida', () => {
    const parsed = parseZip(createZip([{ path: 'PLANTAS\\PLANTA-Térreo.dxf', data: 'x' }], FIXED));
    expect(parsed[0]!.name).toBe('PLANTAS/PLANTA-Térreo.dxf');
    expect(text(parsed[0]!.data)).toBe('x');
  });

  it('aceita bytes e arquivo vazio', () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const parsed = parseZip(createZip([{ path: 'a.bin', data: bytes }, { path: 'vazio.txt', data: '' }], FIXED));
    expect([...parsed[0]!.data]).toEqual([0, 1, 2, 255]);
    expect(parsed[1]!.data.length).toBe(0);
  });

  it('grava o mesmo CRC no cabeçalho local e no diretório central', () => {
    const parsed = parseZip(createZip([{ path: 'a.txt', data: 'abc' }], FIXED));
    // CRC-32 de "abc" é 0x352441C2 (valor de referência).
    expect(parsed[0]!.crc).toBe(0x352441c2);
  });

  it('é determinístico com a mesma data e muda de tamanho com outra data', () => {
    const files: ZipFile[] = [{ path: 'a.txt', data: 'abc' }];
    expect(createZip(files, FIXED)).toEqual(createZip(files, FIXED));
    expect(createZip(files, new Date(Date.UTC(2027, 0, 1)))).not.toEqual(createZip(files, FIXED));
  });

  it('com lista vazia gera só o EOCD válido', () => {
    const zip = createZip([], FIXED);
    expect(zip.length).toBe(22);
    expect(parseZip(zip)).toEqual([]);
  });

  it('recusa lista grande demais', () => {
    expect(() => createZip(Array.from({ length: 0x10000 }, (_, i) => ({ path: `${i}.txt`, data: '' })), FIXED)).toThrow('entradas demais');
  });
});
