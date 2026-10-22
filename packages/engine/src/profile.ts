import { dot, intersection, multiArea, orientedRect, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { profileHeightAt, type ProfilePoint } from '@hestia/model';
import type { LayerBand } from './types.ts';

const EPS = 1e-7;
/** Meia-largura (m) das tiras de recorte: bem maior que qualquer parede. */
const STRIP_HALF = 50;

/** Altura relativa do topo da faixa no ponto `p` (plano inclinado, se houver; senão `z1`). */
export function bandTopAt(band: LayerBand, p: Vec2): number {
  const s = band.slope;
  if (!s) return band.z1;
  const k = (dot({ x: p.x - s.o.x, y: p.y - s.o.y }, s.d) - s.t0) / (s.t1 - s.t0);
  return s.h0 + (s.h1 - s.h0) * k;
}

/** Volume da faixa: área × altura média; no plano inclinado, a altura no centroide da área. */
export function bandVolume(band: LayerBand): number {
  const area = multiArea(band.poly);
  if (!band.slope || area < 1e-12) return area * (band.z1 - band.z0);
  let cx = 0;
  let cy = 0;
  for (const poly of band.poly) {
    const outer = poly[0];
    if (!outer) continue;
    // Centroide do anel externo menos os furos, ponderado pela área com sinal.
    poly.forEach((ring, i) => {
      let a2 = 0;
      let sx = 0;
      let sy = 0;
      for (let j = 0; j < ring.length; j++) {
        const p = ring[j]!;
        const q = ring[(j + 1) % ring.length]!;
        const c = p.x * q.y - q.x * p.y;
        a2 += c;
        sx += (p.x + q.x) * c;
        sy += (p.y + q.y) * c;
      }
      if (Math.abs(a2) < 1e-15) return;
      const sign = i === 0 ? 1 : -1;
      const w = (Math.abs(a2) / 2) * sign;
      cx += (sx / (3 * a2)) * w;
      cy += (sy / (3 * a2)) * w;
    });
  }
  return area * (bandTopAt(band, { x: cx / area, y: cy / area }) - band.z0);
}

interface Seg {
  ta: number;
  tb: number;
  fa: number;
  fb: number;
}

/** Quebra o perfil em trechos lineares entre `lo` e `hi`, também nos pontos em que ele cruza as alturas `zs`. */
function segments(pts: ProfilePoint[], lo: number, hi: number, zs: number[]): Seg[] {
  const ts = [...new Set([lo, hi, ...pts.map((q) => Math.min(hi, Math.max(lo, q.t)))])].sort((a, b) => a - b);
  const out: Seg[] = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    const ta = ts[i]!;
    const tb = ts[i + 1]!;
    if (tb - ta < EPS) continue;
    const fa = profileHeightAt(pts, ta);
    const fb = profileHeightAt(pts, tb - EPS * 1e-3);
    const cuts = zs
      .filter((z) => (fa - z) * (fb - z) < 0)
      .map((z) => ta + ((z - fa) / (fb - fa)) * (tb - ta))
      .sort((x, y) => x - y);
    const edges = [ta, ...cuts, tb];
    for (let j = 0; j + 1 < edges.length; j++) {
      const sa = edges[j]!;
      const sb = edges[j + 1]!;
      const f = (t: number): number => (tb - ta < EPS ? fa : fa + ((fb - fa) * (t - ta)) / (tb - ta));
      out.push({ ta: sa, tb: sb, fa: f(sa), fb: f(sb) });
    }
  }
  return out;
}

/**
 * Corta as faixas de uma parede reta pelo perfil superior. O polígono em planta é fatiado por retas
 * perpendiculares ao eixo nos pontos do perfil (e onde ele cruza z0/z1 da faixa); cada fatia fica inteira,
 * some, tem topo plano mais baixo ou ganha topo inclinado (`slope`).
 */
