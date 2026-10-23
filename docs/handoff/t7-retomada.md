# T7 · Handoff de retomada (parou em 2026-10-22/23)

Estado do T7 — "contorno de piso/laje pela face externa do NÚCLEO das paredes" e "topo da parede na face superior"
(o *Extend into wall (to core)* do Revit). Especificação completa: `docs/handoff/t7-brief.md` (neste commit).
Regras do projeto: `docs/handoff/regras-gerais.md`. Decisões que a feature cria: `docs/decisoes/0026-contorno-pelo-nucleo.md`
(**ainda não escrita** — ver §6).

Branch: `claude/wizardly-goldberg-qtjveg` (push para `origin`). Worktree: `<raiz-do-repositorio>`.

## 1. Onde parou

| Fase | Escopo | Estado |
|---|---|---|
| 0 | núcleo visível nos editores de piso e de laje | **feita** (2 commits) |
| 1a | motor: `extend: 'core'`, perímetro do núcleo, `auto` inteligente | **feita** (2 commits) |
| 1b | ferramentas, UI (`OptionsBar`, `SlabOptionsBar`, `OutlineGroup`) e avisos | **não começou** |
| 1c | e2e `laje-nucleo.mjs`, baselines visuais novas, paridade | **não começou** |
| 2 | topo da parede na face superior (`attachTopFace`) | **não começou** |
| docs | decisão 0026, paridade, `02-MODELO-BIM`, `06-PROPRIEDADES`, HANDOFF | **não começou** |

Commits desta sessão (do mais antigo ao mais novo):

```
4c59c6c wip: fase 0a núcleo derivado para piso e laje (coreRange/coreSpan por camadas)
83a72e3 wip: fase 0 núcleo visível nos editores de piso e laje
db1372f wip: fase 1a perímetro pela face externa do núcleo (extend, coreOutline, cache por nível+extensão)
064887e wip: fase 1 auto no perímetro pelo núcleo (camadas e fachada contínua)
```

Depois desses commits a branch foi integrada com o `origin` (`git merge origin/claude/wizardly-goldberg-qtjveg`), que tinha
o commit `f0462eb fix(engine): parede anexada a piso/laje respeita o término por camada (parede de baixo preenche o vazio
da laje)`. O único conflito foi de documentação (`docs/decisoes/0025-...`, resolvido mantendo as duas seções e renumerando
a nova para §11). **Esse commit remoto mexe em `wallAttach.ts`, `resolve.ts`, `terminoBlock.ts`, `types.ts` e cria
`attachTargets.ts`** — leia antes da Fase 2 (§6).

Verificação no estado integrado: `npx tsc -p tsconfig.json --noEmit` limpo e
`npx vitest run packages/engine packages/model` = 127 arquivos / 1758 testes verdes. Antes do merge: `npx eslint
packages/engine packages/model apps/web` limpo, `npx vitest run apps/web` 36 / 329.
**Nada de e2e, baselines, `test:completo`, `test:perf` nem build ainda.**

## 2. O que está implementado (e como conferir)

### Fase 0 — núcleo derivado também para piso e laje
- `packages/model/src/wallType.ts`: `totalThickness`, `coreRange`, `layerSpans`, `coreSpan` passam a aceitar
  `{ layers: readonly Layer[] }` (parede, piso, laje). Comportamento idêntico ao anterior para `WallType`.
- `packages/model/src/wallType.test.ts` (novo, 5 casos): núcleo no meio, duas estruturas, sem estrutura, lista vazia,
  núcleo na primeira camada.
- `apps/web/src/ui/dialogs/coreHint.ts` + `coreHint.test.ts`: texto da nota do núcleo
  (`Núcleo: camadas 3 a 3, de 3,0 a 22,0 cm da face de cima.` / `Sem camada Estrutura: o núcleo é o elemento inteiro.`).
