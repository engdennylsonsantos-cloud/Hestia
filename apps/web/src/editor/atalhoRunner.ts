import type { ComandoAtalho, MapaAtalhos } from '@hestia/tools';
import { useAtalhos } from './shortcutConfig.ts';
import { CasadorAtalhos, TEMPO_SEQUENCIA_MS } from './shortcuts.ts';
import { useUi } from './state.ts';

/** Sequência de atalho em andamento na tela: o casador, o aviso na barra de status e o tempo limite. */
export class SequenciaAtalhos {
  private casador: CasadorAtalhos | null = null;
  private casadorMapa: MapaAtalhos | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Processa uma tecla. Devolve o comando a executar, 'espera' se a sequência continua, ou null se a tecla não é de atalho. */
  tecla(k: string): { comando: ComandoAtalho } | 'espera' | null {
    const mapa = useAtalhos.getState().atalhos;
    if (!this.casador || mapa !== this.casadorMapa) {
      this.casador = new CasadorAtalhos(mapa);
      this.casadorMapa = mapa;
    }
    const r = this.casador.tecla(k);
    clearTimeout(this.timer);
    if (r.tipo === 'espera') {
      useUi.setState({ atalhoBuffer: r.buffer });
      // Sem a segunda tecla no tempo limite, a sequência pela metade é descartada.
      this.timer = setTimeout(() => this.reset(), TEMPO_SEQUENCIA_MS);
      return 'espera';
    }
    if (useUi.getState().atalhoBuffer) useUi.setState({ atalhoBuffer: '' });
    return r.tipo === 'executa' ? { comando: r.comando } : null;
  }

  /** Descarta a sequência em andamento e o aviso na barra de status. */
  reset(): void {
    this.casador?.limpa();
    clearTimeout(this.timer);
    if (useUi.getState().atalhoBuffer) useUi.setState({ atalhoBuffer: '' });
  }
}
