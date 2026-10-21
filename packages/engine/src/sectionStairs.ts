import { add, dot, intersection, mul, norm, perp, sub, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import type { Id } from '@hestia/model';
import type { ResolvedStair, ResolvedStairRiser } from './stairs.ts';
import type { SectionBeyond } from './section.ts';
import { EPS_T, lineIntervals, rect, sectionFrame, type SectionLine } from './sectionGeom.ts';

/**
 * Escadas no corte e na elevação (decisão 0011 §6). Cada degrau e patamar é um bloco em planta entre as cotas z0 e z1
 * (degrau: z − profundidade até z; patamar: z − `landingThickness` até z). No plano de corte, o bloco vira um
 * retângulo sobre o intervalo que a linha atravessa, e a união dos blocos forma o "dente de serra" do lance. Os espelhos
 * do tipo montado são lâminas de `riserThickness` atrás da linha de espelho; no monolítico a espessura é 0 e o espelho
 * é a face do próprio bloco. Além do plano, cada bloco e lâmina projeta-se em (t, z) como os pisos e as lajes.
 */
export interface StairSection {
  cut: Array<{ materialId: Id; polygon: Polygon }>;
  beyond: SectionBeyond[];
  /** Cotas extremas (Infinity/−Infinity sem escada na linha). */
  zMin: number;
  zMax: number;
}

/** Bloco de escada: anel em planta entre as cotas z0 (base) e z1 (topo). */
export interface StairBlock {
  ring: Ring;
  z0: number;
  z1: number;
}

/**
 * Lâminas dos espelhos de cada lance (tipo montado). O espelho k sai da linha do espelho e ocupa `rt` no sentido de
 * baixo, sobre o degrau anterior, entre as cotas z0 e z1 do próprio espelho. O sentido de subida vem da caminhada
 * dentro do lance (até o espelho seguinte, ou do anterior no último). Lance com um só espelho não tem sentido: sem lâmina.
 */
export function riserBoards(risers: ResolvedStairRiser[], rt: number): StairBlock[] {
  if (!(rt > EPS_T)) return [];
  const runs = new Map<number, ResolvedStairRiser[]>();
  for (const r of risers) runs.set(r.componentIndex, [...(runs.get(r.componentIndex) ?? []), r]);
  const out: StairBlock[] = [];
  for (const list of runs.values()) {
    if (list.length < 2) continue;
    const mids = list.map((r) => ({ x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 }));
    list.forEach((r, i) => {
      const up = i + 1 < list.length ? sub(mids[i + 1]!, mids[i]!) : sub(mids[i]!, mids[i - 1]!);
      let nrm = perp(norm(sub(r.b, r.a)));
      if (dot(nrm, up) < 0) nrm = mul(nrm, -1);
      const off = mul(nrm, -rt);
      out.push({ ring: [r.a, r.b, add(r.b, off), add(r.a, off)], z0: r.z0, z1: r.z1 });
    });
  }
  return out;
}

/** Profundidade do degrau (m): estrutural no monolítico, espessura do piso no montado. */
const treadDepthOf = (runStyle: 'monolithic' | 'assembled', structuralDepth: number, treadThickness: number): number =>
  runStyle === 'monolithic' ? structuralDepth : treadThickness;

/** Corte e projeção das escadas do nível para a linha de corte (ou de elevação, com `depth` grande). */
export function sectionOfStairs(stairs: ResolvedStair[], line: SectionLine): StairSection {
  const out: StairSection = { cut: [], beyond: [], zMin: Infinity, zMax: -Infinity };
  const { length, d, n, slab } = sectionFrame(line);
  if (length < 1e-6 || stairs.length === 0) return out;
  const along = (v: Vec2): number => (v.x - line.a.x) * d.x + (v.y - line.a.y) * d.y;
  const dist2 = (v: Vec2): number => (v.x - line.a.x) * n.x + (v.y - line.a.y) * n.y;

  for (const s of stairs) {
    const materialId = s.type.materialId;
    const depth = treadDepthOf(s.type.runStyle, s.type.structuralDepth, s.type.treadThickness);
    const blocks: StairBlock[] = [];
    for (const st of s.steps) {
      const t = st.kind === 'landing' ? s.type.landingThickness : depth;
      if (t > EPS_T) blocks.push({ ring: st.polygon, z0: st.z - t, z1: st.z });
    }
    blocks.push(...riserBoards(s.risers, s.type.riserThickness));

    for (const b of blocks) {
      // Corte: cada intervalo que a linha atravessa vira um retângulo (t × z) do material do tipo.
      for (const [t0, t1] of lineIntervals([b.ring], line.a, d, n)) {
        const lo = Math.max(0, t0);
        const hi = Math.min(length, t1);
        if (hi - lo < EPS_T) continue;
        out.cut.push({ materialId, polygon: [rect(lo, hi, b.z0, b.z1)] });
        out.zMin = Math.min(out.zMin, b.z0);
        out.zMax = Math.max(out.zMax, b.z1);
      }
      // Além do plano (dentro da visão): projeção do bloco, do mais longe ao mais perto pelo `depth`.
      for (const sp of intersection([[b.ring]], slab)) {
        const outer = sp[0];
        if (!outer || outer.length < 3) continue;
        const ts = outer.map(along);
        const tMin = Math.max(0, Math.min(...ts));
        const tMax = Math.min(length, Math.max(...ts));
        if (tMax - tMin < EPS_T) continue;
        out.beyond.push({
          stairId: s.id,
          materialId,
          layerIndex: 0,
          depth: Math.max(0, Math.min(...outer.map(dist2))),
          polygons: [[rect(tMin, tMax, b.z0, b.z1)]],
        });
        out.zMin = Math.min(out.zMin, b.z0);
        out.zMax = Math.max(out.zMax, b.z1);
      }
    }
  }
  return out;
}
