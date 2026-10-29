# Áreas e ambientes: Revit × ArchiCAD × Hestia

Síntese dos relatórios [A](A-pesquisa-revit.md) (Revit), [B](B-pesquisa-archicad.md) (ArchiCAD),
[C](C-normas-ifc-representacao.md) (normas/IFC/representação) e [D](D-auditoria-codigo.md) (código),
com verificação própria das fontes oficiais e do código onde os relatórios divergiam. Data: 29/10/2026.

Legenda de confiança: **[DOC]** documentação oficial lida · **[SEC]** fonte secundária/fórum ·
**[CÓD]** conferido no código deste repositório · **[?]** não confirmado.

---

## 0. Resumo em dez linhas

1. No Revit, **Room** e **Area** são ferramentas diferentes. Room é o espaço fechado (área *net*);
   Area/Area Plan é a metragem de edificação (Gross Building, Rentable). O "Ambiente" do Hestia
   corresponde a **Room**, não a Area. `[DOC]`
2. O Revit resolve o ambiente em **3D**: a área é medida num plano de corte (`Computation Height`,
   propriedade **do nível**) contra paredes, pisos, lajes, forros, telhados, pilares e linhas de
   separação. O Hestia resolve em **2D**, por circuito de paredes. `[DOC]` / `[CÓD]`
3. O limite de cálculo do Revit é **do projeto inteiro** (face de acabamento, eixo, face do núcleo ou
   eixo do núcleo). O Hestia fixa a face de acabamento — que é exatamente o **padrão** do Revit. `[DOC]`
4. No ArchiCAD, a zona grava **dois polígonos** (o desenhado e o "encontrado") e só atualiza quando o
   usuário roda `Design → Update Zones`. O Hestia deriva sempre — é melhor, não pior. `[DOC]`
5. A etiqueta, nos dois programas, é **elemento separado** do espaço e pode ser movida. O ArchiCAD
   gastou a release 25 para desacoplar o carimbo da zona. O Hestia desenha a etiqueta centrada e fixa. `[DOC]`
6. A cor, no Revit, é **esquema por vista + legenda**; no Hestia é propriedade do elemento. Isso impede
   ter "planta de setores" e "planta de uso" ao mesmo tempo. `[DOC]` / `[CÓD]`
7. O Hestia está **à frente** em: pré-visualizar a área antes do clique, derivar o contorno sem
   `Update Zones`, criar em todos os circuitos de uma vez e exportar DXF/IFC sem configurar nada.
8. O Hestia está **atrás** em: limite superior / altura não limitada, método de cálculo configurável,
   `roomBounding` por elemento, etiqueta móvel, esquema de cores com legenda e Area Plans (área bruta).
9. Há **bugs reais** que fazem a área exibida ficar errada: cache que ignora `sag` de parede em arco
   (e contamina projetos), criação em lote que ignora separadores, furo de pilar descartado com
   separador diagonal e ambiente duplicado somando duas vezes. `[CÓD]`
10. Antes de qualquer paridade nova, corrigir os itens do §12. Depois, a ordem de maior retorno é:
    altura/limite superior → categoria + esquema de cores → etiqueta móvel → método de cálculo.

---

## 1. O mapa mental: três conceitos que não são o mesmo

| Conceito | Revit | ArchiCAD | Hestia |
|---|---|---|---|
| Espaço fechado por paredes | **Room** (área *net*) | **Zone** | **Ambiente** (`Room`) |
| Metragem de edificação / rentável | **Area** + **Area Plan** (Gross Building, Rentable) | não tem equivalente nativo; add-ons normativos (DIN 277 etc.) | **não existe** |
| Etiqueta | `Room Tag` / `Area Tag` (famílias de anotação) | `Zone Label` (AC25+) ou `Zone Stamp` (GDL) | desenhada pela vista, sem elemento |
| Cor | `Color Scheme` por vista + `Color Fill Legend` | cor da **categoria** de zona | `color` por instância |
| Tabela | Room Schedule / Area Schedule | Interactive Schedule (Zone) | Tabela de ambientes + CSV |

**Consequência prática:** quando um arquiteto pede "planta de áreas" no Revit, ele pode estar pedindo
duas coisas: (a) planta com ambientes etiquetados (Room) ou (b) planta de área construída/rentável
(Area Plan). O Hestia só responde (a). Se o produto quiser atender prefeitura/ABNT/BOMA, falta a
camada (b) — e ela é independente das paredes, porque a medição é uma decisão do usuário. `[DOC]`

---

## 2. Modelo de dados: gravado × derivado

