# Plano v3 — arquitetura GPU-first para projetos grandes

- **Data:** 2026-10-26
- **Base:** `181469f` (`ccr-25143eb2-08pwa4`)
- **Substitui:** v1 (consertos) e v2 (híbrida)
- **Bancada real:** Radeon RX 580 8 GB (WebGL2 garantido; WebGPU a validar)
- **Documentos de origem:** `ordem-implementacao.md`, `HANDOFF-INSERCAO-2026-10-26.md`, `0003-gpu-e-publicacao.md`
- **Board de execução (documento vivo):** `docs/desempenho/execucao-subagentes-2026-10-26.md`
- **Status:** Fase 0 em andamento (S0/S1/S2 disparados em 2026-10-26).

## 0. Veredito

A v2 era **híbrida**: consertava regressões e adicionava GPU, mas mantinha o pipeline centrado na CPU
(lista de desenho, geometria de corte, picking por BVH, realce por cópia de triângulos, montagem 3D na main thread).
Ela era “GPU-aware”, não “GPU-first”.

Esta v3 muda o eixo: **100% do desenho e da interação passam a ser dirigidos pela GPU**; a CPU fica com o que exige
exatidão de modelo. É o modelo mental de Revit/Archicad: a CPU guarda o BIM, resolve topologia, valida e calcula
quantitativos; a GPU desenha, recorta, seleciona, faz culling, sombras e hachura.

> “100% GPU” não significa topologia na GPU. Junção, booleans, validação e IFC continuam na CPU. Significa que
> **nenhum quadro de câmera, seleção, hover, corte ou zoom reconstrói geometria na CPU**.

## 1. O que Revit/Archicad fazem e o que falta aqui

| Técnica de GPU | Estado no Hestia | Lacuna |
|---|---|---|
| Cena retida / display lists | Planta já é retida (`gpuPlan.ts`); 3D tem cache por nível | 3D ainda refaz cena inteira em `update` |
| Culling por frustum + oclusão | Culling padrão do three por objeto | Sem culling por nível, sem oclusão, sem LOD |
| Instancing / batching | Paredes e esquadrias instanciadas | Pisos, lajes, telhados, escadas e arestas ainda em batches |
| Planos de recorte (section box/crop) | Corte/elevação geram geometria na CPU | Sem clipping plane por vista |
| Seleção/realce na GPU | `highlightOf` copia triângulos por seleção/hover | Sem stencil/ID buffer; custo cresce com a seleção |
| Picking na GPU | BVH de triângulos por malha na CPU | Sem ID buffer/leitura assíncrona |
| Sombras de hardware | Um shadow map 2048² para a cena inteira | Sem cascaded shadow maps (CSM) por nível |
| Hachura procedural | `hatchSegments` gera linhas na CPU | Sem padrão no fragment shader em coordenadas do mundo |
| Texto na GPU | Rótulos em DOM (decisão 0003) | Sem SDF/atlas; DOM não escala para milhares de rótulos |
| Gestão de VRAM | Tetos fixos (128 MB 3D, 32 MB geometria) | Sem orçamento por GPU, residência ou streaming |
| Precisão em projeto grande | float32, depth 24 bits, `near/far` fixos | Sem reversed-Z/log depth nem rebase de origem |
| Workers para o modelo | Só resolução de junção | Montagem 3D e lista da planta na main thread |
| WebGPU | Opt-in `?gpu=webgpu`; validado na RX 580 (S0) | Ainda não é default; W1 precisa de soak/matriz e retry de restore |

## 2. Definição operacional de GPU-first

Um quadro típico deve ser:

1. **Câmera/zoom:** só matriz e uniform. Zero rebuild.
2. **Hover/seleção:** ID buffer ou stencil. Zero cópia de triângulos.
3. **Corte/elevação:** plano de recorte. Zero geometria de corte.
4. **Hachura/traço/texto:** shader/atlas. Zero geração de linhas por quadro.
5. **Visibilidade/LOD:** GPU decide ou dados já compactados pela GPU.
6. **Edição:** CPU altera o modelo e envia **patch de buffer**; GPU só atualiza o que mudou.
7. **Abertura:** cache + workers + montagem progressiva; GPU recebe buffers prontos.

