import {
  createEmptyProject,
  makeCeiling,
  makeFloor,
  makeLevel,
  makeRoom,
  makeSlab,
  makeWall,
  type Id,
  type Opening,
  type Project,
} from '@hestia/model';
import { bodyOf, cleanLoop, hull2, prismFromMesh, rectangleAxis, segment, type Body, type Prism } from './geometry.ts';
import { openingType, operationOf, slabLikeType, slug, wallType } from './elementTypes.ts';
import { IfcFile, projectName, type Pt2 } from './ifc.ts';
import type { StepEntity } from './step.ts';

/** O que a importação trouxe. Sempre preenchido, mesmo quando o arquivo é ruim. */
export interface ImportReport {
  schema: string;
  /** Entidades STEP que o tokenizador não conseguiu ler. */
  broken: number;
  levels: number;
  imported: Record<string, number>;
  /** Objetos de uma classe IFC que a v1 não representa (contagem por classe). */
  skipped: Record<string, number>;
  /** Formas aproximadas (hull de malha, por exemplo) por categoria. */
  approximate: Record<string, number>;
  /** Geometria que o leitor não representou (corte booleano, extrusão inclinada...), por motivo. */
  geometry: Record<string, number>;
  /** Objetos importados como elemento genérico, por classe IFC. */
  generic: Record<string, number>;
  warnings: string[];
}

export interface ImportResult {
  project: Project;
  report: ImportReport;
}

interface LevelRef {
  id: Id;
  elevation: number;
  storey: number;
}

interface Ctx {
  f: IfcFile;
  p: Project;
  report: ImportReport;
  levels: LevelRef[];
  typeOf: Map<number, StepEntity>;
  hostOf: Map<number, number>;
  fillerOf: Map<number, number>;
  walls: Map<number, Id>;
  types: Map<string, Id>;
  approximate: Record<string, number>;
  /** Assinaturas de piso/laje/forro já importados (evita duplicata sobreposta do mesmo arquivo). */
  slabs: Set<string>;
  order: number;
  warn(msg: string): void;
  skip(ifcClass: string): void;
  count(kind: string): void;
}

const emptyReport = (f: IfcFile): ImportReport => ({
  schema: f.schema,
  broken: f.broken,
  levels: 0,
  imported: {},
  skipped: {},
  approximate: {},
  geometry: {},
  generic: {},
  warnings: [],
});

const guid = (f: IfcFile, e: StepEntity | undefined): string => f.text(e, 0) || `#${e?.id ?? 0}`;

/** Produtos de uma família (`IFCWALL` inclui StandardCase/ElementedCase), sem os tipos/estilos. */
function products(f: IfcFile, prefix: string): StepEntity[] {
  return f
    .byPrefix(prefix)
    .filter((e) => !e.type.endsWith('TYPE') && !e.type.endsWith('STYLE'))
    .filter((e) => f.ent(e, 6)?.type === 'IFCPRODUCTDEFINITIONSHAPE');
}

/** Soma ao relatório os itens de geometria que o leitor não representou (corte, extrusão inclinada...). */
function noteGeometry(ctx: Ctx, body: Body | null): void {
  if (!body) return;
  for (const motivo of body.unsupported) ctx.report.geometry[motivo] = (ctx.report.geometry[motivo] ?? 0) + 1;
}

/**
 * Produtos que o importador não representa como elemento nativo viram **objeto genérico** com a malha e a classe IFC de
 * origem. O que não tiver malha fica de fora e entra em `skipped` (via `countUnhandledProducts`).
 */
