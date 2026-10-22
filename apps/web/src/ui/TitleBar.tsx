import { useRef, type ReactElement } from 'react';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { savePlanDxf, saveSectionDxf } from '../editor/dxfExport.ts';
import { Icon } from './Icon.tsx';
import { useProjectVersion } from '../editor/controller.ts';

export function TitleBar(): ReactElement {
  const project = useProject();
  useProjectVersion();
  const gpu = useUi((s) => s.gpu);
  const theme = useUi((s) => s.theme);
  const fileRef = useRef<HTMLInputElement>(null);
  const store = editor.store;
  const cycleTheme = (): void => useUi.setState({ theme: theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system' });
  const open = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    const text = await f.text();
    const r = editor.openFromText(text, f.name);
    useUi.setState({ status: r.ok ? `Aberto: ${f.name}` : `Não foi possível abrir: ${r.error}` });
  };
  const exportDxf = async (): Promise<void> => {
    const ui = useUi.getState();
    try {
      // Vista de corte/elevação aberta: exporta o corte (com as larguras da vista); senão, a planta do nível.
      const status = ui.view === 'section' && ui.sectionId
        ? await saveSectionDxf(editor.project, ui.sectionId)
        : await savePlanDxf(editor.project, ui.levelId);
      useUi.setState({ status });
    } catch (e) {
      useUi.setState({ status: `Não foi possível exportar o DXF: ${e instanceof Error ? e.message : 'falha desconhecida'}` });
    }
  };
  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">M2</span>
        Hestia
      </div>
      <input
        id="project-name"
        className="proj-name"
        aria-label="Nome do projeto"
        value={project.name}
        onChange={(e) => editor.store.exec({ type: 'setProjectName', name: e.target.value }, 'Renomear projeto')}
        onKeyDown={(e) => e.stopPropagation()}
      />
      {store.dirty ? <span className="dirty" title="Alterações ainda não exportadas">●</span> : null}
      <span className="sep" />
      <button className="ibtn" onClick={() => useUi.setState({ dialog: 'start' })} title="Novo projeto a partir de um modelo">
        <Icon name="file" size={17} /> <span className="lbl-text">Novo</span>
      </button>
      <button className="ibtn" onClick={() => fileRef.current?.click()} title="Abrir arquivo .hestia.json">
        <Icon name="open" size={17} /> <span className="lbl-text">Abrir</span>
      </button>
      <input ref={fileRef} id="file-open" type="file" accept=".json,.hestia,application/json" hidden onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ''; }} />
      <button className="ibtn" onClick={() => void editor.save()} title="Exportar o projeto (Ctrl+S)">
        <Icon name="save" size={17} /> <span className="lbl-text">Salvar</span>
      </button>
      <button className="ibtn" onClick={() => void exportDxf()} title="Exportar a planta do nível atual em DXF (metros)">
        <Icon name="plan" size={17} /> <span className="lbl-text">Exportar DXF</span>
      </button>
      <span className="sep" />
      <button className="ibtn" disabled={!store.canUndo} onClick={() => editor.undo()} title={store.undoLabel ? `Desfazer: ${store.undoLabel} (Ctrl+Z)` : 'Desfazer'}>
        <Icon name="undo" size={17} />
      </button>
      <button className="ibtn" disabled={!store.canRedo} onClick={() => editor.redo()} title={store.redoLabel ? `Refazer: ${store.redoLabel} (Ctrl+Y)` : 'Refazer'}>
        <Icon name="redo" size={17} />
      </button>
      <span className="spacer" />
      <span className={`badge ${gpu === 'cpu' ? 'cpu' : 'gpu'}`} title="Motor de desenho em uso">
        {gpu === 'pending' ? 'iniciando…' : gpu === 'cpu' ? 'CPU (sem GPU)' : gpu === 'webgpu' ? 'GPU · WebGPU' : 'GPU · WebGL2'}
      </span>
      <button className="ibtn" onClick={cycleTheme} title={`Tema: ${theme === 'system' ? 'sistema' : theme === 'light' ? 'claro' : 'escuro'}`}>
        <Icon name={theme === 'dark' ? 'moon' : 'sun'} size={17} />
      </button>
      <button className="ibtn" onClick={() => useUi.setState({ dialog: 'shortcuts' })} title="Atalhos de teclado">
        <Icon name="help" size={17} />
      </button>
    </header>
  );
}
