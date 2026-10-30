import { useMemo, useState, type ReactElement } from 'react';
import { COMANDOS_COM_ATALHO, TOOL_GROUPS, type ShortcutCommand } from '@hestia/tools';
import { nomeComandoLang, useI18n } from '../../editor/i18n.ts';
import { TEMPLATES, buildTemplate, isWall, makeLevel, newId, type TemplateId, type Wall } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { hasAutosave } from '../../editor/storage.ts';
import { useUi } from '../../editor/state.ts';
import { useAtalhos } from '../../editor/shortcutConfig.ts';
import { NumField, TextField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

// O diálogo do tipo de abertura vive em `openingType/`; o nome antigo continua sendo a porta de entrada do App.
export { OpeningTypeDialog } from './openingType/OpeningTypeDialog.tsx';

export function LevelsDialog(): ReactElement {
  const p = useProject();
  const [err, setErr] = useState('');
  const run = (fn: () => void): void => {
    try {
      fn();
      setErr('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    }
  };
  return (
    <Dialog title="Níveis" sub="Referências verticais do projeto" size="narrow" onClose={close} footer={<button className="btn primary" onClick={close}>Fechar</button>}>
      <table className="layers">
        <thead><tr><th>Nome</th><th>Elevação</th><th /></tr></thead>
        <tbody>
          {p.levels.map((l) => (
            <tr key={l.id}>
              <td><TextField value={l.name} onCommit={(v) => run(() => editor.store.exec({ type: 'upsertLevel', level: { ...l, name: v || l.name } }))} /></td>
              <td><NumField value={l.elevation} quantity="length" onCommit={(v) => run(() => editor.store.exec({ type: 'upsertLevel', level: { ...l, elevation: v } }))} /></td>
              <td><button className="btn small danger" onClick={() => run(() => editor.store.exec({ type: 'deleteLevel', id: l.id }))}>Excluir</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {err ? <p className="error" role="alert">{err}</p> : null}
      <p>
        <button className="btn small" onClick={() => run(() => editor.store.exec({ type: 'upsertLevel', level: makeLevel({ id: newId('lv'), name: `Pavimento ${p.levels.length + 1}`, elevation: (p.levels[p.levels.length - 1]?.elevation ?? 0) + 3 }) }))}>+ Novo nível</button>
      </p>
    </Dialog>
  );
}

/** Enquadramento da miniatura: caixa das paredes com margem proporcional, para o desenho nunca sair do SVG. */
function thumbViewBox(walls: Wall[]): string {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const w of walls) {
    for (const v of [w.a, w.b]) {
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
  }
  if (!Number.isFinite(x0)) return '0 0 10 7';
  const pad = Math.max(0.4, Math.max(x1 - x0, y1 - y0) * 0.06);
  return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
}

/** Miniatura da planta do exemplo: as paredes do nível térreo, enquadradas na própria caixa. */
function Thumb({ walls }: { walls: Wall[] }): ReactElement {
  if (walls.length === 0) {
    return (
      <svg viewBox="0 0 10 7" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <rect x="0.5" y="0.5" width="9" height="6" fill="none" stroke="var(--line-strong)" strokeDasharray="0.4 0.3" strokeWidth="0.08" />
      </svg>
    );
  }
  return (
    <svg viewBox={thumbViewBox(walls)} preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ transform: 'scaleY(-1)' }}>
      {walls.map((w) => <line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="var(--fg)" strokeWidth="0.2" strokeLinecap="square" />)}
    </svg>
  );
}

export function StartDialog(): ReactElement {
  const [has] = useState(() => hasAutosave());
  // Cada exemplo é montado uma vez: a miniatura usa as mesmas paredes que a contagem mostra.
  const cards = useMemo(
    () =>
      TEMPLATES.map((t) => {
        const p = buildTemplate(t.id);
        const els = Object.values(p.elements);
        return { ...t, walls: els.filter(isWall), levels: p.levels.length, horizontal: els.filter((e) => e.kind === 'floor' || e.kind === 'slab').length };
      }),
    [],
  );
  const pick = (id: TemplateId): void => {
    editor.newProject(id);
    close();
    if (id === 'blank') useUi.setState({ tutorial: true });
  };
  return (
    <Dialog title="Novo projeto" sub="Escolha um ponto de partida" onClose={close} footer={
      <>
        {has && <button className="btn" onClick={() => { editor.restoreAutosave(); close(); }}>Voltar ao último projeto salvo neste navegador</button>}
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={close}>Cancelar</button>
      </>
    }>
      <div className="tplgrid">
        {cards.map((t) => (
          <button key={t.id} className="tpl" onClick={() => pick(t.id)}>
            <span className="tpl-thumb"><Thumb walls={t.walls} /></span>
            <span className="tpl-body">
              <span className="tpl-name">{t.name}</span>
              <span className="tpl-desc">{t.description}</span>
              <span className="tpl-meta">
                {t.levels} {t.levels === 1 ? 'nível' : 'níveis'} · {t.walls.length} paredes{t.horizontal > 0 ? ` · ${t.horizontal} pisos` : ''}
                <span className="area">{t.area}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/** Teclas que não são comando: a tabela de comandos (com as sequências atuais) entra antes destas. */
const KEYS: Array<[string, string]> = [
  ['Esc', 'Cancela o passo; segundo Esc sai da ferramenta. Na vista de corte, volta à planta'],
  ['Enter', 'Confirma o valor digitado'],
  ['0–9 , + − × ÷', 'Digitar medida durante o desenho (aceita expressões)'],
  ['Tab', 'Alterna opção (lado externo da parede, sentido da porta, linha e arco no croqui da escada)'],
  ['Espaço', 'Inverte a dobradiça ao inserir porta; segurar e arrastar move a vista'],
  ['Shift', 'Trava em 0°/90° ao desenhar; soma à seleção'],
  ['Alt (ao arrastar uma ponta)', 'Inverte quem acompanha: solta o canto simples, leva todas as paredes de um nó'],
  ['Ctrl+C / Ctrl+X / Ctrl+V', 'Copiar, recortar e colar seguindo o cursor (o colar acompanha o mouse até o clique)'],
  ['Del', 'Exclui a seleção'],
  ['Ctrl+Z / Ctrl+Y', 'Desfazer / Refazer'],
  ['Ctrl+S', 'Salvar'],
  ['Roda / botão do meio', 'Zoom / mover a vista'],
  ['Botão direito', 'Cancela o passo'],
];

/** Descrições longas de comandos cujo rótulo sozinho não diz tudo (escada, corte etc.). */
const DESCRICAO_COMANDO: Partial<Record<ShortcutCommand, string>> = {
  stair: 'Escada (croqui: limites, espelhos, caminhada, patamar)',
  stairrun: 'Escada reta, em L, em U ou com leque',
  ramp: 'Rampa reta, em L ou em U',
  trim: 'Aparar/Estender',
  joins: 'Junção de canto',
  split: 'Dividir parede',
  section: 'Corte (duas marcas na planta)',
};

/** Tabela de atalhos gerada da configuração atual: comandos na ordem da faixa, depois as teclas fixas. */
export function ShortcutsDialog(): ReactElement {
  const mapa = useAtalhos((s) => s.mapa);
  const lang = useI18n((s) => s.lang);
  const ordem = [...new Set<ShortcutCommand>([...TOOL_GROUPS.flatMap((g) => g.tools), ...COMANDOS_COM_ATALHO])];
  return (
    <Dialog
      title="Atalhos"
      size="mid"
      onClose={close}
      footer={<><button className="btn" onClick={() => useUi.setState({ dialog: 'shortcutsConfig', dialogArg: null })}>Personalizar atalhos…</button><button className="btn primary" onClick={close}>Fechar</button></>}
    >
      <table className="kbtable">
        <tbody>
          <tr><td><span style={{ color: 'var(--fg-faint)' }}>sem tecla</span></td><td>Selecionar (volta com Esc)</td></tr>
          {ordem.map((cmd) => (
            <tr key={cmd}>
              <td>{mapa[cmd] ? <kbd>{mapa[cmd]}</kbd> : <span style={{ color: 'var(--fg-faint)' }}>sem atalho</span>}</td>
              <td title={DESCRICAO_COMANDO[cmd]}>{nomeComandoLang(cmd, lang)}</td>
            </tr>
          ))}
          {KEYS.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}
        </tbody>
      </table>
    </Dialog>
  );
}
