# T7 · Contorno pelo núcleo e topo da parede na face superior ("to core" do Revit)

**STATUS: PROPOSTA — NADA IMPLEMENTADO.** Origem: conversa com o dono em 2026-10-22 (laje/piso × acabamento
externo, configuração de camadas e topo da parede de baixo). Insumos: `docs/decisoes/0023-juncao-piso-laje-parede.md`,
`docs/decisoes/0025-termino-por-camada-piso-unico.md`, `docs/05-REFERENCIA-REVIT-ARCHICAD.md` §1 e §3, e o código
conferido nesta data. Antes de codar, leia `docs/handoff/regras-gerais.md`, `docs/HANDOFF.md` e as decisões 0023 e 0025.

## 0 · Objetivo

Implementar no Hestia o que o Revit chama de **"Extend into wall (to core)"** e o complemento do topo da parede:

1. Piso/laje podem ser criados pelo **perímetro da face externa do núcleo** das paredes, derivado e associativo. O
   acabamento externo das paredes fica **fora** do contorno → a borda da laje não aparece na fachada.
2. A parede do nível de baixo pode terminar na **face superior** do piso/laje de cima (hoje só na face inferior),
   para o acabamento externo cobrir a faixa da laje.
3. O **núcleo** fica visível/checável nos editores de piso e de laje (hoje só aparece no de parede).

**Não é objetivo** mexer na junção piso/laje × parede: ela já existe, já usa o mesmo método das paredes (função +
núcleo + prioridade + hierarquia por tipo) e está entregue na P7c parte 2 (ver §2).

## 1 · Decisões (registrar em `docs/decisoes/0026-contorno-pelo-nucleo.md`)

- **D1 — O núcleo continua DERIVADO, sem marcador editável.** Da primeira à última camada `structure`; sem camada
  `structure`, o elemento inteiro é núcleo (`coreRange`/`coreSpan` em `packages/model/src/wallType.ts`; para piso e
  laje, `layerCoreFlags` em `packages/engine/src/junctionPlanar.ts`). Nada de Core Boundary arrastável (decisão 0002).
- **D2 — O contorno pelo núcleo é um `extend` da origem, não um modo novo.**
  `OutlineSource.extend?: 'finish' | 'core'`, ausente = `'finish'` (comportamento de hoje). Só é lido quando
  `mode === 'perimeter'`; nos modos `walls-finish`/`walls-core` é ignorado (o modo já diz). Motivo: um modo novo
  teria de ser excluído do teste de "vinculado" em `layerOutlines` e em todos os switches; um campo opcional exige
  dois pontos só.
- **D3 — `auto` inteligente SÓ no `extend: 'core'`.** Camada dentro do núcleo do elemento → contorno inteiro (que já
  está na face do núcleo). Demais camadas → contorno menos a pegada inteira da parede (`regionMinusWalls` com
  `{ kind: 'face' }`, zona da própria camada) = param na face interna do ambiente. Fora do modo core, `auto` = base
  (como hoje). Término explícito (`face`, `nucleo`, `passa`, `{ ate }`, `{ cm }`) continua vencendo e mantendo o
  efeito da 0025 §5 (não corta nem é cortada pela parede). Isso espelha o `auto` do piso vinculado
  (`layerOutline.ts`, ramo `core[i] && corePoly ? corePoly : finish`) e faz os tipos do catálogo funcionarem **sem
  configurar nada**.
- **D4 — Topo da parede em 3 modos.** Campo aditivo `Wall.attachTopFace?: 'underside' | 'topside'` (ausente =
  `'underside'`, comportamento de hoje). Lido só quando `attachTopToFloor === true` e `topLevelId` definido.
  `attachSpans` ganha o parâmetro e usa `.tops` com `max` (a inclinação da laje já vem de `facesAt`). UI: o botão
  "Topo no piso" vira seletor "Topo: Nível | Face superior | Face inferior". "Nível" = `attachTopToFloor: false`
  (vale `topLevelId`/`height`).
