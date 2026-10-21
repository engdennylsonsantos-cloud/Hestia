import { describe, expect, it } from 'vitest';
import { generateStraightRun, resolveLevel } from '@hestia/engine';
import { dxfLayerOfMaterial } from '@hestia/io';
import { ProjectStore, buildTemplate, makeStair, makeWall, type Opening, type StairRun } from '@hestia/model';
import { planDxf, stairArrow } from './dxfExport.ts';

/** Duas paredes em L no térreo, com uma porta na primeira. Passa pelo engine real, como no app. */
function lPlan(): ProjectStore {
  const store = new ProjectStore(buildTemplate('blank'));
  const typeId = store.project.defaults.wallTypeId;
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w1', typeId, levelId: 'lv_0', a: { x: 0, y: 0 }, b: { x: 6, y: 0 } }) });
  store.exec({ type: 'addWall', wall: makeWall({ id: 'w2', typeId, levelId: 'lv_0', a: { x: 6, y: 0 }, b: { x: 6, y: 4 } }) });
  const door: Opening = {
    id: 'to_door',
    kind: 'door',
    typeId: store.project.defaults.doorTypeId,
    hostId: 'w1',
    offset: 3,
    flipHand: false,
    flipFacing: false,
    sillOverride: null,
    mark: '',
  };
  store.exec({ type: 'addOpening', opening: door });
  return store;
}

describe('planDxf com o engine real', () => {
  it('um L com porta: camadas de parede, contorno, abertura e polilinhas fechadas', () => {
    const store = lPlan();
    const p = store.project;
    const text = planDxf(p, 'lv_0', resolveLevel(p, 'lv_0'));

    const wallLayers = p.wallTypes[p.defaults.wallTypeId]!.layers.map((l) => dxfLayerOfMaterial(p.materials[l.materialId]!.name));
    for (const layer of new Set(wallLayers)) expect(text).toContain(`\r\n${layer}\r\n`);
    expect(text).toContain('\r\nPAREDE_CONTORNO\r\n');
    expect(text).toContain('\r\nABERTURAS\r\n');

    // cada polilinha abre com 0/POLYLINE e fecha com SEQEND: contagem por registro
    const polylines = text.match(/\r\n0\r\nPOLYLINE\r\n/g) ?? [];
    const seqends = text.match(/\r\n0\r\nSEQEND\r\n/g) ?? [];
    expect(polylines.length).toBeGreaterThanOrEqual(3);
    expect(seqends).toHaveLength(polylines.length);
    expect(text.endsWith('\r\n0\r\nEOF\r\n')).toBe(true);
  });

  it('nível sem paredes ainda gera arquivo válido, sem polilinhas', () => {
    const p = buildTemplate('blank');
    const text = planDxf(p, 'lv_0', resolveLevel(p, 'lv_0'));
    expect(text).not.toContain('\r\nPOLYLINE\r\n');
    expect(text.endsWith('\r\n0\r\nEOF\r\n')).toBe(true);
  });
});

describe('escadas no DXF (camadas ESCADA, ESCADA_ESPELHO e ESCADA_SETA)', () => {
  it('um lance reto com 5 espelhos: 4 degraus fechados, 5 espelhos e a seta de subida', () => {
    const store = new ProjectStore(buildTemplate('blank'));
    const sketch = generateStraightRun({ start: { x: 0.6, y: 0 }, dir: { x: 0, y: 1 }, width: 1.2, risers: 5, tread: 0.28 });
    const run: StairRun = { id: 'r1', kind: 'run', ...sketch };
    store.exec({ type: 'addStair', stair: makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0', components: [run] }) });
    const p = store.project;
    const text = planDxf(p, 'lv_0', resolveLevel(p, 'lv_0'));

    // Conta registros de entidade (0/POLYLINE ou 0/LINE seguido da camada), não ocorrências do nome da camada.
    const polylines = text.match(/\r\n0\r\nPOLYLINE\r\n8\r\nESCADA\r\n/g) ?? [];
    expect(polylines).toHaveLength(4);
    const risers = text.match(/\r\n0\r\nLINE\r\n8\r\nESCADA_ESPELHO\r\n/g) ?? [];
    expect(risers).toHaveLength(5);
    // seta: haste e duas pontas
    const arrow = text.match(/\r\n0\r\nLINE\r\n8\r\nESCADA_SETA\r\n/g) ?? [];
    expect(arrow).toHaveLength(3);
    expect(text.endsWith('\r\n0\r\nEOF\r\n')).toBe(true);
  });

  it('sem escada, nenhuma camada de escada aparece', () => {
    const p = buildTemplate('blank');
    const text = planDxf(p, 'lv_0', resolveLevel(p, 'lv_0'));
    expect(text).not.toContain('ESCADA');
  });

  it('a seta sai do primeiro espelho e aponta para o último (no sentido da subida)', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 0, y: 2 };
    const arrow = stairArrow(a, b);
    expect(arrow[0]).toEqual([a, b]);
    // as pontas ficam atrás da ponta da seta (y menor que 2)
    for (const [, end] of arrow.slice(1)) expect(end.y).toBeLessThan(2);
    expect(stairArrow(a, a)).toEqual([]);
  });
});
