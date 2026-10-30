import { describe, expect, it } from 'vitest';
import { makeStair, type Stair } from '@hestia/model';
import { I18N } from '../editor/i18n.ts';
import { freeStairPath } from './StairProperties.tsx';

const base = (extra: Partial<Stair> = {}): Stair =>
  ({ ...makeStair({ id: 'st1', typeId: 'stt_monolitica', levelId: 'lv_0' }), order: 0, ...extra }) as Stair;

describe('grupo Escada livre nas propriedades', () => {
  it('só aparece (botão Ajustar e largura) para escada com freePath de 2+ pontos', () => {
    expect(freeStairPath(base({ freePath: [{ x: 0, y: 0 }, { x: 5, y: 0 }] }))).not.toBeNull();
    expect(freeStairPath(base())).toBeNull();
    expect(freeStairPath(base({ freePath: [{ x: 0, y: 0 }] }))).toBeNull();
    expect(freeStairPath(null)).toBeNull();
  });
});

describe('i18n da escada livre', () => {
  const keys = ['stair_shape_free', 'stair_adjust', 'stair_adjust_title', 'stair_free_group', 'stair_free_path_info', 'stair_free_width'] as const;

  it('as 6 chaves existem em PT e EN', () => {
    for (const k of keys) {
      expect(I18N.pt[k], `pt ${k}`).toBeTruthy();
      expect(I18N.en[k], `en ${k}`).toBeTruthy();
    }
  });

  it('os textos principais conferem', () => {
    expect(I18N.pt.stair_shape_free).toBe('Livre');
    expect(I18N.en.stair_shape_free).toBe('Free');
    expect(I18N.pt.stair_adjust).toBe('Ajustar');
    expect(I18N.en.stair_adjust).toBe('Adjust');
    expect(I18N.pt.stair_free_path_info).toBe('Trajeto: {n} pontos · {r} lances · {l} patamares');
    expect(I18N.en.stair_free_path_info).toBe('Path: {n} points · {r} runs · {l} landings');
  });
});
