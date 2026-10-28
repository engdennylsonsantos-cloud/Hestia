import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildOpeningModel,
  computeSection,
  frameOfWall,
  openingGeometry,
  openingLinePaths,
  partTransformed,
  type OpeningGeometry,
} from '@hestia/engine';
import {
  buildTemplate,
  isOpening,
  openingAngle2d,
  openingAngle3d,
  openingFamilyOf,
  view3dOf,
  type Opening,
  type Project,
  type Wall,
} from '@hestia/model';
import { buildSectionDrawList, type SectionInput } from './section/build.ts';
import { openingSymbol } from './plan/symbols.ts';
import { LIGHT } from './plan/types.ts';
import { openingPieces, type OpeningPiece } from './model3d/openingParts.ts';
import { caixasEPrismasDaAbertura, montarAbertura } from './model3d/aberturas3d.ts';

const p = (): Project => buildTemplate('esquadrias');
const aberturas = (proj: Project): Opening[] => Object.values(proj.elements).filter(isOpening);
const parede = (proj: Project, o: Opening): Wall => proj.elements[o.hostId] as Wall;

const modelo = (proj: Project, o: Opening) => {
  const f = frameOfWall(proj, o.hostId)!;
  const g = openingGeometry(proj, o, f);
  return { f, g, m: buildOpeningModel(proj, o, g, f), t: proj.openingTypes[o.typeId]! };
};

const secao = (proj: Project, a: { x: number; y: number }, b: { x: number; y: number }, depth: number): SectionInput => ({
  project: proj,
  section: computeSection(proj, { a, b, depth }),
  viewport: { cx: 20, cy: 1.4, zoom: 60, width: 1600, height: 600 },
  theme: LIGHT,
  dark: false,
  showGrid: false,
});

describe('catálogo completo: corte e elevação', () => {
  it('as duas elevações (portas e janelas) desenham todos os vãos sem exceção', () => {
    const proj = p();
    const portas = aberturas(proj).filter((o) => o.kind === 'door');
    const janelas = aberturas(proj).filter((o) => o.kind === 'window');
    // O corte percorre cada parede inteira (o mostruário tem o comprimento do catálogo, não 40 m fixos).
    const fimPortas = (proj.elements['eq_w_portas'] as Wall).b.x;
    const fimJanelas = (proj.elements['eq_w_janelas'] as Wall).b.x;
    const elevPortas = secao(proj, { x: 0, y: -2 }, { x: fimPortas, y: -2 }, 8);
    const elevJanelas = secao(proj, { x: 0, y: 6 }, { x: fimJanelas, y: 6 }, 4);
    expect(elevPortas.section.openings.map((o) => o.openingId).sort()).toEqual(portas.map((o) => o.id).sort());
    expect(elevJanelas.section.openings.map((o) => o.openingId).sort()).toEqual(janelas.map((o) => o.id).sort());
    for (const entrada of [elevPortas, elevJanelas]) {
      const draw = buildSectionDrawList(entrada);
      expect(draw.strokes.length + draw.fills.length).toBeGreaterThan(0);
      for (const o of entrada.section.openings) {
        // O vão livre de porta é só o recorte da parede: não tem peça, por projeto.
        if (o.kind === 'door' && o.model.void) expect(o.model.parts).toHaveLength(0);
        else expect(o.model.parts.length, o.openingId).toBeGreaterThan(0);
      }
    }
  }, 30_000);

  it('o corte transversal de cada vão desenha sem exceção e mostra o vão na seção', () => {
    const proj = p();
    for (const o of aberturas(proj)) {
      const w = parede(proj, o);
      const cx = w.a.x + o.offset;
      const y = w.a.y;
      // Só a parede e o vão em análise: o corte transversal é independente e o mostruário inteiro deixaria o teste lento.
      const reduzido: Project = { ...proj, elements: { [w.id]: w, [o.id]: o } };
      const entrada = secao(reduzido, { x: cx, y: y - 1 }, { x: cx, y: y + 1 }, 3);
      const alvo = entrada.section.openings.find((x) => x.openingId === o.id);
      expect(alvo, o.id).toBeDefined();
      const draw = buildSectionDrawList(entrada);
      expect(draw.strokes.length + draw.fills.length, o.id).toBeGreaterThan(0);
    }
  });

  it('as linhas de abertura seguem a convenção: V no trinco, tracejado para o observador e nada em fixa/louver', () => {
    const proj = p();
    const conv = { apex: 'latch' as const, dashed: 'toward' as const };
    for (const o of aberturas(proj)) {
      const { m, t } = modelo(proj, o);
      const family = openingFamilyOf(t)?.id;
      const linhas = openingLinePaths(m, 1, conv, 'elevation');
      if (family === 'window_fixed' || family === 'window_louver' || family === 'door_void' || family === 'window_void') {
        expect(linhas, `${o.id} ${family}`).toHaveLength(0);
        continue;
      }
      expect(linhas.length, `${o.id} ${family}`).toBeGreaterThan(0);
      for (const oo of m.openings) {
        if (oo.kind === 'side') {
          const v = linhas.find((l) => l.pts.length === 3 && Math.abs(l.pts[1]!.u + oo.latchT) < 1e-9);
          expect(v, `${o.id} V no trinco`).toBeDefined();
        }
        if (oo.kind === 'pivot') {
          const v = linhas.find((l) => l.pts.length === 3);
          expect(Math.abs(v!.pts[1]!.u + oo.hingeT), o.id).toBeLessThan(1e-9);
        }
        if ((oo.kind === 'side' || oo.kind === 'pivot' || oo.kind === 'top' || oo.kind === 'bottom') && oo.side === 1) {
          // Vai-e-vem (dblact) tem uma linha em V por sentido de abertura: basta que uma delas seja tracejada.
          const vs = linhas.filter((l) => l.pts.length === 3);
          expect(vs.some((l) => l.dashed), `${o.id} abre para o observador`).toBe(true);
        }
      }
    }
  });
});

