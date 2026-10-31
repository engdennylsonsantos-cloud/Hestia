import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveLevel } from '@hestia/engine';
import { createEmptyProject, emptyTitleBlock, makeView3DPoint, makeWall, view3dOf, type Project, type Sheet, type SheetViewport, type SheetView3DCamera } from '@hestia/model';
import { ModelScene } from '../model3d/scene3d.ts';
import { vista3dParts } from './vista3d.ts';

export const sheet = (viewports: SheetViewport[]): Sheet => ({
  id: 'sh1',
  number: 'A-101',
  name: '3D',
  size: 'A3',
  orientation: 'landscape',
  margin: 10,
  titleBlock: emptyTitleBlock(),
  viewports,
});

const vp = (over: Partial<SheetViewport> = {}): SheetViewport => ({
  id: 'v3',
  view: { kind: '3d' },
  at: { x: 20, y: 20 },
  size: { w: 180, h: 120 },
  scale: 100,
  ...over,
});

const CAM = (over: Partial<SheetView3DCamera> = {}): SheetView3DCamera => ({
  azimuth: -Math.PI / 2,
  elevation: 0,
  distance: 12,
  target: { x: 2, y: 0.5, z: 1.5 },
  ortho: true,
  ...over,
});

/** Casa 4 × 3 m sem piso: quatro paredes de 14 cm. */
function casa(): Project {
  const p = createEmptyProject();
  const pts = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
    { x: 0, y: 3 },
  ];
  const lados: Array<[string, number, number]> = [
    ['a', 0, 1],
    ['b', 1, 2],
    ['c', 2, 3],
    ['d', 3, 0],
  ];
  let order = 1;
  for (const [id, i, j] of lados) {
    const w = makeWall({ id, typeId: 'wt_alv14', levelId: 'lv_0', a: pts[i]!, b: pts[j]! });
    p.elements[w.id] = { ...w, order: order++ };
  }
  p.nextOrder = order;
  return p;
}

/** Duas paredes paralelas: a de y=1 na frente da de y=0 (vistas de y negativo). */
function duasParedes(): Project {
  const p = createEmptyProject();
  const a = makeWall({ id: 'frente', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 1 }, b: { x: 4, y: 1 } });
  p.elements[a.id] = { ...a, order: 1 };
  const b = makeWall({ id: 'fundo', typeId: 'wt_alv14', levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 4, y: 0 } });
  p.elements[b.id] = { ...b, order: 2 };
  p.nextOrder = 3;
  return p;
}

function comPonto(p: Project, camera: SheetView3DCamera): Project {
  const ponto = makeView3DPoint(camera, 'Ponto');
  return { ...p, view3dPoints: [ponto] };
}

const pathsOf = (p: Project, viewport: SheetViewport) => vista3dParts(p, viewport).paths;