function addGenericObjects(file: IfcFile, ctx: Ctx): Set<number> {
  const converted = new Set<number>();
  const handled = /^IFC(WALL|SLAB|COVERING|DOOR|WINDOW|SPACE|GRID|OPENINGELEMENT|ANNOTATION|SITE|BUILDING|PROJECT|BUILDINGSTOREY)/;
  for (const e of file.step.entities.values()) {
    if (handled.test(e.type)) continue;
    if (!file.ref(e, 5) || file.ent(e, 6)?.type !== 'IFCPRODUCTDEFINITIONSHAPE') continue;
    const body = bodyOf(file, e);
    if (!body.tris.length) continue;
    const positions: number[] = [], indices: number[] = [];
    let minZ = Infinity;
    for (const tri of body.tris) {
      for (const p of tri) {
        indices.push(positions.length / 3);
        positions.push(p.x, p.y, p.z);
        minZ = Math.min(minZ, p.z);
      }
    }
    if (!positions.length) continue;
    const outline = hull2(body.points.map((p) => ({ x: p.x, y: p.y })));
    const id = `g_${guid(file, e)}`;
    ctx.p.elements[id] = {
      id,
      kind: 'generic',
      levelId: levelAt(ctx, minZ).id,
      name: file.text(e, 2).trim() || file.text(ctx.typeOf.get(e.id), 2).trim() || e.type,
      sourceClass: e.type,
      predefinedType: file.enum(e, 8) || undefined,
      objectType: file.text(e, 4) || undefined,
      mesh: { positions, indices },
      outline: outline.length >= 3 ? outline : undefined,
      order: ctx.order++,
    };
    converted.add(e.id);
    ctx.report.generic[e.type] = (ctx.report.generic[e.type] ?? 0) + 1;
    ctx.count('objetos');
  }
  return converted;
}

/**
 * Produtos que o importador não visita nem converteu em genérico entram no relatório em vez de sumirem calados: o
 * relatório não pode dizer "0 ignorados" com 51 vigas no arquivo.
 */
function countUnhandledProducts(f: IfcFile, report: ImportReport, converted: Set<number>): void {
  const handled = /^IFC(WALL|SLAB|COVERING|DOOR|WINDOW|SPACE|GRID|OPENINGELEMENT|ANNOTATION|SITE|BUILDING|PROJECT|BUILDINGSTOREY)/;
  for (const e of f.step.entities.values()) {
    if (converted.has(e.id) || handled.test(e.type)) continue;
    if (!f.ref(e, 5) || f.ent(e, 6)?.type !== 'IFCPRODUCTDEFINITIONSHAPE') continue;
    report.skipped[e.type] = (report.skipped[e.type] ?? 0) + 1;
  }
}

/** Cota de um pavimento: `Elevation` (atributo 9) ou a origem do placement. */
function storeyElevation(f: IfcFile, e: StepEntity): number {
  const explicit = f.num(e, 9);
  if (explicit != null) return explicit * f.units.length;
  return f.productPlacement(e).o.z;
}

function readLevels(f: IfcFile, p: Project, report: ImportReport): LevelRef[] {
  const storeys = f.byType('IFCBUILDINGSTOREY').map((e) => ({ e, z: storeyElevation(f, e) }));
  storeys.sort((a, b) => a.z - b.z);
  if (!storeys.length) {
    const level = makeLevel({ id: 'lv_0', name: 'Térreo', elevation: 0 });
    p.levels = [level];
    report.levels = 1;
    return [{ id: level.id, elevation: 0, storey: 0 }];
  }
  p.levels = storeys.map((s, i) => {
    const name = f.text(s.e, 2).trim() || `Nível ${i + 1}`;
    return makeLevel({ id: `lv_${i}_${slug(name) || i}`, name, elevation: s.z });
  });
  report.levels = p.levels.length;
  return storeys.map((s, i) => ({ id: p.levels[i]!.id, elevation: s.z, storey: s.e.id }));
}

/** Nível mais próximo abaixo de uma cota `z` (1 cm de folga). */
function levelAt(ctx: Ctx, z: number): LevelRef {
  let best = ctx.levels[0]!;
  for (const l of ctx.levels) if (l.elevation <= z + 0.01) best = l;
  return best;
}

function indexRelations(f: IfcFile, ctx: Ctx): void {
  for (const rel of f.byType('IFCRELDEFINESBYTYPE')) {
    const type = f.ent(rel, 5);
    if (!type) continue;
    for (const obj of f.list(rel, 4)) ctx.typeOf.set(obj.id, type);
  }
  for (const rel of f.byType('IFCRELVOIDSELEMENT')) {
    const host = f.ref(rel, 4);
    const opening = f.ref(rel, 5);
    if (host != null && opening != null) ctx.hostOf.set(opening, host);
  }
  for (const rel of f.byType('IFCRELFILLSELEMENT')) {
    const opening = f.ref(rel, 4);
    const fill = f.ref(rel, 5);
    if (opening != null && fill != null) ctx.fillerOf.set(opening, fill);
  }
}