describe('catálogo completo: planta via openingSymbol', () => {
  it('todos os símbolos têm pontos finitos e nenhum traço com menos de dois pontos', () => {
    const proj = p();
    for (const o of aberturas(proj)) {
      const { g, m, t } = modelo(proj, o);
      const opts = {
        detail: 'mid' as const,
        angle: (openingAngle2d(t) * Math.PI) / 180,
        planDisplay: 'symbolic' as const,
        showSwing: true,
        swingStyle: 'arc' as const,
        cutZ: t.height / 2,
      };
      const ops = openingSymbol(g, m, LIGHT, 1, opts);
      expect(ops.length, o.id).toBeGreaterThan(0);
      for (const op of ops) {
        expect(op.pts.length, o.id).toBeGreaterThanOrEqual(2);
        for (const q of op.pts) {
          expect(Number.isFinite(q.x), o.id).toBe(true);
          expect(Number.isFinite(q.y), o.id).toBe(true);
        }
      }
    }
  });
});

/** Caixa alinhada da peça depois do movimento, no sistema local do vão. */
function caixaDaPeca(piece: OpeningPiece): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  const h = piece.hinge;
  for (const sx of [-1, 1] as const) {
    for (const sy of [-1, 1] as const) {
      for (const sz of [-1, 1] as const) {
        let x = piece.x + (sx * piece.w) / 2 + (piece.slide?.dx ?? 0);
        let y = piece.y + (sy * piece.d) / 2 + (piece.slide?.dy ?? 0);
        let z = piece.z + (sz * piece.h) / 2 + (piece.slide?.dz ?? 0);
        if (h) {
          const atS = h.atS ?? 0;
          const cos = Math.cos(h.angle);
          const sin = Math.sin(h.angle);
          if (h.axis === 'z') {
            const dx = x - h.at;
            const dy = y - atS;
            x = h.at + dx * cos - dy * sin;
            y = atS + dx * sin + dy * cos;
          } else {
            const dy = y - atS;
            const dz = z - h.at;
            y = atS + dy * cos - dz * sin;
            z = h.at + dy * sin + dz * cos;
          }
        }
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        z0 = Math.min(z0, z);
        z1 = Math.max(z1, z);
      }
    }
  }
  return { x0, x1, z0, z1 };
}

