import { useDeferredValue, useState, type ReactElement, type ReactNode } from 'react';
import {
  OPENING_FRAME_DEFAULTS,
  openingAngle2d,
  openingAngle3d,
  openingCasing,
  openingDetail2d,
  openingDetail3d,
  openingFrameStyle,
  openingGrid,
  openingHandle,
  openingLeafStyle,
  openingLintel,
  openingPlanDisplay,
  openingSillBeam,
  openingSillBoard,
  openingSwingStyle,
  type Material,
  type OpeningFamily,
  type OpeningType,
} from '@hestia/model';
import { Check, NumField, TextField } from '../../fields.tsx';
import { alternarAcabamento, alternarSidelight, alternarTransom } from '../openingTypeForm.ts';
import { OpeningTypeThumb } from './OpeningTypeThumb.tsx';
import { withOpeningField } from './openingTypeFields.ts';

interface OpeningTypeSectionsProps {
  d: OpeningType;
  onChange: (next: OpeningType) => void;
  families: readonly OpeningFamily[];
  family: OpeningFamily | null;
  leaves: ReadonlyArray<{ value: OpeningType['leaves']; label: string }>;
  materials: Record<string, Material>;
}

/** Seção recolhível no estilo `.pgroup`; destaque opcional para o nível de detalhe. */
function Secao({ title, children, open = true, highlight = false }: { title: string; children: ReactNode; open?: boolean; highlight?: boolean }): ReactElement {
  const [aberta, setAberta] = useState(open);
  return (
    <details className={`pgroup op-sec${highlight ? ' hl' : ''}`} open={aberta} onToggle={(e) => setAberta(e.currentTarget.open)}>
      <summary>{title}</summary>
      <div className="op-sec-body">{children}</div>
    </details>
  );
}

const FIELD_LEAF = [
  ['flush', 'Lisa'],
  ['panel', 'Painel'],
  ['glass', 'Vidro'],
  ['louver', 'Veneziana'],
  ['grille', 'Grade'],
] as const;

const FIELD_HANDLE = [
  ['none', 'Nenhuma'],
  ['lever', 'Alavanca'],
  ['knob', 'Botão'],
  ['pull', 'Puxador'],
] as const;

const FIELD_FRAME = [
  ['rebate', 'Com rebaixo'],
  ['simple', 'Simples'],
  ['aduela', 'Aduela (pré-marco)'],
  ['block', 'Bloco (sem perfil)'],
] as const;

/** Galeria de escolhas com a elevação em miniatura gerada pelo mesmo caminho da prévia (projeto mínimo + seção). */
function Miniaturas<T extends string>({
  value,
  options,
  onPick,
  preview,
}: {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onPick: (v: T) => void;
  preview: (v: T) => OpeningType;
}): ReactElement {
  return (
    <div className="op-choices">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={`btn small op-choice${v === value ? ' on' : ''}`}
          title={label}
          aria-label={label}
          aria-pressed={v === value}
          onClick={() => onPick(v)}
        >
          <OpeningTypeThumb type={preview(v)} width={58} height={42} />
        </button>
      ))}
    </div>
  );
}

