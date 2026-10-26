/**
 * Gerador do projeto sintético de desempenho: N pavimentos com W paredes cada, um piso, uma laje e aberturas por nível,
 * ambientes (com rótulo na planta) e uma cobertura no topo. Usado pelo baseline de Node (`scripts/bench-interacao.mts`)
 * e pelo de navegador (`tests/e2e/perf-browser.mjs`, `scripts/medir-gpu-memoria.mjs`), para que todos megam o mesmo projeto.
 *
 * Compatibilidade: com W = 32 (padrão) o projeto é exatamente o de `packages/engine/src/fixtureSintetica.ts` — layout
 * fixo de 4 × 4 m, 8 paredes internas, uma porta, um piso e uma laje por nível e cobertura no topo. Nada muda nos
 * baselines existentes.
 *
 * Para W > 32 o layout é uma grade determinística de células de 4 × 4 m (sem sorteio): paredes das linhas e colunas da
 * grade, mais divisórias no meio das células ímpares até fechar a contagem exata. Ambientes ficam nas células pares (um
 * por célula, sem paredes atravessando o ponto), e as portas são distribuídas a cada W/8 paredes da grade. O objetivo é
 * estresse de escala, não um projeto de arquitetura: mesmas categorias e proporções, geometria reproduzível.
 *
 * Gravação em arquivo:
 *   PROJETO_SAIDA=<arquivo.hestia.json> npx vite-node scripts/perf-baselines/projeto-sintetico.mts 10
 *   PROJETO_SAIDA=<arquivo.hestia.json> PROJETO_PAVIMENTOS=60 PROJETO_PAREDES=256 npx vite-node scripts/perf-baselines/projeto-sintetico.mts
 * O argumento posicional é o número de pavimentos; `PROJETO_PAVIMENTOS` tem precedência sobre ele.
 */
import { writeFileSync } from 'node:fs';
import {
  ProjectStore,
  createEmptyProject,
  makeFloor,
  makeLevel,
  makeRoom,
  makeRoof,
  makeSlab,
  makeWall,
  type Command,
  type Id,
  type Project,
} from '@hestia/model';
import { SEGMENTS, WALLS_PER_LEVEL, syntheticProject as fixtureProject } from '../../packages/engine/src/fixtureSintetica.ts';

export { SEGMENTS, WALLS_PER_LEVEL };

/** Paredes por pavimento do layout original (`fixtureSintetica`), mantido como padrão. */
export const PAREDES_POR_PAVIMENTO_PADRAO = WALLS_PER_LEVEL;

/** Uma parede do layout gerado, em coordenadas do pavimento (m). */
export interface ParedeDoLayout {
  /** Índice no pavimento, igual ao sufixo do id `perf_w_<nível>_<índice>`. */
  indice: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
  /** `grade` = linha/coluna da malha; `divisoria` = parede curta no meio de uma célula. */
  origem: 'grade' | 'divisoria';
  comprimento: number;
}

/** Layout de um pavimento com `paredes` paredes. Determinístico: mesma entrada, mesmas coordenadas. */
export interface LayoutDoPavimento {
  paredes: ParedeDoLayout[];
  colunas: number;
  linhas: number;
  largura: number;
  profundidade: number;
  /** Número de paredes só da grade (as divisórias completam até `paredes`). */
  paredesDaGrade: number;
  /** Células com ambiente (uma a cada duas células) e a posição do ponto interior. */
  ambientes: Array<{ coluna: number; linha: number; ponto: { x: number; y: number } }>;
  /** Paredes que hospedam porta, com o deslocamento no meio do vão. */
  portas: Array<{ indiceDaParede: number; offset: number }>;
}

/** Célula de 4 × 4 m, como no layout original. */
const CELULA = 4;

/**
 * Escolhe a grade `colunas × linhas` cuja contagem de paredes chega mais perto de `paredes` sem passar, cabendo as
 * divisórias restantes nas células ímpares (sem ambiente). Grade quadrada é preferida; empate resolve por menos
 * divisórias.
 */
function escolherGrade(paredes: number): { colunas: number; linhas: number; paredesDaGrade: number; divisoriaCelulas: number } {
  let melhor: { colunas: number; linhas: number; paredesDaGrade: number; divisoriaCelulas: number; custo: number } | null = null;
  for (let colunas = 1; colunas <= 32; colunas++) {
    for (let linhas = 1; linhas <= 32; linhas++) {
      const grade = colunas * (linhas + 1) + linhas * (colunas + 1);
      if (grade > paredes) continue;
      const restantes = paredes - grade;
      const celulasImpares = Math.floor((colunas * linhas) / 2);
      if (restantes > celulasImpares) continue;
      // Prefere grade quadrada e depois menos divisórias. O fator 0,01 não vence a diferença de uma divisória.
      const custo = restantes + 0.01 * Math.abs(colunas - linhas);
      if (!melhor || custo < melhor.custo) melhor = { colunas, linhas, paredesDaGrade: grade, divisoriaCelulas: restantes, custo };
    }
  }
  if (!melhor) throw new Error(`Não há grade de 4 m para ${paredes} paredes por pavimento (mínimo 4).`);
  return melhor;
}

