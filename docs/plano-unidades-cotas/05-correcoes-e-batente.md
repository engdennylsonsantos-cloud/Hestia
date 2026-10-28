# Fase D: correções de portas e janelas (independente de A–C)

Cinco itens. Faça na ordem **S1 → S5**. Em cada um: **reproduza/entenda primeiro** (leia o código citado), escreva o teste que falha (quando o defeito for reprodutível em teste), corrija, confirme verde, commit.

Contexto: a composição das esquadrias foi refeita (schema v20). Documentos: `docs/aberturas/F1-spec-composicao.md`, `docs/aberturas/F-PROGRESSO.md`. Decisões: `docs/decisoes/` (procure `0035` para a profundidade do batente).

---
## S1: batente acompanha a espessura acabada da parede (padrão) com opção de núcleo
**Decisão do dono**: o batente de portas **e janelas**, em paredes de **todos os tipos**, deve por padrão ter a profundidade da **espessura acabada** da parede (face acabada a face acabada, incluindo revestimentos). Deve existir a **opção** de seguir a **espessura do núcleo**. (Hoje o padrão é `core`.)

Onde olhar (confira com `grep -rn frameDepthMode packages apps`):
- `packages/model/src/openingTypes.ts` (campo `frameDepthMode?: 'wall' | 'core' | 'fixed'`, `frameDepth`)
- `packages/model/src/openingStyle.ts` (~linha 75–90: função que resolve o modo; fallback `'core'`)
- `packages/engine/src/openingModelContext.ts` (~linha 82–110: `Cd` centro e `D` profundidade do batente em `s` local)
- `packages/model/src/openingCompositionOf.ts`, `openingModelDoorsNew.ts`, `openingModelComposition.ts`
- catálogos: `packages/model/src/catalogoPortas.ts`, `catalogoJanelas.ts`, `catalogoAberturasBase.ts`, `catalogoComposicoes.ts`, `openingTypeLibrary.ts`
- UI do tipo: `apps/web/src/ui/dialogs/openingType/openingTypeFields.ts`, `OpeningTypeSections.tsx`, `panels/` (procure o select da profundidade do batente)

Passos:
1. **Entenda** o que `'wall'` e `'core'` fazem hoje: leia `openingModelContext.ts` e a decisão `0035`. Defina por escrito em `PROGRESSO.md` (3 linhas) o que cada modo calcula (profundidade `D` e centro `Cd`). Para `'wall'` o esperado é: `D` = espessura **total** do tipo de parede (todas as camadas, com revestimentos), centro no plano médio da espessura total. Se `'wall'` não for isso, ajuste-o para ser (e escreva teste).
2. **Teste que falha**: em `packages/engine`, um teste que percorre **todos os tipos de parede do catálogo padrão** × **uma porta de madeira, uma porta de vidro, uma janela de correr e uma janela maxim-ar** (use os tipos do catálogo, sem `frameDepthMode`) e verifica que a profundidade do batente (extensão em `s` das peças do batente no modelo `buildOpeningModel`) é igual à espessura total da parede; e outro com `frameDepthMode: 'core'` que verifica a espessura do núcleo. Para parede de uma camada, núcleo = total.
3. **Mudar o padrão**: fallback de leitura em `openingStyle.ts` e em `openingModelContext.ts` de `'core'` para `'wall'`; tipos criados novos (função de criação em `openingTypes.ts`/`openingTypeLibrary.ts`/diálogo "Novo tipo") nascem com `frameDepthMode: 'wall'`; tipos do catálogo que gravam `'core'` explicitamente passam a `'wall'` **exceto** onde há razão técnica (anote). Projetos antigos com o campo explícito não mudam.
4. **Janelas e todas as famílias**: confirme que o caminho legado (tipos de uma célula) e o novo (composição multi-célula) usam a **mesma** função de profundidade. Se algum builder tem profundidade própria (grep por `thickness` / `wallThickness` em `openingModel*.ts`), faça-o consultar a função única. Janela: o batente da janela acompanha a mesma regra.
5. **Interface**: no diálogo do tipo, o controle "Profundidade do batente" lista **"Espessura acabada da parede"** (padrão), **"Espessura do núcleo"**, **"Valor fixo"** para **todas** as famílias (portas e janelas). Rótulos e ajuda em português. Teste de campos em `openingTypeFields.test.ts`.
6. **Alizar e acabamento**: com o batente maior, confira (a) alizar encosta na face acabada (a face da parede), (b) a planta (`openingPlan.ts`) desenha o batente cobrindo a espessura inteira, (c) corte/elevação idem. Rode `npx vitest run packages/engine packages/model packages/render apps/web` e **atualize os testes cujas alturas/profundidades mudaram de propósito** (um por um, conferindo cada valor). Não relaxe tolerâncias.
7. `docs/aberturas/F-PROGRESSO.md`: acrescente uma nota "Batente: padrão = espessura acabada (2026-10-28)".
Commit: `feat(esquadrias): S1 batente acompanha a espessura acabada da parede, opção de núcleo`.

