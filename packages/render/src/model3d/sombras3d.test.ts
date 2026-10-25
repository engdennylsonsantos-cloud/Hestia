import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '@hestia/model';
import { ModelScene } from './scene3d.ts';
import { SombraSobDemanda, type MapaDeSombraRenderer } from './sombras3d.ts';

/** Renderer de mentira com o campo `shadowMap` do three (o que a sombra sob demanda lê e escreve). */
const renderer = (): MapaDeSombraRenderer => ({ shadowMap: { autoUpdate: true, needsUpdate: false } });

describe('SombraSobDemanda', () => {
  it('começa suja: o primeiro quadro pede o mapa', () => {
    const s = new SombraSobDemanda();
    expect(s.sujo).toBe(true);
    const r = renderer();
    expect(s.aplicar(r)).toBe(true);
    expect(r.shadowMap.needsUpdate).toBe(true);
  });

  it('desliga a regeneração automática do renderer', () => {
    const r = renderer();
    new SombraSobDemanda().aplicar(r);
    expect(r.shadowMap.autoUpdate).toBe(false);
  });

  it('limpa a marca depois de pedir: quadros seguintes (câmera, zoom) não pedem o mapa de novo', () => {
    const s = new SombraSobDemanda();
    s.aplicar(renderer());
    expect(s.sujo).toBe(false);
    const r = renderer();
    expect(s.aplicar(r)).toBe(false);
    expect(r.shadowMap.needsUpdate).toBe(false);
  });

  it('marcar de novo (o modelo ou o sol mudaram) faz o próximo quadro pedir o mapa', () => {
    const s = new SombraSobDemanda();
    s.aplicar(renderer());
    s.marcar();
    expect(s.sujo).toBe(true);
    expect(s.aplicar(renderer())).toBe(true);
  });
});

describe('ModelScene e a sombra sob demanda', () => {
  const opcoes = { edges: false, shadows: true, dark: false };

  it('atualizar o modelo suja o mapa; quadros sem atualização (órbita, realce) não', () => {
    const ms = new ModelScene();
    const p = createEmptyProject('teste');
    ms.update(p, [], opcoes);
    expect(ms.sombra.sujo).toBe(true);
    ms.sombra.aplicar(renderer());
    // Realce (seleção e cursor) não muda a luz nem a geometria: o mapa continua válido.
    ms.highlight([], null);
    expect(ms.sombra.sujo).toBe(false);
    ms.dispose();
  });
});
