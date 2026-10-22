import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { OPENING_FRAME_DEFAULTS, TEMPLATES, buildTemplate, isWall, makeLevel, newId, openingFamilyOf, type OpeningType, type TemplateId } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { NumField, TextField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';
import { applyFamily, familyOptionsFor, leavesChoicesFor, leavesLabel, newOpeningTypeFromFamily } from './openingTypeForm.ts';

const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

// Seções nomeadas do formulário do tipo (padrão Revit/ArchiCAD), no mesmo estilo do antigo bloco "Esquadria".
const SECTION: CSSProperties = { border: 0, padding: 0, margin: '12px 0 0' };
const LEGEND: CSSProperties = { color: 'var(--fg-faint)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em' };

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
              <td><NumField value={l.elevation} unit="m" onCommit={(v) => run(() => editor.store.exec({ type: 'upsertLevel', level: { ...l, elevation: v } }))} /></td>
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

export function OpeningTypeDialog({ typeId }: { typeId: string }): ReactElement | null {
  const p = useProject();
  const src = p.openingTypes[typeId];
  const [d, setD] = useState<OpeningType | null>(src ? { ...src } : null);
  if (!d) return null;
  const set = (patch: Partial<OpeningType>): void => setD({ ...d, ...patch });
  const used = Object.values(p.elements).filter((e) => (e.kind === 'door' || e.kind === 'window') && e.typeId === d.id).length;
  const families = familyOptionsFor(d.kind);
  const family = openingFamilyOf(d);
  // Folhas aceitas pela família escolhida; sem família válida (dado fora do contrato) mostra só a contagem atual.
  const leaves = family ? leavesChoicesFor(family) : [{ value: d.leaves, label: leavesLabel(d.leaves) }];
  const ok = (): void => {
    editor.store.exec({ type: 'upsertOpeningType', openingType: d }, 'Editar tipo de abertura');
    close();
  };
  const dup = (): void => {
    const copy = { ...d, id: newId('ot'), name: `${d.name} (cópia)` };
    editor.store.exec({ type: 'upsertOpeningType', openingType: copy }, 'Duplicar tipo');
    useUi.setState({ dialogArg: copy.id });
    setD(copy);
  };
  /** Tipo novo da família escolhida; passa a editar o tipo criado (no Revit: Duplicate → novo tipo). */
  const create = (): void => {
    const fam = family ?? families[0];
    if (!fam) return;
    const created = newOpeningTypeFromFamily(fam);
    editor.store.exec({ type: 'upsertOpeningType', openingType: created }, 'Novo tipo de abertura');
    useUi.setState({ dialogArg: created.id });
    setD(created);
  };
  return (
    <Dialog
      title="Propriedades do tipo"
      sub={`${d.kind === 'door' ? 'Porta' : 'Janela'} · usado em ${used}`}
      size="narrow"
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={create}>+ Novo tipo</button>
          <button className="btn" onClick={dup}>Duplicar</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={ok}>OK</button>
        </>
      }
    >
      <fieldset style={SECTION}>
        <legend style={LEGEND}>Dimensões</legend>
        <div className="field-row"><label htmlFor="ot-w">Largura</label><NumField id="ot-w" value={d.width} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ width: v })} /></div>
        <div className="field-row"><label htmlFor="ot-h">Altura</label><NumField id="ot-h" value={d.height} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ height: v })} /></div>
        <div className="field-row"><label htmlFor="ot-s">Peitoril</label><NumField id="ot-s" value={d.sill} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => set({ sill: v })} /></div>
      </fieldset>
      <fieldset style={SECTION}>
        <legend style={LEGEND}>Família e folhas</legend>
        <div className="field-row">
          <label htmlFor="ot-fam" title="Comportamento e símbolo de planta do tipo (família da porta ou janela)">Família</label>
          <select id="ot-fam" className="select" value={family?.id ?? ''} onChange={(e) => { const fam = families.find((f) => f.id === e.target.value); if (fam) setD(applyFamily(d, fam)); }}>
            {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="ot-l">Folhas</label>
          <select id="ot-l" className="select" value={d.leaves} disabled={leaves.length <= 1} onChange={(e) => set({ leaves: Number(e.target.value) as OpeningType['leaves'] })}>
            {leaves.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </fieldset>
      <fieldset style={SECTION}>
        <legend style={LEGEND}>Fechamento do vão</legend>
        <div className="field-row">
          <label htmlFor="ot-clos" title="Substitui o retorno de acabamento definido no tipo de parede">Retorno do vão</label>
          <select id="ot-clos" className="select" value={d.closure} onChange={(e) => set({ closure: e.target.value as OpeningType['closure'] })}>
            <option value="inherit">Seguir o tipo de parede</option>
            <option value="none">Sem retorno</option>
            <option value="both">Retorno dos dois lados</option>
            <option value="exterior">Só lado externo</option>
            <option value="interior">Só lado interno</option>
          </select>
        </div>
      </fieldset>
      <fieldset style={SECTION}>
        <legend style={LEGEND}>Identidade</legend>
        <div className="field-row"><label htmlFor="ot-name">Nome</label><TextField id="ot-name" value={d.name} onCommit={(v) => set({ name: v })} /></div>
        <div className="field-row"><label htmlFor="ot-code">Código</label><TextField id="ot-code" value={d.code ?? ''} onCommit={(v) => set({ code: v })} /></div>
        <div className="field-row"><label htmlFor="ot-desc">Descrição</label><TextField id="ot-desc" value={d.description ?? ''} onCommit={(v) => set({ description: v })} /></div>
      </fieldset>
      {/* Espessuras da esquadria (cm). Campos vazios no tipo valem o padrão mostrado; a profundidade do batente é limitada à parede. */}
      <fieldset style={SECTION}>
        <legend style={LEGEND}>Esquadria</legend>
        <div className="field-row">
          <label htmlFor="ot-fm">Material do caixilho</label>
          <select id="ot-fm" className="select" value={d.frameMaterialId} onChange={(e) => set({ frameMaterialId: e.target.value })}>
            {Object.values(p.materials).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field-row"><label htmlFor="ot-fw" title="Largura do perfil visto de frente (ombreiras, verga, soleira)">Largura do perfil</label><NumField id="ot-fw" value={d.frameWidth ?? OPENING_FRAME_DEFAULTS.frameWidth} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => set({ frameWidth: v })} /></div>
        <div className="field-row"><label htmlFor="ot-fd" title="Profundidade do batente na espessura da parede (limitada a ela)">Profundidade do batente</label><NumField id="ot-fd" value={d.frameDepth ?? OPENING_FRAME_DEFAULTS.frameDepth} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => set({ frameDepth: v })} /></div>
        <div className="field-row"><label htmlFor="ot-lt">Espessura da folha</label><NumField id="ot-lt" value={d.leafThickness ?? (d.kind === 'door' ? OPENING_FRAME_DEFAULTS.doorLeaf : OPENING_FRAME_DEFAULTS.windowLeaf)} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => set({ leafThickness: v })} /></div>
        <div className="field-row"><label htmlFor="ot-gt">Espessura do vidro</label><NumField id="ot-gt" value={d.glassThickness ?? OPENING_FRAME_DEFAULTS.glass} scale={100} decimals={1} unit="cm" min={0.001} onCommit={(v) => set({ glassThickness: v })} /></div>
      </fieldset>
    </Dialog>
  );
}

