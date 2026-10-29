#!/usr/bin/env node
/**
 * Oráculo independente da importação IFC.
 *
 * Lê um arquivo IFC como texto (sem usar o leitor do importador) e conta as entidades por classe com uma regex tolerante
 * (`#id = TIPO(`), extrai o `FILE_SCHEMA`, as unidades (`IFCSIUNIT`/`IFCCONVERSIONBASEDUNIT`) e os pavimentos
 * (`IFCBUILDINGSTOREY`). Grava `tests/ifc/esperado/<nome>.json` com a contagem que o importador deve reproduzir:
 *
 *   { "schema": "IFC4", "classes": { "IFCWALL": 4, ... }, "storeys": 1 }
 *
 * As unidades não entram no JSON esperado (o contrato é schema/classes/storeys); elas aparecem no resumo do terminal
 * para conferir a escala do arquivo.
 *
 * Uso:
 *   node scripts/ifc-oraculo.mjs tests/ifc/fixtures/parede-janela.ifc
 *   node scripts/ifc-oraculo.mjs --todos
 *   node scripts/ifc-oraculo.mjs --todos --verificar
 *
 * Sem dependências: Node ESM puro.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_FIXTURES = join(RAIZ, 'tests', 'ifc', 'fixtures');
const PASTA_ESPERADO = join(RAIZ, 'tests', 'ifc', 'esperado');

const PREFIXOS = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
};

/** `#123 = IFCWALL(` — o `\s*` cobre `#1 =` e quebras de linha entre o id e o tipo. */
const ENTIDADE = /#(\d+)\s*=\s*([A-Za-z][A-Za-z0-9_]*)\s*\(/g;

/**
 * Percorre as entidades do arquivo e devolve `{ id, type, raw }`, onde `raw` é o texto de dentro dos parênteses.
 * O fechamento é achado contando parênteses, então valores aninhados (`IFCMEASUREWITHUNIT(...)`) não quebram a leitura.
 */
function* entidades(texto) {
  ENTIDADE.lastIndex = 0;
  for (;;) {
    const m = ENTIDADE.exec(texto);
    if (!m) return;
    let profundidade = 1;
    let aspas = false;
    let i = ENTIDADE.lastIndex;
    for (; i < texto.length && profundidade > 0; i++) {
      const c = texto[i];
      if (c === "'") {
        // Em STEP um apóstrofo dentro do texto é escrito duas vezes (`''`).
        if (aspas && texto[i + 1] === "'") {
          i++;
          continue;
        }
        aspas = !aspas;
        continue;
      }
      if (aspas) continue;
      if (c === '(') profundidade++;
      else if (c === ')') profundidade--;
    }
    yield { id: Number(m[1]), type: m[2].toUpperCase(), raw: texto.slice(ENTIDADE.lastIndex, i - 1) };
    ENTIDADE.lastIndex = i;
  }
}

/** Separa os argumentos de primeiro nível (vírgulas dentro de listas/valores tipados ficam no mesmo argumento). */
function argumentos(raw) {
  const out = [];
  let inicio = 0;
  let profundidade = 0;
  let aspas = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "'") {
      if (aspas && raw[i + 1] === "'") {
        i++;
        continue;
      }
      aspas = !aspas;
      continue;
    }
    if (aspas) continue;
    if (c === '(') profundidade++;
    else if (c === ')') profundidade--;
    else if (c === ',' && profundidade === 0) {
      out.push(raw.slice(inicio, i).trim());
      inicio = i + 1;
    }
  }
  out.push(raw.slice(inicio).trim());
  return out;
}

/** `.MILLI.` → `MILLI`; `$`/`*`/vazio → `''`. */
function simbolo(arg) {
  if (!arg) return '';
  const s = arg.trim().replace(/^\./, '').replace(/\.$/, '');
  return s === '$' || s === '*' ? '' : s;
}

/** `'FOOT'` → `FOOT`; valor tipado/numérico passa direto. */
function texto(arg) {
  if (!arg) return '';
  const m = /^'((?:[^']|'')*)'$/.exec(arg.trim());
  return m ? m[1].replaceAll("''", "'") : arg.trim();
}