/** Centro esperado da caixa da peça pela cadeia vão · dobradiça · deslocamento (o mesmo de `montarAbertura`). */
function centroEsperado(piece: OpeningPiece, g: OpeningGeometry, baseZ: number): THREE.Vector3 {
  const vao = new THREE.Matrix4().makeRotationZ(Math.atan2(g.u.y, g.u.x)).setPosition(g.center.x, g.center.y, baseZ + g.sill);
  const m = vao.clone();
  let dx = 0;
  let dy = 0;
  let dz = 0;
  if (piece.hinge) {
    const pivo = new THREE.Matrix4();
    const atS = piece.hinge.atS ?? 0;
    if (piece.hinge.axis === 'z') {
      pivo.makeRotationZ(piece.hinge.angle).setPosition(piece.hinge.at, atS, 0);
      dx = piece.hinge.at;
      dy = atS;
    } else {
      pivo.makeRotationX(piece.hinge.angle).setPosition(0, atS, piece.hinge.at);
      dy = atS;
      dz = piece.hinge.at;
    }
    m.multiply(pivo);
  }
  const s = piece.slide;
  m.multiply(
    new THREE.Matrix4().makeTranslation(piece.x - dx + (s?.dx ?? 0), piece.y - dy + (s?.dy ?? 0), piece.z - dz + (s?.dz ?? 0)),
  ).multiply(new THREE.Matrix4().makeScale(piece.w, piece.d, piece.h));
  return new THREE.Vector3().setFromMatrixPosition(m);
}

