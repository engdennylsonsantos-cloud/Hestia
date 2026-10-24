import { useEffect, useRef, useState, type ReactElement } from 'react';
import { sheetOf } from '@hestia/model';
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

const narrow = (): boolean => window.innerWidth <= 900;

function ViewTabs(): ReactElement {
  const p = useProject();
  const s = useUi();
  const sectionTab = p.views.find((v) => v.id === s.sectionId);
  const sheetTab = s.sheetId ? sheetOf(p, s.sheetId) : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const [fitCount, setFitCount] = useState<number>(999);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const allTabs = [
    ...p.levels.map((l) => ({
      key: `level-${l.id}`,
      label: l.name,
      icon: 'plan',
      active: s.view === 'plan' && s.levelId === l.id,
      onClick: () => editor.selectLevel(l.id),
    })),
    {
      key: 'view-3d',
      label: 'Modelo 3D',
      icon: 'cube',
      active: s.view === '3d',
      onClick: () => editor.setView('3d'),
    },
    ...(s.view === 'section' && sectionTab
      ? [{
          key: `section-${sectionTab.id}`,
          label: sectionTab.name,
          icon: sectionTab.kind === 'section' ? 'section' : 'elevation',
          active: true,
          onClick: () => {},
        }]
      : []),
    ...(s.view === 'sheet' && sheetTab
      ? [{
          key: `sheet-${sheetTab.id}`,
          label: `${sheetTab.number} ${sheetTab.name}`,
          icon: 'plan',
          active: true,
          onClick: () => {},
        }]
      : []),
  ];

  // Fecha o menu suspenso ao clicar fora
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: PointerEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [dropdownOpen]);

  // Medição precisa do espaço disponível para abas (evita qualquer barra de rolagem)
  useEffect(() => {
    const updateFit = () => {
      const container = containerRef.current;
      const controls = controlsRef.current;
      const measure = measureRef.current;
      if (!container || !measure) return;

      const totalWidth = container.clientWidth;
      const controlsWidth = controls ? controls.offsetWidth : 60;
      const availableWithoutOverflow = totalWidth - controlsWidth - 20;
      const availableWithOverflow = availableWithoutOverflow - 75;

      const tabElements = Array.from(measure.children) as HTMLElement[];
      let used = 0;
      let allFit = true;
      const widths: number[] = [];

      for (let i = 0; i < tabElements.length; i++) {
        const el = tabElements[i];
        if (!el) continue;
        const w = el.offsetWidth + 2;
        widths.push(w);
        used += w;
        if (used > availableWithoutOverflow) {
          allFit = false;
        }
      }

      if (allFit) {
        setFitCount(allTabs.length);
        return;
      }

      let count = 0;
      let acc = 0;
      for (let i = 0; i < widths.length; i++) {
        const w = widths[i] ?? 0;
        if (acc + w <= availableWithOverflow) {
          acc += w;
          count++;
        } else {
          break;
        }
      }
      setFitCount(Math.max(1, count));
    };

    updateFit();

    const ro = new ResizeObserver(() => {
      updateFit();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [allTabs.length, p.levels]);

  const activeIndex = allTabs.findIndex((t) => t.active);
  let visibleTabs = allTabs;
  let overflowTabs: typeof allTabs = [];

  if (fitCount < allTabs.length) {
    const activeTab = activeIndex >= 0 ? allTabs[activeIndex] : undefined;
    if (activeIndex >= fitCount && activeTab) {
      // Garante que a aba ativa sempre permaneça visível no topo
      const head = allTabs.slice(0, Math.max(1, fitCount - 1));
      visibleTabs = [...head, activeTab];
      const visibleKeys = new Set(visibleTabs.map((t) => t.key));
      overflowTabs = allTabs.filter((t) => !visibleKeys.has(t.key));
    } else {
      visibleTabs = allTabs.slice(0, fitCount);
      overflowTabs = allTabs.slice(fitCount);
    }
  }

  return (
    <div className="viewtabs" role="tablist" aria-label="Vistas abertas" ref={containerRef}>
      {/* Elemento oculto para medição de tamanho exato de cada aba */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -9999,
          top: -9999,
          visibility: 'hidden',
          pointerEvents: 'none',
          display: 'flex',
          gap: 2,
          whiteSpace: 'nowrap',
        }}
      >
        {allTabs.map((t) => (
          <button key={t.key} className="vtab">
            <Icon name={t.icon} size={14} /> {t.label}
          </button>
        ))}
      </div>

      {visibleTabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={t.active}
          className={`vtab${t.active ? ' on' : ''}`}
          onClick={t.onClick}
        >
          <Icon name={t.icon} size={14} /> {t.label}
        </button>
      ))}

      {overflowTabs.length > 0 && (
        <div className="vtab-overflow" ref={overflowRef}>
          <button
            className={`vtab-overflow-btn${overflowTabs.some((t) => t.active) ? ' has-active' : ''}`}
            onClick={() => setDropdownOpen((v) => !v)}
            title="Mais vistas"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
          >
            <span>+{overflowTabs.length}</span>
            <Icon name="down" size={12} />
          </button>

          {dropdownOpen && (
            <div className="vtab-overflow-menu" role="menu">
              {overflowTabs.map((t) => (
                <button
                  key={t.key}
                  role="menuitem"
                  className={`vtab-overflow-item${t.active ? ' on' : ''}`}
                  onClick={() => {
                    t.onClick();
                    setDropdownOpen(false);
                  }}
                >
                  <Icon name={t.icon} size={14} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <span style={{ flex: 1, minWidth: 4 }} />

      <div className="vtab-controls" ref={controlsRef}>
        <button className="ibtn" onClick={() => useUi.setState({ leftOpen: !s.leftOpen, ...(narrow() && !s.leftOpen ? { rightOpen: false } : {}) })} title="Mostrar/ocultar propriedades" aria-pressed={s.leftOpen}>
          <Icon name="edit" size={16} />
        </button>
        <button className="ibtn" onClick={() => useUi.setState({ rightOpen: !s.rightOpen, ...(narrow() && !s.rightOpen ? { leftOpen: false } : {}) })} title="Mostrar/ocultar navegador" aria-pressed={s.rightOpen}>
          <Icon name="levels" size={16} />
        </button>
      </div>
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
            {view === 'sheet' && sheetId ? <SheetView sheetId={sheetId} /> : <ViewportCanvas />}
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
