# Execução em subagentes — GPU-first (Hestia)

- **Data:** 2026-10-26
- **Base:** `181469f` (`ccr-25143eb2-08pwa4`)
- **Plano de arquitetura:** `docs/desempenho/plano-subagentes-2026-10-26.md` (v3)
- **Objetivo deste documento:** transformar a v3 em um board executável, com squads, dependências, donos de arquivo e briefs.

> **Documento vivo.** Atualize a tabela de status a cada entrega: marque o agente, o gate, a data, o commit e o
> número medido. Se uma decisão mudar, registre aqui e no plano v3. A linha de execução é esta; não abra frente
> nova sem fechar ou cancelar explicitamente uma linha da tabela.

## 0. Status de execução

**Última atualização:** 2026-10-26 — R1 integrado (251→14 draws); M0 em preparação.
**Em execução:** M0 (baseline 10/30/60) e ajuste da estabilização do `medir:gpu`.
**Próxima ação:** rodar M0, A2 no build integrado e liberar R2/R3/R5 + A1b.

| Fase | Gate | Status | Dono | Data | Resultado |
|---|---|---|---|---|---|
| 0 — Verdade | G0 | 🟨 em andamento | S0, S1, S2, M0 | — | — |
| 1 — Estabilização | G1 | 🟨 parcial: inserção ok; abertura pendente (A1b) | A1, A1b, A2, I1 | 2026-10-26 | inserção 19–25 ms; abertura 445–465 ms |
| 2 — Fundação GPU | G2 | 🟨 R1 ok; R2–R5 pendentes | R1–R5 | 2026-10-26 | 60×128: 251→14 draws, 1,0 ms |
| 3 — WebGPU | G3 | ⬜ aguarda G2 | W1, W2 | — | — |
| 4 — CPU/workers | G4 | ⬜ paralela à 2/3 | P1, P2 | — | — |
| 5 — Endurecimento | G5 | ⬜ aguarda todas | H1 | — | — |

### Checklist de agentes

- [x] **S0** sonda de GPU real (RX 580) — concluído em `6a87455`; ver `docs/desempenho/gpu-capacidade.md`
- [x] **S1** instrumentação (`?perf=1`, timers, contadores) — concluído em `2a4ec8e`; ver `docs/desempenho/instrumentacao-s1-2026-10-26.md`
- [x] **S2** gerador de projeto grande (30/60 pav, 128/256 paredes) — concluído em `f494263`; ver `docs/desempenho/s2-projeto-grande-2026-10-26.md`
- [ ] **M0** baseline 10/30/60
- [x] **A1** inserção/abertura — concluído em `1a7883c`/`16f9658`; inserção na meta, abertura ainda 445–465 ms
- [ ] **A1b** abertura ≤300 ms (cache por nível, avisos adiados, desenho inicial)
- [x] **A2** verificação visual — concluído em `763b890`; 44 PASS, 1 FAIL (realce de linha de detalhe)
- [ ] **I1** integração da Fase 1
- [x] **R1** fundação 3D GPU — concluído em `ba4b4e6`; 251→14 draw calls, 3,2→1,0 ms
- [ ] **R2** culling/LOD/sombras/precisão
- [ ] **R3** picking/realce GPU
- [ ] **R4** clipping planes
- [ ] **R5** planta GPU
- [ ] **W1** WebGPU
- [ ] **W2** compute medido
- [ ] **P1** workers
- [ ] **P2** incremental/WASM
- [ ] **H1** escala/soak/visual

### Ganho realista e escopo

- **Funil de testes:** L0 durante (≤2 min), L1 fecha agente (≤10 min), L2 fecha fase (≤20 min), L3 release
  (30–60 min). A suíte completa só entra em L3; a rápida (`test:rapido`, ~73 s) só em L2.
- **Ganho de tempo:** ~20–30% no prazo total em relação a rodar suíte ampla por agente. Não transforma 5–6
  semanas em 1; a arquitetura GPU continua sendo o caminho crítico.
- **Caminho rápido (3–4 semanas):** Fases 0, 1, 2 (R1–R5) e 5, **sem** W2 (compute), P2 (WASM) e R6 (texto SDF),
  mantendo WebGL2 como caminho principal e WebGPU como aceleração opcional.
