import { useState, type ReactElement } from 'react';
import type { AutoCotaOptions, LadoCota, ReferenciaParede } from '@hestia/engine';
import { editor } from '../../editor/controller.ts';
import { useUi } from '../../editor/state.ts';
import { Check, NumField, Row } from '../fields.tsx';
import { Dialog } from './Dialog.tsx';

/** Critérios das cotas automáticas, no modelo do ArquiFácil: o que cotar, por onde medir e em quais lados. */
export function AutoCotaDialog(): ReactElement {
  const [geral, setGeral] = useState(true);
  const [geometria, setGeometria] = useState(true);
  const [paredes, setParedes] = useState(true);
  const [aberturas, setAberturas] = useState(true);
  const [modo, setModo] = useState<'arestas' | 'centro'>('arestas');
  const [referencia, setReferencia] = useState<ReferenciaParede>('externa');
  const [lados, setLados] = useState<'todos' | LadoCota>('todos');
  const [somenteExternas, setSomenteExternas] = useState(true);
  const [offset, setOffset] = useState(0.6);
  const [espacamento, setEspacamento] = useState(0.45);
  const close = (): void => useUi.setState({ dialog: null, dialogArg: null });
  const gerar = (): void => {
    const opts: AutoCotaOptions = {
      lados,
      geral,
      geometria,
      paredes,
      aberturas,
      modoAberturas: modo,
      referencia,
      somenteExternas,
      offset,
      espacamento,
    };
    editor.cotasAutomaticasDaPlanta(opts);
    close();
  };
  return (
    <Dialog
      title="Cotas automáticas"
      sub="Escolha o que cotar e por onde medir"
      onClose={close}
      size="narrow"
      footer={
        <>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={gerar}>Gerar cotas</button>
        </>
      }
    >
      <h3 style={{ fontSize: 12, margin: '4px 0 6px' }}>O que cotar</h3>
      <div style={{ display: 'grid', gap: 4, marginBottom: 10 }}>
        <Check id="ac-geral" checked={geral} onChange={setGeral}>Total do lado (cotagem geral)</Check>
        <Check id="ac-geometria" checked={geometria} onChange={setGeometria}>Contorno exterior (degraus da fachada)</Check>
        <Check id="ac-paredes" checked={paredes} onChange={setParedes}>Paredes e estruturas (espessuras e vãos)</Check>
        <Check id="ac-aberturas" checked={aberturas} onChange={setAberturas}>Aberturas (portas e janelas)</Check>
      </div>

      <Row label="Aberturas por" htmlFor="ac-modo">
        <select id="ac-modo" className="select" value={modo} onChange={(e) => setModo(e.target.value as 'arestas' | 'centro')} disabled={!aberturas}>
          <option value="arestas">Arestas do vão</option>
          <option value="centro">Centro da abertura</option>
        </select>
      </Row>

      <h3 style={{ fontSize: 12, margin: '12px 0 6px' }}>Referência da parede</h3>
      <Row label="Medir pelas" htmlFor="ac-referencia">
        <select id="ac-referencia" className="select" value={referencia} onChange={(e) => setReferencia(e.target.value as ReferenciaParede)}>
          <option value="externa">Faces externas</option>
          <option value="nucleo">Faces do núcleo</option>
          <option value="eixo">Eixos das paredes</option>
        </select>
      </Row>

      <h3 style={{ fontSize: 12, margin: '12px 0 6px' }}>Lados e afastamento</h3>
      <Row label="Cotar" htmlFor="ac-lados">
        <select id="ac-lados" className="select" value={lados} onChange={(e) => setLados(e.target.value as 'todos' | LadoCota)}>
          <option value="todos">Os quatro lados</option>
          <option value="sul">Só o lado sul</option>
          <option value="norte">Só o lado norte</option>
          <option value="oeste">Só o lado oeste</option>
          <option value="leste">Só o lado leste</option>
        </select>
      </Row>
      <Row label="Afastamento inicial" htmlFor="ac-offset">
        <NumField id="ac-offset" value={offset} min={0.1} unit="m" onCommit={setOffset} />
      </Row>
      <Row label="Entre camadas" htmlFor="ac-espaco">
        <NumField id="ac-espaco" value={espacamento} min={0.1} unit="m" onCommit={setEspacamento} />
      </Row>
      <div style={{ marginTop: 6 }}>
        <Check id="ac-externas" checked={somenteExternas} onChange={setSomenteExternas}>Apenas o contorno externo (ignorar divisórias internas)</Check>
      </div>

      <p className="hint" style={{ marginTop: 10 }}>
        Um lado só é cotado quando tem parede paralela a ele: sem parede vertical não nascem cotas verticais. As aberturas
        entram apenas no lado da parede que as hospeda.
      </p>
    </Dialog>
  );
}
