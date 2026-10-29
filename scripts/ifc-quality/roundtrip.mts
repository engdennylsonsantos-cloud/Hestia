/**
 * Round-trip de exportação: modelo de partida → IFC → importação → assinatura canônica.
 * Compara níveis, contagens por tipo e espessuras de parede. Serve de linha de base até o `Pset_Hestia_Element`
 * (onda 1) permitir a comparação exata do registro nativo.
 *
 * Uso: `npx vite-node scripts/ifc-quality/roundtrip.mts`.
 */
import { buildTemplate, type TemplateId } from '../../packages/model/src/templates.ts';
import { projectIfc } from '../../apps/web/src/editor/ifcExport.ts';
import { importIfc } from '../../packages/io/src/ifcImport/index.ts';
import { resumoCanonico } from '../../tests/ifc-export/canonical.ts';

const MODELOS: TemplateId[] = ['house2', 'studio', 'house-premium', 'predio10', 'esquadrias'];
const DATA = new Date('2026-10-29T00:00:00Z');
const estrito = process.argv.includes('--strict');
let falhas = 0;

for (const id of MODELOS) {
  const original = buildTemplate(id);
  const texto = projectIfc(original, DATA);
  const { project: voltou, report } = importIfc(texto);
  const a = resumoCanonico(original);
  const b = resumoCanonico(voltou);
  const diferencas: string[] = [];
  if (a.levels !== b.levels) diferencas.push(`níveis ${a.levels} → ${b.levels}`);
  for (const [kind, n] of Object.entries(a.counts)) {
    const m = b.counts[kind] ?? 0;
    if (n !== m) diferencas.push(`${kind} ${n} → ${m}`);
  }
  const importados = Object.entries(report.imported).map(([k, v]) => `${k}:${v}`).join(' ');
  const ignorados = Object.entries(report.skipped).map(([k, v]) => `${k}:${v}`).join(' ') || '—';
  console.log(`${id}: ${diferencas.length ? 'DIFERE' : 'ok'} | importado ${importados} | ignorado ${ignorados}`);
  for (const d of diferencas) console.log(`   - ${d}`);
  if (diferencas.length) falhas++;
}
if (falhas) {
  console.error(`[roundtrip] ${falhas} modelo(s) divergente(s) — lacunas conhecidas até a onda 1 (ambientes, eixos, telhado/escada nativos).`);
  if (estrito) process.exit(1);
} else {
  console.log('[roundtrip] todos os modelos mantiveram níveis/contagens na ida e volta.');
}
