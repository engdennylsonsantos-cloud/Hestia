import {
  openingCasing,
  openingLintel,
  openingSillBeam,
  openingSillBoard,
} from '@hestia/model';
import {
  SIDELIGHT_MULLION,
  TRANSOM_BAR,
  addPart,
  box,
  innerT,
  type Ctx,
} from './openingModelContext.ts';

/** Bandeiras laterais: vidro fixo de cada lado marcado, com montante entre ele e a folha. */
export function buildSidelights(c: Ctx): void {
  const s = c.sidelights;
  if (!s) return;
  const base = { t0: -c.hw + c.J, t1: c.hw - c.J };
  const z0 = c.t.kind === 'window' ? c.J : 0;
  let z1 = c.H - c.J;
  if (c.transom) z1 = Math.min(z1, c.H - c.J - c.transom.height - TRANSOM_BAR);
  const body = { s0: c.Cd - c.D / 2, s1: c.Cd + c.D / 2 };
  if (s.left) {
    addPart(c, 'sidelight-glass-left', 'glass', 'glass', box(base.t0, base.t0 + s.width, c.Cd - c.G / 2, c.Cd + c.G / 2, z0, z1));
    const m0 = base.t0 + s.width;
    addPart(c, 'sidelight-mullion-left', 'leaf', 'frame', box(m0, m0 + SIDELIGHT_MULLION, body.s0, body.s1, z0, z1));
  }
  if (s.right) {
    addPart(c, 'sidelight-glass-right', 'glass', 'glass', box(base.t1 - s.width, base.t1, c.Cd - c.G / 2, c.Cd + c.G / 2, z0, z1));
    const m1 = base.t1 - s.width;
    addPart(c, 'sidelight-mullion-right', 'leaf', 'frame', box(m1 - SIDELIGHT_MULLION, m1, body.s0, body.s1, z0, z1));
  }
}

/** Bandeira superior: travessa fixa de material de folha e vidro fixo acima; não gera item de abertura. */
export function buildTransom(c: Ctx): void {
  const tr = c.transom;
  if (!tr) return;
  const inner = innerT(c);
  const barZ0 = c.H - c.J - tr.height - TRANSOM_BAR;
  const barZ1 = c.H - c.J - tr.height;
  addPart(c, 'transom-bar', 'leaf', 'leaf', box(inner.t0, inner.t1, c.Cd - c.L / 2, c.Cd + c.L / 2, barZ0, barZ1));
  addPart(c, 'transom-glass', 'glass', 'glass', box(inner.t0, inner.t1, c.Cd - c.G / 2, c.Cd + c.G / 2, barZ1, c.H - c.J));
}

/**
 * Alizar (spec E3 §4): assenta SOBRE a face acabada da parede (`s` de `T/2` a `T/2 + thickness`), cobre a junta
 * batente/parede com a borda interna na face interna do batente (`|t| = hw − J`) e forma UMA silhueta por face
 * (`group 'casing-<face>'`). Porta: 3 lados; janela: 4.
 */
export function buildCasing(c: Ctx): void {
  const casing = openingCasing(c.t);
  if (!casing) return;
  const cw = casing.width;
  const ct = casing.thickness;
  const lado = c.t.casing?.sides;
  const faces =
    lado === 'swing' ? [c.side] : lado === 'opposite' ? [(-c.side) as 1 | -1] : ([-1, 1] as const);
  const inner = c.hw - c.J;
  const outer = inner + cw;
  const zTop = c.H - c.J;
  const zBot = c.t.kind === 'window' ? c.J : 0;
  for (const face of faces) {
    const tag = face < 0 ? 'a' : 'b';
    const group = `casing-${tag}`;
    const s0 = face * (c.thickness / 2);
    const s1 = face * (c.thickness / 2 + ct);
    addPart(c, `casing-left-${tag}`, 'casing', 'casing', box(-outer, -inner, s0, s1, zBot, zTop), { group });
    addPart(c, `casing-right-${tag}`, 'casing', 'casing', box(inner, outer, s0, s1, zBot, zTop), { group });
    addPart(c, `casing-head-${tag}`, 'casing', 'casing', box(-outer, outer, s0, s1, zTop, zTop + cw), { group });
    if (c.t.kind === 'window') {
      addPart(c, `casing-sill-${tag}`, 'casing', 'casing', box(-outer, outer, s0, s1, zBot - cw, zBot), { group });
    }
  }
}

/** Peitoril saliente de janela: projeta além das duas faces, abaixo do vão. */
export function buildSillBoard(c: Ctx): void {
  const sill = openingSillBoard(c.t);
  if (!sill) return;
  const half = c.thickness / 2 + sill.projection;
  addPart(c, 'sill-board', 'sillBoard', 'casing', box(-c.hw - 0.03, c.hw + 0.03, -half, half, -sill.thickness, 0));
}

/** Verga e contraverga de concreto, com transpasse além do vão. */
export function buildLintelBeams(c: Ctx): void {
  const lintel = openingLintel(c.t);
  if (lintel) {
    addPart(c, 'lintel', 'lintel', 'concrete', box(-c.hw - lintel.over, c.hw + lintel.over, c.core.s0, c.core.s1, c.H, c.H + lintel.height));
  }
  const beam = openingSillBeam(c.t);
  if (beam) {
    addPart(c, 'sill-beam', 'sillBeam', 'concrete', box(-c.hw - beam.over, c.hw + beam.over, c.core.s0, c.core.s1, -beam.height, 0));
  }
}
