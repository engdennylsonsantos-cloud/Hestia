import { useId, useState, type CSSProperties, type ReactElement } from 'react';
import type {
  DimensionPrim,
  Drawing,
  HatchPattern,
  LabelPrim,
  LineStyle,
  PolygonPrim,
  Prim,
  Pt,
  Rect,
  TextAnchor,
  Tone,
  Weight,
} from './drawing.ts';
import { LINE_H } from './drawing.ts';
import { dimGeometry, labelBox } from './geometry.ts';

export interface SchematicView { id: string; label: string; drawing: Drawing; ariaLabel: string }

export const TONE_VAR: Record<Tone, string> = {
  body: 'var(--fg)',
  ground: 'var(--fg-faint)',
  guide: 'var(--fg-soft)',
  muted: 'var(--fg-faint)',
  accent: 'var(--accent)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

const WEIGHT: Record<Weight, number> = { thin: 1, normal: 1.5, heavy: 2.2 };
/** Tamanho mínimo do texto na prévia (px): abaixo disso a largura mínima do SVG provoca rolagem horizontal. */
const MIN_FONT_PX = 9;
const DASH: Record<LineStyle, string | undefined> = { solid: undefined, dashed: '6 4', dotted: '1.5 3' };
const SHEET = 'var(--sheet)';
const FAINT = 'var(--fg-faint)';

const svgY = (y: number): number => -y;
const pt = (p: Pt): string => `${p[0]} ${svgY(p[1])}`;
const pointsOf = (pts: Pt[]): string => pts.map(pt).join(' ');
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const unit = (a: Pt, b: Pt): Pt => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
};

function arrow(tip: Pt, dir: Pt, len: number, half: number): string {
  const base: Pt = [tip[0] - dir[0] * len, tip[1] - dir[1] * len];
  const px = -dir[1] * half;
  const py = dir[0] * half;
  return `M ${pt(tip)} L ${pt([base[0] + px, base[1] + py])} L ${pt([base[0] - px, base[1] - py])} Z`;
}

function lineEl(
  key: string,
  a: Pt,
  b: Pt,
  tone: Tone,
  weight: Weight,
  lineStyle: LineStyle,
): ReactElement {
  return (
    <line
      key={key}
      x1={a[0]}
      y1={svgY(a[1])}
      x2={b[0]}
      y2={svgY(b[1])}
      stroke={TONE_VAR[tone]}
      strokeWidth={WEIGHT[weight]}
      strokeDasharray={DASH[lineStyle]}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function HatchDef({ id, pattern, em }: { id: string; pattern: HatchPattern; em: number }): ReactElement {
  if (pattern === 'wood') {
    const s = 0.35 * em;
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width={s} height={s}>
        <line x1={0} y1={0} x2={s} y2={0} stroke={FAINT} strokeWidth={1} opacity={0.5} vectorEffect="non-scaling-stroke" />
      </pattern>
    );
  }
  const spacing = pattern === 'concrete' ? 0.45 : pattern === 'ground' ? 0.7 : 0.5;
  const s = spacing * em;
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={s} height={s} patternTransform="rotate(45)">
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={s}
        stroke={FAINT}
        strokeWidth={1}
        opacity={pattern === 'concrete' ? 0.55 : 1}
        vectorEffect="non-scaling-stroke"
      />
      {pattern === 'concrete' ? <circle cx={s / 2} cy={s / 2} r={0.05 * em} fill={FAINT} opacity={0.55} /> : null}
    </pattern>
  );
}

function polygonFill(fill: PolygonPrim['fill']): { fill: string; fillOpacity?: number } {
  if (fill === 'body') return { fill: 'var(--accent-soft)' };
  if (fill === 'soft') return { fill: 'var(--accent-soft)', fillOpacity: 0.5 };
  return { fill: 'none' };
}

