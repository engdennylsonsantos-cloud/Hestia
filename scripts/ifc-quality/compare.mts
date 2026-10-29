/**
 * N2 (geometria) da exportação IFC: compara a geometria RESOLVIDA que o exportador recebeu (`ifcGeometryOf`, a mesma
 * entrada do `projectIfc`) com o que o IfcOpenShell mede no IFC exportado, por categoria (paredes, pisos, lajes, forros,
 * telhados, escadas e ambientes).
 *
 * O par é, dos dois lados, a MESMA coisa: o sólido que o exportador escreveu. O lado esperado é calculado aqui a partir
 * de `geo = ifcGeometryOf(projeto)` com as mesmas fórmulas do `ifcSolids.ts`; o lado do IFC é o volume/área que o
 * `validate.py --geometry` mede com `ifcopenshell.geom` em cada produto. O vínculo entre os dois é o GlobalId
 * determinístico do exportador (`wall:<id>`, `floor:<id>`, `slab:<id>`, `ceiling:<id>`, `roofslab:<id>:<água>`,
 * `flight:<id>:<lance>`, `landing:<id>:<patamar>`, `space:<id>`), calculado aqui com o mesmo `ifcGuid`. Produto esperado
 * que o IfcOpenShell não mediu (sem corpo ou com erro de geometria) reprova a linha mesmo com volume igual.
 *
 * Fórmula por categoria (m³, salvo indicado):
 * - paredes: Σ footprints (área do polígono com furos, união das camadas) × `height`, MENOS as caixas de vão que o
 *   exportador liga à parede por IFCRELVOIDSELEMENT (`geo.openings`: `roughWidth` × `thickness` × `roughHeight`,
 *   recortadas pela altura da parede e pela interseção em planta com o footprint). O corpo do IFCWALL é a extrusão do
 *   contorno e o IfcOpenShell subtrai os vãos brutos ao montar a forma; o retorno de acabamento do motor não entra.
 * - pisos/lajes/forros: Σ prismas de `geo.floors/slabs/ceilings` com a fórmula exata do prisma (abaixo).
 * - telhados: Σ `geo.roofs[].planes` (uma IFCSLAB .ROOF. por água; o IFCROOF não tem corpo), mesma fórmula.
 * - escadas: Σ peças de cada lance (`geo.stairs[].flights[].pieces`, no IFCSTAIRFLIGHT) e cada patamar
 *   (`landings`, na IFCSLAB .LANDING.); o IFCSTAIR não tem corpo. A chegada entra porque o exportador a escreve.
 * - ambientes: `resolveRooms` como o `ifcSpaces.ts` usa — área do contorno resolvido (com furos) × `ceilingHeight`; a
 *   área esperada é a área do contorno e a medida é o volume do IFCSPACE ÷ pé-direito (a `area` do IfcOpenShell é a
 *   superfície total do sólido, não a área de piso).
 *
 * Volume de um `IfcPrism` (topo e fundo são planos z = a·x + b·y + c): ∫ (topo − fundo) dA = (c_t − c_b)·A +
 * (a_t − a_b)·∫x dA + (b_t − b_b)·∫y dA. Para prisma de cota constante isso é área × espessura; para telhado e para as
 * peças da escada monolítica (fundo inclinado) a fórmula é a mesma e exata. Espelha o filtro do `prismsShape`: prisma
 * sem contorno válido, ou de cota constante com topo ≤ fundo, não é escrito e vale 0.
 *
 * Os quantitativos SEMÂNTICOS do motor (`quantifyLevel`, `quantifyFloors`, `quantifySlabs`, `quantifyCeilings`,
 * `quantifyRoofs`, `stairQuantities`) ficam no JSON só como INFORMAÇÃO (`motor`): eles descontam piso/laje, vão e
 * chegada, e por isso não são o par da exportação.
 *
 * Uso:
 *   npm run ifc:compare             relata (nunca falha)
 *   npm run ifc:compare -- --strict falha quando um total passa da tolerância
 *
 * Tolerâncias: volume 0,5 %; área 1 % — contra a geometria esperada, não contra o quantitativo. Categoria sem geometria
 * esperada (≈0) é ignorada (não conta como falha). Escreve `test-results/ifc-quality/compare.json`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { asMulti, intersection, multiArea, type MultiPolygon, type Ring } from '@hestia/geom';
import { createEmptyProject, isOpening, makeCeiling, makeRoom, makeWall, ProjectStore, type Project } from '../../packages/model/src/index.ts';
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
import type { IfcGeometry, IfcPoint, IfcPolygon, IfcPrism, IfcRing } from '../../packages/io/src/ifc/ifcTypes.ts';

const raiz = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const saida = join(raiz, 'test-results', 'ifc-quality');
/** Data fixa do cabeçalho STEP: o mesmo projeto gera o mesmo IFC. */
const DATA = new Date('2026-10-29T00:00:00Z');
const ESTRITO = process.argv.includes('--strict');
/** Tolerância relativa do total de volume (0,5 %). */
const TOL_VOLUME = 0.005;
/** Tolerância relativa do total de área (1 %). */
const TOL_AREA = 0.01;
const EPS = 1e-9;

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

