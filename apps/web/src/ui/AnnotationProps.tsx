import type { ReactElement } from 'react';
import { formatDimension, dimensionValue, levelDimensions, levelTexts, type DetailLine, type DetailRegion, type Dimension, type ElementTag, type Id, type Project, type TextNote } from '@hestia/model';
import { editor, useProject } from '../editor/controller.ts';
import { useUi } from '../editor/state.ts';
import { Check, Group, NumField, Row, TextField } from './fields.tsx';

/** Cota ou texto de anotação selecionado (decisão 0019), pelo id no nível ativo; null se a seleção não é uma anotação. */
export function selectedNote(p: Project, levelId: Id, ids: Id[]): { dim?: Dimension; text?: TextNote; line?: DetailLine; region?: DetailRegion; tag?: ElementTag } | null {
  if (ids.length !== 1) return null;
  const dim = levelDimensions(p, levelId).find((d) => d.id === ids[0]);
  if (dim) return { dim };
  const text = levelTexts(p, levelId).find((t) => t.id === ids[0]);
  if (text) return { text };
  const level = p.levels.find((l) => l.id === levelId);
  const line = level?.detailLines?.find((x) => x.id === ids[0]);
  if (line) return { line };
  const region = level?.detailRegions?.find((x) => x.id === ids[0]);
  if (region) return { region };
  const tag = level?.tags?.find((x) => x.id === ids[0]);
  return tag ? { tag } : null;
}

/** Grava a mudança de uma anotação; recusa do modelo vai para a barra de estado. */
function edit(run: () => void): void {
  try {
    run();
  } catch (e) {
    useUi.setState({ status: e instanceof Error ? e.message : 'Não foi possível alterar a anotação.' });
  }
}

