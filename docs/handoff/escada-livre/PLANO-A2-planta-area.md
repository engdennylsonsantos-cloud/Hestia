# Plano da A2 — planta de área com a geometria da planta de piso

Branch de planejamento: `plan/planta-area-a2` (a partir de `origin/main` @ `97c9a838`)
Data: 2026-10-30
Depende de: A1 (`fix/planta-area-sobreposicao-compartilhada`, commits `ea86d3bb`, `72999b9b`, `3510bd29`)
Não implementar antes da autorização do dono.

## Objetivo

Eliminar o segundo motor da planta de área. A planta de área passa a ser a **mesma geometria da planta de piso**, com um `PlanProfile` que só troca o que a vista mostra e como mostra:

- paredes, portas/janelas, escadas/rampas, telhados (em projeção), grades e marcas de corte;
- ambientes com diagonais, etiqueta, esquema de cor, legenda e quadro;
- anotações próprias da vista (`plan.annotations`) quando existirem;
- pisos/lajes e nível de baixo conforme as opções da vista.

Decisões de produto já aceitas:

- **(a)** planta de área **somente leitura** para elementos de modelo (tarefa separada, ver `TAREFA-planta-area-somente-leitura.md`);
- **(b)** mostrar o modelo como a planta de piso, com configuração visual de área (modelo Revit), e não só ambientes.

## Estado atual que a A2 substitui

- `packages/render/src/plan/build.ts:205` — desvio `if (input.areaPlan) return buildAreaPlanGeometry(...)`.
- `packages/render/src/plan/build.ts:444-574` — `buildAreaPlanGeometry`, um segundo caminho que só cobre parte do que a planta de piso faz.
- `packages/render/src/plan/types.ts:143-228` — `PlanProfile`, `FLOOR_PLAN_PROFILE`, `AREA_PLAN_PROFILE` e `areaPlanProfile`. Hoje `FLOOR_PLAN_PROFILE` e `AREA_PLAN_PROFILE` não são usados pelo caminho da planta de piso.
- `packages/render/src/plan/areaPlan.ts:228-449` — desenho próprio de ambientes, etiqueta, legenda e quadro. Isso **fica**; é o que a área tem de exclusivo.

## Arquitetura alvo

```
buildPlanGeometry(input)
  profile = input.profile ?? (input.areaPlan ? areaPlanProfile(input.areaPlan) : FLOOR_PLAN_PROFILE)
  ...
  cada bloco do desenho é condicionado ao profile
  se input.areaPlan:
    ambientes → areaPlanRoomOps/areaPlanTagOps (não roomOps)
    anotações → drawnAnnotations(input.areaPlan)
    legenda/quadro → areaPlanLegendOps/areaPlanTableOps
  senão:
    comportamento de hoje, bit a bit
```

`buildAreaPlanGeometry` deixa de existir. `buildPlanGeometry` vira o único motor.

## Perfil alvo

| Flag | Planta de piso | Planta de área (alvo) |
|---|---|---|
| `walls` | `normal` | `light` (padrão) / `normal` / `hidden` pelos gráficos |
| `openings` | true | `showOpenings` (padrão false) |
| `floors` | true | `showFloors` (padrão false) |
| `rooms` | true (`roomOps`, só nome) | true (`areaPlanRoomOps` + `areaPlanTagOps`) |
| `referenceLines` | false | gráficos da vista (`always`/`selected`/`never`) |
| `stairs` | true | true (novo flag; ver abaixo) |
| `ramps` | true | true (novo flag) |
| `roofs` | `full` | `projection` (novo; ver abaixo) |
| `grids` | true | `showGrids` (padrão false) |
| `sectionMarks` | true | `showSectionMarks` (padrão false) |
| `dimensions` | true | `showDimensions` |
| `texts` / `detail` / `tags` | true | `showAnnotations` |
| `elementTags` | true | `showAnnotations` (novo flag, separa `Level.tags`) |
| `generic` | true | false (novo flag; objetos importados não entram na área) |
| `underlay` | true | `showBelowLevel` |
| `ceilings` | só vista para cima | false |
| `legend/table` | não | exclusivo da área |

Novos campos em `PlanProfile`:

- `stairs: boolean`
- `ramps: boolean`
- `roofs: 'full' | 'projection' | 'hidden'`
- `elementTags: boolean`
- `generic: boolean`

Novos campos opcionais em `AreaPlanGraphics` (`packages/model/src/areaPlan.ts`):

- `showStairs?: boolean` (padrão true na A2)
- `showRoofs?: boolean` (padrão true, desenhando **projeção**, não o telhado cheio)
- `showGeneric?: boolean` (padrão false)

Sem migração de dados: campos opcionais, ausentes valem o padrão acima. A UI ganha as opções em `AreaPlanProperties.tsx` (junto de “Mostrar aberturas”, “Mostrar piso/laje”).

