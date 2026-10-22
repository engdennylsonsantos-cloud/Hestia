import { closestOnSegment, intersection, orientedRect, triangulate, union, unionClipper, type MultiPolygon, type Polygon, type Ring, type Vec2 } from '@hestia/geom';
import { coreSpan, openingFamilyOf, openingFrame, openingType, openingsOfWall, wallsOnLevel, type Id, type OpeningFamilyId, type OpeningLeaves, type PlanSymbol, type Project } from '@hestia/model';
import { bandTopAt } from './profile.ts';
import { fuseBands } from './bandFuse.ts';
import { resolveFloors } from './floors.ts';
import { resolveSlabs, slabRiseAt } from './slabs.ts';
import { planeZ, resolveRoofs, type ResolvedRoof } from './roofs.ts';
import { frameOfWall, openingGeometry, resolveLevel } from './resolve.ts';
import { EPS_T, lineIntervals, prismProjection, rect, sectionFrame, type SectionLine } from './sectionGeom.ts';
import { resolveStairsOnLevel } from './stairs.ts';
import { sectionOfStairs } from './sectionStairs.ts';
import { OCCLUSION_RANK, visibleParts, type OcclusionItem } from './sectionOcclusion.ts';
import { clipParts, partsByOrigin, uniqueOrigins, type SectionPart } from './sectionParts.ts';

export { lineIntervals, sectionFrame, type SectionLine } from './sectionGeom.ts';
export { type SectionPart } from './sectionParts.ts';

/**
 * Corte e elevação a partir da geometria já resolvida em faixas (bands).
 *
 * Convenção do desenho: x = distância ao longo da linha (a→b), y = cota (z absoluta). O observador olha para a
 * normal à esquerda da linha; assim x cresce para a direita. Uma elevação é o mesmo cálculo com a linha fora da
 * construção e `depth` grande, onde nada é cortado e tudo é projetado.
 *
 * Linha oculta (como Revit e Archicad): todo elemento opaco (paredes, pisos, lajes, telhados, escadas e aberturas, com
 * caixilho, folha e vidro) esconde o que está atrás dele. O resultado traz só a parte visível de cada item (ver
 * `sectionOcclusion.ts`); o plano de corte é o mais próximo, então o cortado oculta tudo o que está além.
 */

/**
 * Origem de um item da seção: o elemento do modelo de onde ele veio. Preenchido o campo do tipo de origem (parede,
 * piso, laje, telhado, escada ou abertura); os demais ficam ausentes.
 */
export interface SectionOrigin {
  wallId?: Id;
  floorId?: Id;
  slabId?: Id;
  roofId?: Id;
  stairId?: Id;
  openingId?: Id;
}

/**
 * Material cortado no plano de corte, unido por material. `polygons` é a parte visível em (t, z); `sources` lista os
 * elementos de origem que contribuíram (sem repetição) para que a seleção ache o elemento de volta.
 */
export interface SectionRegion {
  materialId: Id;
  /** Polígonos em (t, z), já sem o que está na frente. */
  polygons: MultiPolygon;
  sources: SectionOrigin[];
  /** Peças por origem (decisão 0016 §7): a parte visível de cada elemento do corte unido, para a seleção achar o dono. */
  parts?: SectionPart[];
}

/**
 * Camada de elemento visto além do plano de corte (parede, piso, laje, telhado ou escada). `polygons` é só a parte
 * visível em (t, z); `depth` é a distância do plano ao ponto mais próximo do item inteiro (ordem de oclusão).
 * A lista vem do mais longe ao mais perto (ordem de pintura) e não traz itens totalmente ocultos.
 */
export interface SectionBeyond extends SectionOrigin {
  materialId: Id;
  layerIndex: number;
  /** Distância do plano de corte ao ponto mais próximo. */
  depth: number;
  polygons: MultiPolygon;
}

/**
 * Esquadria do vão no corte e na elevação: família, folhas e espessuras do tipo (`openingFrame`), com a profundidade
 * do batente já limitada ao núcleo da parede. Permite ao desenho montar batente, vidro, folha e símbolos por família.
 */
