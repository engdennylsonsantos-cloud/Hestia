import type { MatrizCaixa } from './caixas3d.ts';

/**
 * Arestas da silhueta de um grupo de caixas (alizar, por exemplo): a união das caixas é um sólido só, então as arestas
 * internas entre caixas encostadas não entram. As caixas podem estar giradas em conjunto (o grupo do vão); o giro comum
 * é retirado para as contas e devolvido no fim.
 */

/** Caixa alinhada aos eixos, em coordenadas locais do grupo. */
export interface CaixaAlinhada {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

const TOL = 1e-9;

/** Valores ordenados sem repetição (tolerância de 1 nm, a mesma das contas de geometria). */
function unicos(valores: number[]): number[] {
  const out: number[] = [];
  for (const v of [...valores].sort((a, b) => a - b)) {
    if (!out.length || Math.abs(v - out[out.length - 1]!) > TOL) out.push(v);
  }
  return out;
}

const perto = (a: number, b: number): boolean => Math.abs(a - b) <= TOL;

/** Chave de um ponto/segmento com arredondamento na tolerância (os vértices vêm da mesma grade de coordenadas). */
const chave = (...v: number[]): string => v.map((x) => Math.round(x / TOL)).join(',');

type Eixo = 0 | 1 | 2;

interface Face {
  eixo: Eixo;
  coord: number;
  /** Normal no eixo (só para separar as duas faces do mesmo plano). */
  lado: 1 | -1;
  /** Cantos no plano, em ordem. */
  cantos: Array<[number, number]>;
}

/** Converte 2D do plano (eixo fixo) para 3D. */
function ponto3d(eixo: Eixo, coord: number, u: number, v: number): [number, number, number] {
  return eixo === 0 ? [coord, u, v] : eixo === 1 ? [u, coord, v] : [u, v, coord];
}

/**
 * Arestas da união de caixas alinhadas aos eixos. Decompõe o espaço na grade de coordenadas das caixas, marca as células
 * ocupadas e fica só com as faces de fronteira; as arestas internas de cada face plana (entre células vizinhas) são
 * canceladas. O resultado são segmentos [x0,y0,z0,x1,y1,z1], já com os segmentos colineares contíguos unidos.
 */
export function arestasDaUniaoDeCaixas(caixas: readonly CaixaAlinhada[]): number[] {
  const validas = caixas.filter((c) => c.x1 - c.x0 > TOL && c.y1 - c.y0 > TOL && c.z1 - c.z0 > TOL);
  if (!validas.length) return [];
  const xs = unicos(validas.flatMap((c) => [c.x0, c.x1]));
  const ys = unicos(validas.flatMap((c) => [c.y0, c.y1]));
  const zs = unicos(validas.flatMap((c) => [c.z0, c.z1]));
  const dentro = (x: number, y: number, z: number): boolean =>
    validas.some((c) => x > c.x0 + TOL && x < c.x1 - TOL && y > c.y0 + TOL && y < c.y1 - TOL && z > c.z0 + TOL && z < c.z1 - TOL);
  const nx = xs.length - 1;
  const ny = ys.length - 1;
  const nz = zs.length - 1;
  const cheia: boolean[] = new Array(nx * ny * nz).fill(false);
  const indice = (i: number, j: number, k: number): number => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        cheia[indice(i, j, k)] = dentro((xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2, (zs[k]! + zs[k + 1]!) / 2);
      }
    }
  }
  const ocupada = (i: number, j: number, k: number): boolean =>
    i >= 0 && i < nx && j >= 0 && j < ny && k >= 0 && k < nz && cheia[indice(i, j, k)]!;

  const faces: Face[] = [];
  const canto = (eixo: Eixo, coord: number, u0: number, u1: number, v0: number, v1: number): Face => ({
    eixo,
    coord,
    lado: 1,
    cantos: [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ],
  });
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        if (!cheia[indice(i, j, k)]) continue;
        const x0 = xs[i]!;
        const x1 = xs[i + 1]!;
        const y0 = ys[j]!;
        const y1 = ys[j + 1]!;
        const z0 = zs[k]!;
        const z1 = zs[k + 1]!;
        if (!ocupada(i - 1, j, k)) faces.push({ ...canto(0, x0, y0, y1, z0, z1), lado: -1 });
        if (!ocupada(i + 1, j, k)) faces.push({ ...canto(0, x1, y0, y1, z0, z1), lado: 1 });
        if (!ocupada(i, j - 1, k)) faces.push({ ...canto(1, y0, x0, x1, z0, z1), lado: -1 });
        if (!ocupada(i, j + 1, k)) faces.push({ ...canto(1, y1, x0, x1, z0, z1), lado: 1 });
        if (!ocupada(i, j, k - 1)) faces.push({ ...canto(2, z0, x0, x1, y0, y1), lado: -1 });
        if (!ocupada(i, j, k + 1)) faces.push({ ...canto(2, z1, x0, x1, y0, y1), lado: 1 });
      }
    }
  }

  // Arestas de cada face plana: as compartilhadas por duas células da mesma face (internas ao plano) são canceladas.
  const porPlano = new Map<string, Map<string, number>>();
  for (const f of faces) {
    const chavePlano = `${f.eixo}|${f.lado}|${chave(f.coord)}`;
    let arestas = porPlano.get(chavePlano);
    if (!arestas) {
      arestas = new Map<string, number>();
      porPlano.set(chavePlano, arestas);
    }
    for (let i = 0; i < f.cantos.length; i++) {
      const a = f.cantos[i]!;
      const b = f.cantos[(i + 1) % f.cantos.length]!;
      const k = chave(Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1]));
      arestas.set(k, (arestas.get(k) ?? 0) + 1);
    }
  }

  const segmentos: Array<[[number, number, number], [number, number, number]]> = [];
  const vistos = new Set<string>();
  const acrescentar = (a: [number, number, number], b: [number, number, number]): void => {
    const k = chave(...a, ...b) < chave(...b, ...a) ? chave(...a, ...b) : chave(...b, ...a);
    if (vistos.has(k)) return;
    vistos.add(k);
    segmentos.push([a, b]);
  };
  for (const [chavePlano, arestas] of porPlano) {
    const [eixoStr, , coordStr] = chavePlano.split('|');
    const eixo = Number(eixoStr) as Eixo;
    const coord = Number(coordStr) * TOL;
    for (const [k, n] of arestas) {
      if (n % 2 === 0) continue;
      const [u0, u1, v0, v1] = k.split(',').map((s) => Number(s) * TOL) as [number, number, number, number];
      // A aresta de uma face é uma das quatro; reconstrói os dois cantos pela menor variação.
      const a: [number, number] = perto(u0, u1) ? [u1, v0] : [u0, v1];
      const b: [number, number] = perto(u0, u1) ? [u1, v1] : [u1, v0];
      acrescentar(ponto3d(eixo, coord, a[0], a[1]), ponto3d(eixo, coord, b[0], b[1]));
    }
  }

  // Segmentos colineares contíguos (a grade parte uma aresta reta em vários trechos) viram um só.
  const porDirecao: Array<Map<string, Array<[number, number]>>> = [new Map(), new Map(), new Map()];
  const direcao = (a: [number, number, number], b: [number, number, number]): Eixo => (perto(a[1], b[1]) && perto(a[2], b[2]) ? 0 : perto(a[0], b[0]) && perto(a[2], b[2]) ? 1 : 2);
  for (const [a, b] of segmentos) {
    const e = direcao(a, b);
    const fixos = e === 0 ? chave(a[1], a[2]) : e === 1 ? chave(a[0], a[2]) : chave(a[0], a[1]);
    const m = porDirecao[e]!;
    let lista = m.get(fixos);
    if (!lista) {
      lista = [];
      m.set(fixos, lista);
    }
    lista.push([a[e]!, b[e]!]);
  }

  const out: number[] = [];
  for (const e of [0, 1, 2] as const) {
    for (const [fixos, intervalos] of porDirecao[e]!) {
      const [f0, f1] = fixos.split(',').map((s) => Number(s) * TOL) as [number, number];
      const ord = intervalos.map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]).sort((x, y) => x[0] - y[0]);
      let atual = ord[0]!;
      const juntar = (): void => {
        // Extremos no sistema 3D: o eixo variável é `e`; os outros dois são as coordenadas fixas do grupo.
        const pa: [number, number, number] = e === 0 ? [atual[0], f0, f1] : e === 1 ? [f0, atual[0], f1] : [f0, f1, atual[0]];
        const pb: [number, number, number] = e === 0 ? [atual[1], f0, f1] : e === 1 ? [f0, atual[1], f1] : [f0, f1, atual[1]];
        out.push(...pa, ...pb);
      };
      for (let i = 1; i < ord.length; i++) {
        const prox = ord[i]!;
        if (prox[0] <= atual[1] + TOL) atual = [atual[0], Math.max(atual[1], prox[1])];
        else {
          juntar();
          atual = prox;
        }
      }
      juntar();
    }
  }
  return out;
}