- **D5 — NÃO tocar na junção.** `winsOver`, hierarquia por tipo, `junctionNet`, `junctionLevel`, `wallJunction`,
  `cutLevelByJunction` ficam intactos. A feature muda apenas as ENTRADAS (contorno, altura) e a região das camadas no
  `auto` core. Teste de aceitação prova o resultado (ver §5.4).
- **D6 — Visibilidade do núcleo em piso/laje.** Copiar o padrão do `WallTypeDialog` (linha com classe `core`, faixa
  azul na seção ao vivo, dica) para `FloorTypeDialog` e `SlabTypeDialog`, com badge `P{n}` e cotas do núcleo.
- **D7 — Avisos** (não bloqueantes, no padrão `outlineIssues`/`wallFloorIssues`), ver §5.5.
- **D8 — Não mudar tipos, prioridades nem o template.** Nenhum tipo do catálogo é alterado ou criado; nenhuma
  prioridade muda; `wallHeight` do template (2,80 com níveis a 3,00) fica como está — mudança de template exige
  decisão do dono e mexe nos dourados (`casaAltoPadrao`). O que se faz é avisar.
- **D9 — Sem migração e sem `SCHEMA_VERSION`.** Os dois campos são opcionais e ausentes = comportamento atual.

## 2 · Por que a junção não é refeita

- A junção piso/laje × parede já usa os mesmos atributos da parede × parede (prioridade efetiva, núcleo, hierarquia
  por tipo; nunca nome/material — 0023 §1.1 e P-6). A diferença é a pergunta geométrica: parede × parede resolve
  *pontas* (`computeEnds`); piso/laje × parede resolve *quem fica com a faixa de cota* (`junctionPlanar`).
- Já está desenhada e quantificada em planta, corte, elevação e 3D (P7c parte 2; paridade `paredes.md` E3,
  `pisos.md` C6 e `lajes.md` C8 em `[x]`). Única pendência de junção: "Inverter corte" (P-4), adiada.
- O caso "fachada contínua" já está provado: `packages/engine/src/wallJunction.test.ts`, teste "fachada contínua: o
  acabamento externo passa contínuo quando a laje termina na face interna dele" (a camada externa sai inteira, a
  laje não perde nada).
- **Por que só a junção não resolve:** ela só decide volume sobreposto. Se a laje é desenhada até a face externa, a
  sobreposição com o reboco existe e a junção faz o que manda (laje P1 corta acabamento P4) → a faixa aparece. A
  alternativa por prioridade (reboco mais forte que a laje) esconde a faixa mas escolhe o vencedor errado na seção
  (a parede atravessa inteira e a laje recua). O certo é recuar o contorno: sem sobreposição, não há o que cortar.

## 3 · Configuração de camadas — não muda

Nada muda em `Layer` (função/material/espessura/envolve/prioridade/término), nem nos tipos do catálogo, nem nas
prioridades padrão (`FUNCTION_PRIORITY`). O que o usuário precisa fazer:

**Parede** — ter camada `Estrutura` (é dela que sai o núcleo) e o acabamento externo do lado externo (a lista vai da
face EXTERNA para a interna; parede desenhada no sentido oposto precisa de `flipped`). Exemplo `wt_ext19`:

| # | Função | Material | Esp. | papel |
|---|---|---|---|---|
| 1 | Acabamento 1 | cerâmica | 1,0 cm | fora do contorno do núcleo → fachada contínua |
| 2 | Substrato | argamassa | 2,0 cm | fora do contorno do núcleo |
| 3 | **Estrutura** | bloco 19 | 19,0 cm | **é o núcleo** (3,0 a 22,0 cm da face externa) |
| 4 | Substrato | reboco | 2,0 cm | recortado pela laje |
| 5 | Acabamento 2 | tinta | 0,2 cm | recortado pela laje |

