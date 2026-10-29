/**
 * Exporta os modelos de partida do Hestia para IFC4, com data fixa (determinismo), em `test-results/ifc-quality/`.
 * Uso: `npx vite-node scripts/ifc-quality/export-fixtures.mts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTemplate, type TemplateId } from '../../packages/model/src/templates.ts';
import { projectIfc } from '../../apps/web/src/editor/ifcExport.ts';

const MODELOS: TemplateId[] = ['house2', 'studio', 'house-premium', 'predio10', 'esquadrias'];
const SAIDA = join('test-results', 'ifc-quality');
const DATA = new Date('2026-10-29T00:00:00Z');

mkdirSync(SAIDA, { recursive: true });
for (const id of MODELOS) {
  const projeto = buildTemplate(id);
  const texto = projectIfc(projeto, DATA);
  const arquivo = join(SAIDA, `${id}.ifc`);
  writeFileSync(arquivo, texto);
  console.log(`${arquivo}: ${projeto.levels.length} nível(is), ${Object.keys(projeto.elements).length} elemento(s), ${(texto.length / 1024).toFixed(0)} kB`);
}
