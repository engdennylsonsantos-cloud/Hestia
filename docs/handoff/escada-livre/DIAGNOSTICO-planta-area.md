# Diagnóstico — planta de área x planta de piso

Branch: `diag/planta-area` (a partir de `origin/main` @ `97c9a838`)
Data: 2026-10-30
Escopo: diagnóstico. Nenhum código de produção foi alterado.

## Resumo (5 linhas)

1. A hipótese se confirma: `buildPlanGeometry` desvia para `buildAreaPlanGeometry` em `packages/render/src/plan/build.ts:205`, e o app também troca a camada de sobreposição em `planFrame.ts:113`.
2. A seleção por clique funciona na planta de área (a ferramenta `select` é permitida); o que não existe é o **desenho** do destaque: `areaPlanHighlightOps` só destaca ambientes (`areaPlan.ts:354-367`).
3. Além do destaque da parede, o caminho próprio perde hover, portas/janelas, pisos/lajes, escadas/rampas, telhados, contornos fora do corte, fantasmas de seleção, prévia/guides e obedece só parcialmente às categorias e sobrescritas gráficas.
4. Não é regressão da integração: `origin/feat/plantas-area-2` e `origin/main` são idênticos nesses arquivos (só `ouroZoom.json` difere); o desvio nasceu no commit `4b632627` (feature de plantas de área) e foi apenas mergeado em `7b95114e`.
5. A decisão 0037 só exigia o destaque do ambiente (item 13); o restante nunca foi especificado nem implementado — é lacuna de projeto, não efeito do merge.

## Inventário objetivo

Legenda: **DEFEITO** = comportamento errado/incompleto em relação à planta de piso; **LACUNA** = recurso que simplesmente não foi levado ao caminho próprio; **INTENCIONAL** = diferença prevista pela decisão 0037; **PARCIAL** = parte funciona, parte não.