- **Caminho completo (5–6 semanas):** acrescenta W1/W2 e P1/P2.
- **Regra:** para cortar prazo, corte escopo — nunca o teste de igualdade, a imagem da vista afetada ou o
  orçamento do cenário alvo.

### Achados S0 (2026-10-26)

- **WebGPU viável na RX 580 2048SP:** Chrome 155 e Edge 156, headed e headless=new, com adapter `amd/gcn-4`,
  compute real, render com readback, `timestamp-query`, `float32-filterable`, `depth-clip-control` e recuperação
  de device em ~17 ms. Relatório: `docs/desempenho/gpu-capacidade.md`.
- **WebGL2 é o piso e também é hardware:** ANGLE/D3D11, 8 draw buffers, MSAA 8×, `EXT_disjoint_timer_query_webgl2`
  funcional.
- **Default do app intocado:** continua WebGL2; `?gpu=webgpu` liga A; `?cpu=1` liga C.
- **Nenhuma flag deve ser distribuída:** `--use-angle=d3d12` derruba a aceleração (SwiftShader) nesta máquina;
  `--enable-unsafe-webgpu --ignore-gpu-blocklist` não muda nada (não havia blocklist).
- **W1 precisa de dois cuidados:** o `GPUAdapter` do Chrome é de uso único (pedir adapter novo por device) e a
  restauração do WebGL2 só pega na 2ª tentativa, depois de um `requestAnimationFrame`.
- **VRAM:** 8 GiB físicos; o navegador não expõe consumo. O orçamento ≤2 GB do plano continua valendo.
- **Limite de buffer:** `maxBufferSize` = 2 GiB; um buffer por categoria, nunca um buffer único do modelo inteiro.
- **Exceção de tamanho:** `tests/e2e/gpu-probe.mjs` ficou com ~1011 linhas (acima da regra de ~400). É script de
  sonda, não produto; fica registrado para refatorar em H1, sem bloquear a Fase 0.

### Achados S1 (2026-10-26)

- **Instrumentação ligada só com `?perf=1`:** sem o parâmetro, os métodos são no-op e não há overlay; o layout não muda.
- **API:** `window.__hestiaPerf.snapshot()` / `.reset()`; overlay com FPS, frame ms, draw calls, triângulos, uploads e rebuilds.
- **Mede:** frame CPU (rAF), timer GPU WebGL2 (`EXT_disjoint_timer_query_webgl2`), draw calls/triângulos, uploads de buffer,
  rebuilds por camada (geometria/sobreposição/grade) e commits do `ViewportCanvas`.
- **Contraprova:** troca de nível gerou uploads/rebuilds; edição de parede mudou triângulos e rebuilds. Não são zeros falsos.
- **Pendências registradas:** timer WebGPU (three não expõe timestamp), draw calls WebGPU por interceção, tempo de worker
  (A1/P1), rebuild da vista de corte (R4), uploads de textura e commits do app inteiro.
- **Números do exemplo são de Chrome headless/SwiftShader**, não baseline de hardware; M0 mede na GPU real.
- **Nota de ambiente:** o worktree do S1 usa uma junção local `apps/web/node_modules/@hestia/render` para o pacote do ramo;
  não versionada. O repo principal resolve pelo workspace normal.

### Achados S2 (2026-10-26)

- **Cenários grandes existem e abrem:** 30×128, 30×256, 60×128 e 60×256, sem erro; JSON determinístico (mesmo SHA-256).
- **60×256 não estoura memória** (pico ~1,8 GB de processo), mas é lento: 8,66 s de abertura e 56 s de montagem 3D.
- **Quadro estável cabe na meta:** 60×256 = 251 draw calls / 1,71 M triângulos; 30×256 = 131 / 0,85 M.
- **O 1º quadro não cabe:** 60×256 = 439 draw calls / 3,41 M triângulos, acima do teto de 3 M. O R2 (culling/LOD)
  e o R1 (instancing) têm de atacar isso.
- **Cenário de iteração:** 60×128 ou 30×256. 60×256 só em rodada curta/soak.
- **Bug corrigido:** `medir:gpu` abria a 3D por `button.leaf`, que não existe mais; agora usa `treeitem “Modelo 3D”`.
- **Padrão preservado:** `npm run medir:gpu` sem variáveis continua 10/20/30 × 32, sem pendências.
- **Exceção de tamanho:** `scripts/medir-gpu-memoria.mjs` ficou com ~443 linhas (levemente acima de ~400); refatorar em H1.

