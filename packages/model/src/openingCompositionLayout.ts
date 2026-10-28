import type { Id } from './types.ts';
import {
  DIVIDER_WIDTH_DEFAULT,
  type CellContent,
  type CellNode,
  type MemberNeighbor,
  type MemberRole,
  type OpeningComposition,
  type ProfilePreset,
  type ProfileSpec,
  type Rect,
  type ResolvedCell,
  type ResolvedLayout,
  type ResolvedMember,
  type SplitNode,
} from './openingComposition.ts';
import { resolveProfile } from './openingProfiles.ts';

type Presets = Readonly<Record<Id, ProfilePreset>>;
type Axis = 'cols' | 'rows';

/** Folga padrão vão × folha (NBR 15930-2). Cópia local de `OPENING_SPAN_GAP_DEFAULTS` para não criar ciclo com openingNominal.ts. */
const GAP_DEFAULT = { w: 0.08, h: 0.05 };
const EPS = 1e-6;

/** Largura do divisor da divisão (perfil próprio, ou o padrão 0,05). */
export function dividerWidth(s: SplitNode, presets?: Presets): number {
  if (!s.divider) return DIVIDER_WIDTH_DEFAULT;
  const w = resolveProfile(s.divider, presets).visibleWidth;
  return w > 0 ? w : DIVIDER_WIDTH_DEFAULT;
}

/** Todas as células da árvore, na ordem (t crescente, z crescente). */
export function compositionCells(c: OpeningComposition): CellNode[] {
  const out: CellNode[] = [];
  const walk = (n: OpeningComposition['layout']): void => {
    if (n.kind === 'cell') out.push(n);
    else n.children.forEach((ch) => walk(ch.node));
  };
  walk(c.layout);
  return out;
}

/** Célula da referência nominal: `nominalCellId` se existir; senão a primeira célula `leaf`; senão null. */
export function nominalCellOf(c: OpeningComposition): CellNode | null {
  const cells = compositionCells(c);
  return cells.find((x) => x.id === c.nominal.nominalCellId) ?? cells.find((x) => x.content.kind === 'leaf') ?? null;
}

/** Porta ou janela: porta se alguma célula tem família `door_*`. */
export function compositionKind(c: OpeningComposition): 'door' | 'window' {
  return compositionCells(c).some((x) => x.content.kind === 'leaf' && x.content.family.startsWith('door_')) ? 'door' : 'window';
}

/** Soma dos módulos fixos e divisores, ao longo do eixo, que acompanham a célula `targetId` (null se ela não existe). */
function extrasAlong(node: OpeningComposition['layout'], targetId: string, axis: Axis, presets?: Presets): number | null {
  if (node.kind === 'cell') return node.id === targetId ? 0 : null;
  for (const ch of node.children) {
    const inner = extrasAlong(ch.node, targetId, axis, presets);
    if (inner === null) continue;
    if (node.axis !== axis) return inner;
    let sum = inner + (node.children.length - 1) * dividerWidth(node, presets);
    for (const o of node.children) if (o !== ch && o.size.mode === 'fixed') sum += o.size.value;
    return sum;
  }
  return null;
}

/** Vão total da composição (m). Com `nominal.ref 'leaf'`: folha + folga + demais módulos e divisores (spec §2.5). */
export function compositionSpan(c: OpeningComposition, presets?: Presets): { width: number; height: number } {
  const n = c.nominal;
  if (n.ref !== 'leaf') return { width: n.width, height: n.height };
  const g = n.gap ?? GAP_DEFAULT;
  const cell = nominalCellOf(c);
  const w = cell ? extrasAlong(c.layout, cell.id, 'cols', presets) ?? 0 : 0;
  const h = cell ? extrasAlong(c.layout, cell.id, 'rows', presets) ?? 0 : 0;
  return { width: n.width + g.w + w, height: n.height + g.h + h };
}

/** Folha nominal (m): `nominal` com 'leaf'; com 'opening', o vão menos a folga e os demais módulos (nunca negativa). */
export function compositionLeafSize(c: OpeningComposition, presets?: Presets): { width: number; height: number } {
  const n = c.nominal;
  if (n.ref === 'leaf') return { width: n.width, height: n.height };
  const g = n.gap ?? GAP_DEFAULT;
  const cell = nominalCellOf(c);
  const w = cell ? extrasAlong(c.layout, cell.id, 'cols', presets) ?? 0 : 0;
  const h = cell ? extrasAlong(c.layout, cell.id, 'rows', presets) ?? 0 : 0;
  return { width: Math.max(0, n.width - g.w - w), height: Math.max(0, n.height - g.h - h) };
}

/** Luz de cada filho da divisão dentro de `len` (m). Fixo = o valor; `fill` divide o que sobra por peso (pode sair ≤ 0: inválido). */
export function childLengths(s: SplitNode, len: number, presets?: Presets): number[] {
  const d = dividerWidth(s, presets);
  let rest = len - (s.children.length - 1) * d;
  let weights = 0;
  for (const ch of s.children) {
    if (ch.size.mode === 'fixed') rest -= ch.size.value;
    else weights += ch.size.weight ?? 1;
  }
  return s.children.map((ch) => (ch.size.mode === 'fixed' ? ch.size.value : (rest * (ch.size.weight ?? 1)) / (weights || 1)));
}

const treatmentOf = (c: CellContent): 'stop' | 'glassRebate' | 'panelRebate' | 'plain' =>
  c.kind === 'leaf' ? 'stop' : c.kind === 'glass' ? 'glassRebate' : c.kind === 'panel' ? 'panelRebate' : 'plain';

