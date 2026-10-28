# Port GPU/H1 do MiniBIM2 para o Hestia (2026-10-28)

- **Branch:** `perf/gpu-port`, a partir de `integracao/telhados-grades` (`1f449577`)
- **Commits:** `8f61f945` (W1/R2/P1/M1), `a3b4052b` (R3/R4/R5), `de1dd44c` (referências GPU + soak)
- **Objetivo:** trazer a frente GPU/H1 sem perder telhados, grades, esquadrias e o snapshot de `sketch`.

## 1. Baseline antes do port

- `npm run typecheck`: verde.
- `npm run test:rapido`: **487 arquivos / 5.444 testes**, 0 falhas.
- `npm run test:perf`: **falhava** em `snapFaces` (~5.700 ms, razão ~100; limite 30). K4 passava.
- `npm run build`: verde.
- Referências GPU estavam defasadas em relação ao commit `1f449577` (corte de telhado); o visual de CPU já estava atualizado.

## 2. O que foi portado

| Frente | Estado |
|---|---|
| **W1** | `gpu/backend.ts`, `gpu/contexto.ts`, `gpu/controlador.ts`, fachada `gpu.ts` e boot do `ViewportCanvas` com `criarControladorGpu`, fallback e restore |
| **R2** | `faixas3d.ts` (12 níveis/faixa), `precisao3d.ts`, `sombras3d.ts` com orçamento/LOD, `scene3d.ts` com faixas e `antesDeDesenhar` |
| **R3** | `pickIdBuffer3d.ts`, `indiceDeElementos3d.ts`, `pick3d`, `highlight3d`, `realceDaCena3d`, `selecao3d` e integração no `ViewportCanvas` |
| **R4** | `section/frame.ts`, `section/clip.ts`, `section/build.ts`, `SectionCanvas` e cache `secDl` no `ViewportCanvas` |
| **R5** | `gpuPlan` com 11 slots, lotes `fm/b/sd/h`, hachura procedural, `planOverlay` em seleção/hover/viva, `planFrame` com 4 chaves, `build/grid/roofs` com merge manual |
| **P1** | `montagem3dNiveis.ts`, montagem progressiva com worker e teste de fila do worker com `vi.waitFor` |
| **M1** | filtro de `faceTracks` perto do cursor em `tools/infer.ts` |

### Correção adicional no R3

O `renderer.render(cena, câmera, alvo)` do three 0.180 ignora o terceiro argumento. O port passou a chamar `setRenderTarget(alvo)` antes do passe de IDs e `setRenderTarget(null)` no `finally`; sem isso, o ID buffer lia `undefined` e o picking caía sempre no BVH.

## 3. Testes e validação

| Validação | Resultado |
|---|---|
| `npm run typecheck` após o port | **verde** |
| Render/plan/section + P1 | **102 arquivos / 1.397 testes**, 0 falhas |
| `npm run test:perf` | **verde**: snap 599 ms / razão 10,1; K4 2.259 ms / 39,2 e 1.505 ms / 7,3 |
| `visual-regression.mjs` (CPU, telhados/grades/esquadrias) | **36/36 casos, 0,000%** |
| `visual-regression-gpu.mjs` | **6/6 casos**, GPU × CPU dentro do limite; referências GPU regravadas |
| `grades.mjs` | **5/5**, sem erros |
| `planta-cobertura.mjs` | **6/6**, telhado opaco e troca piso↔cobertura sem geometria velha |
| `npm test` (suíte completa) | **496 arquivos / 5.651 testes**, 0 falhas |
| Soak 60×128 (5 min) | **52 ciclos, 0 erros**, 5,1 min, heap estável ~395–449 MB, V8 173 MB após GC |
| `verificacao-visual.mjs --strict` | **42 PASS / 1 FAIL / 0 PENDENTE**; falha só no botão “Etiquetar todos” oculto no ribbon compacto do Hestia |
| Soak 60×128 (1 min) | **7 ciclos, 0 erros**, abertura 2.640 ms, heap estável ~418 MB |

## 4. Interação no navegador (3 repetições, build de produção)

| Medida | 10 pav | 20 pav |
|---|---:|---:|
| Abrir projeto | 304 ms | 352 ms |
| Planta do nível do meio | 30,6 ms (p95 491) | 51,3 ms (p95 396) |
| Seleção na planta | 9,9 ms | 12,3 ms |
| Edição de parede | 34,5 ms | 45,7 ms |
| Porta / janela | 134,9 / 141,1 ms | 154,8 / 157,2 ms |
| Parede nova | 22,5 ms | 19,4 ms |
| Pan / zoom | 20,4 / 16,6 ms | 20,1 / 16,5 ms |
| Pick 3D | 11,1 ms | 11,0 ms |

**Pendências do `perf-browser`:** inserção de porta/janela não confirma 3/3 no undo e a contagem de aberturas não volta. É comportamento da área de esquadrias do Hestia, que não foi tocada neste port; o `openingTool`/A1c continua fora do escopo.

## 5. O que ainda falta

1. **A2 — “Etiquetar todos”**: botão não visível no ribbon compacto; é UI/Hestia, não geometria.
2. **Inserção de porta/janela**: 135–157 ms e pendências de undo; exige port próprio de A1c/esquadrias.
3. **Soak de 10 min/1 h**: o smoke de 5 min passou (52 ciclos, 0 erros); a versão longa fica como validação extra.
4. **Suíte completa**: verde no commit do port (ver seção 3).
5. **Crop/section box**: `clip.ts` é biblioteca, sem UI (mesmo estado do MiniBIM2).
