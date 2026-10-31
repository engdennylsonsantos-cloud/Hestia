import * as THREE from 'three';
import { cameraDaVista3D, sheetView3DCameraIssue, view3dOf, type Project, type SheetViewport } from '@hestia/model';
import { resolveLevel } from '@hestia/engine';
import { aplicarCameraNaOrbita, OrbitCamera } from '../model3d/orbit.ts';
import { buildTriBvh, raycastTriBvh, type TriBvh } from '../model3d/triBvh.ts';
import { ModelScene, type VetoresDaCena } from '../model3d/scene3d.ts';
import { emptyParts, type ViewportParts } from './types.ts';

/**
 * Vista 3D vetorial na prancha (decisão 0040). Usa a MESMA montagem da aba 3D (`ModelScene`) e a MESMA câmera
 * (`OrbitCamera`); o que esta etapa acrescenta é só o que a GPU fazia sozinha e o papel não tem: projetar as arestas,
 * decidir quais estão visíveis (linhas ocultas) e recortar no quadro. Nenhuma geometria é recriada: os triângulos e as
 * arestas vêm de `ModelScene.exportarVetores()`, que lê o grupo do modelo que a GPU desenha.
 *
 * A visibilidade é testada por raio contra o BVH da mesma cena (do ponto para a câmera): é o equivalente exato do teste
 * de profundidade da GPU nos pontos amostrados, sem depender de um z-buffer em CPU e da sua interpolação.
 */

/** Passo de amostragem das arestas no papel, em mm (a saída continua vetorial: isto só decide a visibilidade). */
const PASSO_MM = 0.35;
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
 */
const cenas = new WeakMap<Project, CenaVetorial | null>();

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
  const out = prepararCena(
    construirVetores(p) ?? { trianglePositions: new Float32Array(), triangleIndices: new Uint32Array(), edges: new Float32Array(), box: new THREE.Box3() },
  );
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