const overlap = (a0: number, a1: number, b0: number, b1: number): boolean => Math.min(a1, b1) - Math.max(a0, b0) > EPS;

/**
 * Resolve a árvore em retângulos (spec §3): luz de cada célula e extensão de cada membro, em coordenadas locais do vão
 * (`t` de -W/2 a W/2; `z` de 0 a H). Quadro único; ombreiras só na luz entre travessas; cada divisor ocupa a área da sua divisão.
 * Porta não tem membro inferior (soleira só com `frame.sill`); janela tem peitoril, salvo `frame.sill === null`.
 */
export function resolveLayout(c: OpeningComposition, presets?: Presets, kind: 'door' | 'window' = compositionKind(c)): ResolvedLayout {
  const span = compositionSpan(c, presets);
  const hw = span.width / 2;
  const block = c.frame.style === 'block';
  const frame = resolveProfile(c.frame.profile, presets);
  const J = block ? 0 : frame.visibleWidth;
  const sillRef = c.frame.sill === undefined ? (kind === 'window' ? c.frame.profile : null) : c.frame.sill;
  const sillSpec: ProfileSpec | null = !block && sillRef ? resolveProfile(sillRef, presets) : null;
  const sillW = sillSpec ? sillSpec.visibleWidth : 0;
  // Porta com `frame.sill`: travessa-base só sob o vidro/painel que chega ao piso (nunca sob a folha); janela: peitoril de largura total.
  const doorBase = kind === 'door' && !!sillSpec;
  const luz: Rect = { t0: -hw + J, t1: hw - J, z0: doorBase ? 0 : sillW, z1: span.height - J };

  const cells: ResolvedCell[] = [];
  const members: ResolvedMember[] = [];
  const wall: MemberNeighbor = { kind: 'wall' };
  const walk = (node: OpeningComposition['layout'], r: Rect): void => {
    if (node.kind === 'cell') {
      cells.push({ id: node.id, luz: { ...r }, content: node.content });
      return;
    }
    const cols = node.axis === 'cols';
    const d = dividerWidth(node, presets);
    const dividerSpec: ProfileSpec = node.divider ? resolveProfile(node.divider, presets) : { ...frame, visibleWidth: DIVIDER_WIDTH_DEFAULT, section: 'T' };
    const lens = childLengths(node, cols ? r.t1 - r.t0 : r.z1 - r.z0, presets);
    let pos = cols ? r.t0 : r.z0;
    node.children.forEach((ch, i) => {
      const sub: Rect = cols ? { ...r, t0: pos, t1: pos + lens[i]! } : { ...r, z0: pos, z1: pos + lens[i]! };
      walk(ch.node, sub);
      pos += lens[i]!;
      if (i < node.children.length - 1) {
        const rect: Rect = cols ? { t0: pos, t1: pos + d, z0: r.z0, z1: r.z1 } : { t0: r.t0, t1: r.t1, z0: pos, z1: pos + d };
        members.push({ id: `${cols ? 'mullion' : 'transom'}-${node.id}-${i}`, role: cols ? 'mullion' : 'transom', rect, profile: dividerSpec, before: wall, after: wall });
        pos += d;
      }
    });
  };
  walk(c.layout, luz);
  if (doorBase && sillSpec) {
    for (const cell of cells) {
      if (Math.abs(cell.luz.z0) > EPS || (cell.content.kind !== 'glass' && cell.content.kind !== 'panel')) continue;
      members.push({ id: `sill-${cell.id}`, role: 'sill', rect: { t0: cell.luz.t0, t1: cell.luz.t1, z0: 0, z1: sillW }, profile: sillSpec, before: wall, after: wall });
      cell.luz.z0 = sillW;
    }
  }

  if (!block) {
    const add = (id: string, role: MemberRole, rect: Rect, profile: ProfileSpec): void => {
      members.push({ id, role, rect, profile, before: wall, after: wall });
    };
    add('jamb-left', 'jamb', { t0: -hw, t1: -hw + J, z0: luz.z0, z1: luz.z1 }, frame);
    add('jamb-right', 'jamb', { t0: hw - J, t1: hw, z0: luz.z0, z1: luz.z1 }, frame);
    add('head', 'head', { t0: -hw, t1: hw, z0: luz.z1, z1: span.height }, frame);
    if (sillSpec && !doorBase) add('sill', 'sill', { t0: -hw, t1: hw, z0: 0, z1: sillW }, sillSpec);
  }

  // Vizinhos: a célula cuja luz encosta no membro, do lado de menor (before) e de maior (after) coordenada.
  const side = (m: ResolvedMember, after: boolean): MemberNeighbor => {
    const vertical = m.role === 'jamb' || m.role === 'mullion';
    const hit = cells.find((x) => {
      const l = x.luz;
      if (vertical) return overlap(l.z0, l.z1, m.rect.z0, m.rect.z1) && Math.abs(after ? l.t0 - m.rect.t1 : l.t1 - m.rect.t0) < EPS;
      return overlap(l.t0, l.t1, m.rect.t0, m.rect.t1) && Math.abs(after ? l.z0 - m.rect.z1 : l.z1 - m.rect.z0) < EPS;
    });
    return hit ? { kind: 'cell', cellId: hit.id, treatment: treatmentOf(hit.content) } : wall;
  };
  for (const m of members) {
    m.before = side(m, false);
    m.after = side(m, true);
  }
  return { span, luz, cells, members };
}