### Achados A2 (2026-10-26)

- **Harness reproduzível:** `node tests/e2e/verificacao-visual.mjs` (aceita `--item`, `--list`, `--strict`, `--url`, `--browser`).
- **Resultado:** 44 PASS, 1 FAIL, 0 PENDENTE em 45 critérios; 22 PNGs + `resultados.md` + `resumo.json` em
  `tests/e2e/out/verificacao-visual/`.
- **Cobertura:** cotas 12/60/220, texto com caixa, etiquetas/líderes, linhas de detalhe, cortes/elevações, 3D com
  caixas instanciadas.
- **FAIL real:** clicar na linha de detalhe tracejada seleciona, mas o desenho não muda (0 px; PNG idêntico por SHA-256).
  Causa: `planGeometrySelection` não inclui linhas de detalhe; o realce não entra na geometria nem na sobreposição.
  **Dono:** R5 (plano GPU), que deve corrigir e cobrir com `--item linhas`.
- **Capturas em SwiftShader:** critérios estruturais/pixel-métricos, sem baseline; não substituem GPU real.
- **Fora desta rodada:** tema escuro, zoom >220, pranchas/DXF e seleção de regiões de detalhe.
- **Exceção de tamanho:** `tests/e2e/verificacao-visual.mjs` ficou com ~725 linhas; refatorar em H1.

### Achados A1 (2026-10-26)

- **Inserção na meta:** porta 18,8–22,6 ms; janela 19,1–20,7 ms; parede nova 22,1–25,3 ms (20 pav, HTTP, 10 rep).
  A meta de 20 ms é quase o piso da métrica (`pointerup → 2 rAF` = 2 quadros).
- **Abertura não:** 445–465 ms contra meta 300 ms. Perfil: ~184–200 ms de resolução exata de dois níveis,
  ~118–138 ms do primeiro desenho exato e ~119 ms de estilo/layout do DOM novos — tudo fora dos arquivos do A1.
- **H1 mantida:** `App` não assina mais `useProject()`; `Palco` + `useProjetoDerivado` reduzem a cauda do React.
- **H2 revertida:** resolver só o nível visível só move os mesmos ~80 ms para o 1º desenho; total igual.
- **H3 confirmada:** `file://` não cria module worker (origem `null`); `http://` cria. A medição oficial é por HTTP.
- **H4 descartada:** `ATRASO_AVISO_MS`/`avancar()` não seguram a thread (<1 ms).
- **Novos achados para A1b:** `avisosDoProjeto` gasta 115–140 ms 300 ms após cada edição; o cache de geometria só
  grava quando **todos** os níveis ficam prontos (~2 s), então quase nunca é reaproveitado na abertura seguinte.
- **Ambiente:** a máquina estava compartilhada com S2/A2; o mesmo build base deu 435–474 ms. M0 precisa ser exclusivo.

### Achados R1 (2026-10-26)

- **Draw calls:** 60×128 251 → **14**; 30×256 131 → **14**; 60×256 251 → **14** (não cresce com pavimentos).
- **Frame CPU:** 3,2 → **1,0 ms** em 60×128; 2,2 → **1,0 ms** em 30×256.
- **Montagem 3D:** 60×128 32,5 → **17,8 s**; 60×256 56,0 → **38,8 s**.
- **Uploads de montagem:** 60×128 581,6 → **111,5 MB**; 30×256 295,0 → **95,2 MB**.
- **Triângulos estáveis:** 0,85 M em 60×128/30×256, 1,71 M em 60×256; 1º quadro de 60×256 ainda 3,41 M (R2).
- **VRAM contábil:** 18,9 / 18,5 / 37,0 MiB (teto 256 MiB).
- **Quadro parado:** uploads e rebuilds = 0 em 60 amostras.
- **Picking/realce:** preservados por faixas globais; BVH invalidado por versão; `instanciar: false` intacto.
- **Ajuste necessário no M0:** `medir:gpu` estabilizava pela contagem de malhas; com lotes globais, passa a acompanhar
  triângulos + instâncias (corrigido em `scripts/medir-gpu-memoria.mjs`).
- **Testes:** 36 arquivos / 546 testes verdes; typecheck verde.

## 1. Regras do board

