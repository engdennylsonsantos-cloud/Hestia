import type { Vec2 } from '@hestia/geom';
import { DARK, LIGHT, type PlanDrawList, type StrokeOp } from '@hestia/render';

/** Caixa em coordenadas do modelo (metros): o enquadramento da prévia. */
export interface DrawBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DrawListToSvgOptions {
  /** Tamanho do SVG em pixels de tela. Padrão 480 × 360. */
  width?: number;
  height?: number;
  /** Folga em pixels entre a caixa e a borda do SVG. Padrão 6. */
  padPx?: number;
  /** Rótulos de texto da planta (desligados: a prévia usa só o desenho). */
  labels?: boolean;
  /** Rótulo acessível do SVG. */
  title?: string;
}

/**
 * Cores de tema (claro e escuro) que viram variáveis CSS no SVG. Os preenchimentos de material continuam com a cor do
 * material; os traços e as cores de anotação saem sempre por variável, para acompanharem o tema do diálogo.
 */
const THEME_VARS = new Map<string, string>([
  ...[LIGHT, DARK].flatMap((t): Array<[string, string]> => [
    [t.bg, 'var(--sheet)'],
    [t.ink, 'var(--fg)'],
    [t.inkSoft, 'var(--fg-soft)'],
    [t.accent, 'var(--accent)'],
    [t.guide, 'var(--warn)'],
    [t.select, 'var(--select)'],
    [t.underlay, 'var(--fg-faint)'],
    [t.gridMinor, 'var(--line)'],
    [t.gridMajor, 'var(--line-strong)'],
  ]),
]);

const HEX = /^#[0-9a-f]{6}$/i;

function hexNumber(color: string): number {
  if (!HEX.test(color)) return Number.NaN;
  return parseInt(color.slice(1), 16);
}

/** Tons semânticos para os traços: um cinza misturado de tinta continua sendo tinta (variável), não uma cor fixa. */
const STROKE_TONES: ReadonlyArray<{ at: number; css: string }> = [LIGHT, DARK].flatMap((t) => [
  { at: hexNumber(t.ink), css: 'var(--fg)' },
  { at: hexNumber(t.inkSoft), css: 'var(--fg-soft)' },
  { at: hexNumber(t.accent), css: 'var(--accent)' },
  { at: hexNumber(t.guide), css: 'var(--warn)' },
  { at: hexNumber(t.select), css: 'var(--select)' },
  { at: hexNumber(t.underlay), css: 'var(--fg-faint)' },
]);

function distance(a: number, b: number): number {
  const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
  const db = (a & 255) - (b & 255);
  return dr * dr + dg * dg + db * db;
}

/** Cor de traço: tema exato ou o tom semântico mais próximo (misturas de tinta continuam sendo variável de tema). */
export function strokeColor(color: string): string {
  const exact = THEME_VARS.get(color.toLowerCase());
  if (exact) return exact;
  const n = hexNumber(color);
  if (!Number.isFinite(n)) return color;
  let best = STROKE_TONES[0]!;
  let bestD = Number.POSITIVE_INFINITY;
  for (const tone of STROKE_TONES) {
    if (!Number.isFinite(tone.at)) continue;
    const d = distance(n, tone.at);
    if (d < bestD) {
      best = tone;
      bestD = d;
    }
  }
  return best.css;
}

/** Cor de preenchimento: as de tema viram variável; as de material continuam a cor do material. */
export function fillColor(color: string): string {
  return THEME_VARS.get(color.toLowerCase()) ?? color;
}

const fmt = (n: number): string => {
  const s = n.toFixed(2);
  return s.replace(/\.?0+$/, '') || '0';
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const EMPTY_BOX: DrawBox = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

/** Caixa de todos os traços e preenchimentos da lista (ignora rótulos de texto). */
export function drawListBox(list: PlanDrawList): DrawBox | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const take = (p: Vec2): void => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  };
  for (const f of list.fills) for (const poly of f.polygons) for (const ring of poly) for (const p of ring) take(p);
  for (const s of list.strokes) for (const p of s.pts) take(p);
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function expand(box: DrawBox, margin: number): DrawBox {
  return { minX: box.minX - margin, minY: box.minY - margin, maxX: box.maxX + margin, maxY: box.maxY + margin };
}

interface Mapper {
  x: (v: number) => number;
  y: (v: number) => number;
}