A CPU só entra em: edição do modelo, junção/topologia, validação, quantitativos, IFC, desfazer e persistência.
Tudo isso pode rodar em worker.

### 2.1 Camadas de capacidade (o app nunca depende de WebGPU)

| Camada | Requisito | O que entrega | Papel |
|---|---|---|---|
| **A — WebGPU** | `navigator.gpu` + adapter/dispositivo | Tudo do WebGL2 + compute, indirect draw, timers melhores | aceleração opcional |
| **B — WebGL2** | WebGL2 (piso real de navegador/Tauri) | Cena retida, instancing, clipping por shader, ID buffer, MRT, timer query | **caminho obrigatório** |
| **C — CPU** | Canvas2D | Planta degradada; 3D indisponível | último recurso |

Regra: **nenhuma funcionalidade central pode existir só na camada A**. Compute, indirect draw e oclusão por
depth pyramid são melhorias; culling, LOD, picking, clipping, hachura e realce têm de funcionar na camada B.
A sondagem devolve a camada, não “liga o WebGPU” por conta própria. O padrão continua WebGL2 até a Fase 3.

> **Isto não é CPU-first.** A camada B é GPU via WebGL2. A camada C (Canvas2D) é o último recurso, só quando não
> existe GPU nenhuma. O plano usa GPU desde o primeiro dia; o teste de 60 pavimentos é uma prova de escala, não o
> gatilho para “começar a usar GPU”.

Se o navegador bloquear WebGPU, as opções são:

| Opção | O que resolve | O que não resolve |
|---|---|---|
| Chrome/Edge com flags | Teste/desenvolvimento (`--enable-unsafe-webgpu`, `--ignore-gpu-blocklist`) | Não serve para usuário final; não fura bloqueio de driver |
| **Tauri** | App nativo, distribuição, integração; `additionalBrowserArgs` no WebView2 | Não embute Chromium no Windows; WebGPU depende do WebView2 + driver; não garante compute |
| **Electron** | Embute Chromium; controla versão e flags; mais previsível para WebGPU | Ainda depende do driver; bundle grande; não vira GPU nativa |
| **Renderer nativo (wgpu/Rust)** | Controle total de D3D12/Vulkan/Metal; compute e memória sem sandbox | Exige renderer nativo separado da webview; reescrita grande; não é “Tauri resolve” |
| **WebGL2** | GPU-first de display em qualquer navegador/Tauri | Sem compute/indirect draw; culling/LOD compactados na CPU |

## 3. Metas para projeto grande (não 20 pavimentos)

Cenário de referência: **60 pavimentos, 256 paredes por pavimento**, aberturas, ambientes, cotas e rótulos.

| Cenário | Meta |
|---|---:|
| Pan/zoom da planta | ≤8 ms de CPU por quadro, 60 fps |
| Hover/seleção | ≤8 ms, zero rebuild |
| 3D panorâmica | ≤16 ms por quadro |
| Draw calls | ≤500 no WebGL2; ≤200 no WebGPU |
| Triângulos | ≤3 M por quadro |
| VRAM | ≤2 GB (a RX 580 tem 8 GB; medir o teto real) |
| Edição visual | ≤16 ms |
| Exato assíncrono | ≤100 ms |
| Abertura — 1º quadro | ≤300 ms |
| Abertura — modelo completo | ≤2 s |
| Pick 3D/planta | ≤16 ms |
| Soak | 1 h sem vazamento e sem perda de contexto |

## 4. Ordem de implementação (o que vem antes do quê)

A ordem é por **dependência de arquitetura**, não por facilidade. WebGPU e compute só entram depois que o caminho
WebGL2 estiver eficiente: senão o fallback continua lento e o ganho não se sustenta.

