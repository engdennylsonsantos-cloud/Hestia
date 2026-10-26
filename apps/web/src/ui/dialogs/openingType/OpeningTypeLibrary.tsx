import type { ReactElement } from 'react';
import type { OpeningFamily } from '@hestia/model';
import type { OpeningVariant } from '../openingTypeForm.ts';

interface OpeningTypeLibraryProps {
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
 * A miniatura desenhada de cada variante fica reservada em `.th` (parte B).
 */
export function OpeningTypeLibrary({
  families,
  familyId,
  counts,
  variants,
  open,
  onToggle,
  onFamily,
  onVariant,
}: OpeningTypeLibraryProps): ReactElement {
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
                <span className="th" aria-hidden="true" />
                <span className="op-variant-name">{v.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