| | Revit | ArchiCAD | Hestia |
|---|---|---|---|
| O que fica gravado | ponto de inserção + parâmetros; contorno é derivado | **polígono** (`poly`) + **polígono encontrado** (`refPoly`) + ponto (`refPos`) + modo (`manual`, `refLineFlag`) | **ponto interior** + nível + nome/número + altura + acabamentos + cor |
| Contorno | derivado dos elementos *room-bounding* | gravado; recalculado só em `Update Zones` | derivado a cada leitura (`resolveRooms`) |
| Área / perímetro / volume | calculados, somente leitura | 4 áreas em cascata | calculados, somente leitura |
| Efeito de mudar uma parede | recalcula na hora | fica velho até `Update Zones` | recalcula na hora |

O modelo do Hestia é o mais limpo dos três: grava só a **decisão** (onde fica o ambiente) e deriva o
resto. É a mesma escolha do Revit para `Area`/`Perimeter`/`Volume`, sem o custo do `Update Zones` do
ArchiCAD. **Não copiar o polígono gravado do ArchiCAD.** `[DOC]` / `[CÓD]`

O preço dessa escolha é que não existe "congelar contorno" para documentação assinada. O ArchiCAD
resolve isso trocando a zona para `Manual`. Se isso for requisito, a solução barata é um campo
`frozenPolygon` opcional, não mudar o modelo. `[SEC]`

### 2.1 Campos que faltam para paridade

| Campo | Revit | ArchiCAD | Falta no Hestia | Prioridade |
|---|---|---|---|---|
| Limite superior | `Upper Limit` + `Limit Offset` | `Zone Top` (Home+N ou Not linked) + offset | sim | **P0** |
| Altura não limitada | `Unbounded Height` (leitura) | — | sim | **P0** |
| Método de cálculo | global, 4 opções | `Inner Edge` / `Reference Line` / Manual | sim | P1 |
| Delimita ou não | `Room Bounding` por elemento | `Relation to Zones` (4 valores) | sim | P2 |
| Categoria/tipo | `Occupancy`, `Department` | `Zone Category` (nome, código, cor, carimbo) | sim | P1 |
| Etiqueta | elemento próprio, por vista | `Zone Label` (AC25+) | sim | P1 |
| Altura de piso | — | `Subfloor Thickness` | não (aceitável) | P3 |
| Fase | `Phase` | `Renovation Status` | não (fora do escopo atual) | P3 |
| Acabamento de base | 4º acabamento (`Base Finish`) | parâmetro do carimbo | 1 acabamento a menos | P3 |

Detalhe importante: no Revit, `Area`, `Perimeter`, `Volume` e `Unbounded Height` são **somente
leitura** — o usuário não digita área. O Hestia faz igual. `[DOC]` / `[CÓD]`

---

## 3. Criação

| Item | Revit | ArchiCAD | Hestia |
|---|---|---|---|
| Comando | Architecture > Room & Area > Room (`RM`) | Toolbox > Design > Zone | Aba Arquitetura > Ambiente (`Z`) |
| Exige circuito fechado | **não para criar**; sim para calcular | sim (modo automático) | sim (recusa com mensagem) |
| Pré-visualização | **não** — clica e o room "expande até as bordas" | não — 1º clique define `refPos`, 2º coloca o rótulo | **sim** — contorno + "Ambiente N · 12,34 m²" antes do clique |
| Criação em lote | `Place Rooms Automatically` (só no nível ativo) | **não existe** | "Ambientes em todos os circuitos fechados" (nível ativo) |
| Modo manual (polígono) | não (usa Room Separation Lines) | `Polyline` / `Rectangle` / `Rotated Rectangle` | **não** |
| Programa sem geometria | sim (`unplaced rooms`, criados pela tabela) | zona manual | não |
| Largura mínima | 1' / 306 mm | — | não verificado |
| Barra de opções | Upper Limit, Offset, orientação, leader, Room (New/existente) | método, categoria, nome, número, story, altura | nome, número, offset, pé-direito, acabamentos, cor (painel) |

O **pré-visualizar com área** é diferencial real do Hestia: nenhum dos dois mostra a área antes do
clique. `[DOC]`

O que vale copiar: **criar ambiente sem circuito fechado** (Revit) e **polígono manual** (ArchiCAD),
porque os dois servem ao mesmo caso — pré-dimensionar o programa antes de modelar paredes. No Hestia,
a alternativa hoje é desenhar paredes provisórias. Uma ferramenta "Ambiente manual" que grava um
polígono próprio resolveria os dois casos com um só campo (`mode: 'auto' | 'manual'`). `[DOC]`

---

## 4. O que delimita o ambiente