function DimGraphics({ d, em }: { d: DimensionPrim; em: number }): ReactElement {
  const g = dimGeometry(d, em);
  const tone: Tone = d.tone === 'body' ? 'guide' : d.tone;
  const color = TONE_VAR[tone];
  const len = Math.hypot(g.dimLine[1][0] - g.dimLine[0][0], g.dimLine[1][1] - g.dimLine[0][1]);
  const u = unit(g.dimLine[0], g.dimLine[1]);
  const outside = len < 2.2 * em;
  const dirA: Pt = outside ? u : [-u[0], -u[1]];
  const dirB: Pt = outside ? [-u[0], -u[1]] : u;
  const children: ReactElement[] = [
    lineEl('dl', g.dimLine[0], g.dimLine[1], tone, 'thin', 'solid'),
    lineEl('e1', g.ext1[0], g.ext1[1], tone, 'thin', 'solid'),
    lineEl('e2', g.ext2[0], g.ext2[1], tone, 'thin', 'solid'),
    <path key="a1" d={arrow(g.dimLine[0], dirA, 0.7 * em, 0.14 * em)} fill={color} />,
    <path key="a2" d={arrow(g.dimLine[1], dirB, 0.7 * em, 0.14 * em)} fill={color} />,
  ];
  if (d.broken) {
    const mid: Pt = [(g.dimLine[0][0] + g.dimLine[1][0]) / 2, (g.dimLine[0][1] + g.dimLine[1][1]) / 2];
    const n: Pt = [-u[1], u[0]];
    const sl = unit([0, 0], [u[0] + n[0], u[1] + n[1]]);
    for (const off of [-0.15, 0.15]) {
      const c: Pt = [mid[0] + u[0] * off * em, mid[1] + u[1] * off * em];
      children.push(
        lineEl(
          `brk${off}`,
          [c[0] - sl[0] * 0.25 * em, c[1] - sl[1] * 0.25 * em],
          [c[0] + sl[0] * 0.25 * em, c[1] + sl[1] * 0.25 * em],
          tone,
          'thin',
          'solid',
        ),
      );
    }
  }
  return <g>{children}</g>;
}

function leaderGraphics(l: LabelPrim, em: number): ReactElement | null {
  if (!l.leader) return null;
  const box: Rect = labelBox(l, em);
  const from: Pt = [clamp(l.leader[0], box.x0, box.x1), clamp(l.leader[1], box.y0, box.y1)];
  const dist = Math.hypot(l.leader[0] - from[0], l.leader[1] - from[1]);
  if (dist < 1e-9) return null;
  const dir = unit(from, l.leader);
  return (
    <g>
      {lineEl('leader', from, l.leader, l.tone, 'thin', 'solid')}
      <path d={arrow(l.leader, dir, 0.7 * em, 0.14 * em)} fill={TONE_VAR[l.tone]} />
    </g>
  );
}

function primGraphics(p: Prim, em: number, hatchId: (id: string) => string): ReactElement | null {
  switch (p.kind) {
    case 'polygon': {
      const f = polygonFill(p.fill);
      return (
        <polygon
          key={p.id}
          points={pointsOf(p.pts)}
          fill={f.fill}
          fillOpacity={f.fillOpacity}
          stroke={TONE_VAR[p.tone]}
          strokeWidth={WEIGHT[p.weight]}
          strokeDasharray={DASH[p.lineStyle]}
          vectorEffect="non-scaling-stroke"
        />
      );
    }
    case 'polyline': {
      const last = p.pts[p.pts.length - 1];
      const prev = p.pts[p.pts.length - 2];
      return (
        <g key={p.id}>
          <polyline
            points={pointsOf(p.pts)}
            fill="none"
            stroke={TONE_VAR[p.tone]}
            strokeWidth={WEIGHT[p.weight]}
            strokeDasharray={DASH[p.lineStyle]}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {p.arrowEnd && last && prev ? (
            <path d={arrow(last, unit(prev, last), 0.9 * em, 0.18 * em)} fill={TONE_VAR[p.tone]} />
          ) : null}
        </g>
      );
    }
    case 'line':
      return (
        <g key={p.id}>
          {lineEl(p.id, p.a, p.b, p.tone, p.weight, p.lineStyle)}
        </g>
      );
    case 'hatch':
      return <polygon key={p.id} points={pointsOf(p.pts)} fill={`url(#${hatchId(p.id)})`} stroke="none" />;
    case 'dimension':
      return <DimGraphics key={p.id} d={p} em={em} />;
    case 'label':
      return <g key={p.id}>{leaderGraphics(p, em)}</g>;
  }
}

