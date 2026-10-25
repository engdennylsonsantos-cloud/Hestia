# Ordem de implementação: desempenho e GPU

Documento de trabalho para não perder o fio. Atualize o status a cada entrega.
Base: `feat/revit-ui-theme`, HEAD `3951b5a` (com as ondas 3, 4 e 5 integradas).

## Objetivo

Abrir projeto, abrir vistas, selecionar, editar parede, porta, janela e demais elementos, e navegar em projetos grandes (predio), com o mínimo de travamento. Mover para a GPU tudo o que for recorrente e visual. O cálculo exato de topologia (junções, cortes e geometria exata) fica na CPU, fora da thread principal.

## Critérios para passar algo para a GPU

- Roda a cada quadro ou a cada zoom (custo recorrente).
- Os dados são reutilizados sem mudar (podem ficar na GPU).
- O resultado visual é o mesmo, sem risco de exatidão de modelo.

## Metas (projeto de 20 pavimentos, navegador)

- Primeiro quadro da abertura: até 300 ms.
- Resposta visual de edição: até 50 ms (a geometria exata pode chegar depois).
- Pan, zoom e seleção: dentro de um quadro de 16 ms.

## Estado atual (medido no navegador, 20 pavimentos, mediana)

| Medida | Antes (f67e2f0) | Onda 5 (898be46) |
|---|---|---|
| Abrir projeto | 1.681 ms | 1.073 ms |
| Planta do nível do meio | 75 ms | 68 ms |
| Seleção | 33 ms | 22 ms |
| Editar parede | 236 ms | 46 ms |
| Pan / zoom | 22 / 23 ms | 21 / 17 ms |
| Clique 3D | 51 ms | 29 ms |

Porta, janela e parede nova: **ainda não medidos** (o build de produção falhou com "Acesso negado" do esbuild; ver pendências).

## Etapa 0: entregas em andamento (onda 6, retomada)

Status em 2026-10-25:

- [x] Cache de geometria por projeto (`apps/web/src/editor/geometryCache.ts`), integrado, **não ligado no controller** ainda.
- [x] Abertura da planta sem cortadores de todos os níveis (`packages/render/src/plan/viewContext.ts`), integrada. Limites conhecidos: telhado anexado (em correção), 3D ainda com o projeto inteiro (em correção).
- [ ] Fluxo de edição com resposta provisória e recálculo por nível (Sonnet, em andamento). Contrato em `apps/web/src/editor/fluxoEdicao.ts` e `packages/engine/src/fluxoPatch.ts`.
- [ ] Telhado anexado sem o projeto inteiro (Haiku, em andamento).
- [ ] 3D usando a junção reduzida da planta (Haiku, em andamento).
- [ ] Linha da planta com espessura no shader (Haiku, em andamento).

## Etapa G1: desenho recorrente na GPU

1. **Espessura de traço no shader** (em andamento): o zoom muda só o uniform, sem reconstruir a geometria da planta.
2. **Hachura como shader de padrão:** a região é preenchida no fragment shader, em coordenadas do mundo. Some a geração de milhares de linhas na CPU.
3. **Seleção e cursor como camada de sobreposição com shader:** nenhum nível é reconstruído ao selecionar.

Critério de saída: zoom e seleção sem reconstruir geometria (provado por teste de contagem de buffers); imagem igual à de antes.

## Etapa G2: paredes e elementos como instâncias

1. **Parede como quad parametrizado:** início, fim, espessura e altura são atributos; o vertex shader expande o quad. Sem malha criada na CPU para cada parede, na planta e na 3D.
2. **Portas, janelas e mobília como instâncias:** uma malha e muitas transformações. Reduz draw calls e memória.
3. A CPU entrega só os parâmetros e os cortes resultantes da junção.

Critério de saída: draw calls e malhas caem por ordem de grandeza em 20 pavimentos; edição de parede sem recriar malhas dos outros elementos.

## Etapa G3: corte e elevação por recorte na GPU

1. Corte e elevação viram plano de recorte (clipping plane) na GPU, em vez de geometria de corte gerada na CPU.
2. Mantém a mesma imagem de corte (testada por comparação de imagem).

Critério de saída: abrir uma vista de corte sem gerar geometria nova na CPU.

## Etapa G4: cálculo na GPU (só após validação)