| Elemento | Revit | ArchiCAD | Hestia |
|---|---|---|---|
| Parede | sim (inclusive cortina, in-loco, face-based) | sim | sim |
| Piso / laje | **sim** (delimitador horizontal) | não (a zona é 2D em planta) | não |
| Forro | **sim** | não | não |
| Telhado | **sim** | não | não |
| Pilar | sim (arquitetônico; estrutural só concreto) | **não fecha** circuito | ilha dentro do circuito vira **furo** |
| Linha de separação | `Room Separation Line` (elemento real) | line-type com `Zone Boundary` | elemento em `level.roomSeparators`, faixa de 1 mm |
| Vão de porta/janela | não abre o circuito | não abre o circuito | não abre o circuito |
| Abertura que atravessa a parede | **abre** (exige separation line) | vaza a varredura; corrige com `Empty Opening` ou linha | não distingue |
| "Não delimita" por elemento | `Room Bounding` (global) | `No Effect on Zones` | **não existe** |
| Modelo vinculado / IFC | sim, se `Room Bounding` ligado | sim | não |

**Onde o Hestia está alinhado:** vão de porta/janela conta como parede (é o padrão dos dois) e ilha
vira furo (o Revit devolve N loops em `GetBoundarySegments()`). `[DOC]` / `[CÓD]`

**Onde está atrás:** piso, laje, forro e telhado não delimitam. No Revit, o ambiente é um sólido
fechado (`ClosedShell`); no Hestia, `Volume = área × pé-direito`, sem interseção com o forro real.
Para residencial de um pavimento isso quase não aparece; para mezanino, átrio e sótão aparece muito.
`[DOC]`

**A doc do repositório está defasada:** `docs/paridade/ambientes.md` A5 diz que a linha de separação
está "fora de escopo", mas ela está implementada (modelo, ferramenta `roomsep`, desenho e testes).
Atualizar A5 para `[x]` e registrar a decisão que a introduziu. `[CÓD]`

---

## 5. Cálculo

### 5.1 Limite de cálculo

**Revit** — `Architecture > Room & Area > Area and Volume Computations`, aba Computations,
`Room Area Computation`. Quatro opções, **para o projeto inteiro** (não por ambiente): `[DOC]`

- `At wall finish` — face do acabamento interna (padrão)
- `At wall center` — eixo da parede
- `At wall core layer` — face do núcleo mais próxima do ambiente
- `At wall core center` — eixo do núcleo

Ressalva oficial: paredes vindas de IFC vinculado **ignoram** essa configuração e usam sempre a face
de acabamento. `[DOC]`

**ArchiCAD** — três modos por zona: `Inner Edge` (face interna), `Reference Line` (linha de
referência da parede, que pode estar no eixo, na face externa ou interna, com deslocamento) e
`Manual`. Não existe método "core". Em parede inclinada ou de perfil complexo, o `Reference Line` cai
para a borda interna. `[DOC]`

**Hestia** — fixo na face de acabamento interna, via `wallFaces().outline` (o mesmo contorno das
junções e dos arcos). É o **padrão do Revit**. O motor já tem `RoomExtend = 'finish' | 'core'` e um
`coreSilhouette`, mas o `resolveRooms` não usa: o parâmetro existe e está morto. `[CÓD]`

**Recomendação:** implementar `areaComputation: 'finish' | 'referenceLine' | 'coreFace' | 'coreCenter'`
como propriedade **do projeto** (não da instância), começando por `finish` (já pronto) e
`coreFace`/`coreCenter` (o `coreSilhouette` já existe). `Reference Line` depende do modelo de
`locationLine`, que já existe; é o menor esforço para responder norma que mede no eixo. `[CÓD]`

### 5.2 Altura de cálculo (computation height)

No Revit é **propriedade do nível**, padrão 0 mm; o perímetro é medido nessa altura. Serve para
paredes inclinadas ou peitoris: a área muda porque o corte muda. `[DOC]`

O Hestia não tem o conceito: o contorno é sempre a projeção em planta na base. Para paredes verticais
não faz diferença; para sótão e parede inclinada, faz. Se o motor ganhar parede inclinada, esse campo
vem junto. Até lá, documentar como decisão ("o ambiente é medido na base"). `[CÓD]`

### 5.3 Área bruta × líquida

Desfazer uma confusão comum: **o Revit não tem um toggle "Gross/Net"**. A área do Room é, por
definição, *"the net area computed from the room-bounding elements"*. "Gross" no Revit é o **area
scheme `Gross Building`**, medido até a **face externa** da parede externa, dentro de um **Area
Plan**. `[DOC]`

No ArchiCAD há **quatro** áreas em cascata, e nenhuma se chama "nominal": `[DOC]`

```
polígono bruto                          → Measured Area
  − espessura das paredes delimitantes   → Measured Net Area
  − elementos internos (Reduce Zone Area Only) − fills − forros baixos → Reduced Area
  × (1 − Reduce by / 100)                → Calculated Area
```

