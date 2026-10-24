import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { buildFloorSolids, buildLevelSolids, buildRoofSolids, buildSlabSolids, clearWallLayerCache, ModelScene, wallLayerCacheStats } from '@hestia/render';
import { booleanStats, resetBooleanStats } from '@hestia/geom';
import { junctionLevel, resolveFloors, resolveLevel, resolveRoofs, resolveSlabs, type ResolvedLevel } from '@hestia/engine';
import { ProjectStore, createEmptyProject, makeFloor, makeLevel, makeRoof, makeSlab, makeWall, type Command, type Id, type Project } from '@hestia/model';

const LEVELS = 20;
const WALLS_PER_LEVEL = 32;
const RUNS = Math.max(1, Number(process.env.BENCH_RUNS ?? 1));
const WARM = Math.max(0, Number(process.env.BENCH_WARMUPS ?? 0));

function syntheticProject(): Project {
  const store = new ProjectStore(createEmptyProject('Benchmark 20 pavimentos'));
  const commands: Command[] = [];
  const levels: Id[] = [];
  for (let i = 0; i < LEVELS; i++) {
    // Reaproveita os dois níveis do projeto vazio para manter o total em exatamente 20.
    const id = i === 0 ? 'lv_0' : i === 1 ? 'lv_1' : `perf_lv_${i}`;
    levels.push(id);
    commands.push({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) });
  }

  const segments: Array<[[number, number], [number, number]]> = [];
  for (const y of [0, 4, 8, 12]) for (const x of [0, 4, 8]) segments.push([[x, y], [x + 4, y]]);
  for (const x of [0, 4, 8, 12]) for (const y of [0, 4, 8]) segments.push([[x, y], [x, y + 4]]);
  segments.push(
    [[2, 0], [2, 4]], [[6, 4], [6, 8]], [[10, 8], [10, 12]], [[0, 2], [4, 2]],
    [[0, 6], [4, 6]], [[8, 10], [12, 10]], [[2, 8], [2, 12]], [[10, 0], [10, 4]],
  );
  if (segments.length !== WALLS_PER_LEVEL) throw new Error(`Esperava ${WALLS_PER_LEVEL} paredes por nível, recebi ${segments.length}`);

  for (let i = 0; i < levels.length; i++) {
    const levelId = levels[i]!;
    for (let j = 0; j < segments.length; j++) {
      const [[ax, ay], [bx, by]] = segments[j]!;
      const id = `perf_w_${i}_${j}`;
      commands.push({
        type: 'addWall',
        wall: makeWall({ id, typeId: 'wt_ext19', levelId, a: { x: ax, y: ay }, b: { x: bx, y: by } }),
      });
      if (j === 0) {
        commands.push({ type: 'addOpening', opening: { id: `perf_o_${i}`, kind: 'door', typeId: 'ot_p80', hostId: id, offset: 2, flipHand: false, flipFacing: false, sillOverride: null, mark: '' } });
      }
    }
    commands.push({ type: 'addFloor', floor: makeFloor({ id: `perf_floor_${i}`, typeId: 'ft_ceram', levelId, boundary: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 }] }) });
    commands.push({ type: 'addSlab', slab: makeSlab({ id: `perf_slab_${i}`, typeId: 'ls_mac12', levelId, boundary: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 }] }) });
    if (i === levels.length - 1) {
      commands.push({ type: 'addRoof', roof: makeRoof({ id: 'perf_roof', typeId: 'rt_ceramica', levelId, boundary: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 12 }, { x: 0, y: 12 }], shape: 'gable', slopePercent: 30 }) });
    }
  }
  store.exec({ type: 'batch', commands });
  return store.project;
}

function measure(fn: () => unknown): number[] {
  for (let i = 0; i < WARM; i++) fn();
  const samples: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return samples;
}

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samplesMs: values.map((x) => Number(x.toFixed(2))),
    medianMs: Number(sorted[Math.floor(sorted.length / 2)]!.toFixed(2)),
    minMs: Number(sorted[0]!.toFixed(2)),
    maxMs: Number(sorted.at(-1)!.toFixed(2)),
  };
}

function edited(p: Project): Project {
  const wall = p.elements.perf_w_19_0;
  if (!wall || wall.kind !== 'wall') throw new Error('Parede de edição não encontrada');
  return { ...p, elements: { ...p.elements, [wall.id]: { ...wall, b: { ...wall.b, x: wall.b.x + 0.01 } } } };
}

