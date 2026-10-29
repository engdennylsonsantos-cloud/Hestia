/**
 * N2 (geometria) da exportação IFC: compara os quantitativos do MOTOR do Hestia com o que o IfcOpenShell mede no IFC
 * exportado, por categoria (paredes, pisos, lajes, forros, telhados, escadas e ambientes).
 *
 * O lado do MOTOR vem das funções de quantitativo (`quantifyLevel`, `quantifyFloors`, `quantifySlabs`,
 * `quantifyCeilings`, `quantifyRoofs`, `stairQuantities`, `resolveRooms`); o lado do IFC é o volume/área que o
 * `validate.py --geometry` mede com `ifcopenshell.geom` em cada produto. O vínculo entre os dois é o GlobalId
 * determinístico do exportador (`wall:<id>`, `floor:<id>`, `slab:<id>`, `roofslab:<id>:<água>`, `flight:<id>:<lance>`,
 * `landing:<id>:<patamar>`, `space:<id>`), calculado aqui com o mesmo `ifcGuid`. Produto esperado que o IfcOpenShell não
 * mediu (sem corpo ou com erro de geometria) reprova a linha mesmo com volume igual.
 *
 * Semântica de cada categoria:
 * - paredes: o corpo do IFCWALL é a extrusão do contorno SEM os cortes de piso/laje (decisão 0023 §4), então o par é o
 *   `grossVolume`; o `netVolume` (com os cortes) vai como linha informativa quando difere. O vão entra como caixa bruta
 *   no IFC e como vão menos o retorno de acabamento no motor.
 * - pisos/lajes/forros: o IFC é o prisma da região resolvida pela junção; o motor é o volume líquido do quantitativo.
 * - telhados: só as IFCSLAB .ROOF. (uma por água) contam; o IFCROOF não tem corpo e não é somado duas vezes.
 * - escadas: IFCSTAIRFLIGHT + IFCSLAB .LANDING. (o IFCSTAIR não tem corpo); a chegada sai no lance do IFC e fica fora do
 *   `stairQuantities` (decisão 0012 §2).
 * - ambientes: volume do IFCSPACE contra `room.volume`; a área é o volume medido ÷ pé-direito da extrusão (a `area` do
 *   IfcOpenShell é a superfície total do sólido, não a área de piso).
 *
 * Uso:
 *   npm run ifc:compare             relata (nunca falha)
 *   npm run ifc:compare -- --strict falha quando um total passa da tolerância
 *
 * Tolerâncias: volume 0,5 %; área 1 %. Categoria sem dado no motor é ignorada (não conta como falha).
 * Escreve `test-results/ifc-quality/compare.json`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyProject, makeRoom, makeWall, ProjectStore, type Project } from '../../packages/model/src/index.ts';
import { buildTemplate, type TemplateId } from '../../packages/model/src/templates.ts';
import {
  quantifyCeilings,
  quantifyFloors,
  quantifyLevel,
  quantifyRoofs,
  quantifySlabs,
  resolveLevel,
  resolveRooms,
  resolveStairs,
  stairQuantities,
} from '../../packages/engine/src/index.ts';
import { ifcGeometryOf, projectIfc } from '../../apps/web/src/editor/ifcExport.ts';
import { ifcGuid } from '../../packages/io/src/ifc/ifcGuid.ts';

const raiz = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const saida = join(raiz, 'test-results', 'ifc-quality');
/** Data fixa do cabeçalho STEP: o mesmo projeto gera o mesmo IFC. */
const DATA = new Date('2026-10-29T00:00:00Z');
const ESTRITO = process.argv.includes('--strict');
/** Tolerância relativa do total de volume (0,5 %). */
const TOL_VOLUME = 0.005;
/** Tolerância relativa do total de área (1 %). */
const TOL_AREA = 0.01;

type Unidade = 'm³' | 'm²';

/** Medida de um produto medida pelo IfcOpenShell (`validate.py --geometry`). */
interface Medida {
  classe: string;
  volume?: number;
  area?: number;
  erro?: string;
}

/** Saída do `validate.py --geometry`. */
interface Validacao {
  erros?: unknown[];
  contagem?: Record<string, number>;
  geometria?: Record<string, Medida>;
}

/** Linha da tabela: um total do motor contra o mesmo total medido no IFC. */
interface Linha {
  modelo: string;
  categoria: string;
  unidade: Unidade;
  motor: number;
  ifc: number;
  /** Delta relativo `(ifc - motor) / motor` (0,01 = 1 %). */
  delta: number;
  /** `null` = categoria sem dado no motor (ignorada). */
  ok: boolean | null;
  /** Entra no `--strict`. Totais informativos (volume bruto das paredes) não entram. */
  gate: boolean;
  /** Produtos esperados que o IfcOpenShell não mediu (sem corpo ou com erro de geometria). */
  ausentes: number;
}

