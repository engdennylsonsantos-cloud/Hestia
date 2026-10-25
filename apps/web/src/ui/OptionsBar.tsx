import { useState, type ReactElement } from 'react';
import { TOOL_LABEL, type FloorMode } from '@hestia/tools';
import { addRoomsAllCircuits } from '../editor/roomActions.ts';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, NumField } from './fields.tsx';
import { SlabOptionsBar } from './SlabOptionsBar.tsx';
import { CeilingOptionsBar } from './CeilingOptionsBar.tsx';
import { RoofOptionsBar } from './RoofOptionsBar.tsx';
import { RoofArrowOptionsBar } from './RoofArrowOptionsBar.tsx';
import { StairOptionsBar } from './StairOptionsBar.tsx';
import { StairRunOptionsBar } from './StairRunOptionsBar.tsx';
import { openingFamilies, openingFamilyOf, type LocationLine } from '@hestia/model';

export const LOCATION_LABEL: Record<LocationLine, string> = {
  wallCenter: 'Eixo da parede',
  coreCenter: 'Eixo do núcleo',
  finishExterior: 'Face externa do acabamento',
  finishInterior: 'Face interna do acabamento',
  coreExterior: 'Face externa do núcleo',
  coreInterior: 'Face interna do núcleo',
};

/** Tipo Selector do Revit: agrupa os tipos por família e filtra por nome ou código. */
function OpeningTypePicker({ kind, value, onChange }: { kind: 'door' | 'window'; value: string; onChange: (id: string) => void }): ReactElement {
  const p = useProject();
  const [q, setQ] = useState('');
  const types = Object.values(p.openingTypes).filter((t) => t.kind === kind);
  const needle = q.trim().toLowerCase();
  const shown = needle ? types.filter((t) => t.name.toLowerCase().includes(needle) || (t.code ?? '').toLowerCase().includes(needle)) : types;
  // Favoritos no topo (ArchiCAD: Favorites); os demais ficam agrupados por família.
  const favorites = p.settings.favoriteOpeningTypes ?? [];
  const favSet = new Set(favorites);
  const favoriteItems = shown.filter((t) => favSet.has(t.id));
  const rest = shown.filter((t) => !favSet.has(t.id));
  // Um grupo por família (ordem da interface); tipos sem família (dado fora do contrato) caem em "Outros".
  const groups = openingFamilies(kind)
    .map((f) => ({ family: f, items: rest.filter((t) => openingFamilyOf(t)?.id === f.id) }))
    .filter((g) => g.items.length);
  const orphans = rest.filter((t) => !openingFamilyOf(t));
  const visible = new Set(shown.map((t) => t.id));
  const current = p.openingTypes[value];
  return (
    <>
      <label>
        Buscar
        <input id="opt-opensearch" className="input" style={{ width: 120 }} value={q} placeholder="nome ou código" aria-label="Buscar tipo de abertura" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
      </label>
      <label>
        Tipo
        <select id="opt-opentype" className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          {current && !visible.has(value) ? <option value={value}>{current.name}</option> : null}
          {favoriteItems.length ? (
            <optgroup label="★ Favoritos">
              {favoriteItems.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          ) : null}
          {groups.map((g) => (
            <optgroup key={g.family.id} label={g.family.name}>
              {g.items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          ))}
          {orphans.length ? (
            <optgroup label="Outros">
              {orphans.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </optgroup>
          ) : null}
        </select>
      </label>
      <button
        type="button"
        className="btn small"
        aria-label={favSet.has(value) ? 'Remover tipo dos favoritos' : 'Adicionar tipo aos favoritos'}
        title={favSet.has(value) ? 'Remover dos favoritos (desfazível)' : 'Adicionar aos favoritos (desfazível)'}
        onClick={() => editor.store.exec({ type: 'toggleOpeningFavorite', id: value }, favSet.has(value) ? 'Remover tipo dos favoritos' : 'Favoritar tipo de abertura')}
      >
        {favSet.has(value) ? '★' : '☆'}
      </button>
    </>
  );
}

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
      {tool === 'room' && (
        <button id="opt-roomall" className="btn small" onClick={() => addRoomsAllCircuits()} title="Cria um ambiente em cada circuito fechado que ainda não tem um; um só Ctrl+Z desfaz tudo">
          Ambientes em todos os circuitos fechados
        </button>
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
      {tool === 'ceiling' && <CeilingOptionsBar />}
      {(tool === 'roof' || tool === 'roofextrusion') && <RoofOptionsBar tool={tool} />}
      {tool === 'roofarrow' && <RoofArrowOptionsBar />}
      {tool === 'stair' && <StairOptionsBar />}
      {tool === 'stairrun' && <StairRunOptionsBar />}
      {(tool === 'door' || tool === 'window') && (
        <OpeningTypePicker
          kind={tool}
          value={tool === 'door' ? o.doorTypeId : o.windowTypeId}
          onChange={(id) => set(tool === 'door' ? { doorTypeId: id } : { windowTypeId: id })}
        />
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