1. Um agente = um worktree = um ramo = um dono de arquivo. Ninguém edita o worktree do outro.
2. Medições (`M0`/`M1`) são janelas exclusivas: nenhum agente constrói ou edita durante a medição.
3. Nenhuma fase começa sem o gate da anterior — exceto Fase 1 e Fase 4, que correm em paralelo.
4. Todo agente entrega: commits locais, relatório com números antes/depois, e o que ficou fora.
5. Proibido: push, `git stash`, `reset --hard`, apagar worktree/ramo, topologia em compute.
6. Todo comportamento visual tem teste de igualdade; todo ganho tem número; toda regressão para o agente.

## 2. Roster

### Squad 0 — Verdade (Fase 0)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **S0** | Sondar GPU real (RX 580): WebGPU? WebGL2? limites, timers, VRAM; spike Tauri/Electron se necessário | — | `tests/e2e/gpu-probe.mjs`, `docs/desempenho/gpu-capacidade.md` | relatório de camadas A/B/C + decisão | 1 d |
| **S1** | Instrumentação: timer GPU, draw calls, triângulos, uploads, rebuilds, commits React, tempo de worker; overlay `?perf=1`; teste de orçamento | — | novos `apps/web/src/debug/perf/*`, `packages/render/src/perf/*`; ligação mínima em `gpu.ts` | JSON por cenário + top 5 de custo | 2 d |
| **S2** | Gerador de projeto grande: 30/60 pavimentos, 128/256 paredes, aberturas, rótulos; medir 10/30/60 | — | `scripts/perf-baselines/projeto-sintetico.mts`, `scripts/medir-gpu-memoria.mjs` | cenários reproduzíveis + baseline | 1–2 d |
| **M0** | Rodar baseline: 10/30/60 pav, WebGL2 e WebGPU (se houver), 10 repetições | S1, S2 | nenhum (só medição) | JSON + tabela | 0,5 d |

### Squad 1 — Estabilização (Fase 1, paralela à 0.3/0.4)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **A1** | Inserção ≤25 ms e abertura ≤300 ms: tirar `useProject()` do `App`, estreitar UI quente, conferir Worker por HTTP | S1 | `apps/web/src/App.tsx`, `editor/controller.ts`, `resolucaoAssincrona.ts`, `quadroPlanta.ts`, UI quente | tabela antes/depois por hipótese | 2 d |
| **A2** | Verificação visual: cotas, texto, etiquetas, seleção, cortes, 3D; PNGs + veredito | S1 | `tests/e2e/` (novo), `docs/desempenho/verificacao-visual.md` | roteiro + capturas + tabela | 1 d |
| **I1** | Integrar Fase 1, suíte 2×, medir, atualizar doc | A1, A2, M0 | — | gate G1 fechado | 0,5 d |

### Squad 2 — 3D GPU (Fase 2)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **R1** | Fundação 3D: gestor de recursos GPU, buffer por elemento, update parcial, instancing/batching de **todas** as categorias | S1, M0 | `packages/render/src/model3d/*`, novo `packages/render/src/gpu/*` | draw calls no orçamento, zero alloc por quadro | 4–5 d |
| **R2** | Culling/LOD + sombras/precisão: frustum/oclusão, LOD, CSM, reversed-Z/RTC | R1 | `scene3d.ts`, `orbit.ts`, `sombras3d.ts`, `cameraClip.ts`, novos módulos | 60 pav ≤16 ms; sem z-fighting | 3–4 d |
| **R3** | Picking/realce na GPU: ID buffer/MRT, stencil/outline, leitura assíncrona | R1 | `pick3d.ts`, `triBvh.ts`, `highlight3d.ts`, `realceDaCena3d.ts`, `selecao3d.ts` | seleção/hover ≤8 ms, zero cópia | 3 d |
| **R4** | Clipping planes: cortes, elevações, view range, section box | R1 | `packages/render/src/section/*`, `apps/web/src/ui/SectionCanvas.tsx` | corte sem geometria CPU; imagem igual | 2–3 d |

### Squad 3 — Planta GPU (Fase 2, paralela à Squad 2)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **R5** | Planta zero-rebuild: overlay de cursor/seleção separado, hachura procedural, traço/texto com LOD; **corrigir o realce de linhas de detalhe (FAIL A2)** | S1, M0 | `packages/render/src/plan/*`, `apps/web/src/ui/quadroPlanta.ts`, `PlanLabels.tsx` | pan/zoom ≤8 ms; hover ≤8 ms; sem rebuild; `--item linhas` PASS | 4 d |

