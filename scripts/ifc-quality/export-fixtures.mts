/**
 * Exporta os modelos de partida do Hestia para IFC4, com data fixa (determinismo), em `test-results/ifc-quality/`.
 * Uso: `npx vite-node scripts/ifc-quality/export-fixtures.mts`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createEmptyProject, makeRoom, makeWall, ProjectStore, type Project } from '../../packages/model/src/index.ts';
import { buildTemplate, type TemplateId } from '../../packages/model/src/templates.ts';
import { projectIfc } from '../../apps/web/src/editor/ifcExport.ts';

const MODELOS: TemplateId[] = ['house2', 'studio', 'house-premium', 'predio10', 'esquadrias'];
const SAIDA = join('test-results', 'ifc-quality');
const DATA = new Date('2026-10-29T00:00:00Z');

/** Projeto de qualidade com ambientes e grades: os templates do Hestia não criam `Room` nem `Grid`. */
function casaComAmbientes(): Project {
  const store = new ProjectStore(createEmptyProject('Casa com ambientes'));
  const anel: Array<[number, number]> = [
    [0, 0],
    [0, 5],
    [4, 5],
    [4, 0],
  ];
  anel.forEach((a, i) => {
    const b = anel[(i + 1) % anel.length]!;
    store.exec({
      type: 'addWall',
      wall: makeWall({
        id: `qw${i}`,
        typeId: store.project.defaults.wallTypeId,
        levelId: 'lv_0',
        a: { x: a[0], y: a[1] },
        b: { x: b[0], y: b[1] },
        locationLine: 'finishInterior',
      }),
    });
  });
  store.exec({ type: 'addRoom', room: makeRoom({ id: 'qr1', levelId: 'lv_0', name: 'Sala', number: '101', point: { x: 2, y: 2.5 } }) });
  store.exec({ type: 'addGrid', grid: { id: 'qgA', name: 'A', typeId: 'gt_6mm', points: [{ x: 0, y: 0 }, { x: 0, y: 5 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
  store.exec({ type: 'addGrid', grid: { id: 'qg1', name: '1', typeId: 'gt_6mm', points: [{ x: 0, y: 0 }, { x: 4, y: 0 }], sag: 0, bubbleStart: true, bubbleEnd: true } });
  return store.project;
}

mkdirSync(SAIDA, { recursive: true });
for (const id of MODELOS) {
  const projeto = buildTemplate(id);
  const texto = projectIfc(projeto, DATA);
  const arquivo = join(SAIDA, `${id}.ifc`);
  writeFileSync(arquivo, texto);
  console.log(`${arquivo}: ${projeto.levels.length} nível(is), ${Object.keys(projeto.elements).length} elemento(s), ${(texto.length / 1024).toFixed(0)} kB`);
}

const ambientes = casaComAmbientes();
const texto = projectIfc(ambientes, DATA);
const arquivo = join(SAIDA, 'casa-ambientes.ifc');
writeFileSync(arquivo, texto);
console.log(`${arquivo}: ${ambientes.levels.length} nível(is), ${Object.keys(ambientes.elements).length} elemento(s), ${(texto.length / 1024).toFixed(0)} kB`);
