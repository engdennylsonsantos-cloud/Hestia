import * as THREE from 'three';
import { isCad, type CadDrawing, type Id, type Project } from '@hestia/model';

/**
 * Linhas do desenho CAD importado na vista 3D. O desenho é um objeto do nível (como um bloco): cada traço vira segmentos
 * na cota do nível mais o `offsetZ` do desenho, com a cor ACI da entidade (ou da camada). Os textos do CAD não entram no
 * 3D por enquanto: só os traços, que é o que o modelo importado representa em planta.
 */
export interface CadLineData {
  /** x, y, z por vértice (m, no mundo); dois vértices por segmento. */
  positions: number[];
  /** RGB 0..1 por vértice, na mesma ordem de `positions`. */
  colors: number[];
}

/** Cinza escuro das entidades sem cor ACI (nem na entidade, nem na camada). */
const CINZA_ESCURO: readonly [number, number, number] = [0.25, 0.25, 0.25];

/** Cores ACI 0 a 9 (0 = pelo bloco, 7 = branco/preto, 8 e 9 = cinzas). */
const ACI_BASICAS: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0],
  [255, 0, 0],
  [255, 255, 0],
  [0, 255, 0],
  [0, 255, 255],
  [0, 0, 255],
  [255, 0, 255],
  [255, 255, 255],
  [65, 65, 65],
  [128, 128, 128],
];

/** Matizes da tabela ACI (10 a 249): 24 matizes de 10 tons cada, na ordem do AutoCAD. */
const ACI_MATIZES: ReadonlyArray<readonly [number, number, number]> = [
  [255, 0, 0],
  [255, 63, 0],
  [255, 127, 0],
  [255, 191, 0],
  [255, 255, 0],
  [191, 255, 0],
  [127, 255, 0],
  [63, 255, 0],
  [0, 255, 0],
  [0, 255, 63],
  [0, 255, 127],
  [0, 255, 191],
  [0, 255, 255],
  [0, 191, 255],
  [0, 127, 255],
  [0, 63, 255],
  [0, 0, 255],
  [63, 0, 255],
  [127, 0, 255],
  [191, 0, 255],
  [255, 0, 255],
  [255, 0, 191],
  [255, 0, 127],
  [255, 0, 63],
];

/** Fatores de brilho dos 5 tons de cada matiz (o tom par é cheio, o ímpar é a metade clara). */
const ACI_TONS = [1, 0.65, 0.5, 0.3, 0.15] as const;

/** Cinzas da tabela ACI (250 a 255). */
const ACI_CINZAS = [51, 91, 132, 173, 214, 255] as const;

/** Material das linhas do CAD: cores por vértice, compartilhado (o material não pertence ao nível). */
const MATERIAL_CAD = new THREE.LineBasicMaterial({ vertexColors: true });

/**
 * Cor ACI (1 a 255) em RGB 0..1. Ausente, 0 (pelo bloco) ou fora da tabela: cinza escuro. A tabela é a padrão do
 * AutoCAD: 1 a 9 básicas, 10 a 249 em 24 matizes de 10 tons e 250 a 255 em cinzas.
 */
export function corAci(aci: number | undefined): [number, number, number] {
  if (aci == null || !Number.isFinite(aci)) return [...CINZA_ESCURO];
  const n = Math.round(aci);
  if (n <= 0 || n > 255) return [...CINZA_ESCURO];
  if (n <= 9) {
    const [r, g, b] = ACI_BASICAS[n]!;
    return [r / 255, g / 255, b / 255];
  }
  if (n >= 250) {
    const v = ACI_CINZAS[n - 250]! / 255;
    return [v, v, v];
  }
  const matiz = ACI_MATIZES[Math.floor((n - 10) / 10)]!;
  const tom = (n - 10) % 10;
  const f = ACI_TONS[Math.floor(tom / 2)]!;
  const claro = tom % 2 === 1;
  return matiz.map((c) => {
    const v = c * f;
    return (claro ? (v + 255) / 2 : v) / 255;
  }) as [number, number, number];
}

/** Desenhos CAD visíveis de um nível, na ordem de criação. */
function desenhosDoNivel(p: Project, levelId: Id): CadDrawing[] {
  return Object.values(p.elements)
    .filter(isCad)
    .filter((e) => e.levelId === levelId && e.visible !== false)
    .sort((a, b) => a.order - b.order);
}

/**
 * Segmentos das linhas do CAD de um nível, em `z = elevation + (offsetZ ?? 0)`. Cada traço vira segmentos; o traço
 * fechado repete o primeiro ponto no fim. A cor é a da entidade; sem ela, a da camada; sem nenhuma, cinza escuro.
 * `null` quando o nível não tem desenho visível (ou nenhum traço com dois pontos).
 */
export function cadLineData(p: Project, levelId: Id, elevation: number): CadLineData | null {
  const positions: number[] = [];
  const colors: number[] = [];
  for (const e of desenhosDoNivel(p, levelId)) {
    const z = elevation + (e.offsetZ ?? 0);
    const corDaCamada = new Map(e.layers.map((l) => [l.name, l.color]));
    for (const path of e.paths) {
      const [r, g, b] = corAci(path.color ?? corDaCamada.get(path.layer));
      const pts = path.pts;
      const n = pts.length;
      if (n < 2) continue;
      // O traço fechado fecha do último ponto no primeiro; com dois pontos, o fecho seria a mesma linha ao contrário.
      const segmentos = path.closed && n > 2 ? n : n - 1;
      for (let i = 0; i < segmentos; i++) {
        const a = pts[i]!;
        const c = pts[(i + 1) % n]!;
        positions.push(a.x, a.y, z, c.x, c.y, z);
        colors.push(r, g, b, r, g, b);
      }
    }
  }
  return positions.length ? { positions, colors } : null;
}

/**
 * Linhas do CAD de um nível para a cena 3D, ou `null` sem desenho visível. `userData.elementIds` e `userData.cadIds`
 * guardam os desenhos do nível (picking futuro); `frustumCulled` falso porque a caixa do desenho não é recalculada quando
 * o nível se move. O material é compartilhado, com as cores por vértice.
 */
export function buildCadLines(p: Project, levelId: Id, elevation: number): THREE.LineSegments | null {
  const dados = cadLineData(p, levelId, elevation);
  if (!dados) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(dados.positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(dados.colors, 3));
  const linhas = new THREE.LineSegments(geo, MATERIAL_CAD);
  const ids = desenhosDoNivel(p, levelId).map((e) => e.id);
  linhas.userData = { kind: 'generic', elementIds: ids, cadIds: ids };
  linhas.frustumCulled = false;
  return linhas;
}