**Laje** — com o `auto` inteligente, os tipos que já existem funcionam sem término:

| tipo | camadas (topo → base) | configuração | resultado no contorno pelo núcleo |
|---|---|---|---|
| `ls_mac12` | Estrutura 12 | nenhuma | borda na face externa do núcleo |
| `ls_mac15` | Substrato 2 + Estrutura 15 | nenhuma | regularização para na face interna; estrutura até o núcleo |
| `ls_cobertura` | Acab. 3 + Membrana 0 + Estrutura 10 | nenhuma | acabamento e membrana param na face interna |
| `ls_unica` | Substrato 3 `face` + Estrutura 12 `passa` | — | **não é o caso**: contorno no acabamento e `passa` desliga o corte com a parede |

**Piso** — não usar o perímetro do núcleo (sem camada `structure` a convenção diz "o elemento inteiro é núcleo" e
todas as camadas iriam ao núcleo):
- piso por ambiente sobre laje: circuito (`walls-finish`), `ft_acab`, `auto` — já está certo hoje;
- piso único sobre laje: circuito dos ambientes, ou perímetro de acabamento com `face` nas camadas;
- piso sobre o solo (`ft_ceram`): perímetro externo; acabamento/substrato `face`, estrutura `auto`.

Término por camada: **não é necessário no caso padrão**. Continua existindo como ajuste fino (ex.: camada que passa
por baixo de parede interna) e continua com o mesmo efeito de hoje.

## 4 · Fase 0 — núcleo visível em piso/laje (pequena, sem mudar resultado)

1. `packages/model/src/wallType.ts`: generalizar `coreRange` para aceitar qualquer `{ layers: Layer[] }` (mantendo o
   uso atual) e expor o equivalente de `coreSpan` por lista de camadas, para o editor de piso/laje usar sem importar
   o motor. `coreSpan(t: WallType)` pode ficar como está (ou virar wrapper).
2. `apps/web/src/ui/dialogs/FloorTypeDialog.tsx` e `SlabTypeDialog.tsx`: linha da camada do núcleo com
   `className={inCore ? 'core' : ''}` (como `WallTypeDialog.tsx`), badge `P{n}` com `layerPriority`, nota embaixo da
   tabela: "Núcleo: camadas N a M, de A a B cm da face de cima" e, quando não houver camada `structure`, aviso "Sem
   camada Estrutura: o núcleo é o elemento inteiro".
3. `FloorSectionPreview`/`SlabSectionPreview`: marcar a faixa do núcleo (a de parede já marca).
4. Teste: módulo pequeno tipo `coreHint.ts` com o texto/indicador (o projeto testa funções de formulário, não
   render de React) + `coreHint.test.ts`. Conferir também que o teste que conta linhas/camadas não quebra.

**Aceite:** abrir os dois diálogos e ver a faixa/badge/nota; `npx vitest run apps/web` e `npx vitest run packages/model`
verdes; nenhum quantitativo/desenho muda.

## 5 · Fase 1 — contorno pelo núcleo (o coração)

### 5.1 Modelo
- `packages/model/src/types.ts`: `OutlineSource.extend?: 'finish' | 'core'` com o comentário da D2. Sem
  `SCHEMA_VERSION`, sem migração, sem campo obrigatório.

### 5.2 Motor
- `packages/engine/src/faces.ts`: acrescentar `coreOutline` a `WallFaces`, construído como o `outline` (mesma chamada
  `layerQuad`, com `coreSpan` → `sAtDepth`); parede curva segue a mesma construção do `outline`. Conferir a ordem dos
  dois `s` no teste de área.
- `packages/engine/src/enclosed.ts`: `buildingOutlines(p, levelId, extend)` com chave de cache `${levelId}|${extend}`;
  `outerPerimeter(p, levelId, near?, extend: RoomExtend = 'finish')`. Para `'core'`, unir os `coreOutline` (fallback
  `coreSilhouette` quando faltar) com `closeGapsSafe` como hoje.