| # | Item | Planta de piso | Planta de área | Origem (arquivo:linha) | Classificação |
|---|---|---|---|---|---|
| 1 | Destaque da **parede selecionada** | Preenchimento azul α 0,26 + contorno 2 px + alças nas pontas/cantos | Nada (só ambiente é destacado) | `planOverlay.ts:90-104`; `planFrame.ts:113`; `areaPlan.ts:354-367` | **DEFEITO (reportado)** |
| 2 | **Hover** da parede | Preenchimento azul α 0,16 | Nada | `planOverlay.ts:111-134`; `areaPlan.ts:354-367` | **DEFEITO** |
| 3 | Seleção/hover de **portas e janelas** | Retângulo do vão + símbolo conforme o estado na vista | Nada; com `showOpenings` ligado, o símbolo é sempre desenhado | `planOverlay.ts:38-46`; `build.ts:509` | **DEFEITO** |
| 4 | Seleção/hover de **pisos e lajes** | `floorSelectionOps` / `slabSelectionOps` | Nada, mesmo com `showFloors` ligado | `planOverlay.ts:82,86`; `planFrame.ts:113` | **LACUNA** |
| 5 | **Seleção por clique** (parede, porta, ambiente…) | Funciona: `pickAt` antes de `pickRoomAt`; grava `selection` | Funciona igual (ferramenta `select` permitida) | `controller.ts:48`; `selectTool.ts:110-150,400-407` | **IGUAL** (não é o defeito) |
| 6 | **Visibilidade por categoria** | Respeita parede, abertura, piso, laje, telhado, escada e ambiente | Parede/piso/ambiente respeitam via `geo`/`hidden`; **abertura não** (símbolo ignora `view.hidden`) | `view.ts:91-108,158-173`; `build.ts:446,482,492,509` | **PARCIAL** |
| 7 | **Sobrescritas gráficas** (cor, transparência, meio-tom, arame, pesos) | Aplica por categoria em toda a geometria | Paredes fixas em “clara”; cor/arame/meio-tom/peso da categoria parede ignorados | `style.ts:59-91,125-140`; `build.ts:500-505` | **DEFEITO/LACUNA** |
| 8 | **Nível de detalhe** | Muda regiões por material, hachura, interfaces e membranas | Parede é sempre uma silhueta chapada; detalhe só afeta aberturas/anotações | `build.ts:231-233,316-343`; `build.ts:500-505` | **LACUNA** |
| 9 | **Intervalo de vista** (cota de corte e projeções) | Corta, projeta acima/abaixo, desenha contornos fora do corte | Usa o corte para a geometria, mas só desenha os `clusters` cortados; contornos de projeção não existem | `planContext.ts:59-61`; `build.ts:446,502`; `view.ts:182-194` | **PARCIAL/LACUNA** |
| 10 | Aberturas **acima/abaixo do corte** | Tracejadas/leves conforme `view.cls` | Com `showOpenings` ligado, símbolo normal sempre (`view = null` em `openingSymbolStrokes`) | `build.ts:364`; `build.ts:509`; `view.ts:203-214` | **DEFEITO** |
| 11 | **Fantasma** de selecionado fora do intervalo | Contorno tracejado na cor de seleção | Nada | `planOverlay.ts:220-224`; `view.ts:223-277`; `planFrame.ts:113` | **DEFEITO** |
| 12 | **Hachura e camadas de parede** | Regiões por material, hachura, interfaces e membranas | Uma silhueta chapada por conjunto; sem hachura nem camadas | `build.ts:316-343`; `build.ts:502-505` | **LACUNA** |
| 13 | **Grades, cotas, textos e anotações** | Sempre desenhados; categorias e seleção valem | Implementados, mas graduados pelos gráficos da vista: grades/marcas de corte desligadas por padrão; cotas/textos ligados; anotações próprias da vista funcionam | `build.ts:396-422`; `build.ts:524-551`; `model/areaPlan.ts:125-138` | **INTENCIONAL** (0037 §1/§3) / OK |
| 14 | **Escada e rampa** | Desenha e destaca (inclusive no nível de baixo) | Não desenha nem destaca | `build.ts:277-307`; `planOverlay.ts:89-90,129-130`; ausente em `build.ts:444-573` | **LACUNA** |
| 15 | **Telhados** | Desenha, projeta e destaca | Nunca: `areaPlanProfile` fixa `roofProjection: false` | `build.ts:366-394`; `types.ts:226` | **LACUNA/INTENCIONAL não documentada** |
| 16 | **Nível de baixo** | Inclui pisos, lajes, ambientes, escadas, rampas e telhados | Inclui só clusters, pisos, lajes e ambientes | `build.ts:254-298`; `build.ts:458-478` | **LACUNA** |
| 17 | **Camada viva** (prévia, guias, captura, inferência) | `buildPlanLiveOverlay` | Só o fantasma do rótulo em arraste | `planOverlay.ts:137-158`; `planFrame.ts:115-119` | **LACUNA** |
| 18 | Seleção do **ambiente** | `roomSelectionOps`: preenchimento + contorno | `areaPlanHighlightOps`: preenchimento + contorno (hover só preenchimento) | `rooms.ts:78-91`; `areaPlan.ts:354-367` | **INTENCIONAL** (0037 §13) / OK |
| 19 | Etiqueta por ambiente, legenda e quadro | Só o nome do ambiente no piso | Etiqueta configurável, legenda e quadro | decisão 0037 §1, §3, §8, §11 | **INTENCIONAL** |

Observações de leitura que completam a tabela:

- O caminho da planta de área **não chama** `stairFills`, `rampFills`, `belowStairOps`, `belowRampOps`, `roofFills` (exceto a projeção desligada), `wallOutlineOps`, `elementTagOps`, nem o desenho de objetos genéricos. As etiquetas de parede/abertura (`wallTagLabels`/`openingTagLabels`) entram, mas as etiquetas de elemento do nível (`Level.tags`) não.
- A área usa `planStyleOf` (gráficos do **nível**) para cores/pesos de pisos, ambientes, aberturas e anotações, mas as paredes são pintadas à mão em `build.ts:500-505`; a escala da vista (`plan.scale`) entra nas etiquetas/anotações, não nos pesos da categoria parede.
- O overlay da área também ignora o filtro `hidden` que o overlay do piso aplica aos ambientes (`rooms.ts:82`), e o hover do ambiente usa α 0,12 em vez de 0,14.

