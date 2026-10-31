import * as THREE from 'three';
import { cameraDaVista3D, sheetView3DCameraIssue, view3dOf, type Project, type SheetViewport } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { aplicarCameraNaOrbita, OrbitCamera } from '../model3d/orbit.ts';
import { buildTriBvh, type TriBvh } from '../model3d/triBvh.ts';
import { ModelScene, type VetoresDaCena } from '../model3d/scene3d.ts';
import { emptyParts, type ViewportParts } from './types.ts';

/**
 * Vista 3D vetorial na prancha (decisão 0040). Usa a MESMA montagem da aba 3D (`ModelScene`) e a MESMA câmera
 * (`OrbitCamera`); o que esta etapa acrescenta é só o que a GPU fazia sozinha e o papel não tem: projetar as arestas,
 * aplicar o teste de profundidade (linhas ocultas) e recortar no quadro. Nenhuma geometria é recriada: os triângulos e as
 * arestas vêm de `ModelScene.exportarVetores()`, que lê o grupo do modelo que a GPU desenha.
 */

/** Resolução do z-buffer em px por mm de papel (a saída continua vetorial: isso só decide a visibilidade). */
const PX_POR_MM = 5;
/** Teto do lado maior do z-buffer (um quadro A0 a 8 px/mm passaria de 9000 px). */
const PX_MAX = 2400;
/** Passo de amostragem das arestas no z-buffer, em px (a saída é vetorial; isto só decide a visibilidade). */
const PASSO_PX = 3;
/** Tinta do desenho impresso, o mesmo tom da planta em papel. */
const TINTA = '#16181c';
/** Espessura das arestas do 3D no papel (mm). */
const TRACO_MM = 0.18;

interface CenaVetorial extends VetoresDaCena {
  bvh: TriBvh;
}

/**
 * Cena vetorial do projeto, montada uma vez por objeto de projeto. O `ModelScene` é descartado em seguida: ficam só os
 * triângulos, as arestas e o BVH (o que o papel precisa). O estilo é forçado para `hiddenLine` porque no papel a
 * representação é sempre de linhas; a geometria e a visibilidade de categorias são as da vista 3D do projeto.
 *
 * O app pode fornecer a geometria da cena 3D **viva** (já montada na aba 3D) por `definirProvedorVetores3D`: assim a
 * prancha não remonta 10 pavimentos de novo. Sem provedor (ou com a cena viva sem arestas/faces), monta uma instância
 * própria — mesma classe, mesmo caminho.
 */
const cenas = new WeakMap<Project, CenaVetorial | null>();

export type ProvedorVetores3D = (p: Project) => VetoresDaCena | null;
let provedorVetores: ProvedorVetores3D | null = null;

export function definirProvedorVetores3D(fn: ProvedorVetores3D | null): void {
  provedorVetores = fn;
}

/** Triângulos e arestas em mundo → BVH + arestas sem duplicata (o que o teste de visibilidade consome). */
function prepararCena(vetores: VetoresDaCena): CenaVetorial | null {
  if (vetores.box.isEmpty() || vetores.triangleIndices.length === 0 || vetores.edges.length === 0) return null;
  const bvh = buildTriBvh(vetores.trianglePositions, vetores.triangleIndices);
  const vistos = new Set<string>();
  const arestas: number[] = [];
  const chave = (i: number): string => `${Math.round(vetores.edges[i]! * 1e4)},${Math.round(vetores.edges[i + 1]! * 1e4)},${Math.round(vetores.edges[i + 2]! * 1e4)}`;
  for (let i = 0; i + 5 < vetores.edges.length; i += 6) {
    const ka = chave(i);
    const kb = chave(i + 3);
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    for (let j = 0; j < 6; j++) arestas.push(vetores.edges[i + j]!);
  }
  return { ...vetores, edges: Float32Array.from(arestas), bvh };
}

/** Monta uma cena própria (sem provedor) e devolve só a geometria vetorial. */
function construirVetores(p: Project): VetoresDaCena | null {
  const vista = view3dOf(p);
  const projetoDeLinhas: Project = { ...p, view3d: { ...vista, style: 'hiddenLine', edges: true } };
  const cena = new ModelScene();
  try {
    cena.update(projetoDeLinhas, p.levels.map((l) => resolveLevel(projetoDeLinhas, l.id)), { dark: false, edges: true, shadows: false });
    return cena.exportarVetores();
  } finally {
    cena.dispose();
  }
}

function cenaDe(p: Project): CenaVetorial | null {
  if (cenas.has(p)) return cenas.get(p) ?? null;
  const daViva = provedorVetores?.(p) ?? null;
  const out = prepararCena(daViva ?? construirVetores(p) ?? { trianglePositions: new Float32Array(), triangleIndices: new Uint32Array(), edges: new Float32Array(), box: new THREE.Box3() });
  cenas.set(p, out);
  return out;
}

