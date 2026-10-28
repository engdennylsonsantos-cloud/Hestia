import * as THREE from 'three';
import type { Id } from '@hestia/model';
import type { ElementRange } from './solids.ts';

/**
 * Índice de elementos da cena 3D no nível do **intervalo do índice** (não do triângulo): é o que o realce, a caixa da
 * seleção e o ID buffer precisam para achar um elemento sem varrer todas as faixas nem copiar triângulos.
 *
 * O índice propriamente dito é derivado da lista `userData.ranges` de cada malha e fica em cache em `WeakMap`: quando a
 * cena troca a lista (edição, remontagem de nível), a entrada antiga sai com ela. As medidas por intervalo (caixa) seguem
 * `geometry.userData.versao`, o mesmo contador de versão que o R1 usa para invalidar o BVH do picking.
 */

/** Intervalo contíguo do índice — uma chamada de desenho. */
export interface Intervalo {
  start: number;
  count: number;
}

const mapasDeFaixas = new WeakMap<ElementRange[], Map<Id, ElementRange[]>>();

/** Faixas da malha agrupadas por id (uma vez por lista de faixas). */
export function mapaDaMalha(faixas: ElementRange[]): Map<Id, ElementRange[]> {
  let m = mapasDeFaixas.get(faixas);
  if (m) return m;
  m = new Map();
  for (const r of faixas) {
    const atual = m.get(r.id);
    if (atual) atual.push(r);
    else m.set(r.id, [r]);
  }
  mapasDeFaixas.set(faixas, m);
  return m;
}

/**
 * Faixas dos ids pedidos dentro de uma malha. Varre a lista menor: os ids pedidos (com o índice por id) quando são
 * poucos — o caso do hover — ou as faixas da malha quando a seleção é grande. Nunca varre o projeto inteiro por id.
 */
export function faixasDosIds(faixas: ElementRange[], queridos: ReadonlySet<Id>): ElementRange[] {
  const out: ElementRange[] = [];
  if (queridos.size <= faixas.length) {
    const porId = mapaDaMalha(faixas);
    for (const id of queridos) {
      const rs = porId.get(id);
      if (rs) for (const r of rs) out.push(r);
    }
  } else {
    for (const r of faixas) if (queridos.has(r.id)) out.push(r);
  }
  return out;
}

/** Faixas ordenadas e fundidas em intervalos contíguos: as paredes seguidas de um lote global viram um intervalo só. */
export function intervalosDeDesenho(faixas: readonly ElementRange[]): Intervalo[] {
  const ordenadas = [...faixas].sort((a, b) => a.start - b.start);
  const out: Intervalo[] = [];
  for (const r of ordenadas) {
    const ultimo = out[out.length - 1];
    if (ultimo && r.start <= ultimo.start + ultimo.count) {
      ultimo.count = Math.max(ultimo.count, r.start + r.count - ultimo.start);
    } else out.push({ start: r.start, count: r.count });
  }
  return out;
}

interface CacheDeCaixas {
  versao: number;
  intervalos: Map<string, THREE.Box3>;
}

const cacheDasCaixas = new WeakMap<THREE.BufferGeometry, CacheDeCaixas>();

/**
 * Caixa do intervalo do índice no espaço **local** da malha, em cache por versão da geometria. Só as posições dos
 * vértices do intervalo entram: o resultado é o mesmo de varrer os triângulos do elemento, sem repetir a varredura a cada
 * clique. A caixa devolvida é **do cache**: quem chama não pode alterá-la (use `union`/`clone`).
 */
export function caixaDoIntervalo(geo: THREE.BufferGeometry, index: THREE.BufferAttribute, start: number, count: number): THREE.Box3 {
  const versao = Number(geo.userData.versao ?? 0);
  let cache = cacheDasCaixas.get(geo);
  if (!cache || cache.versao !== versao) {
    cache = { versao, intervalos: new Map() };
    cacheDasCaixas.set(geo, cache);
  }
  const chave = `${start}:${count}`;
  const guardada = cache.intervalos.get(chave);
  if (guardada) return guardada;
  const caixa = new THREE.Box3();
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (pos) {
    const v = new THREE.Vector3();
    for (let k = start; k < start + count; k++) caixa.expandByPoint(v.fromBufferAttribute(pos, index.getX(k)));
  }
  cache.intervalos.set(chave, caixa);
  return caixa;
}

/**
 * Caixa do intervalo no mundo. Com a matriz identidade (o caso dos lotes globais e das malhas de picking, que já têm as
 * posições no mundo) a caixa local é exata; com transformação, os 8 cantos dela são levados ao mundo — o mesmo caminho do
 * `Box3.expandByObject`, sem varrer vértice a vértice. `null` quando o intervalo não tem vértices.
 */
export function caixaDoIntervaloNoMundo(geo: THREE.BufferGeometry, index: THREE.BufferAttribute, start: number, count: number, matriz: THREE.Matrix4): THREE.Box3 | null {
  const local = caixaDoIntervalo(geo, index, start, count);
  if (local.isEmpty()) return null;
  if (matriz.equals(IDENTIDADE)) return local;
  return local.clone().applyMatrix4(matriz);
}

const IDENTIDADE = new THREE.Matrix4();
