import * as THREE from 'three';
import type { Id, Project } from '@hestia/model';
import { levelDataOf, levelProjectBox, type LevelDatum } from './levelsData.ts';

/**
 * Datum de nível no 3D (fase 6, revisão): linha tracejada, bolha e texto em **billboard** (sempre de pé, virados para a
 * câmera) e cota real entre os eixos das bolhas. O conjunto é colocado num dos 4 lados da caixa da obra, escolhido pela
 * câmera: o lado que está **atrás e à esquerda** dela. A bolha fica sempre na ponta esquerda da linha e o texto à direita
 * dela; a linha corre ao longo do lado, fora da obra. O layout é recalculado a cada quadro com histerese, para não pular
 * entre lados quando a câmera passa perto da divisa.
 */

/** Lado da caixa da obra em que o datum é colocado. */
export type LevelSide = 'S' | 'N' | 'W' | 'E';

/** Intervalo da cota: do nível selecionado para o de baixo ou para o de cima. */
export type DimensionSide = 'below' | 'above';

/** Dados de uma cota clicável no 3D. */
export interface DimensionInfo {
  levelId: Id;
  neighborId: Id;
  side: DimensionSide;
  /** Δ em metros (positivo). */
  value: number;
}

/** Objetos de um nível no grupo (a cena os move a cada quadro). */
export interface LevelView {
  datum: LevelDatum;
  line: THREE.Line;
  bubble: THREE.Sprite;
  text: THREE.Sprite;
}

/** Objetos de uma cota entre dois níveis. */
export interface DimensionView {
  info: DimensionInfo;
  line: THREE.Line;
  extensions: THREE.LineSegments;
  ticks: THREE.LineSegments;
  label: THREE.Sprite;
}

/** Estado guardado no grupo: os objetos e o último lado/ponta escolhidos (histerese). */
export interface LevelsGroupData {
  levels: true;
  views: LevelView[];
  dimensions: DimensionView[];
  data: LevelDatum[];
  box: { minX: number; minY: number; maxX: number; maxY: number };
  layout: { side: LevelSide | null; end: 'a' | 'b' | null };
}

/** Cor da linha de datum dos níveis não selecionados (cinza-azulado escuro). */
const COR_LINHA = 0x374151;

/** Azul do Revit: nível selecionado, plano, bolha e cota. */
const COR_SELECIONADO = 0x1565c0;

/** Tracejado da linha de datum (m). */
const DASH = 0.3;
const GAP = 0.15;
const DASH_SELECIONADO = 0.4;

/** Bolha do nível (m) e texto (altura em m; largura pela proporção do canvas 6:1). */
const LADO_BOLHA = 0.5;
const ALTURA_TEXTO = 0.7;
const PROPORCAO_TEXTO = 6;
const LARGURA_TEXTO = ALTURA_TEXTO * PROPORCAO_TEXTO;

/** Folga entre a bolha e o texto (m). */
const GAP_TEXTO = 0.25;

/** Etiqueta da cota (m). */
const LARGURA_COTA = 1.6;
const ALTURA_COTA = 0.5;

/** Margem da linha além dos cantos do lado (m) e afastamento do lado para fora da obra (m). */
const MARGEM_LINHA = 1.5;
const AFLORAMENTO = 1.2;

/** Afastamento da linha de cota em relação ao eixo das bolhas (m). */
const AFASTAMENTO_COTA = LADO_BOLHA / 2 + 0.35;

/** Histerese (em NDC) para o lado: evita o vaivém quando a câmera passa perto da divisa. */
const HISTERESE_LADO = 0.08;
/** Histerese curta da ponta: só evita o pisca-pisca quando a câmera está exatamente de lado. */
const HISTERESE_PONTA = 0.01;

/** Opacidade do plano azul do nível selecionado. */
const OPACIDADE_PLANO = 0.18;

/**
 * Grupo do datum: uma linha, uma bolha e um texto por nível, o plano azul do selecionado e as cotas dos vizinhos.
 * `layoutLevels` move tudo a cada quadro; a cena chama no `onBeforeRender`.
 */
