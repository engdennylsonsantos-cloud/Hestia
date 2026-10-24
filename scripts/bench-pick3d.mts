/**
 * Medição do picking 3D (frente C): custo de `pickModelPoint`, `firstSurfaceDistance` e `pickElement` num modelo sintético
 * de vários pavimentos, com paredes em malhas (uma malha por pavimento, uma faixa por parede, como o `ModelScene`).
 *
 * Por pavimento há 300 paredes (30 × 10), cada uma com 12 triângulos. O modelo tem 10 e 20 pavimentos (3.600 e 7.200
 * paredes). Mede-se, por tamanho:
 *   - construção: soma do `buildTriBvh` de todas as malhas (mediana de cenas novas, ou seja, geometrias sem cache);
 *   - fria: primeira chamada de cada função numa cena nova (inclui a construção dos BVHs, quando há);
 *   - quente: chamada depois do aquecimento, mediana por chamada (entradas variadas em rodízio).
 * A soma de verificação (checksum) das saídas deve ser igual antes e depois de qualquer mudança no picking.
 *
 * Método: 7 cenas frias por tamanho; 5 chamadas de aquecimento; `BENCH_RUNS` medidas quentes (padrão 64) por função.
 * Uso: ../../../node_modules/.bin/vite-node scripts/bench-pick3d.mts   (a partir do worktree; ver relatório)
 */
import { performance } from 'node:perf_hooks';
import * as THREE from 'three';
import { buildTriBvh } from '../packages/render/src/model3d/triBvh.ts';
import { firstSurfaceDistance, pickElement, pickModelPoint } from '../packages/render/src/model3d/pick3d.ts';

const RUNS = Number(process.env.BENCH_RUNS ?? 64);
const COLD = 7;
const WARM = 5;
const COLS = 30;
const ROWS = 10;

/** Gerador pseudoaleatório determinístico (mulberry32), para as entradas serem iguais entre execuções. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Um pavimento: 300 paredes de 1 × 0,2 × 2,8 m numa malha só, com uma faixa por parede (`userData.ranges`). */
function pavimento(z: number): THREE.Mesh {
  const box = new THREE.BoxGeometry(1, 0.2, 2.8);
  const bp = box.getAttribute('position');
  const bi = box.getIndex()!;
  const n = COLS * ROWS;
  const pos = new Float32Array(n * bp.count * 3);
  const idx = new Uint32Array(n * bi.count);
  const ranges: Array<{ id: string; start: number; count: number }> = [];
  for (let w = 0; w < n; w++) {
    const ox = (w % COLS) * 1.5;
    const oy = Math.floor(w / COLS) * 3;
    const base = w * bp.count;
    for (let i = 0; i < bp.count; i++) {
      pos[(base + i) * 3] = bp.getX(i) + ox;
      pos[(base + i) * 3 + 1] = bp.getY(i) + oy;
      pos[(base + i) * 3 + 2] = bp.getZ(i) + 1.4;
    }
    const start = w * bi.count;
    for (let i = 0; i < bi.count; i++) idx[start + i] = base + bi.getX(i);
    ranges.push({ id: `w${w}`, start, count: bi.count });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.FrontSide }));
  mesh.userData = { kind: 'wall', ranges };
  mesh.position.z = z;
  return mesh;
}

/** Modelo com `andares` pavimentos de 3 m, mais o chão (400 m) e um conjunto de linhas, como a cena real. */
function modelo(andares: number): { root: THREE.Group; floors: THREE.Mesh[] } {
  const root = new THREE.Group();
  const floors: THREE.Mesh[] = [];
  for (let f = 0; f < andares; f++) {
    const m = pavimento(f * 3);
    floors.push(m);
    root.add(m);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial());
  ground.position.z = -0.03;
  root.add(ground);
  root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-5, 3, 1), new THREE.Vector3(60, 3, 1)])));
  return { root, floors };
}

/** Câmera oblíqua sobre o prédio (de frente e de cima). */
function camera(andares: number): THREE.PerspectiveCamera {
  const h = andares * 3;
  const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  cam.position.set(22, -70, 0.6 * h + 20);
  cam.up.set(0, 0, 1);
  cam.lookAt(22, 15, 0.3 * h);
  cam.updateMatrixWorld();
  return cam;
}

/** Entradas fixas: pontos da tela (NDC) e raios (origem dentro do prédio, direção aleatória). */
function entradas(andares: number) {
  const r = rng(20261024);
  const ndc: Array<{ x: number; y: number }> = [];
  // Grade sobre o miolo da tela (o prédio ocupa o centro): parte dos pontos cai no modelo, o resto no vazio.
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) ndc.push({ x: -0.6 + (1.2 * i) / 15, y: -0.6 + (1.2 * j) / 15 });
  const rays: Array<{ o: THREE.Vector3; d: THREE.Vector3 }> = [];
  for (let i = 0; i < 256; i++) {
    const o = new THREE.Vector3(r() * 45, r() * 30, r() * 3 * andares);
    const d = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    rays.push({ o, d });
  }
  return { ndc, rays };
}

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1]!;
};

