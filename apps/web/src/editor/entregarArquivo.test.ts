import { describe, expect, it, vi } from 'vitest';
import { baixarPorAncora, entregarArquivo, tipoDoArquivo, type DownloadsApi, type HostClaude } from './entregarArquivo.ts';

/** Host simulado: `use('downloads')` devolve a capacidade dada (ou null). */
function hostCom(save: DownloadsApi['save'] | null): { host: HostClaude; use: ReturnType<typeof vi.fn> } {
  const use = vi.fn(async (nome: string) => (nome === 'downloads' && save ? { save } : null));
  return { host: { use }, use };
}

const erro = (code: string) => Object.assign(new Error(code), { code });

describe('entregarArquivo com a capacidade downloads', () => {
  it('usa save com nome e conteúdo de texto, sem tocar na âncora', async () => {
    const save = vi.fn(async () => ({ status: 'saved' }));
    const ancora = vi.fn(() => true);
    const { host } = hostCom(save);
    const r = await entregarArquivo({ nome: 'casa.dxf', conteudo: '0\nSECTION' }, { host, ancora });
    expect(r).toBe('salvo');
    expect(save).toHaveBeenCalledWith({ filename: 'casa.dxf', data: '0\nSECTION' });
    expect(ancora).not.toHaveBeenCalled();
  });

  it('passa os bytes do PDF sem converter e mantém o nome', async () => {
    const save = vi.fn<DownloadsApi['save']>(async () => ({ status: 'saved' }));
    const bytes = new Uint8Array([37, 80, 68, 70]);
    const { host } = hostCom(save);
    const r = await entregarArquivo({ nome: 'projeto-pranchas.pdf', conteudo: bytes }, { host, ancora: () => true });
    expect(r).toBe('salvo');
    const chamada = save.mock.calls[0]![0] as { filename: string; data: Uint8Array };
    expect(chamada.filename).toBe('projeto-pranchas.pdf');
    expect(chamada.data).toBe(bytes);
  });

  it('recusa do viewer (declined) devolve cancelado e não baixa pela âncora', async () => {
    const save = vi.fn(async () => { throw erro('declined'); });
    const ancora = vi.fn(() => true);
    const { host } = hostCom(save);
    expect(await entregarArquivo({ nome: 'a.json', conteudo: '{}' }, { host, ancora })).toBe('cancelado');
    expect(ancora).not.toHaveBeenCalled();
  });

  it('outra recusa (rejected_extension, unavailable) cai na âncora', async () => {
    for (const code of ['rejected_extension', 'unavailable', 'not_granted']) {
      const ancora = vi.fn(() => true);
      const { host } = hostCom(vi.fn(async () => { throw erro(code); }));
      expect(await entregarArquivo({ nome: 'a.dxf', conteudo: 'x' }, { host, ancora })).toBe('baixado');
      expect(ancora).toHaveBeenCalledOnce();
    }
  });
});

describe('entregarArquivo sem a capacidade (download normal)', () => {
  it('sem window.claude usa a âncora', async () => {
    const ancora = vi.fn(() => true);
    expect(await entregarArquivo({ nome: 'a.csv', conteudo: 'x;y' }, { host: undefined, ancora })).toBe('baixado');
    expect(ancora).toHaveBeenCalledWith({ nome: 'a.csv', conteudo: 'x;y' });
  });

  it('use resolve null (capacidade indisponível) usa a âncora', async () => {
    const ancora = vi.fn(() => true);
    const { host } = hostCom(null);
    expect(await entregarArquivo({ nome: 'a.csv', conteudo: 'x' }, { host, ancora })).toBe('baixado');
    expect(ancora).toHaveBeenCalledOnce();
  });

  it('use que lança usa a âncora', async () => {
    const ancora = vi.fn(() => true);
    const host: HostClaude = { use: async () => { throw new Error('falha'); } };
    expect(await entregarArquivo({ nome: 'a.csv', conteudo: 'x' }, { host, ancora })).toBe('baixado');
  });

  it('se a âncora também falha, devolve falhou', async () => {
    expect(await entregarArquivo({ nome: 'a.csv', conteudo: 'x' }, { host: undefined, ancora: () => false })).toBe('falhou');
  });
});

describe('baixarPorAncora', () => {
  it('cria o link com nome e tipo MIME certos e o conteúdo de texto', async () => {
    const criados: { href: string; download: string; clicado: boolean }[] = [];
    const blobs: Blob[] = [];
    vi.stubGlobal('document', {
      body: { appendChild: () => undefined },
      createElement: () => {
        const a = { href: '', download: '', clicado: false, click() { this.clicado = true; }, remove() { /* no-op */ } };
        criados.push(a);
        return a;
      },
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:teste'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    try {
      expect(baixarPorAncora({ nome: 'planta.dxf', conteudo: 'SECTION' })).toBe(true);
      expect(criados[0]).toMatchObject({ href: 'blob:teste', download: 'planta.dxf', clicado: true });
      expect(blobs[0]?.type).toBe('text/plain;charset=utf-8');
      expect(await blobs[0]?.text()).toBe('SECTION');
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });

  it('envia bytes do PDF com o tipo application/pdf', async () => {
    const blobs: Blob[] = [];
    vi.stubGlobal('document', {
      body: { appendChild: () => undefined },
      createElement: () => ({ click: () => undefined, remove: () => undefined, href: '', download: '' }),
    });
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => { blobs.push(b as Blob); return 'blob:pdf'; });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    try {
      expect(baixarPorAncora({ nome: 'p.pdf', conteudo: new Uint8Array([1, 2, 3]) })).toBe(true);
      expect(blobs[0]?.type).toBe('application/pdf');
      expect(new Uint8Array(await blobs[0]!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});

describe('tipoDoArquivo', () => {
  it('mapeia a extensão para o tipo MIME', () => {
    expect(tipoDoArquivo('x-portas.csv')).toBe('text/csv;charset=utf-8');
    expect(tipoDoArquivo('casa.hestia.json')).toBe('application/json');
    expect(tipoDoArquivo('pranchas.PDF')).toBe('application/pdf');
    expect(tipoDoArquivo('planta.dxf')).toBe('text/plain;charset=utf-8');
    expect(tipoDoArquivo('casa.ifc')).toBe('text/plain;charset=utf-8');
  });
});