/** As sete seções recolhíveis do diálogo, na ordem da decisão 0034. */
export function OpeningTypeSections({ d, onChange, families, leaves, materials }: OpeningTypeSectionsProps): ReactElement {
  const set = (patch: Partial<OpeningType>): void => onChange({ ...d, ...patch });
  // Valores efetivos (padrão por leitura) e os padrões de cada campo v2: o seletor mostra o efetivo e só grava o que difere.
  const leafStyle = openingLeafStyle(d);
  const handle = openingHandle(d);
  const frameStyle = openingFrameStyle(d);
  const angle2d = openingAngle2d(d);
  const angle3d = openingAngle3d(d);
  const grid = openingGrid(d);
  const detail2d = openingDetail2d(d);
  const detail3d = openingDetail3d(d);
  const setField = (field: Parameters<typeof withOpeningField>[1], value: unknown, fallback: unknown): void => {
    onChange(withOpeningField(d, field, value, fallback));
  };
  const leafFallback = openingLeafStyle({ kind: d.kind });
  const handleFallback = openingHandle({ kind: d.kind, plan: d.plan, leaves: d.leaves });
  const frameFallback = openingFrameStyle({});
  const angle2dFallback = openingAngle2d({});
  const angle3dFallback = openingAngle3d({ kind: d.kind, plan: d.plan });
  const gridFallback = openingGrid({});
  const detail2dFallback = openingDetail2d({});
  const detail3dFallback = openingDetail3d({});
  // As miniaturas são caras: o React atualiza o tipo adiado sem segurar a digitação nos campos.
  const thumbnailType = useDeferredValue(d);
  const setTexto = (campo: 'code' | 'description' | 'manufacturer' | 'fireRating', v: string): void => {
    set({ [campo]: v === '' ? undefined : v });
  };
  const limpar = (campo: 'acousticRw' | 'uValue' | 'solarFactor' | 'cost'): void => {
    const next: OpeningType = { ...d };
    delete next[campo];
    onChange(next);
  };
  const cas = openingCasing(d);
  const sb = openingSillBoard(d);
  const lin = openingLintel(d);
  const beam = openingSillBeam(d);
  const janela = d.kind === 'window';
  const temBandeira = d.transom !== undefined;
  const temLateral = d.sidelights !== undefined;

  return (
    <div className="op-sections">
      <Secao title="Pré-visualização e posicionamento">
        <div className="field-row"><label htmlFor="op-w">Largura</label><NumField id="op-w" value={d.width} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ width: v })} /></div>
        <div className="field-row"><label htmlFor="op-h">Altura</label><NumField id="op-h" value={d.height} scale={100} decimals={0} unit="cm" min={0.2} onCommit={(v) => set({ height: v })} /></div>
        <div className="field-row"><label htmlFor="op-s">Peitoril</label><NumField id="op-s" value={d.sill} scale={100} decimals={0} unit="cm" min={0} onCommit={(v) => set({ sill: v })} /></div>
      </Secao>

      <Secao title="Definições da folha">
        <div className="field-row">
          <label htmlFor="op-leaf">Estilo da folha</label>
          <select id="op-leaf" className="select" value={leafStyle} onChange={(e) => setField('leafStyle', e.target.value, leafFallback)}>
            {FIELD_LEAF.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <Miniaturas
          value={leafStyle}
          options={FIELD_LEAF}
          onPick={(v) => setField('leafStyle', v, leafFallback)}
          preview={(v) => ({ ...thumbnailType, leafStyle: v })}
        />
        <div className="field-row">
          <label htmlFor="op-leaves">Folhas</label>
          <select id="op-leaves" className="select" value={d.leaves} disabled={leaves.length <= 1} onChange={(e) => set({ leaves: Number(e.target.value) as OpeningType['leaves'] })}>
            {leaves.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="op-mat">Material do caixilho</label>
          <select id="op-mat" className="select" value={d.frameMaterialId} onChange={(e) => set({ frameMaterialId: e.target.value })}>
            {Object.values(materials).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field-row"><label htmlFor="op-lt">Espessura da folha</label><NumField id="op-lt" value={d.leafThickness ?? (d.kind === 'door' ? OPENING_FRAME_DEFAULTS.doorLeaf : OPENING_FRAME_DEFAULTS.windowLeaf)} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => set({ leafThickness: v })} /></div>
        <div className="field-row">
          <label htmlFor="op-handle">Maçaneta</label>
          <select id="op-handle" className="select" value={handle} onChange={(e) => setField('handle', e.target.value, handleFallback)}>
            {FIELD_HANDLE.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <Miniaturas
          value={handle}
          options={FIELD_HANDLE}
          onPick={(v) => setField('handle', v, handleFallback)}
          preview={(v) => ({ ...thumbnailType, handle: v })}
        />
        <div className="field-row"><label htmlFor="op-a2">Ângulo 2D</label><NumField id="op-a2" value={angle2d} decimals={0} unit="°" onCommit={(v) => setField('angle2d', v, angle2dFallback)} /></div>
        <div className="field-row"><label htmlFor="op-a3">Ângulo 3D</label><NumField id="op-a3" value={angle3d} decimals={0} unit="°" onCommit={(v) => setField('angle3d', v, angle3dFallback)} /></div>
        <div className="field-row"><label htmlFor="op-transom" title="Vidro fixo acima da folha">Bandeira superior</label><Check id="op-transom" checked={temBandeira} onChange={(v) => onChange(alternarTransom(d, v))} /></div>
        {temBandeira ? (
          <div className="field-row"><label htmlFor="op-transom-h">Bandeira: altura</label><NumField id="op-transom-h" value={d.transom?.height ?? 0} scale={100} decimals={0} unit="cm" onCommit={(v) => set({ transom: { height: v, fixed: d.transom?.fixed !== false } })} /></div>
        ) : null}
        <div className="field-row"><label htmlFor="op-side-left" title="Vidro fixo à esquerda da folha">Bandeira esquerda</label><Check id="op-side-left" checked={d.sidelights?.left === true} onChange={(v) => onChange(alternarSidelight(d, 'left', v))} /></div>
        <div className="field-row"><label htmlFor="op-side-right" title="Vidro fixo à direita da folha">Bandeira direita</label><Check id="op-side-right" checked={d.sidelights?.right === true} onChange={(v) => onChange(alternarSidelight(d, 'right', v))} /></div>
        {temLateral ? (
          <div className="field-row"><label htmlFor="op-side-w">Bandeira: largura</label><NumField id="op-side-w" value={d.sidelights?.width ?? 0} scale={100} decimals={0} unit="cm" onCommit={(v) => set({ sidelights: { left: d.sidelights?.left, right: d.sidelights?.right, width: v } })} /></div>
        ) : null}
      </Secao>

      <Secao title="Moldura e vidro">
        <div className="field-row">
          <label htmlFor="op-frame">Estilo do batente</label>
          <select id="op-frame" className="select" value={frameStyle} onChange={(e) => setField('frameStyle', e.target.value, frameFallback)}>
            {FIELD_FRAME.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </div>
        <div className="field-row"><label htmlFor="op-fw" title="Largura do perfil visto de frente (ombreiras, verga, soleira)">Largura do perfil</label><NumField id="op-fw" value={d.frameWidth ?? OPENING_FRAME_DEFAULTS.frameWidth} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => set({ frameWidth: v })} /></div>
        <div className="field-row"><label htmlFor="op-fd" title="Profundidade do batente na espessura da parede (limitada ao núcleo)">Profundidade do batente</label><NumField id="op-fd" value={d.frameDepth ?? OPENING_FRAME_DEFAULTS.frameDepth} scale={100} decimals={1} unit="cm" min={0.01} onCommit={(v) => set({ frameDepth: v })} /></div>
        {janela ? (
          <>
            <div className="field-row"><label htmlFor="op-grid-c">Divisões: colunas</label><NumField id="op-grid-c" value={grid.cols} decimals={0} onCommit={(v) => setField('grid', { cols: v, rows: grid.rows }, gridFallback)} /></div>
            <div className="field-row"><label htmlFor="op-grid-r">Divisões: linhas</label><NumField id="op-grid-r" value={grid.rows} decimals={0} onCommit={(v) => setField('grid', { cols: grid.cols, rows: v }, gridFallback)} /></div>
          </>
        ) : null}
        <div className="field-row">
          <label htmlFor="op-glass">Material do vidro</label>
          <select id="op-glass" className="select" value={d.glassMaterialId} onChange={(e) => set({ glassMaterialId: e.target.value })}>
            {Object.values(materials).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field-row"><label htmlFor="op-gt">Espessura do vidro</label><NumField id="op-gt" value={d.glassThickness ?? OPENING_FRAME_DEFAULTS.glass} scale={100} decimals={1} unit="cm" min={0.001} onCommit={(v) => set({ glassThickness: v })} /></div>
      </Secao>

      <Secao title="Planta e corte">
        <div className="field-row">
          <label htmlFor="op-plan">Exibição em planta</label>
          <select id="op-plan" className="select" value={openingPlanDisplay(d)} onChange={(e) => setField('planDisplay', e.target.value, openingPlanDisplay({}))}>
            <option value="symbolic">Simbólica</option>
            <option value="projected">Projetada</option>
          </select>
        </div>
        <div className="field-row"><label htmlFor="op-swing" title="Arco do fecho desenhado na planta">Mostrar arco</label><Check id="op-swing" checked={d.showSwing !== false} onChange={(v) => { const next: OpeningType = { ...d }; if (v) delete next.showSwing; else next.showSwing = false; onChange(next); }} /></div>
        <div className="field-row">
          <label htmlFor="op-swing-style">Estilo do arco</label>
          <select id="op-swing-style" className="select" value={openingSwingStyle(d)} onChange={(e) => setField('swingStyle', e.target.value, openingSwingStyle({}))}>
            <option value="arc">Arco</option>
            <option value="dash">Tracejado</option>
            <option value="line">Linha</option>
          </select>
        </div>
      </Secao>

      <Secao title="Nível de detalhe" highlight>
        <div className="field-row">
          <label htmlFor="op-d2">2D</label>
          <select id="op-d2" className="select" value={detail2d} onChange={(e) => setField('detail2d', e.target.value, detail2dFallback)}>
            <option value="scale">Sensível à escala</option>
            <option value="low">1:50 (baixo)</option>
            <option value="mid">1:100 (médio)</option>
            <option value="high">1:200 (alto)</option>
            <option value="off">Desligado</option>
          </select>
        </div>
        <div className="field-row">
          <label htmlFor="op-d3">3D</label>
          <select id="op-d3" className="select" value={detail3d} onChange={(e) => setField('detail3d', e.target.value, detail3dFallback)}>
            <option value="view">Por vista</option>
            <option value="schematic">Esquemático</option>
            <option value="simple">Simplificado</option>
            <option value="full">Completo</option>
            <option value="off">Desligado</option>
          </select>
        </div>
      </Secao>

      <Secao title="Acabamento" open={false}>
        <div className="field-row"><label htmlFor="ot-ac-fw" title="Folga do vão bruto (furo na parede) em relação à largura do tipo; a esquadria não muda">Folga: largura</label><NumField id="ot-ac-fw" value={d.roughOversize?.w ?? 0} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ roughOversize: { w: v, h: d.roughOversize?.h ?? 0 } })} /></div>
        <div className="field-row"><label htmlFor="ot-ac-fh" title="Folga do vão bruto (furo na parede) em relação à altura do tipo">Folga: altura</label><NumField id="ot-ac-fh" value={d.roughOversize?.h ?? 0} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ roughOversize: { w: d.roughOversize?.w ?? 0, h: v } })} /></div>
        <div className="field-row">
          <label htmlFor="op-clos" title="Substitui o retorno de acabamento definido no tipo de parede">Retorno do vão</label>
          <select id="op-clos" className="select" value={d.closure} onChange={(e) => set({ closure: e.target.value as OpeningType['closure'] })}>
            <option value="inherit">Seguir o tipo de parede</option>
            <option value="none">Sem retorno</option>
            <option value="both">Retorno dos dois lados</option>
            <option value="exterior">Só lado externo</option>
            <option value="interior">Só lado interno</option>
          </select>
        </div>
        <div className="field-row"><label htmlFor="ot-ac-al" title="Alizar em volta do vão, nas duas faces da parede">Alizar</label><Check id="ot-ac-al" checked={cas !== undefined} onChange={(v) => onChange(alternarAcabamento(d, 'casing', v))} /></div>
        {cas ? (
          <>
            <div className="field-row"><label htmlFor="ot-ac-alw">Alizar: largura</label><NumField id="ot-ac-alw" value={cas.width} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ casing: { ...cas, width: v } })} /></div>
            <div className="field-row"><label htmlFor="ot-ac-ale">Alizar: espessura</label><NumField id="ot-ac-ale" value={cas.thickness} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ casing: { ...cas, thickness: v } })} /></div>
          </>
        ) : null}
        {janela ? (
          <>
            <div className="field-row"><label htmlFor="ot-ac-sb" title="Peitoril saliente, só de janela: projeção além de cada face da parede">Soleira saliente</label><Check id="ot-ac-sb" checked={sb !== undefined} onChange={(v) => onChange(alternarAcabamento(d, 'sillBoard', v))} /></div>
            {sb ? (
              <>
                <div className="field-row"><label htmlFor="ot-ac-sbp">Soleira: projeção</label><NumField id="ot-ac-sbp" value={sb.projection} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBoard: { ...sb, projection: v } })} /></div>
                <div className="field-row"><label htmlFor="ot-ac-sbe">Soleira: espessura</label><NumField id="ot-ac-sbe" value={sb.thickness} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBoard: { ...sb, thickness: v } })} /></div>
              </>
            ) : null}
          </>
        ) : null}
        <div className="field-row"><label htmlFor="ot-ac-vg" title="Verga: peça de concreto sobre o vão">Verga</label><Check id="ot-ac-vg" checked={lin !== null} onChange={(v) => onChange(alternarAcabamento(d, 'lintel', v))} /></div>
        {lin ? (
          <>
            <div className="field-row"><label htmlFor="ot-ac-vgo">Verga: transpasse</label><NumField id="ot-ac-vgo" value={lin.over} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ lintel: { ...lin, over: v } })} /></div>
            <div className="field-row"><label htmlFor="ot-ac-vgh">Verga: altura</label><NumField id="ot-ac-vgh" value={lin.height} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ lintel: { ...lin, height: v } })} /></div>
          </>
        ) : null}
        <div className="field-row"><label htmlFor="ot-ac-cv" title="Contraverga: peça de concreto sob o vão">Contraverga</label><Check id="ot-ac-cv" checked={beam !== null} onChange={(v) => onChange(alternarAcabamento(d, 'sillBeam', v))} /></div>
        {beam ? (
          <>
            <div className="field-row"><label htmlFor="ot-ac-cvo">Contrav.: transpasse</label><NumField id="ot-ac-cvo" value={beam.over} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBeam: { ...beam, over: v } })} /></div>
            <div className="field-row"><label htmlFor="ot-ac-cvh">Contrav.: altura</label><NumField id="ot-ac-cvh" value={beam.height} scale={100} decimals={1} unit="cm" onCommit={(v) => set({ sillBeam: { ...beam, height: v } })} /></div>
          </>
        ) : null}
      </Secao>

      <Secao title="Identidade e dados BIM">
        <div className="field-row"><label htmlFor="ot-name">Nome</label><TextField id="ot-name" value={d.name} onCommit={(v) => set({ name: v })} /></div>
        <div className="field-row"><label htmlFor="ot-code">Código</label><TextField id="ot-code" value={d.code ?? ''} onCommit={(v) => setTexto('code', v)} /></div>
        <div className="field-row"><label htmlFor="ot-desc">Descrição</label><TextField id="ot-desc" value={d.description ?? ''} onCommit={(v) => setTexto('description', v)} /></div>
        <div className="field-row"><label htmlFor="op-manuf">Fabricante</label><TextField id="op-manuf" value={d.manufacturer ?? ''} onCommit={(v) => setTexto('manufacturer', v)} /></div>
        {d.kind === 'door' ? (
          <div className="field-row"><label htmlFor="op-fire">Resistência ao fogo</label><TextField id="op-fire" value={d.fireRating ?? ''} onCommit={(v) => setTexto('fireRating', v)} /></div>
        ) : null}
        <div className="field-row"><label htmlFor="op-rw">Rw (dB)</label><NumField id="op-rw" value={d.acousticRw ?? null} decimals={0} onCommit={(v) => set({ acousticRw: v })} onClear={() => limpar('acousticRw')} /></div>
        {janela ? (
          <>
            <div className="field-row"><label htmlFor="op-u">U (W/m²K)</label><NumField id="op-u" value={d.uValue ?? null} decimals={2} onCommit={(v) => set({ uValue: v })} onClear={() => limpar('uValue')} /></div>
            <div className="field-row"><label htmlFor="op-solar">Fator solar</label><NumField id="op-solar" value={d.solarFactor ?? null} decimals={2} onCommit={(v) => set({ solarFactor: v })} onClear={() => limpar('solarFactor')} /></div>
          </>
        ) : null}
        <div className="field-row"><label htmlFor="op-cost">Custo (R$)</label><NumField id="op-cost" value={d.cost ?? null} decimals={2} onCommit={(v) => set({ cost: v })} onClear={() => limpar('cost')} /></div>
        {families.length === 0 ? <p className="hint">Nenhuma família disponível.</p> : null}
      </Secao>
    </div>
  );
}
