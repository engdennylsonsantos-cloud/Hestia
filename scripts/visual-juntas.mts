/**
 * Ferramenta visual das junções de parede (acabamento/recorte por camada).
 *
 * Para cada cenário × configuração de junção (miter / butt / square) resolve o nível `lv_0`, desenha o `cut` de
 * cada camada de cada parede num SVG (uma imagem por cenário, três painéis lado a lado, ampliando só a caixa de
 * 0,8 m em volta do nó) e imprime uma tabela de checagem numérica:
 *   - anéis externos da silhueta (união de todas as camadas): > 1 é FALHA (o desenho ficou em pedaços);
 *   - buracos da silhueta;
 *   - soma das áreas `cut` de todas as camadas vs área da silhueta: diferença > 1e-5 m² é FALHA (sobreposição
 *     ou falha de cobertura).
 *
 * Saída: SVG em JUNTAS_OUT (padrão: pasta do scratchpad). A conversão para PNG é feita por
 * scripts/visual-juntas.shot.mjs (npm run visual:juntas roda os dois).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { multiArea, union, type MultiPolygon, type Vec2 } from '@hestia/geom';
import { ProjectStore, createEmptyProject, makeWall, type JoinKind, type Project, type Wall } from '@hestia/model';
import { resolveLevel, type ResolvedLevel } from '@hestia/engine';

const OUT =
  process.env.JUNTAS_OUT ??
  '/tmp/claude-0/-home-user/fa79fa58-c26d-5470-9f7b-65480dd9e844/scratchpad/juntas';

const GROSSA = 'wt_ext19';
const FINA = 'wt_alv14';
const KINDS: JoinKind[] = ['miter', 'butt', 'square'];
const TOL = 1e-5;

const S = 600; // px por metro
const BOX = 0.8; // m, lado da caixa ampliada em volta do nó
const PANEL = Math.round(S * BOX); // px
const PAD = 80;
const GAP = 40;
const W = 2 * PAD + 3 * PANEL + 2 * GAP;
const H = 650;

type Lado = 'start' | 'end';

interface Peca {
  id: string;
  typeId: string;
  a: Vec2;
  b: Vec2;
  sag?: number;
}

interface Cenario {
  id: string;
  nome: string;
  nota?: string;
  pecas: Peca[];
  /** Extremidades de cada parede que estão no nó (recebem a configuração de junção). */
  juntas: Array<{ id: string; lados: Lado[] }>;
  /** Nó central (ponto da caixa ampliada). */
  no: Vec2;
}

const polar = (c: Vec2, graus: number, comprimento: number): Vec2 => {
  const r = (graus * Math.PI) / 180;
  return { x: c.x + comprimento * Math.cos(r), y: c.y + comprimento * Math.sin(r) };
};

const O: Vec2 = { x: 0, y: 0 };
const P4: Vec2 = { x: 4, y: 0 };

