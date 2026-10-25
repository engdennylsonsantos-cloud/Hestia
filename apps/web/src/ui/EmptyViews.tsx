import type { ReactElement } from 'react';
import { useUi } from '../editor/state.ts';

/** Área de desenho sem vista aberta: instrui a abrir um nível ou o 3D pelo navegador, que pode ser mostrado daqui. */
export function EmptyViews(): ReactElement {
  const browserOpen = useUi((s) => s.browserOpen);
  return (
    <div className="views-empty" role="status">
      <h2>Nenhuma vista aberta</h2>
      <p>Abra um nível ou o Modelo 3D pelo navegador de projeto.</p>
      {!browserOpen && (
        <button className="btn" onClick={() => useUi.setState({ browserOpen: true })}>
          Mostrar navegador de projeto
        </button>
      )}
    </div>
  );
}
