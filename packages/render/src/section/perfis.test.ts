import { describe, expect, it } from 'vitest';
import type { MultiPolygon, Vec2 } from '@hestia/geom';
import { computeSection } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeWall, type Opening } from '@hestia/model';
import { LIGHT } from '../plan/types.ts';
import { modeloComPerfil, PERFIL } from '../model3d/fixturePerfil.ts';
import { buildSectionDrawList, type SectionInput } from './build.ts';
import { projetarComPerfis } from './perfis.ts';

const v = (x: number, y: number): Vec2 => ({ x, y });

const op = (id: string, typeId: string): Opening => ({ id, kind: 'door', typeId, hostId: 'w', offset: 3, flipHand: false, flipFacing: false, sillOverride: null, mark: '' });

/** Parede de 6 m com uma porta no centro; a visão de fora é a elevação e a linha vertical é o corte transversal. */
function entrada(vertical: boolean): SectionInput {
  const store = new ProjectStore(createEmptyProject());
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w', typeId: 'wt_alv14', levelId: 'lv_0', a: v(0, 0), b: v(6, 0), height: 3 }) });
  store.exec({ type: 'addOpening', opening: op('p', 'ot_p90') });
  const project = store.project;
  const line = vertical ? { a: v(3, -1), b: v(3, 1), depth: 3 } : { a: v(0, -2), b: v(6, -2), depth: 8 };
  const section = computeSection(project, line);
  const input: SectionInput = {
    project,
    section,
    viewport: { cx: 3, cy: 1.5, zoom: 60, width: 800, height: 600 },
    theme: LIGHT,
    dark: false,
    showGrid: false,
  };
  return input;
}

const comFixture = (vertical: boolean, alizar = false): SectionInput => {
  const input = entrada(vertical);
  input.section.openings[0]!.model = modeloComPerfil({ alizar });
  return input;
};

const rings = (polys: MultiPolygon): Vec2[][] => polys.flatMap((p) => p);
const largura = (polys: MultiPolygon): number => {
  const x = polys.flat(2).map((q) => q.x);
  return Math.max(...x) - Math.min(...x);
};
const altura = (polys: MultiPolygon): number => {
  const y = polys.flat(2).map((q) => q.y);
  return Math.max(...y) - Math.min(...y);
};

describe('projeção das peças com seção (E3 §2)', () => {
  it('corte transversal: a travessa em L tem o anel de 6 vértices do perfil (s, z)', () => {
    const head = projetarComPerfis(modeloComPerfil(), 't').find((x) => x.part.id === 'head')!;
    expect(head.ring).toHaveLength(6);
    expect(head.ring.map((q) => [q.u, q.z])).toEqual(modeloComPerfil().parts.find((p) => p.id === 'head')!.profile!.pts);
  });

  it('corte transversal: a ombreira (extrudada em z) aparece como o retângulo de s × z', () => {
    const jamb = projetarComPerfis(modeloComPerfil(), 't').find((x) => x.part.id === 'jamb-left')!;
    expect(jamb.ring).toHaveLength(4);
    const us = jamb.ring.map((q) => q.u);
    const zs = jamb.ring.map((q) => q.z);
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(PERFIL.D, 9);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(PERFIL.height, 9);
  });

  it('elevação: as duas seções aparecem como o retângulo envolvente (t × z)', () => {
    for (const item of projetarComPerfis(modeloComPerfil(), 's').filter((x) => x.part.profile)) {
      expect(item.ring).toHaveLength(4);
      const us = item.ring.map((q) => q.u);
      const zs = item.ring.map((q) => q.z);
      expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(item.part.box.t1 - item.part.box.t0, 9);
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(item.part.box.z1 - item.part.box.z0, 9);
    }
  });
});

describe('corte e elevação com o batente em peça única', () => {
  it('corte transversal da porta-fixture: o L da travessa aparece com 6 vértices e a hachura do batente', () => {
    const d = buildSectionDrawList(comFixture(true));
    const emL = d.fills.filter((f) => rings(f.polygons).some((r) => r.length === 6));
    expect(emL).toHaveLength(1);
    expect(emL[0]!.hatch?.kind).toBe('diagonal'); // mat_madeira, o material do batente do ot_p90
  });

  it('corte transversal: a ombreira aparece como retângulo (D × H), sem arestas internas de batedor', () => {
    const d = buildSectionDrawList(comFixture(true));
    expect(d.fills.some((f) => Math.abs(largura(f.polygons) - PERFIL.D) < 1e-6 && Math.abs(altura(f.polygons) - PERFIL.height) < 1e-6)).toBe(true);
  });

  it('elevação: o L do batente é desenhado como retângulo, sem o anel de 6 vértices do corte', () => {
    const d = buildSectionDrawList(comFixture(false));
    expect(d.fills.some((f) => rings(f.polygons).some((r) => r.length === 6))).toBe(false);
  });

  it('alizar no mesmo group: um contorno só (união em U de 8 vértices) na elevação', () => {
    const d = buildSectionDrawList(comFixture(false, true));
    const unidos = d.fills.filter((f) => rings(f.polygons).some((r) => r.length === 8) && Math.abs(largura(f.polygons) - PERFIL.width) < 1e-6 && Math.abs(altura(f.polygons) - PERFIL.height) < 1e-6);
    expect(unidos).toHaveLength(1);
    // Sem união sobrariam também as duas barras soltas do alizar (0,05 × 2,10); com a união só as duas ombreiras
    // do batente têm esse tamanho.
    expect(d.fills.filter((f) => Math.abs(largura(f.polygons) - 0.05) < 1e-6 && Math.abs(altura(f.polygons) - PERFIL.height) < 1e-6)).toHaveLength(2);
  });
});