- `FloorTypeDialog.tsx` e `SlabTypeDialog.tsx`: linha da camada do núcleo com `className="core"`, badge `P{n}` da
  prioridade efetiva (`fn-cell`/`pbadge`, igual ao editor de parede) e a nota do `coreHint` abaixo da espessura total.
- `FloorSectionPreview.tsx` e `SlabSectionPreview.tsx`: borda `var(--accent)` nas camadas do núcleo + colchete "núcleo".
  Não muda geometria, quantitativo nem desenho do modelo.

### Fase 1a — perímetro pelo núcleo (motor)
- `packages/model/src/types.ts`: `OutlineSource.extend?: 'finish' | 'core'` (aditivo, ausente = `'finish'`, sem
  `SCHEMA_VERSION` e sem migração). Só é lido no `mode === 'perimeter'`.
- `packages/engine/src/faces.ts`: `WallFaces.coreOutline` (contorno da faixa do núcleo, mesma construção do `outline`,
  com `layerQuad` e `sAtDepth`, inclusive em parede curva).
- `packages/engine/src/enclosed.ts`: `outlinePieces(..., extend)` usa `coreOutline` (fallback `coreSilhouette`);
  `buildingOutlines(p, levelId, extend = 'finish')` com **cache por `${levelId}|${extend}`**;
  `outerPerimeter(p, levelId, near?, extend = 'finish')` (reusa `RoomExtend`, sem tipo novo).
- `packages/engine/src/outlineBound.ts`: no modo perímetro, `outerPerimeter(..., src.extend === 'core' ? 'core' : 'finish')`.
- `packages/engine/src/layerOutline.ts`: `const perimetroCore = !linked && src?.mode === 'perimeter' && src.extend === 'core'`;
  no ramo do `auto`, camada **fora** do núcleo → `regionMinusWalls(p, base, wallsNow(), { kind: 'face' }, zoneOf(i).z0, zoneOf(i).z1)`
  (para na face interna); camada do núcleo (e tipo sem estrutura) fica no contorno do elemento. Término explícito
  (`face`, `nucleo`, `passa`, `{ ate }`, `{ cm }`) continua vencendo, sem mudança.
- **Não foi tocado** (decisão D5): `junctionPlanar.ts`, `junctionLevel.ts`, `junctionNet.ts`, `wallJunction.ts`,
  `floors.ts`, `slabs.ts`, `section*`.

### Testes que provam a fase 1 (valores calculados à mão, não copiados da saída)
- `packages/engine/src/perimeterCore.test.ts` — cenário: 4 paredes de 0,20 m (`finish1 0,02 | structure 0,16 | finish1 0,02`),
  retângulo 4 × 3 m **em sentido horário**, **`locationLine: 'coreExterior'`**, juntas `miter`.
  - perímetro de acabamento = 4,04 × 3,04 = **12,2816 m²**; perímetro do núcleo = 4 × 3 = **12,0 m²**;
    camada fora do núcleo para na face interna = 3,64 × 2,64 = **9,6096 m²**.
  - casos: `ls_a` (só estrutura) `[12,0]`; `ls_b` `[9,6096; 12,0]`; `ls_c` (acabamento + membrana + estrutura)
    `[9,6096; 9,6096; 12,0]`; `ls_d` (sem estrutura) `[12,0; 12,0]`; `ls_e` (`passa` explícito) `[12,0; 12,0]`;
    associatividade (acabamento externo 2 → 3 cm) mantém 12,0 e 9,6096 e leva o perímetro de acabamento a 4,06 × 3,06;
    cache: `finish` e `core` não se reaproveitam; `resolveBoundary` repassa o `extend` e ausente vale `finish`.
- `packages/engine/src/wallJunction.test.ts`, caso novo "perímetro do núcleo: a laje no núcleo deixa o acabamento
  externo contínuo (e o de acabamento recorta)": laje de perímetro core num retângulo de 4 paredes + controle com
  `extend: 'finish'`. Asserções: acabamento externo é a mesma camada do nível e a área na cota 0,10 é igual à do projeto
  **sem laje**; a camada do núcleo na cota 0,10 é **0** (faixa cedida, sem sobra); `junc(...).elements.get('s1').cut === false`;
  no controle o acabamento externo **é** recortado.