1. WebGPU com compute shaders para triangulação de lajes e pisos e para a expansão de geometria.
2. **Junção e topologia de paredes não entram aqui** sem prova de exatidão: o resultado precisa ser idêntico ao da CPU em qualquer placa.
3. Caminho de fallback em WebGL2 obrigatório.

Critério de saída: resultado idêntico ao da CPU, e ganho medido no navegador. Se não houver ganho, não entra.

## O que fica na CPU, fora da thread principal

- Junção, corte e topologia exata das paredes (Worker, com fallback em fatias).
- Persistência e geração do cache de geometria.
- Cálculo de avisos e validações (já adiado para depois do primeiro quadro).

## Pendências técnicas

- **Build de produção:** `vite build` falha com "[vite:esbuild-transpile] remove ... esbuild-*: Acesso negado" em alguns ambientes. Bloqueia a medição de porta, janela e parede nova no navegador. Investigar antivírus ou processo que trava o temporário do esbuild.
- **Cache de geometria não ligado:** falta o caminho assíncrono no controller.
- **Medição das ações no navegador:** `tests/e2e/perf-acoes.mjs` pronto, nunca rodou.
- **Premissa da faixa de elementos (abertura):** a redução depende de as peças de um nível ficarem dentro da faixa dos elementos dele. Coberta por 62 quadros de teste; um caso novo pode quebrar a igualdade.
- **Hash do cache:** o hash atual lê o JSON do projeto inteiro a cada edição; trocar pela versão do projeto ou por hash incremental do nível.

## Regras de trabalho

- Cada entrega com teste de igualdade contra o cálculo direto.
- Medição antes e depois com método declarado.
- Não fazer push sem autorização explícita.
- Nenhum arquivo acima de ~400 linhas.

## Plano em 8 etapas (2026-10-25)

Cada etapa só entra com medição antes e depois. Etapas 2 a 6 podem rodar em paralelo quando mexem em arquivos diferentes.

- **Etapa 0: destravar a medição.** Build de produção funcionou em 2026-10-25 com a máquina sem carga. Medição de referência: `scripts/perf-baselines/browser-20-pav-2026-10-25-etapa0.json` (porta, janela e parede nova já incluídos em `perf-browser.mjs`). `tests/e2e/perf-acoes.mjs` não grava resultado e deve ser removido ou concluído.
- **Etapa 1: chave do cache de cortadores (engine).** Corrigir a identidade do projeto reduzido em `junctionNet.ts`. Libera a 3D com junção reduzida (hoje 20% mais lenta) e a abertura com todos os níveis.
- **Etapa 2: zoom sem reconstruir (planta).** Tirar o zoom das chaves do quadro (`planFrame.ts`, `grid.ts`) e tornar o nível de detalhe por faixa. Critério: zoom só muda a câmera.
- **Etapa 3: edição rápida.** Ligar o provisório na planta (UI) e o exato assíncrono. Critério: resposta visual em até 50 ms.
- **Etapa 4: 3D na GPU.** Paredes como quads parametrizados, portas, janelas e mobília como instâncias, culling por frustum e por nível.
- **Etapa 5: cortes e elevações por recorte.** Plano de recorte na GPU em vez de geometria de corte recalculada a cada quadro.
- **Etapa 6: abertura.** Cache de geometria ligado no controller e montagem progressiva da 3D com `resolucaoPronta`. Critério: primeiro quadro em até 300 ms com 20 pavimentos.
- **Etapa 7: WebGPU compute (triangulação e extrusão), com fallback WebGL2.** Só se a medição depois das etapas 1 a 6 mostrar que ainda pesa.
- **Etapa 8: Rust/WASM para o núcleo de junção.** Só se o perfil depois da etapa 7 mostrar a CPU como gargalo.

### Medição de referência (etapa 0, 2026-10-25, mediana em ms)

| Medida | 10 pav | 20 pav |
|---|---|---|
| Abrir projeto | 317 | 408 |
| Planta do nível do meio | 39 | 75 |
| Seleção | 14 | 21 |
| Editar parede | 103 | 135 |
| Porta na parede | 121 | 227 |
| Janela na parede | 133 | 237 |
| Parede nova | 175 | 242 |
| Pan | 29,5 | 52,8 |
| Zoom | 19 | 29 |
| Clique 3D | 49 | 57 |

Atenção: a medição foi feita com 19 processos node ativos na máquina (restos de subagentes). Pan e zoom subiram em relação à onda 5, o que provavelmente é carga. Repetir com a máquina limpa antes de comparar.