/** Câmera da vista: o retrato salvo (ponto de vista ou cópia embutida) ou o enquadramento padrão do modelo. */
function cameraDe(p: Project, vp: SheetViewport, box: THREE.Box3): OrbitCamera {
  const orb = new OrbitCamera();
  orb.sceneRadius = box.isEmpty() ? 0 : box.getSize(new THREE.Vector3()).length() / 2;
  const salva = vp.view.kind === '3d' ? cameraDaVista3D(p, vp.view) : null;
  if (salva && sheetView3DCameraIssue(salva) === null) aplicarCameraNaOrbita(orb, salva);
  else {
    orb.fit(box);
    orb.setOrtho(false);
  }
  // A proporção do quadro recorta a vista: é o "crop region" da prancha. A orientação, o alvo e a distância não mudam.
  orb.setAspect(vp.size.w, vp.size.h);
  orb.apply();
  return orb;
}

/** Plano próximo do frustro (o mesmo de `cameraClip`, via `OrbitCamera.apply`). */
const nearDe = (c: THREE.PerspectiveCamera | THREE.OrthographicCamera): number => c.near;

/** Interpolação de pontos no espaço de recorte (w incluído). */
function lerp4(a: THREE.Vector4, b: THREE.Vector4, t: number): THREE.Vector4 {
  return new THREE.Vector4(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t, a.w + (b.w - a.w) * t);
}

/** Recorta um polígono contra o plano próximo (`z + w >= 0`), em coordenadas de recorte. */
function recortaProximo(poly: THREE.Vector4[]): THREE.Vector4[] {
  const out: THREE.Vector4[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = a.z + a.w;
    const db = b.z + b.w;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) out.push(lerp4(a, b, da / (da - db)));
  }
  return out;
}

interface Tela {
  w: number;
  h: number;
  /** Profundidade da primeira superfície em cada pixel (m, distância ao longo do eixo da câmera). */
  z: Float32Array;
}

/**
 * Z-buffer do modelo para esta câmera: rasteriza os triângulos exportados e guarda a menor profundidade por pixel.
 * É o mesmo teste que a GPU faz; a diferença é que aqui ele só decide quais arestas entram no desenho vetorial.
 */
function profundidades(tri: VetoresDaCena, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, w: number, h: number): Tela {
  const z = new Float32Array(w * h).fill(Infinity);
  const viewProj = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const perspectiva = camera instanceof THREE.PerspectiveCamera;
  const near = nearDe(camera);
  const far = camera.far;
  const pos = tri.trianglePositions;
  const idx = tri.triangleIndices;
  const v = [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()];
  const clip: THREE.Vector4[] = [];

  for (let t = 0; t + 2 < idx.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const n = idx[t + k]! * 3;
      v[k]!.set(pos[n]!, pos[n + 1]!, pos[n + 2]!, 1).applyMatrix4(viewProj);
    }
    clip.length = 0;
    clip.push(v[0]!, v[1]!, v[2]!);
    const poly = recortaProximo(clip);
    if (poly.length < 3) continue;

    // Projeta cada vértice recortado para a tela e guarda a profundidade linear (perspectiva: 1/w; ortogonal: z).
    const sx: number[] = [];
    const sy: number[] = [];
    const prof: number[] = [];
    for (const p of poly) {
      const inv = 1 / p.w;
      sx.push((p.x * inv * 0.5 + 0.5) * w);
      sy.push((1 - (p.y * inv * 0.5 + 0.5)) * h);
      prof.push(perspectiva ? p.w : near + ((p.z * inv + 1) / 2) * (far - near));
    }

    // Leque a partir do primeiro vértice (o polígono recortado é convexo).
    for (let f = 1; f + 1 < poly.length; f++) {
      const i0 = 0;
      const i1 = f;
      const i2 = f + 1;
      const x0 = sx[i0]!;
      const y0 = sy[i0]!;
      const x1 = sx[i1]!;
      const y1 = sy[i1]!;
      const x2 = sx[i2]!;
      const y2 = sy[i2]!;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (!Number.isFinite(area) || Math.abs(area) < 1e-9) continue;
      const d0 = prof[i0]!;
      const d1 = prof[i1]!;
      const d2 = prof[i2]!;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
      const maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
      const maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
      if (minX > maxX || minY > maxY) continue;
      for (let y = minY; y <= maxY; y++) {
        const py = y + 0.5;
        for (let x = minX; x <= maxX; x++) {
          const px = x + 0.5;
          // Coordenadas baricêntricas na tela (o sinal do determinante orienta o triângulo).
          const l0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) / area;
          const l1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) / area;
          const l2 = 1 - l0 - l1;
          if (l0 < -1e-6 || l1 < -1e-6 || l2 < -1e-6) continue;
          // Perspectiva: 1/w é afim na tela; ortogonal: a profundidade já é afim.
          const d = perspectiva ? 1 / (l0 / d0 + l1 / d1 + l2 / d2) : l0 * d0 + l1 * d1 + l2 * d2;
          const i = y * w + x;
          if (d < z[i]!) z[i] = d;
        }
      }
    }
  }
  // Dilatação 3×3 (mínimo): fecha as frestas de 1 px nas silhuetas. Feita uma vez por quadro, para o teste de cada
  // amostra continuar sendo uma leitura só.
  const zmin = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = Infinity;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const v = z[yy * w + xx]!;
          if (v < m) m = v;
        }
      }
      zmin[y * w + x] = m;
    }
  }
  return { w, h, z: zmin };
}

