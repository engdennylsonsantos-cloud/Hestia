import type { ReactElement } from 'react';
import type { LocationLine } from '@hestia/model';
import { DEFAULT_RAMP_OPTIONS, roofAutoOffset, type ToolId } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';
import { LOCATION_LABEL } from './OptionsBar.tsx';
import { RampLevelsFields, rampLevelsValue } from './RampLevelsFields.tsx';

const PLACE_TOOLS = new Set<ToolId>(['wall', 'door', 'window', 'floor', 'slab', 'slope', 'ceiling', 'roof', 'roofextrusion', 'stair', 'stairrun', 'ramp', 'room', 'roomsep', 'dimension', 'text', 'section']);

export function hasPlacementProperties(tool: ToolId): boolean {
  return PLACE_TOOLS.has(tool);
}

/** Configurações de colocação ligadas ao mesmo ToolOptions que as ferramentas leem ao criar cada elemento. */
export function PlacementProperties({ tool }: { tool: ToolId }): ReactElement {
  const p = useProject();
  const levelId = useUi((s) => s.levelId);
  const o = useUi((s) => s.options);
  const set = (patch: Partial<typeof o>): void => useUi.setState((s) => ({ options: { ...s.options, ...patch } }));
  const setStairRun = (patch: Partial<NonNullable<typeof o.stairRun>>): void => set({ stairRun: { ...(o.stairRun ?? { shape: 'straight', width: 1.2, turn: 'left' }), ...patch } });
  const setStair = (patch: Partial<NonNullable<typeof o.stair>>): void => set({ stair: { ...(o.stair ?? {}), ...patch } });
  const setRamp = (patch: Partial<NonNullable<typeof o.ramp>>): void => set({ ramp: { ...(o.ramp ?? DEFAULT_RAMP_OPTIONS), ...patch } });

  return (
    <>
      {tool === 'wall' && (
        <Group title="Colocação · Parede">
          <Row label="Forma" htmlFor="place-wall-shape"><select id="place-wall-shape" className="select" value={o.wallShape} onChange={(e) => set({ wallShape: e.target.value as typeof o.wallShape })}><option value="line">Reta</option><option value="arc">Arco (3 pontos)</option><option value="rect">Retângulo</option></select></Row>
          <Row label="Nível base"><span className="val">{p.levels.find((l) => l.id === levelId)?.name ?? 'Nível ativo'}</span></Row>
          <Row label="Desloc. da base" htmlFor="place-wall-base"><NumField id="place-wall-base" value={o.wallBaseOffset ?? 0} unit="m" onCommit={(v) => set({ wallBaseOffset: v })} /></Row>
          <Row label="Nível superior" htmlFor="place-wall-top"><select id="place-wall-top" className="select" value={o.wallTopLevelId ?? ''} onChange={(e) => set({ wallTopLevelId: e.target.value || null })}><option value="">Por altura</option>{p.levels.filter((l) => l.id !== levelId).map((l) => <option key={l.id} value={l.id}>Até {l.name}</option>)}</select></Row>
          {o.wallTopLevelId ? <Row label="Desloc. do topo" htmlFor="place-wall-topoff"><NumField id="place-wall-topoff" value={o.wallTopOffset ?? 0} unit="m" onCommit={(v) => set({ wallTopOffset: v })} /></Row> : <Row label="Altura" htmlFor="place-wall-height"><NumField id="place-wall-height" value={o.wallHeight} unit="m" min={0.1} onCommit={(v) => set({ wallHeight: v })} /></Row>}
          <Row label="Linha de localização" htmlFor="place-wall-location"><select id="place-wall-location" className="select" value={o.locationLine} onChange={(e) => set({ locationLine: e.target.value as LocationLine })}>{Object.entries(LOCATION_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Row>
          <Row label="Inverter lado externo"><Check id="place-wall-flipped" checked={o.wallFlipped ?? false} onChange={(v) => set({ wallFlipped: v })} /></Row>
          <Row label="Encadear"><Check id="place-wall-chain" checked={o.chain} onChange={(v) => set({ chain: v })} /></Row>
          <Row label="Travar em 0°/90°"><Check id="place-wall-ortho" checked={o.orthoLock} onChange={(v) => set({ orthoLock: v })} /></Row>
        </Group>
      )}
      {(tool === 'door' || tool === 'window') && (
        <Group title={`Colocação · ${tool === 'door' ? 'Porta' : 'Janela'}`}>
          <Row label="Inverter dobradiça"><Check id="place-open-hand" checked={o.openingFlipHand ?? false} onChange={(v) => set({ openingFlipHand: v })} /></Row>
          <Row label="Inverter sentido"><Check id="place-open-facing" checked={o.openingFlipFacing ?? false} onChange={(v) => set({ openingFlipFacing: v })} /></Row>
          <Row label="Sentido" htmlFor="place-open-facing-mode"><select id="place-open-facing-mode" className="select" value={o.openingFacingMode ?? 'cursor'} onChange={(e) => set({ openingFacingMode: e.target.value as NonNullable<typeof o.openingFacingMode> })}><option value="cursor">Pelo cursor</option><option value="fixed">Manual</option></select></Row>
          <Row label="Abrir" htmlFor="place-open-toward"><select id="place-open-toward" className="select" value={o.openingToward ?? 'cursor'} onChange={(e) => set({ openingToward: e.target.value as NonNullable<typeof o.openingToward> })}><option value="cursor">para o lado do cursor</option><option value="away">para o lado oposto</option></select></Row>
          <Row label="Âncora" htmlFor="place-open-anchor"><select id="place-open-anchor" className="select" value={o.openingAnchor ?? 'center'} onChange={(e) => set({ openingAnchor: e.target.value as NonNullable<typeof o.openingAnchor> })}><option value="center">Centro</option><option value="hinge">Ombreira da dobradiça</option><option value="latch">Ombreira do trinco</option></select></Row>
          <Row label="Folga da quina (cm)" htmlFor="place-open-clear"><NumField id="place-open-clear" value={o.openingClear ?? 0.1} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => set({ openingClear: v })} /></Row>
          <Row label="Cotas" htmlFor="place-open-dim"><select id="place-open-dim" className="select" value={o.openingDimMode ?? 'axis'} onChange={(e) => set({ openingDimMode: e.target.value as NonNullable<typeof o.openingDimMode> })}><option value="axis">Do eixo</option><option value="face">Da face do batente</option></select></Row>
          <Row label="Etiquetas de portas e janelas"><Check id="place-open-tags" checked={p.settings.showOpeningTags === true} onChange={(v) => editor.store.exec({ type: 'setSettings', patch: { showOpeningTags: v } })} /></Row>
          <Row label="Etiquetar ao inserir"><Check id="place-open-tag-place" checked={o.openingTagOnPlace !== false} onChange={(v) => set({ openingTagOnPlace: v })} /></Row>
          {(() => { const typeId = tool === 'door' ? o.doorTypeId : o.windowTypeId; const type = p.openingTypes[typeId]; return <Row label="Peitoril" htmlFor="place-opening-sill"><NumField id="place-opening-sill" value={o.openingSillOverride ?? type?.sill ?? 0} placeholder={type ? `${type.sill.toFixed(2).replace('.', ',')} m (tipo)` : undefined} onCommit={(v) => set({ openingSillOverride: v })} onClear={() => set({ openingSillOverride: null })} unit="m" min={0} /></Row>; })()}
          <div className="hint">A parede anfitriã e a posição são escolhidas na planta. Largura, altura e peitoril vêm do tipo selecionado.</div>
        </Group>
      )}
      {tool === 'floor' && (
        <Group title="Colocação · Piso">
          <Row label="Modo do contorno" htmlFor="place-floor-mode"><select id="place-floor-mode" className="select" value={o.floorMode} onChange={(e) => { set({ floorMode: e.target.value as typeof o.floorMode }); editor.setTool('floor'); }}><option value="poly">Contorno por pontos</option><option value="rect">Retângulo</option><option value="walls">Área fechada por paredes</option><option value="perimetro">Perímetro externo</option></select></Row>
          <Row label="Desloc. do topo" htmlFor="place-floor-offset"><NumField id="place-floor-offset" value={o.floorOffset} unit="m" onCommit={(v) => set({ floorOffset: v })} /></Row>
          {o.floorMode === 'walls' && <Row label="Estender até o núcleo"><Check id="place-floor-core" checked={o.floorCore === true} onChange={(v) => set({ floorCore: v })} /></Row>}
        </Group>
      )}
      {(tool === 'slab' || tool === 'slope') && (
        <Group title={`Colocação · ${tool === 'slope' ? 'Inclinação' : 'Laje'}`}>
          {tool === 'slab' && <>
            <Row label="Modo do contorno" htmlFor="place-slab-mode"><select id="place-slab-mode" className="select" value={o.slabMode} onChange={(e) => { set({ slabMode: e.target.value as typeof o.slabMode }); editor.setTool('slab'); }}><option value="poly">Contorno por pontos</option><option value="rect">Retângulo</option><option value="perimetro">Perímetro externo</option></select></Row>
            <Row label="Desloc. do topo" htmlFor="place-slab-offset"><NumField id="place-slab-offset" value={o.slabOffset} unit="m" onCommit={(v) => set({ slabOffset: v })} /></Row>
          </>}
          <Row label="Caimento" htmlFor="place-slab-slope"><NumField id="place-slab-slope" value={o.slabSlopePercent} unit="%" onCommit={(v) => set({ slabSlopePercent: v })} /></Row>
        </Group>
      )}
      {tool === 'ceiling' && (
        <Group title="Colocação · Forro">
          <Row label="Modo do contorno" htmlFor="place-ceiling-mode"><select id="place-ceiling-mode" className="select" value={o.ceilingMode ?? 'poly'} onChange={(e) => { set({ ceilingMode: e.target.value as NonNullable<typeof o.ceilingMode> }); editor.setTool('ceiling'); }}><option value="poly">Contorno por pontos</option><option value="rect">Retângulo</option><option value="room">No ambiente</option></select></Row>
          <Row label="Cota do topo" htmlFor="place-ceiling-offset"><NumField id="place-ceiling-offset" value={o.ceilingOffset ?? 2.6} unit="m" onCommit={(v) => set({ ceilingOffset: v })} /></Row>
        </Group>
      )}
      {(tool === 'roof' || tool === 'roofextrusion') && (
        <Group title="Colocação · Telhado">
          <Row label="Modo" htmlFor="place-roof-mode"><select id="place-roof-mode" className="select" value={tool === 'roofextrusion' ? 'extrusao' : o.roofMode ?? 'poly'} onChange={(e) => { set({ roofMode: e.target.value as NonNullable<typeof o.roofMode> }); editor.setTool(e.target.value === 'extrusao' ? 'roofextrusion' : 'roof'); }}><option value="poly">Contorno por pontos</option><option value="rect">Retângulo</option><option value="paredes">Pelas paredes</option><option value="extrusao">Por extrusão</option></select></Row>
          <Row label="Forma" htmlFor="place-roof-shape"><select id="place-roof-shape" className="select" value={o.roofShape ?? 'gable'} onChange={(e) => set({ roofShape: e.target.value as NonNullable<typeof o.roofShape> })}><option value="shed">Uma água</option><option value="gable">Duas águas</option><option value="hip">Quatro águas</option><option value="edges">Por arestas</option><option value="extrusion">Extrusão</option></select></Row>
          <Row label="Inclinação" htmlFor="place-roof-slope"><NumField id="place-roof-slope" value={o.roofSlope ?? 30} unit="%" min={0.1} onCommit={(v) => set({ roofSlope: v })} /></Row>
          <Row label="Balanço do beiral" htmlFor="place-roof-overhang"><NumField id="place-roof-overhang" value={o.roofOverhang ?? 0.5} unit="m" min={0} onCommit={(v) => set({ roofOverhang: v })} /></Row>
          <Row label="Cota do beiral" htmlFor="place-roof-offset"><NumField id="place-roof-offset" value={o.roofOffset ?? roofAutoOffset(p, levelId)} unit="m" onCommit={(v) => set({ roofOffset: v })} /></Row>
          <div className="prow"><span /><button className="btn small" onClick={() => set({ roofOffset: null })}>Cota automática</button></div>
        </Group>
      )}
      {tool === 'stair' && (
        <Group title="Colocação · Escada">
          <Row label="Nível de topo" htmlFor="place-stair-top"><select id="place-stair-top" className="select" value={o.stair?.topLevelId ?? ''} onChange={(e) => setStair({ topLevelId: e.target.value || null })}><option value="">Automático (nível acima)</option>{p.levels.filter((l) => l.id !== levelId).map((l) => <option key={l.id} value={l.id}>Até {l.name}</option>)}</select></Row>
          <Row label="Desloc. da base" htmlFor="place-stair-base"><NumField id="place-stair-base" value={o.stair?.baseOffset ?? 0} unit="m" onCommit={(v) => setStair({ baseOffset: v })} /></Row>
          <Row label="Desloc. do topo" htmlFor="place-stair-topoff"><NumField id="place-stair-topoff" value={o.stair?.topOffset ?? 0} unit="m" onCommit={(v) => setStair({ topOffset: v })} /></Row>
          {!(o.stair?.topLevelId ?? p.levels.some((l) => l.elevation > (p.levels.find((x) => x.id === levelId)?.elevation ?? 0))) && <Row label="Altura" htmlFor="place-stair-height"><NumField id="place-stair-height" value={o.stair?.height ?? 2.8} unit="m" min={0.1} onCommit={(v) => setStair({ height: v })} /></Row>}
        </Group>
      )}
      {tool === 'stairrun' && (
        <Group title="Colocação · Escada por lance">
          <Row label="Forma" htmlFor="place-run-shape"><select id="place-run-shape" className="select" value={o.stairRun?.shape ?? 'straight'} onChange={(e) => setStairRun({ shape: e.target.value as NonNullable<typeof o.stairRun>['shape'] })}><option value="straight">Reta</option><option value="lshape">Em L</option><option value="ushape">Em U</option><option value="winder">Com leque</option><option value="spiral">Caracol</option></select></Row>
          <Row label="Largura" htmlFor="place-run-width"><NumField id="place-run-width" value={o.stairRun?.width ?? 1.2} unit="m" min={0.4} onCommit={(v) => setStairRun({ width: v })} /></Row>
          {o.stairRun?.shape !== 'straight' && <Row label="Giro" htmlFor="place-run-turn"><select id="place-run-turn" className="select" value={o.stairRun?.turn ?? 'left'} onChange={(e) => setStairRun({ turn: e.target.value as 'left' | 'right' })}><option value="left">Esquerda</option><option value="right">Direita</option></select></Row>}
          {o.stairRun?.shape === 'spiral' && <><Row label="Raio interno" htmlFor="place-run-inner"><NumField id="place-run-inner" value={o.stairRun?.spiralInner ?? 0.1} unit="m" min={0.05} onCommit={(v) => setStairRun({ spiralInner: v })} /></Row><Row label="Raio externo" htmlFor="place-run-outer"><NumField id="place-run-outer" value={o.stairRun?.spiralOuter ?? 1} unit="m" min={0.2} onCommit={(v) => setStairRun({ spiralOuter: v })} /></Row><Row label="Varredura" htmlFor="place-run-sweep"><NumField id="place-run-sweep" value={o.stairRun?.spiralSweep ?? 360} unit="°" min={30} max={720} onCommit={(v) => setStairRun({ spiralSweep: v })} /></Row></>}
        </Group>
      )}
      {tool === 'ramp' && (
        <Group title="Colocação · Rampa">
          <RampLevelsFields project={p} levelId={levelId} idPrefix="place-ramp" value={rampLevelsValue(o.ramp ?? DEFAULT_RAMP_OPTIONS)} onChange={setRamp} Field={Row} />
        </Group>
      )}
      {tool === 'room' && (
        <Group title="Colocação · Ambiente">
          <Row label="Nível" htmlFor="place-room-level"><select id="place-room-level" className="select" value={levelId} onChange={(e) => useUi.setState({ levelId: e.target.value, selection: [] })}>{p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Row>
          <Row label="Nome" htmlFor="place-room-name"><TextField id="place-room-name" value={o.roomName ?? ''} placeholder="Automático" onCommit={(v) => set({ roomName: v })} /></Row>
          <Row label="Número" htmlFor="place-room-number"><TextField id="place-room-number" value={o.roomNumber ?? ''} placeholder="Automático" onCommit={(v) => set({ roomNumber: v })} /></Row>
          <Row label="Desloc. da base" htmlFor="place-room-offset"><NumField id="place-room-offset" value={o.roomHeightOffset ?? 0} unit="m" onCommit={(v) => set({ roomHeightOffset: v })} /></Row>
          <Row label="Pé-direito" htmlFor="place-room-height"><NumField id="place-room-height" value={o.roomCeilingHeight ?? 2.8} unit="m" min={0.1} onCommit={(v) => set({ roomCeilingHeight: v })} /></Row>
          <Row label="Acabamento do piso" htmlFor="place-room-floor"><TextField id="place-room-floor" value={o.roomFloorFinish ?? ''} onCommit={(v) => set({ roomFloorFinish: v })} /></Row>
          <Row label="Acabamento da parede" htmlFor="place-room-wall"><TextField id="place-room-wall" value={o.roomWallFinish ?? ''} onCommit={(v) => set({ roomWallFinish: v })} /></Row>
          <Row label="Acabamento do forro" htmlFor="place-room-ceiling"><TextField id="place-room-ceiling" value={o.roomCeilingFinish ?? ''} onCommit={(v) => set({ roomCeilingFinish: v })} /></Row>
          <Row label="Cor"><input id="place-room-color" type="color" aria-label="Cor do ambiente" value={o.roomColor ?? '#b8c4d4'} onChange={(e) => set({ roomColor: e.target.value })} /></Row>
        </Group>
      )}
      {tool === 'text' && (
        <Group title="Colocação · Texto">
          <Row label="Altura do texto" htmlFor="place-text-height"><NumField id="place-text-height" value={o.textHeight ?? 2.5} unit="mm" min={0.1} onCommit={(v) => set({ textHeight: v })} /></Row>
          <Row label="Rotação" htmlFor="place-text-rotation"><NumField id="place-text-rotation" value={o.textRotation ?? 0} unit="°" onCommit={(v) => set({ textRotation: v })} /></Row>
          <div className="hint">Clique na planta e digite o conteúdo do texto.</div>
        </Group>
      )}
      {['room', 'roomsep', 'dimension', 'text', 'section'].includes(tool) && (
        <Group title={`Colocação · ${tool === 'room' ? 'Ambiente' : tool === 'roomsep' ? 'Separador de ambiente' : tool === 'dimension' ? 'Cota' : tool === 'text' ? 'Texto' : 'Corte'}`}>
          <div className="hint">As opções geométricas e o conteúdo são definidos durante o desenho. O elemento será criado no nível ativo ({p.levels.find((l) => l.id === levelId)?.name ?? 'Nível atual'}).</div>
        </Group>
      )}
      {!['room', 'roomsep', 'dimension', 'text', 'section'].includes(tool) && (
        <Group title="Nível e identidade" open={false}>
          <Row label="Nível" htmlFor="place-level"><select id="place-level" className="select" value={levelId} onChange={(e) => useUi.setState({ levelId: e.target.value, selection: [] })}>{p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Row>
          <Row label="Marca" htmlFor="place-mark"><TextField id="place-mark" value={o.placementMark ?? ''} onCommit={(v) => set({ placementMark: v })} /></Row>
          {tool !== 'door' && tool !== 'window' ? <Row label="Comentários" htmlFor="place-comments"><TextField id="place-comments" value={o.placementComments ?? ''} onCommit={(v) => set({ placementComments: v })} /></Row> : null}
        </Group>
      )}
    </>
  );
}