## Etapas de implementação

### A2.1 — Perfil no caminho da planta de piso, sem mudar a saída

1. Adicionar `profile?: PlanProfile` em `PlanInput` (opcional; quem não passa usa o perfil do piso).
2. Em `buildPlanGeometry`, resolver `profile` e envolver cada bloco existente com o flag correspondente. O perfil do piso tem todos os flags ligados, então a saída deve ser **idêntica**.
3. Rodar `ouroZoom.test.ts` depois de cada grupo de flags. Nenhum hash pode mudar.
4. Testes de caracterização: `planFrame.test.ts`, `areaPlanOverlay.test.ts`, `areaPlan.test.ts` continuam verdes.

**Aceite:** nenhum diff em `ouroZoom.json` e nenhum teste visual da planta de piso alterado.

### A2.2 — Trazer o desenho da área para o motor único

1. Remover o desvio de `build.ts:205` e apagar `buildAreaPlanGeometry` (444-574).
2. No caminho único:
   - paredes `light`: usar o bloco atual de `build.ts:498-506` (silhueta clara), mas passando por `paint.wall` (cor, meio-tom, transparência, arame, pesos) — hoje a área ignora essas sobrescritas;
   - paredes `normal`: caminho atual com materiais, hachura, interfaces e membranas;
   - ambientes: `areaPlanRoomOps` quando `input.areaPlan`; `roomOps` no piso;
   - etiquetas de ambiente: `areaPlanTagOps` quando área;
   - anotações: `noteOps(..., drawnAnnotations(p, levelId, input.areaPlan))`;
   - separador de ambiente e etiquetas: `roomSeparatorStrokes` + etiquetas da área;
   - legenda e quadro no fim do desenho.
3. Ajustar `planStyleOf` para aceitar a escala da vista de área (`plan.scale`) nos pesos de papel; hoje a área usa a escala dos gráficos do nível e só as etiquetas usam `plan.scale`.
4. Manter `buildPlanGeometry` com a mesma ordem de desenho da planta de piso (pisos antes das paredes etc.), com os blocos de área entrando nos pontos equivalentes.

**Aceite:** a planta de área desenha parede, porta/janela, escada/rampa, telhado (projeção), grades, marcas, cotas/textos e ambientes; a planta de piso não muda.

### A2.3 — Flags novas e UI

1. Adicionar `stairs`, `ramps`, `roofs`, `elementTags`, `generic` ao `PlanProfile`.
2. Atualizar `FLOOR_PLAN_PROFILE` (tudo ligado, `roofs: 'full'`) e `areaPlanProfile` (valores da tabela).
3. Adicionar `showStairs`, `showRoofs`, `showGeneric` em `AreaPlanGraphics`, `DEFAULT_AREA_GRAPHICS` e `AreaPlanProperties.tsx`.
4. Testes de perfil: piso x área para cada flag.

**Atenção:** a área deve desenhar **projeção** de telhado (`roofs: 'projection'`), não o telhado cheio; o telhado cheio esconderia paredes e ambientes. A projeção usa `roofFills` com `showProjection: true` e `planMode: false` (ou a opção equivalente que já existe em `roofFills`).

### A2.4 — Intervalo de vista, aberturas e categorias

Como o caminho único já recebe `view`/`hidden` de `planContext`:

- aberturas passam a respeitar `view.cls` (cortada, projeção acima/abaixo, além) e a categoria oculta;
- paredes fora do corte ganham `wallOutlineOps`;
- escadas/rampas/telhados respeitam o intervalo de vista e o nível de baixo;
- fantasmas de seleção e realces seguem a sobreposição compartilhada da A1.

**Aceite:** o inventário de `DIAGNOSTICO-planta-area.md` itens 6, 9, 10, 11, 14, 15 e 16 deixa de ser divergência.

### A2.5 — DXF da área (obrigatório antes do merge)

O DXF atual (`apps/web/src/editor/dxfExport.ts:426-451`) usa `opsToDxf` (`343-374`), que joga **todo** traço em `AMBIENTES`, `AMBIENTES_REFERENCIA` ou `AMBIENTES_CHAMADA` por heurística de cor. Quando a A2 trouxer paredes/escadas para a geometria, esse DXF colocaria o modelo nas camadas de ambiente — inaceitável.

**Recomendação:** refazer o DXF da área em duas partes:

1. modelo nas camadas do DXF da planta (`PAREDE`, `PORTA`, `JANELA`, `ESCADA`, `LAJE`, `COBERTURA`, `GRADE`, `ANOTACAO`…), reutilizando `dxfGeometryOf`/`exportDxf` com um perfil de área;
2. por cima, os registros exclusivos da área (`AMBIENTES`, `AMBIENTES_REFERENCIA`, `AMBIENTES_CHAMADA`, `AMBIENTES_TEXTO`).

