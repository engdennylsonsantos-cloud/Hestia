# Progresso do agente GPU — merge do port GPU no plano de unidades/cotas

Data: 2026-10-28. Branch local `plano/gpu`, integrada em `origin/claude/fervent-newton-rfgz3y`.

## 1. Merges e conflitos

O merge do port GPU (`origin/perf/gpu-port`, base `integracao/telhados-grades`) foi feito em três etapas para absorver o trabalho dos outros agentes sem perder nenhum lado:

| commit | o que trouxe |
| --- | --- |
| `f4ea758d` | `origin/perf/gpu-port` (5f00d0b3) sobre o estado do plano |
| `020d09af` | `origin/claude/fervent-newton-rfgz3y` em 99b6134c (C5 parcial) |
| `71c1ddc7` | `origin/claude/fervent-newton-rfgz3y` em 0c560c68 (C5/C7 finais; merge limpo) |

### `packages/render/src/model3d/scene3d.ts` (1 bloco)
Mantidos os dois lados: o port da GPU (faixas por 12 níveis, orçamento de sombra, profundidade, `caixasEPrismasDaAbertura`, `arestasDaSilhuetaDeCaixas`, `desenharLotes` com `arestasGrupos` e `prismasSemArestas`) e o trabalho do plano de aberturas/esquadrias (`caixasEPrismasDaAbertura`, `montarAbertura`, `loteDeGeometria`, alizar em L). A diretiva `eslint-disable max-lines` foi acrescentada no topo, com o motivo, porque a cena agora reúne as duas frentes.

### `packages/render/src/plan/ceilings.ts` (1 bloco)
Hachura do forro com a forma da GPU (`...(fine ? {} : { zoomMin: 40 })`, o shader esconde) e formatação de área do plano (`fmtArea(unitsOf(p), ...)`, `outlineSelectionOps(..., unitsOf(p), ...)`). O `zoomAtinge` antigo saiu (a decisão de zoom virou `zoomMin`).

### `packages/render/src/plan/planOverlay.ts` (2 blocos)
Overlays separados da GPU (seleção, hover e camada viva) preservados; a cota temporária de parede passou a usar `formatQuantity(unitsOf(p), 'length', len)` em vez do texto com `toFixed` e sufixo `m` fixo.

### `packages/render/src/section/build.ts` (2 blocos)
Peças agrupadas do alizar do plano (`projetarComPerfis`, união dos anéis por `group`, hachura da peça cortada) preservadas, junto do que a GPU mudou na pintura: `zoomMin`/`HATCH_ZOOM_EPS`, `strokeWidth(edge)` e o filtro de anéis. O `projectParts` foi substituído por `projetarComPerfis`; `ProjectedRing`, `formatQuantity` e `unitsOf` entraram nos imports.

### `packages/render/src/plan/planFrame.ts` (conflito do merge 020d09af)
Mantidas as **três** camadas de sobreposição da GPU (`overlay` de seleção, `hover` do cursor e `live` de prévia/guias) e aplicado `unitsOf(p)` na chamada de `comEsboco` da camada viva, que é onde o esboço é somado (evita desenhar o esboço duas vezes).

Nenhum `checkout --ours/--theirs` em bloco foi usado. Fora dos conflitos, o único ajuste foi a diretiva de lint em `scene3d.ts` e a referência visual descrita em §4.

## 2. Verificações (todas executadas no estado final)

| verificação | resultado |
| --- | --- |
| `npx tsc -p tsconfig.json --noEmit` | verde (executado após cada merge) |
| `npx eslint packages/render/src packages/tools/src apps/web/src` | 0 erros; 1 aviso pré-existente (`OpeningFlipGrips.tsx:70`, `tick` em `useMemo`) |
| `node scripts/check-boundaries.mjs` | fronteiras ok |
| `node scripts/check-units.mjs` | unidades ok |
| `node scripts/check-parity.mjs` | porta de qualidade ok |
| `node scripts/check-props-density.mjs` | paleta ok |
| `npx vitest run packages/render packages/tools apps/web` | **336 arquivos / 3562 testes, 0 falhas** |
| `npm run check` | lint + typecheck verdes; suíte completa **567 arquivos passaram, 1 falhou por timeout** (`packages/engine/src/openingCatalogo.test.ts`, 5 s, sob carga). Isolado: **12/12 em 50 s** (o teste mais pesado sozinho leva 4,6 s, no limite). Falha de tempo por contenção, não de produto. |
| `npm run build` | verde (802 módulos) |
| `tests/e2e/visual-regression-gpu.mjs` | **6/6** (GPU × CPU nas paredes dentro do limite) |
| `tests/e2e/verificacao-visual.mjs --strict` | **45/45** critérios, 0 FAIL/0 PENDENTE |
| `tests/e2e/planta-cobertura.mjs` | **6/6** passos |
| `tests/e2e/grades.mjs` | **5/5** |
| `tests/e2e/montagem3d-tarefas.mjs gpu-merge` | P1 rodou 10×32, 20×32 e 60×128 (1 repetição). Artefato `p1-tarefas-gpu-merge.json` **não versionado**, como o handoff manda. |
| `tests/e2e/soak.mjs` (`SOAK_MIN=1`) | **1,1 min · 10 ciclos · 0 erros**, backend `webgl2`, heap isolado 81,8 → 231,4 MB (amostra curta; não é o soak de 5 min do handoff) |

## 3. O que não pôde rodar

- **GPU real (hardware).** Todos os e2e rodaram em Chrome com WebGL2 por **SwiftShader** (CPU). Não houve validação em placa de vídeo real: precisão de profundidade, atlas de sombra, restauração de contexto e memória de GPU seguem cobertos só por teste unitário/simulação.
- **Soak longo** (5 min e 1 h) não refeito aqui; o handoff registra 5,1 min / 52 ciclos / 0 erros. Rodei 1,1 min para não segurar a integração.
- **`tests/e2e/visual-regression.mjs`** (CPU puro) não roda no Windows deste PC: os caminhos de Chromium são fixos de Linux (`/opt/pw-browsers/...`). O `visual-regression-gpu.mjs` cobre os 6 casos de maior risco comparando GPU × CPU.
- **A1c / `perf-browser`** (inserção de porta/janela e undo) continua pendência do handoff; o `openingTool` não foi portado.
- **Crop/section box** (`section/clip.ts` como biblioteca, sem UI/modelo).

## 4. Riscos visuais

- `tests/e2e/baseline-gpu/planta-porta-janela.png` foi **regravada**: o desenho da folha de porta e do caixilho mudou por causa do trabalho de esquadrias/alizar do plano (D10.2/D10.3), não pelo port da GPU. A diferença medida foi 0,251 % (folha e caixilho); as outras cinco referências GPU permaneceram idênticas. Sem outras mudanças de referência.
- A hachura passou a ser escondida pelo shader via `zoomMin`; o caminho CPU também lê `zoomMin` (`resolverZoom`), coberto por `ouroZoom`/testes de zoom. Divergência entre CPU e GPU fica no antisserrilhado da hachura (≤ 15 % de tinta nas paredes no teste).
- As três camadas de sobreposição da planta (seleção/hover/viva) mantêm o esboço apenas na camada viva; se um dia o esboço precisar aparecer junto da seleção, ele deve ser somado uma única vez.
- `packages/render/src/plan/__snapshots__/sketch.test.ts.snap` aparece como modificado só por normalização LF/CRLF; **não** foi commitado.
