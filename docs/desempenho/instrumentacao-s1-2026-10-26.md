# Instrumentação de desempenho — S1 (Fase 0.2)

- **Data:** 2026-10-26
- **Base:** `181469f` (`ccr-25143eb2-08pwa4`)
- **Worktree:** `...\.local\share\opencode\worktree\8fed4c\gpu-s1-perf`
- **Ramo:** `gpu/s1-perf` (commit local; sem push)
- **Escopo:** medição. Nenhuma geometria, desenho ou layout foi alterado.

## 1. Entrega

| Arquivo | Papel |
|---|---|
| `packages/render/src/perf/contadores.ts` | Contadores puros (matemática, janela móvel, snapshot JSON) |
| `packages/render/src/perf/registro.ts` | Instância única usada pelo render e pelo app |
| `packages/render/src/perf/webgl.ts` | Interceção de draw/upload do WebGL2 + timer de GPU (`EXT_disjoint_timer_query_webgl2`) |
| `packages/render/src/perf/webgpu.ts` | Contagem de `queue.writeBuffer` no WebGPU |
| `packages/render/src/perf/orcamento.ts` | Comparação do snapshot com as metas da v3 (planta/3D) |
| `packages/render/src/perf/index.ts` | Barrel do pacote |
| `apps/web/src/debug/perf/opcoes.ts` | Leitura de `?perf` / `?overlay` |
| `apps/web/src/debug/perf/overlay.ts` | Overlay discreto (`position: fixed`) e formatação |
| `apps/web/src/debug/perf/index.ts` | `window.__hestiaPerf`, instalação e hooks |
| `packages/render/src/gpu.ts` (alterado) | Ligação mínima: instrumenta o contexto e o render |
| `packages/render/src/plan/planFrame.ts` (alterado) | Conta rebuild de geometria/sobreposição/grade |
| `packages/render/src/index.ts` (alterado) | Exporta a instrumentação |
| `apps/web/src/ui/ViewportCanvas.tsx` (alterado) | Liga os contadores ao rAF (sem mudar o desenho) |

Testes novos: `contadores.test.ts` (11), `webgl.test.ts` (3), `orcamento.test.ts` (4), `opcoes.test.ts` (5) e
`overlay.test.ts` (3): **26 testes determinísticos, sem navegador**.

## 2. Como usar

| URL | Efeito |
|---|---|
| `?debug=1&perf=1` | Mede e mostra o overlay; expõe `window.__hestiaPerf` |
| `?perf=1&overlay=0` | Mede sem overlay (útil para automação) |
| `?perf=0` | Não mede e não mostra overlay; a API responde com zeros (`ativo: false`) |
| sem `perf` | Custo zero de instrumentação; `window.__hestiaPerf` não existe |

No console:

```js
__hestiaPerf.snapshot(); // fotografia JSON (janela móvel, totais, camadas, GPU, indisponíveis)
__hestiaPerf.reset();    // zera quadro/janela/totais, preservando backend e estado do timer
```

O overlay é uma única `<div>` fixa no canto inferior esquerdo, `pointer-events: none`, atualizada a cada 250 ms
(fora do React e sem rAF). Ele não entra no fluxo do layout: a verificação de layout (retângulo do canvas e
`scrollWidth/scrollHeight`) foi idêntica com `?perf=1` e `?perf=0`.

Exemplo de leitura no Playwright:

```js
await page.evaluate(() => window.__hestiaPerf.reset());
// ... interage (pan, zoom, hover, seleção, edição) ...
const s = await page.evaluate(() => window.__hestiaPerf.snapshot());
```

## 3. O que cada número significa