/** Caixas de um grupo a partir das matrizes da cena (giro comum em torno de z, sem cisalhamento). */
export function arestasDaSilhuetaDeCaixas(matrizes: MatrizCaixa): number[] {
  const n = Math.floor(matrizes.length / 16);
  if (!n) return [];
  const ang = Math.atan2(matrizes[1]!, matrizes[0]!);
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const local: CaixaAlinhada[] = [];
  for (let k = 0; k < n; k++) {
    const o = k * 16;
    const w = Math.hypot(matrizes[o]!, matrizes[o + 1]!);
    const d = Math.hypot(matrizes[o + 4]!, matrizes[o + 5]!);
    const h = Math.hypot(matrizes[o + 8]!, matrizes[o + 9]!, matrizes[o + 10]!);
    const cx = matrizes[o + 12]!;
    const cy = matrizes[o + 13]!;
    const cz = matrizes[o + 14]!;
    const lx = cx * cos + cy * sin;
    const ly = -cx * sin + cy * cos;
    local.push({ x0: lx - w / 2, x1: lx + w / 2, y0: ly - d / 2, y1: ly + d / 2, z0: cz - h / 2, z1: cz + h / 2 });
  }
  const segmentos = arestasDaUniaoDeCaixas(local);
  const out: number[] = [];
  for (let i = 0; i < segmentos.length; i += 3) {
    const x = segmentos[i]!;
    const y = segmentos[i + 1]!;
    out.push(x * cos - y * sin, x * sin + y * cos, segmentos[i + 2]!);
  }
  return out;
}
