import type { ReactElement } from 'react';
import { areaPlanOf, planAnnotationsOf, type AreaPlan, type Project } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { applyColorSchemeAction, clearColorSchemeAction, recenterTagsAction, seedPlanAnnotationsAction, setPlanGraphicsAction } from '../editor/areaPlanActions.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';

const say = (status: string): void => useUi.setState({ status });

/** Painel da planta de área quando nada está selecionado: gráficos, cor e etiquetas. */
export function AreaPlanProperties({ plan }: { plan: AreaPlan }): ReactElement {
  const p: Project = useProject();
  // `showGrids`/`showSectionMarks` são opcionais no modelo; ausentes valem desligados.
  const g = plan.graphics;
  const a = planAnnotationsOf(plan);
  const annotationTotal = a.dimensions.length + a.texts.length + a.detailLines.length + a.detailRegions.length + a.tags.length;
  const rooms = Object.values(p.elements).filter((e) => e.kind === 'room' && e.levelId === plan.levelId).length;
  return (
    <>
      <Group title="Planta de área">
        <Row label="Nome" htmlFor="ap-name">
          <TextField id="ap-name" value={plan.name} onCommit={(v) => editor.store.exec({ type: 'updateAreaPlan', id: plan.id, patch: { name: v } }, 'Renomear planta de área')} />
        </Row>
        <Row label="Escala" htmlFor="ap-scale">
          <NumField id="ap-scale" value={plan.scale} min={1} unit="1:" onCommit={(v) => editor.store.exec({ type: 'updateAreaPlan', id: plan.id, patch: { scale: v } }, 'Alterar escala da planta')} />
        </Row>
        <Row label="Ambientes"><span className="val">{rooms} no nível</span></Row>
      </Group>

      <Group title="Desenho">
        <Row label="Paredes" htmlFor="ap-walls">
          <select id="ap-walls" className="select" value={g.showWalls} onChange={(e) => setPlanGraphicsAction(editor.store, plan.id, { showWalls: e.target.value as typeof g.showWalls })}>
            <option value="light">Claras</option>
            <option value="normal">Normais</option>
            <option value="hidden">Ocultas</option>
          </select>
        </Row>
        <Row label="Linhas de referência" htmlFor="ap-ref">
          <select id="ap-ref" className="select" value={g.referenceLines} onChange={(e) => setPlanGraphicsAction(editor.store, plan.id, { referenceLines: e.target.value as typeof g.referenceLines })}>
            <option value="always">Sempre</option>
            <option value="selected">Só no selecionado</option>
            <option value="never">Nunca</option>
          </select>
        </Row>
        <Row label="Contorno" htmlFor="ap-outline">
          <select id="ap-outline" className="select" value={g.outline} onChange={(e) => setPlanGraphicsAction(editor.store, plan.id, { outline: e.target.value as typeof g.outline })}>
            <option value="none">Sem contorno</option>
            <option value="thin">Fino</option>
            <option value="dashed">Tracejado</option>
          </select>
        </Row>
        <Row label="Conteúdo do rótulo" htmlFor="ap-tagfields">
          <select
            id="ap-tagfields"
            className="select"
            value={g.tagDefault.fields.join(',')}
            onChange={(e) => {
              const fields = e.target.value.split(',') as typeof g.tagDefault.fields;
              setPlanGraphicsAction(editor.store, plan.id, { tagDefault: { ...g.tagDefault, fields } });
            }}
          >
            <option value="name,number,area">Nome, número e área</option>
            <option value="name,area">Nome e área</option>
            <option value="name,number">Nome e número</option>
            <option value="name">Só o nome</option>
            <option value="name,area,perimeter">Nome, área e perímetro</option>
          </select>
        </Row>
      </Group>

      <Group title="Vista e anotações">
        <Row label="Mostrar aberturas"><Check id="ap-openings" checked={g.showOpenings} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showOpenings: v })} /></Row>
        <Row label="Mostrar eixos"><Check id="ap-grids" checked={g.showGrids ?? false} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showGrids: v })} /></Row>
        <Row label="Mostrar marcas de corte"><Check id="ap-sectionmarks" checked={g.showSectionMarks ?? false} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showSectionMarks: v })} /></Row>
        <Row label="Mostrar cotas"><Check id="ap-dims" checked={g.showDimensions} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showDimensions: v })} /></Row>
        <Row label="Mostrar anotações do nível"><Check id="ap-annotations" checked={g.showAnnotations} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showAnnotations: v })} /></Row>
        <Row label="Mostrar piso/laje"><Check id="ap-floors" checked={g.showFloors} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showFloors: v })} /></Row>
        <Row label="Mostrar escadas e rampas"><Check id="ap-stairs" checked={g.showStairs ?? true} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showStairs: v })} /></Row>
        <Row label="Mostrar telhados (projeção)"><Check id="ap-roofs" checked={g.showRoofs ?? true} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showRoofs: v })} /></Row>
        <Row label="Mostrar objetos importados"><Check id="ap-generic" checked={g.showGeneric ?? false} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showGeneric: v })} /></Row>
        <Row label="Subpavimento"><Check id="ap-below" checked={g.showBelowLevel} onChange={(v) => setPlanGraphicsAction(editor.store, plan.id, { showBelowLevel: v })} /></Row>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => useUi.setState({ dialog: 'cotasAuto' })}>Cotas automáticas…</button>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              const n = seedPlanAnnotationsAction(editor.store, plan.id);
              say(n ? `${n} anotação(ões) copiada(s) do nível.` : 'O nível não tem anotações para copiar.');
            }}
          >
            Copiar anotações do nível
          </button>
        </div>
        <div className="hint">
          {annotationTotal > 0 ? `${annotationTotal} anotação(ões) nesta vista.` : g.showAnnotations ? 'Sem anotações próprias: a vista usa as do nível.' : 'Sem anotações nesta vista.'}
          {' '}Cotas, textos, detalhes e etiquetas ficam presos a esta planta e não vazam para a planta de piso.
        </div>
      </Group>

      <Group title="Cor (opcional)">
        <div className="hint">Sem esquema, a planta fica em preto e branco. A cor entra só depois de configurar.</div>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => applyColorSchemeAction(editor.store, plan.id, 'category')}>Por categoria</button>
          <button type="button" className="btn small" onClick={() => applyColorSchemeAction(editor.store, plan.id, 'level')}>Por nível</button>
          <button type="button" className="btn small" onClick={() => applyColorSchemeAction(editor.store, plan.id, 'areaRange')}>Por faixa</button>
          <button type="button" className="btn small" disabled={!plan.schemeId} onClick={() => clearColorSchemeAction(editor.store, plan.id)}>Sem cor</button>
        </div>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => useUi.setState({ dialog: 'roomCategories' })}>Gerenciar categorias…</button>
        </div>
        {plan.schemeId ? (
          <Row label="Preenchimento" htmlFor="ap-fill">
            <select id="ap-fill" className="select" value={g.fill} onChange={(e) => setPlanGraphicsAction(editor.store, plan.id, { fill: e.target.value as typeof g.fill })}>
              <option value="none">Sem preenchimento</option>
              <option value="scheme">Cor do esquema</option>
              <option value="hatch">Hachura (P&amp;B)</option>
            </select>
          </Row>
        ) : null}
      </Group>

      <Group title="Rótulos">
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => { const n = recenterTagsAction(editor.store, plan.id); say(n ? `${n} rótulo(s) recentralizado(s).` : 'Nenhum rótulo para recentralizar.'); }}>Recentralizar rótulos</button>
        </div>
        <div className="hint">Todo ambiente com circuito fechado já aparece com rótulo, sem precisar gerar. Arraste o rótulo e a chamada acompanha; a posição vale em todas as vistas.</div>
      </Group>
    </>
  );
}

/** Planta de área ativa, ou undefined. */
export const activeAreaPlan = (p: Project, id: string | null | undefined): AreaPlan | undefined => (id ? areaPlanOf(p, id) : undefined);