## 3. Primeiro passo ao retomar (5 min)

```
cd <repo>
git pull --ff-only
npx tsc -p tsconfig.json --noEmit
npx vitest run packages/engine packages/model apps/web
```

Se estiver tudo verde, o estado é o do §1. Depois siga a ordem do §7 do brief: **1b → 1c → 2 → docs → verificação final**.

## 4. Fase 1b — ferramentas, UI e avisos (o que fazer, arquivo por arquivo)

1. `packages/tools/src/types.ts`: `perimeterCore?: boolean` em `ToolOptions` (**não** reusar `floorCore`, que é do modo
   `paredes`). Comentário curto citando a decisão 0026.
2. `packages/tools/src/slabTool.ts`: hoje `clickPerimeter` grava
   `{ mode: 'perimeter', seed: p.raw, linked: true }` (linha ~142) e `movePerimeter`/`perimeterAt` chamam
   `outerPerimeter(p, levelId, at)` (linha ~76). Gravar/desenhar com
   `{ mode: 'perimeter', seed: p.raw, linked: true, ...(perimeterCore ? { extend: 'core' } : {}) }` e
   `outerPerimeter(p, levelId, at, opcao ? 'core' : 'finish')`. Mensagem de criação informa "perímetro pelo núcleo".
3. `packages/tools/src/floorTool.ts`: mesmo tratamento em `clickPerimeter` (~186), `movePerimeter` (~123) e
   `perimeterAt` (~90). Cuidado: `floorCore` continua controlando o modo `paredes` (`walls-core`), não o perímetro.
4. `apps/web/src/ui/OptionsBar.tsx` (piso) e `apps/web/src/ui/SlabOptionsBar.tsx` (laje): caixa "Estender até o núcleo",
   visível só no modo `perimetro`, ligada a `options.perimeterCore`.
5. `apps/web/src/ui/OutlineGroup.tsx`: quando `mode === 'perimeter'` e `extend === 'core'`, mostrar "perímetro do núcleo"
   no texto (o `OUTLINE_MODE_LABEL` continua para os modos). Conferir que desvincular/revincular preserva o `extend`
   (o comando `relinkOutline` usa a origem guardada).
6. Avisos (D7), no padrão de `outlineIssues`/`wallFloorIssues` (não bloqueiam):
   - `contorno-nucleo-sem-estrutura` em `packages/engine/src/outlineIssues.ts`: elemento com `extend: 'core'` cujo tipo
     não tem camada `structure`.
   - `parede-abaixo-da-laje-no-perimetro` em `packages/engine/src/wallFloorIssues.ts`: parede do perímetro externo com
     altura resolvida abaixo do topo do piso/laje do nível de cima (`topLevelId` definido) — é a causa da faixa aparecer.
   - `borda-no-acabamento-externo` (recomendado, se o custo couber): camada de parede fora do núcleo recortada por
     piso/laje de perímetro; detecção pelo resultado da junção (`junctionLevel`, cacheado); se pesar, limitar ao nível
     ativo e registrar como pendência.
   - Ligar em `apps/web/src/editor/useIssues.ts` e conferir o painel de avisos.
7. Testes: `packages/tools/src/perimeterCore.test.ts` (a ferramenta grava `extend: 'core'` nos dois modos e nada quando
   a opção está desligada), `apps/web/src/ui/OutlineGroup.test.ts` (texto "perímetro do núcleo"), e um teste por aviso novo.

## 5. Fase 1c — e2e, baselines e paridade

- `tests/e2e/laje-nucleo.mjs`, no padrão de `tests/e2e/parede-recorte.mjs`: criar parede e laje pelo perímetro do núcleo
  pela UI, ler área e partes por camada em `window.__hestia`, conferir a área esperada e que o acabamento externo não foi
  cortado, sem erro de console.
