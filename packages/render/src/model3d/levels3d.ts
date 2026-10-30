import * as THREE from 'three';
import type { Id, Project } from '@hestia/model';
import { levelBox } from '../plan/build.ts';
import { levelDataOf, type LevelDatum } from './levelsData.ts';

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

/** Cor da linha de datum dos níveis não selecionados (cinza-azulado escuro). */
const COR_LINHA_DATUM = 0x374151;

/** Cor do nível selecionado (o azul do Revit, o mesmo da bolha e do plano). */
const COR_SELECIONADO = 0x1565c0;

/** Tracejado da linha de datum (m): padrão e do nível selecionado, que fica mais marcado. */
const DASH_PADRAO = 0.3;
const GAP_DASH = 0.15;
const DASH_SELECIONADO = 0.4;

/** Lado da bolha do nível na cena (m). */
const LADO_BOLHA = 1.2;

/** Altura do texto do nível na cena (m) e proporção do canvas do texto (largura / altura). */
const ALTURA_TEXTO = 1;
const PROPORCAO_TEXTO = 6;
const LARGURA_TEXTO = ALTURA_TEXTO * PROPORCAO_TEXTO;

/** Opacidade do plano azul do nível selecionado. */
const OPACIDADE_PLANO = 0.18;

/**
 * Grupo do datum de nível (fase 6): linha tracejada, bolha e texto de cada nível, mais o plano azul do nível
 * selecionado. Esta é a assinatura congelada para a cena.
 *
 * O mundo da cena é Z-up (o chão é um `PlaneGeometry` sem rotação e a grade gira π/2 em X), então o plano do nível
 * já é o plano XY: girar o `PlaneGeometry` em −π/2 em X o deixaria VERTICAL (em XZ). Por isso o texto e o plano azul
 * ficam sem rotação, só deslocados em `z = elevation`, como manda o visual (texto deitado no plano do nível).
 */
export function buildLevels(p: Project, selected: Id | null): THREE.Group {
  const grupo = new THREE.Group();
  grupo.userData = { levels: true };
  // A bolha é igual em todos os níveis: uma textura e um material só (liberados uma vez em `disposeLevels`).
  const texturaBolha = texturaDaBolha();
  const materialBolha = new THREE.SpriteMaterial({
    ...(texturaBolha ? { map: texturaBolha } : {}),
    transparent: true,
    depthWrite: false,
  });
  for (const d of levelDataOf(p)) {
    const selecionado = d.levelId === selected;
    grupo.add(linhaDoDatum(d, selecionado));
    grupo.add(bolhaDoDatum(d, materialBolha));
    grupo.add(textoDoDatum(d));
    if (selecionado) grupo.add(planoDoNivel(d));
  }
  return grupo;
}

/** Linha tracejada do datum, de `line.a` a `line.b`, na cota do nível; azul e mais longa quando selecionado. */
function linhaDoDatum(d: LevelDatum, selecionado: boolean): THREE.Line {
  const material = new THREE.LineDashedMaterial({
    color: selecionado ? COR_SELECIONADO : COR_LINHA_DATUM,
    dashSize: selecionado ? DASH_SELECIONADO : DASH_PADRAO,
    gapSize: GAP_DASH,
  });
  const geometria = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(d.line.a.x, d.line.a.y, d.line.a.z),
    new THREE.Vector3(d.line.b.x, d.line.b.y, d.line.b.z),
  ]);
  const linha = new THREE.Line(geometria, material);
  // O tracejado do three precisa das distâncias acumuladas ao longo da linha.
  linha.computeLineDistances();
  linha.userData = { levelId: d.levelId };
  linha.frustumCulled = false;
  return linha;
}

/** Bolha (sprite) no `headAt`, logo depois do fim da linha. */
function bolhaDoDatum(d: LevelDatum, material: THREE.SpriteMaterial): THREE.Sprite {
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(LADO_BOLHA, LADO_BOLHA, 1);
  sprite.position.set(d.headAt.x, d.headAt.y, d.headAt.z);
  sprite.userData = { levelId: d.levelId };
  return sprite;
}

