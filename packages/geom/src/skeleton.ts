import { type Vec2 } from './vec.ts';
import { ringArea } from './polygon.ts';
import { SkeletonFail } from './skeletonCore.ts';
import { setup } from './skeletonSetup.ts';
import { runSim } from './skeletonRun.ts';
import { buildOutput } from './skeletonFaces.ts';

export interface SkeletonInput {
  outer: Vec2[];            // anel externo, sentido qualquer, sem repetir o 1º ponto
  holes: Vec2[][];          // anéis internos (claraboias/shafts), sentido qualquer
  /** Peso (razão de subida = inclinação/100) de cada aresta: weights[0] = arestas de outer (aresta i vai de outer[i] a outer[i+1]); weights[k+1] = arestas de holes[k]. Peso 0 = aresta que NÃO define inclinação (empena vertical). */
  weights: number[][];
}
export interface SkeletonFace {
  ring: number;             // 0 = externo, k+1 = furo k
  edge: number;             // índice da aresta no anel
  polygon: Vec2[];          // região em planta dessa água (anel simples, anti-horário)
  z: number[];              // altura (tempo) em cada vértice de polygon, na mesma ordem; z = peso × distância à reta da aresta
}
export interface SkeletonArc {
  a: Vec2; b: Vec2; za: number; zb: number;   // segmento do esqueleto (cumeeira/espigão/rincão) com as alturas nas pontas
  faces: [number, number];  // índices (em `faces`) das duas águas que ele separa
}
export interface SkeletonResult { faces: SkeletonFace[]; arcs: SkeletonArc[]; ok: boolean; reason?: string }

/**
 * Esqueleto reto com pesos de um polígono simples com furos.
 * Nunca lança exceção: entrada inválida ou falha de topologia vira { ok: false, reason }.
 */
export function weightedSkeleton(input: SkeletonInput): SkeletonResult {
  try {
    const { sim, leaders } = setup(input);
    runSim(sim);
    const out = buildOutput(sim, leaders);
    if (out.faces.length === 0) throw new SkeletonFail('nenhuma água gerada');
    // Pesos 0 são paredes verticais (sem área). Logo a soma das águas tem de ser a área líquida;
    // se não for, a topologia saiu errada e o resultado não pode ser entregue como válido.
    const net = Math.abs(ringArea(input.outer)) - input.holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
    const sum = out.faces.reduce((s, f) => s + Math.abs(ringArea(f.polygon)), 0);
    if (Math.abs(sum - net) > 1e-6 * Math.max(net, 1)) {
      throw new SkeletonFail('caso não suportado: a soma das águas não confere com a área do polígono');
    }
    return { faces: out.faces, arcs: out.arcs, ok: true };
  } catch (e) {
    const reason =
      e instanceof SkeletonFail ? e.message : `falha interna do esqueleto: ${e instanceof Error ? e.message : String(e)}`;
    return { faces: [], arcs: [], ok: false, reason };
  }
}