/** Ponto do mundo em mm de papel (y para cima no papel), com a profundidade no espaço da câmera. */
function paraPapel(
  p: THREE.Vector3,
  viewProj: THREE.Matrix4,
  vp: SheetViewport,
  perspectiva: boolean,
  near: number,
  far: number,
  clip: THREE.Vector4,
  out: { x: number; y: number; d: number },
): void {
  clip.set(p.x, p.y, p.z, 1).applyMatrix4(viewProj);
  const inv = 1 / clip.w;
  out.x = vp.at.x + (clip.x * inv * 0.5 + 0.5) * vp.size.w;
  out.y = vp.at.y + (clip.y * inv * 0.5 + 0.5) * vp.size.h;
  out.d = perspectiva ? clip.w : near + ((clip.z * inv + 1) / 2) * (far - near);
}

/** Recorte 2D de um segmento contra o quadro da vista (Liang–Barsky), em mm de papel. */
function recortaSegmento(
  a: { x: number; y: number },
  b: { x: number; y: number },
  vp: SheetViewport,
): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - vp.at.x, vp.at.x + vp.size.w - a.x, a.y - vp.at.y, vp.at.y + vp.size.h - a.y];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]!) < 1e-12) {
      if (q[i]! < 0) return null;
      continue;
    }
    const r = q[i]! / p[i]!;
    if (p[i]! < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return {
    a: { x: a.x + dx * t0, y: a.y + dy * t0 },
    b: { x: a.x + dx * t1, y: a.y + dy * t1 },
  };
}

/**
 * Partes da vista 3D para a prancha: caminhos vetoriais em mm de papel, já recortados ao quadro. Sem modelo, devolve
 * vazio (a moldura e a legenda continuam sendo do compositor da prancha).
 */