Alternativa mínima (não recomendada): manter o DXF só com entidades de área e omitir o modelo de propósito; cela decisão 0037 §9, mas cria divergência entre tela e DXF.

Impacto: `areaPlanDxf.test.ts` (camadas e textos), `dxfCad.test.ts` (R12/AC1009, sem 370, sem BLOCKS ausente) e `tests/ifc-export` não devem ser tocados. O DXF da área continua R12.

### A2.6 — Pranchas e viewports

`packages/render/src/sheet/viewports.ts:56-78` (`areaPlanPartsOf`) já usa `buildPlanDrawList` com `areaPlan`; a A2 passa a levar o modelo para a prancha automaticamente.

- revisar `areaPlanSheet.test.ts` (contagens, textos e ordem);
- conferir que a escala da vista (`vp.scale`) continua mandando nas espessuras de papel;
- conferir que a legenda/quadro não mudam de posição.

## Impacto em `ouroZoom.json`

- Os cenários de `cenariosZoom.ts` são **todos de planta de piso/forro**; não há cenário de planta de área.
- Se a A2.1 for feita como descrito (perfil do piso com tudo ligado), **nenhum hash pode mudar**. Qualquer diff em `ouroZoom.json` é regressão da planta de piso e deve parar a implementação.
- A planta de área não tem hash de ouro hoje. Criar testes de caracterização próprios (contagens/shape de ops) em vez de hashes, para não engessar a primeira versão.

## Impacto no DXF da área

| Antes | Depois |
|---|---|
| Só entidades da área; paredes que já existem caem em `AMBIENTES` pela heurística de cor | Modelo nas camadas do DXF da planta + entidades da área nas camadas `AMBIENTES_*` |
| Testes só verificam presença de camadas e textos | Testes verificam camadas de modelo, ausência de 370, R12 e não duplicação de cotas/textos |
| `areaAnnotationRecords` completa o que o render não desenhou | Continua como rede de segurança, agora sem duplicar o modelo |

## Riscos e mitigação

| Risco | Impacto | Mitigação |
|---|---|---|
| Refatorar `buildPlanGeometry` muda a planta de piso | Alto | A2.1 em passos pequenos, `ouroZoom` após cada passo, revisão de diff |
| Perfil da área esconde/duplica ambientes | Médio | Testes de área com/sem esquema, legenda e quadro |
| Telhado cheio esconde a planta | Médio | `roofs: 'projection'` como padrão da área |
| DXF joga modelo em `AMBIENTES` | Alto | A2.5 obrigatória antes do merge; testes de camadas |
| Escala da vista x escala dos gráficos do nível | Médio | `planStyleOf` com override de escala; teste 1:50/1:100 |
| Ferramenta de modelo ativa ao trocar para área | Médio | Tarefa de somente leitura: ao entrar na área, voltar para `select` se a ferramenta atual não for permitida |
| Regressão silenciosa em prancha | Médio | `areaPlanSheet.test.ts` + inspeção visual |

## Ordem recomendada

1. **Tarefa de somente leitura** (pequena, independente; ver documento próprio).
2. **A2.1** — perfil no caminho do piso, sem mudar saída (ouro intacto).
3. **A2.2** — área no motor único (paredes, ambientes, anotações, legenda/quadro).
4. **A2.3** — flags novas (escada/rampa/telhado/elementos) e UI.
5. **A2.4** — view range, aberturas, categorias e nível de baixo.
6. **A2.5** — DXF da área.
7. **A2.6** — prancha/viewport, testes e inspeção visual.

Estimativa: **6 a 9 dias** de trabalho focado, sendo ~2 dias de A2.1 (a parte de maior risco) e ~2 dias de DXF.

## Critérios de aceite da A2

- `buildAreaPlanGeometry` não existe mais; só há um caminho de geometria.
- Planta de área e planta de piso compartilham paredes, aberturas, escadas/rampas, telhados em projeção, grades, marcas de corte, view range e sobrescritas gráficas; a área troca apenas configuração visual e acrescenta ambientes/legenda/quadro.
- Nenhum hash de `ouroZoom.json` muda.
- DXF da área com camadas de modelo + áreas, R12 válido.
- Prancha de área com o mesmo conteúdo da tela.
- Testes de área, planFrame, sheet, DXF e suíte completa verdes.
- `tsc` limpo e `eslint` sem erros.

## Fora de escopo da A2

- Mudar a decisão 0037 (esquema de cor, diagonais, etiqueta, legenda/quadro continuam como estão).
- Refazer a UI de criação de plantas de área.
- Alterar o comportamento da planta de piso (além do refactor sem mudança de saída).
- Implementar a tarefa de somente leitura junto com a A2; ela tem documento próprio.