/** Linha da tabela: um total esperado (geometria exportada) contra o mesmo total medido no IFC. */
interface Linha {
  modelo: string;
  categoria: string;
  unidade: Unidade;
  esperado: number;
  ifc: number;
  /** Delta relativo `(ifc - esperado) / esperado` (0,01 = 1 %). */
  delta: number;
  /** `null` = categoria sem geometria esperada (ignorada). */
  ok: boolean | null;
  /** Entra no `--strict`. */
  gate: boolean;
  /** Produtos esperados que o IfcOpenShell não mediu (sem corpo ou com erro de geometria). */
  ausentes: number;
}

/**
 * Projeto de qualidade com ambientes, forro e grades: os templates do Hestia não criam `Room`, `Ceiling` nem `Grid`.
 * Tem de ser o MESMO de `export-fixtures.mts` (mesmo arquivo `casa-ambientes.ifc`, mesmo texto STEP).
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
  const ceilingTypeId = Object.keys(store.project.ceilingTypes)[0]!;
  store.exec({
    type: 'addCeiling',
    ceiling: makeCeiling({
      id: 'qc1',
      typeId: ceilingTypeId,
      levelId: 'lv_0',
      boundary: anel.map(([x, y]) => ({ x, y })),
      heightOffset: 2.6,
    }),
  });
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

/** Linha da tabela; categoria sem geometria esperada (≈0) fica fora do gate e sem veredito. */
function linha(modelo: string, categoria: string, unidade: Unidade, esperado: number, ifc: number, ausentes: number): Linha {
  const semDado = Math.abs(esperado) < 1e-6;
  const delta = semDado ? 0 : (ifc - esperado) / esperado;
  const tolerancia = unidade === 'm³' ? TOL_VOLUME : TOL_AREA;
  return { modelo, categoria, unidade, esperado, ifc, delta, ok: semDado ? null : Math.abs(delta) <= tolerancia && ausentes === 0, gate: !semDado, ausentes };
}

// ---------------------------------------------------------------------------------------------------------------
// Lado esperado: a geometria que o exportador recebeu, com as fórmulas do `ifcSolids.ts`
// ---------------------------------------------------------------------------------------------------------------

/** Anel sem vértices repetidos (consecutivos) nem o de fechamento; menos de 3 vértices devolve vazio (igual ao io). */
function cleanRing(ring: readonly IfcPoint[]): IfcRing {
  const out: IfcPoint[] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) continue;
    out.push({ x: p.x, y: p.y });
  }
  const first = out[0];
  const end = out[out.length - 1];
  if (out.length > 1 && first && end && Math.abs(first.x - end.x) < EPS && Math.abs(first.y - end.y) < EPS) out.pop();
  return out.length >= 3 ? out : [];
}

/** Polígono limpo: contorno com área e furos com área (o `normalizePolygon` do io também reorienta; área não muda). */
function cleanPolygon(polygon: IfcPolygon): IfcPolygon {
  const [outer, ...holes] = polygon;
  const o = outer ? cleanRing(outer) : [];
  if (o.length === 0) return [];
  return [o, ...holes.map(cleanRing).filter((h) => h.length >= 3)];
}

/** Área e centróide de um anel simples (fórmula do polígono, como o `ringMoments` da escada). */
function ringMoments(ring: IfcRing): { area: number; cx: number; cy: number } {
  let twiceSigned = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const cross = p.x * q.y - q.x * p.y;
    twiceSigned += cross;
    sx += (p.x + q.x) * cross;
    sy += (p.y + q.y) * cross;
  }
  if (Math.abs(twiceSigned) < 1e-15) return { area: 0, cx: ring[0]?.x ?? 0, cy: ring[0]?.y ?? 0 };
  return { area: Math.abs(twiceSigned) / 2, cx: sx / (3 * twiceSigned), cy: sy / (3 * twiceSigned) };
}