## Evidências

### 1. Teste temporário (vitest) — 12 casos, todos passando

Arquivo criado e apagado ao fim: `packages/render/src/plan/tmpDiag.test.ts`.
Projeto de teste: 4 paredes em laço (4 × 5 m) + ambiente `r1`; `PlanInput` igual ao de `areaPlan.test.ts` (`resolved`, `viewport`, `theme: LIGHT`, `selection`), mais o caminho real do app via `planFrameUpdateOf`.

Comando:

```powershell
npx vitest run packages/render/src/plan/tmpDiag.test.ts --testTimeout=120000
```

Saídas curtas (stdout):

```text
SEL parede · piso overlay { fills: 11, strokes: 11, cores: ['#1d6fe0', '#ffffff', ...] }
SEL parede · área overlay { fills: 0, strokes: 0 }

planFrame overlay · piso { fills: 11, strokes: 11 }
planFrame overlay · área { fills: 0, strokes: 0 }

HOVER parede · piso { fills: 1 }
HOVER parede · área { fills: 0 }

SEL ambiente · piso { fills: 1, strokes: 1 }
SEL ambiente · área { fills: 1, strokes: 1 }

cor parede · piso mudou? true
cor parede · área mudou? false

porta oculta · símbolos (papel do símbolo) { semOcultar: { piso: 4, area: 4 }, oculto: { piso: 0, area: 4 } }

view range · piso traços 1 · área traços 0
arame · piso mudou? true · área mudou? false
detalhe fino · piso mudou? true · área mudou? false
janela acima do corte · piso tracejados 13 · área tracejados 0
fantasma · piso traços 1 · área traços 0
prévia · piso { fills: 0, strokes: 1 } · área { fills: 0, strokes: 0 }
escada · piso { fills: 13, strokes: 37 } · área { fills: 0, strokes: 0 }

Test Files  1 passed (1)
     Tests  12 passed (12)
```

O que cada linha prova:

- **Parede selecionada:** o piso produz 11 preenchimentos (1 destaque + 10 alças) e 11 traços; a área produz 0 e 0. O mesmo acontece chamando `planFrameUpdateOf`, que é o caminho do app.
- **Hover:** piso 1 preenchimento; área 0.
- **Ambiente:** os dois destacam (a decisão 0037 §13 está cumprida).
- **Sobrescrita de cor da parede:** o piso muda; a área devolve geometria idêntica.
- **Categoria porta oculta:** o símbolo tem 4 traços com `role` no piso e na área quando visível; oculto, o piso cai para 0 e a área continua com 4.
- **View range:** parede fora do corte gera 1 contorno no piso e 0 na área.
- **Arame e detalhe fino:** o piso muda; a área não.
- **Abertura acima do corte:** o piso traceja 13 traços de símbolo; a área traceja 0 (desenha o símbolo normal).
- **Fantasma de seleção oculta:** piso 1 traço tracejado; área 0.
- **Prévia:** piso 1 traço; área 0.
- **Escada:** piso 13 preenchimentos/37 traços; área 0/0.

### 2. Git — não é regressão da integração

```text
$ git diff --stat origin/feat/plantas-area-2 origin/main -- packages/render/src/plan apps/web/src/editor/controller.ts apps/web/src/ui/ribbon/parts.tsx
 packages/render/src/plan/ouroZoom.json | 138 ++++++++++++++++----------------
 1 file changed, 69 insertions(+), 69 deletions(-)
```

