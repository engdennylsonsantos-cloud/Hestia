import { describe, expect, it } from 'vitest';
import { resolveLevel } from '@hestia/engine';
import { dxfLayerOfMaterial } from '@hestia/io';
import { ProjectStore, buildTemplate, makeWall, type Opening } from '@hestia/model';
import { planDxf } from './dxfExport.ts';

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
