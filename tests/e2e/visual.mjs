// Regressão visual por captura (G6): tira a captura de uma tela (página) ou de um elemento (locator) e a compara pixel a pixel
// com tests/e2e/baseline/<name>.png. Sem dependências novas: decodifica e codifica PNG de 8 bits (cinza, cinza+alfa, RGB, RGBA)
// com node:zlib. Um pixel é diferente quando um canal (0–255) passa de PIXEL_THRESHOLD × 255 em relação à baseline; a captura
// falha quando a fração de pixels diferentes passa de `tolerance`.
//   UPDATE_BASELINE=1 node tests/e2e/escadas.mjs   → grava/atualiza as baselines (passa)
//   node tests/e2e/escadas.mjs                     → compara; falha com diff em <SHOTS>/diff/<name>.diff.png
import { deflateSync, inflateSync, crc32 } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BASE = 'tests/e2e/baseline';
/** Diferença máxima por canal, em fração de 255, para um pixel ainda contar como igual (antialiasing). */
const PIXEL_THRESHOLD = 0.1;
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }; // tipo de cor PNG → canais (profundidade 8, sem entrelaçamento)

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decodifica um PNG de 8 bits sem entrelaçamento para RGBA (Buffer de w·h·4 bytes). */
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('não é PNG');
  let w = 0, h = 0, depth = 0, ctype = -1, interlace = 0;
  const idat = [];
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = CHANNELS[ctype];
  if (depth !== 8 || interlace !== 0 || !ch) throw new Error(`PNG não suportado (profundidade ${depth}, tipo ${ctype}, entrelaçado ${interlace})`);
  const stride = w * ch;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = prev[i];
      const c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) v += paeth(a, b, c);
      else if (f !== 0) throw new Error(`filtro PNG ${f} desconhecido`);
      cur[i] = v & 0xff;
    }
    prev = cur;
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const s = p * ch, d = p * 4;
    if (ch <= 2) { rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s]; rgba[d + 3] = ch === 2 ? px[s + 1] : 255; }
    else { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = ch === 4 ? px[s + 3] : 255; }
  }
  return { w, h, rgba };
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
};

/** Codifica RGBA (w·h·4 bytes) em PNG de 8 bits, filtro 0. */
export function encodePng(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** Compara duas imagens decodificadas do mesmo tamanho: devolve a contagem, a fração e a imagem de diferenças. */
function diffImages(exp, got) {
  const n = got.w * got.h;
  const out = Buffer.alloc(n * 4);
  let bad = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    let max = 0;
    for (let k = 0; k < 4; k++) max = Math.max(max, Math.abs(exp.rgba[i + k] - got.rgba[i + k]));
    if (max / 255 > PIXEL_THRESHOLD) {
      bad++;
      out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 255; // vermelho: diferente
    } else {
      const gray = 0.299 * got.rgba[i] + 0.587 * got.rgba[i + 1] + 0.114 * got.rgba[i + 2];
      const v = 255 - (255 - gray) * 0.15; // esmaecido: igual
      out[i] = out[i + 1] = out[i + 2] = v; out[i + 3] = 255;
    }
  }
  return { bad, ratio: bad / n, out };
}

/**
 * Captura `target` (Page ou Locator) e compara com `tests/e2e/baseline/<name>.png`.
 * Devolve `{ ok, ratio, message }` e não lança: quem chama decide (ver `checkShot`).
 * Opções: `tolerance` (fração de pixels diferentes aceita, padrão 0,005) e `out` (pasta das capturas; padrão $SHOTS).
 */
export async function compareShot(target, name, { tolerance = 0.005, out = process.env.SHOTS ?? 'test-results/visual' } = {}) {
  const actual = await target.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, `${name}.png`), actual);
  const file = path.join(BASE, `${name}.png`);

  if (process.env.UPDATE_BASELINE === '1') {
    mkdirSync(BASE, { recursive: true });
    writeFileSync(file, actual);
    const { w, h } = decodePng(actual);
    return { ok: true, ratio: 0, message: `baseline gravada (${w}×${h})` };
  }
  if (!existsSync(file)) return { ok: false, ratio: 1, message: 'baseline ausente: rode com UPDATE_BASELINE=1' };

  const exp = decodePng(readFileSync(file));
  const got = decodePng(actual);
  if (exp.w !== got.w || exp.h !== got.h) {
    writeFileSync(path.join(out, `${name}.actual.png`), actual);
    return { ok: false, ratio: 1, message: `tamanho ${got.w}×${got.h} ≠ baseline ${exp.w}×${exp.h}` };
  }
  const { bad, ratio, out: diff } = diffImages(exp, got);
  const ok = ratio <= tolerance;
  const message = `${(ratio * 100).toFixed(3)}% de pixels diferentes (${bad} px; tolerância ${(tolerance * 100).toFixed(2)}%)`;
  if (!ok) {
    mkdirSync(path.join(out, 'diff'), { recursive: true });
    writeFileSync(path.join(out, `${name}.actual.png`), actual);
    writeFileSync(path.join(out, 'diff', `${name}.diff.png`), encodePng(got.w, got.h, diff));
  }
  return { ok, ratio, message };
}

/** Atalho para os relatórios de `visual`/`escadas`: uma verificação `captura <name> igual à baseline` no passo atual. */
export async function checkShot(rep, target, name, opts) {
  const r = await compareShot(target, name, opts);
  rep.check(`captura ${name} igual à baseline`, r.ok, r.message);
  return r;
}
