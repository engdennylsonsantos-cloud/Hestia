/**
 * Baseline de interação medido em Node (frente G): o "antes" e o "depois" de cada mudança de desempenho do app.
 *
 * O que mede, em projetos sintéticos de 10 e 20 pavimentos (320 e 640 paredes; o gerador é o de
 * `bench-20-pavimentos.mts`, com layout fixo: não há sorteio, então a "semente" é a própria geometria fixa):
 *   - buildPlanDrawList por nível, frio (projeto de geometria nova, resolução prévia fora do cronômetro) e quente
 *     (mesmo projeto, redesenho);
 *   - resolveFloors, resolveSlabs e resolveRoofs por nível, frio e quente;
 *   - ModelScene.update (montagem da 3D), frio (cache de parede limpo) e quente (mesma cena);
 *   - pickElement e pickModelPoint: um clique de exemplo (centro da tela) e uma varredura de 9 pontos.
 *
 * Método: cada cenário roda `WARM` vezes de aquecimento (não cronometradas) e depois `RUNS` medidas (padrão 30;
 * variável BENCH_RUNS). Reporta mediana, p95 (amostra de ordem ceil(0,95·n)), média, mínimo e máximo, em ms.
 * A cena 3D e o picking usam a geometria do three.js em CPU: não há GPU, quadros nem pintura (ver o README da pasta).
 *
 * Uso: npx vite-node scripts/bench-interacao.mts [--save]   (com --save grava scripts/perf-baselines/node-<data>.json)
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { arch, cpus, freemem, platform, release, totalmem } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { resolveFloors, resolveLevel, resolveRoofs, resolveSlabs, type ResolvedLevel } from '@hestia/engine';
import { type Id, type Project } from '@hestia/model';
import { syntheticProject, WALLS_PER_LEVEL } from './perf-baselines/projeto-sintetico.mts';
import { LIGHT, ModelScene, buildPlanDrawList, clearWallLayerCache, pickElement, pickModelPoint, planViewOf, type PlanInput } from '@hestia/render';

const RUNS = Math.max(1, Number(process.env.BENCH_RUNS ?? 30));
const WARM = 5;
const LEVEL_COUNTS = [10, 20];
const SCENE_OPTS = { edges: false, shadows: false, dark: false };
const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Cópia do projeto com um ponto de uma parede do nível deslocado `k` × 1e-5 m: geometria nova, cache sem acerto. */
function edited(p: Project, levelId: Id, k: number): Project {
  const w = p.elements[`perf_w_${p.levels.findIndex((l) => l.id === levelId)}_0`];
  if (!w || w.kind !== 'wall') throw new Error(`Parede de edição não encontrada no nível ${levelId}`);
  return { ...p, elements: { ...p.elements, [w.id]: { ...w, b: { x: w.b.x + k * 1e-5, y: w.b.y } } } };
}

/** Entrada da planta como o app passa (`ViewportCanvas`): resolução padrão e a do nível abaixo. */
function planInput(p: Project, levelId: Id, resolved: ResolvedLevel, below: { levelId: Id; resolved: ResolvedLevel } | null): PlanInput {
  return {
    project: p,
    levelId,
    resolved,
    below: below?.resolved ?? null,
    belowFloors: below ? resolveFloors(p, below.levelId) : undefined,
    belowSlabs: below ? resolveSlabs(p, below.levelId) : undefined,
    belowRoofs: below ? resolveRoofs(p, below.levelId) : undefined,
    viewport: { cx: 6, cy: 6, zoom: 30, width: 1200, height: 800 },
    theme: LIGHT,
    dark: false,
    selection: [],
    hover: null,
    preview: [],
    inference: null,
    showGrid: true,
    showRoofProjection: true,
  };
}

interface Stat {
  n: number;
  medianMs: number;
  p95Ms: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
}

const r3 = (x: number): number => Number(x.toFixed(3));

function stat(samples: number[]): Stat {
  const s = [...samples].sort((a, b) => a - b);
  const at = (q: number): number => s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]!;
  return { n: s.length, medianMs: r3(at(0.5)), p95Ms: r3(at(0.95)), meanMs: r3(s.reduce((a, b) => a + b, 0) / s.length), minMs: r3(s[0]!), maxMs: r3(s.at(-1)!) };
}