---
## S2: prévia de colocação usa a esquadria real do tipo
**Problema**: ao inserir, a prévia usa `symbolPreviewItems` (`packages/tools/src/openingPlacement.ts`, ~linha 214), que desenha o símbolo **legado** (`openingGeometry` + `openingSymbolPaths`). A planta real usa `buildOpeningModel` + `openingPlanPaths` (`packages/engine/src/openingModel.ts`, `openingPlan.ts`). A prévia deve ser **idêntica** ao que será colocado (inclui bandeiras, laterais, folhas, alizar, arco).

Passos:
1. Descubra **como a planta real converte** `OpeningPlanPath` (coordenadas locais do vão `{t, s}`) em coordenadas de mundo: `grep -rn "openingPlanPaths" packages/engine/src packages/render/src` e leia o consumidor (provavelmente `resolve.ts`/`planBuild*`). Reuse a **mesma** conversão (extraia uma função compartilhada no engine se hoje ela é local, p. ex. `openingPlanWorldStrokes(m, frame, opts)`), com teste.
2. No `engine`, nova função pura `openingPreviewStrokes(p: Project, opening: Opening, frame: WallFrame, detail: DetailLevel, openingLine?: OpeningLineConvention): Array<{ pts: Vec2[]; closed: boolean; dashed: boolean; role: string }>` que monta `OpeningGeometry` (`openingGeometry`), o modelo (`buildOpeningModel(p, opening, g, frame)`) e os traços (`openingPlanPaths`) com as **mesmas opções** que a planta usa (detalhe do projeto: `p.settings.detail`, `leafPlan`, `planDisplay`, `openingLine`, `angle`). Teste: para uma porta de 2 folhas e para uma janela com bandeira lateral, os traços da prévia (offset X) são iguais, após deslocamento, aos traços da planta real de uma abertura colocada em X.
3. **Cache**: a prévia é recalculada a cada movimento do mouse. Construa o modelo **uma vez** por chave `(typeId + assinatura do tipo, wallId, espessura/tipo da parede, flipHand, flipFacing, detail)` com o abertura em `offset = 0` do vão, e a cada movimento apenas **translade** os pontos ao longo da parede. Guarde o cache na instância da ferramenta (`OpeningTool`), invalidando quando `project.openingTypes[typeId]` ou a parede mudarem de identidade. Medida de desempenho (anote em `PROGRESSO.md`): o custo de um movimento com cache deve ser desprezível (< 1 ms); sem cache aceitável < 8 ms numa porta composta.
4. `openingTool.ts`: troque `symbolPreviewItems` pela nova função; converta os traços em `PreviewItem` `line` (tracejado quando `dashed`) como hoje. Mantenha o retângulo do vão e as cotas por enquanto (a Fase E troca as cotas). `symbolPreviewItems` fica sem uso: apague-a e o teste correspondente, ou reescreva-os sobre a nova função.
5. Teste do `OpeningTool` (`openingTool.test.ts`): a prévia de uma porta de duas folhas com bandeira superior contém mais traços que a de uma porta simples e contém os traços do batente em torno do vão.
Commit: `feat(esquadrias): S2 prévia de colocação com a esquadria real`.

---
## S3: Espaço e Tab redesenham a prévia na hora
**Problema**: em `openingTool.ts`, `space()`/`tab()` só invertem `flipHand`/`flipFacing`; o desenho só refaz no próximo movimento do mouse.

