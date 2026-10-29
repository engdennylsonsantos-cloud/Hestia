import { describe, expect, it } from 'vitest';
import { ProjectStore, createEmptyProject, dimensionSettingsOf } from '@hestia/model';
import { OPENING_OPTIONS, WALL_OPTIONS, applyDraft, defaultDraft, draftFromProject, sessionChoice } from './dimensionSettingsModel.ts';

describe('modelo do diálogo Cotas…', () => {
  it('rascunho vem dos padrões e confirmar grava e desfaz num passo', () => {
    const s = new ProjectStore(createEmptyProject());
    const d = draftFromProject(s.project);
    expect(d).toEqual({ wallRef: 'finish', openingRef: 'frame', showOnPlacement: true, showOnSelection: true });
    s.exec({ type: 'setSettings', patch: { dimensions: applyDraft({ ...d, wallRef: 'coreFace', openingRef: 'casing', showOnPlacement: false }) } });
    expect(dimensionSettingsOf(s.project)).toEqual({ wallRef: 'coreFace', openingRef: 'casing', showOnPlacement: false, showOnSelection: true });
    expect(draftFromProject(s.project).wallRef).toBe('coreFace');
    s.undo();
    expect(draftFromProject(s.project)).toEqual(defaultDraft());
  });

  it('restaurar padrões devolve a configuração inicial e não é a mesma referência dos padrões', () => {
    const a = defaultDraft();
    a.wallRef = 'axis';
    expect(defaultDraft().wallRef).toBe('finish');
  });

  it('quatro opções por extenso em cada seletor', () => {
    expect(WALL_OPTIONS.map((o) => o.label)).toEqual(['Eixo', 'Face acabada', 'Eixo do núcleo', 'Face do núcleo']);
    expect(OPENING_OPTIONS.map((o) => o.label)).toEqual(['Centro', 'Vão livre', 'Vão externo do batente', 'Com alizar']);
  });

  it('troca rápida: lê a referência de sessão ou vazio (padrão do projeto)', () => {
    expect(sessionChoice({ 'opening:wall': 'axis' }, 'opening:wall')).toBe('axis');
    expect(sessionChoice({}, 'opening:wall')).toBe('');
  });
});
