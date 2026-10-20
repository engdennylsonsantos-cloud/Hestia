import { describe, expect, it } from 'vitest';
import { intersection, multiArea, type MultiPolygon, type Vec2 } from '@hestia/geom';
import {
  ProjectStore,
  createEmptyProject,
  makeWall,
  wallType,
  type JoinKind,
  type LayerFunction,
  type Project,
  type Wall,
} from '@hestia/model';
import { resolveLevel } from './index.ts';

/**
 * Medição (não correção) da junção de canto entre uma parede grossa (19 cm de bloco) e uma fina (14 cm), com
 * acabamentos de espessuras diferentes nas duas faces.
 *
 * Métrica: redistribuição de área por material numa caixa em volta da junção. Para cada camada das paredes do
 * cenário, `multiArea(intersection(layer.cut, caixa))`, agregada por `materialId`. A soma diz quanto da caixa cada
 * material ocupa; o que muda entre as configurações de junção é QUEM ocupa a região do canto: o bloco (núcleo) da
 * grossa ou a tinta/reboco da fina. Nada aqui julga qual desenho é o certo — só mede.
 *
 * ARMADILHA: `intersection(camadaA.cut, camadaB.cut)` NÃO serve de métrica. `cut` já vem recortado pelo pintor
 * (`paint` em resolve.ts ordena por prioridade crescente e subtrai de cada camada as de prioridade menor já aceitas),
 * então duas camadas de prioridades diferentes têm interseção ZERO por construção. As guardas nesse sentido em
 * quinas.test.ts eram vacuamente verdadeiras (T-1, corrigido: agora medem sobre `raw`, a forma antes do pintor). O
 * teste do fim deste arquivo demonstra a vacuidade da métrica antiga e confere a nova.
 */

const GROSSA = 'wt_ext19';
const FINA = 'wt_alv14';
const BLOCO_GROSSA = 'mat_bloco19';

/** Caixa em metros do modelo: [x0, y0, x1, y1]. */
type Caixa = readonly [number, number, number, number];