Passos:
1. Guarde em `OpeningTool` a **última posição** do ponteiro (`lastPointer: PointerInfo | null`, gravada em `move`).
2. `tab()` e `space()`: após inverter, se `lastPointer` existe, chame `this.move(this.lastPointer)` (reexecuta o cálculo e reconstrói `items`). Mantenha o `Tab`/`Espaço` sem efeito quando não há ponteiro.
3. Confira como a interface avisa que a prévia mudou (`previewTick` em `useUi`): a tool deve disparar o mesmo mecanismo que `move` usa para repintar (leia `apps/web/src/editor/` onde `tool.preview()` é lido). Se o repintar depende do evento de mouse, exponha o gancho já existente (não crie um novo se houver).
4. Teste: sequência `move → space → preview()` mostra a dobradiça invertida **sem** novo `move`; idem `tab` com o sentido; sem ponteiro, nada quebra.
Commit: `fix(esquadrias): S3 Espaço e Tab atualizam a prévia imediatamente`.

---
## S4: alças de inversão da porta selecionada
O dono relatou que "só clicar" não inverte o lado da dobradiça na planta. `apps/web/src/ui/OpeningFlipGrips.tsx` grava via `updateElements` com `nextOpeningFlip`.
1. Reproduza no navegador (Playwright já instalado: `require('playwright')`, `chromium.launch()` sem opções; app via `npm run dev -w @hestia/web`, veja o README): crie projeto, coloque parede e porta, selecione a porta, clique nas alças (▲ sentido e ⇄ dobradiça). Confirme se o `offset`/flags mudam no store e se a planta redesenha.
2. Se a mudança grava mas a planta não atualiza: o problema é cache/`previewTick`/chave de memoização do `resolveLevel` (flags `flipHand`/`flipFacing` fora da chave). Corrija na chave. Se não grava: o `onClick` está sendo engolido por `stop` no `onPointerDown/Up` (veja `stop` e o handler) — inverta a lógica para usar `onPointerUp`/`onClick` coerentes, sem deixar o clique chegar ao canvas.
3. Teste de unidade para `nextOpeningFlip` e `openingGripPlacements` (já existem? complete) e um teste de componente: clicar na alça emite `updateElements` com o patch esperado.
4. Se tudo já funciona (não reprodutível), registre em `PROGRESSO.md` com os passos tentados e feche o item.
Commit: `fix(esquadrias): S4 alças de inversão` (ou `test(...)` se só testes).

---
## S5: planta no modal "Propriedades do tipo" só mostra parede e arco
**Problema relatado**: no diálogo do tipo (aba **Planta**), aparece só a parede e o arco; faltam batente, folha (e alizar nos níveis altos).
Arquivos: `apps/web/src/ui/dialogs/openingType/previewViews.ts` (`previewPlanDrawList`, `previewPlanSvg`), `drawListToSvg.ts`, `OpeningTypePreview.tsx`, `previewProject.ts`.
1. Reproduza: escreva um teste que gera `previewPlanDrawList(tipoPortaDeMadeira, {})` e lista os itens por papel/categoria. O dono viu só parede+arco; a lista de desenho (medida antes) **contém** os traços do batente e da folha, então o defeito deve estar em `drawListToSvg.ts` (categoria/estilo/espessura/cor ignorados ou transparentes?) ou no nível de detalhe usado (`detail: 'low'`?). Renderize o SVG num navegador (Playwright) e inspecione.
2. Corrija a causa (por exemplo: estilos de preenchimento/traço faltando para papéis `frame`/`leaf`, detalhe `low` forçado, ordem de desenho cobrindo, espessura de linha 0 na escala da prévia). O resultado esperado na aba Planta: parede com hachura/contorno, **batente** (peças do batente), **folha** (retângulo fino), **arco** da abertura e, em detalhe alto, **alizar**.
3. Teste: `previewPlanSvg` de uma porta de madeira contém elementos `<path>`/`<polygon>` suficientes para batente e folha (conte por classe/estilo ou `data-role`; se não houver atributo para teste, acrescente `data-role` no SVG gerado).
4. Teste para porta de duas folhas com bandeira superior e janela com bandeira lateral (a planta mostra os montantes).
Commit: `fix(esquadrias): S5 planta do modal mostra batente e folha`.

---
## Verificação da fase D
`npm run check` verde. Abra o app (README) e confira no navegador: (1) porta de madeira em parede de 2 camadas: batente com a espessura acabada; trocar para núcleo no tipo; (2) prévia ao inserir é igual à planta final; (3) Espaço/Tab; (4) alças; (5) aba Planta do modal. Anote o resultado em `PROGRESSO.md`. Push.