/** Ponto interior de um anel (centroide; para anéis côncavos o hull garante um ponto plausível). */
function interiorPoint(loop: Pt2[]): Pt2 {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  if (Math.abs(area) > 1e-9) return { x: cx / (3 * area), y: cy / (3 * area) };
  const hull = hull2(loop);
  const n = hull.length || 1;
  return { x: hull.reduce((s, p) => s + p.x, 0) / n, y: hull.reduce((s, p) => s + p.y, 0) / n };
}

function addWall(ctx: Ctx, e: StepEntity, body: Body): void {
  noteGeometry(ctx, body);
  let prism: Prism | null = body.prisms[0] ?? null;
  if (!prism) {
    // Malha sem extrusão: contorno aproximado pela projeção (entra como "aproximado").
    prism = body.points.length ? prismFromMesh(body.points) : null;
    if (!prism) return ctx.skip(e.type);
    ctx.approximate.paredes = (ctx.approximate.paredes ?? 0) + 1;
  }
  placeWall(ctx, e, prism);
}

function placeWall(ctx: Ctx, e: StepEntity, prism: Prism): void {
  const f = ctx.f;
  const rect = rectangleAxis(prism.loops[0] ?? []);
  const axis = rect ? { a: rect.a, b: rect.b } : null;
  if (!axis) return ctx.skip('parede-forma-livre');
  const thickness = rect?.thickness ?? 0.15;
  const level = levelAt(ctx, prism.z0);
  const name = f.text(ctx.typeOf.get(e.id), 2).trim() || f.text(e, 2).trim();
  const typeId = wallType(ctx, name, thickness);
  const height = Math.max(0.05, prism.z1 - prism.z0);
  const id = `w_${guid(f, e)}`;
  ctx.p.elements[id] = {
    ...makeWall({ id, typeId, levelId: level.id, a: axis.a, b: axis.b }),
    baseOffset: prism.z0 - level.elevation,
    height,
    order: ctx.order++,
  };
  ctx.walls.set(e.id, id);
  ctx.count('paredes');
}

function addOpening(ctx: Ctx, filler: StepEntity, kind: 'door' | 'window'): void {
  const f = ctx.f;
  const openingId = [...ctx.fillerOf.entries()].find(([, fill]) => fill === filler.id)?.[0];
  if (openingId == null) {
    ctx.warn('Porta/janela sem IfcRelFillsElement (sem vão associado): ficou de fora.');
    return ctx.skip(filler.type);
  }
  const hostIfc = ctx.hostOf.get(openingId);
  const hostId = hostIfc == null ? undefined : ctx.walls.get(hostIfc);
  if (!hostId) {
    ctx.warn('Abertura cuja parede não foi importada (forma não retangular): ficou de fora.');
    return ctx.skip(filler.type);
  }
  const wall = ctx.p.elements[hostId];
  if (!wall || wall.kind !== 'wall') return ctx.skip(filler.type);
  const opening = f.entity(openingId);
  const body = opening ? bodyOf(f, opening) : null;
  noteGeometry(ctx, body);
  if (!body) {
    ctx.warn('Abertura sem geometria de vão: ficou de fora.');
    return ctx.skip(filler.type);
  }
  const prism = body.prisms[0];
  const loop = prism?.loops[0] ?? [];
  const cloud = prism ? loop.map((p) => ({ x: p.x, y: p.y, z: prism.z0 })) : body.points;
  if (cloud.length < 3) return ctx.skip(filler.type);
  const { dir, len } = segment([wall.a, wall.b]);
  let min = Infinity;
  let max = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  for (const p of cloud) {
    const t = (p.x - wall.a.x) * dir.x + (p.y - wall.a.y) * dir.y;
    min = Math.min(min, t);
    max = Math.max(max, t);
    z0 = Math.min(z0, prism ? prism.z0 : p.z);
    z1 = Math.max(z1, prism ? prism.z1 : p.z);
  }
  const width = Math.max(0.3, max - min);
  const center = (min + max) / 2;
  const height = Math.max(0.3, z1 - z0);
  const baseZ = ctx.p.levels.find((l) => l.id === wall.levelId)?.elevation ?? 0;
  const sill = z0 - (baseZ + wall.baseOffset);
  const typeId = openingType(ctx, filler, kind, width, height, sill);
  const offset = Math.max(0, Math.min(len - width / 2, center));
  const id = `o_${guid(f, filler)}`;
  const op: Opening = {
    id,
    kind,
    typeId,
    hostId,
    offset,
    flipHand: /RIGHT/.test(operationOf(ctx.typeOf.get(filler.id))),
    flipFacing: false,
    sillOverride: null,
    mark: f.text(filler, 7),
  };
  ctx.p.elements[id] = op;
  ctx.count(kind === 'door' ? 'portas' : 'janelas');
}

