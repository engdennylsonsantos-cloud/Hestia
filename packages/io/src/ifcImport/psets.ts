import type { IfcProperty } from '@hestia/model';
import type { IfcFile } from './ifc.ts';
import { listOf, numOf, type StepEntity, type StepValue } from './step.ts';

/**
 * Leitura das propriedades (psets/quantities) e da cor de um produto IFC.
 *
 * - `IfcRelDefinesByProperties` liga um elemento (ou o seu tipo) a `IfcPropertySet`/`IfcElementQuantity`.
 * - `IfcStyledItem` liga um item de representação a `IfcSurfaceStyle` → `IfcSurfaceStyleRendering` → `IfcColourRgb`.
 *
 * Tudo é lido uma vez por arquivo (índices em cache) e devolvido de forma determinística: nomes únicos, ordenados,
 * valores só string/número/booleano (nada de `undefined`, `NaN` ou vazio) e com teto de 200 por elemento.
 */

type Scalar = string | number | boolean;

/** Teto de propriedades gravadas por elemento. */
const MAX_PROPERTIES = 200;

/** Profundidade máxima ao seguir itens mapeados/booleanos na representação. */
const MAX_DEPTH = 8;

/** Entidades que viram propriedade; o resto (propriedade complexa, tabela...) fica de fora. */
const READABLE = /^IFC(PROPERTYSINGLEVALUE|PROPERTYENUMERATEDVALUE|PROPERTYLISTVALUE|QUANTITY)/;

interface PsetIndex {
  /** Definições de propriedade por id de objeto (elemento ou tipo). */
  byObject: Map<number, StepEntity[]>;
  /** Cor `#rrggbb` por id de item de representação. */
  colorByItem: Map<number, string>;
}

const cache = new WeakMap<IfcFile, PsetIndex>();

/** Índices do arquivo, montados na primeira consulta. */
function indexOf(f: IfcFile): PsetIndex {
  const hit = cache.get(f);
  if (hit) return hit;
  const index: PsetIndex = { byObject: new Map(), colorByItem: colorIndex(f) };
  for (const rel of f.byType('IFCRELDEFINESBYPROPERTIES')) {
    const def = f.ent(rel, 5);
    if (!def) continue;
    for (const obj of f.list(rel, 4)) {
      const list = index.byObject.get(obj.id);
      if (!list) index.byObject.set(obj.id, [def]);
      else if (!list.includes(def)) list.push(def);
    }
  }
  cache.set(f, index);
  return index;
}

/** Propriedades e quantitativos do elemento e do seu tipo, ordenados por nome. */
export function propertiesOf(f: IfcFile, product: StepEntity, type?: StepEntity): IfcProperty[] {
  const index = indexOf(f);
  const defs = [...(index.byObject.get(product.id) ?? [])];
  if (type) defs.push(...(index.byObject.get(type.id) ?? []));
  const byName = new Map<string, Scalar>();
  for (const def of defs) readDefinition(f, def, byName);
  return [...byName.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, MAX_PROPERTIES)
    .map(([name, value]) => ({ name, value }));
}

function readDefinition(f: IfcFile, def: StepEntity, out: Map<string, Scalar>): void {
  if (def.type === 'IFCPROPERTYSET') {
    for (const prop of f.list(def, 4)) addValue(f, prop, 2, out);
    return;
  }
  if (def.type === 'IFCELEMENTQUANTITY') {
    for (const quantity of f.list(def, 5)) addValue(f, quantity, 3, out);
  }
}

/** Nome + valor de uma propriedade/quantidade; vazio, repetido ou ilegível fica de fora. */
function addValue(f: IfcFile, e: StepEntity, valueIndex: number, out: Map<string, Scalar>): void {
  if (!READABLE.test(e.type)) return;
  const name = f.text(e, 0).trim();
  if (!name || out.has(name)) return;
  const value = scalar(e.args[valueIndex]);
  if (value != null) out.set(name, value);
}

/** Converte um `StepValue` para o valor gravado no modelo (ou `null` quando vazio/ilegível). */
function scalar(v: StepValue | undefined): Scalar | null {
  if (!v) return null;
  switch (v.k) {
    case 'num':
      return Number.isFinite(v.v) ? v.v : null;
    case 'str': {
      const text = v.v.trim();
      return text ? text : null;
    }
    case 'enum': {
      const bool = boolOf(v.v);
      return bool ?? (v.v.trim() || null);
    }
    case 'type':
      return typed(v.name, v.arg);
    case 'list':
      return joined(v.items);
    default:
      return null;
  }
}

