import type { ReactElement } from 'react';
import { TOOL_LABEL, type FloorMode } from '@hestia/tools';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, NumField } from './fields.tsx';
import { SlabOptionsBar } from './SlabOptionsBar.tsx';
import { RoofOptionsBar } from './RoofOptionsBar.tsx';
import { StairOptionsBar } from './StairOptionsBar.tsx';
import { StairRunOptionsBar } from './StairRunOptionsBar.tsx';
import type { LocationLine } from '@hestia/model';

export const LOCATION_LABEL: Record<LocationLine, string> = {
  wallCenter: 'Eixo da parede',
  coreCenter: 'Eixo do núcleo',
  finishExterior: 'Face externa do acabamento',
  finishInterior: 'Face interna do acabamento',
  coreExterior: 'Face externa do núcleo',
  coreInterior: 'Face interna do núcleo',
};

export function OptionsBar(): ReactElement {
  const p = useProject();
  const tool = useUi((s) => s.tool);
  const o = useUi((s) => s.options);
  const sel = useUi((s) => s.selection);
  const set = (patch: Partial<typeof o>): void => useUi.setState({ options: { ...o, ...patch } });
  return (
    <div className="optbar" role="group" aria-label="Opções da ferramenta">
      <span className="tool-name">{TOOL_LABEL[tool]}</span>
      {tool === 'wall' && (
        <>
          <label>
            Tipo
            <select id="opt-walltype" className="select" value={o.wallTypeId} onChange={(e) => set({ wallTypeId: e.target.value })}>
              {Object.values(p.wallTypes).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Forma
            <select id="opt-shape" className="select" value={o.wallShape} onChange={(e) => set({ wallShape: e.target.value as 'line' | 'arc' | 'rect' })}>
              <option value="line">Reta</option>
              <option value="arc">Arco (3 pontos)</option>
              <option value="rect">Retângulo (2 cantos)</option>
            </select>
          </label>
          <label>
            Linha de localização
            <select id="opt-loc" className="select" value={o.locationLine} onChange={(e) => set({ locationLine: e.target.value as LocationLine })}>
              {(Object.keys(LOCATION_LABEL) as LocationLine[]).map((k) => (
                <option key={k} value={k}>{LOCATION_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label>
            Altura
            <NumField id="opt-height" value={o.wallHeight} onCommit={(v) => set({ wallHeight: v })} unit="m" min={0.1} />
          </label>
          <Check id="opt-chain" checked={o.chain} onChange={(v) => set({ chain: v })}>Encadear</Check>
          <Check id="opt-ortho" checked={o.orthoLock} onChange={(v) => set({ orthoLock: v })}>Travar em 0°/90°</Check>
        </>
      )}
      {tool === 'floor' && (
        <>
          <label>
            Tipo
            <select id="opt-floortype" className="select" value={o.floorTypeId} onChange={(e) => set({ floorTypeId: e.target.value })}>
              {Object.values(p.floorTypes).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Modo
            <select
              id="opt-floormode"
              className="select"
              value={o.floorMode}
              onChange={(e) => {
                // Trocar o modo reinicia o desenho em andamento (o modo é lido pela ferramenta a cada passo).
                useUi.setState({ options: { ...useUi.getState().options, floorMode: e.target.value as FloorMode } });
                editor.setTool('floor');
              }}
            >
              <option value="poly">Contorno por pontos</option>
              <option value="rect">Retângulo (2 cantos)</option>
              <option value="walls">Área fechada por paredes</option>
              <option value="hole">Furo no piso selecionado</option>
              <option value="perimetro">Perímetro externo da edificação</option>
            </select>
          </label>
          {o.floorMode === 'walls' && (
            <Check id="opt-floorcore" checked={o.floorCore === true} onChange={(v) => set({ floorCore: v })}>Estender até o núcleo</Check>
          )}
          <label>
            Deslocamento do topo
            <NumField id="opt-flooroffset" value={o.floorOffset} onCommit={(v) => set({ floorOffset: v })} unit="m" />
          </label>
        </>
      )}
      {(tool === 'slab' || tool === 'slope') && <SlabOptionsBar tool={tool} />}
      {(tool === 'roof' || tool === 'roofextrusion') && <RoofOptionsBar tool={tool} />}
      {tool === 'stair' && <StairOptionsBar />}
      {tool === 'stairrun' && <StairRunOptionsBar />}
      {(tool === 'door' || tool === 'window') && (
        <label>
          Tipo
          <select id="opt-opentype" className="select" value={tool === 'door' ? o.doorTypeId : o.windowTypeId} onChange={(e) => set(tool === 'door' ? { doorTypeId: e.target.value } : { windowTypeId: e.target.value })}>
            {Object.values(p.openingTypes).filter((t) => t.kind === tool).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
      )}
      {tool === 'rotate' && <Check id="opt-rcopy" checked={o.rotateCopy} onChange={(v) => set({ rotateCopy: v })}>Copiar</Check>}
      {tool === 'mirror' && <Check id="opt-mcopy" checked={o.mirrorCopy} onChange={(v) => set({ mirrorCopy: v })}>Copiar</Check>}
      {tool === 'array' && (
        <label>
          Número de itens
          <NumField id="opt-count" value={o.arrayCount} decimals={0} onCommit={(v) => set({ arrayCount: Math.max(2, Math.round(v)) })} />
        </label>
      )}
      {tool === 'offset' && (
        <>
          <label>
            Distância
            <NumField id="opt-offset" value={o.offsetDistance} onCommit={(v) => set({ offsetDistance: v })} unit="m" min={0.01} />
          </label>
          <Check id="opt-ocopy" checked={o.offsetCopy} onChange={(v) => set({ offsetCopy: v })}>Copiar</Check>
        </>
      )}
      {tool === 'parallel' && (
        <label>
          Distância entre
          <select id="opt-offsetfrom" className="select" value={o.offsetFrom ?? 'face'} onChange={(e) => set({ offsetFrom: e.target.value as 'axis' | 'face' })}>
            <option value="face">Faces (padrão)</option>
            <option value="axis">Eixos</option>
          </select>
        </label>
      )}
      {tool === 'select' && (
        <>
          <span style={{ color: 'var(--fg-soft)' }}>{sel.length ? `${sel.length} selecionado${sel.length > 1 ? 's' : ''}` : 'Nada selecionado'}</span>
          {sel.length > 0 && (
            <button className="btn small danger" onClick={() => editor.deleteSelection()}>Excluir (Del)</button>
          )}
        </>
      )}
    </div>
  );
}