function slabKind(f: IfcFile, e: StepEntity): 'floor' | 'slab' | 'ceiling' | null {
  const pre = f.enum(e, 8);
  if (e.type.startsWith('IFCCOVERING')) return pre === 'CEILING' ? 'ceiling' : null;
  if (pre === 'FLOOR') return 'floor';
  if (pre === 'CEILING') return 'ceiling';
  if (pre === 'ROOF' || pre === 'LANDING' || pre === 'BASESLAB' || pre === 'PAVEMENT') return 'slab';
  return 'floor';
}

function addSlab(ctx: Ctx, e: StepEntity): void {
  const f = ctx.f;
  const kind = slabKind(f, e);
  if (!kind) return ctx.skip(e.type);
  const body = bodyOf(f, e);
  noteGeometry(ctx, body);
  const prism = body.prisms[0] ?? (body.points.length ? prismFromMesh(body.points) : null);
  if (!prism) return ctx.skip(e.type);
  if (prism.approx) ctx.approximate[kind === 'floor' ? 'pisos' : kind === 'slab' ? 'lajes' : 'forros'] = (ctx.approximate[kind === 'floor' ? 'pisos' : kind === 'slab' ? 'lajes' : 'forros'] ?? 0) + 1;
  const boundary = cleanLoop(prism.loops[0] ?? []);
  if (boundary.length < 3) return ctx.skip(e.type);
  const holes = prism.loops.slice(1).map(cleanLoop).filter((l) => l.length >= 3);
  const thickness = Math.max(0.05, prism.z1 - prism.z0);
  const xs = boundary.map((p) => p.x);
  const ys = boundary.map((p) => p.y);
  const key = [
    kind,
    Math.round(prism.z1 * 100),
    Math.round(Math.min(...xs) * 100),
    Math.round(Math.min(...ys) * 100),
    Math.round(Math.max(...xs) * 100),
    Math.round(Math.max(...ys) * 100),
  ].join('|');
  if (ctx.slabs.has(key)) {
    ctx.skip('duplicado');
    return;
  }
  ctx.slabs.add(key);
  const level = levelAt(ctx, prism.z1);
  const name = f.text(ctx.typeOf.get(e.id), 2).trim() || f.text(e, 2).trim();
  const typeId = slabLikeType(ctx, kind, name, thickness);
  const id = `${kind === 'floor' ? 'f' : kind === 'slab' ? 's' : 'c'}_${guid(f, e)}`;
  const base = { id, typeId, levelId: level.id, boundary, holes, heightOffset: prism.z1 - level.elevation, mark: f.text(e, 7), comments: '' };
  if (kind === 'floor') ctx.p.elements[id] = { ...makeFloor(base), order: ctx.order++ };
  else if (kind === 'slab') ctx.p.elements[id] = { ...makeSlab(base), order: ctx.order++ };
  else ctx.p.elements[id] = { ...makeCeiling(base), order: ctx.order++ };
  ctx.count(kind === 'floor' ? 'pisos' : kind === 'slab' ? 'lajes' : 'forros');
}

