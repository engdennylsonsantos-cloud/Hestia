import { useEffect, useState, type ReactElement } from 'react';
import { PERFIS_ATALHOS, TODOS_COMANDOS_ATALHO, TOOL_GROUPS, type ComandoAtalho, type PerfilAtalhos } from '@hestia/tools';
import { atribuirAtalho, exportarAtalhos, importarAtalhos, removerAtalho, restaurarAtalho, restaurarTodos, trocarPerfil, useAtalhos } from '../../editor/shortcutConfig.ts';
import { TEMPO_SEQUENCIA_MS, normalizarSequencia, rotuloComando } from '../../editor/shortcuts.ts';
import { useUi } from '../../editor/state.ts';
import { Dialog } from './Dialog.tsx';

const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

/** Ordem da lista: agrupada como na faixa de ferramentas, depois o que sobrou (ex.: Selecionar). */
const ORDEM: ComandoAtalho[] = [...new Set<ComandoAtalho>([...TOOL_GROUPS.flatMap((g) => g.tools), ...TODOS_COMANDOS_ATALHO])];

interface Aviso {
  erro: boolean;
  texto: string;
}

/** Grava a sequência de um comando; devolve o aviso (conflito recusado ou confirmação). */
function gravar(cmd: ComandoAtalho, entrada: string): Aviso {
  const erro = atribuirAtalho(cmd, entrada);
  if (erro) return { erro: true, texto: erro };
  return { erro: false, texto: `${rotuloComando(cmd)}: atalho ${normalizarSequencia(entrada)} gravado.` };
}

/** Tela de atalhos: lista os comandos, grava novas sequências, troca de perfil e importa/exporta o arquivo. */
export function ShortcutConfigDialog(): ReactElement {
  const perfil = useAtalhos((s) => s.perfil);
  const atalhos = useAtalhos((s) => s.atalhos);
  const [filtro, setFiltro] = useState('');
  // Comando em captura: as próximas teclas viram a nova sequência.
  const [captura, setCaptura] = useState<ComandoAtalho | null>(null);
  const [buf, setBuf] = useState('');
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Captura: letras e dígitos acumulam; Enter grava; Backspace apaga; pausa de um segundo também grava.
  useEffect(() => {
    if (!captura) return;
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Enter') {
        if (buf) setAviso(gravar(captura, buf));
        setCaptura(null);
        setBuf('');
        return;
      }
      if (e.key === 'Backspace') {
        setBuf((b) => b.slice(0, -1));
        return;
      }
      if (e.key.length !== 1) return;
      if (!/^[A-Za-z0-9]$/.test(e.key)) {
        setAviso({ erro: true, texto: 'Use só letras e números no atalho.' });
        return;
      }
      setBuf((b) => (b + e.key).toUpperCase().slice(0, 4));
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [captura, buf]);

  useEffect(() => {
    if (!captura || !buf) return;
    const t = setTimeout(() => {
      setAviso(gravar(captura, buf));
      setCaptura(null);
      setBuf('');
    }, TEMPO_SEQUENCIA_MS);
    return () => clearTimeout(t);
  }, [captura, buf]);

  const mostra = (erro: string | null, ok: string): void => setAviso(erro ? { erro: true, texto: erro } : { erro: false, texto: ok });

  const exportar = (): void => {
    const url = URL.createObjectURL(new Blob([exportarAtalhos()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'atalhos-hestia.json';
    a.click();
    URL.revokeObjectURL(url);
    setAviso({ erro: false, texto: 'Arquivo de atalhos exportado.' });
  };

  const termo = filtro.trim().toLowerCase();
  const lista = ORDEM.filter((c) => !termo || rotuloComando(c).toLowerCase().includes(termo) || (atalhos[c] ?? '').toLowerCase().includes(termo));

  return (
    <Dialog title="Atalhos de teclado" size="mid" onClose={close} footer={
      <>
        <button className="btn" onClick={() => mostra(restaurarTodos(), 'Padrões do perfil restaurados.')}>Restaurar tudo</button>
        <button className="btn primary" onClick={close}>Fechar</button>
      </>
    }>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <label>
          Perfil{' '}
          <select value={perfil} onChange={(e) => mostra(trocarPerfil(e.target.value as PerfilAtalhos), `Perfil ${PERFIS_ATALHOS[e.target.value as PerfilAtalhos].nome} aplicado.`)}>
            {(Object.keys(PERFIS_ATALHOS) as PerfilAtalhos[]).map((p) => <option key={p} value={p}>{PERFIS_ATALHOS[p].nome}</option>)}
          </select>
        </label>
        <input type="search" placeholder="Filtrar por nome ou atalho" value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button className="btn" onClick={exportar}>Exportar…</button>
        <label className="btn" style={{ cursor: 'pointer' }}>
          Importar…
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const arq = e.target.files?.[0];
              e.target.value = '';
              if (!arq) return;
              mostra(importarAtalhos(await arq.text()), 'Atalhos importados.');
            }}
          />
        </label>
      </div>
      {captura ? (
        <div className="hint" role="status" style={{ marginBottom: 8, color: 'var(--accent)' }}>
          Pressione as novas teclas para <b>{rotuloComando(captura)}</b>: <kbd>{buf || '…'}</kbd>. Enter ou uma pausa grava; Esc fecha esta tela.
        </div>
      ) : null}
      {aviso ? <div role="status" style={{ marginBottom: 8, color: aviso.erro ? 'var(--danger)' : 'var(--fg-faint)' }}>{aviso.texto}</div> : null}
      <table className="kbtable">
        <thead>
          <tr><td>Comando</td><td>Atalho</td><td /></tr>
        </thead>
        <tbody>
          {lista.map((c) => (
            <tr key={c}>
              <td>{rotuloComando(c)}</td>
              <td>{atalhos[c] ? <kbd>{atalhos[c]}</kbd> : <span className="hint">sem atalho</span>}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="btn" onClick={() => { setAviso(null); setBuf(''); setCaptura(c); }}>Atribuir</button>{' '}
                <button className="btn" disabled={!atalhos[c]} onClick={() => mostra(removerAtalho(c), `${rotuloComando(c)} sem atalho.`)}>Remover</button>{' '}
                <button className="btn" onClick={() => mostra(restaurarAtalho(c), `${rotuloComando(c)}: atalho padrão restaurado.`)}>Padrão</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}
