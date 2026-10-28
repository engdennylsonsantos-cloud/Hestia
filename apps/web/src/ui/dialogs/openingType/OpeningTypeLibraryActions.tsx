import { useRef, useState, type ReactElement } from 'react';
import {
  duplicateOpeningType,
  exportOpeningTypes,
  importOpeningTypes,
  openingFavorites,
  type ImportOpeningTypesResult,
  type OpeningType,
  type Project,
} from '@hestia/model';
import { editor, useProject } from '../../../editor/controller.ts';
import { saveText } from '../../../editor/saveText.ts';
import { useUi } from '../../../editor/state.ts';

/** Nome do arquivo de tipos de esquadria gerado pela biblioteca. */
const ARQUIVO_TIPOS = 'tipos-esquadrias.hestia-tipos.json';

/** Projeto com o tipo em edição no lugar do gravado: duplicar e exportar levam o que está na tela (o rascunho). */
const comRascunho = (p: Project, t: OpeningType): Project => ({ ...p, openingTypes: { ...p.openingTypes, [t.id]: t } });

const falha = (e: unknown): string => (e instanceof Error ? e.message : 'Falha desconhecida');

/** Frase do resultado da importação, para a barra de status e para o diálogo. */
function resumoDaImportacao(r: ImportOpeningTypesResult): string {
  if (r.imported.length === 0 && r.skipped.length === 0) return 'O arquivo não traz tipos de esquadria.';
  const pulados = r.skipped.length > 0 ? `, ${r.skipped.length} pulado(s)` : '';
  return `${r.imported.length} tipo(s) importado(s)${pulados}.`;
}

const linha = { display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px' } as const;

/**
 * Ações da biblioteca sobre o tipo em edição: duplicar, exportar (o tipo, ou os favoritos) e importar um arquivo.
 * Cada ação grava (ou gera o arquivo) e mostra o resultado na barra de status e logo abaixo dos botões.
 */
export function OpeningTypeLibraryActions({ type }: { type: OpeningType }): ReactElement {
  const p = useProject();
  const entrada = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [resultado, setResultado] = useState<ImportOpeningTypesResult | null>(null);
  const favoritos = openingFavorites(p).filter((id) => p.openingTypes[id]);

  const diz = (texto: string): void => {
    setMsg(texto);
    useUi.setState({ status: texto });
  };

  /** Cópia com nome e código novos; a cópia passa a ser o tipo em edição (como o "Duplicar" do cabeçalho). */
  const duplica = (): void => {
    try {
      const copia = duplicateOpeningType(comRascunho(editor.project, type), type.id);
      editor.store.exec({ type: 'upsertOpeningType', openingType: copia }, 'Duplicar tipo de abertura');
      useUi.setState({ dialogArg: copia.id });
      setResultado(null);
      diz(`Tipo duplicado: ${copia.name}.`);
    } catch (e) {
      diz(falha(e));
    }
  };

  const exporta = async (ids: string[]): Promise<void> => {
    try {
      const arquivo = exportOpeningTypes(comRascunho(editor.project, type), ids);
      diz(await saveText(ARQUIVO_TIPOS, JSON.stringify(arquivo, null, 2) + '\n'));
    } catch (e) {
      diz(falha(e));
    }
  };

  /** Lê o arquivo escolhido e grava os tipos numa só transação (um Desfazer desfaz a importação inteira). */
  const importa = async (arq: File | undefined): Promise<void> => {
    if (!arq) return;
    let dado: unknown;
    try {
      dado = JSON.parse(await arq.text());
    } catch {
      setResultado(null);
      diz('O arquivo não é um JSON válido.');
      return;
    }
    try {
      const r = importOpeningTypes(editor.project, dado);
      if (r.commands.length > 0) editor.store.exec({ type: 'batch', commands: r.commands }, 'Importar tipos de esquadria');
      setResultado(r);
      diz(resumoDaImportacao(r));
    } catch (e) {
      setResultado(null);
      diz(falha(e));
    }
  };

  return (
    <div className="op-lib-actions">
      <div className="op-lib-title">Tipo</div>
      <div style={linha}>
        <button type="button" className="btn small" onClick={duplica}>Duplicar</button>
        <button type="button" className="btn small" onClick={() => void exporta([type.id])}>Exportar…</button>
        {favoritos.length > 0 ? (
          <button type="button" className="btn small" onClick={() => void exporta(favoritos)}>
            Exportar favoritos ({favoritos.length})
          </button>
        ) : null}
        <button type="button" className="btn small" onClick={() => entrada.current?.click()}>Importar…</button>
        <input
          ref={entrada}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void importa(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {msg ? <p role="status" style={{ margin: '2px 8px 6px', fontSize: 11, color: 'var(--fg-soft)' }}>{msg}</p> : null}
      {resultado && resultado.skipped.length > 0 ? (
        <ul aria-label="Tipos pulados na importação" style={{ margin: '0 8px 8px', paddingLeft: 16, fontSize: 11, color: 'var(--fg-soft)' }}>
          {resultado.skipped.map((s, i) => (
            <li key={`${i}-${s.name}`}>
              <b>{s.name}</b>: {s.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