### Fase 0 — Verdade e estresse (3–4 dias)

- **0.1 Sonda de capacidade + container:** `navigator.gpu.requestAdapter()`, `adapter.info`, `limits`, features
  (timestamp-query), `chrome://gpu`; testar Chrome/Edge no navegador e, se WebGPU for requisito de produto, um spike
  mínimo em **Tauri (WebView2)** e **Electron**. Registrar camada A/B/C, perda/recuperação e teto de VRAM.
- **0.1b Spike de container (opcional, só se necessário):** a sonda S0 mostrou WebGPU viável no navegador (Chrome/Edge
  na RX 580), então Tauri/Electron deixam de ser urgentes. Tauri no Windows usa WebView2 (Chromium do sistema), não
  embute Chromium: WebGPU depende da versão do WebView2 e do driver; dá para passar flags por
  `additionalBrowserArgs`/`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`, mas não fura bloqueio de driver. Electron embute
  Chromium e permite flags — **sem** `--use-angle=d3d12`, que nesta GPU derruba a aceleração. Nenhum dos dois
  substitui WebGL2 como piso. Só adotar container novo se a camada A for requisito explícito.
- **0.2 Instrumentação:** timer de GPU, draw calls, triângulos, uploads, rebuilds, commits React, tempo de worker.
  Overlay `?perf=1` e teste de orçamento por cenário.
- **0.3 Gerador de projeto grande:** 30/60 pavimentos, 128/256 paredes, aberturas e rótulos proporcionais.
- **0.4 Baseline:** `medir:gpu` + `perf-browser` em 10, 30 e 60 pavimentos, WebGL2 e WebGPU (se houver).
- **Gate:** top 5 de custo por cenário, VRAM/teto, e resposta se WebGPU é viável na RX 580.

### Fase 1 — Estabilizar (paralelo, 3–4 dias)

- **1.1 Inserção/abertura:** remover assinatura do projeto inteiro no `App`, estreitar UI quente, conferir Worker por
  HTTP. Meta: inserção ≤25 ms, abertura ≤300 ms.
- **1.2 Verificação visual:** roteiro com PNGs para cotas, texto, etiquetas, seleção, cortes e 3D.
- **1.3 Integração:** suíte 2×, medição final, sem regressão.
- **Gate:** baseline estável para refatorar o renderer sem confundir causa e efeito.

### Fase 2 — Fundação do renderer GPU (1–2 semanas)

Ordem interna: **2.1 antes de 2.2; 2.2 antes de 2.3/2.4; 2.5–2.7 em paralelo depois de 2.1.**

- **2.1 Gestor de recursos GPU + buffers por elemento**
  - Um buffer por categoria/elemento, com atualização parcial (`bufferSubData`/`writeBuffer`).
  - Nada de alocar/descartar geometria por quadro; orçamento de VRAM e LRU por residência.
  - Base para todo o resto.
- **2.2 Instancing/batching total**
  - Pisos, lajes, telhados, escadas, arestas e esquadrias como instâncias ou `BatchedMesh`.
  - Um draw por material/categoria, não por nível.
  - Meta: draw calls dentro do orçamento em 60 pavimentos.
- **2.3 Visibilidade GPU-driven**
  - Culling por frustum por nível; oclusão por depth pyramid quando houver WebGPU; LOD por distância/tamanho.
  - WebGL2: CPU compacta a lista de draws (barato); WebGPU: indirect draws.
  - Só depois de 2.1/2.2, senão não há o que compactar.
- **2.4 Picking, seleção e realce na GPU**
  - ID buffer (cor = id) com leitura assíncrona; fallback para BVH onde não houver.
  - Realce por stencil/outline ou ID buffer; **sem copiar triângulos** a cada hover/seleção.
  - Resolve o custo que cresce com a seleção em projeto grande.
- **2.5 Clipping planes para cortes/elevações**
  - Plano de recorte por vista; geometria do modelo permanece.
  - View range/crop/section box também por recorte.
  - Teste de imagem obrigatório; fallback para o caminho CPU.