interface Medida {
  construcao: number;
  fria: { ponto: number; distancia: number; elemento: number };
  quente: { ponto: number; distancia: number; elemento: number };
  checksum: number;
  acertos: { ponto: number; distancia: number; elemento: number };
}

function medir(andares: number): Medida {
  const construcao: number[] = [];
  const fria = { ponto: [] as number[], distancia: [] as number[], elemento: [] as number[] };
  for (let c = 0; c < COLD; c++) {
    const { root, floors } = modelo(andares);
    const cam = camera(andares);
    const { ndc, rays } = entradas(andares);
    root.updateMatrixWorld(true);
    let t0 = performance.now();
    for (const m of floors) buildTriBvh(m.geometry.getAttribute('position').array, m.geometry.getIndex()!.array);
    construcao.push(performance.now() - t0);

    // Primeira chamada numa geometria nova (com a construção do BVH, se a função a usa).
    const { root: r2, floors: f2 } = modelo(andares);
    const cam2 = camera(andares);
    r2.updateMatrixWorld(true);
    void f2;
    t0 = performance.now();
    pickModelPoint(r2, cam2, ndc[0]!);
    fria.ponto.push(performance.now() - t0);
    const r3 = modelo(andares).root;
    r3.updateMatrixWorld(true);
    t0 = performance.now();
    firstSurfaceDistance(r3, rays[0]!.o, rays[0]!.d);
    fria.distancia.push(performance.now() - t0);
    const r4 = modelo(andares).root;
    r4.updateMatrixWorld(true);
    t0 = performance.now();
    pickElement(r4, cam, ndc[0]!);
    fria.elemento.push(performance.now() - t0);
  }

  // Quente: mesma cena, depois do aquecimento; cada chamada com entrada diferente.
  const { root, floors } = modelo(andares);
  void floors;
  const cam = camera(andares);
  const { ndc, rays } = entradas(andares);
  for (let i = 0; i < WARM; i++) {
    pickModelPoint(root, cam, ndc[i]!);
    firstSurfaceDistance(root, rays[i]!.o, rays[i]!.d);
    pickElement(root, cam, ndc[i]!);
  }
  const tp: number[] = [];
  const td: number[] = [];
  const te: number[] = [];
  let checksum = 0;
  const acertos = { ponto: 0, distancia: 0, elemento: 0 };
  for (let i = 0; i < RUNS; i++) {
    const k = i % ndc.length;
    const j = i % rays.length;
    let t0 = performance.now();
    const p = pickModelPoint(root, cam, ndc[k]!);
    tp.push(performance.now() - t0);
    t0 = performance.now();
    const d = firstSurfaceDistance(root, rays[j]!.o, rays[j]!.d);
    td.push(performance.now() - t0);
    t0 = performance.now();
    const e = pickElement(root, cam, ndc[k]!);
    te.push(performance.now() - t0);
    if (p) acertos.ponto++;
    if (d !== null) acertos.distancia++;
    if (e) acertos.elemento++;
    checksum += (p ? p.x * 7 + p.y * 13 : 0) + (d ?? 0) * 3 + (e ? e.point.x + e.point.y * 2 + e.point.z * 5 + Number(e.id.slice(1)) : 0);
  }
  return {
    construcao: mediana(construcao),
    fria: { ponto: mediana(fria.ponto), distancia: mediana(fria.distancia), elemento: mediana(fria.elemento) },
    quente: { ponto: mediana(tp), distancia: mediana(td), elemento: mediana(te) },
    checksum: Number(checksum.toFixed(6)),
    acertos,
  };
}

for (const andares of [10, 20]) {
  const m = medir(andares);
  const f = (v: number) => v.toFixed(3);
  console.log(`--- ${andares} pavimentos (${andares * COLS * ROWS} paredes, ${andares * COLS * ROWS * 12} triângulos)`);
  console.log(`construção dos BVHs (ms, mediana de ${COLD}): ${f(m.construcao)}`);
  console.log(`primeira chamada (ms): pickModelPoint ${f(m.fria.ponto)} | firstSurfaceDistance ${f(m.fria.distancia)} | pickElement ${f(m.fria.elemento)}`);
  console.log(`quente (ms, mediana de ${RUNS}): pickModelPoint ${f(m.quente.ponto)} | firstSurfaceDistance ${f(m.quente.distancia)} | pickElement ${f(m.quente.elemento)}`);
  console.log(`acertos (de ${RUNS}): pickModelPoint ${m.acertos.ponto} | firstSurfaceDistance ${m.acertos.distancia} | pickElement ${m.acertos.elemento}`);
  console.log(`checksum: ${m.checksum}`);
}
