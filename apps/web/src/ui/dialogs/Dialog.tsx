import { useEffect, type ReactElement, type ReactNode } from 'react';
import { Icon } from '../Icon.tsx';

export function Dialog({ title, sub, onClose, children, footer, size = '', z }: { title: string; sub?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: '' | 'narrow' | 'mid'; z?: number }): ReactElement {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="overlay" style={z ? { zIndex: z } : undefined} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dhead">
          <h2>{title}</h2>
          {sub ? <span className="sub">{sub}</span> : null}
          <span style={{ flex: 1 }} />
          <button className="ibtn" onClick={onClose} aria-label="Fechar"><Icon name="close" size={16} /></button>
        </div>
        <div className="dbody">{children}</div>
        {footer ? <div className="dfoot">{footer}</div> : null}
      </div>
    </div>
  );
}
