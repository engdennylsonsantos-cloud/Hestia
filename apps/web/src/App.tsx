import { useEffect, useRef, type ReactElement } from 'react';
import { editor, useProject } from './editor/controller.ts';
import { roofEdgeKey } from './editor/roofEdgeActions.ts';
import { useUi } from './editor/state.ts';
import { Browser } from './ui/Browser.tsx';
import { Icon } from './ui/Icon.tsx';
import { OptionsBar } from './ui/OptionsBar.tsx';
import { Properties } from './ui/Properties.tsx';
import { Ribbon } from './ui/Ribbon.tsx';
import { StatusBar } from './ui/StatusBar.tsx';
import { TitleBar } from './ui/TitleBar.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { ViewportCanvas } from './ui/ViewportCanvas.tsx';
import { MaterialsDialog } from './ui/dialogs/MaterialsDialog.tsx';
import { LevelsDialog, OpeningTypeDialog, ShortcutsDialog, StartDialog } from './ui/dialogs/OtherDialogs.tsx';
import { WallScheduleDialog } from './ui/dialogs/WallScheduleDialog.tsx';
import { FloorTypeDialog } from './ui/dialogs/FloorTypeDialog.tsx';
import { FloorScheduleDialog } from './ui/dialogs/FloorScheduleDialog.tsx';
import { SlabTypeDialog } from './ui/dialogs/SlabTypeDialog.tsx';
import { SlabScheduleDialog } from './ui/dialogs/SlabScheduleDialog.tsx';
import { RoofTypeDialog } from './ui/dialogs/RoofTypeDialog.tsx';
import { RoofScheduleDialog } from './ui/dialogs/RoofScheduleDialog.tsx';
import { WallTypeDialog } from './ui/dialogs/WallTypeDialog.tsx';
import { StairTypeDialog } from './ui/dialogs/StairTypeDialog.tsx';
import { StairScheduleDialog } from './ui/dialogs/StairScheduleDialog.tsx';
import { OpeningScheduleDialog } from './ui/dialogs/OpeningScheduleDialog.tsx';
import { GraphicsVisibilityDialog } from './ui/dialogs/GraphicsVisibilityDialog.tsx';
import { LineWeightsDialog } from './ui/dialogs/LineWeightsDialog.tsx';

const narrow = (): boolean => window.innerWidth <= 900;

function ViewTabs(): ReactElement {
  const p = useProject();
  const s = useUi();
  const sectionTab = p.views.find((v) => v.id === s.sectionId);
  return (
    <div className="viewtabs" role="tablist" aria-label="Vistas abertas">
      <button className="ibtn" style={{ display: 'none' }} aria-hidden="true" />
      {p.levels.map((l) => (
        <button key={l.id} role="tab" aria-selected={s.view === 'plan' && s.levelId === l.id} className={`vtab${s.view === 'plan' && s.levelId === l.id ? ' on' : ''}`} onClick={() => editor.selectLevel(l.id)}>
          <Icon name="plan" size={14} /> {l.name}
        </button>
      ))}
      <button role="tab" aria-selected={s.view === '3d'} className={`vtab${s.view === '3d' ? ' on' : ''}`} onClick={() => editor.setView('3d')}>
        <Icon name="cube" size={14} /> Modelo 3D
      </button>
      {s.view === 'section' && sectionTab ? (
        <button role="tab" aria-selected className="vtab on">
          <Icon name={sectionTab.kind === 'section' ? 'section' : 'elevation'} size={14} /> {sectionTab.name}
        </button>
      ) : null}
      <span style={{ flex: 1 }} />
      <button className="ibtn" onClick={() => useUi.setState({ leftOpen: !s.leftOpen, ...(narrow() && !s.leftOpen ? { rightOpen: false } : {}) })} title="Mostrar/ocultar propriedades" aria-pressed={s.leftOpen}>
        <Icon name="edit" size={16} />
      </button>
      <button className="ibtn" onClick={() => useUi.setState({ rightOpen: !s.rightOpen, ...(narrow() && !s.rightOpen ? { leftOpen: false } : {}) })} title="Mostrar/ocultar navegador" aria-pressed={s.rightOpen}>
        <Icon name="levels" size={16} />
      </button>
    </div>
  );
}

function Dialogs(): ReactElement | null {
  const d = useUi((s) => s.dialog);
  const arg = useUi((s) => s.dialogArg);
  switch (d) {
    case 'wallType':
      return arg ? <WallTypeDialog typeId={arg} /> : null;
    case 'floorType':
      return arg ? <FloorTypeDialog typeId={arg} /> : null;
    case 'floorSchedule':
      return <FloorScheduleDialog />;
    case 'slabType':
      return arg ? <SlabTypeDialog typeId={arg} /> : null;
    case 'slabSchedule':
      return <SlabScheduleDialog />;
    case 'roofType':
      return arg ? <RoofTypeDialog typeId={arg} /> : null;
    case 'roofSchedule':
      return <RoofScheduleDialog />;
    case 'stairType':
      return arg ? <StairTypeDialog typeId={arg} /> : null;
    case 'stairSchedule':
      return <StairScheduleDialog />;
    case 'openingSchedule':
      return <OpeningScheduleDialog />;
    case 'openingType':
      return arg ? <OpeningTypeDialog typeId={arg} /> : null;
    case 'materials':
      return <MaterialsDialog />;
    case 'levels':
      return <LevelsDialog />;
    case 'start':
      return <StartDialog />;
    case 'shortcuts':
      return <ShortcutsDialog />;
    case 'schedule':
      return <WallScheduleDialog />;
    case 'graphicsVisibility':
      return arg ? <GraphicsVisibilityDialog target={arg} /> : null;
    case 'lineWeights':
      return <LineWeightsDialog />;
    default:
      return null;
  }
}

export function App(): ReactElement {
  const left = useUi((s) => s.leftOpen);
  const right = useUi((s) => s.rightOpen);
  const theme = useUi((s) => s.theme);
  const dialog = useUi((s) => s.dialog);

  // O host (artefato) pode ter definido data-theme: guardamos o valor original e o devolvemos em "sistema".
  const hostTheme = useRef<string | null>(document.documentElement.getAttribute('data-theme'));
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      if (hostTheme.current) root.setAttribute('data-theme', hostTheme.current);
      else root.removeAttribute('data-theme');
    } else root.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!editor.restoreAutosave()) editor.newProject('house2');
    useUi.setState({ status: 'Pronto. Pressione W para desenhar paredes, ou selecione para editar.' });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (dialog || typing) return;
      if (roofEdgeKey(e.key, editor.store) || editor.key(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent): void => {
      if (editor.store.dirty && editor.project.nextOrder > 1) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return (
    <div className="app">
      <TitleBar />
      <Ribbon />
      <OptionsBar />
      <div className="workspace" style={{ gridTemplateColumns: `${left ? 'auto' : '0px'} minmax(0, 1fr) ${right ? 'auto' : '0px'}` }}>
        {left ? <Properties /> : <span />}
        <main className="stage">
          <ViewTabs />
          <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
            <ViewportCanvas />
            <Tutorial />
          </div>
        </main>
        {right ? <Browser /> : <span />}
      </div>
      <StatusBar />
      <Dialogs />
    </div>
  );
}