describe('catálogo completo: 3D', () => {
  it('openingPieces e caixasDaAbertura desenham o mostruário fechado e aberto, equivalentes à cena', () => {
    const proj = p();
    const view = { ...view3dOf(proj), openOpenings: true };
    const desenhar = (parent: THREE.Object3D, geo: THREE.BufferGeometry): void => {
      parent.add(new THREE.Mesh(geo));
    };
    for (const o of aberturas(proj)) {
      const { f, g, t } = modelo(proj, o);
      const vazio = t.kind === 'door' && t.leaves === 0;
      for (const open of [false, true]) {
        const pecas = openingPieces(proj, o, g, f, 2.8, open);
        const montada = montarAbertura(proj, o, f, 0, 2.8, { ...view, openOpenings: open }, false, desenhar);
        const em = caixasEPrismasDaAbertura(proj, o, f, 0, 2.8, { ...view, openOpenings: open });
        const caixas = em?.caixas ?? null;
        if (vazio) {
          expect(pecas).toHaveLength(0);
          expect(montada).toBeNull();
          expect(caixas).toBeNull();
          continue;
        }
        expect(montada, o.id).not.toBeNull();
        expect(caixas, o.id).not.toBeNull();
        // Peças com perfil (batente em L, alizar em silhueta) viram prismas; as demais, caixas unitárias. A cena
        // equivalente tem uma caixa por peça sem perfil e um prisma por peça com perfil.
        const emCaixa = pecas.filter((x) => !x.profile);
        const emPrisma = pecas.filter((x) => x.profile);
        expect(caixas!.length, `${o.id} ${open ? 'aberta' : 'fechada'} caixas`).toBe(emCaixa.length);
        expect(em!.prismas.length, `${o.id} ${open ? 'aberta' : 'fechada'} prismas`).toBe(emPrisma.length);
        for (let i = 0; i < emCaixa.length; i++) {
          const esperado = centroEsperado(emCaixa[i]!, g, 0);
          const pos = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().fromArray(caixas![i]!.matriz));
          expect(pos.x, `${o.id} peça ${i}`).toBeCloseTo(esperado.x, 9);
          expect(pos.y, `${o.id} peça ${i}`).toBeCloseTo(esperado.y, 9);
          expect(pos.z, `${o.id} peça ${i}`).toBeCloseTo(esperado.z, 9);
        }
      }
    }
  });

  it('cada peça aberta tem o centro que o modelo único calcula (giro, dobra e deslize)', () => {
    const proj = p();
    for (const o of aberturas(proj)) {
      const { f, g, m, t } = modelo(proj, o);
      const graus = t.plan === 'louver' ? Math.min(70, openingAngle3d(t)) : openingAngle3d(t);
      const state = { angle: (graus * Math.PI) / 180, slide: 1 };
      const pecas = openingPieces(proj, o, g, f, 2.8, true);
      expect(pecas.length, o.id).toBe(m.parts.length);
      pecas.forEach((peca, i) => {
        let x = peca.x + (peca.slide?.dx ?? 0);
        let y = peca.y + (peca.slide?.dy ?? 0);
        let z = peca.z + (peca.slide?.dz ?? 0);
        const h = peca.hinge;
        if (h) {
          const atS = h.atS ?? 0;
          const cos = Math.cos(h.angle);
          const sin = Math.sin(h.angle);
          if (h.axis === 'z') {
            const dx = x - h.at;
            const dy = y - atS;
            x = h.at + dx * cos - dy * sin;
            y = atS + dx * sin + dy * cos;
          } else {
            const dy = y - atS;
            const dz = z - h.at;
            y = atS + dy * cos - dz * sin;
            z = h.at + dy * sin + dz * cos;
          }
        }
        const esperado = partTransformed(m.parts[i]!, state).center;
        expect(x, `${o.id} ${peca.role} x`).toBeCloseTo(esperado.t, 9);
        expect(y, `${o.id} ${peca.role} y`).toBeCloseTo(esperado.s, 9);
        expect(z, `${o.id} ${peca.role} z`).toBeCloseTo(esperado.z, 9);
      });
    }
  });

  it('no estado fechado as peças ficam no vão; abertas, giro/dobradiça continuam no vão', () => {
    const proj = p();
    const acabamentos = new Set(['casing', 'sillBoard', 'lintel', 'sillBeam', 'pocket']);
    for (const o of aberturas(proj)) {
      const { f, g, t } = modelo(proj, o);
      const family = openingFamilyOf(t)?.id;
      for (const open of [false, true]) {
        for (const peca of openingPieces(proj, o, g, f, 2.8, open)) {
          if (acabamentos.has(peca.role)) continue;
          const foraPorProjeto =
            open &&
            ((family === 'door_garage' && (peca.role === 'leaf' || peca.role === 'leafPanel' || peca.role === 'track')) ||
              (family === 'door_pocket' && peca.role === 'leaf'));
          if (foraPorProjeto) continue;
          const b = caixaDaPeca(peca);
          const caso = `${o.id} ${open ? 'aberta' : 'fechada'} ${peca.role}`;
          expect(b.x0, caso).toBeGreaterThanOrEqual(-g.width / 2 - 1e-9);
          expect(b.x1, caso).toBeLessThanOrEqual(g.width / 2 + 1e-9);
          expect(b.z0, caso).toBeGreaterThanOrEqual(-1e-9);
          expect(b.z1, caso).toBeLessThanOrEqual(g.height + 1e-9);
        }
      }
    }
  });

  it('o portão seccionado recolhe para cima por H e a embutir some para a cavidade por projeto', () => {
    const proj = p();
    for (const o of aberturas(proj)) {
      const { f, g, t } = modelo(proj, o);
      const family = openingFamilyOf(t)?.id;
      if (family !== 'door_garage' && family !== 'door_pocket') continue;
      const fechadas = openingPieces(proj, o, g, f, 2.8, false);
      const abertas = openingPieces(proj, o, g, f, 2.8, true);
      if (family === 'door_garage') {
        const moveis = abertas.filter((x) => x.slide && x.slide.dz > 0);
        expect(moveis.length).toBeGreaterThan(0);
        for (const x of moveis) {
          expect(x.slide!.dz).toBeCloseTo(g.height, 9);
          expect(x.slide!.dx).toBeCloseTo(0, 9);
          expect(x.slide!.dy).toBeCloseTo(0, 9);
        }
      } else {
        const folhaFechada = fechadas.find((x) => x.role === 'leaf')!;
        const folhaAberta = abertas.find((x) => x.role === 'leaf')!;
        expect(Math.abs(folhaAberta.slide?.dx ?? 0)).toBeCloseTo(folhaFechada.w, 9);
      }
    }
  });
});