const boolOf = (name: string): boolean | null => {
  const upper = name.toUpperCase();
  if (upper === 'T' || upper === 'TRUE') return true;
  if (upper === 'F' || upper === 'FALSE') return false;
  return null;
};

/** Valor tipado (`IFCBOOLEAN(.T.)`, `IFCLENGTHMEASURE(2.7)`, `IFCLABEL('x')`...). */
function typed(name: string, arg: StepValue): Scalar | null {
  if (name === 'IFCBOOLEAN' || name === 'IFCLOGICAL') {
    const bool = arg.k === 'enum' ? boolOf(arg.v) : null;
    return bool ?? scalar(arg);
  }
  if (/^IFC(INTEGER|REAL|NUMBER)$/.test(name) || /(MEASURE|RATIO)$/.test(name)) {
    const value = numOf(arg);
    return value != null && Number.isFinite(value) ? value : null;
  }
  return scalar(arg);
}

/** Lista/enumerado: um valor só mantém o tipo; vários viram texto separado por vírgula. */
function joined(items: StepValue[]): Scalar | null {
  const values = items.map(scalar).filter((x): x is Scalar => x != null);
  if (!values.length) return null;
  if (values.length === 1) return values[0]!;
  return values.map(String).join(', ');
}

/** Cor do elemento; sem estilo próprio, tenta a do tipo (a do item vence). */
export function colorOf(f: IfcFile, product: StepEntity, type?: StepEntity): string | undefined {
  const own = colorOfProduct(f, product);
  if (own) return own;
  return type ? colorOfProduct(f, type) : undefined;
}

function colorOfProduct(f: IfcFile, product: StepEntity): string | undefined {
  const index = indexOf(f);
  for (const id of shapeItems(f, product)) {
    const color = index.colorByItem.get(id);
    if (color) return color;
  }
  return undefined;
}

/** Ids dos itens de representação do produto, seguindo itens mapeados e o primeiro operando booleano. */
function shapeItems(f: IfcFile, product: StepEntity): number[] {
  const ids: number[] = [];
  const visit = (item: StepEntity, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    ids.push(item.id);
    if (item.type === 'IFCMAPPEDITEM') {
      const rep = f.ent(f.ent(item, 0), 1);
      for (const sub of f.list(rep, 3)) visit(sub, depth + 1);
    } else if (item.type === 'IFCBOOLEANRESULT' || item.type === 'IFCBOOLEANCLIPPINGRESULT') {
      const first = f.ent(item, 1);
      if (first) visit(first, depth + 1);
    }
  };
  for (const rep of f.list(f.ent(product, 6), 2)) {
    for (const item of f.list(rep, 3)) visit(item, 0);
  }
  return ids;
}

/** `IfcStyledItem` → cor do item, aceitando `IfcPresentationStyleAssignment` (IFC2X3) e `IfcSurfaceStyle` direto. */
function colorIndex(f: IfcFile): Map<number, string> {
  const out = new Map<number, string>();
  for (const styled of f.byType('IFCSTYLEDITEM')) {
    const item = f.ref(styled, 0);
    if (item == null || out.has(item)) continue;
    const color = colorOfStyles(f, listOf(styled.args[1]));
    if (color) out.set(item, color);
  }
  return out;
}

function colorOfStyles(f: IfcFile, styles: StepValue[]): string | undefined {
  for (const value of styles) {
    const style = f.deref(value);
    if (!style) continue;
    if (style.type === 'IFCPRESENTATIONSTYLEASSIGNMENT') {
      const nested = colorOfStyles(f, listOf(style.args[0]));
      if (nested) return nested;
      continue;
    }
    if (style.type !== 'IFCSURFACESTYLE') continue;
    for (const surface of f.list(style, 2)) {
      const color = colorOfSurface(f, surface);
      if (color) return color;
    }
  }
  return undefined;
}

function colorOfSurface(f: IfcFile, style: StepEntity): string | undefined {
  if (style.type !== 'IFCSURFACESTYLERENDERING' && style.type !== 'IFCSURFACESTYLESHADING') return undefined;
  const rgb = f.ent(style, 0);
  if (!rgb || rgb.type !== 'IFCCOLOURRGB') return undefined;
  const channel = (v: number | null): string =>
    Math.max(0, Math.min(255, Math.round((v ?? 0) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(f.num(rgb, 1))}${channel(f.num(rgb, 2))}${channel(f.num(rgb, 3))}`;
}