- Regressão visual (`node tests/e2e/visual-regression.mjs`, baselines em `tests/e2e/baseline`): **2 casos novos**
  (`laje-perimetro-nucleo`, `parede-topo-face-superior`), baselines criadas e conferidas a olho.
  **Não atualizar as baselines antigas** (divergência de banner/texto é do ambiente).
- Paridade: `docs/paridade/lajes.md` A2 e `docs/paridade/pisos.md` A2 ("face do núcleo"), `docs/paridade/paredes.md` C1
  (topo na face superior). Depois `node scripts/check-parity.mjs`.

## 6. Fase 2 e documentos

Fase 2 (topo da parede na face superior), como no brief §6:
0. **Antes de tudo**, ler o commit remoto `f0462eb` (já integrado): `attachSpans` não usa mais `bottoms`/`mins` do
   elemento inteiro — a base é o maior `z1` e o topo o menor `z0` entre as **camadas com volume que cobrem o ponto médio**
   do trecho (`facesAt` + `attachTargets.ts`, memoizado). O modo `'topside'` tem de entrar nessa mesma conta, escolhendo
   a face de cima da camada mais alta (topo) em vez da face de baixo da mais baixa.
1. `packages/model/src/types.ts`: `Wall.attachTopFace?: 'underside' | 'topside'` (ausente = `'underside'`).
2. `packages/engine/src/wallAttach.ts`: `attachSpans` ganha o modo; `topside` usa `facesAt(...).tops` com `Math.max`
   (simétrico da base, que já usa `tops`/`max`) e `underside` continua `bottoms`/`min`. `facesAt` já resolve a inclinação.
3. `packages/engine/src/wallZ.ts`: `wallZRange` repassa o modo quando `attachTopToFloor === true && topLevelId !== null && !profiled`.
4. `apps/web/src/ui/Properties.tsx`: o botão "Topo no piso" vira seletor "Topo: Nível | Face superior | Face inferior",
   com dica de que "face inferior" expõe a borda da laje. "Nível" = `attachTopToFloor: false`.
5. Teste `packages/engine/src/wallTopFace.test.ts`: laje reta → topo na cota do topo da laje; laje inclinada → cota no
   ponto médio do trecho; parede coberta em metade do eixo → perfil em degrau; `topside` sem `attachTopToFloor` é
   ignorado; quantitativos sem sobreposição dupla.
6. **Template não muda** (D8): registrar no HANDOFF que 2,80 m de parede com níveis a 3,00 m deixa a parede 8 cm abaixo
   da face inferior da laje, e que mudar é decisão do dono.

Documentos a escrever/atualizar: `docs/decisoes/0026-contorno-pelo-nucleo.md` (D1–D9, citando o T7), status em
`docs/decisoes/0025-...` §9 e em `0023` (seção da P7c parte 2) se a redação do `auto` mudar, `docs/02-MODELO-BIM.md` §3,
`docs/06-PROPRIEDADES-E-DIALOGOS.md`, `docs/HANDOFF.md`. **Não editar** `docs/07-STATUS-V1.md`, `docs/paridade/ORDEM.json`
nem `package.json`.

## 7. Comandos de verificação final (§7 do brief)

```
npx tsc -p tsconfig.json --noEmit
npx eslint packages/engine packages/model packages/tools packages/render apps/web
npx vitest run packages/engine packages/model packages/tools apps/web
node scripts/check-boundaries.mjs
node scripts/check-parity.mjs
node scripts/check-props-density.mjs
npm run test:completo
node tests/e2e/visual-regression.mjs
npm run test:perf
npm run build -w @hestia/web -- --target esnext --minify false   # no Windows a minificação do esbuild falha
node tests/e2e/laje-nucleo.mjs
```

## 8. Como o serviço foi dirigido (útil para repetir nas fases 1b/1c/2)