function TextBlock({
  id,
  text,
  at,
  anchor,
  tone,
  em,
}: {
  id: string;
  text: string;
  at: Pt;
  anchor: TextAnchor;
  tone: Tone;
  em: number;
}): ReactElement {
  const lines = text.split('\n');
  const baseY = svgY(at[1]) - (lines.length - 1) * 0.575 * em;
  return (
    <text
      key={id}
      fontSize={em}
      fill={TONE_VAR[tone]}
      paintOrder="stroke"
      stroke={SHEET}
      strokeWidth={0.32 * em}
      strokeLinejoin="round"
      fontFamily="var(--font-ui)"
      textAnchor={anchor}
      dominantBaseline="central"
    >
      {/* Cada linha com `y` absoluto: `dy` num tspan com `y` é somado ao mesmo `y` em todas as linhas, e as linhas 2+
          caíam todas no mesmo lugar (o corte da escada perdia "estrutural"/"12,0 cm ⟂"). */}
      {lines.map((line, i) => (
        <tspan key={i} x={at[0]} y={baseY + i * LINE_H * em}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

const rootStyle: CSSProperties = {
  border: '1px solid var(--line)',
  background: 'var(--sheet)',
  borderRadius: 2,
  overflowX: 'auto',
};

export function SchematicDrawing({ drawing, ariaLabel }: { drawing: Drawing; ariaLabel: string }): ReactElement {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const hatchId = (id: string): string => `${uid}_${id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const { frame, em } = drawing;
  const w = frame.x1 - frame.x0;
  const h = frame.y1 - frame.y0;
  const hatchDefs = drawing.prims.filter((p): p is Extract<Prim, { kind: 'hatch' }> => p.kind === 'hatch');
  const textPrims = drawing.prims.filter((p) => p.kind === 'dimension' || p.kind === 'label');
  return (
    <div>
      <div style={rootStyle}>
        <svg
          viewBox={`${frame.x0} ${-frame.y1} ${w} ${h}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={ariaLabel}
          // Texto com pelo menos MIN_FONT_PX: a largura mínima é a que dá esse tamanho de fonte. O fator era 10 px e a
          // prévia dos modais (~360 px) ficava sempre um pouco mais estreita que o mínimo, cortando a direita do desenho
          // (a rampa perdia "h = 0,80 m"/"máx. 0,8…"); com 9 px a prévia cabe inteira e o texto continua legível.
          style={{ display: 'block', height: 'auto', minWidth: Math.ceil((MIN_FONT_PX * w) / em) }}
        >
          <title>{ariaLabel}</title>
          <defs>
            {hatchDefs.map((p) => (
              <HatchDef key={p.id} id={hatchId(p.id)} pattern={p.pattern} em={em} />
            ))}
          </defs>
          {drawing.prims.map((p) => primGraphics(p, em, hatchId))}
          {textPrims.map((p) => {
            if (p.kind === 'dimension') {
              const g = dimGeometry(p, em);
              return <TextBlock key={`t_${p.id}`} id={p.id} text={p.text} at={g.textAt} anchor={g.textAnchor} tone={p.tone} em={em} />;
            }
            return <TextBlock key={`t_${p.id}`} id={p.id} text={p.text} at={p.at} anchor={p.anchor} tone={p.tone} em={em} />;
          })}
        </svg>
      </div>
      {drawing.caption ? <p className="stt-ref" style={{ margin: '4px 0 0' }}>{drawing.caption}</p> : null}
    </div>
  );
}

export function SchematicViews({ views, tabsLabel }: { views: SchematicView[]; tabsLabel: string }): ReactElement {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '_');
  const [active, setActive] = useState<string>(views[0]?.id ?? '');
  if (views.length === 0) return <div />;
  if (views.length === 1) {
    const only = views[0]!;
    return <SchematicDrawing drawing={only.drawing} ariaLabel={only.ariaLabel} />;
  }
  const index = Math.max(0, views.findIndex((v) => v.id === active));
  const current = views[index]!;
  const move = (dir: number): void => {
    const next = views[(index + dir + views.length) % views.length]!;
    setActive(next.id);
  };
  return (
    <div>
      <div role="tablist" aria-label={tabsLabel} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {views.map((v, i) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={`${uid}_tab_${v.id}`}
            aria-selected={v.id === current.id}
            aria-controls={`${uid}_panel`}
            tabIndex={v.id === current.id ? 0 : -1}
            className={`btn small${v.id === current.id ? ' primary' : ''}`}
            onClick={() => setActive(v.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') {
                e.preventDefault();
                move(1);
              } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                move(-1);
              } else if (e.key === 'Home') {
                e.preventDefault();
                setActive(views[0]!.id);
              } else if (e.key === 'End') {
                e.preventDefault();
                setActive(views[views.length - 1]!.id);
              }
            }}
            data-index={i}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}_panel`} aria-labelledby={`${uid}_tab_${current.id}`}>
        <SchematicDrawing drawing={current.drawing} ariaLabel={current.ariaLabel} />
      </div>
    </div>
  );
}