export function buildLevels(p: Project, selected: Id | null): THREE.Group {
  const grupo = new THREE.Group();
  const data = levelDataOf(p);
  const views: LevelView[] = [];
  const dimensions: DimensionView[] = [];
  // A bolha é igual em todos os níveis: uma textura e um material só (liberados uma vez em `disposeLevels`).
  const texturaBolha = texturaDaBolha();
  const materialBolha = new THREE.SpriteMaterial({
    ...(texturaBolha ? { map: texturaBolha } : {}),
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  for (const d of data) {
    const selecionado = d.levelId === selected;
    const line = linhaDoDatum(d, selecionado);
    const bubble = bolhaDoDatum(d, materialBolha);
    const text = textoDoDatum(d);
    grupo.add(line, bubble, text);
    if (selecionado) grupo.add(planoDoNivel(d));
    views.push({ datum: d, line, bubble, text });
  }
  if (selected !== null) {
    const i = data.findIndex((d) => d.levelId === selected);
    if (i >= 0) {
      if (i > 0) dimensions.push(dimensao(data[i]!, data[i - 1]!, 'below'));
      if (i < data.length - 1) dimensions.push(dimensao(data[i]!, data[i + 1]!, 'above'));
    }
    for (const dim of dimensions) grupo.add(dim.line, dim.extensions, dim.ticks, dim.label);
  }
  const info: LevelsGroupData = {
    levels: true,
    views,
    dimensions,
    data,
    box: levelProjectBox(p),
    layout: { side: null, end: null },
  };
  grupo.userData = info;
  return grupo;
}

/** Linha tracejada do datum; as pontas são atualizadas em `layoutLevels`. */
function linhaDoDatum(d: LevelDatum, selecionado: boolean): THREE.Line {
  const material = new THREE.LineDashedMaterial({
    color: selecionado ? COR_SELECIONADO : COR_LINHA,
    dashSize: selecionado ? DASH_SELECIONADO : DASH,
    gapSize: GAP,
  });
  const geometria = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const linha = new THREE.Line(geometria, material);
  linha.userData = { levelId: d.levelId, datumKind: 'line' };
  linha.frustumCulled = false;
  return linha;
}

/** Bolha (sprite) no eixo do nível; sempre de frente para a câmera. */
function bolhaDoDatum(d: LevelDatum, material: THREE.SpriteMaterial): THREE.Sprite {
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(LADO_BOLHA, LADO_BOLHA, 1);
  sprite.renderOrder = 21;
  sprite.userData = { levelId: d.levelId, datumKind: 'bubble' };
  sprite.frustumCulled = false;
  return sprite;
}

/** Texto (nome + cota) em billboard, acima da linha e à direita da bolha. */
function textoDoDatum(d: LevelDatum): THREE.Sprite {
  const textura = texturaDoTexto(d.text);
  const material = new THREE.SpriteMaterial({
    ...(textura ? { map: textura } : {}),
    transparent: true,
    depthWrite: false,
    // Anotação: fica sempre legível, na frente do modelo (como o level head do Revit).
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(LARGURA_TEXTO, ALTURA_TEXTO, 1);
  sprite.renderOrder = 20;
  sprite.userData = { levelId: d.levelId, datumKind: 'text' };
  sprite.frustumCulled = false;
  return sprite;
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

/** Cota entre o nível selecionado e um vizinho: linha de cota, linhas de chamada, tiques e etiqueta. */
function dimensao(sel: LevelDatum, vizinho: LevelDatum, side: DimensionSide): DimensionView {
  const info: DimensionInfo = {
    levelId: sel.levelId,
    neighborId: vizinho.levelId,
    side,
    value: Math.abs(sel.elevation - vizinho.elevation),
  };
  const material = new THREE.LineBasicMaterial({ color: COR_SELECIONADO, depthTest: false });
  const geometria = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geometria, material);
  line.userData = { dimension: info };
  line.frustumCulled = false;
  line.renderOrder = 24;
  const extensions = segmentos(material);
  extensions.userData = { dimension: info };
  extensions.renderOrder = 24;
  const ticks = segmentos(material);
  ticks.userData = { dimension: info };
  ticks.renderOrder = 24;
  const textura = texturaDaCota(info.value);
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({
      ...(textura ? { map: textura } : {}),
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  label.scale.set(LARGURA_COTA, ALTURA_COTA, 1);
  label.renderOrder = 25;
  label.userData = { dimension: info };
  label.frustumCulled = false;
  return { info, line, extensions, ticks, label };
}

/** `LineSegments` vazio (4 pontos) para as linhas de chamada e os tiques da cota. */
function segmentos(material: THREE.LineBasicMaterial): THREE.LineSegments {
  const geometria = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3(),
  ]);
  const linha = new THREE.LineSegments(geometria, material);
  linha.frustumCulled = false;
  return linha;
}

interface Vec2 {
  x: number;
  y: number;
}

interface SideDef {
  id: LevelSide;
  a: Vec2;
  b: Vec2;
  /** Normal para fora da obra. */
  n: Vec2;
}

/** Os 4 lados da caixa da obra, com a normal para fora. */
function ladosDaCaixa(box: { minX: number; minY: number; maxX: number; maxY: number }): SideDef[] {
  return [
    { id: 'S', a: { x: box.minX, y: box.minY }, b: { x: box.maxX, y: box.minY }, n: { x: 0, y: -1 } },
    { id: 'N', a: { x: box.minX, y: box.maxY }, b: { x: box.maxX, y: box.maxY }, n: { x: 0, y: 1 } },
    { id: 'W', a: { x: box.minX, y: box.minY }, b: { x: box.minX, y: box.maxY }, n: { x: -1, y: 0 } },
    { id: 'E', a: { x: box.maxX, y: box.minY }, b: { x: box.maxX, y: box.maxY }, n: { x: 1, y: 0 } },
  ];
}

/**
 * Recalcula o layout do datum para a câmera: escolhe o lado atrás/à esquerda, a ponta esquerda, e move linhas, bolhas,
 * textos e cotas. A escolha do lado/ponta tem histerese; a posição em si é contínua, então durante a órbita o conjunto
 * acompanha a câmera sem tremer.
 */
export function layoutLevels(group: THREE.Group, camera: THREE.Camera, forward: THREE.Vector3): void {
  const info = group.userData as LevelsGroupData;
  if (!info?.views?.length) return;
  const { box, data } = info;
  camera.updateMatrixWorld();
  const zRef = (Math.min(...data.map((d) => d.elevation)) + Math.max(...data.map((d) => d.elevation))) / 2;
  const projetarX = (p: Vec2): number => new THREE.Vector3(p.x, p.y, zRef).project(camera).x;
  const lados = ladosDaCaixa(box);
  const xs = new Map<LevelSide, number>();
  const atras = new Map<LevelSide, number>();
  for (const lado of lados) {
    xs.set(lado.id, Math.min(projetarX(lado.a), projetarX(lado.b)));
    atras.set(lado.id, lado.n.x * forward.x + lado.n.y * forward.y);
  }
  // Só os lados atrás da obra (normal para longe da câmera); se a câmera estiver dentro, usa todos.
  const candidatos = lados.filter((l) => (atras.get(l.id) ?? 0) >= -0.001);
  const lista = candidatos.length ? candidatos : lados;
  let melhor = lista[0]!;
  for (const lado of lista) if ((xs.get(lado.id) ?? 0) < (xs.get(melhor.id) ?? 0)) melhor = lado;
  // Histerese: fica no lado atual se ele continua atrás e ainda está perto do mais à esquerda.
  const atual = info.layout.side === null ? undefined : lados.find((l) => l.id === info.layout.side);
  if (
    atual &&
    (atras.get(atual.id) ?? -1) >= -0.05 &&
    (xs.get(atual.id) ?? 0) <= (xs.get(melhor.id) ?? 0) + HISTERESE_LADO
  ) {
    melhor = atual;
  }
  // Ponta esquerda do lado (a bolha). É sempre a mais à esquerda na tela; a histerese curta só evita o pisca-pisca
  // quando a câmera está exatamente de lado (a bolha pode ficar no máximo 1% à direita por um quadro).
  const xa = projetarX(melhor.a);
  const xb = projetarX(melhor.b);
  const pontaEsquerda: 'a' | 'b' = xa <= xb ? 'a' : 'b';
  let ponta = info.layout.end ?? pontaEsquerda;
  if (ponta !== pontaEsquerda) {
    const xAtual = ponta === 'a' ? xa : xb;
    const xOutra = ponta === 'a' ? xb : xa;
    if (xAtual > xOutra + HISTERESE_PONTA) ponta = pontaEsquerda;
  }
  info.layout = { side: melhor.id, end: ponta };

  const a = ponta === 'a' ? melhor.a : melhor.b;
  const b = ponta === 'a' ? melhor.b : melhor.a;
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const along = { x: (b.x - a.x) / comprimento, y: (b.y - a.y) / comprimento };
  const n = melhor.n;
  // A linha fica fora do lado (AFLORAMENTO) e um pouco além dos cantos (MARGEM_LINHA). A bolha é a ponta esquerda.
  const start = {
    x: a.x + n.x * AFLORAMENTO - along.x * MARGEM_LINHA,
    y: a.y + n.y * AFLORAMENTO - along.y * MARGEM_LINHA,
  };
  const finish = {
    x: b.x + n.x * AFLORAMENTO + along.x * MARGEM_LINHA,
    y: b.y + n.y * AFLORAMENTO + along.y * MARGEM_LINHA,
  };
  for (const view of info.views) {
    const z = view.datum.elevation;
    moverLinha(view.line, start.x, start.y, z, finish.x, finish.y, z);
    view.bubble.position.set(start.x, start.y, z);
    const t = LADO_BOLHA / 2 + GAP_TEXTO + LARGURA_TEXTO / 2;
    view.text.position.set(start.x + along.x * t, start.y + along.y * t, z + ALTURA_TEXTO / 2 + 0.08);
  }
  for (const dim of info.dimensions) {
    const sel = data.find((d) => d.levelId === dim.info.levelId);
    const vizinho = data.find((d) => d.levelId === dim.info.neighborId);
    if (!sel || !vizinho) continue;
    const z1 = Math.min(sel.elevation, vizinho.elevation);
    const z2 = Math.max(sel.elevation, vizinho.elevation);
    // A cota mede o eixo das bolhas (start); a linha de cota fica um pouco para fora, com linhas de chamada.
    const cx = start.x + n.x * AFASTAMENTO_COTA;
    const cy = start.y + n.y * AFASTAMENTO_COTA;
    moverLinha(dim.line, cx, cy, z1, cx, cy, z2);
    moverSegmentos(dim.extensions, [
      start.x, start.y, z1, cx, cy, z1,
      start.x, start.y, z2, cx, cy, z2,
    ]);
    const tique = 0.22;
    moverSegmentos(dim.ticks, [
      cx - along.x * tique, cy - along.y * tique, z1, cx + along.x * tique, cy + along.y * tique, z1,
      cx - along.x * tique, cy - along.y * tique, z2, cx + along.x * tique, cy + along.y * tique, z2,
    ]);
    dim.label.position.set(cx + n.x * 0.5, cy + n.y * 0.5, (z1 + z2) / 2);
  }
}

/** Atualiza uma linha de 2 pontos (e as distâncias do tracejado). */
function moverLinha(linha: THREE.Line, ax: number, ay: number, az: number, bx: number, by: number, bz: number): void {
  const pos = linha.geometry.getAttribute('position') as THREE.BufferAttribute;
  pos.setXYZ(0, ax, ay, az);
  pos.setXYZ(1, bx, by, bz);
  pos.needsUpdate = true;
  linha.geometry.computeBoundingSphere();
  linha.computeLineDistances();
}

/** Atualiza uma `LineSegments` de 4 pontos (12 números). */
function moverSegmentos(linha: THREE.LineSegments, valores: readonly number[]): void {
  const pos = linha.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < valores.length / 3; i++) pos.setXYZ(i, valores[i * 3]!, valores[i * 3 + 1]!, valores[i * 3 + 2]!);
  pos.needsUpdate = true;
  linha.geometry.computeBoundingSphere();
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
  ctx.beginPath();
  ctx.arc(centro, centro, raio, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(centro, centro, raio, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(centro - raio, centro - raio, raio, raio);
  ctx.fillRect(centro, centro, raio, raio);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(centro, centro, raio - 2, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#1565c0';
  ctx.stroke();
  return texturaDeCanvas(alvo.canvas);
}

/** Textura do texto do nível: fundo transparente, fonte legível, cor escura, alinhado à esquerda. */
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
  ctx.fillText(texto, 10, 64);
  return texturaDeCanvas(alvo.canvas);
}

/** Textura da etiqueta da cota: `3,00 m` em fundo branco com borda azul. */
function texturaDaCota(value: number): THREE.CanvasTexture | null {
  const alvo = canvasComContexto(320, 96);
  if (!alvo) return null;
  const { ctx } = alvo;
  ctx.clearRect(0, 0, 320, 96);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(2, 2, 316, 92);
  ctx.strokeStyle = '#1565c0';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 316, 92);
  // units-ok: rótulo da cota de nível no 3D (m)
  const texto = `${value.toFixed(2).replace('.', ',')} m`;
  ctx.fillStyle = '#0d47a1';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, 160, 50);
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