export interface SectionEsquadria {
  /** Família (`opening.ts`); null quando a combinação (símbolo × folhas) do tipo não existe. */
  family: OpeningFamilyId | null;
  leaves: OpeningLeaves;
  plan: PlanSymbol;
  /** Largura do vão e espessura total da parede anfitriã: distinguem a vista face do corte transversal. */
  width: number;
  thickness: number;
  frameWidth: number;
  frameDepth: number;
  glassThickness: number;
  leafThickness: number;
  flipHand: boolean;
  flipFacing: boolean;
  frameMaterialId: Id;
  glassMaterialId: Id;
}

/** Vão de porta ou janela. `t0..z1` é a caixa do vão; `polygons` é a parte visível (sem o que está na frente). */
export interface SectionOpening {
  openingId: Id;
  kind: 'door' | 'window';
  t0: number;
  t1: number;
  z0: number;
  z1: number;
  depth: number;
  /** O plano de corte atravessa o vão. */
  cut: boolean;
  polygons: MultiPolygon;
  /** Esquadria do tipo e da família (para o desenho do corte e da elevação). Ausente = desenho antigo. */
  esquadria?: SectionEsquadria;
}

export interface SectionLevelMark {
  levelId: Id;
  name: string;
  z: number;
}

export interface SectionResult {
  length: number;
  zMin: number;
  zMax: number;
  /** Cortes por material, visíveis (depth 0). */
  cut: SectionRegion[];
  /** União das regiões visíveis de cortes, paredes, pisos, lajes, telhados e escadas (não inclui os vãos). */
  silhouette: MultiPolygon;
  /** Além do plano, visível, do mais longe ao mais perto. */
  beyond: SectionBeyond[];
  /** Vãos visíveis, do mais longe ao mais perto. */
  openings: SectionOpening[];
  levels: SectionLevelMark[];
}

/**
 * Peças de uma mesma camada da mesma parede, piso ou laje, na mesma profundidade, viram um item só (união): a parede
 * dividida em trechos pelas aberturas não deixa emendas falsas no desenho, e há menos itens na oclusão. Peças em
 * profundidades diferentes ficam separadas, pois a ordem é por profundidade; escadas e telhados não se agrupam.
 */
function groupBeyond(list: SectionBeyond[]): SectionBeyond[] {
  const byKey = new Map<string, SectionBeyond[]>();
  list.forEach((b, i) => {
    // Escadas e telhados ficam peça a peça (cada degrau, espelho e água é um item); paredes, pisos e lajes agrupam.
    const merge = b.wallId !== undefined || b.floorId !== undefined || b.slabId !== undefined;
    const key = merge ? [b.wallId, b.floorId, b.slabId, b.materialId, b.layerIndex, b.depth.toFixed(6)].join('|') : `#${i}`;
    const group = byKey.get(key);
    if (group) group.push(b);
    else byKey.set(key, [b]);
  });
  return [...byKey.values()].map((g) => (g.length === 1 ? g[0]! : { ...g[0]!, polygons: unionClipper(...g.map((b) => b.polygons)) }));
}

/** Camada de laje entre as cotas de base (b0 em t0, b1 em t1) e de topo (u0 em t0, u1 em t1): trapézio se inclinada. */
const slabQuad = (t0: number, t1: number, b0: number, b1: number, u0: number, u1: number): Ring => [
  { x: t0, y: b0 },
  { x: t1, y: b1 },
  { x: t1, y: u1 },
  { x: t0, y: u0 },
];