const project = syntheticProject();
const ids = project.levels.map((level) => level.id);
if (ids.length !== LEVELS) throw new Error(`Esperava ${LEVELS} níveis, recebi ${ids.length}`);
const cache = new Map<string, ResolvedLevel>();
const resolveAll = (p: Project, c: Map<string, ResolvedLevel>) => ids.map((id) => resolveLevel(p, id, c));
const baseline: Record<string, unknown> = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  logicalCpus: cpus().length,
  totalMemoryBytes: totalmem(),
  runs: RUNS,
  warmups: WARM,
  project: { levels: ids.length, walls: ids.length * WALLS_PER_LEVEL, wallType: 'wt_ext19', openings: ids.length, floors: ids.length, slabs: ids.length, roofs: 1 },
  measurements: {} as Record<string, ReturnType<typeof stats>>,
};
const measurements = baseline.measurements as Record<string, ReturnType<typeof stats>>;

console.error('[bench] resolveLevel frio');
measurements.resolveLevelColdTop = stats(measure(() => resolveLevel({ ...project }, ids.at(-1)!, new Map())));
const warmCache = new Map<string, ResolvedLevel>();
resolveLevel(project, ids.at(-1)!, warmCache);
console.error('[bench] resolveLevel quente');
measurements.resolveLevelWarmTop = stats(measure(() => resolveLevel(project, ids.at(-1)!, warmCache)));
console.error('[bench] resolveAll frio');
measurements.resolveAllCold = stats(measure(() => resolveAll({ ...project }, new Map())));
resolveAll(project, cache);
console.error('[bench] resolveAll quente');
measurements.resolveAllWarm = stats(measure(() => resolveAll(project, cache)));
console.error('[bench] resolveAll após edição no topo');
const editedProject = edited(project);
measurements.resolveAllAfterTopEdit = stats(measure(() => resolveAll(editedProject, new Map())));

console.error('[bench] preparação da resolução para a cena 3D');
const resolved = resolveAll(project, new Map());
console.error('[bench] junções verticais de todos os níveis');
const junctionSamples = measure(() => ids.map((id) => junctionLevel(project, id)));
const junctions = ids.map((id) => junctionLevel(project, id));
measurements.junctionLevelsAll = stats(junctionSamples);
console.error('[bench] junções após edição em um pavimento');
measurements.junctionLevelsAllAfterTopEdit = stats(measure(() => ids.map((id) => junctionLevel(editedProject, id))));
if (process.env.BENCH_SKIP_SCENE !== '1') {
  console.error('[bench] sólidos de parede (cache frio)');
  clearWallLayerCache();
  resetBooleanStats();
  measurements.wallSolidBuildAllCold = stats(measure(() => resolved.forEach((level, i) => buildLevelSolids(level, junctions[i]))));
  baseline.wallLayerCacheAfterColdBuild = wallLayerCacheStats();
  baseline.wallBooleanStats = booleanStats();
  console.error('[bench] sólidos de pisos, lajes e telhado');
  measurements.surfaceSolidBuildAll = stats(measure(() => {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      buildFloorSolids(resolveFloors(project, id), junctions[i]);
      buildSlabSolids(resolveSlabs(project, id), junctions[i]);
      buildRoofSolids(resolveRoofs(project, id));
    }
  }));
  const scene = new ModelScene();
  clearWallLayerCache();
  console.error('[bench] montagem inicial de cena 3D (CPU, sem renderização GPU)');
  measurements.modelSceneUpdate = stats(measure(() => scene.update(project, resolved, { edges: false, shadows: false, dark: false })));
  baseline.wallLayerCacheAfterSceneUpdate = wallLayerCacheStats();
  console.error('[bench] remontagem da mesma cena 3D (CPU, sem renderização GPU)');
  measurements.modelSceneUpdateWarm = stats(measure(() => scene.update(project, resolved, { edges: false, shadows: false, dark: false })));
  baseline.wallLayerCacheAfterWarmSceneUpdate = wallLayerCacheStats();
  let triangles = 0;
  scene.scene.traverse((object) => {
    const mesh = object as { isMesh?: boolean; geometry?: { index?: { count: number } | null; attributes?: { position?: { count: number } } } };
    if (!mesh.isMesh || !mesh.geometry) return;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes?.position?.count ?? 0) / 3;
  });
  baseline.meshTriangles = triangles;
  baseline.note = 'Node CPU geometry and scene assembly only; no browser paint, GPU draw, FPS, long-task, or heap-profiler measurement.';
} else {
  baseline.note = 'Resolution/junction-only pass; scene generation skipped by BENCH_SKIP_SCENE=1.';
}
baseline.heapUsedBytes = process.memoryUsage().heapUsed;
baseline.rssBytes = process.memoryUsage().rss;

const json = `${JSON.stringify(baseline, null, 2)}\n`;
console.log(json);
if (process.argv.includes('--save-baseline') || process.argv.includes('--save-after')) {
  const outDir = new URL('./perf-baselines/', import.meta.url);
  mkdirSync(outDir, { recursive: true });
  const file = process.argv.includes('--save-after') ? '20-pavimentos-after-stage1.json' : '20-pavimentos.json';
  writeFileSync(new URL(file, outDir), json);
}