/** Layout determinístico de um pavimento com `paredes` paredes. */
export function layoutDoPavimento(paredes: number): LayoutDoPavimento {
  if (!Number.isInteger(paredes) || paredes < 4) throw new Error(`Paredes por pavimento deve ser inteiro ≥ 4; recebi ${paredes}.`);
  const { colunas, linhas, paredesDaGrade, divisoriaCelulas } = escolherGrade(paredes);
  const paredesDoLayout: ParedeDoLayout[] = [];
  const push = (ax: number, ay: number, bx: number, by: number, origem: ParedeDoLayout['origem']) => {
    paredesDoLayout.push({
      indice: paredesDoLayout.length,
      a: { x: ax, y: ay },
      b: { x: bx, y: by },
      origem,
      comprimento: Math.hypot(bx - ax, by - ay),
    });
  };
  // Linhas horizontais: (linhas + 1) fileiras de `colunas` segmentos de 4 m.
  for (let linha = 0; linha <= linhas; linha++) {
    for (let coluna = 0; coluna < colunas; coluna++) push(coluna * CELULA, linha * CELULA, (coluna + 1) * CELULA, linha * CELULA, 'grade');
  }
  // Colunas verticais: (colunas + 1) fileiras de `linhas` segmentos de 4 m.
  for (let coluna = 0; coluna <= colunas; coluna++) {
    for (let linha = 0; linha < linhas; linha++) push(coluna * CELULA, linha * CELULA, coluna * CELULA, (linha + 1) * CELULA, 'grade');
  }
  // Divisórias: no meio das células ímpares, em ordem de leitura. Não passam por ponto de ambiente (células pares).
  let restantes = divisoriaCelulas;
  if (restantes > 0) {
    outer: for (let linha = 0; linha < linhas; linha++) {
      for (let coluna = 0; coluna < colunas; coluna++) {
        if ((coluna + linha) % 2 === 0) continue;
        push(coluna * CELULA + CELULA / 2, linha * CELULA, coluna * CELULA + CELULA / 2, (linha + 1) * CELULA, 'divisoria');
        if (--restantes === 0) break outer;
      }
    }
  }
  if (paredesDoLayout.length !== paredes) {
    throw new Error(`Layout com ${paredesDoLayout.length} paredes, esperava ${paredes}.`);
  }
  const ambientes: LayoutDoPavimento['ambientes'] = [];
  for (let linha = 0; linha < linhas; linha++) {
    for (let coluna = 0; coluna < colunas; coluna++) {
      if ((coluna + linha) % 2 !== 0) continue;
      ambientes.push({ coluna, linha, ponto: { x: coluna * CELULA + CELULA / 2, y: linha * CELULA + CELULA / 2 } });
    }
  }
  const quantidadePortas = Math.max(1, Math.round(paredes / 8));
  const portas: LayoutDoPavimento['portas'] = [];
  for (let k = 0; k < quantidadePortas; k++) {
    const indiceDaParede = Math.min(paredesDaGrade - 1, Math.floor((k * paredesDaGrade) / quantidadePortas));
    portas.push({ indiceDaParede, offset: 2 });
  }
  return {
    paredes: paredesDoLayout,
    colunas,
    linhas,
    largura: colunas * CELULA,
    profundidade: linhas * CELULA,
    paredesDaGrade,
    ambientes,
    portas,
  };
}

const NOMES_DE_AMBIENTE = ['Sala', 'Quarto', 'Cozinha', 'Banheiro', 'Circulação', 'Escritório', 'Recepção', 'Depósito'] as const;

/**
 * Projeto com `levelCount` pavimentos (cota de 3 m) e `wallsPerLevel` paredes por pavimento. Com 32 paredes devolve
 * exatamente o projeto de `fixtureSintetica` (compatibilidade dos baselines); acima disso usa a grade determinística.
 */