**Hestia:** uma área só, líquida (face interna, ilhas descontadas). A "bruta" que o IFC exporta é o
anel externo do polígono, incluindo os furos de pilar. `[CÓD]`

**Recomendação:** não copiar a cascata de quatro áreas. Copiar o que ela resolve:
`area` (líquida) + `grossArea` (contorno externo, já calculável) e, se houver norma, um campo
`reductionPercent` por ambiente — barato e cobre shafts/áreas técnicas sem inventar furo.

### 5.4 Volume

Revit: volume é sempre calculado até a **face de acabamento**, mesmo quando a área usa eixo/núcleo —
assimetria deliberada. Volume é opcional (`Volume Computations` desligado por padrão, por
performance). `[DOC]`

Hestia: `volume = área × pé-direito`, com `pé-direito` por instância (`ceilingHeight`, padrão = altura
de parede do projeto) e `heightOffset` da base. Simples e coerente, mas não é sólido: não é cortado
por forro/laje/telhado. `[CÓD]`

Problema confirmado: `ceilingHeight = 0` gera volume 0, e negativo gera volume negativo, e o IFC
**descarta o espaço em silêncio** (`ifcSpaces.ts` exige `height > 0`). Validar `ceilingHeight > 0` no
modelo. `[CÓD]`

---

## 6. Representação na planta

| Item | Revit | ArchiCAD | Hestia |
|---|---|---|---|
| Aparece por padrão | **não** — precisa V/G > Rooms > Interior Fill | sim | sim |
| Preenchimento | Interior Fill (só tela, **não imprime**); cor imprimível só via Color Scheme | cor da categoria ou cover fill | cor do ambiente, alpha 0,7 |
| Contorno | por V/G | `Zone Fill Outline` (tipo de linha + caneta) | o contorno das paredes; sem contorno próprio |
| Etiqueta | família de anotação separada, por vista, arrastável | `Zone Label` separado (AC25+) ou stamp | texto centrado automático |
| Conteúdo da etiqueta | parâmetros do tipo (`Show Room Number`, `Show Area`, `Show Volume`) | campos do label/stamp | "Nome (número) · área"; grosso = só nome |
| Legenda de cores | `Color Fill Legend` (título, swatches) | **não existe nativa** | não existe |
| Esquema por vista | sim, quantos quiser | cor por categoria | não (cor é do modelo) |
| Corte | retângulo (volume off) ou contorno real (volume on) | cor da categoria cortada, superfície não cortada | não aparece |
| 3D | **não mostra room** (decisão de produto) | sólido, filtrável | não aparece |

### 6.1 O que está bom

- Etiqueta com nome, número e área em mm de papel, e detalhe grosso mostrando só o nome: é exatamente
  a convenção de planta de execução. `[CÓD]`
- Ambiente do nível abaixo apagado: o Revit não faz; é um bom diferencial de leitura. `[CÓD]`
- DXF em camadas `AMBIENTES` / `AMBIENTES_TEXTO`: melhor que a publicação do ArchiCAD, que mistura
  fill/hatch. `[CÓD]`

### 6.2 O que ajustar

1. **O preenchimento está quase invisível.** `surfaceColor('#b8c4d4', branco, 0,78)` + `alpha 0,7`
   resulta em ~`#f4f6f9` sobre branco. Na baseline `ambiente-sala.png` a sala e o papel quase não se
   distinguem. Subir a saturação (ou usar a cor da categoria) para ~10–15% de contraste real.
   `[CÓD]` + baseline
2. **A etiqueta é fixa no centro geométrico.** Em planta de área, o centro cai em cima de mobiliário,
   cota ou pilar. Revit e ArchiCAD movem a etiqueta sem mover o ambiente — e o ArchiCAD separou o
   `Zone Label` justamente para isso. Guardar `labelOffset` em `Room` (ou um `RoomTag` por vista) e
   oferecer "recentralizar". `[DOC]`
3. **Fonte de 1,6 mm** é pequena para nome de ambiente. A NBR 6492 pede **3,5 mm** para denominação
   de ambiente e **2,5 mm** para cotas; a prática de prancha fica entre 2,5 e 3,5 mm. `[DOC]`
4. **Cor no elemento, não na vista.** Hoje não dá para ter "planta de setores" e "planta de uso" do
   mesmo modelo. Solução: `category` no ambiente + esquema de cor por vista, mantendo `color` como
   override. Destrava também legenda automática — que **nem o ArchiCAD tem**, então é diferencial.
   `[DOC]`
5. **Baseline visual provavelmente defasada:** a imagem mostra `45.46 m²` (ponto), a doc e o
   `fmtArea` usam vírgula. Conferir e regravar. `[CÓD]`
