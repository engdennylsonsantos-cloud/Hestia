/**
 * Medição do intervalo de vista da planta (decisão 0013): quanto custa resolver um nível com as opções da vista
 * (`cutZ`, `planOpenings`, `outlineWalls`) comparado à resolução padrão do app, e a planta completa.
 *
 * Projetos: a fixture `casa-2-quartos.hestia.json` e um sintético (4 níveis, ~440 paredes em grade, 80 aberturas, alguns
 * vãos com peitoril acima do corte para exercitar as classes de projeção). Por nível, cada cenário roda 3 vezes de
 * aquecimento e 20 medidas; reporta a média em ms (e o mínimo, para ver o ruído).
 *
 * Cenários (o "sem edição" é o redesenho de pan, zoom ou hover; o "edição" é um projeto novo com geometria nova, como
 * depois de uma edição que muda o nível):
 *   1. resolveLevel padrão, sem edição (cache compartilhado, hit)
 *   2. resolveLevel padrão, edição (cache miss)
 *   3. resolveLevel com opções da vista, sem edição (hit)
 *   4. resolveLevel com opções da vista, edição (classificação + resolução, miss)
 *   5. planViewOf, sem edição (memo por projeto: hit)
 *   6. planViewOf, edição
 *   7. buildPlanDrawList, sem edição (redesenho: resolução e vista já prontas, como o app passa)
 *   8. buildPlanDrawList, edição (resolução padrão do nível e do de baixo, vista e desenho)
 *
 * Uso: npx vite-node scripts/bench-vista.mts   (variável BENCH_RUNS muda o número de medidas)
 */
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { classifyLevelEntries, resolveFloors, resolveLevel, resolveRoofs, resolveSlabs, type PlanResolveOptions, type ResolvedLevel } from '@hestia/engine';
import { createEmptyProject, isOpening, levelElevation, makeFloor, makeLevel, makeWall, migrateProject, ProjectStore, viewRangeOf, wallsOnLevel, type Command, type Id, type Opening, type Project } from '@hestia/model';
import { buildPlanDrawList, LIGHT, planViewOf, type PlanInput } from '@hestia/render';

const RUNS = Number(process.env.BENCH_RUNS ?? 20);
const WARM = 3;
const FIXTURE = new URL('../packages/engine/src/fixtures/casa-2-quartos.hestia.json', import.meta.url);

/**
 * Opções da vista de um nível, como `planViewOf` monta (cópia mínima: a função dele é privada ao render; o teste
 * `viewRange.test.ts` do render garante que a planta usa a mesma classificação).
 */
function viewOptsOf(p: Project, levelId: Id): PlanResolveOptions {
  const range = viewRangeOf(p, levelId);
  const planOpenings = new Set<Id>();
  const outlineWalls = new Set<Id>();
  for (const e of classifyLevelEntries(p, levelId, range)) {
    if (e.category === 'opening' && e.cls === 'cut') planOpenings.add(e.id);
    if (e.category === 'wall' && e.cls !== 'cut' && e.cls !== 'hidden') outlineWalls.add(e.id);
  }
  return { cutZ: levelElevation(p, levelId) + range.cut, planOpenings, outlineWalls };
}

/** Projeto sintético: 4 níveis, grade 8 × 6 de 4 m em cada nível (110 paredes), 20 aberturas e um piso por nível. */
function syntheticProject(): Project {
  const store = new ProjectStore(createEmptyProject('Sintético 4 níveis'));
  const { wallTypeId, doorTypeId, windowTypeId } = store.project.defaults;
  const cmds: Command[] = [];
  const levels = [
    makeLevel({ id: 'lv_0', name: 'Térreo', elevation: 0 }),
    makeLevel({ id: 'lv_1', name: 'Pavimento 2', elevation: 3 }),
    makeLevel({ id: 'lv_2', name: 'Pavimento 3', elevation: 6 }),
    makeLevel({ id: 'lv_3', name: 'Cobertura', elevation: 9 }),
  ];
  for (const level of levels) cmds.push({ type: 'upsertLevel', level });
  const W = 8;
  const H = 6;
  const S = 4;
  for (const level of levels) {
    const walls: string[] = [];
    // Linhas horizontais (y = j·S) e verticais (x = i·S), cada uma partida em segmentos de 4 m.
    for (let j = 0; j <= H; j++) {
      for (let i = 0; i < W; i++) {
        const id = `${level.id}_h${j}_${i}`;
        walls.push(id);
        cmds.push({ type: 'addWall', wall: makeWall({ id, typeId: wallTypeId, levelId: level.id, a: { x: i * S, y: j * S }, b: { x: (i + 1) * S, y: j * S } }) });
      }
    }
    for (let i = 0; i <= W; i++) {
      for (let j = 0; j < H; j++) {
        const id = `${level.id}_v${i}_${j}`;
        walls.push(id);
        cmds.push({ type: 'addWall', wall: makeWall({ id, typeId: wallTypeId, levelId: level.id, a: { x: i * S, y: j * S }, b: { x: i * S, y: (j + 1) * S } }) });
      }
    }
    // Vinte aberturas por nível: a cada 5 paredes; metade portas, metade janelas; metade das janelas com peitoril 1,50 (acima do corte).
    walls.filter((_, k) => k % 5 === 0).slice(0, 20).forEach((hostId, k) => {
      const isDoor = k % 2 === 0;
      const o: Opening = {
        id: `${hostId}_o`,
        kind: isDoor ? 'door' : 'window',
        typeId: isDoor ? doorTypeId : windowTypeId,
        hostId,
        offset: 2,
        flipHand: false,
        flipFacing: false,
        sillOverride: isDoor || k % 4 === 1 ? null : 1.5,
        mark: '',
      };
      cmds.push({ type: 'addOpening', opening: o });
    });
    const boundary = [
      { x: 4, y: 4 },
      { x: 12, y: 4 },
      { x: 12, y: 12 },
      { x: 4, y: 12 },
    ];
    cmds.push({ type: 'addFloor', floor: makeFloor({ id: `${level.id}_piso`, typeId: 'ft_ceram', levelId: level.id, boundary }) });
  }
  store.exec({ type: 'batch', commands: cmds });
  return store.project;
}