### Squad 4 — WebGPU (Fase 3)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **W1** | Promover WebGPU com fallback: boot, perda de dispositivo, matriz WebGPU/WebGL2/CPU, timers | R1–R5 | `packages/render/src/gpu.ts`, `apps/web/src/ui/ViewportCanvas.tsx` | WebGPU estável 1 h ou decisão | 3 d |
| **W2** | Compute medido: culling/LOD/hachura em compute **se** houver ganho; topologia fora | W1 | novos `packages/render/src/gpu/compute/*` | ganho medido ou descarte documentado | 3 d |

### Squad 5 — CPU e workers (Fase 4, paralela)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **P1** | Workers: montagem 3D e lista da planta fora da main thread; transferables; fila/cancelamento | R1 | `apps/web/src/ui/montagem3dProgressiva.ts`, novos workers, `packages/engine/src/worker/*` | main thread sem tarefa >50 ms | 4 d |
| **P2** | Incremental: patch por elemento, exato assíncrono; WASM na junção só se medido | A1, R1 | `editor/fluxoEdicao.ts`, `resolucaoAssincrona.ts`, `packages/engine/src/fluxoPatch.ts` | edição visual ≤16 ms | 3 d |

### Squad 6 — Endurecimento (Fase 5)

| ID | Missão | Depende | Dono dos arquivos | Entrega | Tempo |
|---|---|---|---|---|---|
| **H1** | 60 pav/256 paredes, soak 1 h, VRAM/heap, fallback, visual equality, suíte 2× e doc final | todas | `tests/e2e/`, `scripts/perf-baselines/`, docs | gate G5 + decisão registrada | 4 d |

**Total:** 17 agentes + 2 janelas de medição. Pico de paralelismo: 4–5 agentes.

## 3. DAG de execução

```
FASE 0
  S0 (GPU probe) ──────────────┐
  S1 (instrumentação) ─────────┼──> M0 (baseline) ──> G0
  S2 (projeto grande) ─────────┘

FASE 1 (paralela)
  A1 (inserção/abertura) ──┐
  A2 (visual) ─────────────┼──> I1 (integra) ──> G1
  M0 ──────────────────────┘

FASE 2
  R1 (fundação 3D) ──┬──> R2 (culling/LOD/sombras/precisão) ──┐
                     ├──> R3 (picking/realce GPU) ────────────┤
                     └──> R4 (clipping) ──────────────────────┤
  R5 (planta GPU) ─────────────────────────────────────────────┤──> G2
  (R5 depende só de S1/M0; roda em paralelo com R1–R4)

FASE 3
  W1 (WebGPU) ──> W2 (compute medido) ──> G3

FASE 4 (paralela à Fase 2/3)
  P1 (workers) ──┐
  P2 (incremental/WASM) ──┴──> G4

FASE 5
  H1 (escala/soak/visual) ──> G5
```

**Caminho crítico:** S0/S1/S2 → M0 → R1 → R2 → W1 → H1.
**Fora do caminho crítico:** A1/A2, R3/R4/R5, P1/P2 — podem atrasar sem bloquear o gate final.

## 4. Briefs detalhados

### S0 — Sonda de GPU real

**Missão:** responder, com dados, qual camada cada ambiente suporta.
**Passos:** Chrome/Edge na RX 580; `navigator.gpu.requestAdapter()`; `adapter.info`, `limits`, features
(timestamp-query); `chrome://gpu`; abrir `?gpu=webgpu&debug=1`; testar perda/recuperação de dispositivo.
Se WebGPU for requisito de produto, spike mínimo em Tauri (WebView2, `additionalBrowserArgs`) e Electron
(`--enable-unsafe-webgpu`, `--ignore-gpu-blocklist`, `--use-angle=d3d12`).
**Aceite:** relatório com camada A/B/C por ambiente, VRAM aproximada, e veredito “WebGPU viável? sim/não/condicional”.
**Proibido:** mudar o default do app; instalar runtime sem confirmar.

### S1 — Instrumentação