```text
$ git show origin/feat/plantas-area-2:packages/render/src/plan/planFrame.ts | Select-String areaPlanHighlightOps
    overlay: () => (area ? juntarOps(areaPlanHighlightOps(...), destaqueAnotacoes(...)) : buildPlanScreenOverlay(...))
    hover:   () => (area ? juntarOps(areaPlanHighlightOps(...), destaqueAnotacoes(...)) : buildPlanHoverOverlay(...))

$ git show origin/feat/plantas-area-2:packages/render/src/plan/build.ts | Select-String "input.areaPlan"
  if (input.areaPlan) return buildAreaPlanGeometry(input, input.areaPlan);
```

O mesmo bloco já existia antes do merge. O `git log` mostra que ele nasceu em `4b632627` (“feat(area): render, prancha e DXF da planta de area”) e entrou na main pelo merge `7b95114e` (“merge: plantas de area sobre plano+IFC+escadas”). Entre `origin/feat/plantas-area-2` e `origin/main` não há diferença de comportamento nesses arquivos.

### 3. Citações de código que fecham a causa

- Desvio de caminho: `build.ts:204-205`.
- Desenho próprio: `build.ts:444-574` (paredes claras em `500-505`, aberturas em `509`, projeção de telhado em `511-521`, grades/anotações em `524-551`, legenda/quadro em `563-571`).
- Overlay especial do app: `planFrame.ts:113-114` (seleção/hover) e `115-119` (camada viva).
- Único destaque da área: `areaPlan.ts:354-367` — o laço só percorre `resolveRooms` e só testa `r.roomId`.
- Overlay compartilhado que ficou de fora: `planOverlay.ts:70-108` (seleção), `111-134` (hover), `220-224` (fantasma).
- Seleção por clique: `controller.ts:48` (`AREA_PLAN_TOOLS` inclui `select`), `selectTool.ts:110-150` (picking) e `400-407` (gravação da seleção).

## Conclusão sobre a causa

**Causa: desvio de caminho (dois motores), não regressão da integração.**

A planta de área não perdeu o destaque na integração: ela nunca teve. O commit da feature criou dois caminhos independentes:

1. `buildPlanGeometry` → `buildAreaPlanGeometry` para a geometria;
2. `planFrameUpdateOf` → `areaPlanHighlightOps` para a sobreposição.

A decisão 0037 item 13 (“selecionar o ambiente destaca preenchimento e contorno”) foi implementada literalmente para **ambiente**, e só para ele. Como a parede não é ambiente, `areaPlanHighlightOps` não gera nenhum `FillOp`/`StrokeOp`. O clique seleciona a parede normalmente (a seleção chega ao estado), mas a camada de sobreposição da área não sabe desenhá-la. Os demais sintomas (“bastante problema parecido”) vêm do mesmo desvio: tudo o que foi acrescentado ao caminho da planta de piso depois — escada/rampa, contornos fora do corte, classificação de aberturas, fantasmas, prévia, sobrescritas de parede — não foi replicado no caminho próprio.

## Proposta de correção (não implementada)

### Opção A — a planta de área reaproveita o caminho normal e troca só a configuração visual

**Ideia:** eliminar o desvio de `build.ts:205`. `buildPlanGeometry` passa a receber um `PlanProfile` (já existe em `types.ts:143-228`) e aplica os mesmos passos da planta de piso, apenas com as escolhas da vista de área: paredes claras, sem pisos/cotas por padrão, diagonais e etiquetas de ambiente, legenda/quadro. As anotações continuam vindo de `plan.annotations` quando existirem. A sobreposição passa a ser sempre a compartilhada (`buildPlanScreenOverlay`, `buildPlanHoverOverlay`, `buildPlanLiveOverlay`), que já sabe lidar com `areaPlan` para as anotações.

**Passo A1 (correção mínima e imediata do relato):** em `planFrame.ts`, remover o ramo `area ? ... : ...` das linhas 113-119 e chamar sempre `buildPlanScreenOverlay` / `buildPlanHoverOverlay` / `buildPlanLiveOverlay`; apagar `areaPlanHighlightOps` (ou deixá-la só como legado sem uso). Isso restaura parede, porta/janela, piso/laje, escada/rampa, telhado, alças, hover, fantasmas e prévia **sem tocar na geometria**. O destaque do ambiente continua correto via `roomSelectionOps`. É a maior parte do ganho com o menor risco.