const retangulo = (c: Caixa): MultiPolygon => {
  const [x0, y0, x1, y1] = c;
  return [[[{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]]];
};

const areaCaixa = (c: Caixa): number => (c[2] - c[0]) * (c[3] - c[1]);

const fmt = (n: number): string => n.toFixed(6);

interface Peca {
  id: string;
  typeId: string;
  a: Vec2;
  b: Vec2;
}

/** Extremidades da peça que estão DENTRO do nó (as livres não leem a configuração de junção). */
interface Junta {
  id: string;
  lados: Array<'start' | 'end'>;
}

interface Cenario {
  nome: string;
  pecas: Peca[];
  junta: Junta[];
  caixa: Caixa;
  /** Parede fina do cenário, usada no resumo. */
  fina: string;
  kinds: JoinKind[];
  nota?: string;
}

function montar(c: Cenario, kind: JoinKind): Project {
  const s = new ProjectStore(createEmptyProject());
  for (const peca of c.pecas) {
    s.exec({
      type: 'addWall',
      wall: makeWall({ id: peca.id, typeId: peca.typeId, levelId: 'lv_0', a: peca.a, b: peca.b }),
    });
  }
  const p = s.project;
  const elements = { ...p.elements };
  for (const j of c.junta) {
    const w = elements[j.id] as Wall;
    elements[j.id] = {
      ...w,
      joinStart: j.lados.includes('start') ? { kind, flip: false } : w.joinStart,
      joinEnd: j.lados.includes('end') ? { kind, flip: false } : w.joinEnd,
    };
  }
  return { ...p, elements } as Project;
}

interface Linha {
  wallId: string;
  materialId: string;
  layerIndex: number;
  fn: LayerFunction;
  area: number;
}

interface Medida {
  kind: JoinKind;
  caixaArea: number;
  total: number;
  linhas: Linha[];
  porMaterial: Array<{ materialId: string; area: number }>;
}

function medir(c: Cenario, kind: JoinKind): Medida {
  const p = montar(c, kind);
  const r = resolveLevel(p, 'lv_0', new Map());
  const caixa = retangulo(c.caixa);
  const linhas: Linha[] = [];
  for (const peca of c.pecas) {
    const w = p.elements[peca.id] as Wall;
    const tipo = wallType(p, w);
    const rw = r.walls[peca.id]!;
    for (const l of rw.layers) {
      // `layerIndex` negativo são faixas fora da espessura (rodapé/barra); estes dois tipos não têm faixas.
      const fn: LayerFunction = l.layerIndex >= 0 ? tipo.layers[l.layerIndex]!.function : 'finish2';
      const area = l.cut.length === 0 ? 0 : multiArea(intersection(l.cut, caixa));
      linhas.push({ wallId: peca.id, materialId: l.materialId, layerIndex: l.layerIndex, fn, area });
    }
  }
  const somas = new Map<string, number>();
  for (const l of linhas) somas.set(l.materialId, (somas.get(l.materialId) ?? 0) + l.area);
  const porMaterial = [...somas.entries()]
    .map(([materialId, area]) => ({ materialId, area }))
    .sort((x, y) => (x.materialId < y.materialId ? -1 : 1));
  const total = porMaterial.reduce((s, m) => s + m.area, 0);
  return { kind, caixaArea: areaCaixa(c.caixa), total, linhas, porMaterial };
}

function imprimirTabela(c: Cenario, medidas: Medida[]): void {
  const out: string[] = [];
  out.push(`\n=== ${c.nome}`);
  out.push(`    caixa [${c.caixa.map((n) => fmt(n)).join('; ')}] = ${fmt(areaCaixa(c.caixa))} m²`);
  if (c.nota) out.push(`    nota: ${c.nota}`);
  out.push(`${'kind'.padEnd(8)}${'materialId'.padEnd(16)}${'área na caixa (m²)'.padStart(18)}`);
  for (const m of medidas) {
    for (const k of m.porMaterial) out.push(`${m.kind.padEnd(8)}${k.materialId.padEnd(16)}${fmt(k.area).padStart(18)}`);
    out.push(`${m.kind.padEnd(8)}${'TOTAL'.padEnd(16)}${fmt(m.total).padStart(18)}`);
    out.push(`${''.padEnd(8)}${'fora das paredes'.padEnd(16)}${fmt(m.caixaArea - m.total).padStart(18)}`);
  }
  console.log(out.join('\n'));
}

const soma = (m: Medida, pred: (l: Linha) => boolean): number => m.linhas.filter(pred).reduce((s, l) => s + l.area, 0);

/** Acabamento da fina = tudo que não é estrutura (reboco e tinta das duas faces). */
const acabamentoDaFina = (finaId: string) => (l: Linha): boolean => l.wallId === finaId && l.fn !== 'structure';
/** Só a tinta (finish1/finish2) da fina. */
const tintaDaFina = (finaId: string) => (l: Linha): boolean =>
  l.wallId === finaId && (l.fn === 'finish1' || l.fn === 'finish2');
const ehBlocoDaGrossa = (l: Linha): boolean => l.materialId === BLOCO_GROSSA;

const areaDe = (m: Medida, materialId: string): number => m.porMaterial.find((x) => x.materialId === materialId)?.area ?? 0;

function imprimirResumo(c: Cenario, medidas: Medida[]): void {
  const ref = medidas.find((m) => m.kind === 'miter');
  if (!ref) return;
  const acab = acabamentoDaFina(c.fina);
  const tinta = tintaDaFina(c.fina);
  const baseAcab = soma(ref, acab);
  const baseTinta = soma(ref, tinta);
  const baseBloco = soma(ref, ehBlocoDaGrossa);
  const out: string[] = [];
  out.push(`\n--- resumo ${c.nome}`);
  out.push(
    `    referência (esquadria): acabamento da fina na caixa = ${fmt(baseAcab)} m² (tinta ${fmt(baseTinta)} m²);` +
      ` bloco da grossa na caixa = ${fmt(baseBloco)} m².`,
  );
  for (const m of medidas) {
    if (m.kind === 'miter') continue;
    const a = soma(m, acab);
    const t = soma(m, tinta);
    const b = soma(m, ehBlocoDaGrossa);
    out.push(
      `    ${m.kind.padEnd(7)}: ${fmt(baseAcab - a)} m² da área da caixa que em esquadria é do acabamento da fina` +
        ` passam a ser do bloco da grossa (bloco ${fmt(baseBloco)} -> ${fmt(b)} m², +${fmt(b - baseBloco)};` +
        ` acabamento da fina ${fmt(baseAcab)} -> ${fmt(a)} m²; tinta ${fmt(baseTinta)} -> ${fmt(t)} m²).`,
    );
    const materiais = [...new Set([...ref.porMaterial, ...m.porMaterial].map((x) => x.materialId))].sort();
    const deltas = materiais
      .map((materialId) => ({ materialId, d: areaDe(m, materialId) - areaDe(ref, materialId) }))
      .filter((x) => Math.abs(x.d) > 5e-7)
      .map((x) => `${x.materialId} ${x.d > 0 ? '+' : ''}${fmt(x.d)}`);
    out.push(`            variação por material (${m.kind} - esquadria): ${deltas.length ? deltas.join(' | ') : 'nenhuma'}`);
  }
  console.log(out.join('\n'));
}

/** 1. L: grossa horizontal (0,0)-(4,0) + fina vertical (4,0)-(4,3). A quina é g.fim x f.início. */
const L: Cenario = {
  nome: 'L: grossa 19 (0,0)-(4,0) + fina 14 (4,0)-(4,3)',
  pecas: [
    { id: 'g', typeId: GROSSA, a: { x: 0, y: 0 }, b: { x: 4, y: 0 } },
    { id: 'f', typeId: FINA, a: { x: 4, y: 0 }, b: { x: 4, y: 3 } },
  ],
  junta: [
    { id: 'g', lados: ['end'] },
    { id: 'f', lados: ['start'] },
  ],
  caixa: [3.88, -0.15, 4.12, 0.15],
  fina: 'f',
  kinds: ['miter', 'butt', 'square'],
};

/**
 * 2. T: grossa (-2,0)-(2,0) + fina (0,0)-(0,3) chegando no meio dela. A configuração de junção é ignorada por
 * projeto: docs/05 §9 item 4 — em T é sempre encosto, com ordem fixa (resolveNode só lê a configuração quando há
 * exatamente 2 paredes; aqui há 1 extremidade no nó e ela é resolvida por tryTee -> toCenterline). Medida única.
 */
const T: Cenario = {
  nome: 'T: grossa 19 (-2,0)-(2,0) + fina 14 (0,0)-(0,3)',
  pecas: [
    { id: 'g', typeId: GROSSA, a: { x: -2, y: 0 }, b: { x: 2, y: 0 } },
    { id: 'f', typeId: FINA, a: { x: 0, y: 0 }, b: { x: 0, y: 3 } },
  ],
  junta: [{ id: 'f', lados: ['start'] }],
  caixa: [-0.15, -0.15, 0.15, 0.15],
  fina: 'f',
  kinds: ['miter'],
  nota: 'T ignora a configuração de junção (docs/05 §9 item 4: sempre encosto, ordem fixa) — medida única',
};

/**
 * 3. Nó de 3 paredes: grossa (0,0)-(4,0), fina (0,0)-(0,3) e outra fina (0,0)-(-2,-2), as três começando em (0,0).
 * Sem par colinear, resolveNode cai em starNode, que não lê joinStart/joinEnd de ninguém: as três configurações
 * devem medir exatamente a mesma coisa (não asseveramos igualdade — só registramos na tabela).
 */
const NO: Cenario = {
  nome: 'nó de 3: grossa 19 (0,0)-(4,0) + fina 14 (0,0)-(0,3) + fina 14 (0,0)-(-2,-2)',
  pecas: [
    { id: 'g', typeId: GROSSA, a: { x: 0, y: 0 }, b: { x: 4, y: 0 } },
    { id: 'f1', typeId: FINA, a: { x: 0, y: 0 }, b: { x: 0, y: 3 } },
    { id: 'f2', typeId: FINA, a: { x: 0, y: 0 }, b: { x: -2, y: -2 } },
  ],
  junta: [
    { id: 'g', lados: ['start'] },
    { id: 'f1', lados: ['start'] },
    { id: 'f2', lados: ['start'] },
  ],
  caixa: [-0.15, -0.15, 0.15, 0.15],
  fina: 'f1',
  kinds: ['miter', 'butt', 'square'],
  nota: 'nó de 3 paredes: starNode não lê a configuração de junção (só resolveNode com 2 paredes lê)',
};

function conferirFraco(c: Cenario, medidas: Medida[]): void {
  for (const m of medidas) {
    expect(m.linhas.length, `${c.nome} ${m.kind}: nenhuma camada medida`).toBeGreaterThan(0);
    // Só verificações de sanidade: nada aqui pode falhar por detalhe geométrico do canto.
    expect(Number.isFinite(m.total), `${c.nome} ${m.kind}: total não finito`).toBe(true);
    expect(m.total, `${c.nome} ${m.kind}: caixa sem área`).toBeGreaterThan(0);
    for (const l of m.linhas) {
      expect(Number.isFinite(l.area), `${m.kind} ${l.materialId}`).toBe(true);
      expect(l.area, `${m.kind} ${l.materialId}`).toBeGreaterThanOrEqual(0);
    }
    // Consistência aritmética da agregação (não é propriedade geométrica).
    expect(m.total).toBeCloseTo(m.linhas.reduce((s, l) => s + l.area, 0), 9);
  }
}

describe('junção em L 19 x 14: área por material na caixa da quina', () => {
  const medidas = L.kinds.map((kind) => medir(L, kind));

  it('mede a caixa da quina em esquadria, encosto e esquadro', () => {
    imprimirTabela(L, medidas);
    conferirFraco(L, medidas);
  });

  it('resume quanto da área do canto troca do acabamento da fina para o bloco da grossa', () => {
    imprimirResumo(L, medidas);
  });
});

describe('T 19 x 14: a configuração de junção é ignorada (sempre encosto)', () => {
  const medidas = T.kinds.map((kind) => medir(T, kind));

  it('mede a caixa do T uma vez', () => {
    imprimirTabela(T, medidas);
    conferirFraco(T, medidas);
  });

  it('registra a referência do T', () => {
    imprimirResumo(T, medidas);
  });
});

describe('nó de 3 paredes: a configuração de junção não chega ao starNode', () => {
  const medidas = NO.kinds.map((kind) => medir(NO, kind));

  it('mede a caixa do nó nas três configurações', () => {
    imprimirTabela(NO, medidas);
    conferirFraco(NO, medidas);
  });

  it('resume o nó', () => {
    imprimirResumo(NO, medidas);
  });
});

describe('a métrica antiga (interseção entre camadas) é vacuamente zero', () => {
  it('duas camadas de prioridades diferentes ocupam a mesma caixa e não se sobrepõem, porque o pintor já recortou', () => {
    const p = montar(L, 'miter');
    const r = resolveLevel(p, 'lv_0', new Map());
    const caixa = retangulo(L.caixa);
    const bloco = r.walls['g']!.layers.find((l) => l.materialId === BLOCO_GROSSA)!;
    const tipoFina = wallType(p, p.elements['f'] as Wall);
    const acabamentos = r.walls['f']!.layers.filter(
      (l) => l.layerIndex >= 0 && tipoFina.layers[l.layerIndex]!.function !== 'structure',
    );
    expect(bloco).toBeDefined();
    expect(acabamentos.length).toBeGreaterThan(0);
    // Os dois lados disputam a MESMA região do canto: ambos têm área positiva dentro da caixa.
    const blocoNaCaixa = multiArea(intersection(bloco.cut, caixa));
    expect(blocoNaCaixa).toBeGreaterThan(0);
    const comArea = acabamentos.filter((l) => multiArea(intersection(l.cut, caixa)) > 0);
    expect(comArea.length).toBeGreaterThan(0);
    // A mesma pergunta sobre `raw` (forma antes do pintor) tem resposta: em esquadria, nada da fina entra no bloco da grossa.
    for (const a of comArea) expect(multiArea(intersection(a.raw, bloco.raw)), a.materialId).toBeLessThan(1e-6);
    const linhas: string[] = [
      '\n--- vacuidade da métrica antiga (L 19x14 em esquadria, caixa da quina)',
      `    bloco da grossa: prioridade ${bloco.priority}, área dentro da caixa ${fmt(blocoNaCaixa)} m²`,
    ];
    // ...e ainda assim `intersection(a.cut, b.cut)` é zero: `paint` já subtraiu de cada camada a área das de
    // prioridade menor aceitas antes. Por isso a guarda antiga ("acabamento da fina x acabamento da grossa < 1e-6")
    // não mede sobreposição nenhuma: ela é verdadeira para QUALQUER par de camadas que o pintor já separou.
    for (const a of comArea) {
      const dentro = multiArea(intersection(a.cut, caixa));
      const cruzada = multiArea(intersection(a.cut, bloco.cut));
      linhas.push(
        `    ${a.materialId.padEnd(14)} prioridade ${a.priority}: ${fmt(dentro)} m² na caixa,` +
          ` interseção com o bloco = ${fmt(cruzada)} m² (${cruzada.toExponential(3)} m²)`,
      );
      expect(a.priority, 'as duas camadas precisam ter prioridades diferentes').not.toBe(bloco.priority);
      expect(cruzada, `${a.materialId} x ${bloco.materialId}`).toBeLessThan(1e-6);
    }
    console.log(linhas.join('\n'));
  });
});

/**
 * Redistribuição do §5.1 medida sobre `raw` (T-1): área do acabamento da fina que cai sobre o bloco da grossa, dentro
 * da caixa do canto. Sobre `cut` essa área some do acabamento da fina e aparece no bloco; sobre `raw` ela continua
 * na fina e aparece como sobreposição com o bloco da grossa.
 */
function sobreposicaoRaw(kind: JoinKind): number {
  const p = montar(L, kind);
  const r = resolveLevel(p, 'lv_0', new Map());
  const caixa = retangulo(L.caixa);
  const bloco = r.walls['g']!.layers.find((l) => l.materialId === BLOCO_GROSSA)!;
  const tipoFina = wallType(p, p.elements['f'] as Wall);
  return r.walls['f']!.layers
    .filter((l) => l.layerIndex >= 0 && tipoFina.layers[l.layerIndex]!.function !== 'structure')
    .reduce((soma, l) => soma + multiArea(intersection(intersection(l.raw, bloco.raw), caixa)), 0);
}

describe('redistribuição do §5.1 sobre raw (T-1)', () => {
  it('esquadria: zero; encosto e esquadro: positivo (medido sobre raw)', () => {
    const medidas = { miter: sobreposicaoRaw('miter'), butt: sobreposicaoRaw('butt'), square: sobreposicaoRaw('square') };
    console.log(`\n--- sobreposição raw acabamento da fina x bloco da grossa, caixa do canto (m²): ${JSON.stringify(medidas)}`);
    expect(medidas.miter).toBeLessThan(1e-6);
    // J-1: hoje encosto/esquadro deixam o acabamento da fina entrar no núcleo; inverter ao corrigir
    expect(medidas.butt).toBeGreaterThan(1e-4);
    expect(medidas.square).toBeGreaterThan(1e-4);
  });
});