**Missão:** tornar o custo visível por cenário.
**Passos:** timer de GPU (WebGL2 `EXT_disjoint_timer_query_webgl2`; WebGPU timestamp), contadores de draw calls,
triângulos, uploads, rebuilds de camada, commits React, tempo de worker; overlay `?perf=1`; teste que falha se
o quadro passar do orçamento.
**Aceite:** um comando gera JSON com contadores e top 5 por cenário (abrir, planta, pan, zoom, hover, seleção,
edição, 3D, pick, corte).
**Proibido:** alterar geometria ou comportamento visual.

### S2 — Projeto grande

**Missão:** gerar cenários que representem uso real grande.
**Passos:** estender `projeto-sintetico.mts` para pavimentos (10/30/60) e paredes por pavimento (32/128/256),
com aberturas, ambientes e rótulos proporcionais; integrar ao `medir:gpu`; gerar os JSON.
**Aceite:** 60 pavimentos/256 paredes abre e mede sem estourar memória; cenário documentado e reproduzível.

### A1 — Caminho quente

**Missão:** inserção e abertura dentro da meta, sem piorar nada.
**Passos:** perfilar `pointerup → rAF1 → rAF2`; remover `useProject()` do `App`; estreitar assinaturas só nos
componentes quentes; conferir Worker por HTTP; medir cada hipótese em commit separado.
**Aceite:** inserção mediana ≤25 ms (10 repetições, HTTP), abertura ≤300 ms, pan/zoom/pick sem piora >10%.
**Proibido:** refatorar o app inteiro; tocar em `packages/render`.

### R1 — Fundação 3D GPU

**Missão:** a base sobre a qual todo o resto da 3D será construído.
**Passos:** gestor de recursos GPU; buffer por categoria/elemento; atualização parcial; instancing/batching de
pisos, lajes, telhados, escadas, arestas e esquadrias; orçamento de VRAM; caminho de referência por flag.
**Aceite:** 60 pavimentos com draw calls no orçamento; zero alocação de geometria por quadro; pick/realce e imagem iguais.
**Proibido:** mudar topologia ou junção; quebrar o caminho `instanciar: false`.

### R2 — Culling, LOD, sombras e precisão

**Missão:** manter 60 fps em projeto grande sem artefatos.
**Passos:** culling por frustum/nível; oclusão (WebGPU depth pyramid; WebGL2 query/CPU compactado); LOD por
distância/tamanho; CSM ou atlas de sombra; reversed-Z/log depth e rebase de origem (RTC).
**Aceite:** 60 pav ≤16 ms; sem z-fighting em prédio alto; sombra sem serrilhado grosseiro; visual igual dentro da tolerância.
**Proibido:** mudar a imagem de referência sem aprovação.

### R3 — Picking, seleção e realce na GPU

**Missão:** seleção/hover sem cópia de triângulos e sem varredura linear.
**Passos:** ID buffer/MRT; leitura assíncrona; stencil/outline para realce; fallback BVH; seleção múltipla.
**Aceite:** hover/seleção ≤8 ms em 60 pav; zero cópia de triângulos; resultado idêntico ao atual.
**Proibido:** remover o fallback BVH.

### R4 — Clipping planes

**Missão:** cortes/elevações sem geometria de corte na CPU.
**Passos:** plano de recorte por vista; view range/crop/section box; fallback CPU; teste de imagem.
**Aceite:** abrir corte sem gerar geometria de corte; imagem dentro da tolerância; pan/zoom ≤8 ms.
**Proibido:** mudar a semântica de corte/junção.

### R5 — Planta GPU

**Missão:** pan, zoom, hover e seleção sem reconstruir a planta.
**Passos:** separar cursor/inferência/prévia da chave da sobreposição; hachura procedural no fragment shader;
traço sem lotes dinâmicos desnecessários; rótulos com LOD/culling (DOM ou SDF, decidir por medição).
**Aceite:** pan/zoom ≤8 ms, hover/seleção ≤8 ms, contador de rebuilds = 0, hachura sem geração CPU por quadro.
**Proibido:** perder legibilidade de texto/hachura; mexer no 3D.

### W1 — WebGPU

**Missão:** promover a camada A sem perder a B.
**Passos:** boot, perda/recuperação, timers, memória, matriz de fallback, teste automatizado por camada.
**Aceite:** WebGPU estável 1 h na RX 580 (se disponível); fallback WebGL2 igualmente rápido; ou decisão registrada.

