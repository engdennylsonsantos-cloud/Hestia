import { beforeEach, describe, expect, it } from 'vitest';
import { clearDimOverride, clearDimOverrides, setDimOverride, suspendSelectionDims, useUi } from './state.ts';

describe('dimOverrides (referências de cota da sessão)', () => {
  beforeEach(() => {
    useUi.setState({ dimOverrides: {}, dimsSuspendedVersion: null, selection: [], tool: 'select' });
  });

  it('setDimOverride grava por chave e preserva as outras', () => {
    setDimOverride('opening:wallLeft', 'axis');
    setDimOverride('opening:openRight', 'casing');
    expect(useUi.getState().dimOverrides).toEqual({ 'opening:wallLeft': 'axis', 'opening:openRight': 'casing' });
    setDimOverride('opening:wallLeft', 'coreFace');
    expect(useUi.getState().dimOverrides['opening:wallLeft']).toBe('coreFace');
  });

  it('clearDimOverride remove só a chave', () => {
    setDimOverride('opening:wall', 'axis');
    setDimOverride('opening:opening', 'clear');
    clearDimOverride('opening:wall');
    expect(useUi.getState().dimOverrides).toEqual({ 'opening:opening': 'clear' });
  });

  it('clearDimOverrides esvazia', () => {
    setDimOverride('opening:wallLeft', 'axis');
    clearDimOverrides();
    expect(useUi.getState().dimOverrides).toEqual({});
  });

  it('trocar de ferramenta ou de seleção limpa as trocas', () => {
    setDimOverride('opening:wallLeft', 'axis');
    useUi.setState({ tool: 'wall' });
    expect(useUi.getState().dimOverrides).toEqual({});
    setDimOverride('opening:wallLeft', 'axis');
    useUi.setState({ selection: ['a'] });
    expect(useUi.getState().dimOverrides).toEqual({});
  });

  it('a suspensão das cotas temporárias some na próxima ferramenta ou seleção', () => {
    suspendSelectionDims(3);
    expect(useUi.getState().dimsSuspendedVersion).toBe(3);
    useUi.setState({ selection: ['a'] });
    expect(useUi.getState().dimsSuspendedVersion).toBeNull();

    suspendSelectionDims(4);
    useUi.setState({ tool: 'wall' });
    expect(useUi.getState().dimsSuspendedVersion).toBeNull();
  });
});