- `packages/engine/src/outlineBound.ts`: no ramo `mode === 'perimeter'`, passar
  `outerPerimeter(p, levelId, src.seed, src.extend === 'core' ? 'core' : 'finish')`.
- `packages/engine/src/layerOutline.ts`: no ramo do `auto` (hoje `return core[i] && corePoly ? corePoly : finish`), se
  o elemento NÃO é vinculado, `mode === 'perimeter'` e `extend === 'core'`, então camada fora do núcleo →
  `regionMinusWalls(p, base, wallsNow(), { kind: 'face' }, zoneOf(i).z0, zoneOf(i).z1)`; camada do núcleo (e tipo sem
  `structure`) fica no contorno. Não mexer em `explicit`/`terminoEhRegraParede`.
- **NÃO tocar** em `junctionPlanar.ts`, `junctionLevel.ts`, `junctionNet.ts`, `wallJunction.ts`, `section*`.

### 5.3 Ferramentas e UI
- `packages/tools/src/types.ts`: `perimeterCore?: boolean` em `ToolOptions` (novo; não reusar `floorCore`, que é do
  modo paredes).
- `packages/tools/src/slabTool.ts` (`clickPerimeter`) e `floorTool.ts` (`clickPerimeter`): gravar
  `{ mode: 'perimeter', seed: p.raw, linked: true, ...(perimeterCore ? { extend: 'core' } : {}) }`; a prévia do
  perímetro (`movePerimeter`) segue a opção. Mensagem de criação informa "perímetro pelo núcleo".
- `apps/web/src/ui/OptionsBar.tsx` (piso) e `SlabOptionsBar.tsx` (laje): caixa "Estender até o núcleo" visível no modo
  `perimetro`.
- `apps/web/src/ui/OutlineGroup.tsx`: quando `mode === 'perimeter'` e `extend === 'core'`, estado "perímetro do
  núcleo" (o `OUTLINE_MODE_LABEL` continua para os modos). `relinkOutline` já funciona pela origem guardada — conferir
  que o `extend` sobrevive a desvincular/revincular.
- `packages/render/src/plan/*` e `model3d/*`: nada a fazer — desenham o contorno derivado (a borda do núcleo fica sob
  a parede na planta).

### 5.4 Avisos (D7)
- `contorno-nucleo-sem-estrutura` (`outlineIssues.ts`): elemento com `extend: 'core'` cujo tipo não tem camada
  `structure`.
- `parede-abaixo-da-laje-no-perimetro` (`wallFloorIssues.ts`): parede do perímetro externo cuja altura resolvida fica
  abaixo do topo do piso/laje do nível de cima (quando `topLevelId` definido) — é a causa da faixa aparecer.
- `borda-no-acabamento-externo` (recomendado, se couber): camada de parede fora do núcleo recortada por piso/laje de
  perímetro → "a borda da laje vai aparecer na fachada", com "Recuar contorno para o núcleo". Detecção preferencial
  pelo resultado já calculado da junção (`junctionLevel`, cacheado); se o custo incomodar, limitar ao nível ativo e
  deixar como pendência registrada.
- Ligar os avisos em `apps/web/src/editor/useIssues.ts` e no painel de avisos.

### 5.5 Testes da Fase 1 (valores calculados à mão, nunca copiados da saída)
- `packages/engine/src/perimeterCore.test.ts`: parede de teste com medidas explícitas (ex.: 3+19+2+0,2 cm), retângulo
  de paredes 4 × 3 m; `ls_mac12` → área = (4 − 2·0,03) × (3 − 2·0,03); `ls_mac15` → regularização para na face
  interna (área com 0,242 m por lado) e estrutura até o núcleo; `ls_cobertura` → membrana/acabamento na face interna;
  tipo sem `structure` → todas as camadas no contorno e aviso. Associatividade: mudar o acabamento externo de 2 para
  3 cm move a face externa e NÃO muda a área da laje. Cache: pedir perímetro de acabamento e de núcleo e conferir que
  um não reaproveita o outro.