### W2 — Compute medido

**Missão:** usar compute só onde ele ganha.
**Passos:** culling/LOD/compactação de instâncias/hachura; comparar com o caminho WebGL2; manter topologia fora.
**Aceite:** ganho ≥15% no cenário alvo ou descarte documentado.

### P1 — Workers

**Missão:** tirar a construção de geometria da main thread.
**Passos:** worker de montagem 3D; worker da lista da planta; transferables; fila/cancelamento/versão; fallback.
**Aceite:** main thread sem tarefa >50 ms na abertura e na edição; resultado igual.

### P2 — Incremental e WASM

**Missão:** editar sem varrer o projeto inteiro.
**Passos:** patch por elemento; exato assíncrono; medir junção; WASM só se dominar o perfil.
**Aceite:** edição visual ≤16 ms; exato ≤100 ms; sem divergência de resultado.

### H1 — Endurecimento

**Missão:** provar que aguenta projeto grande e uso longo.
**Passos:** 60 pav/256 paredes, soak 1 h, VRAM/heap, matriz de fallback, visual equality, suíte 2×, doc final.
**Aceite:** G5 fechado com números; nenhum vazamento; decisão de WebGPU registrada.

## 5. Janelas de medição

**M0 (após S1/S2):** baseline 10/30/60, WebGL2 e WebGPU, 10 repetições, máquina ociosa.
**M1 (antes de H1):** repetir exatamente o método do M0.
**Regras:** nenhum agente constrói durante a medição; registrar commit, Chrome, GPU, processos `node`;
usar mediana e p95; salvar JSON em `scripts/perf-baselines/`.

## 5.1 Funil de testes (rápido por padrão, completo só nos gates)

O plano **não precisa rodar a suíte inteira a cada agente**. O teste caro é o amplo; o barato é o específico.
A regra é: **a cada mudança, rode o teste que prova aquela mudança; a suíte ampla só no gate de fase e no release.**

| Nível | Quando | O que roda | Tempo alvo |
|---|---|---|---|
| **L0 — durante** | a cada edição | `vitest` do arquivo/teste tocado, `tsc --noEmit`, eslint dos arquivos, 1 micro-bench | ≤2 min |
| **L1 — fecha agente** | antes do merge | testes do pacote tocado + teste de igualdade + e2e afetado + 1 captura da vista afetada | ≤10 min |
| **L2 — fecha fase** | gate | `test:rapido` + e2e afetados + visual das vistas afetadas + medição 10/30/60 do cenário da fase | ≤20 min |
| **L3 — release** | fim | `test:completo` 2× + visual completo + `test:perf` + soak 1 h + matriz de GPU | 30–60 min |

**Não dá para adiar (por mudança):**
- igualdade de geometria/topologia (junção, clipping, sólidos, patch);
- diff de imagem da vista afetada em mudança visual;
- orçamento do cenário alvo (1 execução, mediana de 3);
- typecheck + lint dos arquivos tocados;
- zero erro de página no e2e afetado.

**Pode adiar para L2/L3:**
- suíte unitária inteira;
- e2e não relacionado;
- baseline visual completo;
- repetição 2× para flakiness;
- soak de 1 h;
- matriz WebGPU/WebGL2/CPU;
- medição oficial de 10 repetições.

**Módulos críticos** (sempre L1 mais forte, com property seeds direcionadas):
`packages/engine/src/junction*`, `fluxoPatch`, `packages/model/src/validate*`,
`packages/render/src/model3d/solids*`, `packages/render/src/section/build*`, `geometryCache`.
Nesses, não se adia igualdade nem teste de propriedade do caso tocado.

**Comandos do funil:**

```powershell
# L0
npx vitest related <arquivos alterados>
npx vitest run <teste específico>
npx tsc -p tsconfig.json --noEmit
npx eslint <arquivos>

# L1
npx vitest run <pasta do pacote tocado>
node tests/e2e/<cenário afetado>.mjs
npx vitest run --config vitest.perf.config.ts <arquivo *perf.test.ts>

# L2
npm run test:rapido
node tests/e2e/visual-regression.mjs
npm run test:perf

# L3
npm run test:completo          # 2×
npm run test:completo
```

