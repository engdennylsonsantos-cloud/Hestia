import { useMemo, useState, type ReactElement } from 'react';
import { TEMPLATES, buildTemplate, isWall, newId, type OpeningType, type PlanSymbol, type TemplateId } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { NumField, TextField } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

const close = (): void => useUi.setState({ dialog: null, dialogArg: null });

const DOOR_PLANS: Array<[PlanSymbol, string]> = [['swing', 'Arco (folha)'], ['double', 'Dupla'], ['sliding', 'De correr'], ['pivot', 'Pivotante']];
const WINDOW_PLANS: Array<[PlanSymbol, string]> = [['fixed', 'Fixa'], ['tilt', 'Basculante'], ['casement', 'Maxim-ar (arco tracejado)'], ['sliding', 'De correr']];

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
        <button className="btn small" onClick={() => run(() => editor.store.exec({ type: 'upsertLevel', level: { id: newId('lv'), name: `Pavimento ${p.levels.length + 1}`, elevation: (p.levels[p.levels.length - 1]?.elevation ?? 0) + 3 } }))}>+ Novo nível</button>
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
  const used = Object.values(p.elements).filter((e) => e.kind !== 'wall' && e.typeId === d.id).length;
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
  return (
    <Dialog
      title="Propriedades do tipo"
      sub={`${d.kind === 'door' ? 'Porta' : 'Janela'} · usado em ${used}`}
      size="narrow"
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={dup}>Duplicar</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={ok}>OK</button>
        </>
      }
    >
      <div className="field-row"><label htmlFor="ot-name">Nome</label><TextField id="ot-name" value={d.name} onCommit={(v) => set({ name: v })} /></div>
      <div className="field-row"><label htmlFor="ot-w">Largura</label><NumField id="ot-w" value={d.width} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ width: v })} /></div>
      <div className="field-row"><label htmlFor="ot-h">Altura</label><NumField id="ot-h" value={d.height} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ height: v })} /></div>
      <div className="field-row"><label htmlFor="ot-s">Peitoril</label><NumField id="ot-s" value={d.sill} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => set({ sill: v })} /></div>
      <div className="field-row">
        <label htmlFor="ot-l">Folhas</label>
        <select id="ot-l" className="select" value={d.leaves} onChange={(e) => set({ leaves: Number(e.target.value) as OpeningType['leaves'] })}>
          <option value="0">Vão livre (sem folha)</option>
          <option value="1">1 folha</option>
          <option value="2">2 folhas</option>
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="ot-plan" title="Desenho do símbolo na planta">Símbolo na planta</label>
        <select id="ot-plan" className="select" value={d.plan} onChange={(e) => set({ plan: e.target.value as PlanSymbol })}>
          {(d.kind === 'door' ? DOOR_PLANS : WINDOW_PLANS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="ot-clos" title="Substitui o retorno de acabamento definido no tipo de parede">Fechamento do vão</label>
        <select id="ot-clos" className="select" value={d.closure} onChange={(e) => set({ closure: e.target.value as OpeningType['closure'] })}>
          <option value="inherit">Seguir o tipo de parede</option>
          <option value="none">Sem retorno</option>
          <option value="both">Retorno dos dois lados</option>
          <option value="exterior">Só lado externo</option>
          <option value="interior">Só lado interno</option>
        </select>
      </div>
      <div className="field-row">
        <label htmlFor="ot-fm">Material do caixilho</label>
        <select id="ot-fm" className="select" value={d.frameMaterialId} onChange={(e) => set({ frameMaterialId: e.target.value })}>
          {Object.values(p.materials).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
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
  ['V', 'Selecionar'], ['W', 'Parede'], ['D', 'Porta'], ['J', 'Janela'],
  ['M', 'Mover'], ['C', 'Copiar'], ['R', 'Girar'], ['S', 'Espelhar'],
  ['A', 'Matriz'], ['O', 'Deslocar'], ['T', 'Aparar/Estender'], ['L', 'Alinhar'], ['N', 'Junção de canto'], ['P', 'Dividir parede'], ['E', 'Medir'], ['K', 'Corte (duas marcas na planta)'],
  ['Esc', 'Cancela o passo; segundo Esc sai da ferramenta. Na vista de corte, volta à planta'],
  ['Enter', 'Confirma o valor digitado'],
  ['0–9 , + − × ÷', 'Digitar medida durante o desenho (aceita expressões)'],
  ['Tab', 'Alterna opção (lado externo da parede, sentido da porta)'],
  ['Espaço', 'Inverte a dobradiça ao inserir porta; segurar e arrastar move a vista'],
  ['Shift', 'Trava em 0°/90° ao desenhar; soma à seleção'],
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
