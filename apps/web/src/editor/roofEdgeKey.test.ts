import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyProject, ProjectStore } from '@hestia/model';
import { roofEdgeKey } from './roofEdgeActions.ts';
import { useAtalhos } from './shortcutConfig.ts';
import { useUi } from './state.ts';

/**
 * Com uma aresta de telhado selecionada, a tecla I alterna "define inclinação" só se não começa um atalho:
 * no perfil Revit, I é começo de IN (Inclinação), que não pode ser engolido.
 */
describe('tecla de aresta de telhado x sequências de atalho', () => {
  beforeEach(() => {
    useUi.setState({ roofEdge: { roofId: 'rf_nao_existe', index: 0 } });
    useAtalhos.setState({ perfil: 'revit', alteracoes: {}, mapa: { ...useAtalhos.getState().mapa, slope: 'IN' }, pendente: '' });
  });

  it('I não alterna a aresta quando começa a sequência IN', () => {
    expect(roofEdgeKey('i', new ProjectStore(createEmptyProject()))).toBe(false);
  });

  it('sem atalho que comece por I, a tecla alterna a aresta selecionada', () => {
    useAtalhos.setState({ mapa: { ...useAtalhos.getState().mapa, slope: 'QX' } });
    expect(roofEdgeKey('i', new ProjectStore(createEmptyProject()))).toBe(true);
  });
});