/** Primeiro número dentro do argumento (`IFCLENGTHMEASURE(25.4)` → 25.4). */
function numero(arg) {
  const m = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/.exec(arg ?? '');
  return m ? Number(m[0]) : null;
}

function referencia(arg) {
  const m = /#(\d+)/.exec(arg ?? '');
  return m ? Number(m[1]) : null;
}

/**
 * Unidades declaradas no arquivo, já com o fator para a unidade base do SI (metro, radiano, ...).
 * `IFCCONVERSIONBASEDUNIT` aponta para um `IFCMEASUREWITHUNIT`; o fator final é valor × prefixo da unidade base.
 */
function unidades(lista) {
  const porId = new Map(lista.map((e) => [e.id, e]));
  const out = [];
  for (const e of lista) {
    if (e.type !== 'IFCSIUNIT' && e.type !== 'IFCCONVERSIONBASEDUNIT') continue;
    const args = argumentos(e.raw);
    const tipo = simbolo(args[1]);
    if (e.type === 'IFCSIUNIT') {
      const prefixo = simbolo(args[2]);
      const nome = simbolo(args[3]);
      out.push({ tipo, nome, prefixo, fator: prefixo ? (PREFIXOS[prefixo] ?? 1) : 1 });
      continue;
    }
    const nome = texto(args[2]);
    const medida = porId.get(referencia(args[3]));
    let valor = 1;
    let fatorBase = 1;
    if (medida?.type === 'IFCMEASUREWITHUNIT') {
      const margs = argumentos(medida.raw);
      valor = numero(margs[0]) ?? 1;
      const base = porId.get(referencia(margs[1]));
      if (base?.type === 'IFCSIUNIT') {
        const bargs = argumentos(base.raw);
        const prefixo = simbolo(bargs[2]);
        fatorBase = prefixo ? (PREFIXOS[prefixo] ?? 1) : 1;
      }
    }
    out.push({ tipo, nome, prefixo: '', fator: valor * fatorBase });
  }
  return out;
}

/** Análise independente: contagem por classe, schema, pavimentos e unidades. */
function analisar(texto) {
  const lista = [...entidades(texto)];
  const contagem = new Map();
  for (const e of lista) contagem.set(e.type, (contagem.get(e.type) ?? 0) + 1);
  const classes = {};
  for (const classe of [...contagem.keys()].sort()) classes[classe] = contagem.get(classe);
  const schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(texto)?.[1]?.toUpperCase() ?? '';
  return {
    dados: { schema, classes, storeys: classes.IFCBUILDINGSTOREY ?? 0 },
    unidades: unidades(lista),
  };
}

function fmtUnidades(lista) {
  if (!lista.length) return '(nenhuma)';
  return lista
    .map((u) => {
      const nome = [u.prefixo, u.nome].filter(Boolean).join(' ') || u.nome;
      return `${u.tipo}=${nome} (fator ${Number(u.fator.toPrecision(6))})`;
    })
    .join('; ');
}

/** Diferenças entre o esperado gravado e a contagem atual (strings prontas para o terminal). */
function comparar(esperado, atual) {
  const difs = [];
  if (esperado.schema !== atual.schema) difs.push(`schema: esperado ${JSON.stringify(esperado.schema)}, arquivo ${JSON.stringify(atual.schema)}`);
  if (esperado.storeys !== atual.storeys) difs.push(`pavimentos: esperado ${esperado.storeys}, arquivo ${atual.storeys}`);
  const anterior = esperado.classes ?? {};
  const nomes = new Set([...Object.keys(anterior), ...Object.keys(atual.classes)]);
  for (const classe of [...nomes].sort()) {
    const a = anterior[classe] ?? 0;
    const b = atual.classes[classe] ?? 0;
    if (a !== b) difs.push(`${classe}: esperado ${a}, arquivo ${b}`);
  }
  return difs;
}

