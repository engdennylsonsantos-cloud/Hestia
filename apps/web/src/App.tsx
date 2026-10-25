import { useEffect, useRef, type ReactElement } from 'react';
import { editor, useProject } from './editor/controller.ts';
import { roofEdgeKey } from './editor/roofEdgeActions.ts';
import { useUi } from './editor/state.ts';
import { tabOf } from './editor/viewTabActions.ts';
import { Browser } from './ui/Browser.tsx';
import { IconDefs } from './ui/Icon.tsx';
import { EmptyViews } from './ui/EmptyViews.tsx';
import { OptionsBar } from './ui/OptionsBar.tsx';
import { Properties } from './ui/Properties.tsx';
import { Ribbon } from './ui/Ribbon.tsx';
import { StatusBar } from './ui/StatusBar.tsx';
import { TitleBar } from './ui/TitleBar.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { ViewTabs } from './ui/ViewTabs.tsx';
import { ViewportCanvas } from './ui/ViewportCanvas.tsx';
import { SheetView } from './ui/SheetView.tsx';
import { SheetDialog } from './ui/dialogs/SheetDialog.tsx';
import { AddViewDialog } from './ui/dialogs/AddViewDialog.tsx';
import { AutoCotaDialog } from './ui/dialogs/AutoCotaDialog.tsx';
import { MaterialsDialog } from './ui/dialogs/MaterialsDialog.tsx';
import { LevelsDialog, OpeningTypeDialog, ShortcutsDialog, StartDialog } from './ui/dialogs/OtherDialogs.tsx';
import { WallScheduleDialog } from './ui/dialogs/WallScheduleDialog.tsx';
import { FloorTypeDialog } from './ui/dialogs/FloorTypeDialog.tsx';
import { FloorScheduleDialog } from './ui/dialogs/FloorScheduleDialog.tsx';
import { RoomScheduleDialog } from './ui/dialogs/RoomScheduleDialog.tsx';
import { SlabTypeDialog } from './ui/dialogs/SlabTypeDialog.tsx';
import { SlabScheduleDialog } from './ui/dialogs/SlabScheduleDialog.tsx';
import { CeilingScheduleDialog } from './ui/dialogs/CeilingScheduleDialog.tsx';
import { CeilingTypeDialog } from './ui/dialogs/CeilingTypeDialog.tsx';
import { RoofTypeDialog } from './ui/dialogs/RoofTypeDialog.tsx';
import { RoofScheduleDialog } from './ui/dialogs/RoofScheduleDialog.tsx';
import { WallTypeDialog } from './ui/dialogs/WallTypeDialog.tsx';
import { StairTypeDialog } from './ui/dialogs/StairTypeDialog.tsx';
import { StairScheduleDialog } from './ui/dialogs/StairScheduleDialog.tsx';
import { OpeningScheduleDialog } from './ui/dialogs/OpeningScheduleDialog.tsx';
import { GraphicsVisibilityDialog } from './ui/dialogs/GraphicsVisibilityDialog.tsx';
import { LineWeightsDialog } from './ui/dialogs/LineWeightsDialog.tsx';

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
    case 'roomSchedule':
      return <RoomScheduleDialog />;
    case 'slabType':
      return arg ? <SlabTypeDialog typeId={arg} /> : null;
    case 'slabSchedule':
      return <SlabScheduleDialog />;
    case 'ceilingType':
      return arg ? <CeilingTypeDialog typeId={arg} /> : null;
    case 'ceilingSchedule':
      return <CeilingScheduleDialog />;
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
    case 'sheet':
      return arg ? <SheetDialog sheetId={arg} /> : null;
    case 'addView':
      return arg ? <AddViewDialog sheetId={arg} /> : null;
    case 'graphicsVisibility':
      return arg ? <GraphicsVisibilityDialog target={arg} /> : null;
    case 'lineWeights':
      return <LineWeightsDialog />;
    case 'cotasAuto':
      return <AutoCotaDialog />;
    default:
      return null;
  }
}

export function App(): ReactElement {
  const left = useUi((s) => s.leftOpen);
  const right = useUi((s) => s.rightOpen);
  const theme = useUi((s) => s.theme);
  const view = useUi((s) => s.view);
  const sheetId = useUi((s) => s.sheetId);
  const dialog = useUi((s) => s.dialog);
  const project = useProject();
  const openViews = useUi((s) => s.openViews);
  // Sem nenhuma aba válida, a área de desenho mostra o estado vazio (o navegador continua acessível).
  const semVistas = !openViews.some((v) => tabOf(project, v) !== null);

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
      <IconDefs />
      <TitleBar />
      <Ribbon />
      <OptionsBar />
      <div className="workspace" style={{ gridTemplateColumns: `${left ? 'auto' : '0px'} minmax(0, 1fr) ${right ? 'auto' : '0px'}` }}>
        {left ? <Properties /> : <span />}
        <main className="stage">
          <ViewTabs />
          <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
            {semVistas ? <EmptyViews /> : view === 'sheet' && sheetId ? <SheetView sheetId={sheetId} /> : <ViewportCanvas />}
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
