import type { OpeningType } from './openingTypes.ts';
import { openingFamilyOf, type OpeningFamilyId } from './opening.ts';
import { openingNominalRef, openingSpanGap, openingSpanOf } from './openingNominal.ts';
import { compositionIssue } from './openingCompositionRules.ts';
import { profileMaterialOf } from './openingProfiles.ts';
import {
  COMPOSITION_VERSION,
  LEGACY_SIDELIGHT_MULLION,
  LEGACY_TRANSOM_BAR,
  type CellNode,
  type CompositionNode,
  type LeafOptions,
  type OpeningComposition,
  type ProfilePreset,
  type ProfileSpec,
  type SplitNode,
} from './openingComposition.ts';

/** Padrões do batente quando o tipo antigo não os define (iguais a OPENING_FRAME_DEFAULTS, em defaults.ts). */
const FRAME_W = 0.05;
const FRAME_D = 0.09;
const positive = (v: number | undefined, f: number): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : f);

/** Campos de folha do tipo antigo que viram `LeafOptions` da célula (só os definidos, para não gravar `undefined`). */
const OPTION_KEYS = [
  'leafStyle', 'handle', 'glassRatio', 'hinges', 'leafThickness', 'leafMaterialId', 'glassKind', 'glassThickness', 'grid',
  'tiltAxis', 'leafSide', 'leafUndercut', 'handleHeight', 'handleInset', 'angle2d', 'angle3d', 'showSwing', 'swingStyle', 'leafPlan',
] as const satisfies readonly (keyof LeafOptions)[];

function optionsOf(t: OpeningType): LeafOptions {
  const o: Record<string, unknown> = {};
  for (const k of OPTION_KEYS) if (t[k] !== undefined) o[k] = t[k];
  return o as LeafOptions;
}

const SECTION_OF_STYLE = { rebate: 'rect_rebate', simple: 'rect', aduela: 'rect_rebate', block: 'none' } as const;

function mainCell(t: OpeningType): CellNode {
  const family: OpeningFamilyId = openingFamilyOf(t)?.id ?? (t.kind === 'door' ? 'door_swing' : 'window_fixed');
  return { kind: 'cell', id: 'c1', content: { kind: 'leaf', family, plan: t.plan, leaves: t.leaves, options: optionsOf(t) } };
}

/** Bandeira do tipo antigo: vidro fixo, ou (`fixed: false`) célula maxim-ar. */
function transomCell(t: OpeningType, thickness: number): CellNode {
  if (t.transom?.fixed === false) {
    return { kind: 'cell', id: 'transom', content: { kind: 'leaf', family: 'window_casement', plan: 'casement', leaves: 1, options: {} } };
  }
  return { kind: 'cell', id: 'transom', content: { kind: 'glass', glass: { kind: t.glassKind ?? 'clear', thickness, mounting: 'rebate' } } };
}

const dividerOf = (frame: ProfileSpec, width: number) => ({ inline: { ...frame, visibleWidth: width, section: 'T' as const } });

/**
 * Tipo atual → composição (spec §7). Sem `transom`/`sidelights`: UMA célula, vão e peças idênticos aos de hoje. Com eles: o
 * mapeamento da §7 (bandeira acima da folha, vidros nas laterais; a célula principal é `fill`); `nominalRef 'leaf'` vira
 * 'opening' com o vão atual. Lê só campos do tipo; nunca lança (valores inválidos caem nos padrões).
 */
