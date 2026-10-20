import { afterEach } from 'vitest';

/**
 * Cede o event loop depois de cada teste, em todos os arquivos (I-1b).
 *
 * Os testes de geometria são síncronos e levam de 1 a dezenas de segundos. Entre eles o runner só passa
 * microtasks, então a resposta do vitest ao `onTaskUpdate` fica na fila do worker. Se o worker passa de 60 s
 * sem processá-la, o birpc dá `Timeout calling "onTaskUpdate"` e o run sai 1 sem falha de asserção. Um yield
 * macrotask por teste zera o acúmulo entre testes; um único teste síncrono de mais de 60 s ainda estoura.
 */
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
