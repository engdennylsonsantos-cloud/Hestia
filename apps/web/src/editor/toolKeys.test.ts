import { describe, expect, it } from 'vitest';
import { TOOL_SHORTCUT } from '@hestia/tools';
import { toolForKey } from './toolKeys.ts';

describe('atalhos de ferramenta', () => {
  it('resolve as teclas do registro, sem diferenciar maiúsculas', () => {
    expect(toolForKey('v')).toBe('select');
    expect(toolForKey('W')).toBe('wall');
    expect(toolForKey('h')).toBe('rehost');
  });

  it('as escadas têm teclas próprias e livres (I e Q)', () => {
    expect(toolForKey('i')).toBe('stair');
    expect(toolForKey('q')).toBe('stairrun');
  });

  it('nenhum atalho se repete no registro', () => {
    const keys = Object.values(TOOL_SHORTCUT).map((k) => k?.toUpperCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('tecla sem ferramenta devolve undefined', () => {
    expect(toolForKey('z')).toBeUndefined();
    expect(toolForKey('Enter')).toBeUndefined();
  });
});
