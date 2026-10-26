import { describe, expect, it } from 'vitest';
import { COMANDOS_COM_ATALHO, PERFIL_REVIT, PERFIL_SIMPLES, SHORTCUT_PROFILES, TOOL_LABEL, type ShortcutProfile } from '@hestia/tools';
import { comandoDaSequencia } from './toolKeys.ts';
import { conflitoNoMapa } from './shortcuts.ts';

describe('sequências de comando (perfis)', () => {
  it('resolve as sequências do perfil Revit, sem diferenciar maiúsculas', () => {
    expect(comandoDaSequencia('WA', PERFIL_REVIT)).toBe('wall');
    expect(comandoDaSequencia('wa', PERFIL_REVIT)).toBe('wall');
    expect(comandoDaSequencia('RM', PERFIL_REVIT)).toBe('room');
    expect(comandoDaSequencia('TH', PERFIL_REVIT)).toBe('rehost');
  });

  it('o perfil simples mantém as letras de uma tecla', () => {
    expect(comandoDaSequencia('w', PERFIL_SIMPLES)).toBe('wall');
    expect(comandoDaSequencia('i', PERFIL_SIMPLES)).toBe('stair');
    expect(comandoDaSequencia('q', PERFIL_SIMPLES)).toBe('stairrun');
    expect(comandoDaSequencia('z', PERFIL_SIMPLES)).toBe('room');
  });

  it('sequência sem comando devolve undefined (e prefixo não é sequência)', () => {
    expect(comandoDaSequencia('W', PERFIL_REVIT)).toBeUndefined();
    expect(comandoDaSequencia('1', PERFIL_REVIT)).toBeUndefined();
    expect(comandoDaSequencia('Enter', PERFIL_SIMPLES)).toBeUndefined();
  });
});

describe('perfis de atalho', () => {
  const perfis = Object.keys(SHORTCUT_PROFILES) as ShortcutProfile[];

  it('todo comando com ferramenta (exceto Selecionar) tem atalho nos dois perfis', () => {
    const ferramentas = Object.keys(TOOL_LABEL).filter((id) => id !== 'select');
    for (const perfil of perfis) {
      for (const id of ferramentas) expect(SHORTCUT_PROFILES[perfil][id as keyof typeof TOOL_LABEL], `${perfil}:${id}`).toBeTruthy();
    }
    expect(COMANDOS_COM_ATALHO).toEqual(expect.arrayContaining([...ferramentas, 'atalhos']));
  });

  it('Selecionar não tem tecla em nenhum perfil', () => {
    for (const perfil of perfis) expect(SHORTCUT_PROFILES[perfil].select).toBeUndefined();
  });

  it('nenhum perfil tem conflito de sequência', () => {
    for (const perfil of perfis) expect(conflitoNoMapa(SHORTCUT_PROFILES[perfil]), perfil).toBeUndefined();
  });

  it('o perfil Revit usa as sequências aprovadas', () => {
    expect(PERFIL_REVIT).toMatchObject({ wall: 'WA', door: 'DR', window: 'WN', floor: 'SB', slab: 'LJ', ceiling: 'FR', roof: 'TL', stair: 'ES', stairrun: 'LE', slope: 'IN', roofarrow: 'SI', room: 'RM', dimension: 'DI', text: 'TX', move: 'MV', copy: 'CO', rotate: 'RO', mirror: 'MM', array: 'AR', offset: 'OF', split: 'SL', trim: 'TR', align: 'AL', parallel: 'PP', joins: 'UG', measure: 'ME', section: 'CT', rehost: 'TH', attachroof: 'AT', detachroof: 'DT' });
  });
});