/** Área do polígono com furos e os momentos `∫x dA`/`∫y dA` (contorno menos furos). */
function polygonMoments(polygon: IfcPolygon): { area: number; mx: number; my: number } {
  let area = 0;
  let mx = 0;
  let my = 0;
  polygon.forEach((ring, i) => {
    const m = ringMoments(ring);
    const sign = i === 0 ? 1 : -1;
    area += sign * m.area;
    mx += sign * m.area * m.cx;
    my += sign * m.area * m.cy;
  });
  return { area, mx, my };
}

/** Volume exato do prisma (topo e fundo planos) — a integral de (topo − fundo) sobre o polígono. */
function prismVolume(pr: IfcPrism): number {
  const poly = cleanPolygon(pr.polygon);
  if (poly.length === 0) return 0;
  // Mesmo filtro do `prismsShape`: prisma de cota constante só sai com topo acima do fundo.
  const flat = pr.top.a === 0 && pr.top.b === 0 && pr.bottom.a === 0 && pr.bottom.b === 0;
  if (flat && !(pr.top.c > pr.bottom.c)) return 0;
  const m = polygonMoments(poly);
  return (pr.top.c - pr.bottom.c) * m.area + (pr.top.a - pr.bottom.a) * m.mx + (pr.top.b - pr.bottom.b) * m.my;
}

/** Volume de uma parede: extrusão de cada footprint (união das camadas) pela altura resolvida. */
const wallVolume = (w: { footprints: IfcPolygon[]; height: number }): number =>
  w.footprints.reduce((s, f) => s + polygonMoments(cleanPolygon(f)).area, 0) * w.height;

/**
 * Volume que o exportador fura de cada parede: cada vão vira uma caixa (IFCOPENINGELEMENT + IFCRELVOIDSELEMENT) de
 * `roughWidth` × `thickness` × `roughHeight` a partir de `roughBottomZ`, centrada no eixo da parede. O IfcOpenShell
 * subtrai essa caixa do corpo da parede, então o volume removido é a INTERSEÇÃO da caixa com o footprint em planta ×
 * a sobreposição vertical com a parede (peitoril acima do topo, por exemplo, não corta nada). A interseção importa no
 * `predio10`, onde a união das camadas tem reentrâncias nas junções e a caixa do vão só cabe em parte.
 */
function vaosPorParede(projeto: Project, geo: IfcGeometry): Map<string, number> {
  const porParede = new Map<string, number>();
  const paredes = new Map(geo.walls.map((w) => [w.wallId as string, w]));
  for (const o of geo.openings) {
    const el = projeto.elements[o.openingId];
    if (!isOpening(el)) continue;
    // Sem tipo a abertura não é escrita (`addOpenings` desiste) e não há furo.
    if (!projeto.openingTypes[el.typeId]) continue;
    const w = paredes.get(el.hostId);
    if (!w) continue;
    const altura = Math.max(0, Math.min(o.roughBottomZ + o.roughHeight, w.baseZ + w.height) - Math.max(o.roughBottomZ, w.baseZ));
    if (altura <= 0) continue;
    // Caixa do vão em planta: x ao longo de `u`, y na espessura (o `rectOf` centrado no eixo da parede).
    const u = o.u;
    const n = { x: -u.y, y: u.x };
    const hw = o.roughWidth / 2;
    const ht = o.thickness / 2;
    const canto = (a: number, b: number): IfcPoint => ({ x: o.center.x + u.x * a + n.x * b, y: o.center.y + u.y * a + n.y * b });
    const caixa: Ring = [canto(-hw, -ht), canto(hw, -ht), canto(hw, ht), canto(-hw, ht)];
    let area = 0;
    for (const f of w.footprints) area += multiArea(intersection(asMulti(caixa), [f] as MultiPolygon));
    if (area <= 0) continue;
    acumular(porParede, w.wallId, area * altura);
  }
  return porParede;
}

/** Acumula `valor` na chave `guid` do mapa (duas peças podem dividir o mesmo GlobalId). */
function acumular(mapa: Map<string, number>, guid: string, valor: number): void {
  mapa.set(guid, (mapa.get(guid) ?? 0) + valor);
}

/** Soma dos valores do mapa. */
const total = (mapa: ReadonlyMap<string, number>): number => [...mapa.values()].reduce((s, v) => s + v, 0);

