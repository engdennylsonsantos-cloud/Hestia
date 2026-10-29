import { projectGrids, type Grid } from '@hestia/model';
import { gid, type IfcCtx } from './ifcCtx.ts';
import { localPlacement } from './ifcSolids.ts';
import { list, num, OMIT, ref, stepString } from './ifcStep.ts';
import type { IfcPoint } from './ifcTypes.ts';

/** Trechos usados para amostrar um eixo em arco (`Grid.sag`): 16 dá erro de flecha < 1 mm em vãos usuais. */
export const ARC_SEGMENTS = 16;

const EPS = 1e-9;

/**
 * Pontos do eixo em planta. Grade reta ou multissegmento (`points`) sai como está; grade de dois pontos com `sag` vira a
 * polilinha que amostra o arco (16 trechos, pontas exatas). O IFC não tem arco de grade no formato que o importador do
 * Hestia lê (`IFCPOLYLINE`), então a amostragem é o caminho interoperável; a flecha é perdida na volta.
 */
export function axisPoints(g: Pick<Grid, 'points' | 'sag'>): IfcPoint[] {
  const pts = g.points.map((p) => ({ x: p.x, y: p.y }));
  const sag = Number.isFinite(g.sag) ? g.sag : 0;
  if (pts.length !== 2 || Math.abs(sag) < EPS) return pts;
  const [a, b] = pts as [IfcPoint, IfcPoint];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < EPS) return pts;
  // Flecha limitada a meia corda (arco de até 180°), como na validação do modelo.
  const rise = Math.min(Math.abs(sag), chord / 2);
  if (rise < EPS) return pts;
  const sign = sag < 0 ? -1 : 1;
  const radius = (chord * chord / 4 + rise * rise) / (2 * rise);
  // Normal esquerda de a→b: a flecha positiva fica desse lado e o centro, do oposto.
  const nx = -dy / chord;
  const ny = dx / chord;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx - nx * sign * (radius - rise);
  const cy = my - ny * sign * (radius - rise);
  const angleOf = (p: IfcPoint): number => Math.atan2(p.y - cy, p.x - cx);
  const start = angleOf(a);
  const ccw = ((angleOf(b) - start) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  // O sentido certo é o que passa pelo lado da flecha: compara o meio do arco com o sinal da flecha.
  const midAngle = start + ccw / 2;
  const mid = { x: cx + radius * Math.cos(midAngle), y: cy + radius * Math.sin(midAngle) };
  const side = Math.sign(dx * (mid.y - a.y) - dy * (mid.x - a.x));
  const sweep = side === sign ? ccw : -(2 * Math.PI - ccw);
  const out: IfcPoint[] = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const angle = start + (sweep * i) / ARC_SEGMENTS;
    out.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  // Pontas exatas (o arredondamento do seno/cosseno não muda o eixo que o usuário desenhou).
  out[0] = { x: a.x, y: a.y };
  out[ARC_SEGMENTS] = { x: b.x, y: b.y };
  return out;
}

/** `IFCPOLYLINE` do eixo, com os pontos em coordenadas de mundo (o IFCGRID fica na origem do projeto). */
function axisCurve(c: IfcCtx, g: Grid): number {
  const points = axisPoints(g).map((p) => ref(c.w.add('IFCCARTESIANPOINT', [list([num(p.x), num(p.y)])])));
  return c.w.add('IFCPOLYLINE', [list(points)]);
}

/** Família do eixo pelo nome, no padrão do Revit: letra em U, número em V; o resto (fora do padrão) vai em W. */
export function axisFamily(name: string): 'U' | 'V' | 'W' {
  const tag = name.trim();
  if (tag === '') return 'W';
  if (/^[0-9]/.test(tag)) return 'V';
  if (/^[A-Za-z]/.test(tag)) return 'U';
  return 'W';
}

/**
 * Grades: um `IFCGRID` para o sistema de eixos do projeto, com um `IFCGRIDAXIS(AxisTag, AxisCurve, SameSense)` por grade
 * (`Grid.name` é o `AxisTag`) e o eixo em `UAxes` (letras), `VAxes` (números) ou `WAxes` (nomes fora do padrão), como o
 * Revit e o ArchiCAD exportam. Os eixos vão em coordenadas de mundo; não há containment (grade é do projeto, não do
 * pavimento). O `GlobalId` do sistema sai da primeira grade, na ordem de criação.
 */
export function addGrids(c: IfcCtx): void {
  const grids = projectGrids(c.p).filter((g) => g.points.length >= 2);
  if (grids.length === 0) return;
  const u: number[] = [];
  const v: number[] = [];
  const w: number[] = [];
  for (const g of grids) {
    const axis = c.w.add('IFCGRIDAXIS', [stepString(g.name), ref(axisCurve(c, g)), '.T.']);
    if (axisFamily(g.name) === 'V') v.push(axis);
    else if (axisFamily(g.name) === 'U') u.push(axis);
    else w.push(axis);
  }
  const place = localPlacement(c.w, null, [0, 0, 0]);
  c.w.add('IFCGRID', [
    gid(`grid:${grids[0]!.id}`),
    OMIT,
    stepString('Eixos'),
    OMIT,
    OMIT,
    ref(place),
    OMIT,
    list(u.map(ref)),
    list(v.map(ref)),
    w.length > 0 ? list(w.map(ref)) : OMIT,
    OMIT,
  ]);
}
