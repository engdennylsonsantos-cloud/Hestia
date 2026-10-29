import type { CeilingType, FloorType, Id, OpeningType, Project, SlabType, WallType } from '@hestia/model';
import type { IfcFile } from './ifc.ts';
import { colorOf } from './psets.ts';
import type { StepEntity } from './step.ts';

/** Nome curto e estável para compor ids de tipo. */
export const slug = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** O mínimo que a criação de tipos precisa do contexto da importação. */
export interface TypeCtx {
  f: IfcFile;
  p: Project;
  typeOf: Map<number, StepEntity>;
  types: Map<string, Id>;
}

/**
 * Tipo de parede por nome + espessura, com uma camada de estrutura. O IFC traz a espessura (e, quando há
 * `IfcMaterialLayerSet`, as camadas); o desenho de camadas do Hestia não é reconstruído na v1.
 */
export function wallType(ctx: TypeCtx, name: string, thickness: number): Id {
  const mm = Math.round(thickness * 1000);
  const key = `wall|${name}|${mm}`;
  const hit = ctx.types.get(key);
  if (hit) return hit;
  const id = `iwt_${slug(name) || 'parede'}_${mm}`;
  const type: WallType = {
    id,
    name: name || `Parede ${mm} mm`,
    description: '',
    code: '',
    layers: [{ function: 'structure', materialId: 'mat_bloco14', thickness, wraps: true }],
    wrapInserts: 'none',
    wrapEnds: 'none',
    strips: [],
    cost: 0,
    thermalU: null,
    acousticRw: null,
    fireRating: null,
    manufacturer: 'IFC',
  };
  ctx.p.wallTypes[id] = type;
  ctx.types.set(key, id);
  return id;
}

/** Tipo de piso, laje ou forro com uma camada de estrutura da espessura importada. */
export function slabLikeType(ctx: TypeCtx, kind: 'floor' | 'slab' | 'ceiling', name: string, thickness: number): Id {
  const mm = Math.max(1, Math.round(thickness * 1000));
  const key = `${kind}|${name}|${mm}`;
  const hit = ctx.types.get(key);
  if (hit) return hit;
  const id = `i${kind === 'floor' ? 'ft' : kind === 'slab' ? 'st' : 'ct'}_${slug(name) || 'tipo'}_${mm}`;
  const layers = [{ function: 'structure' as const, materialId: 'mat_concreto', thickness, wraps: false }];
  if (kind === 'floor') {
    const t: FloorType = { id, name: name || `Piso ${mm} mm`, code: '', description: '', layers, cost: 0 };
    ctx.p.floorTypes[id] = t;
  } else if (kind === 'slab') {
    const t: SlabType = { id, name: name || `Laje ${mm} mm`, code: '', description: '', layers, cost: 0 };
    ctx.p.slabTypes[id] = t;
  } else {
    const t: CeilingType = { id, name: name || `Forro ${mm} mm`, code: '', description: '', layers, cost: 0 };
    ctx.p.ceilingTypes[id] = t;
  }
  ctx.types.set(key, id);
  return id;
}

/** Enum de operação de um tipo de porta/janela, procurando em todos os atributos. */
export function operationOf(type: StepEntity | undefined): string {
  if (!type) return '';
  for (const a of type.args) if (a.k === 'enum' && /SWING|SLIDING|DOOR|WINDOW|PANEL|FIXED|PIVOT|FOLD/.test(a.v)) return a.v;
  return '';
}

/** Tipo de porta/janela: família de planta e folhas deduzidas da operação, senão o padrão do tipo. */
export function openingType(
  ctx: TypeCtx,
  filler: StepEntity,
  kind: 'door' | 'window',
  w: number,
  h: number,
  sill: number,
): Id {
  const f = ctx.f;
  const declared = ctx.typeOf.get(filler.id);
  const name = f.text(declared, 2).trim() || f.text(filler, 2).trim() || (kind === 'door' ? 'Porta' : 'Janela');
  const op = operationOf(declared) || operationOf(filler);
  const mm = `${Math.round(w * 1000)}x${Math.round(h * 1000)}`;
  const key = `open|${kind}|${name}|${mm}`;
  const hit = ctx.types.get(key);
  if (hit) return hit;
  const double = /DOUBLE|TWO|PANEL_2|BIFOLD/.test(op);
  const sliding = /SLIDING|POCKET/.test(op);
  const plan: OpeningType['plan'] = double ? 'double' : sliding ? 'sliding' : kind === 'door' ? 'swing' : 'fixed';
  const id = `iot_${slug(name) || kind}_${mm}`;
  const type: OpeningType = {
    id,
    kind,
    name: `${name} ${Math.round(w * 100)}x${Math.round(h * 100)}`,
    width: w,
    height: h,
    sill: kind === 'door' ? 0 : Math.max(0, sill),
    leaves: double ? 2 : 1,
    plan,
    frameMaterialId: 'mat_aluminio',
    glassMaterialId: 'mat_vidro',
    closure: 'inherit',
  };
  ctx.p.openingTypes[id] = type;
  ctx.types.set(key, id);
  return id;
}

/** Material do IFC para uma cor `#rrggbb` (um por cor, reaproveitado): é o que pinta o genérico no 3D. */
export function colorMaterialId(ctx: { p: Project }, color: string | undefined): Id | undefined {
  if (!color) return undefined;
  const id = `im_${color.replace('#', '').toLowerCase()}`;
  if (!ctx.p.materials[id]) {
    ctx.p.materials[id] = { id, name: `IFC ${color}`, color, hatch: 'none', gloss: 0.1, opacity: 1, cost: 0, unit: 'm2' };
  }
  return id;
}

/** Cor do produto IFC, criando o material correspondente no projeto (o 3D do genérico usa esse material). */
export function colorOfWithMaterial(
  ctx: { p: Project; typeOf: Map<number, StepEntity> },
  f: IfcFile,
  e: StepEntity,
): string | undefined {
  const color = colorOf(f, e, ctx.typeOf.get(e.id));
  colorMaterialId(ctx, color);
  return color;
}
