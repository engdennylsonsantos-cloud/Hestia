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

/** Alizar em volta do vão, encostado nas duas faces da parede (3 caixas na porta, 4 na janela). */
export function buildCasing(c: Ctx): void {
  const casing = openingCasing(c.t);
  if (!casing) return;
  const cw = casing.width;
  const ct = casing.thickness;
  for (const side of [-1, 1] as const) {
    const s0 = c.thickness / 2 + 0;
    const sCenter = side * (s0 + ct / 2);
    const tag = side < 0 ? 'a' : 'b';
    addPart(c, `casing-left-${tag}`, 'casing', 'casing', box(-c.hw - cw, -c.hw, sCenter - ct / 2, sCenter + ct / 2, 0, c.H + cw));
    addPart(c, `casing-right-${tag}`, 'casing', 'casing', box(c.hw, c.hw + cw, sCenter - ct / 2, sCenter + ct / 2, 0, c.H + cw));
    addPart(c, `casing-head-${tag}`, 'casing', 'casing', box(-c.hw - cw, c.hw + cw, sCenter - ct / 2, sCenter + ct / 2, c.H, c.H + cw));
    if (c.t.kind === 'window') {
      addPart(c, `casing-sill-${tag}`, 'casing', 'casing', box(-c.hw - cw, c.hw + cw, sCenter - ct / 2, sCenter + ct / 2, -cw, 0));
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
