import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

/** Armazenamento em memória com a mesma forma do localStorage. */
function memoria(falha = false): Storage & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    get length() { return dados.size; },
    clear: () => dados.clear(),
    key: (i: number) => [...dados.keys()][i] ?? null,
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (falha) throw new Error('quota');
      dados.set(k, String(v));
    },
    removeItem: (k: string) => { dados.delete(k); },
  } as Storage & { dados: Map<string, string> };
}

/** Carrega o módulo do zero com um armazenamento dado (o estado é lido ao importar). */
async function carrega(storage: Storage) {
  vi.stubGlobal('localStorage', storage);
  vi.resetModules();
  return import('./shortcutConfig.ts');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('configuração de atalhos', () => {
  // A primeira importação transforma o módulo inteiro (lenta sob carga): aquece antes, para os testes não estourarem o tempo.
  beforeAll(async () => {
    await import('./shortcutConfig.ts');
  }, 60000);

  it('começa no perfil Revit, sem alterações', async () => {
    const m = await carrega(memoria());
    expect(m.useAtalhos.getState().perfil).toBe('revit');
    expect(m.useAtalhos.getState().mapa.wall).toBe('WA');
  });

  it('atribuir grava, e a sequência sobrevive a recarregar o módulo', async () => {
    const st = memoria();
    let m = await carrega(st);
    expect(m.atribuirAtalho('wall', 'pa')).toMatchObject({ ok: true });
    expect(m.useAtalhos.getState().mapa.wall).toBe('PA');
    expect(st.dados.get('hestia.atalhos.v1')).toContain('"wall":"PA"');
    m = await carrega(st);
    expect(m.useAtalhos.getState().mapa.wall).toBe('PA');
  });

  it('recusa sequência em conflito e diz qual comando já a usa', async () => {
    const m = await carrega(memoria());
    const r = m.atribuirAtalho('door', 'WA');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('Parede');
    expect(m.useAtalhos.getState().mapa.door).toBe('DR');
  });

  it('recusa conflito por prefixo (W é começo de WA, da parede)', async () => {
    const m = await carrega(memoria());
    const r = m.atribuirAtalho('door', 'W');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('Parede');
  });

  it('remover tira o atalho; restaurar volta ao padrão do perfil', async () => {
    const m = await carrega(memoria());
    m.removerAtalho('wall');
    expect(m.useAtalhos.getState().mapa.wall).toBeUndefined();
    m.restaurarAtalho('wall');
    expect(m.useAtalhos.getState().mapa.wall).toBe('WA');
  });

  it('o diálogo de unidades começa em UN e o usuário pode reatribuir e restaurar', async () => {
    const m = await carrega(memoria());
    expect(m.useAtalhos.getState().mapa.unidades).toBe('UN');
    expect(m.atribuirAtalho('unidades', 'PU').ok).toBe(true);
    expect(m.useAtalhos.getState().mapa.unidades).toBe('PU');
    m.restaurarAtalho('unidades');
    expect(m.useAtalhos.getState().mapa.unidades).toBe('UN');
  });

  it('trocar para o perfil simples usa as letras de uma tecla', async () => {
    const m = await carrega(memoria());
    m.trocarPerfil('simples');
    expect(m.useAtalhos.getState()).toMatchObject({ perfil: 'simples' });
    expect(m.useAtalhos.getState().mapa.wall).toBe('W');
    expect(m.useAtalhos.getState().mapa.ceiling).toBe('1');
  });

  it('exportar e importar: a ida e volta preserva o mapa, e importar conflito é recusado sem mudar nada', async () => {
    const m = await carrega(memoria());
    m.atribuirAtalho('wall', 'PA');
    m.removerAtalho('room');
    const arquivo = m.exportaAtalhos();
    m.restaurarTodos();
    expect(m.importaAtalhos(arquivo).ok).toBe(true);
    expect(m.useAtalhos.getState().mapa.wall).toBe('PA');
    expect(m.useAtalhos.getState().mapa.room).toBeUndefined();

    const antes = { ...m.useAtalhos.getState().mapa };
    const ruim = JSON.stringify({ formato: 'hestia-atalhos', versao: 1, perfil: 'revit', comandos: { door: 'WN' } });
    const r = m.importaAtalhos(ruim);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('Conflito');
    expect(m.useAtalhos.getState().mapa).toEqual(antes);
  });

  it('importar recusa JSON inválido, outro formato, comando desconhecido e sequência malformada', async () => {
    const m = await carrega(memoria());
    expect(m.importaAtalhos('{ruim').ok).toBe(false);
    expect(m.importaAtalhos(JSON.stringify({ formato: 'outro', versao: 1 })).ok).toBe(false);
    expect(m.importaAtalhos(JSON.stringify({ formato: 'hestia-atalhos', versao: 1, comandos: { naoExiste: 'XY' } })).ok).toBe(false);
    expect(m.importaAtalhos(JSON.stringify({ formato: 'hestia-atalhos', versao: 1, comandos: { wall: 'W A' } })).ok).toBe(false);
    expect(m.importaAtalhos(JSON.stringify({ formato: 'hestia-atalhos', versao: 1, perfil: 'x', comandos: {} })).ok).toBe(false);
  });

  it('importar sem um comando mantém o padrão dele; null tira o atalho', async () => {
    const m = await carrega(memoria());
    const r = m.importaAtalhos(JSON.stringify({ formato: 'hestia-atalhos', versao: 1, perfil: 'revit', comandos: { wall: null } }));
    expect(r.ok).toBe(true);
    expect(m.useAtalhos.getState().mapa.wall).toBeUndefined();
    expect(m.useAtalhos.getState().mapa.door).toBe('DR');
  });

  it('localStorage com lixo ou em conflito volta ao padrão, sem lançar', async () => {
    const st = memoria();
    st.setItem('hestia.atalhos.v1', '{quebrado');
    expect((await carrega(st)).useAtalhos.getState().perfil).toBe('revit');
    st.setItem('hestia.atalhos.v1', JSON.stringify({ perfil: 'revit', alteracoes: { door: 'WA' } }));
    expect((await carrega(st)).useAtalhos.getState().mapa.door).toBe('DR');
  });

  it('se o armazenamento falha ao gravar, a alteração vale na sessão e não lança', async () => {
    const m = await carrega(memoria(true));
    expect(m.atribuirAtalho('wall', 'PA').ok).toBe(true);
    expect(m.useAtalhos.getState().mapa.wall).toBe('PA');
  });
});
