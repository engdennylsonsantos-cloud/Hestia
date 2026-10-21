import type { Vec2 } from './vec.ts';

/** Família do símbolo de planta de um vão (mesmos nomes do `PlanSymbol` do model). */
export type OpeningPlanFamily = 'swing' | 'double' | 'sliding' | 'pivot' | 'fixed' | 'tilt' | 'casement';

/** O que o símbolo de planta precisa de um vão. O `OpeningGeometry` do engine cumpre (é um superconjunto). */
export interface OpeningSymbolInput {
  kind: 'door' | 'window';
  center: Vec2;
  /** Direção ao longo da parede. */
  u: Vec2;
  /** Normal à esquerda. */
  n: Vec2;
  width: number;
  thickness: number;
  /** Faixa s da parede em que o vão está. */
  sHi: number;
  sLo: number;
  /** 0 = vão livre: só o recorte e a soleira. */
  leaves: 0 | 1 | 2;
  plan: OpeningPlanFamily;
  flipHand: boolean;
  flipFacing: boolean;
}

/**
 * Um traço do símbolo. `weight` é o fator sobre a espessura base do desenho (1 = traço principal); `tone` diz qual cor:
 * `ink` (traço principal) ou `soft` (secundário: arcos de giro, arco do maxim-ar). `dash` é o tracejado do próprio traço.
 */
export interface OpeningSymbolStroke {
  pts: Vec2[];
  closed: boolean;
  weight: number;
  tone: 'ink' | 'soft';
  dash?: [number, number];
}

const at = (c: Vec2, u: Vec2, n: Vec2, t: number, s: number): Vec2 => ({
  x: c.x + u.x * t + n.x * s,
  y: c.y + u.y * t + n.y * s,
});

/** Arco de `from` a `to` em torno de `center` (o raio é o de `from`), pelo caminho mais curto. */
function arc(center: Vec2, from: Vec2, to: Vec2, steps = 18): Vec2[] {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  let a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let d = a1 - a0;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  a1 = a0 + d;
  const r = Math.hypot(from.x - center.x, from.y - center.y);
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
  }
  return pts;
}

type Line = (pts: Vec2[], closed?: boolean, weight?: number, dash?: [number, number]) => void;
type Rel = (t: number, s: number) => Vec2;

/**
 * Símbolo de planta do vão, por família (`plan`) e número de folhas, como um conjunto de traços. Coordenadas: `t` ao
 * longo da parede, `s` para a esquerda. Função pura: a planta põe as cores (`render/plan/symbols.ts`) e o DXF põe as
 * camadas, então o desenho é o mesmo nos dois.
 */
export function openingSymbolPaths(g: OpeningSymbolInput): OpeningSymbolStroke[] {
  const out: OpeningSymbolStroke[] = [];
  const line: Line = (pts, closed = false, weight = 1, dash) => {
    out.push({ pts, closed, weight, tone: 'ink', ...(dash ? { dash } : {}) });
  };
  const hw = g.width / 2;
  const sMid = (g.sHi + g.sLo) / 2;
  const rel: Rel = (t, s) => at(g.center, g.u, g.n, t, s - sMid);
  // Vão livre: só o recorte e a soleira tracejada no plano médio da parede.
  if (g.leaves === 0) {
    line([rel(-hw, sMid), rel(hw, sMid)], false, 1, [6, 3]);
    return out;
  }
  if (g.kind === 'window') {
    windowSymbol(g, line, rel, hw, sMid, out);
    return out;
  }
  doorSymbol(g, line, rel, hw, out);
  return out;
}