6. **Planta em P&B.** Hoje a única diferenciação de ambiente é cor. A norma de desenho exige que
   nenhuma informação se perca sem cor: oferecer hachura por categoria e um modo "impressão P&B"
   (contorno + hachura + etiqueta). `[DOC]`

---

## 7. Tabelas e quantitativos

| Item | Revit | ArchiCAD | Hestia |
|---|---|---|---|
| Tabela | Room Schedule, bidirecional | Interactive Schedule | Tabela de ambientes (`RoomScheduleDialog`) + CSV |
| Agrupar | Sorting/Grouping até 4 níveis | Criteria + Fields | por nível (subtotal) |
| Totais | `Grand Totals` + `Calculate Totals` | subtotais + merge | total geral e por nível |
| Editar na tabela | sim | sim | não (só no painel) |
| Campos calculados | `Calculated Value` | Properties | não |
| Min/Max | sim | sim | não |
| Área bruta na tabela | Area Schedule separada | 4 áreas | só líquida |
| CSV/planilha | sim | XLS via Interoperability | CSV `;` com vírgula decimal e BOM |

O Hestia já entrega o que o Revit exige três passos para configurar (subtotal por nível + total). O
que falta é pouco: agrupar por categoria/nome, ordenar por coluna (o diálogo já tem sort) e editar
célula. **A afirmação de que a tabela não está ligada na UI está errada** — `RoomScheduleDialog.tsx`
existe e é chamado por `App.tsx`. `[CÓD]`

---

## 8. Interoperabilidade (IFC/DXF)

O que o Hestia exporta hoje: `IFCSPACE` com corpo extrudado do contorno entre `heightOffset` e
`pé-direito`, e `Qto_SpaceBaseQuantities` com `NetFloorArea`, `GrossFloorArea`, `Height` e
**`Perimeter`**. `[CÓD]`

Conferido no schema IFC4.3, os nomes válidos de `Qto_SpaceBaseQuantities` são: `Height`,
`FinishCeilingHeight`, `FinishFloorHeight`, `GrossPerimeter`, `NetPerimeter`, `GrossFloorArea`,
`NetFloorArea`, `GrossWallArea`, `NetWallArea`, `GrossCeilingArea`, `NetCeilingArea`, `GrossVolume`,
`NetVolume`. `[DOC]`

### 8.1 O que está certo, o que está errado e o que falta

| Item | Estado | Correção |
|---|---|---|
| `CompositionType = .ELEMENT.` | **certo** | manter (é o valor que significa "espaço") |
| `PredefinedType = .INTERNAL.` | **errado/depreciado** | usar `.SPACE.`; "é externo?" vai em `Pset_SpaceCommon.IsExternal` |
| `Name` = nome do ambiente | **invertido** | `Name` deve ser o **número** ("101"); `LongName` o nome ("Sala") |
| `LongName` = "número - nome" | **invertido** | trocar com `Name` |
| `Qto_…Perimeter` | **nome inválido** | `NetPerimeter` (e `GrossPerimeter` se quiser os dois) |
| `GrossFloorArea` | **certo em conceito** | o anel externo inclui pilares e exclui revestimento — é a definição oficial |
| `NetFloorArea` | **certo** | mantém |
| `GrossVolume` / `NetVolume` | **faltam** | o dado já existe (`volume`), é só emitir |
| `Pset_SpaceCommon` | **falta** | `IsExternal`, `OccupancyType`, `Category`, `PubliclyAccessible` |
| `MethodOfMeasurement` | **falta** | declarar o método (`BaseQuantities`, `IPMS-4.2`, `NBR-12721`…) |
| `IfcZone` | **falta** | agrupar ambientes por unidade/apartamento, sem geometria |
| `ElevationWithFlooring` | **verificar** | hoje é `heightOffset` relativo ao nível; o atributo é cota absoluta no projeto |
| `IfcRelSpaceBoundary` | **falta** | só faz sentido com volume 3D; é a ponte para energia |
| DXF `AMBIENTES` / `AMBIENTES_TEXTO` | **certo** | manter; separadores como `IfcVirtualElement`/camada própria, não parede de 1 mm |

`PredefinedType` é `IfcSpaceTypeEnum`: `SPACE`, `PARKING`, `GFA`, `INTERNAL`, `EXTERNAL`,
`USERDEFINED`, `NOTDEFINED`. `ELEMENT` e `PARTIAL` são de **`CompositionType`** — não misturar os
dois. `INTERNAL`/`EXTERNAL` existem, mas estão **depreciados** desde o IFC4. `[DOC]`

### 8.2 Método de medição: o campo que resolve a ambiguidade