- Modelo escolhido por probe comparativo entre os `-free` do OpenCode Zen: **`opencode/deepseek-v4.1-flash-free`**
  (correto em TS estrito, rápido ~20–30 s em tarefa pequena, mexe só nos arquivos pedidos). Alternativa boa:
  `opencode/glm-5.3-flash-free`. Evitar `mimo-v2.6-flash-free` (instala pacotes e polui o diretório) e
  `flint-40b-free` (lento, 3 min+).
- O modelo roda pelo **CLI**, não pelo MCP: o servidor MCP `opencode-zen-free` do Reasonix está configurado para
  `D:/MEUS PROJEETOS/PLUGIN/PLUGIN DEEPSEEK OPEN CODE/src/server.js` — caminho **inexistente** (erro
  `MODULE_NOT_FOUND` ao iniciar). Usar `opencode run` direto.
- Receita usada (PowerShell, na raiz do repo; a spec em uma linha porque a mensagem vai como argumento):

```powershell
$spec = (Get-Content -Raw 'docs\handoff\t7-prompts\<spec>.md') -replace "`r?`n", " "
$env:NO_COLOR = '1'
opencode run -m opencode/deepseek-v4.1-flash-free --dir <raiz-do-repositorio> --auto $spec
```

- As quatro specs já usadas estão em `docs/handoff/t7-prompts/` (`fase0a`, `fase0b`, `fase1ai`, `fase1aii`) — servem de
  molde para as próximas: contexto, arquivos exatos, comportamento, **valores calculados à mão**, proibições e comandos
  de verificação.
- Lições aprendidas: (a) rodar o `opencode` como **job em background** e ler a saída depois — em foreground ele estoura
  o limite de tempo da ferramenta e o processo pode morrer no meio; (b) subagente com `write_paths` declarado **não**
  recebe shell de escrita (o gate recusa `pwsh`), então ou não declare `write_paths`, ou rode o `opencode` direto;
  (c) auditar sempre se o modelo não "ajustou" os valores esperados do teste para casar com a saída (teste tautológico) —
  as specs trazem as contas à mão justamente para isso; (d) conferir `git status` depois: reverter qualquer arquivo fora
  do escopo (o `--auto` aprova escrita e shell).

## 9. Riscos e pendências herdadas do brief (testar)

- `passa` + topo na face superior = volume duplicado na faixa (0025 §9.6): não usar `passa` com `extend: 'core'`.
- `flipped` muda o lado do acabamento; o contorno do núcleo não depende dele, mas o teste deve cobrir.
- Tipo sem `structure`: núcleo = elemento inteiro (aviso `contorno-nucleo-sem-estrutura`).
- Piso + laje no mesmo nível sobrepostos é decisão pendente do dono (docs/08) — não depender disso nos testes.
- Laje inclinada: o contorno é em planta; a junção já fica fora para caimento (0023) — não mudar nesta tarefa.
- Planta: a borda do núcleo fica sob a parede; se aparecer linha por fora, o contorno está no acabamento.
- **Observação nova desta sessão**: o valor de associatividade do brief ("mudar o acabamento externo de 2 para 3 cm não
  muda a área da laje") só vale com a linha de localização na face do núcleo (nos testes, `locationLine: 'coreExterior'`).
  Com `wallCenter` a espessura do acabamento move as duas faces e a área muda um pouco. Vale ajustar a redação do brief e
  da decisão 0026 quando ela for escrita.

## 10. Estado do worktree

- Commits desta sessão no topo da branch (§1). `docs/handoff/t7-brief.md` e `docs/handoff/t7-prompts/` entram neste commit.
- `.reasonix/` aparece como não rastreado: é metadado do editor (Reasonix), **não commitar**.
- Fora do repositório ficaram apenas as specs originais em `%TEMP%\t7\` (já copiadas para `docs/handoff/t7-prompts/`) e um
  experimento de escolha de modelo em `%TEMP%\oc-probe` — nada disso entra no commit.