/** Lado esperado por categoria: GlobalId → volume (m³); ambientes também guardam a área e o pé-direito. */
interface Esperado {
  paredes: Map<string, number>;
  pisos: Map<string, number>;
  lajes: Map<string, number>;
  forros: Map<string, number>;
  telhados: Map<string, number>;
  escadas: Map<string, number>;
  /** GlobalId do IFCSPACE → área do contorno (m²) e pé-direito da extrusão (m). */
  ambientes: Map<string, { area: number; altura: number }>;
}

/** Contorno do IFCSPACE como o `spacePolygon` do io: anel externo e furos com pelo menos 3 vértices. */
function spacePolygon(polygon: ReadonlyArray<ReadonlyArray<IfcPoint>>): IfcPolygon {
  const [outer, ...holes] = polygon;
  const o = outer ? cleanRing(outer) : [];
  if (o.length === 0) return [];
  return [o, ...holes.map(cleanRing).filter((h) => h.length >= 3)];
}

/**
 * Geometria esperada do projeto inteiro: a mesma `ifcGeometryOf` que o `projectIfc` usa. Cada chave é o GlobalId do
 * produto que o exportador escreve.
 */
function esperadoDe(projeto: Project): Esperado {
  const geo = ifcGeometryOf(projeto);
  const esperado: Esperado = {
    paredes: new Map(),
    pisos: new Map(),
    lajes: new Map(),
    forros: new Map(),
    telhados: new Map(),
    escadas: new Map(),
    ambientes: new Map(),
  };
  const vaos = vaosPorParede(projeto, geo);
  for (const w of geo.walls) acumular(esperado.paredes, ifcGuid(`wall:${w.wallId}`), wallVolume(w) - (vaos.get(w.wallId) ?? 0));
  for (const f of geo.floors) {
    const guid = ifcGuid(`floor:${f.floorId}`);
    for (const pr of f.prisms) acumular(esperado.pisos, guid, prismVolume(pr));
  }
  for (const s of geo.slabs) {
    const guid = ifcGuid(`slab:${s.slabId}`);
    for (const pr of s.prisms) acumular(esperado.lajes, guid, prismVolume(pr));
  }
  for (const c of geo.ceilings ?? []) {
    const guid = ifcGuid(`ceiling:${c.ceilingId}`);
    for (const pr of c.prisms) acumular(esperado.forros, guid, prismVolume(pr));
  }
  for (const r of geo.roofs) {
    r.planes.forEach((pr, i) => acumular(esperado.telhados, ifcGuid(`roofslab:${r.roofId}:${i}`), prismVolume(pr)));
  }
  for (const s of geo.stairs) {
    for (const f of s.flights) {
      const guid = ifcGuid(`flight:${s.stairId}:${f.componentIndex}`);
      for (const pr of f.pieces) acumular(esperado.escadas, guid, prismVolume(pr));
    }
    s.landings.forEach((pr, i) => acumular(esperado.escadas, ifcGuid(`landing:${s.stairId}:${i}`), prismVolume(pr)));
  }
  // Ambientes: o io lê `resolveRooms` e extruda o contorno resolvido entre `heightOffset` e o pé-direito.
  for (const level of projeto.levels) {
    for (const r of resolveRooms(projeto, level.id)) {
      if (!r.polygon || r.polygon.length === 0 || !(r.ceilingHeight > 0)) continue;
      const poly = spacePolygon(r.polygon);
      if (poly.length === 0) continue;
      esperado.ambientes.set(ifcGuid(`space:${r.roomId}`), { area: polygonMoments(poly).area, altura: r.ceilingHeight });
    }
  }
  return esperado;
}