function Thumb({ id }: { id: TemplateId }): ReactElement {
  const walls = useMemo(() => Object.values(buildTemplate(id).elements).filter(isWall), [id]);
  if (!walls.length) return <svg viewBox="0 0 10 7" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="6" fill="none" stroke="var(--line-strong)" strokeDasharray="0.4 0.3" strokeWidth="0.08" /></svg>;
  return (
    <svg viewBox="-0.6 -0.6 11.2 8.2" aria-hidden="true" style={{ transform: 'scaleY(-1)' }}>
      {walls.map((w) => <line key={w.id} x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="var(--fg)" strokeWidth="0.22" strokeLinecap="square" />)}
    </svg>
  );
}

export function StartDialog(): ReactElement {
  const [has] = useState(() => editor.hasAutosave());
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
        {TEMPLATES.map((t) => (
          <button key={t.id} className="tpl" onClick={() => pick(t.id)}>
            <Thumb id={t.id} />
            <strong>{t.name}</strong>
            <span style={{ color: 'var(--fg-soft)' }}>{t.description}</span>
            <span className="area">{t.area}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

const KEYS: Array<[string, string]> = [
  ['V', 'Selecionar'], ['W', 'Parede'], ['F', 'Piso'], ['B', 'Laje'], ['U', 'Telhado'], ['D', 'Porta'], ['J', 'Janela'],
  ['M', 'Mover'], ['C', 'Copiar'], ['R', 'Girar'], ['S', 'Espelhar'],
  ['A', 'Matriz'], ['O', 'Deslocar'], ['T', 'Aparar/Estender'], ['L', 'Alinhar'], ['N', 'Junção de canto'], ['P', 'Dividir parede'], ['E', 'Medir'], ['K', 'Corte (duas marcas na planta)'],
  ['I', 'Escada (croqui: limites, espelhos, caminhada, patamar)'], ['Q', 'Escada reta, em L, em U ou com leque'],
  ['Esc', 'Cancela o passo; segundo Esc sai da ferramenta. Na vista de corte, volta à planta'],
  ['Enter', 'Confirma o valor digitado'],
  ['0–9 , + − × ÷', 'Digitar medida durante o desenho (aceita expressões)'],
  ['Tab', 'Alterna opção (lado externo da parede, sentido da porta, linha e arco no croqui da escada)'],
  ['Espaço', 'Inverte a dobradiça ao inserir porta; segurar e arrastar move a vista'],
  ['Shift', 'Trava em 0°/90° ao desenhar; soma à seleção'],
  ['Alt (ao arrastar uma ponta)', 'Inverte quem acompanha: solta o canto simples, leva todas as paredes de um nó'],
  ['Ctrl+C / Ctrl+V', 'Copiar e colar na mesma posição, inclusive em outro nível'],
  ['Del', 'Exclui a seleção'],
  ['Ctrl+Z / Ctrl+Y', 'Desfazer / Refazer'],
  ['Ctrl+S', 'Salvar'],
  ['Roda / botão do meio', 'Zoom / mover a vista'],
  ['Botão direito', 'Cancela o passo'],
];

export function ShortcutsDialog(): ReactElement {
  return (
    <Dialog title="Atalhos" size="mid" onClose={close} footer={<button className="btn primary" onClick={close}>Fechar</button>}>
      <table className="kbtable">
        <tbody>{KEYS.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{d}</td></tr>)}</tbody>
      </table>
    </Dialog>
  );
}