O IFC tem `IfcElementQuantity.MethodOfMeasurement`, e o próprio schema dá o exemplo
`Name='Netto-Grundfläche'`, `MethodOfMeasurement='DIN277-2'`, admitindo **vários
`IfcElementQuantity` no mesmo espaço**. É o mecanismo pronto para oferecer "área útil", "privativa" e
"bruta" sem que o receptor adivinhe o que o número significa. `[DOC]`

Recomendação: emitir sempre `NetFloorArea` + `NetPerimeter` + `Height` com
`MethodOfMeasurement='IPMS-4.2'` (ou o método que o projeto declarar), e um segundo
`IfcElementQuantity` com `GrossFloorArea`/`GrossPerimeter` quando a área bruta for calculada de
verdade.

### 8.3 Como nomear a área (importante para não mentir)

- O número do Hestia (face de acabamento, paredes e pilares descontados) corresponde à **IPMS 4.2**:
  "área de parte selecionada medida até a superfície acabada, subtraindo paredes e pilares". A
  própria IPMS cita "áreas de cômodos de uma residência" como uso. `[DOC]`
- **Não é a "área privativa" da NBR 12721**, que mede até a **face externa** das paredes externas e o
  **eixo** das divisórias entre unidades — portanto é **maior**. Rotular o número do Hestia como
  "privativa" é erro conceitual com consequência jurídica. `[DOC]`
- "Área útil" varia por escola: a EN 15221-6 inclui circulação; a BOMA não. Por isso o método tem de
  aparecer na etiqueta, na tabela e no IFC, não no rodapé. `[SEC]`

### 8.4 "Pé-direito" precisa de três nomes

O IFC separa `Height` (laje a laje, sem acabamentos), `FinishFloorHeight` e `FinishCeilingHeight`
(piso acabado → face inferior do forro). A NBR 15575 fiscaliza o **vão livre** (2,50 m; 2,30 m em
hall/corredor/banheiro/despensa), ou seja, `FinishCeilingHeight` — não `Height`. Hoje o Hestia tem um
único `ceilingHeight`, que na prática é o vão livre declarado: renomear na UI para "pé-direito livre"
e mapear para `FinishCeilingHeight` é mais honesto do que chamar de `Height`. `[DOC]`


---

## 9. Onde o Hestia está à frente

1. **Pré-visualização com área antes do clique** — nenhum dos dois tem. `[DOC]`
2. **Contorno sempre atualizado** — o ArchiCAD exige `Update Zones` e essa é a dor nº 1 há 20 anos;
   zona manual nunca atualiza. `[DOC]`/`[SEC]`
3. **Criação em lote** — o ArchiCAD não tem; o Revit tem só `Place Rooms Automatically`.
4. **Um conceito só** (ambiente = circuito) em vez de Room × Area, que é fonte perene de confusão. `[SEC]`
5. **Preenchimento que imprime** sem configurar Color Scheme (o Interior Fill do Revit não imprime). `[DOC]`
6. **Impossível sobrepor dois ambientes** no mesmo circuito (o ArchiCAD permite e soma duas vezes). `[CÓD]`
7. **CSV e DXF prontos**, com camadas explícitas. `[CÓD]`

---

## 10. Onde o Hestia está atrás (conceitual, não cosmético)

1. **Sem 3D**: `Volume` é `área × pé-direito`, não sólido cortado por forro/laje/telhado. Sem isso
   não há átrio, mezanino, sótão nem `IfcRelSpaceBoundary`. `[CÓD]`
2. **Sem limite superior**: `ceilingHeight` é um número solto; não segue o nível de cima nem permite
   "até a laje". `[CÓD]`
3. **Sem área bruta / Area Plan**: qualquer metragem legal (prefeitura, ABNT, BOMA) fica sem resposta.
4. **Sem método de cálculo configurável**: só face de acabamento.
5. **Sem `roomBounding` por elemento**: toda parede do nível delimita, sempre.
6. **Sem etiqueta móvel** e sem etiqueta em corte.
7. **Sem esquema de cores por vista** nem legenda.
8. **Sem programa sem geometria**: não dá para começar pelo programa de necessidades.

---

## 11. Bugs e robustez confirmados (com sonda)

Estes fazem **número errado**, não só recurso faltando. Detalhe e reprodução em
[D-auditoria-codigo.md](D-auditoria-codigo.md).

