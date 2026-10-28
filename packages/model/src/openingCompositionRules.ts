import { machineNumber } from '@hestia/geom';
import type { Id } from './types.ts';
import {
  CASING_RULES,
  COMPOSITION_VERSION,
  type CasingDims,
  type CasingFaces,
  type CasingRing,
  type CellSize,
  type CompositionNode,
  type OpeningComposition,
  type ProfilePreset,
  type Rect,
  type ResolvedLayout,
  type SplitNode,
} from './openingComposition.ts';
import { childLengths, compositionCells, dividerWidth, nominalCellOf, resolveLayout } from './openingCompositionLayout.ts';

type Presets = Readonly<Record<Id, ProfilePreset>>;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, f: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : f);
const FACES: readonly CasingFaces[] = ['both', 'swing', 'opposite', 'exterior', 'interior', 'none'];
/** Luz mínima aceita para uma célula ou para o conjunto (m). */
const MIN_LUZ = 0.01;
const TOL = 1e-6;

function normalizeSize(v: unknown): CellSize {
  if (isObj(v) && v.mode === 'fill') return typeof v.weight === 'number' && v.weight > 0 ? { mode: 'fill', weight: v.weight } : { mode: 'fill' };
  return { mode: 'fixed', value: isObj(v) ? num(v.value, 0) : 0 };
}

function normalizeNode(v: unknown, path: string): CompositionNode {
  if (!isObj(v)) throw new Error(`Composição: nó inválido em ${path}`);
  if (v.kind === 'cell') {
    if (typeof v.id !== 'string' || !isObj(v.content) || typeof v.content.kind !== 'string') throw new Error(`Composição: célula inválida em ${path}`);
    return v as unknown as CompositionNode;
  }
  if (v.kind === 'split') {
    if (typeof v.id !== 'string' || (v.axis !== 'cols' && v.axis !== 'rows') || !Array.isArray(v.children)) throw new Error(`Composição: divisão inválida em ${path}`);
    const children = v.children.map((ch: unknown, i) => {
      if (!isObj(ch)) throw new Error(`Composição: filho inválido em ${path}[${i}]`);
      return { size: normalizeSize(ch.size), node: normalizeNode(ch.node, `${path}[${i}]`) };
    });
    return { kind: 'split', id: v.id, axis: v.axis, children, ...(v.divider ? { divider: v.divider as SplitNode['divider'] } : {}) };
  }
  throw new Error(`Composição: tipo de nó desconhecido em ${path}`);
}

/** Valida a estrutura de um valor qualquer (arquivo, UI) e põe os padrões por leitura. Lança `Error` se não for uma composição. */
export function normalizeComposition(c: unknown): OpeningComposition {
  if (!isObj(c) || !isObj(c.nominal) || !isObj(c.frame) || !c.frame.profile) throw new Error('Composição inválida');
  const n = c.nominal;
  const g = isObj(n.gap) ? { w: Math.max(0, num(n.gap.w, 0.08)), h: Math.max(0, num(n.gap.h, 0.05)) } : undefined;
  const out: OpeningComposition = {
    version: COMPOSITION_VERSION,
    nominal: {
      ref: n.ref === 'leaf' ? 'leaf' : 'opening',
      width: num(n.width, 0),
      height: num(n.height, 0),
      ...(n.ref === 'leaf' ? { gap: g ?? { w: 0.08, h: 0.05 } } : {}),
      ...(typeof n.nominalCellId === 'string' ? { nominalCellId: n.nominalCellId } : {}),
    },
    frame: { ...(c.frame as unknown as OpeningComposition['frame']), style: (c.frame.style as OpeningComposition['frame']['style']) ?? 'rebate', depthMode: (c.frame.depthMode as OpeningComposition['frame']['depthMode']) ?? 'wall' },
    layout: normalizeNode(c.layout, 'layout'),
  };
  if (isObj(c.casing)) {
    const k = c.casing;
    out.casing = {
      ...(k as unknown as OpeningComposition['casing']),
      faces: FACES.includes(k.faces as CasingFaces) ? (k.faces as CasingFaces) : CASING_RULES.defaultFaces,
      width: num(k.width, CASING_RULES.defaultWidth),
      thickness: num(k.thickness, CASING_RULES.defaultThickness),
      setback: Math.max(0, num(k.setback, CASING_RULES.defaultSetback)),
    };
  }
  return out;
}

/**
 * Primeiro problema da composição, ou null (spec §8 item 6): ids únicos; divisão com 2+ filhos e no máximo um `fill`;
 * tamanhos > 0; soma das luzes + divisores = luz do pai (sem `fill`); toda luz resolvida > 0; célula nominal válida.
 */