- Aceitação da fachada (`perimeterCoreFacade.test.ts` ou caso novo em `wallJunction.test.ts`): laje no núcleo + parede
  de baixo atravessando a faixa (altura até o topo da laje) → camada de acabamento externo É A MESMA (sem recorte),
  núcleo da parede perde a faixa, laje não perde, `junctionNet` igual ao desenhado e **sem volume duplicado** na
  faixa. Controle com a laje no perímetro de acabamento: aí o acabamento É recortado (prova o diagnóstico).
- `packages/tools/src/perimeterCore.test.ts`: a ferramenta grava `extend: 'core'` nos dois modos (laje e piso) e não
  grava nada quando a opção está desligada.
- `apps/web/src/ui/OutlineGroup.test.ts`: texto/estado "perímetro do núcleo".
- e2e `tests/e2e/laje-nucleo.mjs` (padrão de `tests/e2e/parede-recorte.mjs`): cria parede e laje pelo perímetro do
  núcleo pela UI, lê a área e as partes por camada em `window.__hestia`, confere a área esperada e que o acabamento
  externo não foi cortado; sem erro de console.
- Regressão visual (`tests/e2e/visual-regression.mjs`, baselines em `tests/e2e/baseline`): 2 casos novos
  (`laje-perimetro-nucleo`, `parede-topo-face-superior`) com baselines criadas e **conferidas a olho**; NÃO atualizar
  as baselines antigas (divergência de banner/texto é do ambiente).

## 6 · Fase 2 — topo da parede na face superior (pequena)

1. `packages/model/src/types.ts`: `Wall.attachTopFace?: 'underside' | 'topside'` (aditivo, ausente = underside).
2. `packages/engine/src/wallAttach.ts`: `attachSpans` ganha o parâmetro do modo; para `topside`, usar
   `facesAt(...).tops` com `Math.max` (simétrico da base, que usa `tops`/`max`); `underside` continua
   `bottoms`/`min`. A inclinação já vem resolvida no `facesAt` e o perfil por trecho já existe em `stepProfile`.
3. `packages/engine/src/wallZ.ts`: `wallZRange` passa o modo (`w.attachTopToFloor && w.topLevelId && !profiled`).
4. `apps/web/src/ui/Properties.tsx`: o botão "Topo no piso" vira seletor "Topo: Nível | Face superior | Face
   inferior", com dica explicando que "face inferior" expõe a borda da laje. "Nível" = `attachTopToFloor: false`.
5. Aviso da §5.4 (`parede-abaixo-da-laje-no-perimetro`) vale aqui.
6. Teste `packages/engine/src/wallTopFace.test.ts`: laje reta → topo na cota do topo da laje; laje inclinada → cota no
   ponto médio do trecho (regra da base); parede coberta em metade do eixo → perfil em degrau; `topside` sem
   `attachTopToFloor` é ignorado; quantitativos (`junctionNet`) sem sobreposição dupla.
7. **Template: não mudar** (D8). Só registrar no HANDOFF/status que o padrão 2,80 × níveis 3,00 deixa a parede 8 cm
   abaixo da face inferior da laje, e que a decisão de mudar é do dono.

## 7 · Ordem, checkpoints e comandos

1. Commit `wip: fase 0 núcleo visível em piso e laje` — após tsc + vitest de `packages/model` e `apps/web`.
2. Commit `wip: fase 1 motor do contorno pelo núcleo` — motor + `perimeterCore.test.ts` + fachada.
3. Commit `wip: fase 1 ferramenta, UI e avisos`.
4. Commit `wip: fase 1 e2e, baselines e paridade`.
5. Commit `wip: fase 2 topo da parede em 3 modos`.
6. Commit final `feat(laje): contorno pelo núcleo e topo da parede na face superior`.