export function vista3dParts(p: Project, vp: SheetViewport): ViewportParts {
  const out = emptyParts();
  if (vp.view.kind !== '3d') return out;
  const cena = cenaDe(p);
  if (!cena) return out;
  const orb = cameraDe(p, vp, cena.box);
  const camera = orb.camera;
  camera.updateMatrixWorld(true);
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  const viewProj = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

  // Z-buffer na proporção do quadro, com teto de resolução.
  const lado = Math.min(PX_MAX, Math.max(64, Math.round(Math.max(vp.size.w, vp.size.h) * PX_POR_MM)));
  const escala = lado / Math.max(vp.size.w, vp.size.h);
  const W = Math.max(1, Math.round(vp.size.w * escala));
  const H = Math.max(1, Math.round(vp.size.h * escala));
  const tela = profundidades(cena, camera, W, H);
  {
    let fn = 0;
    let fx0 = W, fx1 = 0, fy0 = H, fy1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (Number.isFinite(tela.z[y * W + x])) { fn++; if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; if (y < fy0) fy0 = y; if (y > fy1) fy1 = y; }
    console.log('zbuf ' + JSON.stringify({ fn, fx0, fx1, fy0, fy1, W, H }));
  }

  const diag = cena.box.getSize(new THREE.Vector3()).length();
  const bias = Math.max(0.002, diag * 1e-5);
  const epsPerto = nearDe(camera) * 1.02;
  const view = camera.matrixWorldInverse;
  const near = nearDe(camera);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const q = new THREE.Vector3();

  /** Visível: o z-buffer não tem superfície mais perto que o ponto (com folga de `bias`). */
  const visivel = (pp: { x: number; y: number; d: number }): boolean => {
    const x = Math.floor(((pp.x - vp.at.x) / vp.size.w) * W);
    // O papel tem y para cima e o z-buffer tem y para baixo: a linha é a inversa da coluna.
    const y = Math.floor((1 - (pp.y - vp.at.y) / vp.size.h) * H);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const z = tela.z[y * W + x]!;
    return !Number.isFinite(z) || pp.d <= z + bias;
  };

  const edges = cena.edges;
  const perspectiva = camera instanceof THREE.PerspectiveCamera;
  const far = camera.far;
  const clip4 = new THREE.Vector4();
  const pa = { x: 0, y: 0, d: 0 };
  const pb = { x: 0, y: 0, d: 0 };
  const amostra = { x: 0, y: 0, d: 0 };
  const p0 = { x: 0, y: 0, d: 0 };
  const p1 = { x: 0, y: 0, d: 0 };
  const vv = new THREE.Vector3();

  for (let i = 0; i + 5 < edges.length; i += 6) {
    a.set(edges[i]!, edges[i + 1]!, edges[i + 2]!);
    b.set(edges[i + 3]!, edges[i + 4]!, edges[i + 5]!);
    // Profundidade no espaço da câmera (positiva à frente).
    vv.copy(a).applyMatrix4(view);
    const da = -vv.z;
    vv.copy(b).applyMatrix4(view);
    const db = -vv.z;
    if (da < epsPerto && db < epsPerto) continue;
    if (da < epsPerto) {
      // `a` atrás do plano próximo: corta no ponto onde a profundidade é `epsPerto`.
      a.lerp(b, (epsPerto - da) / (db - da));
    } else if (db < epsPerto) {
      const s = (epsPerto - da) / (db - da);
      b.lerp(a, 1 - s);
    }
    paraPapel(a, viewProj, vp, perspectiva, near, far, clip4, pa);
    paraPapel(b, viewProj, vp, perspectiva, near, far, clip4, pb);
    if (!Number.isFinite(pa.x) || !Number.isFinite(pb.x)) continue;
    const clip = recortaSegmento(pa, pb, vp);
    if (!clip) continue;

    const amostraVis = (t: number): boolean => {
      q.lerpVectors(a, b, t);
      paraPapel(q, viewProj, vp, perspectiva, near, far, clip4, amostra);
      return visivel(amostra);
    };
    const emitir = (r0: { x: number; y: number }, r1: { x: number; y: number }): void => {
      if (Math.hypot(r1.x - r0.x, r1.y - r0.y) > 0.01) {
        out.paths.push({ pts: [{ x: r0.x, y: r0.y }, { x: r1.x, y: r1.y }], closed: false, widthMm: TRACO_MM, color: TINTA });
      }
    };

    // Aresta menor que meio pixel no papel não aparece: nem entra no teste de visibilidade (há muitas em superfícies
    // trianguladas e em camadas finas).
    const comprimentoPx = Math.hypot(((clip.b.x - clip.a.x) / vp.size.w) * W, ((clip.b.y - clip.a.y) / vp.size.h) * H);
    if (comprimentoPx < 0.75) continue;

    // Pré-teste grosso: a maioria das arestas é toda visível ou toda oculta. Só as mistas pagam a amostragem fina.
    const passos = comprimentoPx > 30 ? 4 : 2;
    let todas = true;
    let nenhuma = true;
    for (let k = 0; k <= passos; k++) {
      const v = amostraVis(k / passos);
      if (v) nenhuma = false;
      else todas = false;
    }
    if (nenhuma) continue;
    if (todas) {
      emitir(clip.a, clip.b);
      continue;
    }

    // Mistura: amostragem uniforme no z-buffer e união das corridas visíveis. Um único ponto oculto entre dois
    // visíveis é ruído do rasterizador, não buraco; uma ponte de 2 pontos já é oclusão de verdade.
    const n = Math.max(1, Math.min(3072, Math.ceil(comprimentoPx / PASSO_PX)));
    const vis: boolean[] = [];
    for (let k = 0; k <= n; k++) vis.push(amostraVis(k / n));
    let k = 0;
    while (k <= n) {
      if (!vis[k]) {
        k++;
        continue;
      }
      let fim = k;
      while (fim + 1 <= n) {
        if (vis[fim + 1]) fim++;
        else if (fim + 2 <= n && vis[fim + 2]) fim += 2; // ponte de um pixel
        else break;
      }
      q.lerpVectors(a, b, k / n);
      paraPapel(q, viewProj, vp, perspectiva, near, far, clip4, p0);
      q.lerpVectors(a, b, fim / n);
      paraPapel(q, viewProj, vp, perspectiva, near, far, clip4, p1);
      const rc = recortaSegmento(p0, p1, vp);
      if (rc) emitir(rc.a, rc.b);
      k = fim + 1;
    }
  }
  return out;
}