export function compositionIssue(c: OpeningComposition, presets?: Presets): string | null {
  const { width, height } = c.nominal;
  if (!(width > 0) || !(height > 0)) return 'Dimensões nominais devem ser positivas';
  if (c.nominal.gap && (c.nominal.gap.w < 0 || c.nominal.gap.h < 0)) return 'Folga do vão não pode ser negativa';
  const ids = new Set<string>();
  let issue: string | null = null;
  const visit = (node: CompositionNode, len: { cols: number; rows: number }): void => {
    if (issue) return;
    if (ids.has(node.id)) {
      issue = `Id repetido na composição: ${node.id}`;
      return;
    }
    ids.add(node.id);
    if (node.kind === 'cell') {
      if (len.cols < MIN_LUZ - TOL || len.rows < MIN_LUZ - TOL) issue = `Célula ${node.id} sem luz`;
      return;
    }
    if (node.children.length < 2) {
      issue = `Divisão ${node.id} precisa de ao menos 2 filhos`;
      return;
    }
    if (node.children.filter((ch) => ch.size.mode === 'fill').length > 1) {
      issue = `Divisão ${node.id} com mais de um fill`;
      return;
    }
    for (const ch of node.children) {
      if (ch.size.mode === 'fixed' ? !(ch.size.value > 0) : !((ch.size.weight ?? 1) > 0)) {
        issue = `Divisão ${node.id} com tamanho não positivo`;
        return;
      }
    }
    const cols = node.axis === 'cols';
    const total = cols ? len.cols : len.rows;
    const lens = childLengths(node, total, presets);
    const sum = lens.reduce((a, b) => a + b, 0) + (node.children.length - 1) * dividerWidth(node, presets);
    if (Math.abs(sum - total) > TOL) {
      issue = `Divisão ${node.id}: luzes + divisores (${machineNumber(sum, 3)}) diferem da luz do pai (${machineNumber(total, 3)})`;
      return;
    }
    node.children.forEach((ch, i) => visit(ch.node, cols ? { cols: lens[i]!, rows: len.rows } : { cols: len.cols, rows: lens[i]! }));
  };
  // Luz do conjunto: a mesma do resolveLayout (vão menos batente).
  const luz = resolveLayout(c, presets).luz;
  visit(c.layout, { cols: luz.t1 - luz.t0, rows: luz.z1 - luz.z0 });
  if (issue) return issue;
  if (c.nominal.ref === 'leaf') {
    const cell = nominalCellOf(c);
    if (!cell || cell.content.kind !== 'leaf') return 'Referência "leaf" exige uma célula de folha';
    if (c.nominal.nominalCellId && !compositionCells(c).some((x) => x.id === c.nominal.nominalCellId)) return 'Célula nominal inexistente';
  }
  return null;
}

/**
 * Anéis do alizar por face (spec §4). A luz é a envoltória das luzes das células; o anel interno = luz + recuo; o externo =
 * interno + largura. Porta: sem lado inferior (`openBottom`, o anel parte do piso). `swingFace` diz em que face a folha abre,
 * para 'swing'/'opposite' (padrão 'exterior').
 */
export function casingRings(c: OpeningComposition, l: ResolvedLayout, kind: 'door' | 'window', swingFace: 'exterior' | 'interior' = 'exterior'): CasingRing[] {
  const k = c.casing;
  if (!k || k.faces === 'none') return [];
  const other = swingFace === 'exterior' ? 'interior' : 'exterior';
  const faces: ('exterior' | 'interior')[] =
    k.faces === 'both' ? ['exterior', 'interior'] : k.faces === 'swing' ? [swingFace] : k.faces === 'opposite' ? [other] : [k.faces];
  const open = kind === 'door';
  const out: CasingRing[] = [];
  for (const face of faces) {
    const d: CasingDims = { width: k.width, thickness: k.thickness, setback: k.setback, ...(k[face] ?? {}) };
    if (!(d.width > 0)) continue;
    const s = Math.max(0, d.setback);
    const inner: Rect = { t0: l.luz.t0 - s, t1: l.luz.t1 + s, z0: open ? l.luz.z0 : l.luz.z0 - s, z1: l.luz.z1 + s };
    const outer: Rect = { t0: inner.t0 - d.width, t1: inner.t1 + d.width, z0: open ? inner.z0 : inner.z0 - d.width, z1: inner.z1 + d.width };
    out.push({ face, inner, outer, openBottom: open, thickness: d.thickness });
  }
  return out;
}