function ajuda() {
  console.log(`uso: node scripts/ifc-oraculo.mjs [--todos] [--verificar] [arquivo.ifc ...]

  --todos       processa todos os .ifc de tests/ifc/fixtures
  --verificar   compara com tests/ifc/esperado/<nome>.json e falha (código 1) se divergir
  --ajuda       mostra esta ajuda

Sem --verificar, grava o esperado. O JSON tem { schema, classes, storeys }; as unidades saem no resumo.`);
}

const opcoes = process.argv.slice(2);
let todos = false;
let verificar = false;
let mostrarAjuda = false;
const arquivos = [];
for (const arg of opcoes) {
  if (arg === '--todos') todos = true;
  else if (arg === '--verificar') verificar = true;
  else if (arg === '--ajuda' || arg === '--help' || arg === '-h') mostrarAjuda = true;
  else if (arg.startsWith('-')) {
    console.error(`opção desconhecida: ${arg}`);
    ajuda();
    process.exit(2);
  } else arquivos.push(resolve(arg));
}
if (mostrarAjuda) {
  ajuda();
  process.exit(0);
}
if (todos) {
  const encontrados = existsSync(PASTA_FIXTURES)
    ? readdirSync(PASTA_FIXTURES)
        .filter((f) => f.toLowerCase().endsWith('.ifc'))
        .sort()
        .map((f) => join(PASTA_FIXTURES, f))
    : [];
  if (!encontrados.length) {
    console.error(`nenhum .ifc em ${relative(RAIZ, PASTA_FIXTURES)} (rode node scripts/baixar-ifc.mjs)`);
    process.exit(1);
  }
  for (const f of encontrados) if (!arquivos.includes(resolve(f))) arquivos.push(resolve(f));
}
if (!arquivos.length) {
  console.error('informe um arquivo .ifc ou use --todos');
  ajuda();
  process.exit(2);
}

mkdirSync(PASTA_ESPERADO, { recursive: true });
let falhas = 0;
for (const caminho of arquivos) {
  const nome = basename(caminho).replace(/\.ifc$/i, '');
  let texto;
  try {
    texto = readFileSync(caminho, 'utf8');
  } catch (erro) {
    console.error(`✗ ${nome}: não foi possível ler ${caminho} (${erro.message})`);
    falhas++;
    continue;
  }
  const { dados, unidades: listaUnidades } = analisar(texto);
  const destino = join(PASTA_ESPERADO, `${nome}.json`);
  const relativo = relative(RAIZ, destino).replaceAll('\\', '/');
  const classes = Object.keys(dados.classes).length;

  if (!verificar) {
    writeFileSync(destino, `${JSON.stringify(dados, null, 2)}\n`);
    console.log(`✓ ${nome}.ifc → ${relativo}`);
    console.log(`  ${dados.schema || '(sem FILE_SCHEMA)'}; ${classes} classe(s); ${dados.storeys} pavimento(s); ${listaUnidades.length} unidade(s)`);
    console.log(`  unidades: ${fmtUnidades(listaUnidades)}`);
    continue;
  }

  if (!existsSync(destino)) {
    console.error(`✗ ${nome}: esperado ausente (${relativo}); rode sem --verificar para gravar`);
    falhas++;
    continue;
  }
  let esperado;
  try {
    esperado = JSON.parse(readFileSync(destino, 'utf8'));
  } catch (erro) {
    console.error(`✗ ${nome}: ${relativo} não é JSON válido (${erro.message})`);
    falhas++;
    continue;
  }
  const difs = comparar(esperado, dados);
  if (difs.length) {
    console.error(`✗ ${nome}: ${difs.length} divergência(s) contra ${relativo}`);
    for (const d of difs) console.error(`  - ${d}`);
    falhas++;
  } else {
    console.log(`✓ ${nome}: confere com ${relativo} (${dados.schema}, ${classes} classes, ${dados.storeys} pavimento(s))`);
  }
}

if (verificar) console.log(falhas ? `\n${falhas} arquivo(s) divergente(s).` : `\n${arquivos.length} arquivo(s) conferido(s).`);
process.exitCode = falhas ? 1 : 0;