export function compositionOfType(t: OpeningType): OpeningComposition {
  const style = t.frameStyle ?? 'rebate';
  const frame: ProfileSpec = {
    material: profileMaterialOf(t.frameMaterialId),
    section: SECTION_OF_STYLE[style] ?? 'rect_rebate',
    visibleWidth: positive(t.frameWidth, FRAME_W),
    depth: positive(t.frameDepth, FRAME_D),
  };
  const casing = t.casing
    ? { faces: t.casing.sides ?? ('both' as const), width: t.casing.width, thickness: t.casing.thickness, setback: 0 }
    : undefined;
  const head = { frame: { style, profile: { inline: frame }, depthMode: t.frameDepthMode ?? ('core' as const) }, ...(casing ? { casing } : {}) };
  const sl = t.sidelights && (t.sidelights.left || t.sidelights.right) ? t.sidelights : undefined;
  const tr = t.transom && t.transom.height > 0 ? t.transom : undefined;

  if (!sl && !tr) {
    const leaf = openingNominalRef(t) === 'leaf';
    return {
      version: COMPOSITION_VERSION,
      nominal: { ref: leaf ? 'leaf' : 'opening', width: t.width, height: t.height, ...(leaf ? { gap: openingSpanGap(t), nominalCellId: 'c1' } : {}) },
      ...head,
      layout: mainCell(t),
    };
  }

  // Bandeira e/ou laterais: o vão atual manda (a folha encolhia no modelo antigo), nominal 'opening'.
  const span = openingSpanOf({ width: t.width, height: t.height, nominalRef: t.nominalRef, spanGap: t.spanGap });
  let node: CompositionNode = mainCell(t);
  if (sl) {
    const n = (sl.left ? 1 : 0) + (sl.right ? 1 : 0);
    // Largura do vidro lateral: pedida, no máximo metade do vão e sem esmagar a célula principal (mínimo 0,1 de luz).
    const room = (span.width - 2 * frame.visibleWidth - n * LEGACY_SIDELIGHT_MULLION - 0.1) / n;
    const w = Math.max(0.01, Math.min(sl.width, span.width / 2, room));
    const side = (id: string): { size: { mode: 'fixed'; value: number }; node: CellNode } => ({
      size: { mode: 'fixed', value: w },
      node: { kind: 'cell', id, content: { kind: 'glass', glass: { kind: t.glassKind ?? 'clear', thickness: positive(t.glassThickness, 0.012), mounting: 'rebate' } } },
    });
    const cols: SplitNode['children'] = [
      ...(sl.left ? [side('side-left')] : []),
      { size: { mode: 'fill' }, node },
      ...(sl.right ? [side('side-right')] : []),
    ];
    node = { kind: 'split', id: 'cols', axis: 'cols', children: cols, divider: dividerOf(frame, LEGACY_SIDELIGHT_MULLION) };
  }
  if (tr) {
    const h = Math.min(tr.height, 0.4 * span.height);
    node = {
      kind: 'split',
      id: 'rows',
      axis: 'rows',
      children: [{ size: { mode: 'fill' }, node }, { size: { mode: 'fixed', value: h }, node: transomCell(t, positive(t.glassThickness, 0.012)) }],
      divider: dividerOf(frame, LEGACY_TRANSOM_BAR),
    };
  }
  return { version: COMPOSITION_VERSION, nominal: { ref: 'opening', width: span.width, height: span.height }, ...head, layout: node };
}

/** Composição do tipo: a gravada, ou a derivada dos campos atuais (leitor da ponte F3–F5, spec §7). */
export const openingCompositionOf = (t: OpeningType): OpeningComposition => t.composition ?? compositionOfType(t);

/**
 * Ponte F3–F5 (spec §7) para `upsertOpeningType`. Tipo que já tem composição (ele ou a versão gravada): se é de UMA célula, ou ainda
 * traz bandeira/laterais antigas, a edição vem dos campos atuais e a composição é regenerada; a de várias células editada direto
 * é preservada. Em qualquer caso valida com `compositionIssue` (lança `Error`). Tipo sem composição passa como está.
 */
export function withBridgedComposition(next: OpeningType, prev: OpeningType | undefined, profiles?: Record<string, ProfilePreset>): OpeningType {
  if (!next.composition && !prev?.composition) return next;
  // Composição editada direto (nova ou diferente da gravada) é preservada; os campos obsoletos só regeneram a composição intocada.
  const edited = !!next.composition && (!prev?.composition || JSON.stringify(next.composition) !== JSON.stringify(prev.composition));
  const legacy = !next.composition || (!edited && (next.composition.layout.kind === 'cell' || !!next.transom || !!next.sidelights));
  const out = legacy ? { ...next, composition: compositionOfType(next) } : next;
  const issue = compositionIssue(out.composition!, profiles);
  if (issue) throw new Error(issue);
  return out;
}