const CENARIOS: Cenario[] = [
  {
    id: '01-L90-grossa-fina',
    nome: 'L 90°: grossa 19 (fim) + fina 14 (início)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f', typeId: FINA, a: P4, b: { x: 4, y: 3 } },
    ],
    juntas: [
      { id: 'g', lados: ['end'] },
      { id: 'f', lados: ['start'] },
    ],
    no: P4,
  },
  {
    id: '02-L90-fina-grossa',
    nome: 'L 90°: fina 14 (fim) + grossa 19 (início)',
    pecas: [
      { id: 'f', typeId: FINA, a: O, b: P4 },
      { id: 'g', typeId: GROSSA, a: P4, b: { x: 4, y: 3 } },
    ],
    juntas: [
      { id: 'f', lados: ['end'] },
      { id: 'g', lados: ['start'] },
    ],
    no: P4,
  },
  {
    id: '03-L45',
    nome: 'L 45° (ângulo interno): grossa + fina',
    nota: 'ângulo interno 45° entre as paredes (braço da fina a 135°)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f', typeId: FINA, a: P4, b: polar(P4, 135, 3) },
    ],
    juntas: [
      { id: 'g', lados: ['end'] },
      { id: 'f', lados: ['start'] },
    ],
    no: P4,
  },
  {
    id: '04-L120',
    nome: 'L 120° (ângulo interno): grossa + fina',
    nota: 'ângulo interno 120° entre as paredes (braço da fina a 60°)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f', typeId: FINA, a: P4, b: polar(P4, 60, 3) },
    ],
    juntas: [
      { id: 'g', lados: ['end'] },
      { id: 'f', lados: ['start'] },
    ],
    no: P4,
  },
  {
    id: '05-T',
    nome: 'T: grossa passante + fina chegando',
    nota: 'configuração ignorada no T (docs/05 §9 item 4: sempre encosto)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: { x: -2, y: 0 }, b: { x: 2, y: 0 } },
      { id: 'f', typeId: FINA, a: O, b: { x: 0, y: 3 } },
    ],
    juntas: [{ id: 'f', lados: ['start'] }],
    no: O,
  },
  {
    id: '06-Y120',
    nome: 'Y: 3 grossas iguais a 120°',
    nota: 'nó de 3 paredes: starNode, configuração não lida',
    pecas: [
      { id: 'a', typeId: GROSSA, a: O, b: polar(O, 90, 3) },
      { id: 'b', typeId: GROSSA, a: O, b: polar(O, 210, 3) },
      { id: 'c', typeId: GROSSA, a: O, b: polar(O, 330, 3) },
    ],
    juntas: [
      { id: 'a', lados: ['start'] },
      { id: 'b', lados: ['start'] },
      { id: 'c', lados: ['start'] },
    ],
    no: O,
  },
  {
    id: '07-NO3',
    nome: 'nó de 3: grossa (0°) + fina (90°) + fina (225°)',
    nota: 'nó de 3 paredes: starNode, configuração não lida',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f1', typeId: FINA, a: O, b: { x: 0, y: 3 } },
      { id: 'f2', typeId: FINA, a: O, b: { x: -2, y: -2 } },
    ],
    juntas: [
      { id: 'g', lados: ['start'] },
      { id: 'f1', lados: ['start'] },
      { id: 'f2', lados: ['start'] },
    ],
    no: O,
  },
  {
    id: '08-arm-0-60-120',
    nome: 'nó de 3 paredes a 0°, 60° e 120°',
    nota: 'nó de 3 paredes: starNode, configuração não lida',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f1', typeId: FINA, a: O, b: polar(O, 60, 3) },
      { id: 'f2', typeId: FINA, a: O, b: polar(O, 120, 3) },
    ],
    juntas: [
      { id: 'g', lados: ['start'] },
      { id: 'f1', lados: ['start'] },
      { id: 'f2', lados: ['start'] },
    ],
    no: O,
  },
  {
    id: '09-X4',
    nome: 'X: 4 paredes a partir do centro (45°, 135°, 225°, 315°)',
    nota: 'nó de 4 paredes: starNode, configuração não lida',
    pecas: [
      { id: 'a', typeId: GROSSA, a: O, b: polar(O, 45, 3) },
      { id: 'b', typeId: FINA, a: O, b: polar(O, 135, 3) },
      { id: 'c', typeId: GROSSA, a: O, b: polar(O, 225, 3) },
      { id: 'd', typeId: FINA, a: O, b: polar(O, 315, 3) },
    ],
    juntas: [
      { id: 'a', lados: ['start'] },
      { id: 'b', lados: ['start'] },
      { id: 'c', lados: ['start'] },
      { id: 'd', lados: ['start'] },
    ],
    no: O,
  },
  {
    id: '10-L60',
    nome: 'L 60° (ângulo interno): grossa + fina',
    nota: 'ângulo interno 60° entre as paredes (braço da fina a 120°)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f', typeId: FINA, a: P4, b: polar(P4, 120, 3) },
    ],
    juntas: [
      { id: 'g', lados: ['end'] },
      { id: 'f', lados: ['start'] },
    ],
    no: P4,
  },
  {
    id: '11-L75',
    nome: 'L 75° (ângulo interno): grossa + fina',
    nota: 'ângulo interno 75° entre as paredes (braço da fina a 105°)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4 },
      { id: 'f', typeId: FINA, a: P4, b: polar(P4, 105, 3) },
    ],
    juntas: [
      { id: 'g', lados: ['end'] },
      { id: 'f', lados: ['start'] },
    ],
    no: P4,
  },
  {
    id: '12-T45',
    nome: 'T oblíquo 45°: grossa passante + fina chegando a 45°',
    nota: 'ramal a 45° da passante; corte oblíquo na face de cada camada',
    pecas: [
      { id: 'g', typeId: GROSSA, a: { x: -2, y: 0 }, b: { x: 2, y: 0 } },
      { id: 'f', typeId: FINA, a: O, b: polar(O, 45, 3) },
    ],
    juntas: [{ id: 'f', lados: ['start'] }],
    no: O,
  },
  {
    id: '13-T120',
    nome: 'T oblíquo 120°: grossa passante + fina chegando a 120°',
    nota: 'ramal a 120° da passante (lado esquerdo); corte oblíquo na face de cada camada',
    pecas: [
      { id: 'g', typeId: GROSSA, a: { x: -2, y: 0 }, b: { x: 2, y: 0 } },
      { id: 'f', typeId: FINA, a: O, b: polar(O, 120, 3) },
    ],
    juntas: [{ id: 'f', lados: ['start'] }],
    no: O,
  },
  {
    id: '14-L-curva',
    nome: 'L 90° com parede grossa curva (sag 0,5 m) + fina',
    nota: 'grossa de 4 m com flecha 0,5 m (arco para dentro do L)',
    pecas: [
      { id: 'g', typeId: GROSSA, a: O, b: P4, sag: 0.5 },
      { id: 'f', typeId: FINA, a: P4, b: { x: 4, y: 3 } },
    ],
    juntas: [
      { id: 'g', lados: ['end'] },
      { id: 'f', lados: ['start'] },
    ],
    no: P4,
  },
];

