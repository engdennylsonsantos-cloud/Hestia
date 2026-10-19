// Porta de qualidade (docs/paridade/ORDEM.json): impede abrir o próximo elemento enquanto o anterior
// não estiver ~100% resolvido. Uso: `node scripts/check-parity.mjs` (falha no CI) ou `--report`.
import { readFileSync, existsSync } from 'node:fs';

const ordem = JSON.parse(readFileSync('docs/paridade/ORDEM.json', 'utf8'));
const report = process.argv.includes('--report');

function medir(arquivo) {
  const path = `docs/paridade/${arquivo}`;
  if (!existsSync(path)) return null;
  const linhas = readFileSync(path, 'utf8').split('\n').filter((l) => /^- \[[ x-]\] /.test(l));
  let feitos = 0;
  let foraDeEscopo = 0;
  const pendentesBloqueantes = [];
  const pendentes = [];
  for (const l of linhas) {
    const marca = l[3];
    const bloqueante = l.includes('(bloqueante)');
    if (marca === 'x') feitos++;
    else if (marca === '-') foraDeEscopo++;
    else {
      pendentes.push(l.slice(6).trim());
      if (bloqueante) pendentesBloqueantes.push(l.slice(6).trim());
    }
  }
  const total = linhas.length;
  return { total, feitos, foraDeEscopo, pct: total ? (feitos + foraDeEscopo) / total : 0, pendentes, pendentesBloqueantes };
}

let falhou = false;
let anteriorOk = true;
let anteriorId = '';
for (const el of ordem.elementos) {
  const m = medir(el.arquivo);
  const pct = m ? m.pct : 0;
  const aberto = el.status !== 'nao-iniciado';
  const linha = m
    ? `${el.id.padEnd(10)} ${(pct * 100).toFixed(0).padStart(3)}%  (${m.feitos} feitos, ${m.foraDeEscopo} fora de escopo, ${m.pendentes.length} pendentes, ${m.pendentesBloqueantes.length} bloqueantes)  [${el.status}]`
    : `${el.id.padEnd(10)}   —   sem checklist  [${el.status}]`;
  if (report || aberto) console.log(linha);
  if (aberto && !anteriorOk) {
    console.error(`FALHA: "${el.id}" está ${el.status}, mas "${anteriorId}" ainda não atingiu ${ordem.limiar * 100}% e/ou tem itens bloqueantes pendentes.`);
    falhou = true;
  }
  if (el.status === 'concluido' && (!m || pct < ordem.limiar || m.pendentesBloqueantes.length)) {
    console.error(`FALHA: "${el.id}" marcado como concluído sem cumprir a regra.`);
    falhou = true;
  }
  anteriorOk = !!m && pct >= ordem.limiar && m.pendentesBloqueantes.length === 0;
  anteriorId = el.id;
}
if (falhou) process.exit(1);
console.log('porta de qualidade ok');
