import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTemplate, createEmptyProject } from '@hestia/model';
import { buildLevelLines, buildLevels, disposeLevels, levelLineData, levelMarkersOf } from './levels3d.ts';
import { levelDataOf } from './levelsData.ts';
import { pickLevel } from './pick3d.ts';

/** Projeto vazio: dois níveis, Térreo em 0 e Pavimento 2 em 3 m (sem paredes, então a caixa é a de reserva). */
const projeto = () => createEmptyProject();

/** Projeto com paredes (house2): Térreo em 0 e Pavimento 2 em 3 m, caixa da obra. */
const casa = () => buildTemplate('house2');

/** Filhos do grupo por tipo (o grupo do datum é plano: um filho por linha, bolha, texto ou plano azul). */
const linhasDe = (g: THREE.Group) => g.children.filter((o): o is THREE.Line => (o as THREE.Line).isLine);
const spritesDe = (g: THREE.Group) => g.children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite);
const malhasDe = (g: THREE.Group) => g.children.filter((o): o is THREE.Mesh => (o as THREE.Mesh).isMesh);
const textosDe = (g: THREE.Group) => malhasDe(g).filter((m) => m.userData.levelsPlane !== true);

/** Câmera de cima sobre a borda y = 0 do retângulo, olhando para −z (o raio do centro acerta a linha). */
function cameraDeCima(z = 20): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  cam.position.set(5, 0, z);
  cam.up.set(0, 1, 0);
  cam.lookAt(5, 0, 0);
  cam.updateMatrixWorld();
  return cam;
}

describe('levelLineData', () => {
  it('um retângulo (4 segmentos) por nível, na cota dele', () => {
    const dados = levelLineData(projeto());
    expect(dados.map((d) => d.levelId)).toEqual(['lv_0', 'lv_1']);
    for (const d of dados) expect(d.positions).toHaveLength(4 * 2 * 3);
    const z0 = new Set(dados[0]!.positions.filter((_, i) => i % 3 === 2));
    const z3 = new Set(dados[1]!.positions.filter((_, i) => i % 3 === 2));
    expect([...z0]).toEqual([0]);
    expect([...z3]).toEqual([3]);
  });

  it('sem paredes, usa a caixa de reserva 0..10 m', () => {
    const xs = levelLineData(projeto())[0]!.positions.filter((_, i) => i % 3 === 0);
    const ys = levelLineData(projeto())[0]!.positions.filter((_, i) => i % 3 === 1);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(10);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(10);
  });
});

describe('levelMarkersOf', () => {
  it('texto = nome + cota em metros com sinal e duas casas', () => {
    const marcadores = levelMarkersOf(projeto());
    expect(marcadores.map((m) => m.text)).toEqual(['Térreo +0,00', 'Pavimento 2 +3,00']);
    expect(marcadores.map((m) => m.levelId)).toEqual(['lv_0', 'lv_1']);
    expect(marcadores[1]!.elevation).toBe(3);
  });
});

describe('pickLevel', () => {
  it('devolve o nível do retângulo mais próximo da câmera e o ponto atingido', () => {
    const cena = new THREE.Scene();
    const grupo = buildLevelLines(projeto());
    expect(grupo).not.toBeNull();
    expect(grupo!.userData.levels).toBe(true);
    cena.add(grupo!);
    // De cima, o retângulo de 3 m está na frente do de 0 m.
    const hit = pickLevel(cena, cameraDeCima(), { x: 0, y: 0 });
    expect(hit).not.toBeNull();
    expect(hit!.kind).toBe('level');
    expect(hit!.levelId).toBe('lv_1');
    expect(hit!.point.z).toBeCloseTo(3, 6);
  });

  it('sem linhas de nível na cena devolve null', () => {
    expect(pickLevel(new THREE.Scene(), cameraDeCima(), { x: 0, y: 0 })).toBeNull();
  });
});