function montar(c: Cenario, kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const peca of c.pecas) {
    s.exec({
      type: 'addWall',
      wall: makeWall({
        id: peca.id,
        typeId: peca.typeId,
        levelId: 'lv_0',
        a: peca.a,
        b: peca.b,
        sag: peca.sag ?? 0,
      }),
    });
  }
  const p = s.project;
  const elements = { ...p.elements };
  for (const j of c.juntas) {
    const w = elements[j.id] as Wall;
    elements[j.id] = {
      ...w,
      joinStart: j.lados.includes('start') ? { kind, flip: false } : w.joinStart,
      joinEnd: j.lados.includes('end') ? { kind, flip: false } : w.joinEnd,
    };
  }
  return { ...p, elements } as Project;
}

interface Checagem {
  kind: JoinKind;
  res: ResolvedLevel;
  externos: number;
  buracos: number;
  areaSilh: number;
  soma: number;
  diff: number;
  falhas: string[];
  silhueta: MultiPolygon;
}

function checar(c: Cenario, kind: JoinKind): Checagem {
  const res = resolveLevel(montar(c, kind), 'lv_0', new Map());
  const camadas = c.pecas.flatMap((p) => res.walls[p.id]?.layers.filter((l) => l.cut.length > 0) ?? []);
  const silhueta = union(...camadas.map((l) => l.cut));
  const externos = silhueta.length;
  const buracos = silhueta.reduce((s, poly) => s + Math.max(0, poly.length - 1), 0);
  const areaSilh = multiArea(silhueta);
  const soma = camadas.reduce((s, l) => s + multiArea(l.cut), 0);
  const diff = soma - areaSilh;
  const falhas: string[] = [];
  if (externos > 1) falhas.push(`${externos} anéis externos`);
  if (Math.abs(diff) > TOL) falhas.push(`soma-silh ${diff.toExponential(2)} m²`);
  return { kind, res, externos, buracos, areaSilh, soma, diff, falhas, silhueta };
}