- **2.6 Hachura, traço e texto**
  - Hachura procedural no fragment shader em coordenadas do mundo (fim dos milhares de segmentos).
  - Traço já é shader; falta eliminar lotes dinâmicos desnecessários no zoom.
  - Texto: manter DOM com culling/LOD ou SDF atlas; decidir com medição em 60 pavimentos.
- **2.7 Sombras e precisão**
  - CSM ou atlas de sombra por nível; sombra de contato.
  - Reversed-Z/log depth e rebase de origem (RTC) para prédio alto/longe da origem.
  - Resolve z-fighting e sombra grosseira em projeto grande.

**Gate da Fase 2:** 60 pavimentos a 60 fps no WebGL2; zero rebuild em câmera/seleção; cortes sem geometria CPU;
realce sem cópia; hachura sem geração CPU por quadro.

### Fase 3 — WebGPU como caminho principal (1 semana)

- **3.1 Promover WebGPU** com fallback WebGL2 → CPU; matriz de boot e perda de dispositivo.
  - Pedir **adapter novo por device** (o adapter do Chrome é de uso único depois de `requestDevice()`).
  - No WebGL2, **retry de `restoreContext()` após um `requestAnimationFrame`** (a 1ª tentativa não restaura); limite de tentativas.
  - Não distribuir flags: `--use-angle=d3d12` derruba a aceleração nesta máquina.
- **3.2 Compute só onde houver ganho medido:** culling/LOD, compactação de instâncias, hachura.
  **Topologia/junção não entram em compute.**
- **3.3 Timers e memória:** timestamp queries, orçamento de VRAM, residência.
- **Gate:** WebGPU estável 1 h na RX 580 (se disponível) ou decisão registrada; fallback WebGL2 igualmente rápido.

### Fase 4 — Pipeline de CPU e workers (paralelo, 1–2 semanas)

- **4.1 Workers:** montagem 3D (sólidos por nível) e lista da planta fora da main thread; transferables.
- **4.2 Incremental:** patch por elemento afetado; exato assíncrono; sem varrer o projeto inteiro.
- **4.3 WASM na junção** só se o perfil pós-2/3 mostrar a CPU como gargalo dominante.
- **Gate:** main thread sem tarefas >50 ms; edição visual ≤16 ms.

### Fase 5 — Endurecimento de escala (1 semana)

- 60 pavimentos/256 paredes, 1 h de soak, VRAM/heap estáveis.
- Matriz WebGPU/WebGL2/CPU; perda de GPU; visual equality; suíte 2×.
- Documento final + decisão registrada.

## 5. O que muda em relação à v2

| v2 | v3 |
|---|---|
| “GPU-aware”, foco em consertos e ganhos pontuais | GPU-first: desenho e interação 100% GPU-driven |
| 20 pavimentos | 60 pavimentos / 256 paredes |
| B1–B7 em paralelo | Fases com dependência explícita |
| Clipping (B4) e WebGPU (B5) cedo | Clipping depois da fundação; WebGPU depois do WebGL2 eficiente |
| Sem gestor de VRAM/culling/LOD/picking GPU | 2.1–2.4 cobrem esses pilares |
| Realce por cópia aceito | Realce por stencil/ID obrigatório |
| Hachura CPU | Hachura procedural GPU |
| Precisão/sombras ausentes | 2.7 obrigatório para projeto grande |
| Workers como item isolado | Fase 4 inteira para CPU/worker |

## 6. Agentes e paralelismo

```
Fase 0: S0 (sonda GPU) + S1 (instrumentação) + S2 (gerador/baseline)   [serial-ish]
Fase 1: A1 (inserção/abertura) + A2 (visual) + A3 (integração)         [paralelo]
Fase 2: R1 (recursos GPU)
          +--> R2 (instancing/batching)
          |       +--> R3 (culling/LOD)
          |       +--> R4 (picking/realce GPU)
          +--> R5 (clipping)
          +--> R6 (hachura/texto)
          +--> R7 (sombras/precisão)
Fase 3: W1 (WebGPU) + W2 (compute medido)
Fase 4: P1 (workers) + P2 (incremental/WASM)
Fase 5: H1 (escala/soak/visual)
```