describe('buildLevels', () => {
  it('sem seleção: linha tracejada, bolha e texto por nível, sem plano azul', () => {
    const grupo = buildLevels(casa(), null);
    expect(grupo.userData.levels).toBe(true);

    const dados = levelDataOf(casa());
    const linhas = linhasDe(grupo);
    expect(linhas).toHaveLength(2);
    for (const d of dados) {
      const linha = linhas.find((l) => l.userData.levelId === d.levelId)!;
      expect(linha).toBeDefined();
      const mat = linha.material as THREE.LineDashedMaterial;
      expect(mat.isLineDashedMaterial).toBe(true);
      expect(mat.dashSize).toBeCloseTo(0.3, 6);
      expect(mat.gapSize).toBeCloseTo(0.15, 6);
      expect(mat.color.getHex()).toBe(0x374151);
      // O tracejado só aparece com as distâncias acumuladas calculadas.
      expect(linha.geometry.getAttribute('lineDistance')).toBeDefined();
      expect(linha.frustumCulled).toBe(false);
      const pos = linha.geometry.getAttribute('position');
      expect(pos.getX(0)).toBeCloseTo(d.line.a.x, 6);
      expect(pos.getX(1)).toBeCloseTo(d.line.b.x, 6);
      expect(pos.getZ(0)).toBeCloseTo(d.elevation, 6);
      expect(pos.getZ(1)).toBeCloseTo(d.elevation, 6);
    }
    // As cotas do house2 são 0 e 3 m.
    const zs = linhas.map((l) => (l.geometry.getAttribute('position').getZ(0)));
    expect(zs.sort((a, b) => a - b)).toEqual([0, 3]);

    const sprites = spritesDe(grupo);
    expect(sprites).toHaveLength(2);
    for (const s of sprites) {
      expect(s.userData.levelId).toMatch(/^lv_/);
      expect(s.scale.x).toBeCloseTo(1.2, 6);
    }

    const textos = textosDe(grupo);
    expect(textos).toHaveLength(2);
    for (const d of dados) {
      const texto = textos.find((m) => m.userData.levelId === d.levelId)!;
      expect(texto).toBeDefined();
      expect(texto.geometry.type).toBe('PlaneGeometry');
      const geo = texto.geometry as THREE.PlaneGeometry;
      expect(texto.position.z).toBeCloseTo(d.elevation, 6);
      // A borda ESQUERDA do texto encosta em `textAt` (o plano é centrado, então avança meia largura).
      expect(texto.position.x - geo.parameters.width / 2).toBeCloseTo(d.textAt.x, 6);
      const mat = texto.material as THREE.MeshBasicMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.side).toBe(THREE.DoubleSide);
    }
    expect(malhasDe(grupo).filter((m) => m.userData.levelsPlane === true)).toHaveLength(0);
  });

  it('com o lv_0 selecionado: plano azul translúcido em z = 0 e a linha dele muda de cor', () => {
    const grupo = buildLevels(casa(), 'lv_0');
    const dados = levelDataOf(casa());
    const d0 = dados.find((d) => d.levelId === 'lv_0')!;

    const planos = malhasDe(grupo).filter((m) => m.userData.levelsPlane === true);
    expect(planos).toHaveLength(1);
    const plano = planos[0]!;
    expect(plano.userData.levelId).toBe('lv_0');
    expect(plano.position.z).toBeCloseTo(0, 6);
    const geo = plano.geometry as THREE.PlaneGeometry;
    expect(geo.parameters.width).toBeCloseTo(d0.plane.maxX - d0.plane.minX, 6);
    expect(geo.parameters.height).toBeCloseTo(d0.plane.maxY - d0.plane.minY, 6);
    const mat = plano.material as THREE.MeshBasicMaterial;
    expect(mat.color.getHex()).toBe(0x1565c0);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeCloseTo(0.18, 6);
    expect(mat.side).toBe(THREE.DoubleSide);
    expect(mat.depthWrite).toBe(false);

    const linhas = linhasDe(grupo);
    const selecionada = linhas.find((l) => l.userData.levelId === 'lv_0')!;
    const outra = linhas.find((l) => l.userData.levelId === 'lv_1')!;
    const matSel = selecionada.material as THREE.LineDashedMaterial;
    expect(matSel.color.getHex()).toBe(0x1565c0);
    expect(matSel.dashSize).toBeCloseTo(0.4, 6);
    expect((outra.material as THREE.LineDashedMaterial).color.getHex()).toBe(0x374151);
  });

  it('disposeLevels limpa o grupo', () => {
    const grupo = buildLevels(casa(), 'lv_0');
    expect(grupo.children.length).toBeGreaterThan(0);
    disposeLevels(grupo);
    expect(grupo.children).toHaveLength(0);
  });
});