/** Propriedades da cota (valor só leitura, deslocamento da linha) e do texto (conteúdo, altura em mm e rotação). */
export function AnnotationProps({ dim, text, line, region, tag }: { dim?: Dimension; text?: TextNote; line?: DetailLine; region?: DetailRegion; tag?: ElementTag }): ReactElement {
  const p = useProject();
  const levelId = useUi((s) => s.levelId);
  if (dim) {
    return (
      <Group title="Cota">
        <Row label="Valor"><span className="val">{formatDimension(dim, dimensionValue(p, dim))}</span></Row>
        <Row label="Texto" htmlFor="p-dtext">
          <TextField id="p-dtext" value={dim.text ?? ''} placeholder={formatDimension(dim, dimensionValue(p, dim))} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { text: v.trim() === '' ? undefined : v } }))} />
        </Row>
        <Row label="Deslocamento" htmlFor="p-doff">
          <NumField id="p-doff" value={dim.offset} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { offset: v } }))} quantity="length" />
        </Row>
        <Row label="Direção"><select className="select" value={dim.mode ?? 'aligned'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { mode: e.target.value as Dimension['mode'] } }))}><option value="aligned">Alinhada</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></Row>
        <Row label="Unidade"><select className="select" value={dim.unit ?? 'm'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { unit: e.target.value as Dimension['unit'] } }))}><option value="m">Metros</option><option value="cm">Centímetros</option><option value="mm">Milímetros</option></select></Row>
        <Row label="Casas decimais"><select className="select" value={dim.precision ?? 2} onChange={(e) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { precision: Number(e.target.value) as 0 | 1 | 2 | 3 } }))}><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></Row>
        <Row label="Prefixo" htmlFor="p-dprefix"><TextField id="p-dprefix" value={dim.prefix ?? ''} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { prefix: v } }))} /></Row>
        <Row label="Sufixo" htmlFor="p-dsuffix"><TextField id="p-dsuffix" value={dim.suffix ?? ''} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { suffix: v } }))} /></Row>
        <Row label="Altura do texto" htmlFor="p-dheight"><NumField id="p-dheight" value={(dim.textHeight ?? 2.5) / 1000} quantity="smallLength" min={0.0005} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { textHeight: v } }))} /></Row>
        <Row label="Marca"><select className="select" value={dim.tickStyle ?? 'slash'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateDimension', levelId, id: dim.id, patch: { tickStyle: e.target.value as Dimension['tickStyle'] } }))}><option value="slash">Traço</option><option value="arrow">Seta</option><option value="dot">Ponto</option></select></Row>
        <div className="prow"><span className="soft">Acompanha a parede quando a extremidade está presa a uma parede. Texto vazio mostra o valor medido.</span></div>
      </Group>
    );
  }
  if (line) return <Group title="Linha de detalhe"><Row label="Traço"><select className="select" value={line.style ?? 'solid'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateDetailLine', levelId, id: line.id, patch: { style: e.target.value as DetailLine['style'] } }))}><option value="solid">Contínuo</option><option value="dashed">Tracejado</option><option value="dotted">Pontilhado</option></select></Row></Group>;
  if (region) return <Group title="Região de detalhe"><Row label="Preenchimento"><input className="input" type="color" value={region.color ?? '#f5d782'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateDetailRegion', levelId, id: region.id, patch: { color: e.target.value, mask: false } }))} /></Row><Check id="p-region-mask" checked={region.mask === true} onChange={(v) => edit(() => editor.store.exec({ type: 'updateDetailRegion', levelId, id: region.id, patch: { mask: v } }))}>Mascarar elementos</Check></Group>;
  if (tag) return <Group title="Etiqueta"><Row label="Informação"><select className="select" value={tag.property} onChange={(e) => edit(() => editor.store.exec({ type: 'updateTag', levelId, id: tag.id, patch: { property: e.target.value as ElementTag['property'] } }))}><option value="type">Tipo</option><option value="name">Nome</option><option value="mark">Marca</option><option value="level">Nível</option><option value="width">Largura</option><option value="height">Altura</option></select></Row><Row label="Orientação"><select className="select" value={tag.orientation ?? 'horizontal'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateTag', levelId, id: tag.id, patch: { orientation: e.target.value as ElementTag['orientation'] } }))}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></Row><Check id="p-tag-leader" checked={tag.leader === true} onChange={(v) => edit(() => editor.store.exec({ type: 'updateTag', levelId, id: tag.id, patch: { leader: v } }))}>Mostrar líder</Check></Group>;
  if (!text) return <></>;
  return (
    <Group title="Texto">
      <Row label="Texto" htmlFor="p-ttext">
        <TextField id="p-ttext" value={text.text} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { text: v } }))} />
      </Row>
      <Row label="Altura" htmlFor="p-theight">
        <NumField id="p-theight" value={text.height / 1000} quantity="smallLength" min={0.0005} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { height: v } }))} />
      </Row>
      <Row label="Rotação" htmlFor="p-trot">
        <NumField id="p-trot" value={(text.rotation * Math.PI) / 180} quantity="angle" onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { rotation: (v * 180) / Math.PI } }))} />
      </Row>
      <Row label="Largura" htmlFor="p-twidth"><NumField id="p-twidth" value={(text.width ?? 0) / 1000} quantity="smallLength" min={0} onCommit={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { width: v ? v * 1000 : undefined } }))} /></Row>
      <Row label="Alinhamento"><select className="select" value={text.align ?? 'left'} onChange={(e) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { align: e.target.value as TextNote['align'] } }))}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></Row>
      <Check id="p-tbold" checked={text.bold === true} onChange={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { bold: v } }))}>Negrito</Check>
      <Check id="p-titalic" checked={text.italic === true} onChange={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { italic: v } }))}>Itálico</Check>
      <Check id="p-tunderline" checked={text.underline === true} onChange={(v) => edit(() => editor.store.exec({ type: 'updateText', levelId, id: text.id, patch: { underline: v } }))}>Sublinhado</Check>
    </Group>
  );
}