| # | Sev. | Problema | Efeito | Onde |
|---|---|---|---|---|
| B1 | **P0** | `wallsSignature` não inclui `sag`; `regionCache` é `Map` global por `levelId` | arrastar a alça de parede em arco não recalcula a área; projeto novo com os mesmos ids herda a região do anterior (21,3391 em vez de 20,0000) | `engine/src/enclosed.ts:43`, `engine/src/rooms.ts:149` |
| B2 | P1 | `dropBandHoles` usa a **AABB** da faixa do separador | pilar perto de separador diagonal perde o furo: 9,9968 em vez de ≈9,907 m², e o preenchimento cobre o pilar | `engine/src/rooms.ts:99` |
| B3 | P1 | criação em lote usa `enclosedRooms` (sem separadores) e ponto no meio da bbox | com separador no meio, o ponto cai na faixa de 1 mm: ambiente nasce `fora`, área 0, e o outro lado não recebe nada | `tools/src/roomCreate.ts:43` |
| B4 | P1 | `enclosedRooms` usa a faixa crua, `resolveRooms` usa `wallFaces().outline` | com `locationLine: finishInterior`, o lote cria **0** ambientes enquanto `resolveRooms` calcula 20,000 m² | `engine/src/enclosed.ts:19` vs `rooms.ts:78` |
| B5 | P2 | `'aberto'` × `'fora'` decidido pela bbox **das paredes** | pátio interno de prédio em U recebe diagnóstico errado | `engine/src/rooms.ts:135` |
| B6 | P1 | duplicata permitida e **somada** | uma sala de 21,34 aparece como 42,68 no total | `engine/src/rooms.ts:220` / `roomSchedule.ts` |
| B7 | P1/P2 | número manual repete; "07" ≠ "7"; **não há validação de número duplicado** (o Revit avisa) | tabela ambígua, soma duplicada | `model/src/validateRooms.ts` |
| B8 | P1 | `ceilingHeight` 0/negativo | volume 0/negativo; IFC descarta o espaço em silêncio | `engine/src/rooms.ts:203`, `io/.../ifcSpaces.ts:80` |
| B9 | P2 | ambiente órfão (parede apagada) fica invisível e não selecionável | não dá para apagar nem reparar pela planta | `render/src/plan/rooms.ts:49` |
| B10 | P2 | clique no ambiente perde para o piso | sensação de "não seleciona" | `tools/src/roomPick.ts` |
| B11 | P2 | import IFC troca número por `LongName`, perde polígono/altura | ida e volta não preserva | `io/src/ifcImport/*` |
| B12 | P2 | separador não copia, não sai no DXF, não valida `L=0` (NaN) | separador "some" ao copiar nível | `model/src/annotations.ts` |

---

## 12. Backlog priorizado

### P0 — corrigir número errado antes de qualquer release

1. **Cache**: incluir `w.sag` (e `SIG_VERSION`) na assinatura e trocar a chave global por
   `WeakMap<Project, Map<levelId, RegionSet>>` em `rooms.ts` e nos caches de `enclosed.ts`. Teste:
   mover `sag` muda a área; dois projetos com os mesmos ids não se contaminam.
2. **`ceilingHeight` > 0** na validação (erro de modelo) e volume nunca negativo.
3. **Duplicata**: bloquear ou, no mínimo, não somar no total (o Revit avisa e permite; somar é pior
   que os dois).
4. **Número duplicado**: aviso (não bloqueio, como o Revit), incluindo `"7"` × `"07"`.

### P1 — geometria e criação

5. Unificar `enclosedRooms` e `resolveRooms` numa única fonte (`roomRegions` exportada), com
   separadores e `wallFaces().outline`. Mata B3 e B4 de uma vez.
6. `dropBandHoles` contra o retângulo **orientado** da faixa (não a AABB).
7. Ponto interior por "polo de inacessibilidade" (o ponto mais longe de qualquer borda), não o meio
   da bbox — evita cair em faixa e melhora o centro da etiqueta em L.
8. `labelOffset` + "recentralizar" na etiqueta.
9. **IFC**: `PredefinedType .SPACE.`; trocar `Name`↔`LongName`; `NetPerimeter`/`GrossPerimeter` em vez
   de `Perimeter`; `NetVolume`; `Pset_SpaceCommon.IsExternal`; `MethodOfMeasurement`; `IfcZone` por
   unidade.
10. **Tolerâncias explícitas** (padrão do Bonsai): buffer de fechamento de 0,03 m e descarte de furos
    internos < 0,1 m². Hoje o Hestia usa 1 cm de extensão no separador e não expõe nenhum dos dois.

### P2 — paridade que o arquiteto sente

11. `Upper Limit` / `limitOffset` / `unboundedHeight` (altura segue o nível de cima).
12. Método de cálculo por projeto (`finish`, `coreFace`, `coreCenter`, `referenceLine`), reaproveitando
    `RoomExtend`/`coreSilhouette` que já existem.
