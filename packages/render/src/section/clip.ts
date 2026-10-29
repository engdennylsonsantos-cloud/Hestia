import * as THREE from 'three';
import type { SectionLine } from '@hestia/engine';
import type { ViewRange } from '@hestia/model';

/**
 * Recorte por plano na GPU (R4, Fase 2.5).
 *
 * Um plano de recorte do three.js mantém o lado em que `dot(normal, p) + constante >= 0`. Aqui os planos nascem da
 * semântica do BIM, sem gerar geometria:
 *
 * - **Desenho do corte/elevação (2D, x = t ao longo da linha, y = cota):** a região de recorte vira quatro planos e o
 *   intervalo de vista vira dois; o desenho inteiro fica na cena e o shader recorta. Trocar a região só reescreve os
 *   valores dos planos (ver `RecorteGpu`).
 * - **Modelo (3D, x/y/z):** a linha do corte vira o plano do observador + o plano de profundidade; a section box vira
 *   seis planos. A geometria do modelo permanece: quem recorta é o material.
 *
 * Quem chama precisa ligar `renderer.localClippingEnabled` (ver `habilitarRecorteLocal`).
 */

/** Retângulo de recorte em (t, z): ao longo da linha e em cota (m). */
export interface RecorteDoDesenho {
  tMin: number;
  tMax: number;
  zMin: number;
  zMax: number;
}

/** Recorte do desenho de uma vista de corte/elevação. */
export interface RecorteDaVista {
  /** Região de recorte em (t, z); ausente = sem recorte lateral. */
  crop?: RecorteDoDesenho;
  /** Intervalo de vista do nível (topo/corte/base/profundidade), em cotas relativas ao nível. */
  viewRange?: Pick<ViewRange, 'top' | 'bottom'>;
  /** Cota do nível dono do intervalo de vista (m). Padrão 0. */
  elevacao?: number;
}

/** Plano normalizado (normal unitária), como o `THREE.Plane` do recorte. */
function plano(nx: number, ny: number, nz: number, constante: number): THREE.Plane {
  const n = new THREE.Vector3(nx, ny, nz);
  const tam = n.length();
  if (!(tam > 0)) return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  n.multiplyScalar(1 / tam);
  return new THREE.Plane(n, constante / tam);
}

// ---- desenho do corte/elevação (2D: x = t, y = cota) ----

/** Mantém `x >= min`. */
export const planoXMin = (min: number): THREE.Plane => plano(1, 0, 0, -min);
/** Mantém `x <= max`. */
export const planoXMax = (max: number): THREE.Plane => plano(-1, 0, 0, max);
/** Mantém `y >= min`. */
export const planoYMin = (min: number): THREE.Plane => plano(0, 1, 0, -min);
/** Mantém `y <= max`. */
export const planoYMax = (max: number): THREE.Plane => plano(0, -1, 0, max);

/** Quatro planos do retângulo de recorte (t, z) do desenho do corte/elevação. */
export function planosDoRecorte(r: RecorteDoDesenho): THREE.Plane[] {
  return [planoXMin(r.tMin), planoXMax(r.tMax), planoYMin(r.zMin), planoYMax(r.zMax)];
}

/** Dois planos do intervalo de vista (base e topo) no desenho, em cotas absolutas. */
export function planosDoIntervaloDeVista(range: Pick<ViewRange, 'top' | 'bottom'>, elevacao = 0): THREE.Plane[] {
  return [planoYMin(elevacao + range.bottom), planoYMax(elevacao + range.top)];
}

/**
 * Planos do recorte do desenho da vista (crop + intervalo de vista). Sem nada, devolve lista vazia: o chamador não liga
 * o recorte e a imagem é a de sempre.
 */
export function planosDaVista(r: RecorteDaVista): THREE.Plane[] {
  const out: THREE.Plane[] = [];
  if (r.crop) out.push(...planosDoRecorte(r.crop));
  if (r.viewRange) out.push(...planosDoIntervaloDeVista(r.viewRange, r.elevacao ?? 0));
  return out;
}

// ---- modelo 3D (x/y/z) ----

/**
 * Planos do corte/elevação no espaço do modelo: o plano da linha (o que o observador enxerga), o da profundidade da
 * vista e as duas extremidades da linha. A geometria do modelo fica inteira; quem recorta são estes planos.
 *
 * Convenção do motor (`sectionFrame`): `d` é a direção da linha, `n` a normal à esquerda; o que aparece está do lado de
 * `n`, até `depth` metros.
 */
export function planosDoCorte(line: SectionLine): THREE.Plane[] {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const comprimento = Math.hypot(dx, dy) || 1;
  const d = { x: dx / comprimento, y: dy / comprimento };
  const n = { x: -d.y, y: d.x };
  const base = n.x * line.a.x + n.y * line.a.y;
  const aoLongo = d.x * line.a.x + d.y * line.a.y;
  return [
    // Perto do observador: `dist = (p - a)·n >= 0`.
    plano(n.x, n.y, 0, -base),
    // Fundo da vista: `dist <= depth`.
    plano(-n.x, -n.y, 0, base + line.depth),
    // Extremidades: `0 <= t <= comprimento` (a vista não desenha além das pontas).
    plano(d.x, d.y, 0, -aoLongo),
    plano(-d.x, -d.y, 0, aoLongo + comprimento),
  ];
}

