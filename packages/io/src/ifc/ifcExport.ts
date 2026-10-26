import { isOpening, isWall, levelElevation, openingFamilyName, type OpeningType, type Project } from '@hestia/model';
import { addPlates, addRoofs, addStairs } from './ifcElements.ts';
import { gid, materialOf, optStr, storeyOf, type IfcCtx } from './ifcCtx.ts';
import { axis3, bodyShape, extrudeSolid, localPlacement } from './ifcSolids.ts';
import { en, list, num, OMIT, ref, StepWriter, stepString } from './ifcStep.ts';
import type { IfcGeometry, IfcOpeningGeo, IfcPoint, IfcPolygon, IfcWallGeo } from './ifcTypes.ts';

/** Opções da exportação. A data do cabeçalho entra como texto: com a mesma data o arquivo sai igual (determinismo). */
export interface IfcExportOptions {
  /** Data e hora do cabeçalho STEP (ISO 8601). Padrão: 1970-01-01T00:00:00. */
  timestamp?: string;
}

/** Retângulo `width` × `thickness` centrado na origem do sistema local (x ao longo do eixo do vão, y na espessura). */
function rectOf(width: number, thickness: number): IfcPolygon {
  const hw = width / 2;
  const ht = thickness / 2;
  return [[
    { x: -hw, y: -ht },
    { x: hw, y: -ht },
    { x: hw, y: ht },
    { x: -hw, y: ht },
  ]];
}

/** Paredes: IFCWALL com contorno extrudado e IFCMATERIALLAYERSETUSAGE pelas camadas do tipo (sem as de espessura zero). */
function addWalls(c: IfcCtx, walls: IfcWallGeo[]): void {
  for (const g of walls) {
    const wall = c.p.elements[g.wallId];
    if (!isWall(wall)) continue;
    const st = storeyOf(c, wall.levelId);
    if (!st) continue;
    const type = c.p.wallTypes[wall.typeId];
    const name = stepString(type?.name ?? 'Parede');
    if (g.footprints.length === 0) continue;
    const solids = g.footprints.map((f) => extrudeSolid(c.w, f, g.baseZ - st.elev, g.height));
    const shape = bodyShape(c.w, c.ctx, 'SweptSolid', solids);
    const place = localPlacement(c.w, st.place, [0, 0, 0]);
    const id = c.w.add('IFCWALL', [gid(`wall:${g.wallId}`), OMIT, name, OMIT, name, ref(place), ref(shape), optStr(wall.mark), en('STANDARD')]);
    c.walls.set(g.wallId, id);
    st.contained.push(id);
    const layers = (type?.layers ?? []).filter((l) => l.thickness > 0);
    if (layers.length === 0) continue;
    const layerIds = layers.map((l) => ref(c.w.add('IFCMATERIALLAYER', [ref(materialOf(c, l.materialId)), num(l.thickness), OMIT, OMIT, OMIT, OMIT, OMIT])));
    const set = c.w.add('IFCMATERIALLAYERSET', [list(layerIds), name, OMIT]);
    const usage = c.w.add('IFCMATERIALLAYERSETUSAGE', [ref(set), en('AXIS2'), en('POSITIVE'), num(0), OMIT]);
    c.w.add('IFCRELASSOCIATESMATERIAL', [gid(`matuse:${g.wallId}`), OMIT, OMIT, OMIT, list([ref(id)]), ref(usage)]);
  }
}

/** Sentido de operação de uma porta pela família (IfcDoorTypeOperationEnum); `flipHand` inverte a dobradiça. */
export function doorOperation(t: Pick<OpeningType, 'plan'>, flipHand: boolean): string {
  switch (t.plan) {
    case 'swing':
      return flipHand ? 'SINGLE_SWING_RIGHT' : 'SINGLE_SWING_LEFT';
    case 'double':
      return 'DOUBLE_DOOR_DOUBLE_SWING';
    case 'sliding':
      return flipHand ? 'SLIDING_TO_RIGHT' : 'SLIDING_TO_LEFT';
    case 'pivot':
      return 'REVOLVING';
    case 'dblact':
      return flipHand ? 'DOUBLE_SWING_RIGHT' : 'DOUBLE_SWING_LEFT';
    case 'pocket':
      return flipHand ? 'SLIDING_TO_RIGHT' : 'SLIDING_TO_LEFT';
    case 'bifold':
    case 'accordion':
      return flipHand ? 'FOLDING_TO_RIGHT' : 'FOLDING_TO_LEFT';
    case 'garage':
      return 'SECTIONAL_OVERHEAD';
    default:
      return 'NOTDEFINED';
  }
}

/** Divisão de folhas de uma janela (IfcWindowTypePartitioningEnum) pela contagem de folhas da família. */
export function windowPartition(leaves: number): string {
  if (leaves >= 3) return 'TRIPLE_PANEL_VERTICAL';
  if (leaves === 2) return 'DOUBLE_PANEL_VERTICAL';
  return 'SINGLE_PANEL';
}

/**
 * Vãos: IFCOPENINGELEMENT (furo do vão bruto, ligado à parede por IFCRELVOIDSELEMENT) e a porta ou janela que o preenche
 * (IFCDOOR/IFCWINDOW por IFCRELFILLSELEMENT). Porta e janela têm placement no vão (eixo X = direção da parede) e um
 * corpo de caixa com a espessura da parede; o furo tem a cota do vão bruto.
 */
