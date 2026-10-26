import type { OpeningLineConvention } from '@hestia/model';
import type { LeafOpening, OpeningModel } from './openingModelTypes.ts';

/** Ponto da linha de abertura em coordenadas de tela: `u` na horizontal (x = −viewSide·t) e `z` na altura. */
export interface OpeningLinePoint {
  u: number;
  z: number;
}

/** Linha de abertura pronta para desenhar; `dashed` segue a convenção do projeto. */
export interface OpeningLinePath {
  pts: OpeningLinePoint[];
  dashed: boolean;
}

/** Faixa `t` ocupada pela folha (moldura, vidro ou almofadas); cai no eixo de abertura quando não há peças. */
function leafSpan(m: OpeningModel, opening: LeafOpening): { t0: number; t1: number } {
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const part of m.parts) {
    if (part.leaf !== opening.leaf) continue;
    if (part.role !== 'leaf' && part.role !== 'glass' && part.role !== 'leafPanel') continue;
    t0 = Math.min(t0, part.box.t0);
    t1 = Math.max(t1, part.box.t1);
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) {
    t0 = Math.min(opening.hingeT, opening.latchT);
    t1 = Math.max(opening.hingeT, opening.latchT);
  }
  return { t0, t1 };
}

/** Tracejado quando a folha abre para o observador (ou o contrário, com `dashed: 'away'`). */
function isDashed(opening: LeafOpening, viewSide: 1 | -1, conv: OpeningLineConvention): boolean {
  const toward = opening.side !== 0 && opening.side === viewSide;
  return conv.dashed === 'toward' ? toward : !toward;
}

/** Zigue-zague dos painéis dobrados de uma cadeia (dobrável/sanfonada), sem V. */
function foldZigzag(m: OpeningModel, opening: LeafOpening, u: (t: number) => number): OpeningLinePath | null {
  const paineis = m.parts.filter((p) => p.motion?.kind === 'fold' && p.motion.tAnchor === opening.hingeT);
  if (paineis.length === 0) return null;
  const t0 = Math.min(opening.hingeT, opening.latchT);
  const t1 = Math.max(opening.hingeT, opening.latchT);
  const z0 = opening.z0 + 0.01;
  const z1 = opening.z1 - 0.01;
  const pts: OpeningLinePoint[] = [];
  for (let i = 0; i <= paineis.length; i++) {
    const t = t0 + ((t1 - t0) * i) / paineis.length;
    pts.push({ u: u(t), z: i % 2 === 0 ? z1 : z0 });
  }
  return { pts, dashed: false };
}

/** Juntas horizontais e seta para cima do portão seccionado. */
function overheadLines(m: OpeningModel, opening: LeafOpening, u: (t: number) => number): OpeningLinePath[] {
  const out: OpeningLinePath[] = [];
  const folhas = m.parts.filter((p) => p.role === 'leaf');
  if (folhas.length === 0) return out;
  let t0 = Infinity;
  let t1 = -Infinity;
  const zs = new Set<number>();
  for (const p of folhas) {
    t0 = Math.min(t0, p.box.t0);
    t1 = Math.max(t1, p.box.t1);
    zs.add(p.box.z0);
    zs.add(p.box.z1);
  }
  const ordenadas = [...zs].sort((a, b) => a - b);
  for (let i = 1; i < ordenadas.length - 1; i++) {
    const z = ordenadas[i]!;
    out.push({ pts: [{ u: u(t0), z }, { u: u(t1), z }], dashed: false });
  }
  const mid = (opening.z0 + opening.z1) / 2;
  const tMeio = (t0 + t1) / 2;
  out.push({ pts: [{ u: u(tMeio), z: mid }, { u: u(tMeio), z: opening.z1 }], dashed: false });
  out.push({
    pts: [
      { u: u(tMeio) - 0.04, z: opening.z1 - 0.08 },
      { u: u(tMeio), z: opening.z1 },
      { u: u(tMeio) + 0.04, z: opening.z1 - 0.08 },
    ],
    dashed: false,
  });
  return out;
}

/**
 * Linhas de abertura (V, seta e eixo) do modelo único, em coordenadas de tela da elevação ou do corte
 * (docs/aberturas/E-spec-modelo-unico.md §1). A horizontal é `u = −viewSide·t`.
 *
 * - Giro lateral: vértice no lado do trinco (`apex: 'latch'`, padrão) a meia altura da folha e pontas nos cantos
 *   superior e inferior do lado da dobradiça (`apex: 'hinge'` inverte).
 * - Maxim-ar (`top`): vértice na aresta oposta ao eixo (embaixo) e pontas nas duas pontas do eixo (em cima); a
 *   basculante (`bottom`) é o contrário.
 * - Pivotante: vértice sobre o eixo, pontas na borda oposta da folha.
 * - Correr: seta horizontal (haste e ponta). Folha fixa, bandeira e vidro fixo não geram linha.
 */