export function clipBandsToProfile(bands: LayerBand[], a: Vec2, u: Vec2, length: number, pts: ProfilePoint[]): LayerBand[] {
  const lo = Math.min(-1, ...pts.map((q) => q.t));
  const hi = Math.max(length + 1, ...pts.map((q) => q.t));
  const out: LayerBand[] = [];
  const strip = (ta: number, tb: number): MultiPolygon => [[orientedRect(a.x + u.x * ((ta + tb) / 2), a.y + u.y * ((ta + tb) / 2), u.x, u.y, (tb - ta) / 2, STRIP_HALF)]];
  for (const band of bands) {
    const segs = segments(pts, lo, hi, [band.z0, band.z1]);
    // Agrupa trechos vizinhos de mesma altura (inteiros ou com o mesmo topo plano) para não fatiar à toa.
    let group: { ta: number; tb: number; z1: number } | null = null;
    const flush = (): void => {
      if (!group) return;
      const poly = intersection(band.poly, strip(group.ta, group.tb));
      if (poly.length) out.push({ z0: band.z0, z1: group.z1, poly });
      group = null;
    };
    for (const s of segs) {
      const mn = Math.min(s.fa, s.fb);
      const mx = Math.max(s.fa, s.fb);
      if (mn >= band.z1 - EPS) {
        if (group && Math.abs(group.z1 - band.z1) < EPS && Math.abs(group.tb - s.ta) < EPS) group.tb = s.tb;
        else {
          flush();
          group = { ta: s.ta, tb: s.tb, z1: band.z1 };
        }
      } else if (mx <= band.z0 + EPS) {
        flush();
      } else if (mx - mn < EPS) {
        if (group && Math.abs(group.z1 - mn) < EPS && Math.abs(group.tb - s.ta) < EPS) group.tb = s.tb;
        else {
          flush();
          group = { ta: s.ta, tb: s.tb, z1: mn };
        }
      } else {
        flush();
        const poly = intersection(band.poly, strip(s.ta, s.tb));
        if (poly.length) out.push({ z0: band.z0, z1: mx, poly, slope: { o: a, d: u, t0: s.ta, t1: s.tb, h0: s.fa, h1: s.fb } });
      }
    }
    flush();
  }
  return out;
}

/**
 * Corta as faixas de uma parede reta pela base (perfil inferior derivado de `wallZRange`, decisão 0023 §6): o que fica
 * abaixo da cota do perfil sai, e a faixa passa a começar nela. O perfil é em degraus (cada trecho com uma cota, e a
 * mudança na borda do contorno), então cada trecho vira uma faixa de base plana. Intervalos fora dos pontos usam a cota
 * do ponto mais próximo, como em `profileHeightAt`.
 */
export function clipBandsToBottom(bands: LayerBand[], a: Vec2, u: Vec2, length: number, pts: ProfilePoint[]): LayerBand[] {
  const lo = Math.min(-1, ...pts.map((q) => q.t));
  const hi = Math.max(length + 1, ...pts.map((q) => q.t));
  const cuts = [...new Set([lo, hi, ...pts.map((q) => Math.min(hi, Math.max(lo, q.t)))])].sort((x, y) => x - y);
  const strip = (ta: number, tb: number): MultiPolygon => [[orientedRect(a.x + u.x * ((ta + tb) / 2), a.y + u.y * ((ta + tb) / 2), u.x, u.y, (tb - ta) / 2, STRIP_HALF)]];
  const out: LayerBand[] = [];
  for (const band of bands) {
    let group: { ta: number; tb: number; z0: number } | null = null;
    const flush = (): void => {
      if (!group) return;
      const poly = intersection(band.poly, strip(group.ta, group.tb));
      if (poly.length) out.push({ z0: group.z0, z1: band.z1, poly, ...(band.slope ? { slope: band.slope } : {}) });
      group = null;
    };
    for (let i = 0; i + 1 < cuts.length; i++) {
      const ta = cuts[i]!;
      const tb = cuts[i + 1]!;
      if (tb - ta < EPS) continue;
      const h = profileHeightAt(pts, (ta + tb) / 2);
      if (h >= band.z1 - EPS) {
        flush();
        continue;
      }
      const z0 = Math.max(band.z0, h);
      if (group && Math.abs(group.z0 - z0) < EPS && Math.abs(group.tb - ta) < EPS) group.tb = tb;
      else {
        flush();
        group = { ta, tb, z0 };
      }
    }
    flush();
  }
  return out;
}
