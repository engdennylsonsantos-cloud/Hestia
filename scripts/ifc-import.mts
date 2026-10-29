/**
 * Importa um arquivo IFC para o formato do Hestia, sem interface: `npx vite-node scripts/ifc-import.mts entrada.ifc [saida.hestia.json]`.
 * O relatório (o que entrou, o que ficou de fora e por quê) sai no terminal e ao lado do arquivo, em `<saida>.relatorio.json`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { importIfc } from '../packages/io/src/ifcImport/index.ts';

const [input, output] = process.argv.slice(2);
if (!input) {
  console.error('uso: npx vite-node scripts/ifc-import.mts <arquivo.ifc> [saida.hestia.json]');
  process.exit(2);
}
const text = readFileSync(input, 'utf8');
const started = performance.now();
const { project, report } = importIfc(text);
const ms = Math.round(performance.now() - started);
const nome = output ?? `${basename(input).replace(/\.[^.]+$/, '')}.hestia.json`;
writeFileSync(nome, JSON.stringify(project));
writeFileSync(`${nome}.relatorio.json`, JSON.stringify(report, null, 2));
const elements = Object.keys(project.elements).length;
console.log(`IFC ${report.schema} → ${nome}`);
console.log(`  ${elements} elemento(s) em ${ms} ms; ${report.levels} nível(is)`);
console.log(`  importado: ${JSON.stringify(report.imported)}`);
console.log(`  ignorado:  ${JSON.stringify(report.skipped)}`);
if (Object.keys(report.approximate).length) console.log(`  aproximado: ${JSON.stringify(report.approximate)}`);
if (Object.keys(report.geometry).length) console.log(`  geometria não representada: ${JSON.stringify(report.geometry)}`);
if (report.warnings.length) for (const w of report.warnings) console.log(`  aviso: ${w}`);