export function computeSection(p: Project, line: SectionLine, levelIds: Id[] = p.levels.map((l) => l.id)): SectionResult {
  const { length, d, n, slab } = sectionFrame(line);
  const empty: SectionResult = { length, zMin: 0, zMax: 3, cut: [], silhouette: [], beyond: [], openings: [], levels: [] };
  if (length < 1e-6) return empty;

  // Cortes por material (união depois, antes da oclusão); cada polígono guarda a origem para `sources`.
  const cutBy = new Map<Id, Array<{ polygon: Polygon; origin: SectionOrigin }>>();
  const addCut = (materialId: Id, polygon: Polygon, origin: SectionOrigin): void => {
    const list = cutBy.get(materialId) ?? [];
    list.push({ polygon, origin });
    cutBy.set(materialId, list);
  };
  // Além e vãos ainda sem oclusão (projeção completa): a oclusão e a parte visível vêm no fim.
  const beyond: SectionBeyond[] = [];
  const openings: SectionOpening[] = [];
  let zMin = Infinity;
  let zMax = -Infinity;
  const dist = (v: Vec2): number => (v.x - line.a.x) * n.x + (v.y - line.a.y) * n.y;
  const along = (v: Vec2): number => (v.x - line.a.x) * d.x + (v.y - line.a.y) * d.y;
  const grow = (z0: number, z1: number): void => {
    zMin = Math.min(zMin, z0);
    zMax = Math.max(zMax, z1);
  };

  for (const levelId of levelIds) {
    const resolved = resolveLevel(p, levelId);
    // Pisos entram como as paredes: a linha corta cada camada (retângulo t×z) e a laje de visão mostra o resto.
    for (const f of resolveFloors(p, levelId)) {
      const inSlab = intersection(f.polygon, slab);
      for (const layer of f.layers) {
        for (const poly of f.polygon) {
          for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
            const lo = Math.max(0, t0);
            const hi = Math.min(length, t1);
            if (hi - lo < EPS_T) continue;
            addCut(layer.materialId, [rect(lo, hi, layer.z0, layer.z1)], { floorId: f.floorId });
            grow(layer.z0, layer.z1);
          }
        }
        for (const sp of inSlab) {
          const outer = sp[0];
          if (!outer || outer.length < 3) continue;
          const ts = outer.map(along);
          const tMin = Math.max(0, Math.min(...ts));
          const tMax = Math.min(length, Math.max(...ts));
          if (tMax - tMin < EPS_T) continue;
          beyond.push({
            floorId: f.floorId,
            materialId: layer.materialId,
            layerIndex: layer.layerIndex,
            depth: Math.max(0, Math.min(...outer.map(dist))),
            polygons: [[rect(tMin, tMax, layer.z0, layer.z1)]],
          });
          grow(layer.z0, layer.z1);
        }
      }
    }
    // Lajes (D3): como os pisos, mas com inclinação; cada cota (base e topo) soma a subida no ponto da linha de corte.
    for (const sl of resolveSlabs(p, levelId)) {
      const inView = intersection(sl.polygon, slab);
      for (const layer of sl.layers) {
        for (const poly of sl.polygon) {
          for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
            const lo = Math.max(0, t0);
            const hi = Math.min(length, t1);
            if (hi - lo < EPS_T) continue;
            const rl = slabRiseAt(sl.slope, { x: line.a.x + d.x * lo, y: line.a.y + d.y * lo });
            const rh = slabRiseAt(sl.slope, { x: line.a.x + d.x * hi, y: line.a.y + d.y * hi });
            addCut(layer.materialId, [slabQuad(lo, hi, layer.z0 + rl, layer.z0 + rh, layer.z1 + rl, layer.z1 + rh)], { slabId: sl.slabId });
            grow(layer.z0 + Math.min(rl, rh), layer.z1 + Math.max(rl, rh));
          }
        }
        for (const sp of inView) {
          const outer = sp[0];
          if (!outer || outer.length < 3) continue;
          const ts = outer.map(along);
          const tMin = Math.max(0, Math.min(...ts));
          const tMax = Math.min(length, Math.max(...ts));
          if (tMax - tMin < EPS_T) continue;
          // Laje plana: retângulo. Inclinada: projeção exata do prisma (a cota sobe linear sobre o contorno).
          const rise = (v: Vec2): number => slabRiseAt(sl.slope, v);
          const zs = outer.map(rise);
          beyond.push({
            slabId: sl.slabId,
            materialId: layer.materialId,
            layerIndex: layer.layerIndex,
            depth: Math.max(0, Math.min(...outer.map(dist))),
            polygons: sl.slope ? prismProjection(outer, along, (v) => layer.z0 + rise(v), (v) => layer.z1 + rise(v)) : [[rect(tMin, tMax, layer.z0, layer.z1)]],
          });
          grow(layer.z0 + Math.min(...zs), layer.z1 + Math.max(...zs));
        }
      }
    }
    // Telhados (D3): como as lajes, por água e por camada (cada faixa segue a cota da água menos `below`).
    const rf = sectionOfRoofs(resolveRoofs(p, levelId), line);
    for (const c of rf.cut) addCut(c.materialId, c.polygon, { roofId: c.roofId });
    beyond.push(...rf.beyond);
    grow(rf.zMin, rf.zMax);
    // Escadas (decisão 0011 §6) das que nascem neste nível: degraus, patamares e espelhos (`sectionStairs.ts`).
    const sk = sectionOfStairs(resolveStairsOnLevel(p, levelId), line, p);
    for (const c of sk.cut) addCut(c.materialId, c.polygon, { stairId: c.stairId });
    beyond.push(...sk.beyond);
    grow(sk.zMin, sk.zMax);
    for (const w of wallsOnLevel(p, levelId)) {
      const rw = resolved.walls[w.id];
      if (!rw) continue;
      for (const layer of rw.layers) {
        // Faixas fundidas em prismas (bandFuse): sem contorno horizontal falso entre faixas da mesma região.
        for (const band of fuseBands(layer.bands)) {
          const z0 = rw.baseZ + band.z0;
          const z1 = rw.baseZ + band.z1;
          for (const poly of band.poly) {
            for (const [t0, t1] of lineIntervals(poly, line.a, d, n)) {
              const lo = Math.max(0, t0);
              const hi = Math.min(length, t1);
              if (hi - lo < EPS_T) continue;
              const at = (t: number): number => (band.slope ? rw.baseZ + bandTopAt(band, { x: line.a.x + d.x * t, y: line.a.y + d.y * t }) : z1);
              addCut(layer.materialId, [rect(lo, hi, z0, at(lo), at(hi))], { wallId: w.id });
              grow(z0, z1);
            }
          }
          for (const sp of intersection(band.poly, slab)) {
            const outer = sp[0];
            if (!outer || outer.length < 3) continue;
            const ts = outer.map(along);
            const tMin = Math.max(0, Math.min(...ts));
            const tMax = Math.min(length, Math.max(...ts));
            if (tMax - tMin < EPS_T) continue;
            beyond.push({
              wallId: w.id,
              materialId: layer.materialId,
              layerIndex: layer.layerIndex,
              depth: Math.max(0, Math.min(...outer.map(dist))),
              // Topo plano: retângulo; topo inclinado: projeção exata do prisma (como as lajes inclinadas).
              polygons: band.slope ? prismProjection(outer, along, () => z0, (v) => rw.baseZ + bandTopAt(band, v)) : [[rect(tMin, tMax, z0, z1)]],
            });
            grow(z0, z1);
          }
        }
      }
      const f = frameOfWall(p, w.id);
      if (!f) continue;
      for (const o of openingsOfWall(p, w.id)) {
        const g = openingGeometry(p, o, f);
        const foot = orientedRect(g.center.x, g.center.y, g.u.x, g.u.y, g.width / 2, g.thickness / 2);
        const crossing = lineIntervals([foot], line.a, d, n).some(([t0, t1]) => t1 > 0 && t0 < length);
        if (!crossing && intersection([[foot]], slab).length === 0) continue;
        const ts = foot.map(along);
        const t0 = Math.max(0, Math.min(...ts));
        const t1 = Math.min(length, Math.max(...ts));
        if (t1 - t0 < EPS_T) continue;
        const z0 = rw.baseZ + g.sill;
        const ot = openingType(p, o);
        const core = coreSpan(f.type);
        const fr = openingFrame(ot, core.to - core.from);
        openings.push({
          openingId: o.id,
          kind: g.kind,
          t0,
          t1,
          z0,
          z1: z0 + g.height,
          depth: Math.max(0, Math.min(...foot.map(dist))),
          cut: crossing,
          polygons: [[rect(t0, t1, z0, z0 + g.height)]],
          esquadria: {
            family: openingFamilyOf(ot)?.id ?? null,
            leaves: ot.leaves,
            plan: ot.plan,
            width: ot.width,
            thickness: g.thickness,
            frameWidth: fr.frameWidth,
            frameDepth: fr.frameDepth,
            glassThickness: fr.glassThickness,
            leafThickness: fr.leafThickness,
            flipHand: o.flipHand,
            flipFacing: o.flipFacing,
            frameMaterialId: ot.frameMaterialId,
            glassMaterialId: ot.glassMaterialId,
          },
        });
      }
    }
  }

  // Linha oculta: corte (depth 0), vãos e o além numa só ordem do mais perto ao mais longe; cada um vê o que sobra.
  type Ref = { cut: SectionRegion } | { beyond: SectionBeyond } | { opening: SectionOpening };
  const refs: Ref[] = [];
  const items: OcclusionItem[] = [];
  for (const [materialId, list] of cutBy) {
    const sources = uniqueOrigins(list.map((c) => c.origin));
    const region: SectionRegion = {
      materialId,
      polygons: union(...list.map((c): MultiPolygon => [c.polygon])),
      sources,
      parts: partsByOrigin(list, sources),
    };
    refs.push({ cut: region });
    items.push({ depth: 0, rank: OCCLUSION_RANK.cut, polygons: region.polygons });
  }
  for (const b of groupBeyond(beyond)) {
    refs.push({ beyond: b });
    items.push({ depth: b.depth, rank: OCCLUSION_RANK.beyond, polygons: b.polygons });
  }
  for (const o of openings) {
    refs.push({ opening: o });
    items.push({ depth: o.depth, rank: OCCLUSION_RANK.opening, polygons: o.polygons });
  }
  const visible = visibleParts(items);
  const cut: SectionRegion[] = [];
  const beyondVisible: SectionBeyond[] = [];
  const openingsVisible: SectionOpening[] = [];
  refs.forEach((ref, i) => {
    const polygons = visible[i]!;
    if (polygons.length === 0) return;
    if ('cut' in ref) {
      const parts = clipParts(ref.cut.parts, polygons);
      cut.push({ ...ref.cut, polygons, parts });
    } else if ('beyond' in ref) beyondVisible.push({ ...ref.beyond, polygons });
    else openingsVisible.push({ ...ref.opening, polygons });
  });
  // Telhado: as camadas projetam na mesma área (a face é inclinada), então a de cima (índice menor) desenha por último.
  beyondVisible.sort((x, y) => y.depth - x.depth || (x.roofId || y.roofId ? y.layerIndex - x.layerIndex : x.layerIndex - y.layerIndex));
  openingsVisible.sort((x, y) => y.depth - x.depth);
  const silhouette = unionClipper(...cut.map((c) => c.polygons), ...beyondVisible.map((b) => b.polygons));
  const levels = p.levels.map((l) => ({ levelId: l.id, name: l.name, z: l.elevation }));
  if (!isFinite(zMin)) return { ...empty, levels };
  return { length, zMin, zMax, cut, silhouette, beyond: beyondVisible, openings: openingsVisible, levels };
}