**Passo A2 (unificação da geometria):** transformar `buildAreaPlanGeometry` em configuração do caminho normal, com `profile` decidindo paredes (clara/normal/oculta), aberturas, pisos, escadas/rampas, telhados, anotações e legenda/quadro; manter em `areaPlan.ts` só o que é exclusivo da área (diagonais, etiqueta, legenda, quadro). Remover a duplicação de ~130 linhas.

| Aspecto | Avaliação |
|---|---|
| Esforço | A1: 2–4 h. A2: 2–3 dias (inclui testes e ouro) |
| Risco | A1: baixo (só troca de camada, testes de overlay). A2: médio (mexe no caminho da planta de piso; exige regravar `ouroZoom.json` e snapshots da área) |
| Arquivos | `packages/render/src/plan/planFrame.ts`, `build.ts`, `types.ts`, `areaPlan.ts`, `areaPlan.test.ts`, `planFrame.test.ts`, `ouroZoom.json`; DXF da área passa a herdar o mesmo desenho |
| Vantagem | Um único motor: toda correção futura da planta de piso vale na área; o comportamento “mesma planta, configuração visual diferente” passa a ser verdadeiro por construção |
| Desvantagem | O desenho da área muda de propósito (contornos de projeção, aberturas por classe, escada/rampa, etc.) e exige revisão visual/ouro |

### Opção B — completar o desenho próprio, item por item

**Ideia:** manter `buildAreaPlanGeometry` e ir acrescentando o que falta: `wallOutlineOps`, `openingViewOps` com `view`/`hidden`, `stairFills`/`rampFills` e equivalentes de baixo, `roofFills`, `belowRoofs`, hachura/regiões de parede, pesos e sobrescritas, detalhe, fantasmas e prévia. O overlay também precisa ser trocado pelo compartilhado (B1), porque o relato é exatamente a ausência dele.

| Aspecto | Avaliação |
|---|---|
| Esforço | B1 (overlay): 2–4 h. B2 (geometria completa): 3–5 dias, item por item, com testes de cada um |
| Risco | B1: baixo. B2: médio-alto — duas implementações que voltam a divergir a cada nova feature da planta de piso; alto custo de manutenção e de testes duplicados |
| Arquivos | `build.ts` (`buildAreaPlanGeometry`), `areaPlan.ts`, `types.ts`, testes da área e ouro; `planFrame.ts` para o B1 |
| Vantagem | A planta de área pode continuar visualmente mínima sem mexer no caminho da planta de piso |
| Desvantagem | Duplicação permanente; foi exatamente essa duplicação que produziu o defeito; cada item novo (escada, rampa, DXF, view range) precisa ser lembrado duas vezes |

**Recomendação:** fazer **A1 agora** (resolve o relato e os sintomas de sobreposição com risco baixo) e agendar **A2** para eliminar a causa estrutural. A opção B só se justifica se houver uma razão forte para a planta de área não compartilhar a geometria; hoje ela já compartilha `planContext`, `planViewOf`, `floorAndSlabOps`, `noteOps`, `gridOps` e `openingSymbolStrokes`, então a duplicação é parcial e inconsistente — o pior dos dois mundos.

## Resumo curto

- **O que o dono viu:** parede selecionada sem destaque na planta de área.
- **Por quê:** a sobreposição da área é `areaPlanHighlightOps`, que só percorre ambientes; o destaque de parede/porta/piso/escada/fantasma existe apenas no caminho da planta de piso.
- **Causa raiz:** desvio de caminho em `build.ts:205` + ramo especial em `planFrame.ts:113`; a decisão 0037 só especificou o destaque do ambiente.
- **Regressão?** Não. Já era assim em `origin/feat/plantas-area-2`; nasceu em `4b632627`.
- **Correção sugerida:** A1 imediata (reusar a sobreposição compartilhada) e A2 (unificar a geometria por perfil); B é possível, mas perpetua a duplicação.