- **Caminho crítico:** Fase 0 → Fase 2.1 → 2.2 → 2.3/2.4 → Fase 3 → Fase 5.
- Fase 1 pode rodar em paralelo com 0.3/0.4; não bloqueia a fundação.
- R5/R6/R7 rodam em paralelo depois de 2.1; não esperam 2.3/2.4.
- Nenhuma medição roda durante builds; cada agente em worktree próprio; sem push.

## 7. Riscos e decisões

| Risco | Decisão |
|---|---|
| WebGPU bloqueado na RX 580 | WebGL2 é o piso; WebGPU é aceleração opcional, não requisito |
| ID buffer com readback lento | Leitura assíncrona + fallback BVH; medir latência |
| Compute muda topologia | Proibido; compute só para trabalho visual idempotente |
| Refatoração do renderer quebra imagem | Caminho de referência + visual equality + feature flag |
| Hachura/texto GPU pioram legibilidade | Medir em 60 pavimentos; manter DOM/SDF híbrido se necessário |
| Precisão/sombras mudam a imagem | Gate visual e comparação por vista |
| VRAM de 8 GB mascarar vazamento | Orçamento ≤2 GB e soak de 1 h |
| Projeto grande estoura CPU antes da GPU | Fase 4 (workers/incremental) em paralelo, sem esperar a GPU |

## 8. Definição de pronto (GPU-first)

- 60 pavimentos/256 paredes a 60 fps na RX 580 (WebGL2; WebGPU se disponível).
- Pan/zoom/hover/seleção: zero reconstrução de geometria.
- Todas as categorias instanciadas/batched; draw calls dentro do orçamento.
- Picking e realce por GPU; nenhuma cópia de triângulos.
- Cortes/elevações por clipping; nenhuma geometria de corte na CPU.
- Hachura/traço/texto sem geração CPU por quadro.
- CSM + reversed-Z/RTC estáveis em prédio alto.
- Workers para montagem 3D e lista da planta; main thread <50 ms por tarefa.
- WebGPU promovido com fallback comprovado, ou decisão registrada.
- Soak 1 h, memória/VRAM estáveis, suíte 2× e visual equality verdes.

## 9. Brief de subagente (template)

```text
Repositório: <raiz-do-repositorio>
Worktree: <caminho>   (trabalhe SOMENTE nele)
Ramo: gpu/<fase>-<id>-<slug>   (não faça push)
Leia: docs/desempenho/plano-subagentes-2026-10-26.md (v3) e o brief <S0|S1|S2|A1..|R1..|W1..|P1..|H1>.

Objetivo: <missão e aceite do brief>.
Arquivos permitidos: <lista>. Não altere fora dela.
Proibido: git stash, git reset --hard, force push, apagar worktree/ramo, topologia em compute.
Obrigatório: medir antes/depois com o contador do S1, teste de igualdade visual, typecheck + testes do pacote.
Se a meta não for atingida, entregue o perfil e o próximo passo; não declare pronto.
Relatório: arquivos, comandos, números, riscos, o que ficou fora.
```

## 10. Comandos de referência

```powershell
npm run typecheck
npm run lint
npm run test:rapido
npm run test:completo
npm run test:perf
npm run medir:gpu
npm run perf:browser -- --save
node tests/e2e/visual-regression.mjs
node tests/e2e/visual-regression-gpu.mjs
node tests/e2e/sections.mjs
node tests/e2e/flow.mjs

# build (fallback quando o esbuild falha)
npm run build -w @hestia/web -- --target esnext --minify false

# GPU real
# abrir com ?gpu=webgpu&debug=1 e conferir a barra de status
# APP_URL=http://localhost:<porta>/index.html PERF_RUNS=10 npm run perf:browser -- --save
```