/* ---------- SVG ---------- */

const PALETA = [
  '#e6550d', '#3182bd', '#31a354', '#756bb1', '#fdae6b', '#6baed6', '#a1d99b', '#bcbddc',
  '#d62728', '#8c564b', '#17becf', '#e377c2', '#bdbd22', '#7f7f7f',
];
const cores = new Map<string, string>();
const corDo = (materialId: string): string => {
  let cor = cores.get(materialId);
  if (!cor) {
    cor = PALETA[cores.size % PALETA.length]!;
    cores.set(materialId, cor);
  }
  return cor;
};

const f2 = (n: number): string => n.toFixed(2);

function caminho(m: MultiPolygon, X: (x: number) => number, Y: (y: number) => number): string {
  return m
    .map((poly) =>
      poly.map((ring) => 'M' + ring.map((p) => `${f2(X(p.x))} ${f2(Y(p.y))}`).join('L') + 'Z').join(''),
    )
    .join('');
}

function painel(c: Cenario, r: Checagem, i: number, ox: number, oy: number): { svg: string; materiais: Set<string> } {
  const bx0 = c.no.x - BOX / 2;
  const by1 = c.no.y + BOX / 2;
  const X = (x: number): number => ox + (x - bx0) * S;
  const Y = (y: number): number => oy + (by1 - y) * S;
  const clipId = `clip-${c.id}-${r.kind}`;
  const materiais = new Set<string>();
  const partes: string[] = [];

  partes.push(
    `<defs><clipPath id="${clipId}"><rect x="${ox}" y="${oy}" width="${PANEL}" height="${PANEL}"/></clipPath></defs>`,
    `<rect x="${ox}" y="${oy}" width="${PANEL}" height="${PANEL}" fill="#ffffff"/>`,
    `<g clip-path="url(#${clipId})">`,
  );
  for (const peca of c.pecas) {
    const rw = r.res.walls[peca.id];
    if (!rw) continue;
    for (const l of rw.layers) {
      if (l.cut.length === 0) continue;
      materiais.add(l.materialId);
      partes.push(
        `<path d="${caminho(l.cut, X, Y)}" fill="${corDo(l.materialId)}" fill-opacity="0.85" ` +
          `fill-rule="evenodd" stroke="#1b1b1b" stroke-width="0.7" stroke-linejoin="round">` +
          `<title>${peca.id} ${l.materialId} camada ${l.layerIndex}</title></path>`,
      );
    }
  }
  partes.push(
    `<path d="${caminho(r.silhueta, X, Y)}" fill="none" stroke="#9aa0a6" stroke-width="1.5" stroke-dasharray="6 3"/>`,
  );
  for (const peca of c.pecas) {
    partes.push(
      `<line x1="${f2(X(peca.a.x))}" y1="${f2(Y(peca.a.y))}" x2="${f2(X(peca.b.x))}" y2="${f2(Y(peca.b.y))}" ` +
        `stroke="#1565c0" stroke-width="1" stroke-dasharray="3 3" opacity="0.7"/>`,
    );
  }
  partes.push('</g>');
  partes.push(
    `<rect x="${ox}" y="${oy}" width="${PANEL}" height="${PANEL}" fill="none" stroke="#000" stroke-width="1"/>`,
    `<circle cx="${f2(X(c.no.x))}" cy="${f2(Y(c.no.y))}" r="3" fill="#d32f2f"/>`,
  );

  const ok = r.falhas.length === 0;
  const rotulo =
    `${r.kind}  ext=${r.externos}  furos=${r.buracos}  Δ=${r.diff.toExponential(1)} m²` +
    (ok ? '  OK' : `  FALHA (${r.falhas.join('; ')})`);
  partes.push(
    `<text x="${ox}" y="${oy - 12}" font-family="sans-serif" font-size="15" font-weight="bold" ` +
      `fill="${ok ? '#1b5e20' : '#c62828'}">${i + 1}. ${rotulo}</text>`,
  );
  return { svg: partes.join('\n'), materiais };
}