Comandos (conferir o que o repositório usa hoje; o build no Windows só passa com `--minify false`):

```
npx tsc -p tsconfig.json --noEmit
npx eslint packages/engine packages/model packages/tools packages/render apps/web
npx vitest run packages/engine packages/model packages/tools apps/web
node scripts/check-boundaries.mjs
node scripts/check-parity.mjs
node scripts/check-props-density.mjs
npm run test:rapido          # durante o trabalho
npm run test:completo        # antes do commit final
node tests/e2e/visual-regression.mjs
npm run test:perf
npm run build -w @hestia/web -- --target esnext --minify false
node tests/e2e/laje-nucleo.mjs
```

Checkpoint a cada marco que passe em tsc + testes do pacote (o contêiner pode reiniciar e matar o processo).

## 8 · Documentos e paridade

- Criar `docs/decisoes/0026-contorno-pelo-nucleo.md` com as decisões D1–D9 (referenciando esta tarefa).
- Atualizar status em `docs/decisoes/0025-termino-por-camada-piso-unico.md` (§9) e, se o `auto` core mudar algo de
  redação, em `0023` (seção da P7c parte 2).
- Paridade: `docs/paridade/lajes.md` A2 (acrescentar "face do núcleo"), `docs/paridade/pisos.md` A2 (idem, se a caixa
  aparecer no modo perímetro do piso), `docs/paridade/paredes.md` C1 (topo na face superior).
- `docs/02-MODELO-BIM.md` §3 (núcleo derivado + contorno pelo núcleo) e `docs/06-PROPRIEDADES-E-DIALOGOS.md` (campos e
  rótulos novos).
- **NÃO editar** `docs/07-STATUS-V1.md`, `docs/paridade/ORDEM.json` nem `package.json` (regras-gerais).
- Atualizar `docs/HANDOFF.md` no commit final.

## 9 · Fora de escopo

Mudar o template; DXF/IFC por camada; cor/hachura por camada na planta; "Inverter corte" (P-4); camada de parede que
"atravessa o nível" (o equivalente do material mais forte do ArchiCAD — exige a junção reservar volume); laje com
caimento fora da junção; borda de laje como elemento hospedado (Revit Slab Edge).

## 10 · Riscos conhecidos (testar)

- **`passa` + topo na face superior = volume duplicado na faixa** (0025 §9.6): `passa` é término explícito e não
  participa do corte mútuo. Não usar `passa` com `extend: 'core'`; o tipo padrão de teste é `ls_mac12`/`ls_mac15`.
- **`flipped` e a ordem das camadas:** o "externo" é a primeira camada; parede invertida muda o lado do acabamento.
  O contorno do núcleo não depende do `flipped` (só o lado do acabamento), mas o teste deve cobrir.
- **Tipo sem `structure`:** núcleo = elemento inteiro; aviso da §5.4.
- **Piso + laje no mesmo nível sobrepostos** é decisão pendente do dono (docs/08) — os testes não devem depender disso.
- **Laje inclinada:** o contorno é em planta; a junção já fica fora para caimento (0023) — não mudar nesta tarefa.
- **Planta:** a borda do núcleo fica sob a parede; se aparecer linha por fora, é sinal de que o contorno está no
  acabamento.

## 11 · Como retomar

Branch `claude/wizardly-goldberg-qtjveg` (worktree atual). Ler, nesta ordem: `docs/handoff/regras-gerais.md`,
`docs/HANDOFF.md`, este arquivo, `docs/decisoes/0023-juncao-piso-laje-parede.md` (P7c parte 2),
`docs/decisoes/0025-termino-por-camada-piso-unico.md`. Depois conferir o estado com
`npx tsc -p tsconfig.json --noEmit` e `npx vitest run packages/engine` (nada desta tarefa deve aparecer no diff).
Começar pela Fase 0 (D6) e seguir a ordem do §7. Responder sempre em português.