/** Ponto do mundo em mm de papel (y para cima no papel). */
function paraPapel(
  p: THREE.Vector3,
  viewProj: THREE.Matrix4,
  vp: SheetViewport,
  clip: THREE.Vector4,
  out: { x: number; y: number },
): void {
  clip.set(p.x, p.y, p.z, 1).applyMatrix4(viewProj);
  const inv = 1 / clip.w;
  out.x = vp.at.x + (clip.x * inv * 0.5 + 0.5) * vp.size.w;
  out.y = vp.at.y + (clip.y * inv * 0.5 + 0.5) * vp.size.h;
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

  const perspectiva = camera instanceof THREE.PerspectiveCamera;
  const near = camera.near;
  const epsPerto = near * 1.02;
  const view = camera.matrixWorldInverse;
  const diag = cena.box.getSize(new THREE.Vector3()).length();
  const bias = Math.max(0.002, diag * 1e-5);
  const raioMax = diag * 3 + 10;

  // Direções do teste de visibilidade: perspectiva = do ponto para a câmera; ortogonal = -frente da câmera.
  const dirCamera = new THREE.Vector3();
  camera.getWorldDirection(dirCamera);
  const dirParaCamera = dirCamera.clone().negate();
  const camPos = camera.position.clone();
  const raio = new THREE.Ray();
  const dir = new THREE.Vector3();

  const visivel3D = (p: THREE.Vector3): boolean => {
    if (perspectiva) {
      dir.copy(camPos).sub(p);
      const dist = dir.length();
      if (dist <= bias * 2) return false;
      dir.multiplyScalar(1 / dist);
      raio.origin.copy(p).addScaledVector(dir, bias);
      raio.direction.copy(dir);
      return raycastTriBvh(cena.bvh, raio, Math.max(0, dist - 2 * bias), THREE.DoubleSide) === null;
    }
    raio.origin.copy(p).addScaledVector(dirParaCamera, bias);
    raio.direction.copy(dirParaCamera);
    return raycastTriBvh(cena.bvh, raio, raioMax, THREE.DoubleSide) === null;
  };

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const q = new THREE.Vector3();
  const clip4 = new THREE.Vector4();
  const pa = { x: 0, y: 0 };
  const pb = { x: 0, y: 0 };
  const p0 = { x: 0, y: 0 };
  const p1 = { x: 0, y: 0 };
  const vv = new THREE.Vector3();

  const edges = cena.edges;
  for (let i = 0; i + 5 < edges.length; i += 6) {
    a.set(edges[i]!, edges[i + 1]!, edges[i + 2]!);
    b.set(edges[i + 3]!, edges[i + 4]!, edges[i + 5]!);
    // Corta o segmento no plano próximo (atrás da câmera não projeta).
    vv.copy(a).applyMatrix4(view);
    const da = -vv.z;
    vv.copy(b).applyMatrix4(view);
    const db = -vv.z;
    if (da < epsPerto && db < epsPerto) continue;
    if (da < epsPerto) {
      a.lerp(b, (epsPerto - da) / (db - da));
    } else if (db < epsPerto) {
      const s = (epsPerto - da) / (db - da);
      b.lerp(a, 1 - s);
    }
    paraPapel(a, viewProj, vp, clip4, pa);
    paraPapel(b, viewProj, vp, clip4, pb);
    if (!Number.isFinite(pa.x) || !Number.isFinite(pb.x)) continue;
    const clip = recortaSegmento(pa, pb, vp);
    if (!clip) continue;

    const comprimentoMm = Math.hypot(clip.b.x - clip.a.x, clip.b.y - clip.a.y);
    if (comprimentoMm < 0.05) continue;
    const visivelEm = (t: number): boolean => {
      q.lerpVectors(a, b, t);
      return visivel3D(q);
    };
    const emitir = (r0: { x: number; y: number }, r1: { x: number; y: number }): void => {
      if (Math.hypot(r1.x - r0.x, r1.y - r0.y) > 0.01) {
        out.paths.push({ pts: [{ x: r0.x, y: r0.y }, { x: r1.x, y: r1.y }], closed: false, widthMm: TRACO_MM, color: TINTA });
      }
    };

    // Pré-teste grosso: a maioria das arestas é toda visível ou toda oculta. Só as mistas pagam a amostragem fina.
    const passos = comprimentoMm > 15 ? 4 : 2;
    let todas = true;
    let nenhuma = true;
    for (let k = 0; k <= passos; k++) {
      const v = visivelEm(k / passos);
      if (v) nenhuma = false;
      else todas = false;
    }
    if (nenhuma) continue;
    if (todas) {
      emitir(clip.a, clip.b);
      continue;
    }

    // Mistura: amostragem uniforme no papel e união das corridas visíveis. Um único ponto oculto entre dois visíveis é
    // ruído do teste, não buraco; uma ponte de 2 pontos já é oclusão de verdade.
    const n = Math.max(1, Math.min(2048, Math.ceil(comprimentoMm / PASSO_MM)));
    const vis: boolean[] = [];
    for (let k = 0; k <= n; k++) vis.push(visivelEm(k / n));
    let k = 0;
    while (k <= n) {
      if (!vis[k]) {
        k++;
        continue;
      }
      let fim = k;
      while (fim + 1 <= n) {
        if (vis[fim + 1]) fim++;
        else if (fim + 2 <= n && vis[fim + 2]) fim += 2; // ponte de um ponto
        else break;
      }
      q.lerpVectors(a, b, k / n);
      paraPapel(q, viewProj, vp, clip4, p0);
      q.lerpVectors(a, b, fim / n);
      paraPapel(q, viewProj, vp, clip4, p1);
      const rc = recortaSegmento(p0, p1, vp);
      if (rc) emitir(rc.a, rc.b);
      k = fim + 1;
    }
  }
  return out;
}