Observação: `visual-regression.mjs` hoje não tem filtro por caso. Ou roda inteiro no L2 (é barato perto da suíte),
ou o S1/S2 adiciona `--caso <nome>` como melhoria de infraestrutura. O mesmo vale para um filtro no `perf-browser`.

**Medição oficial é de um dono só:** agentes de código fazem micro-bench (3 execuções) do cenário que estão
mudando; `M0`/`M1` fazem as 10 execuções oficiais. Isso evita 17 agentes disputando CPU e ruído.

**Integração frequente:** merge diário no ramo de integração, gate de fase uma vez. Caminho incompleto entra atrás
de flag; o teste do caminho principal continua verde.

**Ganho esperado:** corta a maior parte do tempo de teste (de ~15–30 min por agente para ~2–10 min), mas não
transforma 5 semanas em 1 — a arquitetura GPU continua sendo o caminho crítico. O que se ganha é não perder dias
esperando suíte completa em cada etapa.

## 6. Ordem de integração

1. Squad 0: S0, S1, S2 (S1 antes de A1; S2 antes de M0).
2. Squad 1: A2 (só testes) → A1 → I1.
3. Squad 2/3: R1 → R2/R3/R4 em paralelo → R5 (planta) pode entrar antes ou junto.
4. Squad 4: W1 → W2.
5. Squad 5: P1/P2 em paralelo, depois de R1/A1.
6. Squad 6: H1 por último.

Conflitos previstos e resolução:
- `ViewportCanvas.tsx`: A1 → R4 → W1 (um por vez).
- `scene3d.ts`: R1 → R2 (R2 herda o arquivo).
- `quadroPlanta.ts`: A1 → R5.
- `controller.ts`: A1 → P2.
- `gpu.ts`: S1 (ligação) → W1.

## 7. Cronograma realista

| Fase | Duração | Paralelismo |
|---|---|---|
| 0 — Verdade | 2–3 dias | S0, S1, S2 |
| 1 — Estabilização | 2–3 dias | A1, A2 |
| 2 — Fundação GPU | 2 semanas | R1 → R2/R3/R4 + R5 |
| 3 — WebGPU | 1 semana | W1 → W2 |
| 4 — CPU/workers | 1–1,5 semana | P1, P2 (paralelo à 2/3) |
| 5 — Endurecimento | 1 semana | H1 |

**Total:** ~5–6 semanas com 3–4 agentes simultâneos; caminho crítico ~4 semanas.
Não é um plano de 2 dias: é a diferença entre “consertar” e “mudar a arquitetura”.

## 8. Primeira leva (pode começar agora)

```
S0 (sonda RX 580)  ─┐
S1 (instrumentação) ─┼─> M0 (baseline) ─> G0
S2 (projeto grande) ─┘
```

Critério para liberar a Fase 2: G0 fechado com top 5 de custo e resposta de WebGPU na RX 580.

## 9. Prompt de kickoff (modelo)

```text
Repositório: <raiz-do-repositorio>
Worktree: <caminho do worktree>   (trabalhe SOMENTE nele)
Ramo: gpu/<squad>-<id>-<slug>      (não faça push)
Leia: docs/desempenho/plano-subagentes-2026-10-26.md (v3) e
      docs/desempenho/execucao-subagentes-2026-10-26.md (este board), brief <ID>.

Objetivo: <missão do brief>.
Depende de: <ids>. Não comece se o gate anterior não estiver fechado.
Arquivos permitidos: <lista do brief>. Não altere fora dela.
Proibido: git stash, reset --hard, force push, apagar worktree/ramo, topologia em compute.
Obrigatório: teste dirigido + igualdade + orçamento do cenário (L1); suíte ampla só no gate de fase (L2) e no release (L3).
             Typecheck + eslint dos arquivos tocados; commits pequenos; relatório final com números.
Se a meta não for atingida: entregue o perfil e o próximo passo; não declare pronto.
```

## 10. Critério de “board concluído”

- G0–G5 fechados com números.
- 60 pavimentos/256 paredes a 60 fps na RX 580 (WebGL2; WebGPU se disponível).
- Zero rebuild em câmera/seleção; zero geometria de corte na CPU; zero cópia de triângulos no realce.
- WebGPU promovido ou decisão registrada.
- Suíte 2× verde, soak 1 h, visual equality, doc atualizado.
- Nada enviado ao GitHub sem confirmação.
