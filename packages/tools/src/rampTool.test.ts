import { describe, expect, it } from 'vitest';
import { makeEnv } from './testEnv.ts';
import { createTool } from './registry.ts';

describe('ferramenta Rampa', () => {
  it('createTool devolve a ferramenta com id ramp', () => {
    const { env } = makeEnv();
    const tool = createTool('ramp', env);
    expect(tool.id).toBe('ramp');
    expect(tool.label).toBe('Rampa');
  });
});