13. `category` no ambiente + esquema de cores **por vista** + legenda.
14. `roomBounding` por elemento (parede que não delimita).
15. Modo manual (polígono próprio) para programa sem geometria.
16. Agrupar tabela por categoria/nome; editar célula; min/max.

### P3 — produto

17. Volume 3D visível (o Revit não mostra; seria diferencial) + `IfcRelSpaceBoundary`.
18. Area Plan / área bruta / Rentable, se houver demanda de metragem legal.
19. Fases.

---

## 13. O que **não** copiar

| Recurso | Por quê |
|---|---|
| Polígono gravado do ArchiCAD | cria a dor do `Update Zones`; derivar é melhor |
| Cascata de 4 áreas | complexidade de norma sem demanda; `net` + `gross` + `%` cobre |
| `Zone Stamp` em GDL | o próprio ArchiCAD abandonou em favor do `Zone Label` |
| `Crop Zone` | só faz sentido com sólido 3D; depende do item 3D |
| Room × Area como dois mundos | a confusão é a maior reclamação de usuário novo; manter um conceito |
| Renumeração inexistente | se houver numeração, oferecer "renumerar por nível" |
| Etiqueta acoplada ao elemento | o ArchiCAD levou ~25 anos para separar |

---

## 14. Como validar (casos dourados que faltam)

- Retângulo, L, U, com furo de pilar (já existem) → falta: **separador diagonal + pilar** (B2).
- **Duas salas separadas por separador** no lote (B3) e com `locationLine` em cada uma das 6 opções (B4).
- **Arco**: mover `sag` e conferir área (B1); dois projetos com os mesmos ids (B1).
- **Duplicata**: total da tabela ≠ soma em dobro.
- **Altura**: `ceilingHeight` 0, negativo, e `heightOffset` > 0.
- **IFC**: conferir `Qto_SpaceBaseQuantities` contra o schema (nomes e unidades) e `Pset_SpaceCommon`.
- **Visual**: baseline com `,` decimal, L, furo e separador; conferir contraste do preenchimento.

---

## 15. Fontes principais

- Revit — Change the Room Area Boundary Location:
  https://help.autodesk.com/cloudhelp/2023/ENU/Revit-ArchDesign/files/GUID-0BB62832-36DD-4E06-A9D4-EE98CE0FCF89.htm
- Revit — About the Computation Height for Rooms:
  https://help.autodesk.com/cloudhelp/2017/ENU/RevitLT-Model/files/GUID-9D33F884-4BCA-4772-B3E5-1E15A53DEE6E.htm
- Revit — Creating a Room (barra de opções, largura mínima, room não fechado):
  https://help.autodesk.com/view/RVT/2013/ENU/caas.html?url=caas%2Fvhelp%2Fhelp-dev-autodesk-com%2Fv%2FRevit%2Fenu%2F2013%2FHelp%2F00001-Revit-He0%2F0328-Build-th328%2F0330-Architec330%2F0661-Rooms661%2F0663-Creating663.html
- Revit — Room Instance Properties:
  https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-21326970-0037-41C6-A996-980C24EE019F.htm
- Revit — Rooms and Areas:
  https://help.autodesk.com/cloudhelp/2024/ENU/Revit-GetStarted/files/GUID-D5E8ECD8-3F58-456F-B4DB-6366491A78DB.htm
- Revit API — Rooms, Area e Tags (relação Room/Area/Tag):
  https://help.autodesk.com/cloudhelp/2018/ENU/Revit-API/Revit_API_Developers_Guide/Discipline_Specific_Functionality/Architecture/Rooms.html
- ArchiCAD — Creating Zones:
  https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-147.htm
- ArchiCAD 30 — Zone Tool Settings (pesquisa completa em B §11):
  https://help.graphisoft.com/AC/30/INT/_AC30_Help/040_ElementsVB/040_ElementsVB-149.htm
- IFC 4.3 — Qto_SpaceBaseQuantities:
  https://ifc43-docs.standards.buildingsmart.org/IFC/RELEASE/IFC4x3/HTML/lexical/Qto_SpaceBaseQuantities.htm
- IFC 4.3 — IfcSpace:
  https://standards.buildingsmart.org/IFC/DEV/IFC4_3/HTML/lexical/IfcSpace.html
- IFC 4 — `Pset_SpaceCommon` e `IfcElementQuantity.MethodOfMeasurement` (ver [C](C-normas-ifc-representacao.md) §1.6–1.9)
- IPMS (RICS) — área 4.2 (superfície acabada, paredes e pilares subtraídos)
- ABNT NBR 12721 (área privativa: face externa + eixo), NBR 15575 (pé-direito livre), NBR 6492
  (representação: pesos 0,13–2,00 mm; texto 3,5 mm para ambiente) — ver [C](C-normas-ifc-representacao.md) §2.5 e §3