/** Mede `fn` com `setup` antes de cada chamada (fora do cronômetro): aquecimento não entra nas medidas. */
function timed<A>(setup: (i: number) => A, fn: (a: A) => unknown, runs = RUNS): Stat {
  const samples: number[] = [];
  for (let i = -WARM; i < runs; i++) {
    const a = setup(i);
    const t0 = performance.now();
    fn(a);
    const dt = performance.now() - t0;
    if (i >= 0) samples.push(dt);
  }
  return stat(samples);
}

let editCounter = 0;
const nextEdit = (): number => ++editCounter;
const ms = (s: Stat): string => `mediana ${s.medianMs.toFixed(2).padStart(9)} ms  p95 ${s.p95Ms.toFixed(2).padStart(9)} ms`;

/** Resultados por nível: planta frio/quente e pisos, lajes e telhados frio/quente. */
function benchLevels(p: Project): unknown[] {
  const out: unknown[] = [];
  const ids = p.levels.map((l) => l.id);
  const resolvedAll = ids.map((id) => resolveLevel(p, id));
  for (let idx = 0; idx < ids.length; idx++) {
    const id = ids[idx]!;
    const level = p.levels[idx]!;
    const belowId = idx > 0 ? ids[idx - 1]! : null;
    const belowRes = belowId ? { levelId: belowId, resolved: resolvedAll[idx - 1]! } : null;

    // Planta, frio: projeto de geometria nova; a resolução do nível fica pronta fora do cronômetro.
    const planCold = timed(
      () => {
        const q = edited(p, id, nextEdit());
        const r = resolveLevel(q, id);
        const b = belowId ? { levelId: belowId, resolved: resolveLevel(q, belowId) } : null;
        return planInput(q, id, r, b);
      },
      (inp) => buildPlanDrawList(inp),
    );
    // Planta, quente: mesmo projeto, redesenho (vista e resolução já em memória, como no pan e no zoom).
    const planWarm = timed(() => planInput(p, id, resolvedAll[idx]!, belowRes), (inp) => buildPlanDrawList(inp));

    // Resolução de pisos, lajes e telhados do nível (o app refaz a do nível abaixo a cada quadro).
    const floorsCold = timed((i) => edited(p, id, nextEdit()), (q) => resolveFloors(q, id));
    const floorsWarm = timed(() => null, () => resolveFloors(p, id));
    const slabsCold = timed((i) => edited(p, id, nextEdit()), (q) => resolveSlabs(q, id));
    const slabsWarm = timed(() => null, () => resolveSlabs(p, id));
    const roofsCold = timed((i) => edited(p, id, nextEdit()), (q) => resolveRoofs(q, id));
    const roofsWarm = timed(() => null, () => resolveRoofs(p, id));

    console.log(`  ${id} (${level.name}, cota ${level.elevation} m)`);
    console.log(`    buildPlanDrawList frio   ${ms(planCold)}`);
    console.log(`    buildPlanDrawList quente ${ms(planWarm)}`);
    console.log(`    resolveFloors frio/quente ${ms(floorsCold)} | ${ms(floorsWarm)}`);
    console.log(`    resolveSlabs  frio/quente ${ms(slabsCold)} | ${ms(slabsWarm)}`);
    console.log(`    resolveRoofs  frio/quente ${ms(roofsCold)} | ${ms(roofsWarm)}`);
    out.push({
      id,
      name: level.name,
      elevation: level.elevation,
      buildPlanDrawList: { frio: planCold, quente: planWarm },
      resolveFloors: { frio: floorsCold, quente: floorsWarm },
      resolveSlabs: { frio: slabsCold, quente: slabsWarm },
      resolveRoofs: { frio: roofsCold, quente: roofsWarm },
    });
  }
  return out;
}