/** Seis planos de uma caixa do modelo (section box): mantém o que está dentro. */
export function planosDaCaixa(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }): THREE.Plane[] {
  return [plano(1, 0, 0, -min.x), plano(-1, 0, 0, max.x), plano(0, 1, 0, -min.y), plano(0, -1, 0, max.y), plano(0, 0, 1, -min.z), plano(0, 0, -1, max.z)];
}

/** Planos do intervalo de vista do nível no modelo 3D (base e topo em z absoluto). */
export function planosDoIntervaloNoModelo(range: Pick<ViewRange, 'top' | 'bottom'>, elevacao = 0): THREE.Plane[] {
  return [plano(0, 0, 1, -(elevacao + range.bottom)), plano(0, 0, -1, elevacao + range.top)];
}

// ---- aplicação na cena ----

/** Liga o recorte por material no renderer (o three só aplica `clippingPlanes` com isto ligado). Devolve o valor anterior. */
export function habilitarRecorteLocal(renderer: { localClippingEnabled: boolean }, ligado = true): boolean {
  const antes = renderer.localClippingEnabled;
  renderer.localClippingEnabled = ligado;
  return antes;
}

export interface RecorteAplicado {
  /** Materiais distintos que receberam os planos. */
  materiais: number;
  /** Devolve os planos anteriores de cada material (e desliga o recorte se não havia nenhum). */
  restaurar(): void;
}

/**
 * Aplica os planos a todos os materiais de uma cena/objeto. Materiais compartilhados entram uma vez. A lista é a mesma
 * para todos: para mudar o recorte sem recompilar shader, use `RecorteGpu.atualizar`.
 */
export function aplicarPlanosDeRecorte(raiz: THREE.Object3D, planos: readonly THREE.Plane[]): RecorteAplicado {
  const anteriores = new Map<THREE.Material, THREE.Plane[] | null>();
  raiz.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) {
      if (anteriores.has(mat)) continue;
      anteriores.set(mat, mat.clippingPlanes ? [...mat.clippingPlanes] : null);
      mat.clippingPlanes = planos as THREE.Plane[];
      mat.clipShadows = true;
      mat.needsUpdate = true;
    }
  });
  return {
    materiais: anteriores.size,
    restaurar() {
      for (const [mat, antes] of anteriores) {
        mat.clippingPlanes = antes;
        mat.needsUpdate = true;
      }
      anteriores.clear();
    },
  };
}

/**
 * Recorte de uma cena com planos vivos: a lista de planos é a mesma entre quadros, então trocar a região (pan/zoom,
 * crop novo) só reescreve `normal`/`constante` — nenhum material é recompilado, nenhuma geometria é refeita.
 */
export class RecorteGpu {
  private planos: THREE.Plane[] = [];
  private aplicado: RecorteAplicado | null = null;
  private raiz: THREE.Object3D | null = null;

  /** Quantos planos estão ativos (0 = sem recorte). */
  get quantidade(): number {
    return this.planos.length;
  }

  /** Materiais que receberam o recorte no último `aplicar`. */
  get materiais(): number {
    return this.aplicado?.materiais ?? 0;
  }

  /** Cena recortada (null sem recorte). */
  get cena(): THREE.Object3D | null {
    return this.raiz;
  }

  /** Aplica os planos numa cena; para atualizar depois, a lista aplicada é reaproveitada. */
  aplicar(raiz: THREE.Object3D, planos: readonly THREE.Plane[]): void {
    this.restaurar();
    this.raiz = raiz;
    this.planos = planos.map((p) => p.clone());
    this.aplicado = this.planos.length > 0 ? aplicarPlanosDeRecorte(raiz, this.planos) : null;
  }

  /**
   * Troca os planos sem recompilar os materiais: a lista aplicada é a mesma e só os valores mudam. Serve para o recorte
   * acompanhar a vista/zoom. Devolve `false` se ainda não há recorte aplicado ou se a quantidade de planos mudou (aí é
   * preciso `aplicar` de novo).
   */
  atualizar(planos: readonly THREE.Plane[]): boolean {
    if (this.aplicado === null || planos.length !== this.planos.length) return false;
    for (let i = 0; i < planos.length; i++) {
      this.planos[i]!.normal.copy(planos[i]!.normal);
      this.planos[i]!.constant = planos[i]!.constant;
    }
    return true;
  }

  restaurar(): void {
    this.aplicado?.restaurar();
    this.aplicado = null;
    this.planos = [];
    this.raiz = null;
  }
}

/** Ponto do modelo para uma coordenada (t, z) do desenho do corte (para testar e converter o recorte). */
export function pontoDoDesenho(line: SectionLine, t: number, z: number): { x: number; y: number; z: number } {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const comprimento = Math.hypot(dx, dy) || 1;
  return { x: line.a.x + (dx / comprimento) * t, y: line.a.y + (dy / comprimento) * t, z };
}