/** Cópia do projeto com um ponto de uma parede do nível deslocado `k` mm: geometria nova, cache sem acerto. */
function edited(p: Project, levelId: Id, k: number): Project {
  const w = wallsOnLevel(p, levelId)[0]!;
  return { ...p, elements: { ...p.elements, [w.id]: { ...w, b: { x: w.b.x + k * 1e-5, y: w.b.y } } } };
}

/** Entrada da planta como o app passa (ViewportCanvas): resolução padrão, nível abaixo com a sua resolução apagada. */
function planInput(p: Project, levelId: Id, resolved: ResolvedLevel, below: { levelId: Id; resolved: ResolvedLevel } | null): PlanInput {
  return {
    project: p,
    levelId,
    resolved,
    below: below?.resolved ?? null,
    belowFloors: below ? resolveFloors(p, below.levelId) : undefined,
    belowSlabs: below ? resolveSlabs(p, below.levelId) : undefined,
    belowRoofs: below ? resolveRoofs(p, below.levelId) : undefined,
    viewport: { cx: 8, cy: 12, zoom: 40, width: 1200, height: 800 },
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
  mean: number;
  min: number;
}

/** Tempo (ms) de `fn`: aquecimento, depois `RUNS` medidas. `fn` recebe o índice da medida (negativo no aquecimento). */
function measure(fn: (i: number) => unknown): Stat {
  for (let i = 0; i < WARM; i++) fn(-1 - i);
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    fn(i);
    times.push(performance.now() - t0);
  }
  return { mean: times.reduce((a, b) => a + b, 0) / times.length, min: Math.min(...times) };
}

const fmt = (s: Stat): string => `${s.mean.toFixed(2).padStart(9)} ms (mín ${s.min.toFixed(2)})`;

function benchProject(name: string, p: Project): void {
  console.log(`\n## ${name}: ${wallsOnLevel(p, p.levels[0]!.id).length} paredes no térreo, ${Object.values(p.elements).filter(isOpening).length} aberturas`);
  let edit = 0;
  for (const level of p.levels) {
    const id = level.id;
    if (wallsOnLevel(p, id).length === 0) {
      console.log(`\n  nível ${id} (${level.name}): sem paredes, pulado`);
      continue;
    }
    const idx = p.levels.indexOf(level);
    const below = idx > 0 ? p.levels[idx - 1]!.id : null;
    const pBase = p;
    const resolvedBase = resolveLevel(pBase, id);
    const belowBase = below ? { levelId: below, resolved: resolveLevel(pBase, below) } : null;
    const optsBase = viewOptsOf(pBase, id);
    // Cada chamada de "edição" cria um projeto com geometria nova (chave de cache inédita).
    const nextEdit = (): Project => edited(pBase, id, ++edit);

    const rows: Array<[string, Stat]> = [];
    rows.push(['1 resolveLevel padrão, sem edição', measure(() => resolveLevel(pBase, id))]);
    rows.push(['2 resolveLevel padrão, edição', measure(() => resolveLevel(nextEdit(), id))]);
    rows.push(['3 resolveLevel vista, sem edição', measure(() => resolveLevel(pBase, id, undefined, optsBase))]);
    rows.push(['4 resolveLevel vista, edição (inclui classificação)', measure(() => {
      const q = nextEdit();
      return resolveLevel(q, id, undefined, viewOptsOf(q, id));
    })]);
    rows.push(['5 planViewOf, sem edição (memo)', measure(() => planViewOf(pBase, id))]);
    rows.push(['6 planViewOf, edição', measure(() => planViewOf(nextEdit(), id))]);
    rows.push(['7 buildPlanDrawList, redesenho sem edição', measure(() => buildPlanDrawList(planInput(pBase, id, resolvedBase, belowBase)))]);
    rows.push(['8 buildPlanDrawList, após edição', measure(() => {
      const q = nextEdit();
      const r = resolveLevel(q, id);
      const b = below ? { levelId: below, resolved: resolveLevel(q, below) } : null;
      return buildPlanDrawList(planInput(q, id, r, b));
    })]);
    console.log(`\n  nível ${id} (${level.name}, cota ${level.elevation} m)`);
    for (const [label, s] of rows) console.log(`    ${label.padEnd(52)} ${fmt(s)}`);
  }
}

const fixture = migrateProject(JSON.parse(readFileSync(FIXTURE, 'utf8')));
benchProject('Fixture casa-2-quartos', fixture);
benchProject('Sintético grande', syntheticProject());
console.log(`\nMedidas: ${RUNS} por cenário após ${WARM} de aquecimento.`);
