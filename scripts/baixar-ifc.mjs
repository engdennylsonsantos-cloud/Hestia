/**
 * Baixa os modelos IFC de teste do importador para `tests/ifc/fixtures/`.
 *
 * Uso:
 *   node scripts/baixar-ifc.mjs               # baixa o conjunto normal (sem o de 25 MB)
 *   node scripts/baixar-ifc.mjs --grandes     # inclui o sample do Revit (25 MB)
 *   node scripts/baixar-ifc.mjs --so-verificar # confere bytes e sha256 do que já está no disco
 *   node scripts/baixar-ifc.mjs --forcar      # sobrescreve um arquivo com sha diferente
 *
 * Sem dependências: `fetch` e `crypto` do próprio Node. Um arquivo existente nunca é sobrescrito
 * com conteúdo diferente sem `--forcar`; o script avisa e segue com os demais.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'tests', 'ifc', 'fixtures');
const ARQ_MANIFEST = path.join(DIR, 'manifest.json');
const ARQ_README = path.join(DIR, 'README.md');

/**
 * Os fixtures. `licenca` é o que se aplica ao uso do arquivo; `fonte` é o repositório de origem.
 * `grande` marca o que só entra com `--grandes` (o download padrão fica abaixo de 5 MB).
 */
const MODELOS = [
  {
    arquivo: 'parede-janela.ifc',
    url: 'https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%204.0.2.1%20(IFC%204%20ADD2%20TC1)/ISO%20Spec%20-%20ReferenceView_V1.2/wall-with-opening-and-window.ifc',
    licenca: 'buildingSMART — uso livre para teste',
    fonte: 'buildingSMART/Certification-datasets · ISO Spec ReferenceView V1.2',
    descricao: 'uma parede com vão e janela (IFC4 ADD2 TC1)',
  },
  {
    arquivo: 'predio-simples.ifc',
    url: 'https://raw.githubusercontent.com/buildingSMART/Certification-datasets/main/IFC%204.0.2.1%20(IFC%204%20ADD2%20TC1)/Simple-Scene/Building-Architecture.ifc',
    licenca: 'buildingSMART — uso livre para teste',
    fonte: 'buildingSMART/Certification-datasets · Simple-Scene',
    descricao: 'prédio de dois pavimentos com paredes, lajes e vãos',
  },
  {
    arquivo: 'casa-pequena.ifc',
    url: 'https://raw.githubusercontent.com/IfcOpenShell/files/master/tests/ISSUE_005_haus_60012.ifc',
    licenca: 'IfcOpenShell — repositório sem licença declarada (uso local)',
    fonte: 'IfcOpenShell/files · tests/ISSUE_005_haus_60012.ifc',
    descricao: 'casinha pequena, útil para o caminho rápido do importador',
  },
  {
    arquivo: 'fzk-haus.ifc',
    url: 'https://raw.githubusercontent.com/opensourceBIM/TestFiles/master/TestData/data/AC11-FZK-Haus-IFC.ifc',
    licenca: 'KIT — CC BY 4.0 (atribuição obrigatória)',
    fonte: 'opensourceBIM/TestFiles · AC11-FZK-Haus-IFC.ifc',
    descricao: 'FZK-Haus: casa completa exportada do Archicad',
  },
  {
    arquivo: 'revit-amostra.ifc',
    url: 'https://raw.githubusercontent.com/opensourceBIM/TestFiles/master/TestData/data/ifc4rac_basic_sample_project.ifc',
    licenca: 'Autodesk — sample do Revit (IFC4 Reference View)',
    fonte: 'opensourceBIM/TestFiles · ifc4rac_basic_sample_project.ifc',
    descricao: 'projeto de amostra do Revit (25 MB) — só com --grandes',
    grande: true,
  },
];

const USO = `uso: node scripts/baixar-ifc.mjs [--grandes] [--so-verificar] [--forcar]

  (sem flag)       baixa os fixtures que faltam (sem o sample de 25 MB)
  --grandes        inclui revit-amostra.ifc (25 MB)
  --so-verificar   não baixa nada; confere bytes e sha256 contra o manifest.json
  --forcar         sobrescreve arquivo existente mesmo com sha diferente
  --ajuda          mostra esta ajuda`;

const args = new Set(process.argv.slice(2));
const GRANDES = args.has('--grandes');
const SO_VERIFICAR = args.has('--so-verificar');
const FORCAR = args.has('--forcar');

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const tamanho = (n) => (n >= 1024 * 1024 ? mb(n) : kb(n));
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