| Métrica | Como é medida | Unidade |
|---|---|---|
| `quadro.ms` / `janela.frameMs` | `performance.now()` em volta do desenho do rAF (`medirQuadro`) | ms de CPU |
| `fps` | Mediana dos intervalos entre quadros; intervalos >500 ms (vista ociosa) são ignorados e `fps` vira `null` | fps |
| `drawCalls` | Interceção de `drawArrays(Instanced)`, `drawElements(Instanced)` e `drawRangeElements` no contexto WebGL2 | chamadas/quadro |
| `triangulos` | Contagem dos modos `TRIANGLES`/`TRIANGLE_STRIP`/`TRIANGLE_FAN`, multiplicada por instâncias; pontos/linhas contam 0 | triângulos/quadro |
| `uploads` / `uploadBytes` | Interceção de `bufferData`/`bufferSubData` (bytes quando o tamanho é conhecido); no WebGPU, `queue.writeBuffer` | chamadas e bytes/quadro |
| `rebuilds` / `camadas` | `PlanFrame.update` quando refaz geometria, sobreposição ou grade | por quadro / total |
| `commitsReact` | `useEffect` sem dependências no `ViewportCanvas` | total |
| `gpu.ms` | Timer query do WebGL2; a amostra fica pronta 1–2 quadros depois e a última disponível é reportada | ms de GPU |

Draw calls são agrupadas entre `iniciarQuadro` (início do rAF) e `encerrarQuadro` (fim do rAF). Se a interceção não
vir desenho (ou no WebGPU), o `renderer.info.render` do three serve de fallback; isso evita contar duas vezes.

## 4. Exemplo real (smoke, não é baseline)

Chrome headless no Windows, build de produção, `?debug=1&perf=1`, projeto `house2`. O script de captura foi temporário
(não versionado). Números de **exemplo**; a medição oficial (10 repetições, GPU real, máquina ociosa) é do M0.

**Planta — 60 quadros de pan (`setViewport` +0,02 m por quadro), depois de `reset()`:**

```json
{
  "ativo": true,
  "backend": "webgl2",
  "fps": 59.9,
  "ocioso": false,
  "quadro": { "indice": 60, "ms": 1.1, "intervaloMs": 16.6, "drawCalls": 32, "triangulos": 6438, "uploads": 0, "uploadBytes": 0, "rebuilds": 0 },
  "janela": {
    "n": 60,
    "frameMs": { "n": 60, "min": 0.7, "mediana": 1.1, "p95": 2.0, "max": 2.6 },
    "drawCalls": { "n": 60, "mediana": 32, "p95": 32 },
    "triangulos": { "n": 60, "mediana": 6438, "p95": 6438 },
    "uploads": { "n": 60, "mediana": 0, "p95": 0 },
    "rebuilds": { "n": 60, "mediana": 0, "p95": 0 }
  },
  "total": { "quadros": 60, "drawCalls": 1920, "triangulos": 386280, "uploads": 0, "rebuilds": 0, "commitsReact": 60 },
  "camadas": { "geometria": 0, "sobreposicao": 0, "grade": 0 },
  "gpu": { "timer": "disponivel", "ms": 0.37664 },
  "indisponiveis": []
}
```

O pan com a câmera mudando não refez camada (`rebuilds: 0`) e não fez upload (`uploads: 0`): o contador confirma a
propriedade que o R5 precisa manter.

**3D — 40 quadros de órbita, depois de `reset()`:**

```json
{
  "backend": "webgl2",
  "fps": 60.2,
  "janela": {
    "n": 40,
    "frameMs": { "mediana": 1.4, "p95": 2.2 },
    "drawCalls": { "mediana": 15 },
    "triangulos": { "mediana": 6362 },
    "uploads": { "mediana": 0 },
    "rebuilds": { "mediana": 0 }
  },
  "gpu": { "timer": "disponivel", "ms": 1.57312 }
}
```

**Troca de nível `lv_1` (um quadro):** `drawCalls: 8`, `triangulos: 1100`, `uploads: 32` (`uploadBytes: 109208`),
`rebuilds: 3` e `camadas: { "geometria": 1, "sobreposicao": 1, "grade": 1 }`. Prova que rebuild/upload saem de zero
quando a camada muda de verdade.

**Edição de parede (`setWallEnds`, 3 quadros):** `triangulos` passou de 1100 para 1132, `uploads` teve máximo 32 no
quadro da edição e `rebuilds` máximo 3; `camadas` acumulou `geometria: 2`, `sobreposicao: 2`, `grade: 1`.

Overlay no fim da órbita 3D:

```text
hestia perf · webgl2 · 60.2 fps
frame 1.2 ms (p95 2.5) · gpu 1.6 ms
draw 15 (p95 15.0) · tri 6.4k
upload 0 · 0 B · rebuild 0
camadas g0/s0/gr0 · commits 31
```

## 5. Validação executada (L1)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erro |
| `npx vitest run packages/render/src/perf apps/web/src/debug` | ✅ 5 arquivos, 26 testes |
| `npx eslint` nos arquivos tocados | ✅ sem aviso |
| `npm run build -w @hestia/web` | ✅ build de produção (Vite, ~30 s) |
| Playwright, build com `?debug=1&perf=1` | ✅ API e overlay presentes; `position: fixed`; zero erro de página |
| Playwright, `?debug=1&perf=0` | ✅ sem overlay; API `ativo: false` |
| Layout com/sem overlay | ✅ idêntico (`x=292, y=219, w=1148, h=583.5`, `scroll 1440×860`) |

## 6. O que ficou indisponível (e por quê)

- **Timer de GPU no WebGPU:** o `WebGPURenderer` do three não expõe timestamp queries; fica `indisponivel` com nota no
  snapshot. É trabalho do W1 (Fase 3) quando o backend for promovido.
- **Draw calls no WebGPU por interceção:** não há ponto equivalente ao `gl.draw*`; o fallback é `renderer.info`, que é
  uma contagem do renderer e não uma interceção. O WebGL2 (caminho obrigatório) é interceptado de verdade.
- **Tempo de worker:** exigiria tocar em `packages/engine/src/worker/cliente.ts` e/ou
  `apps/web/src/editor/resolucaoAssincrona.ts`, ambos fora do escopo do S1 (o A1/P1 são donos depois). **Pendência.**
- **Rebuild na vista de corte:** o corte refaz a lista inteira fora do `PlanFrame`; o contador de camadas não o cobre.
  Se necessário, o R4 adiciona um contador próprio ao caminho de corte. **Pendência.**
- **Upload de textura:** só buffers são contados (`bufferData`/`bufferSubData`/`writeBuffer`); `texImage2D` não entra.
- **Commits React:** o contador é do `ViewportCanvas` (ponto central da tela), não do app inteiro. Serve para detectar
  quantos commits a tela paga por quadro, não para um perfil completo do React.
- **Timer de GPU:** a amostra é assíncrona (1–2 quadros de atraso); se o driver marcar `GPU_DISJOINT`, a amostra é
  descartada. `gpu.ms` é a última amostra válida, não uma média da janela.
- **Números deste relatório:** Chrome headless com `--enable-unsafe-swiftshader --ignore-gpu-blocklist`; o timer
  respondeu, mas **não** são números de hardware nem baseline. O M0 deve repetir com a RX 580.

## 7. Próximo passo

1. **M0:** consumir `window.__hestiaPerf` no roteiro de baseline (`perf-browser`) com `reset()` entre cenários (abrir,
   planta, pan, zoom, hover, seleção, edição, 3D, pick, corte) e gravar mediana/p95 — o schema do snapshot já é JSON.
2. **Orçamento no e2e:** usar `violacoesOrcamento(snapshot, ORCAMENTO_PLANTA | ORCAMENTO_3D)` como asserção de cenário
   (`frameMs`, draw calls, triângulos, rebuilds, FPS). O helper e o teste existem; falta ligar ao `perf-browser`/e2e.
3. **A1/P1:** instrumentar tempo de worker quando esses arquivos forem abertos (hoje é pendência declarada).
4. **W1:** timestamp queries no WebGPU e contagem de draw sem depender de `renderer.info`.
5. **R4/R5:** contador de rebuild da vista de corte e uso do `rebuilds = 0` como gate de câmera.

## 8. Nota de ambiente (worktree)

Neste worktree o `node_modules` é uma junção para o `node_modules` do repositório principal, e `@hestia/*` apontava para
os pacotes do repo principal. Para typecheck/build/testes enxergarem o código deste ramo, foi criada a junção local
`apps/web/node_modules/@hestia/render → <worktree>/packages/render` (não versionada). No repositório principal, após o
merge, a resolução normal de workspaces continua valendo.