describe('vista 3D vetorial na prancha', () => {
  it('gera caminhos de arestas dentro do quadro, com traço de papel', () => {
    const p = comPonto(casa(), CAM());
    const ponto = p.view3dPoints![0]!;
    const paths = pathsOf(p, vp({ view: { kind: '3d', pointId: ponto.id } }));
    expect(paths.length).toBeGreaterThan(0);
    for (const s of paths) {
      expect(s.closed).toBe(false);
      expect(s.widthMm).toBeGreaterThan(0);
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      for (const q of s.pts) {
        expect(q.x).toBeGreaterThanOrEqual(20 - 0.01);
        expect(q.x).toBeLessThanOrEqual(200 + 0.01);
        expect(q.y).toBeGreaterThanOrEqual(20 - 0.01);
        expect(q.y).toBeLessThanOrEqual(140 + 0.01);
      }
    }
  });

  it('o ponto de vista escolhido muda o desenho (orientação, alvo e projeção)', () => {
    const base = casa();
    const a = makeView3DPoint(CAM({ azimuth: -Math.PI / 2 }), 'Sul');
    const b = makeView3DPoint(CAM({ azimuth: Math.PI / 2, elevation: 0.4, ortho: false }), 'Norte');
    const p: Project = { ...base, view3dPoints: [a, b] };
    const sul = pathsOf(p, vp({ view: { kind: '3d', pointId: a.id } }));
    const norte = pathsOf(p, vp({ view: { kind: '3d', pointId: b.id } }));
    expect(sul.length).toBeGreaterThan(0);
    expect(norte.length).toBeGreaterThan(0);
    expect(sul.map((s) => `${s.pts[0]!.x.toFixed(1)},${s.pts[0]!.y.toFixed(1)}`)).not.toEqual(
      norte.map((s) => `${s.pts[0]!.x.toFixed(1)},${s.pts[0]!.y.toFixed(1)}`),
    );
  });

  it('linha oculta: a parede da frente cobre a de trás (menos caminhos que as duas isoladas)', () => {
    const camera = CAM({ distance: 14, target: { x: 2, y: 0, z: 1.7 } });
    const ambas = comPonto(duasParedes(), camera);
    const ponto = ambas.view3dPoints![0]!;
    const juntas = pathsOf(ambas, vp({ view: { kind: '3d', pointId: ponto.id } }));

    const soFundo = comPonto({ ...createEmptyProject(), elements: { fundo: ambas.elements['fundo']! }, nextOrder: 2 }, camera);
    const soFrente = comPonto({ ...createEmptyProject(), elements: { frente: ambas.elements['frente']! }, nextOrder: 2 }, camera);
    const fundo = pathsOf(soFundo, vp({ view: { kind: '3d', pointId: soFundo.view3dPoints![0]!.id } }));
    const frente = pathsOf(soFrente, vp({ view: { kind: '3d', pointId: soFrente.view3dPoints![0]!.id } }));

    expect(fundo.length).toBeGreaterThan(0);
    expect(frente.length).toBeGreaterThan(0);
    expect(juntas.length).toBeLessThan(fundo.length + frente.length);
  });

  it('a câmera embutida (arquivo antigo) também desenha, e sem câmera enquadra o modelo', () => {
    const p = casa();
    const embutida = pathsOf(p, vp({ view: { kind: '3d', camera: CAM() } }));
    const padrao = pathsOf(p, vp());
    expect(embutida.length).toBeGreaterThan(0);
    expect(padrao.length).toBeGreaterThan(0);
  });

  it('não recria geometria: o exportador devolve as mesmas malhas e arestas da cena do 3D', () => {
    const p = casa();
    const projetoDeLinhas: Project = { ...p, view3d: { ...view3dOf(p), style: 'hiddenLine', edges: true } };
    const cena = new ModelScene({ instanciar: false });
    cena.update(projetoDeLinhas, p.levels.map((l) => resolveLevel(projetoDeLinhas, l.id)), { dark: false, edges: true, shadows: false });
    const vetores = cena.exportarVetores();

    const modelo = cena.scene.children.find((c): c is THREE.Group => c instanceof THREE.Group)!;
    let triangulos = 0;
    let segmentos = 0;
    modelo.updateMatrixWorld(true);
    modelo.traverse((o) => {
      if (o instanceof THREE.LineSegments) {
        segmentos += (o.geometry.getAttribute('position')?.count ?? 0) / 2;
        return;
      }
      if (!(o instanceof THREE.Mesh)) return;
      const pos = o.geometry.getAttribute('position');
      const idx = o.geometry.index;
      const porInstancia = (idx ? idx.count : (pos?.count ?? 0)) / 3;
      triangulos += porInstancia * (o instanceof THREE.InstancedMesh ? o.count : 1);
    });
    expect(vetores.triangleIndices.length / 3).toBe(triangulos);
    expect(vetores.edges.length / 6).toBe(segmentos);
    cena.dispose();
  });
});