function addOpenings(c: IfcCtx, openings: IfcOpeningGeo[]): void {
  for (const g of openings) {
    const o = c.p.elements[g.openingId];
    if (!isOpening(o)) continue;
    const host = c.p.elements[o.hostId];
    const wallId = isWall(host) ? c.walls.get(host.id) : undefined;
    const st = isWall(host) ? storeyOf(c, host.levelId) : undefined;
    const t = c.p.openingTypes[o.typeId];
    if (wallId === undefined || !st || !t) continue;
    const axis: IfcPoint = g.u;
    const atZ = (z: number): ReturnType<typeof localPlacement> => localPlacement(c.w, st.place, [g.center.x, g.center.y, z], axis);
    const voidSolid = extrudeSolid(c.w, rectOf(g.roughWidth, g.thickness), 0, g.roughHeight);
    const voidShape = bodyShape(c.w, c.ctx, 'SweptSolid', [voidSolid]);
    const voidId = c.w.add('IFCOPENINGELEMENT', [gid(`void:${g.openingId}`), OMIT, stepString(t.name), OMIT, OMIT, ref(atZ(g.roughBottomZ - st.elev)), ref(voidShape), OMIT, en('OPENING')]);
    c.w.add('IFCRELVOIDSELEMENT', [gid(`rvoid:${g.openingId}`), OMIT, OMIT, OMIT, ref(wallId), ref(voidId)]);
    const body = extrudeSolid(c.w, rectOf(g.width, g.thickness), 0, g.height);
    const shape = bodyShape(c.w, c.ctx, 'SweptSolid', [body]);
    const family = stepString(openingFamilyName(t) ?? t.name);
    const name = stepString(t.name);
    const fillId =
      o.kind === 'door'
        ? c.w.add('IFCDOOR', [gid(`door:${g.openingId}`), OMIT, name, OMIT, family, ref(atZ(g.sillZ - st.elev)), ref(shape), optStr(o.mark), num(g.height), num(g.width), en('DOOR'), en(doorOperation(t, o.flipHand)), OMIT])
        : c.w.add('IFCWINDOW', [gid(`window:${g.openingId}`), OMIT, name, OMIT, family, ref(atZ(g.sillZ - st.elev)), ref(shape), optStr(o.mark), num(g.height), num(g.width), en('WINDOW'), en(windowPartition(t.leaves)), OMIT]);
    st.contained.push(fillId);
    c.w.add('IFCRELFILLSELEMENT', [gid(`rfill:${g.openingId}`), OMIT, OMIT, OMIT, ref(voidId), ref(fillId)]);
  }
}

/** Exporta o projeto como IFC4 (texto STEP): IfcProject > IfcSite > IfcBuilding > IfcBuildingStorey (um por nível) e os elementos. */
export function exportIfc(p: Project, geo: IfcGeometry, opts: IfcExportOptions = {}): string {
  const w = new StepWriter();
  const unit = w.add('IFCSIUNIT', ['*', en('LENGTHUNIT'), OMIT, en('METRE')]);
  const units = w.add('IFCUNITASSIGNMENT', [list([ref(unit)])]);
  const world = axis3(w, [0, 0, 0]);
  const context = w.add('IFCGEOMETRICREPRESENTATIONCONTEXT', [OMIT, "'Model'", '3', num(1e-5), ref(world), OMIT]);
  const project = w.add('IFCPROJECT', [gid('project'), OMIT, stepString(p.name), OMIT, OMIT, OMIT, OMIT, list([ref(context)]), ref(units)]);
  const sitePlace = localPlacement(w, null, [0, 0, 0]);
  const site = w.add('IFCSITE', [gid('site'), OMIT, stepString(p.name), OMIT, OMIT, ref(sitePlace), OMIT, OMIT, en('ELEMENT'), OMIT, OMIT, OMIT, OMIT, OMIT]);
  const buildingPlace = localPlacement(w, sitePlace, [0, 0, 0]);
  const building = w.add('IFCBUILDING', [gid('building'), OMIT, stepString(p.name), OMIT, OMIT, ref(buildingPlace), OMIT, OMIT, en('ELEMENT'), OMIT, OMIT, OMIT]);
  const c: IfcCtx = { p, w, ctx: context, storeys: new Map(), materials: new Map(), walls: new Map() };
  const storeyIds: number[] = [];
  for (const lv of p.levels) {
    const elev = levelElevation(p, lv.id);
    const place = localPlacement(w, buildingPlace, [0, 0, elev]);
    const id = w.add('IFCBUILDINGSTOREY', [gid(`storey:${lv.id}`), OMIT, stepString(lv.name), OMIT, OMIT, ref(place), OMIT, OMIT, en('ELEMENT'), num(elev)]);
    c.storeys.set(lv.id, { id, place, elev, contained: [] });
    storeyIds.push(id);
  }
  w.add('IFCRELAGGREGATES', [gid('agg:project'), OMIT, OMIT, OMIT, ref(project), list([ref(site)])]);
  w.add('IFCRELAGGREGATES', [gid('agg:site'), OMIT, OMIT, OMIT, ref(site), list([ref(building)])]);
  if (storeyIds.length > 0) w.add('IFCRELAGGREGATES', [gid('agg:building'), OMIT, OMIT, OMIT, ref(building), list(storeyIds.map(ref))]);
  addWalls(c, geo.walls);
  addOpenings(c, geo.openings);
  addPlates(c, geo);
  addRoofs(c, geo);
  addStairs(c, geo);
  for (const lv of p.levels) {
    const st = c.storeys.get(lv.id);
    if (st && st.contained.length > 0) {
      w.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', [gid(`contain:${lv.id}`), OMIT, OMIT, OMIT, list(st.contained.map(ref)), ref(st.id)]);
    }
  }
  return w.text({ fileName: `${p.name}.ifc`, timestamp: opts.timestamp ?? '1970-01-01T00:00:00' });
}
