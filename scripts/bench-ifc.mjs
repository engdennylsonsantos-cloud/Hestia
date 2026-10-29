#!/usr/bin/env node
/**
 * Mede a importação IFC de cada fixture de `tests/ifc/fixtures/*.ifc`, sem interface:
 *
 *   npx vite-node scripts/bench-ifc.mjs [--repeticoes N] [--grandes] [--json]
 *
 * - `--repeticoes N` (padrão 2): cada fixture é importada N vezes e a tabela mostra a **mediana** da leitura e da
 *   importação. O RSS também é a mediana do antes/depois de cada repetição (o processo é o mesmo; a memória de uma
 *   repetição pode ficar retida para a seguinte, e é isso que a medição mostra).
 * - `--grandes`: baixa o sample do Revit (25 MB) para `%TEMP%/revit-amostra.ifc` se ainda não existir e o inclui na
 *   medição. Sem rede, o script avisa e segue com os fixtures locais.
 * - `--json`: imprime só o JSON (as mensagens de download vão para stderr).
 *
 * O tempo de importação é o do `importIfc(texto)`, sem a leitura do disco; a leitura tem a sua própria coluna. O RSS é
 * `process.memoryUsage().rss` medido antes da leitura e depois da importação. Não há `--expose-gc`: os números são
 * indicativos, como qualquer medição de memória em Node.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importIfc } from '../packages/io/src/ifcImport/index.ts';

const URL_REVIT =
  'https://raw.githubusercontent.com/opensourceBIM/TestFiles/master/TestData/data/ifc4rac_basic_sample_project.ifc';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(RAIZ, 'tests', 'ifc', 'fixtures');

const USO = 'uso: npx vite-node scripts/bench-ifc.mjs [--repeticoes N] [--grandes] [--json]';

/** Argumentos da linha de comando; erro de uso sai com código 2. */
function argumentos(argv) {
  const opcoes = { repeticoes: 2, grandes: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--grandes') opcoes.grandes = true;
    else if (arg === '--json') opcoes.json = true;
    else if (arg === '--repeticoes' || arg.startsWith('--repeticoes=')) {
      const valor = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[++i];
      const n = Number(valor);
      if (!Number.isInteger(n) || n < 1) {
        console.error(`${USO}\n--repeticoes precisa de um inteiro >= 1 (recebi ${JSON.stringify(valor)}).`);
        process.exit(2);
      }
      opcoes.repeticoes = n;
    } else if (arg === '-h' || arg === '--help') {
      console.log(USO);
      process.exit(0);
    } else {
      console.error(`${USO}\nargumento desconhecido: ${arg}`);
      process.exit(2);
    }
  }
  return opcoes;
}

/** Mediana de uma lista não vazia (com dois valores, a média dos dois). */
function mediana(valores) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 === 1 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
}

/** Número no formato do documento (vírgula decimal). */
const fmt = (v, casas = 2) => v.toFixed(casas).replace('.', ',');

/** Tamanho legível: kB abaixo de 1 MB, MB acima. */
function tamanho(bytes) {
  return bytes < 1024 * 1024 ? `${fmt(bytes / 1024, 1)} kB` : `${fmt(bytes / (1024 * 1024), 2)} MB`;
}

