/** Diagnóstico temporário do realce (não versionado): nº de objetos por realce e custo do primeiro hover. */
import { performance } from 'node:perf_hooks';
import type { Id } from '@hestia/model';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';
import { ModelScene } from '../packages/render/src/model3d/scene3d.ts';
import { highlightOf } from '../packages/render/src/model3d/highlight3d.ts';
import { syntheticProject } from './perf-baselines/projeto-sintetico.mts';

const p = syntheticProject(60, 128);
const niveis: ResolvedLevel[] = p.levels.map((l) => resolveLevel(p, l.id));
const ms = new ModelScene({});
ms.update(p, niveis, { edges: true, shadows: false, dark: false });

const vistos = new Set<Id>();
ms.scene.traverse((o) => {
  const r = (o as { userData?: { ranges?: Array<{ id: Id }> } }).userData?.ranges;
  if (r) for (const x of r) vistos.add(x.id);
});
const todos = [...vistos];
const doNivel = todos.filter((id) => /^perf_\w+_0_/.test(String(id)));

const contar = (o: { children: Array<{ type: string }> }): number => o.children.length;
const um = highlightOf(ms.scene, [todos[0]!], { color: 0x2277ff, fill: 0.35, edges: 1 });
const nivel = highlightOf(ms.scene, doNivel, { color: 0x2277ff, fill: 0.35, edges: 1 });
console.log(`1 elemento: ${contar(um)} objetos (${um.children.filter((c) => c.type === 'Mesh').length} preenchimento, ${um.children.filter((c) => c.type === 'LineSegments').length} arestas)`);
console.log(`pavimento (${doNivel.length} elementos): ${contar(nivel)} objetos (${nivel.children.filter((c) => c.type === 'Mesh').length} preenchimento, ${nivel.children.filter((c) => c.type === 'LineSegments').length} arestas)`);

// Primeiro hover de cada elemento (cache frio) e uma segunda passada (cache quente).
function passada(rotulo: string): void {
  const tempos: Array<{ id: Id; ms: number }> = [];
  for (const id of todos) {
    const t0 = performance.now();
    highlightOf(ms.scene, [id], { color: 0x2277ff, fill: 0.35, edges: 1 });
    tempos.push({ id, ms: performance.now() - t0 });
  }
  const ordenado = [...tempos].sort((a, b) => a.ms - b.ms);
  const quantil = (q: number): number => ordenado[Math.min(ordenado.length - 1, Math.ceil(q * ordenado.length) - 1)]!.ms;
  console.log(`${rotulo} (${tempos.length} elementos): mediana ${quantil(0.5).toFixed(3)} ms, p95 ${quantil(0.95).toFixed(3)} ms, max ${quantil(1).toFixed(3)} ms`);
  console.log('  mais caros:', ordenado.slice(-3).reverse().map((x) => `${x.id}=${x.ms.toFixed(1)}ms`).join(' '));
}
passada('primeira passada');
passada('segunda passada (cache quente)');
ms.dispose();