/** Texto (nome + cota) deitado no plano do nível, correndo em +X, com a borda direita encostada em `textAt`. */
function textoDoDatum(d: LevelDatum): THREE.Mesh {
  const textura = texturaDoTexto(d.text);
  const material = new THREE.MeshBasicMaterial({
    ...(textura ? { map: textura } : {}),
    transparent: true,
    depthWrite: false,
    // Anotação: fica sempre legível, na frente do modelo (como o level head do Revit).
    depthTest: false,
    side: THREE.DoubleSide,
  });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(LARGURA_TEXTO, ALTURA_TEXTO), material);
  malha.renderOrder = 20;
  // O plano é centrado: recua meia largura para a borda DIREITA encostar em `textAt`.
  malha.position.set(d.textAt.x + LARGURA_TEXTO / 2, d.textAt.y, d.elevation);
  malha.userData = { levelId: d.levelId };
  return malha;
}

/** Plano azul translúcido cobrindo a planta do nível selecionado, na cota dele. */
function planoDoNivel(d: LevelDatum): THREE.Mesh {
  const largura = d.plane.maxX - d.plane.minX;
  const altura = d.plane.maxY - d.plane.minY;
  const material = new THREE.MeshBasicMaterial({
    color: COR_SELECIONADO,
    transparent: true,
    opacity: OPACIDADE_PLANO,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(largura, altura), material);
  malha.position.set(d.plane.minX + largura / 2, d.plane.minY + altura / 2, d.elevation);
  malha.userData = { levelsPlane: true, levelId: d.levelId };
  return malha;
}

/** Canvas 2D do tamanho pedido; `null` fora do navegador (testes em node) ou sem contexto 2D. */
function canvasComContexto(
  largura: number,
  altura: number,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  return ctx ? { canvas, ctx } : null;
}

/**
 * Textura da bolha do nível: círculo branco com borda azul e 4 quadrantes, 2 opostos preenchidos de azul (como o
 * Level Head–Circle do Revit). Sem canvas (testes), devolve `null` e a bolha fica só com o material.
 */
function texturaDaBolha(): THREE.CanvasTexture | null {
  const alvo = canvasComContexto(128, 128);
  if (!alvo) return null;
  const { ctx } = alvo;
  const centro = 64;
  const raio = 60;
  ctx.clearRect(0, 0, 128, 128);
  // Fundo branco do círculo.
  ctx.beginPath();
  ctx.arc(centro, centro, raio, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // Dois quadrantes opostos (superior-esquerdo e inferior-direito), recortados no círculo.
  ctx.save();
  ctx.beginPath();
  ctx.arc(centro, centro, raio, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(centro - raio, centro - raio, raio, raio);
  ctx.fillRect(centro, centro, raio, raio);
  ctx.restore();
  // Borda azul por cima dos quadrantes.
  ctx.beginPath();
  ctx.arc(centro, centro, raio - 2, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1565c0';
  ctx.stroke();
  return texturaDeCanvas(alvo.canvas);
}

/** Textura do texto do nível: fundo transparente, fonte legível, cor escura e alinhado à esquerda do canvas. */
function texturaDoTexto(texto: string): THREE.CanvasTexture | null {
  const alvo = canvasComContexto(768, 128);
  if (!alvo) return null;
  const { ctx } = alvo;
  ctx.clearRect(0, 0, 768, 128);
  ctx.font = 'bold 64px sans-serif';
  // Encolhe a fonte se o nome for comprido, para o texto não ser cortado pelo canvas.
  const largura = ctx.measureText(texto).width;
  if (largura > 748) ctx.font = `bold ${Math.floor((64 * 748) / largura)}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1f2937';
  // Margem pequena à esquerda: a borda esquerda do texto é a do plano, que encosta em `textAt`.
  ctx.fillText(texto, 10, 64);
  // (canvas 768 x 128; a textura acompanha a proporção do plano de 6 m x 1 m.)
  return texturaDeCanvas(alvo.canvas);
}

/** Textura sRGB a partir do canvas desenhado. */
function texturaDeCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Libera geometrias, materiais e texturas (inclusive as de canvas) do grupo de níveis, sem liberar duas vezes. */
export function disposeLevels(group: THREE.Group): void {
  const geometrias = new Set<THREE.BufferGeometry>();
  const materiais = new Set<THREE.Material>();
  const texturas = new Set<THREE.Texture>();
  group.traverse((o) => {
    const geo = (o as THREE.Mesh).geometry;
    if (geo) geometrias.add(geo);
    const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      materiais.add(m);
      const mapa = (m as THREE.MeshBasicMaterial).map;
      if (mapa) texturas.add(mapa);
    }
  });
  for (const t of texturas) t.dispose();
  for (const m of materiais) m.dispose();
  for (const g of geometrias) g.dispose();
  group.clear();
}