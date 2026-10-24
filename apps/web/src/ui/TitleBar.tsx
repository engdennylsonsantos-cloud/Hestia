import { useRef, type ReactElement } from 'react';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { useI18n, I18N } from '../editor/i18n.ts';
import { savePlanDxf, saveSectionDxf } from '../editor/dxfExport.ts';
import { savePdf } from '../editor/savePdf.ts';
import { sheetsPdfOf } from '../editor/sheetActions.ts';
import { saveProjectIfc } from '../editor/ifcExport.ts';
import { Icon } from './Icon.tsx';
import { useProjectVersion } from '../editor/controller.ts';

export function TitleBar(): ReactElement {
  const project = useProject();
  useProjectVersion();
  const gpu = useUi((s) => s.gpu);
  const theme = useUi((s) => s.theme);
  const lang = useI18n((s) => s.lang);
  const toggleLang = useI18n((s) => s.toggleLang);
  const t = I18N[lang];
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
      const status = ui.view === 'section' && ui.sectionId
        ? await saveSectionDxf(editor.project, ui.sectionId)
        : await savePlanDxf(editor.project, ui.levelId, ui.showRoofProjection);
      useUi.setState({ status });
    } catch (e) {
      useUi.setState({ status: `Não foi possível exportar o DXF: ${e instanceof Error ? e.message : 'falha desconhecida'}` });
    }
  };
  const exportPdf = async (): Promise<void> => {
    try {
      const bytes = sheetsPdfOf(editor.project);
      useUi.setState({ status: bytes ? await savePdf(`${editor.project.name || 'projeto'}-pranchas.pdf`, bytes) : 'Nenhuma prancha para exportar.' });
    } catch (e) {
      useUi.setState({ status: `Não foi possível exportar o PDF: ${e instanceof Error ? e.message : 'falha desconhecida'}` });
    }
  };
  const exportIfc = async (): Promise<void> => {
    try {
      useUi.setState({ status: await saveProjectIfc(editor.project) });
    } catch (e) {
      useUi.setState({ status: `Não foi possível exportar o IFC: ${e instanceof Error ? e.message : 'falha desconhecida'}` });
    }
  };
  return (
    <header className="titlebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
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
      <button className="ibtn" onClick={() => useUi.setState({ dialog: 'start' })} title={t.btn_new}>
        <Icon name="file" size={17} /> <span className="lbl-text">{t.btn_new}</span>
      </button>
      <button className="ibtn" onClick={() => fileRef.current?.click()} title={t.btn_open}>
        <Icon name="open" size={17} /> <span className="lbl-text">{t.btn_open}</span>
      </button>
      <input ref={fileRef} id="file-open" type="file" accept=".json,.hestia,application/json" hidden onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ''; }} />
      <button className="ibtn" onClick={() => void editor.save()} title={`${t.btn_save} (Ctrl+S)`}>
        <Icon name="save" size={17} /> <span className="lbl-text">{t.btn_save}</span>
      </button>
      <button className="ibtn" onClick={() => void exportDxf()} title={t.btn_export_dxf}>
        <Icon name="plan" size={17} /> <span className="lbl-text">{t.btn_export_dxf}</span>
      </button>
      <button className="ibtn" onClick={exportPdf} title={t.btn_export_pdf}>
        <Icon name="plan" size={17} /> <span className="lbl-text">{t.btn_export_pdf}</span>
      </button>
      <button className="ibtn" onClick={() => void exportIfc()} title={t.btn_export_ifc}>
        <Icon name="save" size={17} /> <span className="lbl-text">{t.btn_export_ifc}</span>
      </button>
      <span className="sep" />
      <button className="ibtn" disabled={!store.canUndo} onClick={() => editor.undo()} title={store.undoLabel ? `${t.btn_undo}: ${store.undoLabel} (Ctrl+Z)` : t.btn_undo}>
        <Icon name="undo" size={17} />
      </button>
      <button className="ibtn" disabled={!store.canRedo} onClick={() => editor.redo()} title={store.redoLabel ? `${t.btn_redo}: ${store.redoLabel} (Ctrl+Y)` : t.btn_redo}>
        <Icon name="redo" size={17} />
      </button>
      <span className="spacer" />

      {/* Seletor de Idioma Revit: PT-BR (Padrão) / EN */}
      <button
        className="ibtn lang-toggle"
        onClick={toggleLang}
        title={lang === 'pt' ? 'Mudar idioma para English (Revit EN)' : 'Mudar idioma para Português (Revit PT-BR)'}
        style={{ fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em' }}
      >
        <span style={{ color: lang === 'pt' ? 'var(--accent)' : 'var(--fg-faint)' }}>PT</span>
        <span style={{ color: 'var(--line-strong)', margin: '0 2px' }}>|</span>
        <span style={{ color: lang === 'en' ? 'var(--accent)' : 'var(--fg-faint)' }}>EN</span>
      </button>

      <span className={`badge ${gpu === 'cpu' ? 'cpu' : 'gpu'}`} title="Motor de desenho em uso">
        {gpu === 'pending' ? 'iniciando…' : gpu === 'cpu' ? 'CPU' : gpu === 'webgpu' ? 'GPU · WebGPU' : 'GPU · WebGL2'}
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
