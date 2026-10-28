import { useDeferredValue, type ReactElement } from 'react';
import type { OpeningFamily, OpeningType } from '@hestia/model';
import { applyVariant, type OpeningVariant } from '../openingTypeForm.ts';
import { OpeningTypeLibraryActions } from './OpeningTypeLibraryActions.tsx';
import { OpeningTypeThumb } from './OpeningTypeThumb.tsx';

interface OpeningTypeLibraryProps {
  /** Tipo em edição: a miniatura de cada variante é a elevação dele com a variante aplicada. */
  type: OpeningType;
  families: readonly OpeningFamily[];
  familyId: string | null;
  /** Quantidade de tipos do projeto em cada família. */
  counts: Readonly<Record<string, number>>;
  variants: readonly OpeningVariant[];
  open: boolean;
  onToggle: () => void;
  onFamily: (id: string) => void;
  onVariant: (variant: OpeningVariant) => void;
}

/**
 * Coluna da biblioteca: árvore das famílias da categoria (com a contagem de tipos do projeto) e grade de variantes.
 * A miniatura de cada variante é a elevação do tipo pelo mesmo caminho da prévia (projeto mínimo + seção).
 */
export function OpeningTypeLibrary({
  type,
  families,
  familyId,
  counts,
  variants,
  open,
  onToggle,
  onFamily,
  onVariant,
}: OpeningTypeLibraryProps): ReactElement {
  // Miniaturas adiadas: a lista acompanha a edição sem refazer a elevação a cada tecla.
  const previewType = useDeferredValue(type);
  return (
    <aside className="op-lib" aria-label="Biblioteca de tipos" data-collapsed={open ? undefined : 'true'}>
      <div className="op-lib-head">
        <span>{open ? 'Biblioteca' : ''}</span>
        <button
          type="button"
          className="btn small op-lib-toggle"
          aria-label={open ? 'Recolher biblioteca' : 'Expandir biblioteca'}
          title={open ? 'Recolher biblioteca' : 'Expandir biblioteca'}
          onClick={onToggle}
        >
          {open ? '«' : '»'}
        </button>
      </div>
      {open ? (
        <div className="op-lib-body">
          <OpeningTypeLibraryActions type={type} />
          <div className="op-lib-title">Famílias</div>
          <nav className="op-lib-tree" aria-label="Famílias">
            {families.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`op-fam${f.id === familyId ? ' on' : ''}`}
                aria-pressed={f.id === familyId}
                onClick={() => onFamily(f.id)}
              >
                <span className="op-fam-name">{f.name}</span>
                <span className="op-count" title={`${counts[f.id] ?? 0} tipo(s) no projeto`}>{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </nav>
          <div className="op-lib-title">Variantes</div>
          <div className="op-variants">
            {variants.map((v) => (
              <button key={v.id} type="button" className="op-variant" title={v.name} onClick={() => onVariant(v)}>
                <span className="th" aria-hidden="true">
                  <OpeningTypeThumb type={applyVariant(previewType, v)} width={96} height={48} />
                </span>
                <span className="op-variant-name">{v.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
