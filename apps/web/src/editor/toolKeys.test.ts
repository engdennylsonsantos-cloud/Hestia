import { describe, expect, it } from 'vitest';
import { PERFIS_ATALHOS, SEM_ATALHO_NO_PERFIL, TOOL_LABEL, TODOS_COMANDOS_ATALHO, type ToolId } from '@hestia/tools';
import { CasadorAtalhos, conflitoAtalhos } from './shortcuts.ts';

/** Ferramenta que uma sequência completa aciona num perfil de fábrica (teclas seguidas, sem tempo). */
function ferramentaDe(perfil: 'revit' | 'simples', seq: string): ToolId | undefined {
  const c = new CasadorAtalhos(PERFIS_ATALHOS[perfil].atalhos);
  let r = c.tecla(seq.charAt(0), 0);
  for (const ch of seq.slice(1)) r = c.tecla(ch, 0);
  return r.tipo === 'executa' && r.comando !== 'atalhos' ? r.comando : undefined;
}

describe('atalhos de ferramenta nos perfis de fábrica', () => {
  it('perfil Revit: sequências de duas letras', () => {
    expect(ferramentaDe('revit', 'WA')).toBe('wall');
    expect(ferramentaDe('revit', 'DR')).toBe('door');
    expect(ferramentaDe('revit', 'TH')).toBe('rehost');
    expect(ferramentaDe('revit', 'ES')).toBe('stair');
    expect(ferramentaDe('revit', 'LE')).toBe('stairrun');
  });

  it('perfil simples: uma letra por ferramenta, como antes', () => {
    expect(ferramentaDe('simples', 'W')).toBe('wall');
    expect(ferramentaDe('simples', 'h')).toBe('rehost');
    expect(ferramentaDe('simples', 'I')).toBe('stair');
    expect(ferramentaDe('simples', 'Q')).toBe('stairrun');
  });

  it('toda ferramenta tem atalho nos dois perfis, exceto as listadas como sem atalho', () => {
    for (const perfil of ['revit', 'simples'] as const) {
      const semAtalho = new Set<string>(SEM_ATALHO_NO_PERFIL[perfil]);
      for (const id of Object.keys(TOOL_LABEL) as ToolId[]) {
        if (semAtalho.has(id)) expect(PERFIS_ATALHOS[perfil].atalhos[id], `${perfil}:${id}`).toBeUndefined();
        else expect(PERFIS_ATALHOS[perfil].atalhos[id], `${perfil}:${id}`).toBeDefined();
      }
    }
  });

  it('nenhum perfil tem conflito e todos os comandos existem', () => {
    const conhecidos = new Set<string>(TODOS_COMANDOS_ATALHO);
    for (const perfil of ['revit', 'simples'] as const) {
      const mapa = PERFIS_ATALHOS[perfil].atalhos;
      expect(conflitoAtalhos(mapa), perfil).toBeNull();
      for (const cmd of Object.keys(mapa)) expect(conhecidos.has(cmd), `${perfil}:${cmd}`).toBe(true);
    }
  });

  it('tecla sem ferramenta não aciona nada', () => {
    expect(ferramentaDe('revit', 'ZZ')).toBeUndefined();
    expect(ferramentaDe('simples', '1')).toBeUndefined();
  });
});
