import { dist, mid, type SketchDraft, type SketchSeg, type Vec2 } from '@hestia/geom';
import { selectSegs, setSegSlope, effectiveSeg } from './perimeterSession.ts';
import { ROOM_HINT, SELECT_PX, hasSeg, hitSeg, segLines, triangleHit } from './perimeterToolPick.ts';
import { perimeterFromBox } from './sketchByPerimeter.ts';
import { kindOf, promptOf } from './perimeterToolShape.ts';
import { faceAt } from './sketchPickFace.ts';
import type { PointerInfo, PreviewItem, ToolEnv } from './types.ts';

/** Tolerância de captura de face, eixo ou borda, em px de tela (como as outras ferramentas de captura). */
export const PICK_PX = 10;
/** Caixa menor que isto (em px) é clique, não contorno. */
export const BOX_MIN_PX = 4;

/** Prévia da face sob o cursor: realce, rótulo e aviso para a barra de status. */
export function facePreview(env: ToolEnv, at: Vec2, cycle: number): { items: PreviewItem[]; msg: string } {
  const pick = faceAt(env, at, PICK_PX * env.metersPerPixel(), cycle);
  if (!pick) return { items: [], msg: 'Aponte para uma face, eixo ou borda do nível.' };
  return {
    items: [...segLines(pick.seg, { halo: true }), { kind: 'label', at: mid(pick.seg.a, pick.seg.b), text: pick.label }],
    msg: `${pick.label}. Clique adiciona; Tab alterna.`,
  };
}

/** Linha da face sob o cursor, ou o motivo de não servir (sem face, ou já está no esboço). */
export function facePick(env: ToolEnv, at: Vec2, cycle: number, d: SketchDraft): { seg: SketchSeg; label: string } | { msg: string } {
  const pick = faceAt(env, at, PICK_PX * env.metersPerPixel(), cycle);
  if (!pick) return { msg: 'Nada aqui: aponte para uma face, eixo ou borda.' };
  if (hasSeg(d.segs, pick.seg)) return { msg: 'Essa linha já está no esboço.' };
  return { seg: pick.seg, label: pick.label };
}

/**
 * Clique no modo de seleção. Linha de limite: seleciona a linha sob o cursor (Shift soma), e `geom` é false. Inclinação:
 * liga ou desliga o `definesSlope` da aresta do triângulo, e `geom` é true (muda a geometria do passo).
 */
export function selectClick(d: SketchDraft, p: PointerInfo, slope: boolean, mpp: number, selectHint: string): { next: SketchDraft; geom: boolean; msg: string } {
  if (slope) {
    const id = triangleHit(d, p.raw, mpp);
    if (!id) return { next: d, geom: false, msg: 'Clique no triângulo de uma aresta do contorno.' };
    const on = effectiveSeg(d, d.segs.find((s) => s.id === id)!).definesSlope;
    return { next: setSegSlope(d, id, { definesSlope: !on }), geom: true, msg: on ? 'Aresta sem inclinação definida.' : 'Aresta define a inclinação.' };
  }
  const id = hitSeg(d.segs, p.raw, SELECT_PX * mpp);
  const next = selectSegs(d, id ? [id] : [], p.shift);
  const n = next.selected.length;
  return { next, geom: false, msg: n > 0 ? `${n} linha(s) selecionada(s). Delete remove; Shift soma.` : selectHint };
}

/** Contorno pelas paredes da caixa de `a` a `b`, ou null se a caixa é um clique. `segs` vazio = nada pego (aviso em `msg`). */
export function boxPick(env: ToolEnv, a: Vec2, b: Vec2): { segs: SketchSeg[]; msg: string } | null {
  if (dist(a, b) < BOX_MIN_PX * env.metersPerPixel()) return null;
  const r = perimeterFromBox(env, a, b);
  if (r.segs.length === 0) return { segs: [], msg: r.warnings.join(' ') || 'Nenhuma parede nesta caixa.' };
  return { segs: r.segs, msg: [...r.warnings, `Contorno pela caixa: ${r.segs.length} linha(s) adicionadas.`].join(' ') };
}

const PICK_HINT = 'Linha numa face: passe sobre uma face, eixo ou borda do nível. Tab alterna; clique adiciona.';
const BOX_HINT = 'Contorno pela caixa: arraste uma caixa sobre as paredes e solte.';

/** Dica da barra de status ao escolher uma forma da galeria (ou uma das capturas). */
export function shapeHintOf(kind: string): string {
  if (kind === 'pickFace') return PICK_HINT;
  if (kind === 'byPerimeter') return BOX_HINT;
  if (kind === 'pickRoom') return ROOM_HINT;
  const k = kindOf(kind as Parameters<typeof kindOf>[0]);
  return `${k.label}: ${promptOf({ shape: k, idx: 0, vals: {} })}.`;
}