function lerManifest() {
  if (!existsSync(ARQ_MANIFEST)) return null;
  try {
    const dados = JSON.parse(readFileSync(ARQ_MANIFEST, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(dados) ? dados : null;
  } catch {
    return null;
  }
}

function escreverManifest(registros) {
  writeFileSync(ARQ_MANIFEST, `${JSON.stringify(registros, null, 2)}\n`);
}

function escreverReadme(registros) {
  const linhas = [
    '# Modelos IFC de teste',
    '',
    'Fixtures do importador de IFC (`packages/io/src/ifcImport/`). São arquivos grandes demais para o',
    'repositório: baixe com o script e não versione o conteúdo. O `manifest.json` guarda o `sha256` de',
    'cada arquivo para conferir a integridade sem depender da rede.',
    '',
    '```powershell',
    'node scripts/baixar-ifc.mjs                # conjunto normal (~4,3 MB)',
    'node scripts/baixar-ifc.mjs --grandes      # inclui o sample do Revit (25 MB)',
    'node scripts/baixar-ifc.mjs --so-verificar # confere o que já está no disco',
    '```',
    '',
    'Um arquivo existente com `sha256` diferente do remoto não é sobrescrito: o script avisa e só troca',
    'com `--forcar`.',
    '',
    '| Arquivo | Tamanho | Conteúdo | Licença | Fonte |',
    '|---|---|---|---|---|',
  ];
  for (const r of registros) {
    const modelo = MODELOS.find((m) => m.arquivo === r.arquivo);
    linhas.push(`| \`${r.arquivo}\` | ${tamanho(r.bytes)} | ${modelo?.descricao ?? ''} | ${r.licenca} | ${r.fonte} |`);
  }
  linhas.push(
    '',
    '## Licenças',
    '',
    '- **buildingSMART** (`parede-janela.ifc`, `predio-simples.ifc`): modelos de certificação, uso livre para teste.',
    '- **IfcOpenShell** (`casa-pequena.ifc`): o repositório não declara licença; usar apenas localmente, sem redistribuir.',
    '- **KIT / FZK-Haus** (`fzk-haus.ifc`): CC BY 4.0 — ao usar em material publicado, cite o KIT (Karlsruhe Institute of Technology).',
    '- **Autodesk** (`revit-amostra.ifc`): projeto de amostra do Revit distribuído no `opensourceBIM/TestFiles`.',
    '',
    'O `manifest.json` é gerado pelo próprio script; não edite à mão.',
  );
  writeFileSync(ARQ_README, `${linhas.join('\n')}\n`);
}

async function baixar(modelo) {
  const res = await fetch(modelo.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const declarado = Number(res.headers.get('content-length'));
  // Com gzip/br o Content-Length é do corpo comprimido, não do arquivo: só confere sem codificação.
  const semCodificacao = !res.headers.get('content-encoding');
  if (semCodificacao && Number.isFinite(declarado) && declarado > 0 && declarado !== buf.length) {
    throw new Error(`tamanho divergente: Content-Length ${declarado}, recebido ${buf.length}`);
  }
  return buf;
}

/** Confere o que já está no disco contra o manifest; não toca na rede. */
function verificar() {
  const manifest = lerManifest();
  if (!manifest) {
    console.error('manifest.json ausente ou inválido: rode sem --so-verificar para gerar.');
    return 1;
  }
  const porArquivo = new Map(manifest.map((r) => [r.arquivo, r]));
  let falhas = 0;
  let ausentes = 0;
  let ok = 0;

  for (const modelo of MODELOS) {
    const registro = porArquivo.get(modelo.arquivo);
    const arquivo = path.join(DIR, modelo.arquivo);
    if (!registro) {
      if (modelo.grande) {
        console.log(`  - ${modelo.arquivo}: fora do manifest (opcional, --grandes)`);
      } else {
        console.error(`  x ${modelo.arquivo}: sem entrada no manifest (rode sem --so-verificar)`);
        ausentes++;
      }
      continue;
    }
    if (!existsSync(arquivo)) {
      console.error(`  x ${modelo.arquivo}: ausente no disco (${registro.bytes} bytes no manifest)`);
      ausentes++;
      continue;
    }
    const buf = readFileSync(arquivo);
    const hash = sha256(buf);
    if (buf.length !== registro.bytes) {
      console.error(`  x ${modelo.arquivo}: ${buf.length} bytes no disco, ${registro.bytes} no manifest`);
      falhas++;
      continue;
    }
    if (hash !== registro.sha256) {
      console.error(`  x ${modelo.arquivo}: sha256 ${hash.slice(0, 12)}… ≠ ${String(registro.sha256).slice(0, 12)}…`);
      falhas++;
      continue;
    }
    console.log(`  ok ${modelo.arquivo}: ${tamanho(buf.length)}, sha256 ${hash.slice(0, 12)}…`);
    ok++;
  }

  for (const nome of readdirSync(DIR)) {
    if (!nome.endsWith('.ifc')) continue;
    if (MODELOS.some((m) => m.arquivo === nome)) continue;
    console.log(`  ? ${nome}: IFC fora da lista de fixtures (ignorado)`);
  }

  const total = ok + falhas + ausentes;
  console.log(`verificação: ${ok}/${total} ok, ${falhas} com sha/tamanho errado, ${ausentes} ausente(s)`);
  return falhas || ausentes ? 1 : 0;
}

async function principal() {
  if (args.has('--ajuda') || args.has('--help') || args.has('-h')) {
    console.log(USO);
    return 0;
  }
  if (SO_VERIFICAR) return verificar();

  mkdirSync(DIR, { recursive: true });
  const manifestAntigo = lerManifest() ?? [];
  const anteriores = new Map(manifestAntigo.map((r) => [r.arquivo, r]));
  const shaAntigo = new Map(manifestAntigo.map((r) => [r.arquivo, r.sha256]));
  const registros = [];
  let erros = 0;
  let baixados = 0;

  for (const modelo of MODELOS) {
    if (modelo.grande && !GRANDES) {
      // Mantém no manifest o que já foi baixado com --grandes; só não baixa de novo.
      const antigo = anteriores.get(modelo.arquivo);
      if (antigo && existsSync(path.join(DIR, modelo.arquivo))) registros.push(antigo);
      console.log(`  - ${modelo.arquivo}: pulado (~25 MB; use --grandes)`);
      continue;
    }
    const arquivo = path.join(DIR, modelo.arquivo);
    const existente = existsSync(arquivo) ? readFileSync(arquivo) : null;
    const hashExistente = existente ? sha256(existente) : null;

    if (existente && !FORCAR && shaAntigo.get(modelo.arquivo) === hashExistente) {
      console.log(`  = ${modelo.arquivo}: já está atualizado (${tamanho(existente.length)})`);
      registros.push({ arquivo: modelo.arquivo, url: modelo.url, bytes: existente.length, sha256: hashExistente, licenca: modelo.licenca, fonte: modelo.fonte });
      continue;
    }

    process.stdout.write(`  ↓ ${modelo.arquivo} … `);
    let buf;
    try {
      buf = await baixar(modelo);
    } catch (erro) {
      console.log(`falhou (${erro instanceof Error ? erro.message : String(erro)})`);
      erros++;
      const antigo = anteriores.get(modelo.arquivo);
      if (antigo) {
        console.log('    mantendo a entrada anterior do manifest (o arquivo local não foi conferido)');
        registros.push(antigo);
      } else if (existente) {
        console.log(`    mantendo o arquivo local (${tamanho(existente.length)}, não conferido com o remoto)`);
        registros.push({ arquivo: modelo.arquivo, url: modelo.url, bytes: existente.length, sha256: hashExistente, licenca: modelo.licenca, fonte: modelo.fonte });
      }
      continue;
    }
    const hash = sha256(buf);
    process.stdout.write(`${tamanho(buf.length)} `);

    if (existente && !FORCAR && hashExistente !== hash) {
      console.log('conflito: o arquivo local difere do remoto — mantido (use --forcar para trocar)');
      erros++;
      // O manifest descreve o fixture esperado (remoto); a verificação acusa o disco divergente.
      registros.push({ arquivo: modelo.arquivo, url: modelo.url, bytes: buf.length, sha256: hash, licenca: modelo.licenca, fonte: modelo.fonte });
      continue;
    }
    if (existente && hashExistente === hash) {
      console.log('idêntico ao local, mantido');
    } else {
      writeFileSync(arquivo, buf);
      console.log(existente ? 'sobrescrito' : 'gravado');
      baixados++;
    }
    registros.push({ arquivo: modelo.arquivo, url: modelo.url, bytes: buf.length, sha256: hash, licenca: modelo.licenca, fonte: modelo.fonte });
  }

  const ordem = new Map(MODELOS.map((m, i) => [m.arquivo, i]));
  registros.sort((a, b) => (ordem.get(a.arquivo) ?? 0) - (ordem.get(b.arquivo) ?? 0));
  escreverManifest(registros);
  escreverReadme(registros);

  console.log(`${registros.length} arquivo(s) no manifest; ${baixados} gravado(s); ${erros} erro(s)`);
  return erros ? 1 : 0;
}

process.exitCode = await principal();