function addRoom(ctx: Ctx, e: StepEntity): void {
  const f = ctx.f;
  const body = bodyOf(f, e);
  noteGeometry(ctx, body);
  const prism = body.prisms[0] ?? (body.points.length ? prismFromMesh(body.points) : null);
  if (!prism) return ctx.skip(e.type);
  if (prism.approx) ctx.approximate.ambientes = (ctx.approximate.ambientes ?? 0) + 1;
  const loop = cleanLoop(prism.loops[0] ?? []);
  if (loop.length < 3) return ctx.skip(e.type);
  const point = interiorPoint(loop);
  const level = levelAt(ctx, prism.z0);
  const id = `r_${guid(f, e)}`;
  const room = makeRoom({
    id,
    levelId: level.id,
    name: f.text(e, 2).trim() || 'Ambiente',
    number: f.text(e, 7).trim(),
    point,
  });
  ctx.p.elements[id] = { ...room, order: ctx.order++ };
  ctx.count('ambientes');
}

function addGrids(ctx: Ctx): void {
  const f = ctx.f;
  const grids = f.byType('IFCGRID');
  if (!grids.length) return;
  ctx.p.grids = ctx.p.grids ?? [];
  let n = 0;
  for (const grid of grids) {
    for (const list of [0, 1, 2]) {
      for (const axis of f.list(grid, list)) {
        const curve = f.ent(axis, 1);
        if (!curve) continue;
        const pts = f.list(curve, 0).map((p) => f.point(p ? { k: 'ref', id: p.id } : undefined));
        const a = pts[0];
        const b = pts[pts.length - 1];
        if (!a || !b || (a.x === b.x && a.y === b.y)) continue;
        ctx.p.grids.push({
          id: `g_${guid(f, axis)}`,
          name: f.text(axis, 0) || `${n + 1}`,
          typeId: 'gt_6mm',
          points: [
            { x: a.x, y: a.y },
            { x: b.x, y: b.y },
          ],
          sag: 0,
          bubbleStart: true,
          bubbleEnd: true,
          order: ctx.order++,
        });
        n++;
      }
    }
  }
  if (n) ctx.count('grades');
}

/** Importa o texto IFC em um projeto novo (os tipos padrão do Hestia ficam como base). */
export function importIfc(text: string, base?: Project): ImportResult {
  const file = new IfcFile(text);
  const p = base ? structuredClone(base) : createEmptyProject();
  p.elements = {};
  p.views = [];
  p.sheets = [];
  p.grids = [];
  p.nextOrder = 1;
  p.levels = [];
  const report = emptyReport(file);
  const ctx: Ctx = {
    f: file,
    p,
    report,
    levels: readLevels(file, p, report),
    typeOf: new Map(),
    hostOf: new Map(),
    fillerOf: new Map(),
    walls: new Map(),
    types: new Map(),
    approximate: {},
    slabs: new Set(),
    order: 1,
    warn: (msg) => {
      if (report.warnings.length < 200 && !report.warnings.includes(msg)) report.warnings.push(msg);
    },
    skip: (ifcClass) => {
      report.skipped[ifcClass] = (report.skipped[ifcClass] ?? 0) + 1;
    },
    count: (kind) => {
      report.imported[kind] = (report.imported[kind] ?? 0) + 1;
    },
  };
  if (file.broken) ctx.warn(`${file.broken} entidade(s) STEP ilegíveis foram ignoradas.`);
  indexRelations(file, ctx);
  for (const e of products(file, 'IFCWALL')) addWall(ctx, e, bodyOf(file, e));
  for (const e of products(file, 'IFCDOOR')) addOpening(ctx, e, 'door');
  for (const e of products(file, 'IFCWINDOW')) addOpening(ctx, e, 'window');
  for (const e of products(file, 'IFCSLAB')) addSlab(ctx, e);
  for (const e of products(file, 'IFCCOVERING')) addSlab(ctx, e);
  for (const e of file.byType('IFCSPACE')) addRoom(ctx, e);
  addGrids(ctx);
  countUnhandledProducts(file, report, addGenericObjects(file, ctx));
  p.name = projectName(file, p);
  p.nextOrder = ctx.order;
  return { project: p, report };
}
