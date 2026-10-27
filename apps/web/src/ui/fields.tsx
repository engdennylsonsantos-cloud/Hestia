import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { parseNumber } from '@hestia/tools';
import { safeGet, safeSet } from '../editor/storage.ts';

const fmt = (v: number, decimals: number): string => v.toFixed(decimals).replace('.', ',');

interface NumProps {
  id?: string;
  value: number | null;
  onCommit: (v: number) => void;
  decimals?: number;
  unit?: string;
  /** Multiplicador de exibição (ex.: 100 para metros → cm). */
  scale?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  mixed?: boolean;
  width?: number;
  readOnly?: boolean;
  /** Texto mostrado quando o campo está vazio (ex.: o valor herdado do tipo). */
  placeholder?: string;
  /** Campo vazio confirmado: o valor volta a "nenhum" (null). Sem ele, campo vazio não grava nada. */
  onClear?: () => void;
  /** Texto que não vira número: o campo volta ao valor anterior e este aviso é chamado (sem ele, a volta é silenciosa). */
  onInvalid?: () => void;
}

/** Campo numérico que aceita expressões (`3,50+0,15`); confirma com Enter ou ao sair. */
export function NumField({ id, value, onCommit, decimals = 2, unit, scale = 1, min, max, disabled, mixed, width, readOnly, placeholder, onClear, onInvalid }: NumProps): ReactElement {
  const show = (v: number | null): string => (v === null || mixed ? '' : fmt(v * scale, decimals));
  const [text, setText] = useState(show(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(show(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focus, mixed, scale, decimals]);
  const commit = (): void => {
    if (onClear && text.trim() === '') {
      if (text !== show(value)) onClear();
      return;
    }
    const n = parseNumber(text);
    if (n === null) {
      setText(show(value));
      onInvalid?.();
      return;
    }
    let v = n / scale;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (value === null || Math.abs(v - value) > 1e-9 || mixed) onCommit(v);
    setText(fmt(v * scale, decimals));
  };
  return (
    <span className="numwrap">
      <input
        id={id}
        className={`input num${readOnly ? ' ro' : ''}${mixed ? ' mixed' : ''}`}
        style={width ? { width } : undefined}
        value={text}
        placeholder={mixed ? 'variados' : placeholder ?? ''}
        disabled={disabled}
        readOnly={readOnly}
        inputMode="decimal"
        onFocus={(e) => {
          setFocus(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocus(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(show(value));
            (e.target as HTMLInputElement).blur();
          }
          e.stopPropagation();
        }}
      />
      {unit ? <span className="unit">{unit}</span> : null}
    </span>
  );
}

export function TextField({ id, value, onCommit, placeholder, mixed, disabled }: { id?: string; value: string; onCommit: (v: string) => void; placeholder?: string; mixed?: boolean; disabled?: boolean }): ReactElement {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      id={id}
      className={`input wide${mixed ? ' mixed' : ''}`}
      value={mixed ? '' : text}
      placeholder={mixed ? 'variados' : placeholder}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text !== value && onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        e.stopPropagation();
      }}
    />
  );
}

export function Check({ id, checked, onChange, children, disabled, mixed }: { id?: string; checked: boolean; onChange: (v: boolean) => void; children?: ReactNode; disabled?: boolean; mixed?: boolean }): ReactElement {
  return (
    <label className="check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = !!mixed;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
      {children}
    </label>
  );
}

export function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }): ReactElement {
  return (
    <div className="prow">
      <label htmlFor={htmlFor} title={label}>
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

/**
 * Grupo de propriedades da paleta (Restrições, Dimensões, Identidade...). O aberto/fechado fica guardado no navegador
 * pelo título: o grupo fechado continua fechado ao trocar de seleção, que é o que mantém a paleta compacta (padrão do
 * Revit). O título é a chave, então grupos de mesmo nome em painéis diferentes compartilham o estado.
 */
export function Group({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }): ReactElement {
  const key = `pgroup:${title}`;
  const [isOpen, setOpen] = useState<boolean>(() => {
    const saved = safeGet(key);
    return saved === null ? open : saved === '1';
  });
  return (
    <details
      className="pgroup"
      open={isOpen}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        setOpen(next);
        safeSet(key, next ? '1' : '0');
      }}
    >
      <summary>{title}</summary>
      {children}
    </details>
  );
}
