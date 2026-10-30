import * as THREE from 'three';
import type { Id, Project } from '@hestia/model';
import { levelBox } from '../plan/build.ts';

/**
 * Linhas de nível da vista 3D: um retângulo por nível, na caixa do nível (a mesma de "enquadrar" na planta), na cota
 * dele, e o rótulo `nome + cota`. As linhas ficam num grupo só, fora dos grupos de nível, para o picking saber qual
 * nível foi atingido e para o toggle da vista desligar tudo de uma vez.
 */

/** Caixa em planta de um nível (m). */
export interface CaixaDoNivel {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Rótulo de um nível: o nome, a cota e o texto já formatado (nome + cota). */
export interface LevelMarker {
  levelId: Id;
  name: string;
  elevation: number;
  text: string;
}

/** Retângulo de um nível (8 vértices = 4 segmentos) na cota dele. */
export interface LevelLineData {
  levelId: Id;
  positions: number[];
}

/** Altura do rótulo na cena (m): legível de longe sem cobrir o modelo. */
export const ALTURA_ROTULO = 1.5;

/** Cor fixa das linhas de nível (âmbar escuro, o mesmo tom em qualquer tema). */
export const COR_LINHA_NIVEL = 0x9a7b00;

/** Material das linhas de nível: compartilhado, sem cor por vértice. */
const MATERIAL_NIVEL = new THREE.LineBasicMaterial({ color: COR_LINHA_NIVEL });

/** Cota em metros com sinal e duas casas, com vírgula decimal (`+0,00`, `-1,20`). */
export function cotaTexto(elevation: number): string {
  const abs = Math.abs(elevation).toFixed(2).replace('.', ',');
  return `${elevation < 0 ? '-' : '+'}${abs}`;
}

/** Rótulos de todos os níveis, do mais baixo ao mais alto (a ordem do projeto, por cota). */
export function levelMarkersOf(p: Project): LevelMarker[] {
  return [...p.levels]
    .sort((a, b) => a.elevation - b.elevation)
    .map((l) => ({ levelId: l.id, name: l.name, elevation: l.elevation, text: `${l.name} ${cotaTexto(l.elevation)}` }));
}

/** Caixa em planta de todos os níveis; sem nenhuma parede no projeto, 0..10 m (a mesma caixa de reserva). */
function caixaDeTodosOsNiveis(p: Project): CaixaDoNivel {
  let caixa: CaixaDoNivel | null = null;
  for (const l of p.levels) {
    const b = levelBox(p, l.id);
    if (!b) continue;
    caixa = caixa
      ? {
          minX: Math.min(caixa.minX, b.minX),
          minY: Math.min(caixa.minY, b.minY),
          maxX: Math.max(caixa.maxX, b.maxX),
          maxY: Math.max(caixa.maxY, b.maxY),
        }
      : { ...b };
  }
  return caixa ?? { minX: 0, minY: 0, maxX: 10, maxY: 10 };
}

/** Caixa do nível para as linhas de nível; sem paredes nele, a caixa de todos os níveis (ou 0..10 m). */
export function caixaDoNivel(p: Project, levelId: Id): CaixaDoNivel {
  return levelBox(p, levelId) ?? caixaDeTodosOsNiveis(p);
}

/** Os quatro lados do retângulo da caixa, na cota do nível, como pares de vértices. */
function retangulo(b: CaixaDoNivel, z: number): number[] {
  const { minX, minY, maxX, maxY } = b;
  return [
    minX, minY, z, maxX, minY, z,
    maxX, minY, z, maxX, maxY, z,
    maxX, maxY, z, minX, maxY, z,
    minX, maxY, z, minX, minY, z,
  ];
}

/** Retângulo de cada nível na cota dele (4 segmentos; ver `caixaDoNivel` para a caixa usada). */
export function levelLineData(p: Project): LevelLineData[] {
  return p.levels.map((l) => ({ levelId: l.id, positions: retangulo(caixaDoNivel(p, l.id), l.elevation) }));
}

/**
 * Linhas de nível da cena: um `THREE.Line` por nível dentro de um grupo (`userData.levels = true`), cada linha com
 * `userData.levelId` para o picking. `null` quando o projeto não tem nível. O material é compartilhado; as geometrias
 * pertencem ao grupo (quem refaz as linhas as libera).
 */
export function buildLevelLines(p: Project): THREE.Group | null {
  if (!p.levels.length) return null;
  const grupo = new THREE.Group();
  grupo.userData = { levels: true };
  for (const l of p.levels) {
    const b = caixaDoNivel(p, l.id);
    const pts = [
      new THREE.Vector3(b.minX, b.minY, l.elevation),
      new THREE.Vector3(b.maxX, b.minY, l.elevation),
      new THREE.Vector3(b.maxX, b.maxY, l.elevation),
      new THREE.Vector3(b.minX, b.maxY, l.elevation),
      new THREE.Vector3(b.minX, b.minY, l.elevation),
    ];
    const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), MATERIAL_NIVEL);
    linha.userData = { levelId: l.id };
    linha.frustumCulled = false;
    grupo.add(linha);
  }
  return grupo;
}

/**
 * Grupo do datum de nível (fase 6): linha tracejada, bolha e texto de cada nível, mais o plano azul do nível
 * selecionado. Esta é a assinatura congelada para a cena; a implementação visual nova entra no lugar do stub.
 */
export function buildLevels(p: Project, selected: Id | null): THREE.Group {
  void p;
  void selected;
  return new THREE.Group();
}

/** Libera geometrias, materiais e texturas do grupo de níveis. */
export function disposeLevels(group: THREE.Group): void {
  group.traverse((o) => {
    const geo = (o as THREE.Mesh).geometry;
    geo?.dispose();
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
  group.clear();
}