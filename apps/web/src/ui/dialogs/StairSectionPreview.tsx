import type { ReactElement } from 'react';
import type { StairRunStyle, StairType } from '@hestia/model';
import { fmtNum, I18N, useI18n } from '../../editor/i18n.ts';
import { stairPostTreads, stairSectionAnchors, stairSectionProfile, type ProfilePoint } from './stairSectionProfile.ts';

const STYLE_KEY: Record<StairRunStyle, 'stt_style_monolithic' | 'stt_style_assembled' | 'stt_style_post'> = {
  monolithic: 'stt_style_monolithic',
  assembled: 'stt_style_assembled',
  post: 'stt_style_post',
};

const fill = (s: string, params: Record<string, string>): string => s.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? '');

/**
 * Corte ilustrativo do tipo de escada: três degraus com o espelho e o piso calculados, o corpo do lance e as cotas
 * (espelho, piso, nariz, espessura e pé-direito mínimo). Os rótulos são HTML sobre o SVG, com tamanho constante; o SVG
 * usa `vector-effect` para os traços não engrossarem. Cores só por tokens; o estado vazio pede espelho e piso.
 */
export function StairSectionPreview({ type, riser, tread }: { type: StairType; riser?: number; tread?: number }): ReactElement {
  const lang = useI18n((s) => s.lang);
  const t = I18N[lang];
  const cm = (m: number, dec = 1): string => fmtNum(m * 100, dec, lang);
  const r = riser ?? type.maxRiser;
  const tp = tread ?? type.minTread;
  if (!(r > 0) || !(tp > 0) || !Number.isFinite(r) || !Number.isFinite(tp)) {
    return <p className="stt-preview-empty">{t.stt_preview_empty}</p>;
  }
  const source = { type, riser: r, tread: tp };
  const post = type.runStyle === 'post';
  const polygons: ProfilePoint[][] = post ? stairPostTreads(source) : [stairSectionProfile(source)];
  const a = stairSectionAnchors(source);
  const all = [...polygons.flat(), [a.riser.x0, a.riser.y1] as ProfilePoint, [a.headroom.x1, a.headroom.y1] as ProfilePoint, [a.thickness.x0, a.thickness.y0] as ProfilePoint];
  const xs = all.map((q) => q[0]);
  const ys = all.map((q) => q[1]);
  const pad = Math.max(0.12, (Math.max(...ys) - Math.min(...ys)) * 0.18);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  const W = maxX - minX;
  const H = maxY - minY;
  const sx = (x: number): string => `${((x - minX) / W) * 100}%`;
  const sy = (y: number): string => `${((maxY - y) / H) * 100}%`;
  const toPts = (poly: ProfilePoint[]): string => poly.map(([x, y]) => `${(x - minX).toFixed(3)},${(maxY - y).toFixed(3)}`).join(' ');
  const tick = Math.max(W, H) * 0.012;
  const dimLine = (key: string, anchor: { x0: number; y0: number; x1: number; y1: number }, danger = false): ReactElement | null => {
    if (Math.abs(anchor.x1 - anchor.x0) + Math.abs(anchor.y1 - anchor.y0) < 1e-9) return null;
    const vertical = Math.abs(anchor.x1 - anchor.x0) < Math.abs(anchor.y1 - anchor.y0);
    const tx = vertical ? tick : 0;
    const ty = vertical ? 0 : tick;
    return (
      <g key={key} stroke={danger ? 'var(--danger)' : 'var(--fg-faint)'} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray={danger ? '4 3' : undefined}>
        <line x1={anchor.x0 - minX} y1={maxY - anchor.y0} x2={anchor.x1 - minX} y2={maxY - anchor.y1} />
        <line x1={anchor.x0 - minX - tx} y1={maxY - anchor.y0 - ty} x2={anchor.x0 - minX + tx} y2={maxY - anchor.y0 + ty} />
        <line x1={anchor.x1 - minX - tx} y1={maxY - anchor.y1 - ty} x2={anchor.x1 - minX + tx} y2={maxY - anchor.y1 + ty} />
      </g>
    );
  };
  const label = (key: string, text: string, x: number, y: number, danger = false): ReactElement => (
    <span key={key} className={`stt-dim${danger ? ' danger' : ''}`} style={{ left: sx(x), top: sy(y) }}>{text}</span>
  );
  const styleName = t[STYLE_KEY[type.runStyle]];
  const aria = fill(t.stt_preview_aria, { riser: cm(r), tread: cm(tp), style: styleName });
  const mid = (x0: number, x1: number): number => (x0 + x1) / 2;
  return (
    <div className="stt-preview">
      <svg viewBox={`0 0 ${W.toFixed(3)} ${H.toFixed(3)}`} width="100%" role="img" aria-label={aria}>
        {polygons.map((poly, i) => (
          <polygon key={i} points={toPts(poly)} fill="var(--accent-soft)" stroke="var(--fg)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <line x1={0} x2={W} y1={maxY - a.floorY} y2={maxY - a.floorY} stroke="var(--fg-faint)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {dimLine('riser', a.riser)}
        {dimLine('tread', a.tread)}
        {dimLine('nosing', a.nosing)}
        {dimLine('thickness', a.thickness)}
        {dimLine('headroom', a.headroom, true)}
      </svg>
      {label('riser', `${t.stt_dim_riser} ${cm(a.riser.value)}`, a.riser.x0, mid(a.riser.y0, a.riser.y1))}
      {label('tread', `${t.stt_dim_tread} ${cm(a.tread.value)}`, mid(a.tread.x0, a.tread.x1), a.tread.y0)}
      {a.nosing.value > 0 ? label('nosing', `${t.stt_dim_nosing} ${cm(a.nosing.value)}`, mid(a.nosing.x0, a.nosing.x1), a.nosing.y0) : null}
      {label('thickness', `${t.stt_dim_thickness} ${cm(a.thickness.value)}`, a.thickness.x0, mid(a.thickness.y0, a.thickness.y1))}
      {label('headroom', `${t.stt_dim_headroom} ${cm(a.headroom.value, 2)}`, mid(a.headroom.x0, a.headroom.x1), a.headroom.y0, true)}
      {label('level', t.stt_preview_level, minX + W * 0.06, a.floorY)}
    </div>
  );
}