/** Baixa o sample do Revit uma vez; devolve `null` (e avisa) quando não dá. */
async function garantirAmostra() {
  const destino = join(process.env.TEMP || tmpdir(), 'revit-amostra.ifc');
  if (existsSync(destino)) {
    console.error(`amostra do Revit reutilizada: ${destino}`);
    return destino;
  }
  console.error(`baixando o sample do Revit (25 MB): ${URL_REVIT}`);
  try {
    const resposta = await fetch(URL_REVIT);
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status} ${resposta.statusText}`);
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (bytes.length < 1024 * 1024) throw new Error(`resposta pequena demais (${bytes.length} bytes)`);
    writeFileSync(destino, bytes);
    console.error(`amostra do Revit salva em ${destino} (${tamanho(bytes.length)})`);
    return destino;
  } catch (erro) {
    console.error(`não foi possível baixar a amostra do Revit: ${erro instanceof Error ? erro.message : String(erro)}`);
    return null;
  }
}

/** Contagens de um projeto importado: elementos por `kind`, genéricos, triângulos e elementos com pset. */
function contar(project) {
  const kinds = {};
  let generic = 0;
  let triangles = 0;
  let withProperties = 0;
  for (const elemento of Object.values(project.elements)) {
    kinds[elemento.kind] = (kinds[elemento.kind] ?? 0) + 1;
    if (Array.isArray(elemento.ifcProperties) && elemento.ifcProperties.length) withProperties++;
    if (elemento.kind === 'generic') {
      generic++;
      triangles += Math.floor((elemento.mesh?.indices?.length ?? 0) / 3);
    }
  }
  return { elements: Object.keys(project.elements).length, kinds, generic, triangles, withProperties };
}

/** Importa um arquivo `repeticoes` vezes e devolve as medianas e as contagens da última importação. */
function medir(caminho, repeticoes) {
  const leituras = [];
  const importacoes = [];
  const rssAntes = [];
  const rssDepois = [];
  let bytes = 0;
  let schema = '';
  let levels = 0;
  let contagens = { elements: 0, kinds: {}, generic: 0, triangles: 0, withProperties: 0 };
  for (let i = 0; i < repeticoes; i++) {
    const antes = process.memoryUsage().rss;
    const t0 = performance.now();
    const texto = readFileSync(caminho, 'utf8');
    const leitura = performance.now() - t0;
    bytes = Buffer.byteLength(texto);
    const t1 = performance.now();
    const { project, report } = importIfc(texto);
    importacoes.push(performance.now() - t1);
    const depois = process.memoryUsage().rss;
    leituras.push(leitura);
    rssAntes.push(antes);
    rssDepois.push(depois);
    schema = report.schema;
    levels = report.levels;
    contagens = contar(project);
  }
  return {
    arquivo: basename(caminho),
    caminho,
    bytes,
    schema,
    levels,
    ...contagens,
    leituraMs: mediana(leituras),
    importacaoMs: mediana(importacoes),
    rssAntesMB: mediana(rssAntes) / (1024 * 1024),
    rssDepoisMB: mediana(rssDepois) / (1024 * 1024),
    rssDeltaMB: mediana(rssDepois.map((v, i) => v - rssAntes[i])) / (1024 * 1024),
    repeticoes,
  };
}

/** Ordem das categorias nas tabelas; `kind` novo entra no fim, em ordem alfabética. */
const ORDEM_KINDS = ['wall', 'door', 'window', 'floor', 'slab', 'ceiling', 'roof', 'stair', 'room', 'grid', 'generic'];

const NOME_KIND = {
  wall: 'parede',
  door: 'porta',
  window: 'janela',
  floor: 'piso',
  slab: 'laje',
  ceiling: 'forro',
  roof: 'telhado',
  stair: 'escada',
  room: 'ambiente',
  grid: 'grade',
  generic: 'genérico',
};

/** Cabeçalho + linhas de uma tabela Markdown. */
function tabela(cabecalho, linhas) {
  const largura = cabecalho.length;
  const normalizar = (linha) => Array.from({ length: largura }, (_, i) => linha[i] ?? '');
  return [
    `| ${cabecalho.join(' | ')} |`,
    `| ${cabecalho.map(() => '---').join(' | ')} |`,
    ...linhas.map((linha) => `| ${normalizar(linha).join(' | ')} |`),
  ];
}

function imprimir(linhas, opcoes) {
  const desempenho = linhas.map((r) =>
    r.erro
      ? [r.arquivo, tamanho(r.bytes), 'erro', '—', '—', '—', '—', '—', '—', '—', '—', r.erro]
      : [
          r.arquivo,
          tamanho(r.bytes),
          r.schema,
          String(r.levels),
          String(r.elements),
          String(r.generic),
          String(r.triangles),
          fmt(r.leituraMs, 1),
          fmt(r.importacaoMs, 1),
          fmt(r.rssAntesMB, 1),
          fmt(r.rssDepoisMB, 1),
          fmt(r.rssDeltaMB, 1),
        ],
  );
  console.log(
    tabela(
      ['Fixture', 'Tamanho', 'Schema', 'Níveis', 'Elementos', 'Genéricos', 'Triângulos', 'Leitura (ms)', 'Importação (ms)', 'RSS antes (MB)', 'RSS depois (MB)', 'Δ RSS (MB)'],
      desempenho,
    ).join('\n'),
  );

  const presentes = new Set();
  for (const r of linhas) for (const [kind, n] of Object.entries(r.kinds ?? {})) if (n > 0) presentes.add(kind);
  const kinds = [
    ...ORDEM_KINDS.filter((k) => presentes.has(k)),
    ...[...presentes].filter((k) => !ORDEM_KINDS.includes(k)).sort(),
  ];
  console.log('');
  console.log(
    tabela(
      ['Fixture', ...kinds.map((k) => NOME_KIND[k] ?? k), 'com pset'],
      linhas.map((r) => [
        r.arquivo,
        ...kinds.map((k) => String(r.kinds?.[k] ?? 0)),
        String(r.withProperties ?? 0),
      ]),
    ).join('\n'),
  );

  console.log('');
  console.log(
    `Mediana de ${opcoes.repeticoes} repetição(ões); RSS = process.memoryUsage().rss antes da leitura e depois da importação.`,
  );
}

const opcoes = argumentos(process.argv.slice(2));

const arquivos = (await readdir(FIXTURES))
  .filter((nome) => nome.toLowerCase().endsWith('.ifc'))
  .map((nome) => join(FIXTURES, nome))
  // Do menor para o maior: a tabela mostra o custo crescendo com o arquivo.
  .sort((a, b) => statSync(a).size - statSync(b).size);

if (arquivos.length === 0) {
  console.error(`nenhum .ifc em ${FIXTURES}; rode antes: node scripts/baixar-ifc.mjs`);
  process.exit(1);
}

if (opcoes.grandes) {
  const amostra = await garantirAmostra();
  if (amostra && !arquivos.some((a) => basename(a) === basename(amostra))) arquivos.push(amostra);
}

const linhas = [];
for (const caminho of arquivos) {
  try {
    const resultado = medir(caminho, opcoes.repeticoes);
    linhas.push(resultado);
    if (!opcoes.json) console.error(`medido: ${resultado.arquivo} (${fmt(resultado.importacaoMs, 1)} ms)`);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    linhas.push({ arquivo: basename(caminho), caminho, bytes: 0, kinds: {}, erro: mensagem });
    console.error(`falha ao importar ${basename(caminho)}: ${mensagem}`);
  }
}

if (opcoes.json) {
  console.log(JSON.stringify({ repeticoes: opcoes.repeticoes, fixtures: linhas }, null, 2));
} else {
  imprimir(linhas, opcoes);
}