export function openingLinePaths(
  m: OpeningModel,
  viewSide: 1 | -1,
  conv: OpeningLineConvention,
  _view: 'elevation' | 'section',
): OpeningLinePath[] {
  const out: OpeningLinePath[] = [];
  const u = (t: number): number => -viewSide * t;
  let slideDone = false;
  for (const opening of m.openings) {
    const dashed = isDashed(opening, viewSide, conv);
    if (opening.kind === 'fixed') continue;
    if (opening.kind === 'fold') {
      const zig = foldZigzag(m, opening, u);
      if (zig) out.push(zig);
      continue;
    }
    if (opening.kind === 'overhead') {
      out.push(...overheadLines(m, opening, u));
      continue;
    }
    if (opening.kind === 'side') {
      const apexT = conv.apex === 'latch' ? opening.latchT : opening.hingeT;
      const tipT = conv.apex === 'latch' ? opening.hingeT : opening.latchT;
      const mid = (opening.z0 + opening.z1) / 2;
      const v: OpeningLinePoint[] = [
        { u: u(tipT), z: opening.z1 },
        { u: u(apexT), z: mid },
        { u: u(tipT), z: opening.z0 },
      ];
      if (opening.both) {
        // Vai-e-vem: o V contínuo e o tracejado ficam superpostos.
        out.push({ pts: v, dashed: false });
        out.push({ pts: v, dashed: true });
      } else {
        out.push({ pts: v, dashed });
      }
      continue;
    }
    if (opening.kind === 'pivot') {
      const span = leafSpan(m, opening);
      const far = Math.abs(span.t0 - opening.hingeT) > Math.abs(span.t1 - opening.hingeT) ? span.t0 : span.t1;
      const mid = (opening.z0 + opening.z1) / 2;
      out.push({
        pts: [
          { u: u(far), z: opening.z1 },
          { u: u(opening.hingeT), z: mid },
          { u: u(far), z: opening.z0 },
        ],
        dashed,
      });
      out.push({ pts: [{ u: u(opening.hingeT), z: opening.z1 }, { u: u(opening.hingeT), z: opening.z0 }], dashed: false });
      continue;
    }
    if (opening.kind === 'top' || opening.kind === 'bottom') {
      const span = leafSpan(m, opening);
      const center = u((span.t0 + span.t1) / 2);
      const left = u(span.t0);
      const right = u(span.t1);
      const apexZ = opening.kind === 'top' ? opening.z0 : opening.z1;
      const tipZ = opening.kind === 'top' ? opening.z1 : opening.z0;
      out.push({
        pts: [
          { u: left, z: tipZ },
          { u: center, z: apexZ },
          { u: right, z: tipZ },
        ],
        dashed,
      });
      continue;
    }
    if (opening.kind === 'slide' && opening.slideAxis === 'z') {
      if (slideDone) continue;
      slideDone = true;
      // Guilhotina: seta vertical no meio da folha móvel, da posição fechada para a aberta.
      const span = leafSpan(m, opening);
      const center = u((span.t0 + span.t1) / 2);
      const dir = opening.z1 >= opening.z0 ? 1 : -1;
      const tip = dir > 0 ? opening.z1 : opening.z0;
      const tail = dir > 0 ? opening.z0 : opening.z1;
      out.push({ pts: [{ u: center, z: tail }, { u: center, z: tip }], dashed: true });
      const head = tip - dir * 0.1;
      out.push({
        pts: [
          { u: center - 0.04, z: head },
          { u: center, z: tip },
          { u: center + 0.04, z: head },
        ],
        dashed: true,
      });
      continue;
    }
    if (opening.kind === 'slide' && m.parts.some((p) => p.role === 'pocket')) {
      if (slideDone) continue;
      slideDone = true;
      const movel = m.parts.find((p) => p.role === 'leaf' && p.motion?.kind === 'slide')?.motion;
      if (!movel || movel.kind !== 'slide') continue;
      const mid = (opening.z0 + opening.z1) / 2;
      const a = u(0);
      const b = u(movel.dt * movel.travel);
      const dir = Math.sign(b - a) || 1;
      out.push({ pts: [{ u: a, z: mid }, { u: b, z: mid }], dashed: true });
      const head = b - dir * 0.1;
      out.push({
        pts: [
          { u: head, z: mid + 0.04 },
          { u: b, z: mid },
          { u: head, z: mid - 0.04 },
        ],
        dashed: true,
      });
      continue;
    }
    if (opening.kind === 'slide') {
      if (slideDone) continue;
      slideDone = true;
      // Uma seta só para o vão de correr: a haste cobre as folhas todas (o modelo traz uma abertura por folha).
      let t0 = Infinity;
      let t1 = -Infinity;
      for (const part of m.parts) {
        if (part.role !== 'leaf' && part.role !== 'glass') continue;
        t0 = Math.min(t0, part.box.t0);
        t1 = Math.max(t1, part.box.t1);
      }
      if (!Number.isFinite(t0)) {
        const span = leafSpan(m, opening);
        t0 = span.t0;
        t1 = span.t1;
      }
      const mid = (opening.z0 + opening.z1) / 2;
      const a = u(t0);
      const b = u(t1);
      const dir = Math.sign(b - a) || 1;
      out.push({ pts: [{ u: a, z: mid }, { u: b, z: mid }], dashed: true });
      const head = b - dir * 0.1;
      out.push({
        pts: [
          { u: head, z: mid + 0.04 },
          { u: b, z: mid },
          { u: head, z: mid - 0.04 },
        ],
        dashed: true,
      });
    }
  }
  return out;
}
