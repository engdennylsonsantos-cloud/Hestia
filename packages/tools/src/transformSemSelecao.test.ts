import { describe, expect, it } from 'vitest';
import { createTool, type ToolEnv, type ToolId } from './index.ts';
import { makeEnv } from './testEnv.ts';

/**
 * Sem seleção, Rotacionar/Espelhar/Matriz avisam e saem para Selecionar. Como no app, sair troca para Selecionar,
 * que põe a própria dica na barra: o aviso precisa ficar por último para continuar visível.
 */
describe('ferramentas de transformação sem seleção', () => {
  it.each(['rotate', 'mirror', 'array'] as ToolId[])('%s mantém o aviso de seleção depois de voltar a Selecionar', (id) => {
    const base = makeEnv().env;
    let status = '';
    const env: ToolEnv = {
      ...base,
      say: (m) => { status = m; },
      // Troca para Selecionar: a dica dela vai para a barra, como faz o controlador.
      done: () => { status = 'Selecionar: dica da seleção'; },
    };
    createTool(id, env).start();
    expect(status).toMatch(/selecione elementos antes/);
  });
});
