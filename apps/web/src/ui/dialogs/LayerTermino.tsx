import { useState, type ReactElement } from 'react';
import { terminoOf, type Layer } from '@hestia/model';
import { TERMINO_OPCOES, formDoTermino, terminoDoForm, type TerminoKind } from './terminoForm.ts';

interface LayerTerminoProps {
  /** Prefixo de id estável da linha, ex.: `ft-layer-0`. */
  id: string;
  layer: Layer;
  onChange: (next: Layer) => void;
}

const AJUDA = 'Vale para pisos e lajes vinculados às paredes. Deslocamento: positivo avança sobre a parede, negativo recua, a partir da face de acabamento.';

/** Linha "Término na junção" da seção avançada da camada de piso ou de laje (decisão 0023 §2, P8). */
export function LayerTermino({ id, layer, onChange }: LayerTerminoProps): ReactElement {
  const shown = formDoTermino(terminoOf(layer));
  const [kind, setKind] = useState<TerminoKind>(shown.kind);
  const [cmText, setCmText] = useState(shown.cmText);
  const [erro, setErro] = useState<string | null>(null);
  const [seen, setSeen] = useState(JSON.stringify(shown));
  // Sincroniza quando a camada muda por fora (desfazer, troca de tipo).
  if (seen !== JSON.stringify(shown)) {
    setSeen(JSON.stringify(shown));
    setKind(shown.kind);
    setCmText(shown.cmText);
    setErro(null);
  }

  const apply = (k: TerminoKind, text: string): void => {
    const r = terminoDoForm(k, text);
    if ('erro' in r) {
      setErro(r.erro);
      return;
    }
    setErro(null);
    const next: Layer = { ...layer };
    if (r.termino === undefined) delete next.termino;
    else next.termino = r.termino;
    if (JSON.stringify(next.termino) === JSON.stringify(layer.termino)) return;
    onChange(next);
  };

  return (
    <div className="adv-panel">
      <div className="adv-row">
        <label htmlFor={`${id}-termino`}>Término na junção</label>
        <span className="adv-ctl">
          <select
            id={`${id}-termino`}
            className="input"
            value={kind}
            onChange={(e) => {
              const k = e.target.value as TerminoKind;
              setKind(k);
              apply(k, cmText);
            }}
          >
            {TERMINO_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {kind === 'cm' && (
            <input
              id={`${id}-termino-cm`}
              className="input num"
              inputMode="decimal"
              aria-label="Deslocamento em centímetros"
              aria-invalid={erro !== null}
              aria-describedby={`${id}-termino-help`}
              value={cmText}
              onChange={(e) => setCmText(e.target.value)}
              onBlur={() => apply('cm', cmText)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                e.stopPropagation();
              }}
            />
          )}
        </span>
      </div>
      <p id={`${id}-termino-help`} className="adv-help">{erro ?? AJUDA}</p>
    </div>
  );
}