/**
 * Projeto de qualidade com ambientes e grades: os templates do Hestia não criam `Room` nem `Grid`.
 * Igual ao `casaComAmbientes` de `export-fixtures.mts` (mesmo arquivo `casa-ambientes.ifc`).
 */
function casaComAmbientes(): Project {
  const store = new ProjectStore(createEmptyProject('Casa com ambientes'));
  const anel: Array<[number, number]> = [
    [0, 0],
    [0, 5],
    [4, 5],
    [4, 0],
  ];
  anel.forEach((a, i) => {
    const b = anel[(i + 1) % anel.length]!;
    store.exec({
      type: 'addWall',
      wall: makeWall({
        id: `qw${i}`,
        typeId: store.project.defaults.wallTypeId,
        levelId: 'lv_0',
        a: { x: a[0], y: a[1] },
        b: { x: b[0], y: b[1] },
        locationLine: 'finishInterior',
      }),
    });
  });
  store.exec({ type: 'addRoom', room: makeRoom({ id: 'qr1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  store.exec({ type: 'addGrid', grid: { id: 'qgA', name: 'A', typeId: 'gt_6mm', points: [{ x: 0, y: 0 }, { x: 0, y: 5 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
  store.exec({ type: 'addGrid', grid: { id: 'qg1', name: '1', typeId: 'gt_6mm', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
  return store.project;
}

const MODELOS: TemplateId[] = ['house2', 'studio', 'house-premium', 'predio10', 'esquadrias'];
const projetos: Array<{ nome: string; projeto: Project }> = [
  ...MODELOS.map((id) => ({ nome: id as string, projeto: buildTemplate(id) })),
  { nome: 'casa-ambientes', projeto: casaComAmbientes() },
];

/** Roda o `validate.py --geometry` e devolve o JSON; `falha` quando o Python não devolveu JSON. */
function validar(arquivo: string): { dados: Validacao; falha?: string } {
  const r = spawnSync('python', [join('scripts', 'ifc-quality', 'validate.py'), arquivo, '--geometry'], {
    cwd: raiz,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  try {
    return { dados: JSON.parse(r.stdout) as Validacao };
  } catch {
    return { dados: {}, falha: `falha ao validar: ${(r.stderr || r.stdout || '').slice(0, 300)}` };
  }
}

/** Soma de um campo (`volume`/`area`) dos produtos cujos GlobalIds estão no conjunto, contando os ausentes. */
function somar(geometria: Record<string, Medida>, guids: ReadonlySet<string>, campo: 'volume' | 'area'): { total: number; ausentes: number } {
  let total = 0;
  let ausentes = 0;
  for (const guid of guids) {
    const m = geometria[guid];
    if (!m || m.erro !== undefined || m[campo] === undefined) ausentes++;
    total += m?.[campo] ?? 0;
  }
  return { total, ausentes };
}

/** Linha da tabela; categoria sem dado no motor (≈0) fica fora do gate e sem veredito. */
function linha(modelo: string, categoria: string, unidade: Unidade, motor: number, ifc: number, ausentes: number, gate = true): Linha {
  const semDado = Math.abs(motor) < 1e-6;
  const delta = semDado ? 0 : (ifc - motor) / motor;
  const tolerancia = unidade === 'm³' ? TOL_VOLUME : TOL_AREA;
  return { modelo, categoria, unidade, motor, ifc, delta, ok: semDado ? null : Math.abs(delta) <= tolerancia && ausentes === 0, gate: gate && !semDado, ausentes };
}

/** GlobalIds que o exportador escreveu para cada categoria (as chaves de `gid` em `ifcElements.ts`/`ifcSpaces.ts`). */
function guidsDe(projeto: Project): {
  paredes: Set<string>;
  pisos: Set<string>;
  lajes: Set<string>;
  forros: Set<string>;
  telhados: Set<string>;
  escadas: Set<string>;
  /** GlobalId do IFCSPACE → pé-direito da extrusão (m). */
  ambientes: Map<string, number>;
} {
  const geo = ifcGeometryOf(projeto);
  const ambientes = new Map<string, number>();
  for (const level of projeto.levels) {
    for (const r of resolveRooms(projeto, level.id)) {
      // Só sai IFCSPACE com contorno e pé-direito positivo (`addSpaces`).
      if (!r.polygon || r.polygon.length === 0 || !(r.ceilingHeight > 0)) continue;
      ambientes.set(ifcGuid(`space:${r.roomId}`), r.ceilingHeight);
    }
  }
  return {
    paredes: new Set(geo.walls.map((w) => ifcGuid(`wall:${w.wallId}`))),
    pisos: new Set(geo.floors.map((f) => ifcGuid(`floor:${f.floorId}`))),
    lajes: new Set(geo.slabs.map((s) => ifcGuid(`slab:${s.slabId}`))),
    forros: new Set(
      (geo as { ceilings?: Array<{ ceilingId?: string; id?: string }> }).ceilings?.flatMap((c) => {
        const id = c.ceilingId ?? c.id;
        return id ? [ifcGuid(`ceiling:${id}`)] : [];
      }) ?? [],
    ),
    // Uma IFCSLAB .ROOF. por água do telhado; o IFCROOF não tem corpo (não entra duas vezes).
    telhados: new Set(geo.roofs.flatMap((r) => r.planes.map((_, i) => ifcGuid(`roofslab:${r.roofId}:${i}`)))),
    // Lance (IFCSTAIRFLIGHT) + patamares (IFCSLAB .LANDING.); o IFCSTAIR não tem corpo.
    escadas: new Set(
      geo.stairs.flatMap((s) => [
        ...s.flights.map((f) => ifcGuid(`flight:${s.stairId}:${f.componentIndex}`)),
        ...s.landings.map((_, i) => ifcGuid(`landing:${s.stairId}:${i}`)),
      ]),
    ),
    ambientes,
  };
}

/** Totais do motor por categoria (m³ e m²), somando todos os níveis. */
function totaisDoMotor(projeto: Project): {
  paredeBruta: number;
  paredeLiquida: number;
  pisos: number;
  lajes: number;
  forros: number;
  telhados: number;
  escadas: number;
  ambienteArea: number;
  ambienteVolume: number;
} {
  let paredeBruta = 0;
  let paredeLiquida = 0;
  let pisos = 0;
  let lajes = 0;
  let forros = 0;
  let telhados = 0;
  let ambienteArea = 0;
  let ambienteVolume = 0;
  for (const level of projeto.levels) {
    for (const w of quantifyLevel(projeto, resolveLevel(projeto, level.id)).walls) {
      paredeBruta += w.grossVolume;
      paredeLiquida += w.volume;
    }
    pisos += quantifyFloors(projeto, level.id).totalVolume;
    lajes += quantifySlabs(projeto, level.id).totalVolume;
    forros += quantifyCeilings(projeto, level.id).totalVolume;
    telhados += quantifyRoofs(projeto, level.id).totalVolume;
    for (const r of resolveRooms(projeto, level.id)) {
      if (!r.polygon || r.polygon.length === 0 || !(r.ceilingHeight > 0)) continue;
      ambienteArea += r.area;
      ambienteVolume += r.volume;
    }
  }
  const escadas = resolveStairs(projeto).reduce((s, st) => s + stairQuantities(st).volume, 0);
  return { paredeBruta, paredeLiquida, pisos, lajes, forros, telhados, escadas, ambienteArea, ambienteVolume };
}

mkdirSync(saida, { recursive: true });
const linhas: Linha[] = [];
const relatorio: Record<string, unknown> = {};

for (const { nome, projeto } of projetos) {
  const arquivo = join(saida, `${nome}.ifc`);
  writeFileSync(arquivo, projectIfc(projeto, DATA));
  const { dados, falha } = validar(arquivo);
  const geometria = dados.geometria ?? {};
  const motor = totaisDoMotor(projeto);
  const guids = guidsDe(projeto);

  const paredes = somar(geometria, guids.paredes, 'volume');
  const pisosIfc = somar(geometria, guids.pisos, 'volume');
  const lajesIfc = somar(geometria, guids.lajes, 'volume');
  const forrosIfc = somar(geometria, guids.forros, 'volume');
  const telhadosIfc = somar(geometria, guids.telhados, 'volume');
  const escadasIfc = somar(geometria, guids.escadas, 'volume');
  const ambientesIfc = somar(geometria, new Set(guids.ambientes.keys()), 'volume');
  // Área do ambiente pela geometria: o volume medido ÷ pé-direito da extrusão (a `area` do IfcOpenShell é a superfície
  // total do sólido, não a área de piso).
  let ambienteAreaIfc = 0;
  for (const [guid, altura] of guids.ambientes) ambienteAreaIfc += (geometria[guid]?.volume ?? 0) / altura;

  const doModelo: Linha[] = [
    linha(nome, 'paredes (bruto)', 'm³', motor.paredeBruta, paredes.total, paredes.ausentes),
    linha(nome, 'pisos', 'm³', motor.pisos, pisosIfc.total, pisosIfc.ausentes),
    linha(nome, 'lajes', 'm³', motor.lajes, lajesIfc.total, lajesIfc.ausentes),
    linha(nome, 'forros', 'm³', motor.forros, forrosIfc.total, forrosIfc.ausentes),
    linha(nome, 'telhados', 'm³', motor.telhados, telhadosIfc.total, telhadosIfc.ausentes),
    linha(nome, 'escadas', 'm³', motor.escadas, escadasIfc.total, escadasIfc.ausentes),
    linha(nome, 'ambientes (volume)', 'm³', motor.ambienteVolume, ambientesIfc.total, ambientesIfc.ausentes),
    linha(nome, 'ambientes (area)', 'm²', motor.ambienteArea, ambienteAreaIfc, ambientesIfc.ausentes),
  ];
  // O volume líquido das paredes só vira linha quando o motor de fato corta piso/laje: é informativo (o corpo do IFC não
  // tem esses cortes), mas mostra a diferença entre os dois caminhos do motor.
  if (Math.abs(motor.paredeLiquida - motor.paredeBruta) > 1e-9) {
    doModelo.splice(1, 0, linha(nome, 'paredes (liquido)', 'm³', motor.paredeLiquida, paredes.total, paredes.ausentes, false));
  }
  linhas.push(...doModelo);

  relatorio[nome] = {
    arquivo,
    erros: (dados.erros ?? []).length,
    falha: falha ?? null,
    contagem: dados.contagem ?? {},
    motor,
    ifc: {
      paredes: paredes.total,
      pisos: pisosIfc.total,
      lajes: lajesIfc.total,
      forros: forrosIfc.total,
      telhados: telhadosIfc.total,
      escadas: escadasIfc.total,
      ambienteVolume: ambientesIfc.total,
      ambienteArea: ambienteAreaIfc,
    },
    linhas: doModelo,
  };
  if (falha) console.error(`[${nome}] ${falha}`);
}

const fmt = (v: number, unidade: Unidade): string => v.toFixed(unidade === 'm³' ? 3 : 2);
const pct = (v: number): string => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)} %`;
const veredito = (l: Linha): string => (l.ok === null ? '—' : l.ok ? 'sim' : l.ausentes > 0 ? 'NÃO*' : 'NÃO');

console.log('| modelo | categoria | motor | IFC | delta % | ok |');
console.log('|---|---|---:|---:|---:|---|');
for (const l of linhas) {
  const unidade = l.unidade === 'm³' ? 'm³' : 'm²';
  console.log(`| ${l.modelo} | ${l.categoria} | ${fmt(l.motor, l.unidade)} ${unidade} | ${fmt(l.ifc, l.unidade)} ${unidade} | ${l.ok === null ? '—' : pct(l.delta)} | ${veredito(l)} |`);
}

const falhas = linhas.filter((l) => l.gate && l.ok === false);
const avaliadas = linhas.filter((l) => l.ok !== null).length;
writeFileSync(
  join(saida, 'compare.json'),
  JSON.stringify(
    {
      data: new Date().toISOString(),
      dataExportacao: DATA.toISOString(),
      estrito: ESTRITO,
      tolerancias: { volume: TOL_VOLUME, area: TOL_AREA },
      avaliadas,
      falhas: falhas.length,
      linhas,
      modelos: relatorio,
    },
    null,
    2,
  ),
);
console.log(`\n${avaliadas} total(is) comparado(s); ${falhas.length} fora da tolerância (volume ${(TOL_VOLUME * 100).toFixed(1)} %, área ${(TOL_AREA * 100).toFixed(1)} %).`);
if (linhas.some((l) => l.ausentes > 0)) console.log('(*) produto esperado sem corpo ou com erro de geometria no IFC.');
if (falhas.length) {
  for (const f of falhas) {
    const corpo = f.ausentes > 0 ? `, ${f.ausentes} sem corpo` : '';
    console.log(`  - ${f.modelo} / ${f.categoria}: motor ${fmt(f.motor, f.unidade)} → IFC ${fmt(f.ifc, f.unidade)} (${pct(f.delta)}${corpo})`);
  }
  if (ESTRITO) {
    console.error('[compare] N2: geometria fora da tolerância.');
    process.exit(1);
  }
  console.log('[compare] relatório apenas (sem --strict): nada falhou.');
}
console.log(`relatório: ${join('test-results', 'ifc-quality', 'compare.json')}`);