export function syntheticProject(levelCount: number, wallsPerLevel: number = PAREDES_POR_PAVIMENTO_PADRAO): Project {
  if (!Number.isInteger(levelCount) || levelCount < 1) throw new Error(`Pavimentos deve ser inteiro ≥ 1; recebi ${levelCount}.`);
  if (wallsPerLevel === WALLS_PER_LEVEL) return fixtureProject(levelCount);
  const layout = layoutDoPavimento(wallsPerLevel);
  const store = new ProjectStore(createEmptyProject(`Estresse ${levelCount} pavimentos × ${wallsPerLevel} paredes`));
  const cmds: Command[] = [];
  const levels: Id[] = [];
  for (let i = 0; i < levelCount; i++) {
    // Mesma convenção de id do fixture (perf-browser e medir-gpu dependem dela).
    const id = i === 0 ? 'lv_0' : i === 1 ? 'lv_1' : `perf_lv_${i}`;
    levels.push(id);
    cmds.push({ type: 'upsertLevel', level: makeLevel({ id, name: `Pavimento ${i + 1}`, elevation: i * 3 }) });
  }
  const box = [
    { x: 0, y: 0 },
    { x: layout.largura, y: 0 },
    { x: layout.largura, y: layout.profundidade },
    { x: 0, y: layout.profundidade },
  ];
  const portasPorParede = new Map(layout.portas.map((p) => [p.indiceDaParede, p.offset]));
  for (let i = 0; i < levels.length; i++) {
    const levelId = levels[i]!;
    layout.paredes.forEach((parede) => {
      const id = `perf_w_${i}_${parede.indice}`;
      cmds.push({ type: 'addWall', wall: makeWall({ id, typeId: 'wt_ext19', levelId, a: parede.a, b: parede.b }) });
      const offset = portasPorParede.get(parede.indice);
      if (offset !== undefined) {
        cmds.push({
          type: 'addOpening',
          opening: { id: `perf_o_${i}_${parede.indice}`, kind: 'door', typeId: 'ot_p80', hostId: id, offset, flipHand: false, flipFacing: false, sillOverride: null, mark: '' },
        });
      }
    });
    layout.ambientes.forEach((ambiente, j) => {
      const nome = NOMES_DE_AMBIENTE[j % NOMES_DE_AMBIENTE.length]!;
      const numero = `${i + 1}${String(j + 1).padStart(2, '0')}`;
      cmds.push({ type: 'addRoom', room: makeRoom({ id: `perf_room_${i}_${j}`, levelId, name: `${nome} ${j + 1}`, number: numero, point: ambiente.ponto }) });
    });
    cmds.push({ type: 'addFloor', floor: makeFloor({ id: `perf_floor_${i}`, typeId: 'ft_ceram', levelId, boundary: box }) });
    cmds.push({ type: 'addSlab', slab: makeSlab({ id: `perf_slab_${i}`, typeId: 'ls_mac12', levelId, boundary: box }) });
    if (i === levels.length - 1) cmds.push({ type: 'addRoof', roof: makeRoof({ id: 'perf_roof', typeId: 'rt_ceramica', levelId, boundary: box, shape: 'gable', slopePercent: 30 }) });
  }
  store.exec({ type: 'batch', commands: cmds });
  return store.project;
}

/** Lê um inteiro positivo de `valor`, ou devolve `padrao`. Erro claro em texto inválido. */
function inteiro(valor: string | undefined, padrao: number, nome: string, minimo: number): number {
  if (valor === undefined || valor === '') return padrao;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < minimo) throw new Error(`${nome} deve ser inteiro ≥ ${minimo}; recebi "${valor}".`);
  return n;
}

// Execução direta: com PROJETO_SAIDA=<arquivo.hestia.json> grava o projeto (formato do .hestia.json) para o teste de navegador.
// Ex.: PROJETO_SAIDA=/tmp/p.json PROJETO_PAVIMENTOS=60 PROJETO_PAREDES=256 npx vite-node scripts/perf-baselines/projeto-sintetico.mts
const saida = process.env.PROJETO_SAIDA;
if (saida) {
  const posicional = process.argv[process.argv.length - 1];
  const pavimentos = inteiro(process.env.PROJETO_PAVIMENTOS ?? (posicional && /^\d+$/.test(posicional) ? posicional : undefined), 10, 'PROJETO_PAVIMENTOS', 1);
  const paredes = inteiro(process.env.PROJETO_PAREDES, PAREDES_POR_PAVIMENTO_PADRAO, 'PROJETO_PAREDES', 4);
  const inicio = Date.now();
  const projeto = syntheticProject(pavimentos, paredes);
  const texto = JSON.stringify(projeto, null, 1);
  writeFileSync(saida, texto);
  const segundos = ((Date.now() - inicio) / 1000).toFixed(2);
  const elementos = Object.values(projeto.elements);
  const aberturas = elementos.filter((e) => e.kind === 'door' || e.kind === 'window').length;
  const ambientes = elementos.filter((e) => e.kind === 'room').length;
  console.log(
    `Projeto de ${pavimentos} pavimentos × ${paredes} paredes gravado em ${saida} ` +
      `(${(Buffer.byteLength(texto) / 2 ** 20).toFixed(2)} MB, ${projeto.levels.length} níveis, ` +
      `${pavimentos * paredes} paredes, ${aberturas} aberturas, ${ambientes} ambientes, ${segundos} s)`,
  );
}
