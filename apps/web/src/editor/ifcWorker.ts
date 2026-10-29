import { importIfc, type ImportResult } from '@hestia/io';

/**
 * Importador IFC fora da thread principal (ver `importIfcText` em `ifcImport.ts`): um arquivo de 25 MB leva
 * segundos no `importIfc`, e na janela isso congela a interface. Aqui o mesmo importador roda no worker e o
 * resultado volta por `postMessage` (o projeto é dado simples — Record, array e número —, então sobrevive ao
 * structured clone). Erros viram `{ error }` para a janela mostrar a mensagem em vez de morrer sem resposta.
 */

/** O que a janela manda: o texto do arquivo já lido do disco. */
interface Pedido {
  text: string;
}

/** O que o worker devolve: o mesmo par do `importIfc` ou a mensagem do erro. */
type Resposta = ImportResult | { error: string };

/** Só as duas operações que o worker usa; o cast evita trazer a lib `webworker` (que conflita com a `DOM`). */
const escopo = self as unknown as {
  onmessage: ((evento: MessageEvent<Pedido>) => void) | null;
  postMessage: (mensagem: Resposta) => void;
};

escopo.onmessage = (evento) => {
  try {
    escopo.postMessage(importIfc(evento.data.text));
  } catch (erro) {
    escopo.postMessage({ error: erro instanceof Error ? erro.message : String(erro) });
  }
};