function svgCenario(c: Cenario, resultados: Checagem[]): string {
  const cabeca: string[] = [];
  cabeca.push(
    `<text x="${PAD}" y="34" font-family="sans-serif" font-size="20" font-weight="bold" fill="#111">${c.nome}</text>`,
    `<text x="${PAD}" y="56" font-family="sans-serif" font-size="13" fill="#555">` +
      `caixa 0,8 m em volta do nó (${f2(c.no.x)}; ${f2(c.no.y)}) · 600 px/m · y invertido · ` +
      `contorno escuro = emendas entre camadas · tracejado cinza = silhueta · azul = eixos` +
      (c.nota ? ` · ${c.nota}` : '') +
      `</text>`,
  );
  const corpo: string[] = [];
  const materiais = new Set<string>();
  resultados.forEach((r, i) => {
    const ox = PAD + i * (PANEL + GAP);
    const oy = 120;
    const p = painel(c, r, i, ox, oy);
    p.materiais.forEach((m) => materiais.add(m));
    corpo.push(p.svg);
  });
  const legenda: string[] = [];
  let lx = PAD;
  for (const m of [...materiais].sort()) {
    legenda.push(
      `<rect x="${lx}" y="${H - 40}" width="16" height="16" fill="${corDo(m)}" stroke="#1b1b1b" stroke-width="0.7"/>` +
        `<text x="${lx + 22}" y="${H - 27}" font-family="sans-serif" font-size="13" fill="#222">${m}</text>`,
    );
    lx += 40 + m.length * 8;
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    ...cabeca,
    ...corpo,
    ...legenda,
    '</svg>',
  ].join('\n');
}

/* ---------- execução ---------- */

mkdirSync(OUT, { recursive: true });
const linhasTabela: string[] = [];
const cabecalho =
  'cenário'.padEnd(20) +
  'config'.padEnd(8) +
  'ext'.padStart(5) +
  'furos'.padStart(7) +
  'silh m²'.padStart(12) +
  'soma cut m²'.padStart(13) +
  'soma-silh m²'.padStart(15) +
  '  status';
linhasTabela.push(cabecalho, '-'.repeat(cabecalho.length + 6));
const falhas: string[] = [];

for (const c of CENARIOS) {
  const resultados = KINDS.map((kind) => checar(c, kind));
  const svg = svgCenario(c, resultados);
  const arquivo = join(OUT, `${c.id}.svg`);
  writeFileSync(arquivo, svg, 'utf8');
  for (const r of resultados) {
    const ok = r.falhas.length === 0;
    if (!ok) falhas.push(`${c.id} ${r.kind}: ${r.falhas.join('; ')}`);
    linhasTabela.push(
      c.id.padEnd(20) +
        r.kind.padEnd(8) +
        String(r.externos).padStart(5) +
        String(r.buracos).padStart(7) +
        r.areaSilh.toFixed(6).padStart(12) +
        r.soma.toFixed(6).padStart(13) +
        r.diff.toExponential(2).padStart(15) +
        `  ${ok ? 'OK' : 'FALHA: ' + r.falhas.join('; ')}`,
    );
  }
}

console.log(linhasTabela.join('\n'));
console.log(
  falhas.length
    ? `\n${falhas.length} FALHA(S):\n  ${falhas.join('\n  ')}`
    : '\nTodas as checagens OK.',
);
console.log(`\nSVG em ${OUT}`);