/** Escala que caiba na caixa, com a mesma proporção nos dois eixos e centrada na área. */
function mapperFor(box: DrawBox, width: number, height: number, pad: number): Mapper {
  const spanX = Math.max(1e-6, box.maxX - box.minX);
  const spanY = Math.max(1e-6, box.maxY - box.minY);
  const innerW = Math.max(1, width - 2 * pad);
  const innerH = Math.max(1, height - 2 * pad);
  const k = Math.min(innerW / spanX, innerH / spanY);
  const ox = pad + (innerW - spanX * k) / 2 - box.minX * k;
  const oy = pad + (innerH - spanY * k) / 2 + box.maxY * k;
  return { x: (v) => ox + v * k, y: (v) => oy - v * k };
}

function pathOf(rings: ReadonlyArray<ReadonlyArray<Vec2>>, map: Mapper): string {
  const parts: string[] = [];
  for (const ring of rings) {
    if (ring.length === 0) continue;
    const pts = ring.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(map.x(p.x))} ${fmt(map.y(p.y))}`);
    parts.push(`${pts.join(' ')} Z`);
  }
  return parts.join(' ');
}

function lineOf(pts: ReadonlyArray<Vec2>, closed: boolean, map: Mapper): string {
  if (pts.length === 0) return '';
  const out = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fmt(map.x(p.x))} ${fmt(map.y(p.y))}`);
  if (closed) out.push('Z');
  return out.join(' ');
}

function hatchPatternId(kind: string, color: string): string {
  return `hestia-${kind}-${color.replace(/[^0-9a-z]/gi, '').toLowerCase()}`;
}

function hatchDef(kind: string, color: string): string {
  const id = hatchPatternId(kind, color);
  const c = esc(fillColor(color));
  if (kind === 'solid') return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${c}"/></pattern>`;
  const content =
    kind === 'dots'
      ? `<circle cx="3" cy="3" r="0.8" fill="${c}"/>`
      : `<path d="M0 6L6 0${kind === 'cross' ? 'M0 0L6 6' : ''}" stroke="${c}" stroke-width="0.8" fill="none"/>`;
  return `<pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">${content}</pattern>`;
}

/**
 * Converte a lista de desenho do projeto (planta, corte ou elevação) em SVG. `box` é o enquadramento em metros; sem
 * ela, usa a caixa de todos os traços e preenchimentos. Os rótulos de texto da planta ficam de fora (a prévia é só o
 * desenho), e cada preenchimento/traço leva `data-op` para a contagem nos testes.
 */
export function drawListToSvg(list: PlanDrawList, box?: DrawBox | null, options: DrawListToSvgOptions = {}): string {
  const width = Math.max(1, options.width ?? 480);
  const height = Math.max(1, options.height ?? 360);
  const pad = Math.max(0, options.padPx ?? 6);
  const frame = box ?? drawListBox(list) ?? EMPTY_BOX;
  const map = mapperFor(frame, width, height, pad);
  const defs: string[] = [];
  const usedPatterns = new Set<string>();
  const fills: string[] = [];
  const strokes: string[] = [];
  for (const f of list.fills) {
    const d = pathOf(f.polygons.flatMap((poly) => poly), map);
    if (!d) continue;
    const color = fillColor(f.color);
    const hatch = f.hatch;
    let fill = color;
    if (hatch) {
      const id = hatchPatternId(hatch.kind, hatch.color);
      if (!usedPatterns.has(id)) {
        usedPatterns.add(id);
        defs.push(hatchDef(hatch.kind, hatch.color));
      }
      fill = `url(#${id})`;
    }
    const opacity = f.alpha < 1 ? ` fill-opacity="${fmt(Math.max(0, f.alpha))}"` : '';
    fills.push(`<path data-op="fill" d="${d}" fill="${esc(fill)}"${opacity} fill-rule="evenodd"/>`);
  }
  for (const s of list.strokes) {
    const d = lineOf(s.pts, s.closed, map);
    if (!d) continue;
    const color = strokeColor(s.color);
    const opacity = s.alpha < 1 ? ` stroke-opacity="${fmt(Math.max(0, s.alpha))}"` : '';
    const dash = s.dash ? ` stroke-dasharray="${fmt(s.dash[0])} ${fmt(s.dash[1])}"` : '';
    const strokeWidth = fmt(Math.max(0.6, Math.min(8, s.widthPx)));
    strokes.push(
      `<path data-op="stroke" d="${d}" fill="none" stroke="${esc(color)}" stroke-width="${strokeWidth}"${opacity}${dash} stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  const title = options.title ? `<title>${esc(options.title)}</title>` : '';
  const label = options.title ? ` aria-label="${esc(options.title)}"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img"${label}>${title}${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${fills.join('')}${strokes.join('')}</svg>`;
}

/** `StrokeOp` do render com a cor de traço já resolvida para tema (utilitário de teste e de outras prévias). */
export function themedStroke(s: StrokeOp): StrokeOp {
  return { ...s, color: strokeColor(s.color) };
}

export { expand as expandDrawBox };
