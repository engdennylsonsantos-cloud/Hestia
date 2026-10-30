import { useState, type ReactElement } from 'react';
import { parseDxfText, type DxfImportResult } from '@hestia/io';
import type { CadUnit } from '@hestia/model';
import { editor, useProject } from '../../editor/controller.ts';
import { importCadFile } from '../../editor/cadImport.ts';
import { useUi } from '../../editor/state.ts';
import { Dialog } from './Dialog.tsx';

/** Unidades do DXF, com o rótulo do seletor. */
const UNITS: ReadonlyArray<{ value: CadUnit; label: string }> = [
  { value: 'mm', label: 'Milímetros (mm)' },
  { value: 'cm', label: 'Centímetros (cm)' },
  { value: 'm', label: 'Metros (m)' },
  { value: 'ft', label: 'Pés (ft)' },
  { value: 'in', label: 'Polegadas (in)' },
];

/** Número digitado; vírgula vira ponto; vazio/inválido cai no padrão. */
const num = (text: string, fallback: number): number => {
  const v = Number(text.replace(',', '.'));
  return Number.isFinite(v) ? v : fallback;
};

const semExtensao = (name: string): string => name.replace(/\.dxf$/i, '');

/**
 * Diálogo "Importar CAD (DXF)": escolhe o arquivo, mostra o resumo (camadas, traços, textos, unidade detectada e avisos) e
 * insere no nível com ponto, rotação e escala. O desenho entra como um objeto só (`CadDrawing`), com as camadas do arquivo;
 * a unidade padrão é a detectada no `$INSUNITS`, e o usuário pode trocar.
 */
export function ImportCadDialog(): ReactElement {
  const p = useProject();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DxfImportResult | null>(null);
  const [levelId, setLevelId] = useState(() => useUi.getState().levelId);
  const [unit, setUnit] = useState<CadUnit>('m');
  const [x, setX] = useState('0');
  const [y, setY] = useState('0');
  const [rotation, setRotation] = useState('0');
  const [scale, setScale] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = (): void => useUi.setState({ dialog: null });

  const choose = async (f: File | undefined): Promise<void> => {
    if (!f) return;
    setFile(f);
    setError(null);
    setPreview(null);
    try {
      const r = parseDxfText(await f.text(), semExtensao(f.name));
      setPreview(r);
      setUnit(r.unit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ler o DXF.');
    }
  };

  const doImport = async (): Promise<void> => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const cad = await importCadFile(file, {
        levelId,
        unit,
        at: { x: num(x, 0), y: num(y, 0) },
        rotation: num(rotation, 0),
        scale: num(scale, 1),
        name: semExtensao(file.name),
      });
      editor.store.exec({ type: 'addCadDrawing', cad }, 'Inserir CAD');
      useUi.setState({ dialog: null, status: `CAD importado: ${cad.name}` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível importar o DXF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Importar CAD (DXF)"
      sub="O desenho entra como um objeto só, com as camadas do arquivo"
      onClose={close}
      size="mid"
      footer={
        <>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={() => void doImport()} disabled={!file || busy}>
            {busy ? 'Importando…' : 'Importar'}
          </button>
        </>
      }
    >
      <label className="fm-field" style={{ display: 'block', marginBottom: 10 }}>
        Arquivo DXF
        <input
          type="file"
          accept=".dxf"
          aria-label="Arquivo DXF"
          onChange={(e) => void choose(e.target.files?.[0])}
          style={{ marginLeft: 8 }}
        />
      </label>

      {preview ? (
        <p role="status" style={{ margin: '0 0 10px', opacity: 0.8 }}>
          <b>{preview.name}</b> — {preview.layers.length} camada(s), {preview.paths.length} traço(s), {preview.texts.length} texto(s).
          Unidade detectada: <b>{preview.unit}</b>.
          {preview.warnings.length > 0 && (
            <>
              <br />
              Avisos: {preview.warnings.slice(0, 4).join(' · ')}
              {preview.warnings.length > 4 ? ` · +${preview.warnings.length - 4}` : ''}
            </>
          )}
        </p>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 10px', alignItems: 'center' }}>
        <label htmlFor="cad-level">Nível</label>
        <select id="cad-level" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          {p.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>

        <label htmlFor="cad-unit">Unidade</label>
        <select id="cad-unit" value={unit} onChange={(e) => setUnit(e.target.value as CadUnit)}>
          {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>

        <label htmlFor="cad-x">Inserção X, Y (m)</label>
        <span style={{ display: 'flex', gap: 6 }}>
          <input id="cad-x" className="input" value={x} onChange={(e) => setX(e.target.value)} style={{ width: 90 }} />
          <input aria-label="Inserção Y" className="input" value={y} onChange={(e) => setY(e.target.value)} style={{ width: 90 }} />
        </span>

        <label htmlFor="cad-rot">Rotação (°)</label>
        <input id="cad-rot" className="input" value={rotation} onChange={(e) => setRotation(e.target.value)} style={{ width: 90 }} />

        <label htmlFor="cad-scale">Escala</label>
        <input id="cad-scale" className="input" value={scale} onChange={(e) => setScale(e.target.value)} style={{ width: 90 }} />
      </div>

      {error ? <p role="alert" style={{ color: '#b91c1c', marginTop: 10 }}>{error}</p> : null}
    </Dialog>
  );
}
