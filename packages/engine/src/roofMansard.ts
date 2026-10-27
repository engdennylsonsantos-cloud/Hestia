import { asMulti, difference, dot, intersection, multiArea, sub, type Vec2 } from '@hestia/geom';
import type { RoofMansard } from '@hestia/model';
import { perpOf, WATER_MIN_AREA } from './roofGeom.ts';
import type { ResolvedRoofPlane } from './roofs.ts';
import type { WaterSolution } from './roofSkeleton.ts';

const fmtM = (v: number): string => v.toFixed(2).replace('.', ',');

/** Faixa da água a menos de `run` do beiral: retângulo no sistema (distância à aresta, ao longo da aresta) da água. */
function stripOf(pl: ResolvedRoofPlane, run: number): Vec2[] {
  const t = perpOf(pl.up);
  const pts = pl.polygon.flat(2);
  const ts = pts.map((v) => dot(sub(v, pl.origin), t));
  const t0 = Math.min(...ts) - 1;
  const t1 = Math.max(...ts) + 1;
  const at = (d: number, s: number): Vec2 => ({
    x: pl.origin.x + pl.up.x * d + t.x * s,
    y: pl.origin.y + pl.up.y * d + t.y * s,
  });
  return [at(-1, t0), at(run, t0), at(run, t1), at(-1, t1)];
}

/**
 * Mansarda: corta cada água do esqueleto pela linha de desnível (a `run` do beiral, medida na normal da aresta) e devolve
 * duas águas por aresta, a de baixo com `lowerPercent` e a de cima com `upperPercent`. A altura é contínua: h(d) = lower·d
 * até `run`; depois lower·run + upper·(d − run). `water` deve vir do esqueleto com pesos iguais (qualquer valor), para que
 * a altura dependa só da distância à aresta e as águas vizinhas se encontrem na mesma cota. A água de cima mantém a
 * origem da aresta, com a cota do desnível embutida em `z0`.
 */
export function applyMansard(water: WaterSolution, m: RoofMansard): WaterSolution {
  if (water.problem || water.planes.length === 0) return water;
  const reach = Math.min(...water.planes.map((pl) => Math.max(...pl.polygon.flat(2).map((v) => dot(sub(v, pl.origin), pl.up)))));
  if (m.run >= reach - 1e-9) {
    return { planes: [], problem: `a mansarda não cabe: a faixa de baixo (${fmtM(m.run)} m) chega ao centro do telhado; use menos que ${fmtM(reach)} m` };
  }
  const planes: ResolvedRoofPlane[] = [];
  for (const pl of water.planes) {
    const strip = asMulti(stripOf(pl, m.run));
    const lower = intersection(pl.polygon, strip);
    const upper = difference(pl.polygon, strip);
    if (multiArea(lower) > WATER_MIN_AREA) planes.push({ ...pl, polygon: lower, percent: m.lowerPercent });
    if (multiArea(upper) > WATER_MIN_AREA) {
      planes.push({ ...pl, polygon: upper, percent: m.upperPercent, z0: pl.z0 + ((m.lowerPercent - m.upperPercent) * m.run) / 100 });
    }
  }
  return { ...water, planes };
}