/** Duas faixas de correr: retângulos deslocados em faces opostas, com seta no meio. */
function slidingPanels(g: OpeningSymbolInput, line: Line, rel: Rel, hw: number, sMid: number): void {
  const panel = Math.max(0.02, (g.sHi - g.sLo) * 0.3);
  const rect = (t0: number, t1: number, s0: number, s1: number): Vec2[] => [rel(t0, s0), rel(t1, s0), rel(t1, s1), rel(t0, s1)];
  line(rect(-hw, hw * 0.2, g.sHi - panel, g.sHi), true, 1);
  line(rect(-hw * 0.2, hw, g.sLo, g.sLo + panel), true, 1);
  const tail = hw * 0.6;
  line([rel(-tail, sMid), rel(tail, sMid)], false, 0.8);
  line([rel(tail - hw * 0.15, sMid + hw * 0.08), rel(tail, sMid), rel(tail - hw * 0.15, sMid - hw * 0.08)], false, 0.8);
}

function windowSymbol(g: OpeningSymbolInput, line: Line, rel: Rel, hw: number, sMid: number, out: OpeningSymbolStroke[]): void {
  const sliding = g.plan === 'sliding';
  // Caixilho: as duas faces do vidro e as ombreiras; a linha do meio só nas janelas sem correr.
  line([rel(-hw, g.sHi), rel(hw, g.sHi)]);
  line([rel(-hw, g.sLo), rel(hw, g.sLo)]);
  if (!sliding) line([rel(-hw, sMid), rel(hw, sMid)], false, 0.8);
  line([rel(-hw, g.sHi), rel(-hw, g.sLo)], false, 1.4);
  line([rel(hw, g.sHi), rel(hw, g.sLo)], false, 1.4);
  if (g.plan === 'tilt') {
    // Basculante: uma folha em V, abrindo para dentro pelo topo.
    line([rel(-hw, g.sHi), rel(0, sMid), rel(hw, g.sHi)], false, 0.8);
  } else if (g.plan === 'casement') {
    // Maxim-ar: arco tracejado para o lado de abertura.
    const side = g.flipFacing ? -1 : 1;
    const pts: Vec2[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = -hw + (2 * hw * i) / 18;
      pts.push(rel(t, g.sHi + side * hw * 0.5 * (1 - (t / hw) ** 2)));
    }
    out.push({ pts, closed: false, weight: 0.8, tone: 'soft', dash: [4, 3] });
  } else if (sliding) {
    slidingPanels(g, line, rel, hw, sMid);
  }
}

function doorSymbol(g: OpeningSymbolInput, line: Line, rel: Rel, hw: number, out: OpeningSymbolStroke[]): void {
  const sMid = (g.sHi + g.sLo) / 2;
  // A folha gira para o lado `swing` (+n por padrão); a dobradiça fica no lado `hinge`.
  const swing = g.flipFacing ? -1 : 1;
  const faceS = swing > 0 ? g.sHi : g.sLo;
  const arcLine = (pts: Vec2[]): void => {
    out.push({ pts, closed: false, weight: 0.7, tone: 'soft' });
  };
  if (g.plan === 'sliding') {
    slidingPanels(g, line, rel, hw, sMid);
    return;
  }
  if (g.plan === 'pivot') {
    // Pivotante: eixo vertical no centro do vão; a folha gira de 90° em torno dele.
    const axis = rel(0, sMid);
    const r = Math.max(0.01, g.thickness * 0.2);
    const ring: Vec2[] = [];
    for (let i = 0; i < 12; i++) ring.push({ x: axis.x + Math.cos((i * Math.PI) / 6) * r, y: axis.y + Math.sin((i * Math.PI) / 6) * r });
    line(ring, true, 0.8);
    const open = rel(0, faceS);
    line([axis, open], false, 1.3);
    arcLine(arc(axis, open, rel(hw, sMid)));
    return;
  }
  const leafLen = g.leaves === 2 ? hw : g.width;
  const hinges = g.leaves === 2 ? [-1, 1] : [g.flipHand ? 1 : -1];
  for (const h of hinges) {
    const hingePt = rel(h * hw, faceS);
    const open = rel(h * hw, faceS + swing * leafLen);
    const closedPt = g.leaves === 2 ? rel(0, faceS) : rel(-h * hw, faceS);
    line([hingePt, open], false, 1.3);
    arcLine(arc(hingePt, open, closedPt));
  }
}
