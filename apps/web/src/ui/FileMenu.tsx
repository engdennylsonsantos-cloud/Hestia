import { useEffect, useState, type ReactElement } from 'react';
import { editor, useProject } from '../editor/controller.ts';
import { exportDxf, exportIfc, exportPdf, nextTheme } from '../editor/fileActions.ts';
import { useI18n } from '../editor/i18n.ts';
import { useUi } from '../editor/state.ts';

type Section = 'export' | 'info' | 'options';

/**
 * Menu Arquivo (aba azul da faixa e botão "H" da barra de título): Novo, Abrir, Salvar, Exportar, Informações e Opções.
 * Abre por cima da área de trabalho, do lado esquerdo; Esc, clique fora ou Fechar voltam ao desenho.
 */
export function FileMenu(): ReactElement | null {
  const open = useUi((s) => s.fileMenu);
  const theme = useUi((s) => s.theme);
  const gpu = useUi((s) => s.gpu);
  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);
  const project = useProject();
  const [section, setSection] = useState<Section>('export');
  const pt = lang === 'pt';
  const close = (): void => useUi.setState({ fileMenu: false });

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        useUi.setState({ fileMenu: false });
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [open]);
  if (!open) return null;

  const go = (fn: () => void): void => {
    close();
    fn();
  };
  const item = (label: string, onClick: () => void, o: { on?: boolean; arrow?: boolean; title?: string } = {}): ReactElement => (
    <button className={`fm-item${o.on ? ' on' : ''}`} onClick={onClick} title={o.title}>
      {label}
      {o.arrow ? <span>▸</span> : null}
    </button>
  );
  const card = (label: string, hint: string, fn: () => Promise<void>): ReactElement => (
    <button className="fm-card" onClick={() => go(() => void fn())}>
      <b>{label}</b>
      <span>{hint}</span>
    </button>
  );
  const themeName = theme === 'system' ? (pt ? 'sistema' : 'system') : theme === 'light' ? (pt ? 'claro' : 'light') : pt ? 'escuro' : 'dark';
  const engine = gpu === 'pending' ? (pt ? 'iniciando…' : 'starting…') : gpu === 'cpu' ? 'CPU' : gpu === 'webgpu' ? 'GPU · WebGPU' : 'GPU · WebGL2';

  return (
    <div className="fm-back" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="fm" role="dialog" aria-label={pt ? 'Menu Arquivo' : 'File menu'}>
        <nav className="fm-list">
          {item(pt ? 'Novo' : 'New', () => go(() => useUi.setState({ dialog: 'start' })))}
          {item(pt ? 'Abrir' : 'Open', () => go(() => document.getElementById('file-open')?.click()))}
          {item(pt ? 'Salvar' : 'Save', () => go(() => void editor.save()), { title: 'Ctrl+S' })}
          <hr />
          {item(pt ? 'Exportar' : 'Export', () => setSection('export'), { on: section === 'export', arrow: true })}
          {item(pt ? 'Informações do projeto' : 'Project Information', () => setSection('info'), { on: section === 'info', arrow: true })}
          <hr />
          {item(pt ? 'Opções' : 'Options', () => setSection('options'), { on: section === 'options', arrow: true })}
          {item(pt ? 'Fechar menu' : 'Close menu', close)}
        </nav>
        <div className="fm-pane">
          {section === 'export' && (
            <>
              <h3>{pt ? 'Exportar' : 'Export'}</h3>
              <div className="fm-cards">
                {card('DXF', pt ? 'Planta ou corte ativo para o CAD.' : 'Active plan or section to CAD.', exportDxf)}
                {card('PDF', pt ? 'Todas as pranchas em um arquivo (cria uma prancha da planta atual se não houver).' : 'All sheets in one file.', exportPdf)}
                {card('IFC', pt ? 'Modelo completo para outros programas BIM.' : 'Full model for other BIM software.', exportIfc)}
              </div>
            </>
          )}
          {section === 'info' && (
            <>
              <h3>{pt ? 'Informações do projeto' : 'Project Information'}</h3>
              <label className="fm-field">
                {pt ? 'Nome do projeto' : 'Project name'}
                <input
                  id="project-name"
                  className="input"
                  value={project.name}
                  onKeyDown={(e) => e.stopPropagation()}
                  onChange={(e) => editor.store.exec({ type: 'setProjectName', name: e.target.value }, 'Renomear projeto')}
                />
              </label>
              <p className="fm-hint">{project.levels.length} {pt ? 'níveis' : 'levels'} · {Object.keys(project.elements).length} {pt ? 'elementos' : 'elements'}</p>
            </>
          )}
          {section === 'options' && (
            <>
              <h3>{pt ? 'Opções' : 'Options'}</h3>
              <div className="fm-row">
                <span>{pt ? 'Idioma' : 'Language'}</span>
                <span className="seg">
                  <button className={pt ? 'on' : ''} onClick={() => setLang('pt')}>Português</button>
                  <button className={!pt ? 'on' : ''} onClick={() => setLang('en')}>English</button>
                </span>
              </div>
              <div className="fm-row">
                <span>{pt ? 'Tema' : 'Theme'}</span>
                <button className="btn" title={`${pt ? 'Tema' : 'Theme'}: ${themeName}`} onClick={() => useUi.setState({ theme: nextTheme(theme) })}>{themeName}</button>
              </div>
              <div className="fm-row">
                <span>{pt ? 'Motor gráfico' : 'Graphics engine'}</span>
                <span className="badge">{engine}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