/** Cena 3D e picking: montagem fria e quente, depois um clique de exemplo (centro) e uma varredura de 9 pontos. */
function benchScene(p: Project): Record<string, unknown> {
  const resolved = p.levels.map((l) => resolveLevel(p, l.id));
  let scene = new ModelScene();
  const sceneCold = timed(
    () => {
      clearWallLayerCache();
      scene = new ModelScene();
    },
    () => scene.update(p, resolved, SCENE_OPTS),
    Math.max(5, Math.floor(RUNS / 3)),
  );
  const sceneWarm = timed(() => null, () => scene.update(p, resolved, SCENE_OPTS), Math.max(5, Math.floor(RUNS / 3)));
  console.log(`  ModelScene.update frio   ${ms(sceneCold)}`);
  console.log(`  ModelScene.update quente ${ms(sceneWarm)}`);

  scene.fit();
  const cam = scene.orbit.camera;
  const center = { x: 0, y: 0 };
  // Um clique de exemplo: o centro da tela, que cai sobre o modelo enquadrado.
  const exemploElem = pickElement(scene.scene, cam, center);
  const exemploPonto = pickModelPoint(scene.scene, cam, center);
  const pickElemCentro = timed(() => null, () => pickElement(scene.scene, cam, center));
  const pickPontoCentro = timed(() => null, () => pickModelPoint(scene.scene, cam, center));
  const grid = [-0.6, 0, 0.6];
  const pts = grid.flatMap((x) => grid.map((y) => ({ x, y })));
  const pickElemGrid = timed((i) => pts[((i % 9) + 9) % 9]!, (q) => pickElement(scene.scene, cam, q), RUNS * 9);
  const pickPontoGrid = timed((i) => pts[((i % 9) + 9) % 9]!, (q) => pickModelPoint(scene.scene, cam, q), RUNS * 9);
  console.log(`  pickElement centro       ${ms(pickElemCentro)}`);
  console.log(`  pickModelPoint centro    ${ms(pickPontoCentro)}`);
  console.log(`  pickElement grade 3x3    ${ms(pickElemGrid)}`);
  console.log(`  pickModelPoint grade 3x3 ${ms(pickPontoGrid)}`);
  console.log(`  exemplo de clique: elemento ${exemploElem ? `${exemploElem.id} (${exemploElem.kind})` : 'nenhum'}, ponto ${exemploPonto ? `${exemploPonto.x.toFixed(2)}, ${exemploPonto.y.toFixed(2)}` : 'nenhum'}`);
  return {
    modelSceneUpdate: { frio: sceneCold, quente: sceneWarm },
    pick: {
      exemplo: { elemento: exemploElem ? { id: exemploElem.id, kind: exemploElem.kind } : null, ponto: exemploPonto },
      pickElement: { centro: pickElemCentro, grade3x3: pickElemGrid },
      pickModelPoint: { centro: pickPontoCentro, grade3x3: pickPontoGrid },
    },
  };
}

function gitInfo(): Record<string, unknown> {
  const run = (cmd: string): string => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  return {
    commit: run('git rev-parse HEAD'),
    branch: run('git rev-parse --abbrev-ref HEAD'),
    arvoreSuja: run('git status --porcelain').length > 0,
  };
}

const machine = {
  so: `${platform()} ${release()} (${arch()})`,
  cpu: cpus()[0]?.model ?? 'desconhecida',
  cpusLogicas: cpus().length,
  ramTotalGB: Number((totalmem() / 2 ** 30).toFixed(1)),
  ramLivreGBNoInicio: Number((freemem() / 2 ** 30).toFixed(1)),
  node: process.version,
};

const started = new Date();
const results: Record<string, unknown> = {};
const projects: Array<Record<string, unknown>> = [];
for (const n of LEVEL_COUNTS) {
  const p = syntheticProject(n);
  const walls = p.levels.length * WALLS_PER_LEVEL;
  console.log(`\n## ${n} pavimentos (${walls} paredes, ${p.levels.length} níveis)`);
  console.log('  -- por nível (planta e resolução) --');
  const levels = benchLevels(p);
  console.log('  -- cena 3D e picking --');
  const scene = benchScene(p);
  projects.push({ pavimentos: n, paredes: walls, aberturas: n, pisos: n, lajes: n, cobertura: 1 });
  results[`${n}pavimentos`] = { levels, ...scene };
}

const data = {
  geradoEm: started.toISOString(),
  metodo: {
    corridas: RUNS,
    aquecimento: WARM,
    percentil: 'p95 = amostra de ordem ceil(0,95·n); mediana pela mesma ordem',
    semente: 'layout fixo (sem sorteio): gerador de bench-20-pavimentos.mts',
    frioQuente: 'frio = projeto de geometria nova (chave de cache inédita); quente = mesmo projeto, redesenho',
    ambiente: 'Node (sem navegador): sem GPU, sem quadros, sem pintura do canvas',
  },
  maquina: machine,
  git: gitInfo(),
  projetos: projects,
  resultados: results,
};
const json = `${JSON.stringify(data, null, 2)}\n`;
if (process.argv.includes('--save')) {
  const dir = join(ROOT, 'scripts', 'perf-baselines');
  mkdirSync(dir, { recursive: true });
  const day = started.toISOString().slice(0, 10);
  writeFileSync(join(dir, `node-${day}.json`), json);
  console.log(`\nGravado: scripts/perf-baselines/node-${day}.json`);
} else {
  console.log('\n(use --save para gravar o JSON em scripts/perf-baselines/)');
}