/** Totais SEMÂNTICOS do motor (informação): descontam piso/laje, vão e chegada; NÃO entram no gate. */
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
  const esperado = esperadoDe(projeto);

  const paredes = somar(geometria, new Set(esperado.paredes.keys()), 'volume');
  const pisosIfc = somar(geometria, new Set(esperado.pisos.keys()), 'volume');
  const lajesIfc = somar(geometria, new Set(esperado.lajes.keys()), 'volume');
  const forrosIfc = somar(geometria, new Set(esperado.forros.keys()), 'volume');
  const telhadosIfc = somar(geometria, new Set(esperado.telhados.keys()), 'volume');
  const escadasIfc = somar(geometria, new Set(esperado.escadas.keys()), 'volume');
  const ambientesIfc = somar(geometria, new Set(esperado.ambientes.keys()), 'volume');
  // Área do ambiente pela geometria: o volume medido ÷ pé-direito da extrusão (a `area` do IfcOpenShell é a superfície
  // total do sólido, não a área de piso).
  let ambienteAreaIfc = 0;
  for (const [guid, { altura }] of esperado.ambientes) ambienteAreaIfc += (geometria[guid]?.volume ?? 0) / altura;
  const ambienteAreaEsperada = [...esperado.ambientes.values()].reduce((s, a) => s + a.area, 0);
  const ambienteVolumeEsperado = [...esperado.ambientes.values()].reduce((s, a) => s + a.area * a.altura, 0);

  const doModelo: Linha[] = [
    linha(nome, 'paredes', 'm³', total(esperado.paredes), paredes.total, paredes.ausentes),
    linha(nome, 'pisos', 'm³', total(esperado.pisos), pisosIfc.total, pisosIfc.ausentes),
    linha(nome, 'lajes', 'm³', total(esperado.lajes), lajesIfc.total, lajesIfc.ausentes),
    linha(nome, 'forros', 'm³', total(esperado.forros), forrosIfc.total, forrosIfc.ausentes),
    linha(nome, 'telhados', 'm³', total(esperado.telhados), telhadosIfc.total, telhadosIfc.ausentes),
    linha(nome, 'escadas', 'm³', total(esperado.escadas), escadasIfc.total, escadasIfc.ausentes),
    linha(nome, 'ambientes (volume)', 'm³', ambienteVolumeEsperado, ambientesIfc.total, ambientesIfc.ausentes),
    linha(nome, 'ambientes (area)', 'm²', ambienteAreaEsperada, ambienteAreaIfc, ambientesIfc.ausentes),
  ];
  linhas.push(...doModelo);

  relatorio[nome] = {
    arquivo,
    erros: (dados.erros ?? []).length,
    falha: falha ?? null,
    contagem: dados.contagem ?? {},
    esperado: {
      paredes: total(esperado.paredes),
      pisos: total(esperado.pisos),
      lajes: total(esperado.lajes),
      forros: total(esperado.forros),
      telhados: total(esperado.telhados),
      escadas: total(esperado.escadas),
      ambienteVolume: ambienteVolumeEsperado,
      ambienteArea: ambienteAreaEsperada,
      /** GlobalId → volume esperado (m³), para auditar uma linha. */
      produtos: Object.fromEntries(
        [...esperado.paredes, ...esperado.pisos, ...esperado.lajes, ...esperado.forros, ...esperado.telhados, ...esperado.escadas].map(
          ([guid, volume]) => [guid, volume],
        ),
      ),
    },
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
    /** Informação: quantitativos semânticos do motor (não são o par da exportação e não entram no gate). */
    motor: totaisDoMotor(projeto),
    linhas: doModelo,
  };
  if (falha) console.error(`[${nome}] ${falha}`);
}

const fmt = (v: number, unidade: Unidade): string => v.toFixed(unidade === 'm³' ? 3 : 2);
const pct = (v: number): string => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)} %`;
const veredito = (l: Linha): string => (l.ok === null ? '—' : l.ok ? 'sim' : l.ausentes > 0 ? 'NÃO*' : 'NÃO');

console.log('| modelo | categoria | esperado | IFC | delta % | ok |');
console.log('|---|---|---:|---:|---:|---|');
for (const l of linhas) {
  const unidade = l.unidade === 'm³' ? 'm³' : 'm²';
  console.log(`| ${l.modelo} | ${l.categoria} | ${fmt(l.esperado, l.unidade)} ${unidade} | ${fmt(l.ifc, l.unidade)} ${unidade} | ${l.ok === null ? '—' : pct(l.delta)} | ${veredito(l)} |`);
}

const falhas = linhas.filter((l) => l.gate && l.ok === false);
const avaliadas = linhas.filter((l) => l.ok !== null).length;
writeFileSync(
  join(saida, 'compare.json'),
  JSON.stringify(
    {
      data: new Date().toISOString(),
      dataExportacao: DATA.toISOString(),
      fonte: 'ifcGeometryOf (geometria exportada) × IfcOpenShell validate.py --geometry',
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
    console.log(`  - ${f.modelo} / ${f.categoria}: esperado ${fmt(f.esperado, f.unidade)} → IFC ${fmt(f.ifc, f.unidade)} (${pct(f.delta)}${corpo})`);
  }
  if (ESTRITO) {
    console.error('[compare] N2: geometria exportada fora da tolerância.');
    process.exit(1);
  }
  console.log('[compare] relatório apenas (sem --strict): divergências listadas, sem falhar.');
}
console.log(`relatório: ${join('test-results', 'ifc-quality', 'compare.json')}`);
