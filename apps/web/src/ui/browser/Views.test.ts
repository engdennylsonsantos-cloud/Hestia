import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { makeView3DPoint, type SheetView3DCamera } from '@hestia/model';
import { View3DPointNode } from './Views.tsx';

const CAM: SheetView3DCamera = { azimuth: -0.7, elevation: 0.45, distance: 18, target: { x: 2, y: 3, z: 1.5 }, ortho: false };

describe('navegador: nó de ponto de vista 3D', () => {
  it('mostra o nome, a chave do nó, o ícone cubo e o arraste para a prancha', () => {
    const ponto = makeView3DPoint(CAM, 'Fachada norte');
    const html = renderToStaticMarkup(createElement(View3DPointNode, { point: ponto, pranchas: 2 }));
    expect(html).toContain(`data-node="v3d:${ponto.id}"`);
    expect(html).toContain('Fachada norte');
    expect(html).toContain('draggable="true"');
    expect(html).toContain('Duplo clique leva o 3D a este ponto');
    // O ícone `cube` vira o svg da árvore.
    expect(html).toContain('<svg class="ic"');
  });
});