/** Telhado no corte (D3): quadriláteros da linha de corte por material e, além do plano, as faixas por camada. */
export interface RoofSection {
  /** Corte por água e camada, com o telhado de origem (`roofId`). */
  cut: Array<{ materialId: Id; polygon: Polygon; roofId: Id }>;
  beyond: SectionBeyond[];
  /** Cotas extremas (Infinity/-Infinity sem telhado na linha). */
  zMin: number;
  zMax: number;
}

/** Envoltória convexa (cadeia monótona), anel anti-horário; com menos de 3 vértices, pontos colineares. */
function convexHull(pts: Vec2[]): Ring {
  const s = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Vec2, a: Vec2, b: Vec2): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (seq: Vec2[]): Vec2[] => {
    const h: Vec2[] = [];
    for (const q of seq) {
      while (h.length >= 2 && cross(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...chain(s), ...chain([...s].reverse())];
}

/**
 * Corte esquadro (Revit: Rafter Cut 'square') no beiral: a base da camada recua ao longo da água, de modo que o corte
 * fica perpendicular ao plano. Com G = % / 100 e T a espessura vertical da camada, o deslocamento ao longo da subida é
 * s = G·T/(1+G²); o comprimento do corte (perpendicular ao plano) é T·cos θ. Para 100 % e T = 10 cm: s = 5,00 cm e
 * corte de 7,07 cm.
 */
export function squareCutRun(percent: number, thickness: number): number {
  const g = percent / 100;
  return (g * thickness) / (1 + g * g);
}

/**
 * Telhados no corte e na elevação (D3), como as lajes. Por água e por camada, a faixa vertical de cada ponto p vai de
 * top(p) − below − thickness a top(p) − below. No corte, a linha dá intervalos de t dentro da água e cada faixa é um
 * quadrilátero (topo e base são lineares em t). Além do plano, cada triângulo da água projeta-se em (t, z) com
 * seis pontos (topo e base); a envoltória convexa de cada um e a união delas é a silhueta da camada (exata para
 * águas convexas, que é o caso das formas predefinidas).
 */
export function sectionOfRoofs(roofs: ResolvedRoof[], line: SectionLine): RoofSection {
  const out: RoofSection = { cut: [], beyond: [], zMin: Infinity, zMax: -Infinity };
  const { length, d, n, slab } = sectionFrame(line);
  if (length < 1e-6) return out;
  const along = (v: Vec2): number => (v.x - line.a.x) * d.x + (v.y - line.a.y) * d.y;
  const dist = (v: Vec2): number => (v.x - line.a.x) * n.x + (v.y - line.a.y) * n.y;
  const at = (t: number): Vec2 => ({ x: line.a.x + d.x * t, y: line.a.y + d.y * t });
  for (const r of roofs) {
    const layers = r.layers.filter((l) => l.thickness > 1e-9);
    // Corte esquadro só nas extremidades sobre uma aresta de beiral (linha 'eave'); prumo (padrão) não muda nada.
    const square = r.rafterCut === 'square';
    const eaves = r.lines.filter((l) => l.kind === 'eave');
    const onEave = (v: Vec2): boolean => square && eaves.some((l) => Math.hypot(closestOnSegment(v, l.a, l.b).x - v.x, closestOnSegment(v, l.a, l.b).y - v.y) < 1e-6);
    for (const pl of r.planes) {
      const cuts = pl.polygon
        .flatMap((poly) => lineIntervals(poly, line.a, d, n))
        .map(([t0, t1]): [number, number] => [Math.max(0, t0), Math.min(length, t1)])
        .filter(([lo, hi]) => hi - lo >= EPS_T);
      const view = intersection(pl.polygon, slab);
      for (const l of layers) {
        const top = (v: Vec2): number => planeZ(pl, v) - l.below;
        const G = pl.percent / 100;
        const run = square ? squareCutRun(pl.percent, l.thickness) : 0;
        // Cosseno entre a seção e a subida da água: no corte esquadro, a base desloca s / cos ao longo da seção.
        const c = d.x * pl.up.x + d.y * pl.up.y;
        for (const [lo, hi] of cuts) {
          const u0 = top(at(lo));
          const u1 = top(at(hi));
          let bl: Vec2 = { x: lo, y: u0 - l.thickness };
          let br: Vec2 = { x: hi, y: u1 - l.thickness };
          if (square && Math.abs(c) > 1e-9) {
            const k = run / c;
            if (c > 0 && lo + k < hi && onEave(at(lo))) bl = { x: lo + k, y: top(at(lo + k)) - l.thickness };
            if (c < 0 && hi + k > lo && onEave(at(hi))) br = { x: hi + k, y: top(at(hi + k)) - l.thickness };
          }
          out.cut.push({ materialId: l.materialId, polygon: [[bl, br, { x: hi, y: u1 }, { x: lo, y: u0 }]], roofId: r.roofId });
          out.zMin = Math.min(out.zMin, u0 - l.thickness, u1 - l.thickness);
          out.zMax = Math.max(out.zMax, u0, u1);
        }
        const parts: MultiPolygon[] = [];
        let depth = Infinity;
        for (const piece of view) {
          const outer = piece[0];
          if (!outer || outer.length < 3) continue;
          depth = Math.min(depth, ...outer.map(dist));
          const mesh = triangulate(piece);
          for (let i = 0; i < mesh.indices.length; i += 3) {
            const pts = [0, 1, 2].flatMap((k) => {
              const j = mesh.indices[i + k]!;
              const v = { x: mesh.positions[2 * j]!, y: mesh.positions[2 * j + 1]! };
              // Corte esquadro no beiral: a base recua s ao longo da subida (projeta-se em s·cos e sobe G·s).
              const base = square && onEave(v) ? { x: along(v) + run * c, y: top(v) + G * run - l.thickness } : { x: along(v), y: top(v) - l.thickness };
              return [{ x: along(v), y: top(v) }, base];
            });
            const hull = convexHull(pts);
            if (hull.length >= 3) parts.push([[hull]]);
          }
        }
        if (!parts.length) continue;
        const polygons = union(...parts);
        out.beyond.push({ roofId: r.roofId, materialId: l.materialId, layerIndex: l.layerIndex, depth: Math.max(0, depth), polygons });
        for (const ring of polygons.flat()) {
          for (const v of ring) {
            out.zMin = Math.min(out.zMin, v.y);
            out.zMax = Math.max(out.zMax, v.y);
          }
        }
      }
    }
  }
  return out;
}
