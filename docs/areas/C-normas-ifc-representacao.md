# C — Normas, IFC e representação: como **áreas/ambientes** devem ser modelados, medidos e desenhados

Pesquisa feita em **29/10/2026**. Alvo: a ferramenta de **ambientes (Room)** do Hestia e o seu exportador IFC/DXF.
Complementa `A-pesquisa-revit.md` (como o Revit faz) e `B-pesquisa-archicad.md` (como o ArchiCAD faz). Aqui o foco é **norma + esquema IFC + convenção gráfica**, não um software específico.

Fontes primárias lidas nesta sessão: especificação **IFC 4.3.0.0 final** (buildingSMART, espelho `bim-times.com`) e a versão **IFC4** do mesmo espelho; **ISO 9836:2017** e **:2011** (preview oficial iTeh); **IPMS: All Buildings** (IPMSC, 15/01/2023, PDF integral); **ABNT NBR 15575-1:2013** (PDF integral); **ABNT NBR 6492:2021** (PDF integral); **NBR 12721** (item 5.3 citado literalmente em artigo acadêmico); código-fonte do **Bonsai** e documentação do **FreeCAD**, **web-ifc** e **Speckle**.

## Legenda de confiança

| Marca | Significado |
|---|---|
| `[DOC]` | Documento normativo/oficial lido nesta sessão (schema buildingSMART, texto de norma, doc oficial da ferramenta). |
| `[DOC-]` | Documento oficial, mas de edição/versão anterior — comportamento não reconfirmado na edição atual. |
| `[SEC]` | Fonte secundária (artigo técnico, wiki, fórum, glossário de mercado); coerente entre várias fontes, sem texto normativo. |
| `[?]` | Não confirmado. Marcado explicitamente. |

> **Nota de método.** Onde a cláusula não foi lida na íntegra, escrevo **"verificar"** em vez de inventar número de cláusula. Onde a especificação IFC mudou entre IFC4 e IFC4x3, isso está dito — porque um exportador "IFC4" e um "IFC4x3" não são a mesma coisa para `IfcSpace`.
>
> **Nota sobre o "Hestia hoje".** O estado atual descrito nas tabelas vem do *briefing* do produto (ponto interior + nível + nome/número + pé-direito + acabamentos; contorno derivado do circuito de paredes na face de acabamento; vãos fechados; ilhas de pilar viram furos; linha de separação de 1 mm; preenchimento translúcido + etiqueta "Nome (número) · área m²"; export `IFCSPACE` com `Qto_SpaceBaseQuantities` e DXF). **Confirmar no código antes de tratar como definitivo.**

---

## 0. Resumo executivo (o que importa para o Hestia)

1. **`ELEMENT` e `PARTIAL` não são valores de `PredefinedType`.** São valores de **`CompositionType`** (`COMPLEX` = grupo de espaços, `ELEMENT` = espaço, `PARTIAL` = espaço parcial). O `PredefinedType` de `IfcSpace` (`IfcSpaceTypeEnum`) é `SPACE`, `PARKING`, `GFA`, `INTERNAL`, `EXTERNAL`, `USERDEFINED`, `NOTDEFINED` (+ `BERTH` só em IFC4x3). Se o exportador grava `.ELEMENT.` em `PredefinedType`, o arquivo está **inválido**. `[DOC]` `[S1]` `[S2]` `[S3]` `[S4]`
2. **`INTERNAL`/`EXTERNAL` em `PredefinedType` estão depreciados** desde o IFC4: o lugar certo para "é externo?" é `Pset_SpaceCommon.IsExternal`. `[DOC]` `[S1]` `[S5]`
3. **Nome e número vão em atributos diferentes**: `Name` = número/designação única da planta; `LongName` = nome descritivo; `ObjectType` = categoria funcional. Hoje o Hestia guarda "nome + número" — o mapeamento correto é `Name` ← **número**, `LongName` ← **nome**. `[DOC]` `[S1]`
4. **A área do Hestia é `NetFloorArea`** (face de acabamento, elementos internos descontados). Emitir `GrossFloorArea` com o mesmo número é **erro semântico** — e `GrossFloorArea`, pela definição, **inclui** pilares/paredes internas e **exclui** revestimentos de parede. Ou se calcula a bruta de verdade, ou não se emite. `[DOC]` `[S6]` (já apontado em `B-pesquisa-archicad.md`)
5. **Não existe quantidade chamada `Perimeter` em `Qto_SpaceBaseQuantities`.** Os nomes válidos são **`GrossPerimeter`** e **`NetPerimeter`**. Exportar `Perimeter` é nome fora do schema. `[DOC]` `[S6]`
6. **A equivalência normativa mais exata para o Hestia é a IPMS 4.2**: área de parte selecionada medida até a **superfície acabada**, **subtraindo** paredes e pilares — e a própria IPMS dá "áreas de cômodos de uma residência" como exemplo de uso. `[DOC]` `[S14]`
7. **Mas o Hestia não é "área privativa" da NBR 12721.** A NBR 12721 mede a área privativa até as **faces externas** das paredes externas e até o **eixo** das paredes entre unidades (portanto **maior** que a área do Hestia). São números diferentes com nomes parecidos: nunca rotular a área do Hestia como "área privativa". `[DOC]` `[S20]`
8. **Método de medição é dado, não texto de rodapé.** O IFC tem campo próprio: `IfcElementQuantity.MethodOfMeasurement` — e o próprio schema dá o exemplo `Name='Netto-Grundfläche'`, `MethodOfMeasurement='DIN277-2'`, com **um `IfcElementQuantity` por método** no mesmo espaço. É exatamente o mecanismo que o Hestia precisa para oferecer "área útil / privativa / bruta" sem ambiguidade. `[DOC]` `[S11]`
9. **`IfcZone` é a entidade certa para "apartamento/unidade"** — a especificação cita literalmente *"a zone might be used to represent an apartment as a group of spaces"*, e `IfcZone` **não tem geometria própria** (é agrupamento). `IfcSpatialZone` é para zona com forma e posição próprias (térmica, de uso, de obra). `[DOC]` `[S8]` `[S9]`
10. **Os campos de área do `Pset_SpaceCommon` são de *programa*, não de medição.** `GrossPlannedArea`/`NetPlannedArea` são *"used for programming"*; a medição do modelo vai em `Qto_*`. Confundir os dois é o erro clássico de exportador. `[DOC]` `[S5]` `[S11]`
11. **Pé-direito precisa de nome.** O IFC separa `Height` (laje a laje, sem acabamentos), `FinishFloorHeight` e `FinishCeilingHeight` (piso acabado → face inferior do forro). A NBR 15575 define pé-direito como **piso→teto** — logo o valor que a norma fiscaliza é `FinishCeilingHeight`, não `Height`. `[DOC]` `[S1]` `[S6]` `[S21]`
12. **ISO 9836 manda escrever área com 2 casas decimais** — e diz que a área total é decomposta em líquida + estrutura, sem sobreposição. Regra simples e auditável para a tabela do Hestia. `[DOC]` `[S12]`
13. **"Área útil" pode incluir ou excluir circulação dependendo da escola.** EN 15221-6 inclui; BOMA não. É a razão número um pela qual um software **tem** que explicitar o método na etiqueta, na tabela e no IFC — senão o mesmo "80 m²" significa coisas diferentes. `[SEC]` `[S18]`
14. **Preenchimento translúcido é preferência de escritório; hierarquia de espessura de linha é norma.** A NBR 6492 fixa as **séries de largura de linha** (0,13 a 2,00 mm, em grupos 0,25/0,35/0,50/0,70/1,00) e as **alturas de texto em mm de papel**: **3,5 mm para denominação de ambientes** e **2,5 mm para cotas**. `[DOC]` `[S22]`
15. **Bonsai gera espaços por *flood* a partir de um ponto**, na altura de corte (RL), **até a face interna da parede** (o código diz literalmente que os cômodos *"exclude walls"*), com **buffer de 0,03 m** e **descarte de furos internos < 0,1 m²**. São exatamente os três parâmetros que o Hestia deveria ter expostos. `[DOC]` `[S26]` `[S28]`
16. **Rotular "circuito aberto" com o vão destacado é padrão da indústria** (Revit: *"Room is not in a properly enclosed region"*; `RoomNotEnclosed` na API). O Bonsai devolve mensagem textual do tipo *"Couldn't find any polygons containing the position"*. O Hestia pode fazer melhor: apontar **onde** o circuito abre. `[DOC]` `[S31]` `[S27]`
17. **Etiqueta arrastável é requisito, não luxo.** O FreeCAD separa `TextPosition`, `TextAlign`, `FontSize`, `Decimals` e um template `$area / $label / $tag` do objeto Espaço — ou seja, a posição do texto é atributo próprio, independente do volume. `[DOC]` `[S25]`

---

## 1. IFC4 `IfcSpace`: atributos, tipos, relações, Psets e quantidades

### 1.1 A entidade e seus atributos

`IfcSpace` é um `IfcSpatialStructureElement` (portanto `IfcSpatialElement` → `IfcProduct` → `IfcObject` → `IfcObjectDefinition` → `IfcRoot`). `[DOC]` `[S1]`

| # | Atributo | Tipo | Obrig. | O que significa / o que o Hestia põe |
|---|---|---|---|---|
| 1 | `GlobalId` | `IfcGloballyUniqueId` | sim | GUID do ambiente; **estável** entre exportações (é o que permite diff/round-trip). |
| 2 | `OwnerHistory` | `IfcOwnerHistory` | opcional (IFC4) | Quem criou/alterou. Opcional desde IFC4. |
| 3 | `Name` | `IfcLabel` | opcional | **"unique name (or space number) from the plan"** → no Hestia: **número** ("101", "S-04"). |
| 4 | `Description` | `IfcText` | opcional | Texto livre/observações. |
| 5 | `ObjectType` | `IfcLabel` | opcional | **Categoria funcional** ("Dormitório", "Banho"). Também obrigatório quando `PredefinedType=USERDEFINED`. |
| 6 | `ObjectPlacement` | `IfcObjectPlacement` | opcional* | Posicionamento. *Na prática obrigatório quando há representação. Para espaço, deve ser **relativo ao `IfcBuildingStorey`** (ver 1.4). |
| 7 | `Representation` | `IfcProductRepresentation` | opcional | Geometria: `FootPrint` (curva 2D fechada) e/ou `Body` (extrusão). |
| 8 | `LongName` | `IfcLabel` | opcional | **Nome completo/descritivo** ("Dormitório 1"). |
| 9 | `CompositionType` | `IfcElementCompositionEnum` | opcional | `COMPLEX` = grupo de espaços; **`ELEMENT` = espaço** (default se ausente); `PARTIAL` = espaço parcial. |
| 10 | `PredefinedType` | `IfcSpaceTypeEnum` | opcional | Tipo genérico (1.2). |
| 11 | `ElevationWithFlooring` | `IfcLengthMeasure` | opcional | Cota do **piso acabado**; média se o piso for inclinado. |

`[DOC]` `[S1]` `[S2]`

**Regras formais relevantes** `[DOC]` `[S1]`:
- `CorrectPredefinedType`: se `PredefinedType = USERDEFINED`, `ObjectType` **tem** que existir.
- `CorrectTypeAssigned`: se houver tipo associado, ele tem que ser `IfcSpaceType`.

**Diretriz de medição que quase ninguém lê** (está na documentação da entidade): *"In cases of inconsistency between the geometric representation of the IfcSpace and the combined geometric representations of the surrounding IfcRelSpaceBoundary, the geometric representation of the space should take priority"*. Ou seja: **o polígono do espaço manda**, não as fronteiras. Isso importa para o Hestia: se ele exporta contorno derivado, é esse contorno que será medido por quem consome. `[DOC]` `[S1]`

### 1.2 `PredefinedType` — e a confusão `ELEMENT`/`PARTIAL`

**Correção importante.** A lista `ELEMENT, PARTIAL, EXTERNAL, INTERNAL...` mistura duas enumerações diferentes:

| Enumeração | Onde vive | Valores |
|---|---|---|
| `IfcElementCompositionEnum` | `CompositionType` (herdado de `IfcSpatialStructureElement`) | `COMPLEX`, `ELEMENT`, `PARTIAL` |
| `IfcSpaceTypeEnum` | `PredefinedType` (próprio de `IfcSpace`) | IFC4: `SPACE`, `PARKING`, `GFA`, `INTERNAL`, `EXTERNAL`, `USERDEFINED`, `NOTDEFINED` · IFC4x3: idem **+ `BERTH`** |

`[DOC]` `[S3]` `[S4]`

Significado dos valores de `PredefinedType` `[DOC]` `[S3]`:

| Valor | Descrição oficial | Uso prático no Hestia |
|---|---|---|
| `SPACE` | "Any space not falling into another category." | **Default** para cômodo interno. |
| `PARKING` | Vaga de estacionamento, incluindo acesso/faixa de manobra. | Vagas (se o Hestia modelar). |
| `GFA` | "Gross Floor Area — a specific kind of space for each building story that includes all net area and construction area (also the external envelope). Provision of such a specific space is often required by regulations." | **Espaço sintético por pavimento** para fechar a conta da área bruta. Muito útil para o quadro de áreas e para prefeitura. |
| `INTERNAL` | — (sem descrição) | **Depreciado** para indicar interior/exterior. |
| `EXTERNAL` | — (sem descrição) | **Depreciado**; usar `IsExternal`. |
| `USERDEFINED` | — | Exige `ObjectType`. |
| `NOTDEFINED` | — | "não classificado". |

A nota oficial é explícita: *"Previous use had been to indicates whether the IfcSpace is an interior space by value INTERNAL, or an exterior space by value EXTERNAL. **This use is now deprecated**, the property 'IsExternal' at 'Pset_SpaceCommon' should be used instead."* `[DOC]` `[S1]`

**Recomendação para o Hestia:** exportar `PredefinedType = .SPACE.` (ou `.PARKING.`) e `Pset_SpaceCommon.IsExternal = .T./.F.`. **Não** usar `INTERNAL`/`EXTERNAL`. Varanda/terraço coberto → `IsExternal = .T.` e, se preciso, uma propriedade própria de "tipo de ambiente externo". `[DOC]`

### 1.3 `CompositionType` e decomposição

- `COMPLEX` = grupo de espaços (pode conter `ELEMENT`);
- `ELEMENT` = espaço (default);
- `PARTIAL` = parte de espaço (ex.: "estar" dentro de "sala+estar").
- Regra de hierarquia: um espaço só pode decompor espaços com **CompositionType menor** (COMPLEX→ELEMENT→PARTIAL), via `IfcRelAggregates`. `[DOC]` `[S1]`

**Para o Hestia:** `ELEMENT` em tudo. `PARTIAL` é a saída normativa para "ambiente aberto com sub-áreas" (sala/estar/jantar sem parede entre eles) — o que é bem comum em residência. Vale considerar no roadmap: um ambiente `ELEMENT` com `PARTIAL` filhos para o quadro de áreas detalhado.

### 1.4 Relação com `IfcBuildingStorey`

Duas relações **distintas**, ambas necessárias:

| Relação | Como | Por quê |
|---|---|---|
| **Decomposição espacial** | `IfcRelAggregates` (storey → space), `RelatingObject = storey`, `RelatedObjects = [space]` | Coloca o espaço na árvore do projeto (é o que a maioria dos visualizadores usa para agrupar). |
| **Posicionamento** | `IfcLocalPlacement.PlacementRelTo` = placement do `IfcBuildingStorey` (ou do `IfcSite`, no caso de espaços externos) | A especificação **exige** que o placement relativo do espaço aponte para o storey (ou site). `[DOC]` `[S1]` |

Cuidado para não confundir com **contenção**: `IfcRelContainedInSpatialStructure` é para **elementos físicos** (móveis, equipamentos) dentro do espaço — não para o espaço dentro do pavimento. Espaço→pavimento é **aggregation**. `[DOC]` `[S1]`

Alturas — a figura oficial do schema é a melhor referência que existe para "pé-direito": `[DOC]` `[S1]`

| Conceito IFC | De → até | Onde é gravado |
|---|---|---|
| Cota do espaço (= cota do pavimento, topo da laje) | topo da laje | `IfcBuildingStorey.Elevation` |
| Cota do piso acabado | topo da laje → topo do piso | `IfcSpace.ElevationWithFlooring` |
| **`Height`** | topo da laje inferior → face inferior da laje superior | `Qto_SpaceBaseQuantities.Height` ("only if constant height") |
| `FinishFloorHeight` | topo da laje → topo do piso | `Qto_...FinishFloorHeight` |
| **`FinishCeilingHeight`** | topo do piso → face inferior do forro | `Qto_...FinishCeilingHeight` |

**Consequência:** o campo "pé-direito" do Hestia hoje é ambíguo. A NBR 15575 define pé-direito como *"distância entre o piso de um andar e o teto deste mesmo andar"* `[DOC]` `[S21]` — logo o número auditável é o **vão livre piso→teto** = `FinishCeilingHeight` (ou `Height` menos espessura de piso e de forro). Recomendo guardar **`height` (estrutural)** e derivar o livre; e exportar os dois quando fizer sentido. Ver §2.5.

### 1.5 `IfcZone` vs `IfcSpatialZone`

| | `IfcZone` | `IfcSpatialZone` |
|---|---|---|
| Natureza | **Agrupamento** de espaços/zonas (`IfcSystem` → `IfcGroup`) | Elemento espacial **com posicionamento e forma próprios** |
| Geometria | **Não tem** representação própria | **Pode ter** |
| Hierarquia | Não hierárquico; um espaço pode estar em **várias** zonas | Não hierárquico, potencialmente sobreposto |
| Associação | `IfcRelAssignsToGroup` | `IfcRelReferencedInSpatialStructure` |
| Exemplos oficiais | **"a zone might be used to represent an apartment as a group of spaces"**; compartimento de incêndio (`ObjectType='FireCompartment'`), shaft de elevador (`'ElevatorShaft'`), duto vertical (`'RisingDuct'`) | zona térmica, zona de iluminação, zona de obra, "usable area zone" |
| Pset | `Pset_ZoneCommon` | `Pset_SpatialZoneCommon` + `Qto_SpatialZoneBaseQuantities` (Length/Width/Height) |

`[DOC]` `[S8]` `[S9]`

**Isto resolve uma lacuna estrutural do Hestia.** Residência vertical = **unidade autônoma**. Se o produto quer "apartamento → ambientes", a modelagem correta é:

```
IfcBuildingStorey
  └─ IfcSpace (cada cômodo, CompositionType=ELEMENT)
IfcZone  (Name="Apto 101", LongName="Apartamento 101", ObjectType="Apartment")
  └─ IfcRelAssignsToGroup → [sala, dorm1, dorm2, banho, cozinha, ...]
```

Vantagens: (a) a área da unidade pode ser **calculada** (soma) ou **declarada** em `Pset_ZoneCommon.NetPlannedArea`; (b) não duplica geometria; (c) é o que o ArchiCAD/Revit exportam como "zona/área"; (d) permite rateio/fração ideal no futuro. `[DOC]` `[S8]`

### 1.6 Psets e Qtos esperados

#### `Pset_SpaceCommon` — o "cartão de identidade" do espaço

Aplicável a `IfcSpatialElement` (portanto `IfcSpace` **e** `IfcSpatialZone`) e a `IfcSpatialElementType` desde IFC4.3. **Não** se aplica a `IfcZone` — para zona o Pset é o `Pset_ZoneCommon` (mesmos campos). `[DOC]` `[S5]` `[S8]`

| Campo | Tipo | Significado | Hestia |
|---|---|---|---|
| `Reference` | `IfcIdentifier` | ID de tipo/execução ("A-1"), alternativa a `ObjectType`. **DEPRECIADO em IFC4.3** — usar `Name` do tipo. | Não usar. |
| `IsExternal` | `IfcBoolean` | "designed for use in the exterior (TRUE) or not (FALSE)... faces the outside of the building" | **Adicionar.** É o substituto oficial de `INTERNAL`/`EXTERNAL`. |
| `GrossPlannedArea` | `IfcAreaMeasure` | "Total planned gross area... **Used for programming** the spatial structure element" | **Programa**, não medição. Bom para "metragem-alvo" do briefing. |
| `NetPlannedArea` | `IfcAreaMeasure` | "Total planned net area... Used for programming the object" | idem. |
| `PubliclyAccessible` | `IfcBoolean` | Espaço destinado a acesso público (ex.: sanitário público) | Residencial: `.F.`. |
| `HandicapAccessible` | `IfcBoolean` | Acessível conforme código local | Útil com NBR 9050. |

> **Distinção que evita erro grave:** `Pset_*PlannedArea` = **intenção de projeto/programa**; `Qto_SpaceBaseQuantities` = **medição do modelo**. Se o Hestia só tem medição, deve emitir **só** o `Qto` (ou emitir `Pset` com o valor do programa quando existir um briefing). Repetir o mesmo número nos dois lugares destrói a informação de desvio. `[DOC]` `[S5]` `[S11]`

#### `Pset_SpaceOccupancyRequirements` — ocupação

Aplicável a `IfcSpatialElement`, `IfcSpatialZone`, `IfcZone` e tipos. `[DOC]` `[S7]`

| Campo | Tipo | Significado |
|---|---|---|
| `OccupancyType` | `IfcLabel` | Tipo de ocupação **segundo o código de obras nacional** |
| `OccupancyNumber` | `IfcCountMeasure` | Nº de pessoas previstas para a atividade |
| `OccupancyNumberPeak` | `IfcCountMeasure` | Nº máximo em pico |
| `OccupancyTimePerDay` | `IfcTimeMeasure` | Tempo/dia de uso |
| `AreaPerOccupant` | `IfcAreaMeasure` | Carga de ocupação de projeto (m²/pessoa) |
| `MinimumHeadroom` | `IfcLengthMeasure` | Pé-direito mínimo exigido para a atividade |
| `IsOutlookDesirable` | `IfcBoolean` | Se é desejável vista exterior |

**Uso residencial:** `MinimumHeadroom` é o gancho natural para **validar 2,50/2,30 m da NBR 15575** ambiente por ambiente; `OccupancyNumber` serve para dimensionar dormitórios (2 pessoas etc.) e para a tabela de programa. `[DOC]` `[S21]`

#### `Qto_SpaceBaseQuantities` — a medição

Campos oficiais (todos `IfcQuantityLength/Area/Volume`) `[DOC]` `[S6]`:

| Quantidade | Tipo | Definição oficial (resumo) | Observação para o Hestia |
|---|---|---|---|
| `Height` | comprimento | Topo da laje (sem piso) → face inferior da laje (sem forro). Só se altura constante. | É o "pé-direito estrutural". |
| `FinishCeilingHeight` | comprimento | Topo do piso → face inferior do forro suspenso. | **É o pé-direito livre que a NBR 15575 fiscaliza.** |
| `FinishFloorHeight` | comprimento | Topo da laje → topo do piso. | Precisa do dado de acabamento de piso (o Hestia já tem). |
| `GrossPerimeter` | comprimento | Perímetro no contorno externo, no nível do piso, **incluindo** trechos criados por limites virtuais e vãos (portas). | = perímetro do polígono bruto (sem furos). |
| `NetPerimeter` | comprimento | Perímetro líquido no nível do piso; **exclui** limites virtuais e vãos; **pode incluir** o perímetro de objetos fixos internos (pilares). | = polígono com furos: o perímetro **aumenta** com o pilar; é o usado para rodapé. |
| `GrossFloorArea` | área | Soma das áreas brutas; **inclui** elementos internos (pilares, paredes internas) e **exclui** revestimentos de parede. | Não é o número atual do Hestia. |
| `NetFloorArea` | área | Área **utilizável líquida**; **exclui** pilares, paredes internas, embutidos, aberturas de laje e saliências. Não reduz por altura livre. | **É o número atual do Hestia.** |
| `GrossWallArea` | área | Área de paredes (e outros elementos verticais, ex. pilares) delimitantes, **incluindo** vãos. | Bom para acabamento de parede (tinta/reboco bruto). |
| `NetWallArea` | área | Idem, **excluindo** vãos. | Bom para revestimento efetivo. |
| `GrossCeilingArea` | área | Área de teto **real** (não projetada) — inclui elementos internos. | Forro. |
| `NetCeilingArea` | área | Idem, excluindo elementos internos. | Forro efetivo. |
| `GrossVolume` | volume | Volume bruto; aberturas/recortes não descontados. | |
| `NetVolume` | volume | Volume líquido, descontando elementos construtivos internos. | Para carga térmica/AVAC. |

Duas armadilhas explícitas na definição `[DOC]` `[S6]`:
1. `NetFloorArea` **não** reduz área sob pé-direito baixo — *"Varying heights are not taking into account (i.e. no reduction for areas under a minimum headroom)"*. Quem quer descontar sótão/escada precisa de outra quantidade/propriedade.
2. `GrossFloorArea` **exclui** a área de revestimentos de parede — logo não é "até a face de acabamento + pilares": é medida na **face estrutural**.

### 1.7 O que um exportador **deve** preencher para ser considerado bom

Três níveis. O nível 2 é o mínimo para eu chamar o arquivo de "profissional".

**Nível 1 — válido (passa no schema)**
- `GlobalId` estável, `IfcSpace` agregado ao `IfcBuildingStorey` via `IfcRelAggregates`.
- `ObjectPlacement` relativo ao storey.
- `Name` (número) e `LongName` (nome) preenchidos — não trocados.
- `CompositionType = .ELEMENT.`; `PredefinedType` com valor **da enumeração** (`.SPACE.`), nunca `.ELEMENT.`.
- `Representation` com `FootPrint` (curva 2D fechada, `IfcPolyline`/`IfcCompositeCurve`) — e, se houver 3D, `Body` por extrusão.
- Unidades declaradas em `IfcUnitAssignment` (m, m², m³).

**Nível 2 — bom (auditável)**
- `Pset_SpaceCommon` com `IsExternal` sempre presente.
- `Qto_SpaceBaseQuantities` com `NetFloorArea`, `NetPerimeter`, `Height` **e coerência interna** (área compatível com o polígono exportado, dentro de tolerância).
- `MethodOfMeasurement` no(s) `IfcElementQuantity` (ver 1.9).
- `ElevationWithFlooring` preenchido (permite conferir piso × laje).
- `IfcRelSpaceBoundary` de 1º nível (`PHYSICAL`) ligando cada espaço às paredes que o delimitam.
- Nome de `Pset`/`Qto` **exatamente** como no schema (`NetFloorArea`, não `Area`; `GrossPerimeter`, não `Perimeter`).

**Nível 3 — excelente (interoperável de verdade)**
- `IfcZone` por unidade/apartamento; `Pset_ZoneCommon`.
- `IfcClassificationReference` (ex.: classificação de uso do solo/ABNT/Uniclass) por espaço.
- `IfcSpaceType` + `IfcRelDefinesByType` para tipos de ambiente reutilizáveis (com Psets no tipo e override na ocorrência — regra "occurrence overrides type").
- Segundo `IfcElementQuantity` para o método nacional (ex.: `MethodOfMeasurement='NBR 12721'`, `Name='Área real privativa'`).
- `IfcRelSpaceBoundary` **2º nível** (para térmica/energia) e `IfcVirtualElement` para as linhas de separação.
- `IfcSpaceTypeEnum.GFA` por pavimento para fechar a área bruta.
- `LongName` + `Description` com dados de acabamento em `Pset_SpaceCoveringRequirements` (o Hestia já tem o dado — hoje ele morre no banco).
- `Representation` também `Body` quando há duplo pé-direito (o consumo 3D agradece).

### 1.8 `IfcRelSpaceBoundary` — fronteiras (e a oportunidade fácil)

- Define o **delimitar físico ou virtual** de um espaço, ligando-o a elementos. **Sempre visto de dentro do espaço.** `[DOC]` `[S10]`
- 1º nível: fronteira do espaço sem considerar o que há do outro lado (visão **arquitetônica/FM**).
- 2º nível: considera material do elemento e espaço adjacente; tipo **A** (há espaço do outro lado) e **B** (há elemento construtivo) — visão **térmica**. `[DOC]` `[S10]`
- Nomes convencionados: `Name='1stLevel'`, `Description=NIL`; ou `Name='2ndLevel'`, `Description='2a'`/`'2b'`. `[DOC]` `[S10]`
- `PhysicalOrVirtualBoundary` (`PHYSICAL`/`VIRTUAL`) e `InternalOrExternalBoundary` (`INTERNAL`/`EXTERNAL`/...). Se `VIRTUAL`, o `RelatedBuildingElement` **tem** que ser `IfcVirtualElement` (ou `IfcOpeningElement`). `[DOC]` `[S10]`
- A geometria de conexão (`ConnectionGeometry`) é opcional; sem ela, a relação é apenas lógica. `[DOC]` `[S10]`

**Para o Hestia é a integração mais barata que existe:** o circuito fechado **já sabe** quais paredes delimitam o ambiente. Emitir `IfcRelSpaceBoundary` 1º nível `PHYSICAL`/`INTERNAL` (ou `EXTERNAL` se `IsExternal`) é quase um `for` sobre as paredes do circuito — e é o que separa um export "de visualização" de um export "de engenharia". As **linhas de separação de 1 mm** viram `VIRTUAL` + `IfcVirtualElement`. `[DOC]` `[S10]`

### 1.9 Declarar o método de medição (o campo que resolve o problema)

`IfcElementQuantity.MethodOfMeasurement` (opcional, `IfcLabel`): *"defines the code, e.g. from a standard method of measurement, which had been used to calculate the element quantity"*. E a documentação dá o exemplo exato: `[DOC]` `[S11]`

> *"To exchange the net floor area of spaces in the German region (as IfcSpace), the name might be 'Netto-Grundfläche' (net floor area), and the method of measurement might be accordingly 'DIN277-2'... The same instance of IfcSpace may have a different area measure assigned in the German region according to a housing regulation, the name would be 'Wohnfläche' and the method of measurement would be '2.BV'. It would be attached to the IfcSpace by a separate IfcRelDefinesByProperties relationship."*

Regras gerais dos *base quantities* `[DOC]` `[S11]`:
- `IfcElementQuantity.Name` = `'BaseQuantities'`
- `IfcElementQuantity.MethodOfMeasurement` = `'BaseQuantities'`
- Nomes das quantidades conforme a especificação.
- **Várias** `IfcElementQuantity` podem ser ligadas ao mesmo elemento, cada uma com seu método.
- `UniqueQuantityNames`: nomes únicos dentro do conjunto.

**Desenho recomendado para o Hestia (3 camadas, sem ambiguidade):**

| Camada | `Name` | `MethodOfMeasurement` | Conteúdo |
|---|---|---|---|
| Base | `BaseQuantities` | `BaseQuantities` | `NetFloorArea`, `NetPerimeter`, `Height`… |
| Norma BR | `Área real privativa` | `NBR 12721` | valor medido **até face externa/eixo** (exige geometria de parede) |
| Norma intl. | `IPMS 4.2` | `IPMS 4.2` | valor medido até **superfície acabada**, paredes/pilares subtraídos (= área do Hestia) |

Isso transforma "qual área?" de discussão em **dado**.

---

## 2. Normas de medição de área

### 2.1 ISO 9836:2017 — a árvore canônica

Escopo: define e calcula indicadores de superfície e volume, usando **três conceitos de medição**: intra-muros/extra-muros, **eixo de parede** ("wall centre") e variações nacionais. Nota oficial: nem todo método é prático (*"inability to identify real area (e.g. the wall centre method)"*). `[DOC]` `[S12]`

Árvore (figura 2 da norma, reconstruída) `[DOC]` `[S12]`:

```
Área total do piso (total floor area)
├── Área dos elementos estruturais (area of structural elements)
└── Área líquida do piso (net floor area)
    ├── Área útil (usable area)            → principal / subsidiária
    ├── Área de serviços (services area)
    └── Área de circulação (circulation area)
```

Definições (cláusulas verificadas no texto da norma) `[DOC]` `[S12]`:

| Cláusula | Termo | Conteúdo |
|---|---|---|
| 5.1.1.1 | Princípios | Planos inclinados medidos pela **projeção vertical**; para ganho/perda de calor usa-se a área real exposta. |
| **5.1.1.2** | Unidade | **"expressed in square metres, to two decimal places"** |
| 5.1.2 | Área coberta (covered area) | Projeção vertical das dimensões externas no terreno; exclui o que não sobressai do solo, escadas externas, rampas, marquises, beirais. |
| 5.1.3 | Área total do piso | Todos os níveis; obtida pelas **dimensões externas** dos elementos envolventes, **incluindo acabamentos, revestimentos e parapeitos**; recortes/ressaltos estéticos não contam se não alterarem a área líquida. |
| 5.1.3.2 | | Distinguir: (a) fechado e coberto nos 4 lados; (b) não fechado em altura total mas coberto (**varanda reentrante**); (c) contido em componentes sem cobertura (**varanda aberta**). |
| 5.1.3.5 | | **Área total = área líquida + área de estrutura** (sem sobreposição). |
| 5.1.4 | Área intra-muros | Área total **menos** a área das paredes externas; inclui a líquida **e** as paredes internas. |
| 5.1.5 | Área líquida do piso | Área **entre** os elementos envolventes, pelas **dimensões livres da obra acabada**, excluindo rodapés e soleiras. |
| 5.1.5.3 | | Componentes desmontáveis (divisórias, tubos, dutos) **entram** na líquida. |
| 5.1.5.4 | | **Não** entram: elementos estruturais, vãos de portas/janelas e nichos. |
| 5.1.6 | Área de estrutura | Seção horizontal dos elementos envolventes (paredes estruturais externas/internas) + **pilares, chaminés, divisórias não acessíveis**. Inclui **vãos de porta e nichos**. |
| 5.1.7 | Área útil | Parte da líquida que corresponde ao **uso** do edifício; subdividida em **principal** e **subsidiária** (critério: integra ou apoia o uso principal). |
| 5.1.8 | Área de serviços | Parte da líquida para instalações técnicas de suprimento/descarte. |
| 5.1.9 | Área de circulação | Parte da líquida para acesso, circulação interna e saída de emergência. **Esforços de circulação dentro de salas não contam.** (redação de 5.1.9 não lida na íntegra — a distinção "movimento dentro do cômodo não é circulação" está confirmada no equivalente alemão, DIN 277 VF) |
| 3.4–3.7 | Perdas | `building loss feature`, `effective/actual building loss area`, `perimeter encroachment` (pilastra, convector, radiador). |

**Insight para o Hestia:** a área líquida do Hestia é a 5.1.5 (face acabada interna, sem estrutura). A **estrutura** do Hestia é a diferença para a área total — e é exatamente o que o `GrossFloorArea` do IFC tenta representar. Como o Hestia mede na face de acabamento, ele **sabe** a espessura do revestimento (está no modelo de acabamentos) e portanto consegue derivar a área estrutural e a bruta com precisão — mas só se a geometria de parede guardar a face estrutural.

### 2.2 ANSI/BOMA Z65.1 (rentable)

- Edição vigente: **ANSI/BOMA Z65.1-2024** ("BOMA 2024 for Office Buildings — Standard Methods of Measurement"), que substitui a de 2017. `[DOC]` `[S16]`
- Conceitos-chave `[SEC]` `[S17]`: **Gross Building Area / Construction Area** (até a face externa, sem deduções); **Usable Area** (área ocupada pelo locatário, sem *gross-up*; nas versões novas chamada **Occupant Area**); **Rentable Area** (área que o locador cobra); **R/U ratio** (rentable ÷ usable) = **load factor** = **common area factor**; **Major Vertical Penetrations** (escadas, poços de elevador, shafts) **excluídas** da rentable.
- **Dominant portion**: regra para fachada envidraçada — a linha de medição segue a porção **dominante** do painel (ex.: 60% vidro / 40% alvenaria → domina o vidro). `[SEC]` `[S17]`
- Circulação: BOMA distingue **primary** e **secondary** circulation, e **não** inclui circulação na "net area". `[SEC]` `[S18]`

**Por que importa para um software residencial:** mesmo sem uso comercial, o par **usable × rentable** é o ancestral do par **"área do cômodo × área da unidade com rateio de comum"** que o Hestia vai precisar para fração ideal. E a regra de **excluir penetrações verticais** é a que evita dupla contagem em pavimentos com escada.

### 2.3 IPMS (RICS/IPMSC) — a norma que descreve o Hestia

Publicada pelo **IPMS Coalition** (80+ entidades) e distribuída pelo RICS; a edição consolidada é **IPMS: All Buildings (15/01/2023)**, que substitui as edições por classe de ativo. `[DOC]` `[S14]` `[S15]`

Estrutura `[DOC]` `[S14]`:

| Norma | O que mede |
|---|---|
| **IPMS 1** | Mediçao **externa** do edifício/parte (até a face externa das paredes externas, incluindo varandas/terraços). |
| **IPMS 2** | Medição **interna** do edifício/parte (até a **IDF**). |
| **IPMS 3.1** | Ocupação exclusiva, medição **externa**. |
| **IPMS 3.2** | Ocupação exclusiva, medição **interna** (até IDF; **eixo** das paredes de divisa entre ocupantes; superfície acabada nas demais). |
| **IPMS 4.1** | Área **selecionada**, até superfície acabada, **incluindo** paredes e pilares. |
| **IPMS 4.2** | Área **selecionada**, até superfície acabada, **excluindo (subtraindo)** paredes e pilares. |

Conceitos técnicos que valem como especificação de cálculo `[DOC]` `[S14]`:

- **IDF (Internal Dominant Face)**: a face interna que compreende **mais de 50%** dos **2,75 m** inferiores medidos a partir do piso estrutural (ou até o teto, se mais baixo), por **trecho de parede**; se não houver dominante, vale a **superfície acabada**. → É a regra que resolve "a janela vai até o chão: a área vai até o vidro ou até a parede?".
- **Paredes e pilares dentro do limite não são deduzidos** em IPMS 1/2/3.x — *"The areas occupied by Walls and Columns within the Boundary are not deducted."* (≠ Hestia)
- **Aberturas < 0,1 m²** (tubulações, eletrodutos, vents) são **ignoradas** e absorvidas pelo componente vizinho.
- **Component Areas** (A–H): A = paredes/pilares/limites notiais; B = penetrações verticais; C = técnicas; D = sanitárias; E = circulação horizontal; F = primárias; G = secundárias (amenidades/ancilares); H = outras. **A soma das Component Areas = IPMS 1.** → Este é o modelo de dados de "quadro de áreas" mais bem especificado que existe, e o Hestia pode copiá-lo como enum de "tipo de área".
- **Regra de uso dominante**: porção que serve a mais de um componente vai para o que melhor reflete o uso principal; componente com mais de um uso vai pelo **uso dominante**.
- **Relatório (B.3)** deve declarar: uso do edifício; **qual IPMS**; **método e ferramentas** de medição; unidade; data; e se houve **verificação in loco**. Reportar **por nível**. **Level 0** = entrada principal do térreo.
- **Limited use areas** (sem luz natural, altura restrita) **entram** na medição mas devem ser **declaradas separadamente**.
- **Selado/duplo:** `External Floor Area` e `Sheltered Area` entram, mas têm regras próprias de limite (borda da laje × junção piso-guarda-corpo).

**A equivalência mais forte do relatório:** o Hestia mede exatamente **IPMS 4.2** (superfície acabada menos paredes e pilares), e a IPMS cita "room areas within a residence" como caso de uso de 4.1/4.2. `[DOC]` `[S14]`

### 2.4 DIN 277 (Alemanha)

DIN 277:2021-08 ("Grundflächen und Rauminhalte im Hochbau"). `[DOC-]` `[S19]`

```
BGF (Brutto-Grundfläche)
├── KGF (Konstruktions-Grundfläche)   paredes, pilares, chaminés, poços não acessíveis,
│                                     vãos de porta, nichos e rasgos
└── NRF (Netto-Raumfläche)
    ├── NUF (Nutzungsfläche)          uso (até 2016: "Nutzfläche NF")
    ├── TF  (Technikfläche)           instalações técnicas
    └── VF  (Verkehrsfläche)          acesso/circulação/saída
```

Detalhes `[DOC-]` `[S19]`:
- **KGF inclui vãos de porta, nichos e rasgos** — mesma lógica da ISO 9836 5.1.6.
- **VF não inclui áreas de movimento dentro dos cômodos** — *"Bewegungsflächen innerhalb von Räumen zählen nicht dazu"*.
- **Sufixo de tipo de recinto**: `(R)` = Regelfall (interno, fechado e coberto) e `(S)` = Sonderfall (loggia, varanda, terraço, pátio, escada externa). Substituiu os antigos "a/b/c". → **Isto é ouro para o Hestia**: em vez de um booleano `isExternal`, o modelo deveria ter `enclosureType: R | S` (fechado / não fechado), porque varanda coberta (S) não é nem "interno" nem "externo" puro.
- Volume: `BRI` bruto (medido pelas faces externas), `NRI` líquido, `KRI` = diferença.

### 2.5 Brasil: NBR 12721, NBR 15575, NBR 6492

#### NBR 12721 — áreas para incorporação

Item **5.3 — Área real privativa da unidade autônoma**, texto normativo (citado literalmente em artigo acadêmico que transcreve a norma) `[DOC]` `[S20]`:

> "Área da superfície limitada pela linha que contorna as dependências privativas, cobertas ou descobertas, da unidade autônoma, excluídas as áreas não edificadas, passando pelas projeções: a) das **faces externas das paredes externas** da edificação e das paredes que separam as dependências privativas da unidade autônoma, das dependências de uso comum; e b) dos **eixos das paredes** que separam as dependências privativas da unidade autônoma considerada, das dependências privativas de unidades autônomas contíguas."

Consequências `[DOC]` `[S20]`:
- Parede externa → **100%** da espessura entra na privativa da unidade (até a face externa).
- Parede divisa entre unidades → **50%** (até o eixo).
- A unidade é "maior" que a soma dos cômodos na face acabada: a diferença é exatamente **metade das paredes internas + a espessura total das externas + pilares internos**.
- Item **5.4** define **área real de uso comum** ("superfície limitada pela linha que contorna a dependência de uso comum, coberta ou descoberta"); item **5.7** define **área equivalente** = área virtual cujo **custo** é equivalente ao da área real (aplicada a varanda, garagem, terraço por coeficiente). `[DOC]` `[S20]`
- Os **Quadros I e II** da norma classificam cada área em: **privativa**, **uso comum de divisão não proporcional** e **uso comum de divisão proporcional**; a **fração ideal** sai do coeficiente de proporcionalidade. `[DOC]` `[S20]`

**"Área útil" não é termo da NBR 12721.** A norma fala em *área real privativa*, *área real de uso comum*, *área real total* e *área equivalente*. "Área útil" é expressão de mercado (piso andável dentro das paredes) e "área construída" costuma vir do **código de obras municipal**, não da ABNT. `[SEC]` `[S20]`

**Ação para o Hestia:** o número exibido hoje (face acabada interna) é a "área útil" de mercado — **não** é a área privativa registrável. Se o produto quiser apoiar memorial de incorporação, precisa de uma segunda medição com regra de eixo/face externa, e um campo "critério de medição" no projeto.

#### NBR 15575-1 — pé-direito (e por que o campo do Hestia precisa de nome)

Texto normativo, item **16.1.1** `[DOC]` `[S21]`:

> "A altura mínima de pé-direito **não pode ser inferior a 2,50 m**. Em **vestíbulos, halls, corredores, instalações sanitárias e despensas**, é permitido que o pé-direito seja reduzido ao **mínimo de 2,30 m**. Nos tetos com vigas, inclinados, abobadados ou, em geral, contendo superfícies salientes na altura piso a piso e/ou o pé-direito mínimo, devem ser mantidos **pelo menos 80% da superfície do teto**, permitindo-se na superfície restante que o pé-direito livre possa descer até o **mínimo de 2,30 m**."

E a definição (3.33): *"pé-direito: distância entre o piso de um andar e o teto deste mesmo andar"*. `[DOC]` `[S21]`

Outros itens correlatos: **16.2** (disponibilidade mínima de espaços para móveis/equipamentos — Anexo F, informativo, com Tabela F.2 de dimensões mínimas de mobiliário e circulação); **16.3** (acessibilidade — remete à **NBR 9050**); **16.4** (possibilidade de ampliação). `[DOC]` `[S21]`

**Aplicação prática:** um validador de pé-direito no Hestia deve (a) comparar o **vão livre** (piso acabado → teto/forro), não a laje-a-laje; (b) aplicar **2,30 m** para vestíbulo/hall/corredor/banheiro/despensa; (c) tratar **vigas** com a regra dos 80%/2,30 m; (d) registrar qual regra foi aplicada. Isso pede que o "pé-direito" do `Room` seja explicitamente `freeHeight` (e não um número genérico).

#### NBR 6492:2021 — representação (detalhada em §3)

Só o que é relevante para áreas: a norma **não prescreve conteúdo** do quadro de áreas — *"O quadro de áreas pode constar nas pranchas do projeto ou no memorial"* (A.9.2). Ou seja: **conteúdo é prática de mercado**, formato é livre. `[DOC]` `[S22]`

### 2.6 Comparação: onde cada método "corta" a parede

| Método | Linha de medição na parede externa | Parede entre unidades | Pilares internos | Varanda aberta | Circulação |
|---|---|---|---|---|---|
| **Hestia hoje** | face de **acabamento** interna | face de acabamento (cada lado) | **subtraídos (furo)** | ? | é um ambiente como outro |
| **IFC `NetFloorArea`** | face interna, exclui revestimento? (a definição fala em excluir claddings só no gross) | idem | **subtraídos** | não especificado | incluída |
| **IFC `GrossFloorArea`** | inclui paredes internas e pilares, exclui revestimentos | — | **incluídos** | — | incluída |
| **ISO 9836 5.1.5 (líquida)** | dimensões livres da obra **acabada** | livre de cada lado | **excluídos** (5.1.5.4) | classe própria (b/c) | subclasse própria (5.1.9) |
| **ISO 9836 5.1.3 (total)** | face **externa**, inclui acabamentos | — | incluídos | classe própria | incluída |
| **IPMS 2 / 3.2** | **IDF** (>50% dos 2,75 m) | eixo (3.2) | **não deduzidos** | regra própria | componente E |
| **IPMS 4.2** | **superfície acabada** | superfície acabada | **subtraídos** | — | — |
| **DIN 277 NRF** | face interna | — | **excluídos** (KGF) | sufixo (S) | VF própria |
| **NBR 12721 privativa** | face **externa** | **eixo** | incluídos | "cobertas ou descobertas" (verificar coeficiente) | dentro da privativa |

`[DOC]` `[S6]` `[S12]` `[S14]` `[S19]` `[S20]`

**Leitura:** existem **três** linhas de corte dominantes — face externa, eixo, face interna acabada — e **duas** políticas para pilar (dentro ou fora). O Hestia escolheu (face interna acabada + pilar fora) = **IPMS 4.2**. Isso é legítimo e moderno; o que não é legítimo é chamar esse número de "área privativa", "área construída" ou `GrossFloorArea`.

### 2.7 Por que o software **precisa** deixar o método explícito

1. **"Net area" não tem um significado único.** A EN 15221-6 **inclui** circulação na net area; a ANSI/BOMA **não** (circulação + net = usable). Mesmo imóvel, mesma planta, dois números. `[SEC]` `[S18]`
2. **O mesmo nome, área diferente na Alemanha**: `Netto-Grundfläche` existe em DIN 277:2005 e em DIN 277-1:2016 com **definições diferentes**, e a própria norma mudou de nome de `NF` para `NUF` em 2016. `[DOC-]` `[S19]`
3. **No Brasil, a área privativa é a que vale no registro**, e ela é medida no eixo/face externa — não na face acabada. Um app que mostra "62,4 m²" e o memorial que diz "70,1 m² privativos" gera litígio (o Código Civil admite abatimento por diferença de área — art. 500). `[SEC]` `[S20]`
4. **O IFC já tem onde escrever isso** (`MethodOfMeasurement`) — não escrever é escolha, não limitação. `[DOC]` `[S11]`
5. **A IPMS obriga a declarar** padrão, método, ferramenta, unidade, data e verificação. É o melhor modelo de "rodapé de tabela" que existe. `[DOC]` `[S14]`

**Recomendação de produto:** no Hestia, cada projeto tem um campo **`areaMethod`** (enum: `IPMS 4.2` / `ISO 9836 líquida` / `NBR 12721 privativa` / `personalizado` + texto livre). Esse valor (a) aparece na etiqueta (opcional), (b) no cabeçalho da tabela de áreas, (c) no `MethodOfMeasurement` do IFC, (d) no bloco de notas do DXF. Sem isso, o número é só um número.

---

## 3. Representação gráfica de ambientes em planta

### 3.1 Contexto normativo: a planta é um corte

A NBR 6492:2021 define **planta de pavimento** como *"vista superior resultante de um plano secante horizontal, que corta a edificação em uma determinada altura"* e recomenda: *"a altura do plano secante seja de **1,50 m**"*, podendo variar por projeto, com as exceções **informadas claramente**. `[DOC]` `[S22]`

Consequências diretas para o Hestia:
- O que aparece "cheio" (poché) é o que é **cortado** a 1,5 m — parede baixa (guarda-corpo, meia-parede de box) **não** é cortada e portanto não deve ser desenhada com o mesmo peso de alvenaria.
- A etiqueta de ambiente é, normativamente, **anotação sobre um corte** — não um objeto 3D. Ela deve poder existir sem o ambiente estar "selecionado".
- Se o produto permite "corte a 1,20 / 1,50 / 2,10", isso deve ser **declarado** (a norma pede que exceções sejam informadas).

### 3.2 Poché / preenchimento

| Prática | Status | Fonte |
|---|---|---|
| Elementos **cortados** (alvenaria, pilar) recebem **hachura/poché cheio** — em geral sólido escuro ou hachura densa | **padrão de mercado / norma** (NBR 6492 A.10 "representação dos materiais" e A.1.4 "usos dos tipos de linha") | `[DOC]` `[S22]` |
| Elementos **além do plano de corte** (mobiliário, peitoril, projeção de laje) em linha fina, sem preenchimento | padrão | `[DOC]` `[S22]` |
| **Ambiente com preenchimento translúcido colorido** por tipo de uso | **preferência de escritório** (não é exigência da NBR 6492; é o que ArchiCAD faz por *Zone Category* e o Revit por *Color Scheme*) | `[SEC]` `[S18]` (BOMA chama de *color schematics*), `B-pesquisa-archicad.md` §10 |
| Hachura **por material** em vez de cor | norma (A.10) / prática de executivo | `[DOC]` `[S22]` |
| Preenchimento **sólido** cobrindo o ambiente inteiro | evite: conflita com o poché das paredes e com mobiliário | prática |

**Regras de ouro para o preenchimento translúcido do Hestia:**
1. **Nunca** usar opacidade acima de ~15–20%: acima disso o mobiliário e o poché das paredes somem na impressão em P&B.
2. **Nunca** codificar informação **só** por cor (daltonismo + impressão monocromática). Sempre cor **+** padrão/hachura **+** rótulo.
3. Preenchimento deve ficar **abaixo** de tudo (mobiliário, cotas, texto) e **acima** do fundo.
4. A **legenda de cores** é obrigatória quando há cor (a NBR 6492 exige "legenda de símbolos" junto ao carimbo — 4.5.2 h). `[DOC]` `[S22]`
5. Um modo "P&B / alto contraste" deve existir e produzir hachuras distintas (o teste real é imprimir em laser P&B).

### 3.3 Espessuras de linha (peso gráfico)

**Tabela A.2 da NBR 6492:2021** — larguras de linha em mm de papel `[DOC]` `[S22]`:

| Grupo | Extralarga | Larga | Estreita |
|---|---|---|---|
| 0,25 | 0,50 | 0,25 | 0,13 |
| 0,35 | 0,70 | 0,35 | 0,18 |
| 0,50 | 1,00 | 0,50 | 0,25 |
| 0,70 | 1,40 | 0,70 | 0,35 |
| 1,00 | 2,00 | 1,00 | 0,50 |

A norma diz que, dentro de cada grupo, extralarga : larga : estreita seguem a proporção **1 : 1/2 : 1/4**, e entre famílias a proporção é múltipla de √2. `[DOC]` `[S22]`

**Hierarquia prática (escritório, escala 1:50–1:100)** `[SEC]` `[S23]`:

| Elemento | Peso típico | Observação |
|---|---|---|
| Linhas de construção / eixos / malha | 0,13 mm (ou tracejado) | "lapiseira 0,3" |
| Mobiliário, cotas, simbologia, textos auxiliares | 0,18–0,25 mm | |
| Caixilhos, portas, janelas, soleiras | 0,25–0,35 mm | cortados, mas menos importantes |
| **Alvenaria cortada** | **0,50–0,70 mm** | o "peso" do desenho |
| **Pilares / estrutura cortada** | **0,70–1,00 mm** | mais forte que alvenaria |

Regra que independe da escala: **a hierarquia se mantém** (pilar > alvenaria > caixilho) — o que muda é a espessura absoluta por escala. `[SEC]` `[S23]`

**Implicação para o DXF do Hestia:** o exportador deve usar **lineweights reais em mm** (0,13 / 0,25 / 0,50 / 0,70), `LWDISPLAY` ligado, e **não** apenas cores. Se usar cores, seguir a convenção **ASBEA** (manual de boas práticas em CAD) de cor→peso por camada, que é o que os escritórios brasileiros têm configurado nos `.ctb`. `[SEC]` `[S23]`

### 3.4 A etiqueta do ambiente: conteúdo, posição, tipografia

**Conteúdo.** Não há exigência normativa de conteúdo. Padrão de mercado (Revit/ArchiCAD/allplan):

```
NOME DO AMBIENTE
NÚMERO
ÁREA m²
```

Variações correntes: `NOME (NÚMERO) · ÁREA m²` em uma linha (o que o Hestia usa), ou nome + área sem número. Recomendação: manter **nome e número na primeira/segunda linha** e **área por último**, porque é assim que se lê em planta ("onde é? qual é? quanto tem?") e é o que o Revit faz por padrão (`Room Tag` = nome + número; área é parâmetro adicional que a maioria dos escritórios adiciona). `[SEC]`

**Posição.** Padrão: centro do **maior círculo inscrito** no polígono — não o centroide. Em ambientes em L, o centroide cai no canto/fachada e a etiqueta "vaza". O FreeCAD calcula a área em um plano horizontal na **cota do centro de massa** e deixa a posição do texto como atributo separado (`TextPosition`, `TextAlign`). `[DOC]` `[S25]` O Bonsai, ao reaproveitar um espaço existente, usa um **ponto interno do footprint** e comenta no código que *"a bounding box centre can fall outside a concave footprint"* — exatamente o mesmo problema. `[DOC]` `[S26]`

**Tipografia — NBR 6492:2021, Tabela A.3** (altura da caixa alta em mm de papel) `[DOC]` `[S22]`:

| Altura (mm) | Corpo (pt) | Aplicação |
|---|---|---|
| 7,0 | 28 | Título da prancha |
| 5,0 | 20 | Denominação/título do desenho |
| **3,5** | **14** | **Denominação dos ambientes**, marcação de eixos, acessos |
| 2,5 | 10 | Cotas, informações em geral, cotas de nível, numeração de folha |
| 1,8 | 7,5 | Numeração de espelhos e onde não couber 2,5 mm |

Regras adicionais de fonte (A.2.1) `[DOC]` `[S22]`:
- Fonte **sem serifa**, traço de espessura uniforme igual a **1/10 da altura da caixa alta**.
- Textos **preferencialmente em caixa alta** (maiúsculas), **exceto** unidades de medida e exigências ortográficas.
- **Não** itálico (exceto grafia estrangeira).

**Implicação direta:** o Hestia desenha em **px de tela**, mas a **planta é um documento em mm de papel**. O exportador DXF/PDF precisa converter: `altura_mm = 3,5` para nome de ambiente, `2,5` para área/cotas, **independente do zoom**. Se o app permitir "tamanho da etiqueta", ele deve ser expresso em mm de papel por escala (ex.: "3,5 mm @ 1:50"), não em px.

**Escalas usuais (A.3.1)** `[DOC]` `[S22]`: 1:1, 1:2, 1:5, 1:10, 1:20, 1:25, 1:50, 1:100, 1:200, 1:250, 1:500, 1:1000, 1:2000. → O seletor de escala do Hestia deve usar **esta lista**, não valores livres.

### 3.5 Legenda de esquema de cores

- A NBR 6492 exige, **próximo ao carimbo**, entre outros: **planta-chave**, **escala gráfica**, **convenções gráficas**, **notas gerais**, **legenda de símbolos** (4.5.2). `[DOC]` `[S22]`
- No mercado de medição (BOMA), o produto equivalente é o **"color schematic"**: planta colorida + planilha de áreas, com a legenda ligando cor → classe de área. `[SEC]` `[S17]` `[S18]`
- A IPMS recomenda que áreas reportadas sejam **cross-referenced a um desenho com cores e a uma planilha** de Component Areas. `[DOC]` `[S14]`

**Para o Hestia:** a legenda deve ser **gerada automaticamente** a partir dos tipos de ambiente presentes no pavimento, com: amostra de cor + hachura, nome do tipo, quantidade de ambientes, área total do tipo e % do pavimento. Isso já é metade do "quadro de áreas".

### 3.6 O que é norma × o que é preferência de escritório

| Item | Norma | Mercado/escritório |
|---|---|---|
| Séries de espessura de linha | ✅ NBR 6492 Tabela A.2 | qual peso para qual elemento |
| Altura de texto (3,5 mm ambiente / 2,5 mm cotas) | ✅ NBR 6492 Tabela A.3 | fonte específica, espaçamento |
| Fonte sem serifa, 1/10, caixa alta | ✅ NBR 6492 A.2.1 | família tipográfica |
| Escalas 1:1…1:2000 | ✅ NBR 6492 A.3.1 | qual escala por prancha |
| Plano de corte a 1,50 m | ✅ recomendação NBR 6492 4.1.2 | 1,20 / 1,50 / 2,10 |
| Carimbo no canto inferior direito, A4, com 10 campos | ✅ NBR 6492 4.5 | layout do carimbo |
| Legenda de símbolos junto ao carimbo | ✅ NBR 6492 4.5.2 | conteúdo da legenda |
| Hachura por material | ✅ NBR 6492 A.10 | qual hachura |
| **Preenchimento translúcido por tipo de ambiente** | ❌ não normatizado | ✅ padrão de fato |
| **Conteúdo da etiqueta (nome/nº/área)** | ❌ não normatizado | ✅ padrão de fato |
| **Etiqueta no maior círculo inscrito** | ❌ | ✅ boa prática |
| **Cor por categoria** | ❌ | ✅ padrão de fato (BOMA/ArchiCAD) |
| Escala gráfica + norte | ✅ NBR 6492 A.3.2 / A.4.1 | estilo do símbolo |
| **ISO 7519** | ✅ princípios gerais de apresentação para desenhos de disposição geral e montagem (ed. vigente 2024/2025; a de 1991 está retirada) | detalhes de traço/haitura — `[DOC]` `[S24]` |

---

## 4. Tabelas e quantitativos: boas práticas e dupla contagem

### 4.1 A regra estrutural: uma "área-mãe" e uma árvore

Todo quadro de áreas profissional tem **um** número raiz e uma **decomposição sem sobreposição**. A ISO 9836 dá a árvore (5.1.3.5: total = líquida + estrutura) e a IPMS dá o conjunto de componentes (A–H, cuja soma = IPMS 1). `[DOC]` `[S12]` `[S14]`

```
Área total do pavimento (GFA)
├── Estrutura (paredes, pilares, shafts)      ← KGF / ISO 5.1.6
└── Área líquida (NFA)                        ← ISO 5.1.5
    ├── Ambientes (por tipo)
    ├── Circulação                            ← ISO 5.1.9 / DIN VF
    └── Áreas de serviço/técnica              ← ISO 5.1.8 / DIN TF
```

Regra de ouro: **só o nó raiz é "total". Todo nó intermediário é "subtotal". Nenhum número aparece em dois ramos.**

### 4.2 Tabela de ambientes (a que o Hestia deve gerar)

| Nível | Nº | Ambiente | Tipo | Área líquida (m²) | % do nível | Pé-direito livre (m) | Situação NBR 15575 |
|---|---|---|---|---|---|---|---|
| Térreo | 01 | Sala de estar | Estar | 22,45 | 18,2% | 2,70 | ✔ |
| Térreo | 02 | Cozinha | Cozinha | 11,30 | 9,2% | 2,70 | ✔ |
| Térreo | 03 | Circulação | Circulação | 6,80 | 5,5% | 2,70 | ✔ |
| … | | | | | | | |
| **Subtotal Térreo** | | **14 ambientes** | | **123,40** | **100%** | | |
| Pav. tipo | 101 | Dormitório 1 | Dormir | 12,10 | | 2,62 | ✔ |
| **Subtotal Pav. tipo** | | | | | | | |
| **TOTAL** | | | | | | | |

Boas práticas:
1. **Agrupar por nível** e por **tipo** (dois agrupamentos, não um).
2. **Subtotal por nível** e **total geral** — nunca só o total.
3. **Contagem de ambientes** por linha de subtotal (é indicador de programa: "3 dormitórios").
4. **% do nível** (não % do total) — é o número que o arquiteto usa.
5. **Coluna de conformidade** (pé-direito, área mínima) — é o diferencial de um app vs uma planilha.
6. **Coluna "critério"** no cabeçalho, não no rodapé: "Áreas líquidas medidas na face de acabamento, pilares descontados (IPMS 4.2)".
7. **Duas casas decimais** na exibição (ISO 5.1.1.2), mas **somar sem arredondar** e arredondar só na apresentação — senão 14 ambientes acumulam ~0,1 m² de erro.
8. **Ordenação estável** (por número) e **IDs** visíveis para conferência com a planta.
9. Exportar **CSV/XLSX** com as mesmas colunas + `GlobalId` (para casar com o IFC).

### 4.3 Área útil × área bruta: como não mentir

| Métrica | O que é | Como calcular no Hestia |
|---|---|---|
| **Área útil / líquida** | piso utilizável, sem paredes/pilares | soma dos polígonos com furos (= hoje) |
| **Área privativa (NBR 12721)** | até face externa / eixo das divisas | exige faces estruturais das paredes + espessura + regra de eixo |
| **Área bruta do pavimento (GFA)** | envoltória externa, inclui estrutura | contorno externo do pavimento (não a soma dos ambientes) |
| **Área construída** | termo municipal; geralmente GFA de todos os pavimentos + regras de isenção | precisa de regra por município → campo configurável |
| **Área de parede** | superfície vertical | `GrossWallArea`/`NetWallArea` por ambiente — **não** é área de piso |
| **Área de circulação** | circulação **entre** ambientes | ambientes do tipo "circulação"; **não** inferir do "resto" |

**Nunca derivar circulação por subtração.** ISO 9836 5.1.9 e DIN 277 VF excluem explicitamente o movimento **dentro** do cômodo; logo "área livre = total − ambientes" **não** é circulação: é parede + pilar + erro. A circulação tem que ser **um ambiente** (corredor/hall), como no ArchiCAD e no Revit. `[DOC]` `[S12]` `[S19]`

### 4.4 As sete formas de dupla contagem (e a defesa)

| # | Armadilha | Defesa |
|---|---|---|
| 1 | Somar `NetFloorArea` dos ambientes e comparar com a GFA | Ter a GFA como **raiz**; a diferença é "estrutura" e deve ser **explicada**, não escondida |
| 2 | Emitir `GrossFloorArea` = `NetFloorArea` | Calcular a bruta de verdade (sem furos, face estrutural) **ou** não emitir |
| 3 | Somar ambientes + soma de zonas/apartamentos | Zonas são **agregados**: nunca entram no total; só no rateio |
| 4 | Varanda/terraço contado no ambiente **e** na área externa | Classe única por ambiente (`enclosureType`), com regra de peso declarada |
| 5 | Mezanino/duplo pé-direito contado duas vezes | Área no **pavimento de piso**; o vazio é vazio (o IFC exclui aberturas de laje) |
| 6 | Área de parede somada à área de piso | Métricas separadas, unidades idênticas mas **grandezas diferentes**; rótulo explícito |
| 7 | Rateio de área comum somado ao total | Área comum entra **uma vez** no total; a cota por unidade é **coluna derivada**, não linha somável |

`[DOC]` `[S12]` `[S14]` `[S20]`

### 4.5 Reconciliação (o teste que separa produto de planilha)

O app deve ter um **"fechamento"** visível:

```
GFA do pavimento ............ 145,80 m²
(−) estrutura (paredes+pilares)  22,40 m²
(=) área líquida ............. 123,40 m²
    ├ ambientes .............. 110,10 m²  (89,2%)
    ├ circulação ..............  8,60 m²  ( 7,0%)
    └ serviço/técnica .........  4,70 m²  ( 3,8%)
    Σ ......................... 123,40 m²  ✔ fecha
```

Se não fechar, mostrar a **diferença** e o **polígono órfão** (área do pavimento não coberta por nenhum ambiente). Isso é o equivalente de "área não atribuída" da IPMS/BOMA e é o melhor detector de bug de geometria que existe.

---

## 5. Como ferramentas web/open source tratam espaços

### 5.1 web-ifc / That Open

- Biblioteca **JavaScript/WASM** para **ler e escrever** IFC "at native speeds"; faz parte do projeto That Open Company. API: `IfcAPI.Init()`, `OpenModel(data)`, `CloseModel(modelID)`; o modelo é acessado por `modelID`. `[DOC]` `[S29]`
- Distribuição: `web-ifc.wasm`, `web-ifc-mt.wasm` (multithread), `web-ifc-node.wasm`, `web-ifc-api.js`, tipagens `ifc-schema.d.ts`, helpers de propriedades. `[DOC]` `[S29]`
- **Não há semântica de espaço**: é parser/escritor. Área, perimeter, hierarquia e "qual parede delimita o quê" são responsabilidade da aplicação.
- Padrão de UX que vale copiar: **streaming + fragments** (geometria separada das propriedades) — permite abrir planta sem carregar 3D e consultar `Qto` sem tessellar. Ler propriedades sem geometria é prática normal no ecossistema Speckle também. `[DOC]` `[S30]`

**Para o Hestia:** se o import/export for no browser, `web-ifc` é o caminho; o `GlobalId` deve sobreviver a round-trip (é o que permite o usuário importar, mover uma parede, exportar e o outro software reconhecer o mesmo espaço).

### 5.2 Bonsai (ex-BlenderBIM) — o modelo "derivado" mais próximo do Hestia

Do código-fonte (`bonsai/bim/module/model/space.py`, `core/spatial.py`, `tool/spatial.py`) `[DOC]` `[S26]` `[S27]` `[S28]`:

| Operador | Comportamento |
|---|---|
| `bim.generate_space` — **"Generate Space from Cursor"** | Cria o espaço a partir da **posição do cursor**, numa **plano de corte (RL)** configurável no Spatial Tool; o polígono é o resultado de um **flood/ponto-em-polígono** sobre os objetos visíveis do contexto. Reaproveita o `IfcSpace` ativo se houver. |
| — comentário no código | *"This works as a 2.5 extruded polygon based on a cutting plane. Note that **rooms exclude walls** (i.e. not to wall midpoint or exterior/exterior edge)."* → **mede na face interna**, como o Hestia. |
| `bim.generate_spaces_from_walls` — **"Generate Spaces From Walls"** | Gera **todos** os espaços de uma vez a partir das paredes selecionadas. Limitação declarada: *"only works based on a 2D plan only considering the standard walls (i.e. prismatic) in the active object storey"*. |
| Buffer | `get_buffered_poly_from_linear_ring` usa tolerância **0,03 m** (`tolerance_si=0.03`) — evita que o espaço "cole" na parede e dá folga de desenho. |
| Furos | `get_union_shape_from_selected_objects` **purga furos internos** com área < **0,1 m²** (`min_area=0.1`) — evita fragmentos de pilar semirretos. |
| Altura | `props.force_space_height` (altura fixa) ou `get_auto_space_height(...)` (ray-cast para achar laje/forro). |
| Altura em massa | `bim.apply_space_height_to_selection` — **"Apply Space Height To Selection"**: aplica altura a todos os espaços selecionados **sem regenerar o footprint**. |
| Visibilidade | `toggle_space_visibility` (wired ↔ textured) e `toggle_hide_spaces` (todos). |
| Erros | `SpaceGenerationError` com mensagens: *"Couldn't find any polygons to form the space shape. Perhaps, RL value need to be adjusted."* e *"Couldn't find any polygons containing the position (x, y)."* |
| Atalho | Spatial Tool: **Shift + Spacebar**, **Shift + 8**. `[DOC]` `[S34]` |

**O que copiar:** (a) o par **"criar do cursor" × "gerar de todas as paredes"**; (b) o **plano de corte explícito**; (c) o **buffer configurável**; (d) a **purga de furos pequenos**; (e) **altura em massa sem regenerar contorno**; (f) erro que **diz o que fazer** ("ajuste a cota de corte").

### 5.3 FreeCAD (Arch/BIM `Space`)

Documentação oficial `[DOC]` `[S25]`:

- Espaço definido por **um sólido base** **e/ou** por **fronteiras** (faces de paredes); com fronteiras, o volume é calculado a partir da *bounding box* subtraindo os espaços atrás de cada fronteira.
- `Area` = área calculada na **interseção com um plano horizontal na cota do centro de massa** — não é "área do footprint" simples.
- Propriedades: `Base`, `Boundaries`, `Area`, `FinishFloor`, `FinishWalls`, `FinishCeiling`, `Group` (objetos dentro), `SpaceType`, `FloorThickness`, `NumberOfPeople`, `LightingPower`, `EquipmentPower`, `AutoPower`, `Conditioning`, **`Internal`** (interno/externo), além de **texto**: `Text` com placeholders **`$area`, `$label`, `$tag`, `$floor`, `$walls`, `$ceiling`**; `FontName`, `TextColor`, `FontSize`, `FirstLine`, `LineSpacing`, **`TextPosition`**, **`TextAlign`**, **`Decimals`**, `ShowUnit`.
- Modo de exibição **`Footprint`** (só a face inferior).
- Zonas: usar `Arch BuildingPart` com IFC type **"Spatial Zone"**.
- Limitação declarada: *"The boundaries properties is currently not editable via GUI."* — ou seja, o contorno por fronteiras **não** é editável por alças na UI.

**O que copiar:** (a) a **etiqueta como template com variáveis** (`$label`, `$area`, `$decimals`) em vez de string formatada no código; (b) **`TextPosition`/`TextAlign` como atributos do espaço** (etiqueta arrastável sem mover o ambiente); (c) **`Internal` como booleano**; (d) modo de exibição **Footprint**; (e) os **três campos de acabamento** (piso/parede/teto) que o Hestia já tem e não usa.

**O que **não** copiar:** fronteiras não editáveis na GUI. O Hestia pode fazer melhor (alças).

### 5.4 Speckle

- Modelo genérico de **objetos com propriedades + geometria de exibição**, com relações e agrupamento; a semântica (inclusive "isto é um ambiente") vem do **app de origem** (Revit/ArchiCAD), não do padrão. Não existe entidade "ambiente" first-class. `[DOC]` `[S30]` + `[SEC]`
- Separação rígida entre **o que se desenha** e **o que se mede**: o carregador recebe geometria em papéis distintos (`DISPLAY`, `SOLID`, `CENTERLINE`) e a documentação é taxativa — *"**Never draw `CENTERLINE` as a body**"*. `[DOC]` `[S30]`
- Consequência de projeto: **eixo de parede ≠ corpo de parede ≠ face de acabamento**. Três geometrias, três usos. É exactamente a distinção que a NBR 12721 (eixo/face externa) e a IPMS (IDF/superfície acabada) exigem.

**O que copiar:** (a) a noção de **camadas de representação** com papéis explícitos (contorno medido / contorno desenhado / eixo / área); (b) versionamento imutável (cada export é uma versão, com diff de áreas); (c) "propriedades sem geometria" para a tabela de áreas.

### 5.5 Síntese: padrões que valem copiar

| Padrão | Onde existe | Por que copiar |
|---|---|---|
| Espaço **derivado** de um ponto, não desenhado | Revit, ArchiCAD, Bonsai, Hestia | Menos trabalho, sempre coerente com as paredes |
| **Snapshot do polígono medido** persistido | ArchiCAD (`API_Polygon poly` **e** `refPoly`) | Permite diff, auditoria e "por que a área mudou?" |
| **Plano de corte (RL)** explícito | Bonsai | Resolve pé-direito duplo, meia-parede, sótão |
| **Buffer** pequeno + **purga de furos < limiar** | Bonsai (0,03 m / 0,1 m²) | Estabilidade geométrica e áreas "redondas" |
| **Etiqueta = template com variáveis + posição própria** | FreeCAD | Flexibilidade sem código; arrastar sem mover o objeto |
| **Modo Footprint / wired / textured** | FreeCAD, Bonsai | Performance e leitura de planta |
| **Geração em massa das paredes** | Bonsai | Onboarding de planta inteira em um clique |
| **Altura em massa sem regenerar contorno** | Bonsai | Mudança de pé-direito é operação frequente |
| **Erro que ensina** ("ajuste a cota de corte") | Bonsai | Reduz suporte |
| **Semântica separada da geometria** | Speckle | Tabela de áreas sem carregar 3D |

---

## 6. Acessibilidade e UX

### 6.1 Atalhos

- **Uma letra + modificador para ferramentas de criação**, sem sequestro de teclas do navegador. O FreeCAD usa **`S` `P`** (sequência) para Space; o Bonsai usa **`Shift+Spacebar`** / **`Shift+8`**. `[DOC]` `[S25]` `[S34]`
- **`Esc`** cancela o comando em andamento (nunca fecha o app / nunca descarta o ambiente sem aviso). **`Enter`** confirma. **`Tab`** percorre campos. **`Del`** apaga o objeto selecionado — e **não** deve apagar a etiqueta sozinha.
- **Teclas de precisão**: `Shift` = ortogonal/45°, `Alt` = desabilita snap, digitar número durante o traçado = comprimento exato (convenção CAD consolidada).
- **Toda ação de mouse tem equivalente de teclado** (WCAG 2.1.1 — Keyboard). `[DOC]` `[S32]`
- Deve existir uma **folha de atalhos** acessível por `?`.

### 6.2 Feedback de "circuito aberto"

Precedente de mercado `[DOC]` `[S31]` `[S27]`:
- Revit: *"Room is not in a properly enclosed region"* (e `RoomNotEnclosed` na API de falhas). É um **aviso modal** — a maior reclamação dos usuários.
- Bonsai: erro textual *"Couldn't find any polygons containing the position (x, y). Perhaps, RL value need to be adjusted."*

**O que o Hestia deve fazer (melhor que ambos):**
1. **Não bloquear**: criar o ambiente assim mesmo, marcado como **"contorno aberto"** (estado explícito), com área = 0 ou a área do polígono provisório claramente sinalizada. Bloquear criação é o que gera raiva.
2. **Apontar o vão**: destacar em vermelho **o trecho exato** onde o circuito não fecha (as duas pontas mais próximas, com a distância), com zoom opcional para o ponto.
3. **Oferecer a correção em um clique**: (a) "fechar com linha de separação" (vira `IfcVirtualElement`); (b) "estender a parede mais próxima"; (c) "ignorar vão < X mm" (tolerância global configurável — a linha de 1 mm do Hestia já é um caso disso).
4. **Estado persistente e visível**: ícone de alerta no ambiente + contagem no painel ("2 ambientes com contorno aberto") + inclusão na lista de verificação antes do export.
5. **Nunca** exportar IFC com espaço de área 0 sem avisar.

Detalhe técnico que evita 80% dos falsos "aberto": **vãos de porta/janela não podem abrir o circuito** (é a regra do ArchiCAD e do Revit). Um vão que atravessa a parede de ponta a ponta (abertura sem esquadria) **deve** abrir. O Hestia já fecha vãos — o caso de borda é a abertura **sem** esquadria. `[DOC-]` `B-pesquisa-archicad.md` §6

### 6.3 Criação em massa

| Padrão | Origem | Como fazer no Hestia |
|---|---|---|
| **"Gerar todos os ambientes do nível"** | Bonsai *Generate Spaces From Walls* | Varredura de todos os recintos fechados da planta, nomeando "Ambiente 1..n" |
| **Numeração automática sequencial** | ArchiCAD numera ao colocar | Sequência por nível (101, 102…) com contador por pavimento |
| **Renumerar** | ❌ ArchiCAD **não tem** renumerar (dor conhecida) | **Ter** comando "renumerar ambientes do nível" — diferencial barato |
| **Tipos com nome herdado** | Revit/ArchiCAD | "Dormitório 1/2/3" com sufixo automático por tipo |
| **Aplicar altura a vários** | Bonsai *Apply Space Height To Selection* | "Aplicar pé-direito a todos os ambientes do nível" |
| **Duplicar pavimento (tipo)** | Revit/ArchiCAD | Copiar ambientes de um nível para outro, com vínculo de tipo |

Regra: criação em massa **nunca** deve criar ambientes em cima de ambientes existentes (detecção de sobreposição) — é a origem clássica de dupla contagem (§4.4 #3).

### 6.4 Arrastar a etiqueta sem mover o ambiente

- A posição do texto é **atributo próprio** (`labelOffset` / `TextPosition`), separada do contorno. O FreeCAD faz exatamente isso. `[DOC]` `[S25]`
- **Nunca** amarrar a etiqueta ao centroide: em ambiente em L ela cai fora. Default = **maior círculo inscrito**; se o usuário arrastar, o offset é salvo **em relação ao polígono** (não em coordenadas absolutas) — assim, mover uma parede continua movendo a etiqueta de forma previsível.
- **Alça de etiqueta** (formato diferente da alça de contorno) e **cursor diferente** ao passar sobre ela. Sem isso, o usuário move o ambiente sem querer.
- `Alt`/`Ctrl` + arrastar = duplicar etiqueta? (Não: uma etiqueta por ambiente no Hestia; se houver múltiplas, tratar como anotação separada.)
- Colisão: se a etiqueta cabe, mostrar completa; se não cabe, truncar com `…` + tooltip, **nunca** diminuir a fonte abaixo do mínimo legível (2,5 mm de papel).
- Duplo clique na etiqueta = editar nome (não abrir painel lateral) — menor fricção.

### 6.5 Edição de contorno por alças

Três estados, visualmente distintos:

| Estado | Origem do contorno | Aparência | Alças |
|---|---|---|---|
| **Derivado** (default) | circuito de paredes | contorno fino + cadeado/ícone "derivado" | ❌ só leitura; clicar explica "este contorno vem das paredes" |
| **Derivado + override** | usuário arrastou uma alça | contorno tracejado + badge "personalizado" | ✅ alças nos vértices alterados |
| **Manual** | polígono desenhado | contorno sólido próprio | ✅ todas |

Regras:
1. **Alterar o contorno não pode ser acidente.** Arrastar uma parede deve atualizar o derivado; arrastar uma **alça** cria override explícito.
2. Sempre oferecer **"voltar ao derivado"** (descartar override).
3. Ao criar override, **avisar** que a área deixa de acompanhar as paredes (é a dor nº 1 do ArchiCAD: zona manual que "nunca atualiza"). `[DOC-]` `B-pesquisa-archicad.md` §14
4. Alças com **snap** a vértices de parede e a ortogonal; `Shift` para ângulo; digitar coordenada.
5. Mínimo 3 vértices, sem autointerseção — validar em tempo real com feedback (o polígono fica vermelho ao se cruzar).
6. **Furos** (pilares) devem poder ser **promovidos a "não furo"** (voltar a contar na área) — porque a política "pilar desconta" é uma escolha de método (§2.6), não uma verdade.

### 6.6 Undo

- **Uma operação = um passo de undo.** O Bonsai implementa isso por operador (`bl_options={"REGISTER","UNDO"}`), e tem documentação de arquitetura de undo para desenvolvedores. `[DOC]` `[S26]`
- **Erros a evitar:** (a) um passo por movimento do mouse (o usuário precisa apertar Ctrl+Z 200 vezes); (b) um passo por ambiente na criação em massa (criar 14 ambientes = 14 undos); (c) undo que desfaz o *pan/zoom* (não é edição).
- **Escopo**: undo de edição de geometria, texto, tipo, altura, contorno. Redo com `Ctrl+Shift+Z` / `Ctrl+Y`.
- **Histórico nomeado** ("Criou 14 ambientes", "Alterou pé-direito do nível") — o mesmo custo, muito mais confiança.

### 6.7 Acessibilidade (WCAG) e o canvas

Um editor de planta é um `<canvas>`: por padrão, **inacessível**. Requisitos mínimos `[DOC]` `[S32]`:

| Critério | Exigência prática |
|---|---|
| **2.1.1 Keyboard** | toda ação (criar, selecionar, editar, mover etiqueta) acessível por teclado |
| **2.4.3 / 2.4.7 Focus** | foco visível e ordem lógica no painel de propriedades e na lista de ambientes |
| **1.1.1 Non-text content** | **tabela de ambientes como alternativa textual** ao canvas (nome, nº, área, nível) |
| **1.4.1 Use of color** | nunca cor como único código (tipo de ambiente também por hachura/rótulo) |
| **1.4.3 Contrast** | contraste ≥ 4,5:1 para texto de etiqueta sobre o preenchimento translúcido — **testar sobre todas as cores de ambiente** |
| **1.4.4 Resize text / 1.4.10 Reflow** | zoom do navegador sem quebrar o layout do painel |
| **2.2.1 Timing** | nenhum timeout em diálogos de edição |
| **4.1.2 Name/Role/Value** | campos com `label`; erros anunciados (`aria-live`) — ex.: "circuito aberto no ambiente Cozinha" |

Além do WCAG:
- **Navegação por lista** (outline de níveis → ambientes) é acessibilidade *e* produtividade: permite trabalhar sem o mouse.
- **Tabela de áreas editável** resolve acessibilidade e o §4 ao mesmo tempo.
- **Contraste do preenchimento**: 15% de opacidade sobre branco dá ~#ECECEC — texto preto passa; texto cinza claro não. Definir cor de texto por luminância do fundo.

---

## 7. Tabela final: padrão/mercado × Hestia

### 7.1 Comparação

| # | Aspecto | Padrão / mercado | Hestia hoje | Ação |
|---|---|---|---|---|
| 1 | Modelo do ambiente | Derivado (Revit, Bonsai) ou derivado+polígono persistido (ArchiCAD) | Derivado de ponto + circuito | Manter; **persistir snapshot** do polígono medido (auditoria/diff) |
| 2 | Nome / número | `Name`=número, `LongName`=nome | Nome + número próprios | Mapear **invertido** no IFC |
| 3 | `PredefinedType` | `.SPACE.` / `.PARKING.` / `.GFA.` | não envia | Emitir `.SPACE.` (nunca `.ELEMENT.`) |
| 4 | `CompositionType` | `ELEMENT` (default) | — | OK se ausente; explicitar `.ELEMENT.` |
| 5 | Vínculo ao pavimento | `IfcRelAggregates` + placement relativo | ? | **Verificar** os dois; não usar `ContainedInSpatialStructure` |
| 6 | Unidade/apartamento | `IfcZone` (ou área do Revit) | não existe | Criar **`IfcZone`** por unidade |
| 7 | `Pset_SpaceCommon` | `IsExternal` obrigatório de fato | não envia | Adicionar `IsExternal` (+ `NetPlannedArea` se houver briefing) |
| 8 | `Pset_SpaceOccupancyRequirements` | usado p/ código de obras | não | Opcional: `MinimumHeadroom`, `OccupancyNumber` |
| 9 | `NetFloorArea` | face interna, sem pilares | ✅ (é o valor atual) | Manter e **declarar** o método |
| 10 | `GrossFloorArea` | inclui pilares/paredes, exclui revestimento | ❌ emitido com valor da líquida | **Calcular** ou **omitir** |
| 11 | Perímetro | `GrossPerimeter` / `NetPerimeter` | `Perimeter` (nome inválido) | Renomear para os dois nomes oficiais |
| 12 | Altura | `Height` (laje-laje) + `FinishFloorHeight` + `FinishCeilingHeight` | um "pé-direito" | Separar **estrutural × livre**; NBR 15575 usa o livre |
| 13 | Volume | `NetVolume` / `GrossVolume` | derivado | Emitir `NetVolume` |
| 14 | Área de parede | `GrossWallArea` / `NetWallArea` | não emite | Emitir (o Hestia **tem** acabamentos) |
| 15 | Fronteiras | `IfcRelSpaceBoundary` 1º nível | não emite | **Emitir** (barato: o circuito já sabe) |
| 16 | Linha de separação | `IfcVirtualElement` + boundary `VIRTUAL` | linha de 1 mm | Exportar como virtual (não como parede fina) |
| 17 | Método de medição | `MethodOfMeasurement` | não declara | `'BaseQuantities'` + método nacional/IPMS |
| 18 | Geometria | `FootPrint` (curva) + `Body` (extrusão) | extrusão | Garantir **FootPrint** fechado e sem auto-interseção |
| 19 | Classificação | `IfcClassificationReference` | não | Opcional (uso do solo/ABNT) |
| 20 | Tipos de ambiente | `IfcSpaceType` | ? | Usar para Psets compartilhados |
| 21 | Etiqueta | nome / nº / área, 3,5 mm | "Nome (nº) · área m²" | OK; **mm de papel** por escala no DXF |
| 22 | Posição da etiqueta | maior círculo inscrito, arrastável | ? | Offset próprio + alça distinta |
| 23 | Preenchimento | translúcido + legenda (padrão de fato) | translúcido | + **hachura** e modo P&B |
| 24 | Peso de linha | NBR 6492 0,13–2,00 mm | ? | Adotar 0,13/0,25/0,50/0,70 por camada |
| 25 | Escalas | 1:1 … 1:2000 | ? | Lista fechada da NBR 6492 |
| 26 | Quadro de áreas | por nível, subtotais, % | ? | Implementar (§4.2) |
| 27 | Circuito aberto | aviso + destaque | ? | **Apontar o vão** + fechar em 1 clique |
| 28 | Criação em massa | "gerar de paredes" | ? | Implementar + renumerar |
| 29 | Altura em massa | Bonsai | ? | Implementar |
| 30 | Undo | 1 passo por operação | ? | Verificar; histórico nomeado |
| 31 | Acessibilidade | WCAG 2.1.1/1.1.1/1.4.1 | ? | Tabela alternativa + teclado |
| 32 | Tolerâncias | buffer + purga de furos | 1 mm | Expor **buffer** e **área mínima de furo** |

### 7.2 Requisitos que um exportador IFC profissional precisa cumprir

**R-IFC-01** Exportar `IfcSpace` **agregado** ao `IfcBuildingStorey` (`IfcRelAggregates`), com placement **relativo** ao pavimento.
**R-IFC-02** `GlobalId` **estável** entre exportações do mesmo ambiente.
**R-IFC-03** `Name` = número; `LongName` = nome; `ObjectType` = categoria.
**R-IFC-04** `PredefinedType` com valor **da enumeração** (`SPACE`/`PARKING`/`GFA`); proibido `ELEMENT`/`PARTIAL`.
**R-IFC-05** `CompositionType = .ELEMENT.`.
**R-IFC-06** `Pset_SpaceCommon.IsExternal` em **todos** os espaços.
**R-IFC-07** `Qto_SpaceBaseQuantities` com nomes **exatos** (`NetFloorArea`, `NetPerimeter`, `Height`, …) — nunca `Perimeter`/`Area`.
**R-IFC-08** **Coerência** entre polígono exportado e quantidades (tolerância declarada, ex. 0,5%).
**R-IFC-09** Se emitir `GrossFloorArea`, calcular de fato (sem furos, face estrutural) — nunca copiar a líquida.
**R-IFC-10** `MethodOfMeasurement` preenchido; um `IfcElementQuantity` **por método**.
**R-IFC-11** `ElevationWithFlooring` coerente com `IfcBuildingStorey.Elevation`.
**R-IFC-12** `IfcRelSpaceBoundary` 1º nível `PHYSICAL`, com `InternalOrExternalBoundary` correto.
**R-IFC-13** Linhas de separação → `IfcVirtualElement` + boundary `VIRTUAL` (nunca parede de 1 mm).
**R-IFC-14** `FootPrint` como **curva fechada simples**, sem auto-interseção; furos como curvas internas.
**R-IFC-15** `IfcUnitAssignment` com unidades explícitas (m, m², m³).
**R-IFC-16** Nenhum espaço com área 0 exportado sem **aviso** (ou sem o estado "contorno aberto" propagado).
**R-IFC-17** `IfcZone` para unidades; `Pset_ZoneCommon` quando houver área declarada.
**R-IFC-18** Arquivo deve **passar em validador** (IfcOpenShell / Solibri / BIMcollab) sem erros de schema.
**R-IFC-19** Round-trip: importar o próprio export e recuperar os mesmos ambientes/áreas.
**R-IFC-20** Declarar a **versão do schema** e a MVD alvo (IFC4 RV / IFC4x3) no cabeçalho do produto.

### 7.3 Requisitos que uma planta profissional precisa cumprir

**R-PLT-01** Escala da lista NBR 6492 (1:1…1:2000), exibida na prancha e em escala gráfica.
**R-PLT-02** Plano de corte declarado (1,50 m recomendado) e informado quando diferente.
**R-PLT-03** Hierarquia de pesos: pilar > alvenaria > caixilho > mobiliário > cotas (série 0,13–2,00 mm).
**R-PLT-04** Nome de ambiente em **3,5 mm**; cotas e área em **2,5 mm**; fonte sem serifa, caixa alta.
**R-PLT-05** Etiqueta de ambiente com nome, número e área; posicionada no maior círculo inscrito; arrastável.
**R-PLT-06** Preenchimento de ambiente **≤ ~20% de opacidade**, sempre abaixo de mobiliário/cotas.
**R-PLT-07** Legenda de cores/hachuras com tipo, quantidade e área por tipo.
**R-PLT-08** Cotas em cadeia (parcial/total), com cotas de nível N.A./N.O. quando houver desnível.
**R-PLT-09** Norte e planta-chave.
**R-PLT-10** Carimbo no canto inferior direito com os 10 campos da NBR 6492 4.5.1.
**R-PLT-11** Quadro de áreas na prancha **ou** no memorial, com critério de medição no cabeçalho.
**R-PLT-12** Funcionar em **P&B** (nenhuma informação perdida sem cor).
**R-PLT-13** Não imprimir etiqueta sobreposta; colisão resolvida por truncamento + tooltip.
**R-PLT-14** Unidades e casas decimais consistentes (2 casas; m²).
**R-PLT-15** DXF com **camadas nomeadas**, lineweights reais, textos como `TEXT`/`MTEXT` (não vetores) e blocos para etiquetas.

---

## 8. Referências

| ID | Fonte | Uso |
|---|---|---|
| **S1** | buildingSMART, *IFC 4.3.0.0 — IfcSpace* (espelho `bim-times.com/ifc/IFC4_3/buildingsmart/IfcSpace.htm`) | entidade, atributos, alturas, Name/LongName, boundaries, Psets |
| **S2** | buildingSMART, *IFC4 (ADD2) — IfcSpace* (espelho `bim-times.com/ifc/ifc4/schema/ifcproductextension/lexical/ifcspace.htm`) | atributos na versão IFC4 |
| **S3** | *IFC 4.3 — IfcSpaceTypeEnum* | valores de `PredefinedType` (4.3) |
| **S4** | *IFC4 — IfcSpaceTypeEnum* | valores de `PredefinedType` (IFC4) |
| **S5** | *IFC 4.3 — Pset_SpaceCommon* | campos e significados |
| **S6** | *IFC 4.3 — Qto_SpaceBaseQuantities* | definições literais de cada quantidade |
| **S7** | *IFC 4.3 — Pset_SpaceOccupancyRequirements* | campos de ocupação |
| **S8** | *IFC 4.3 — IfcZone* | zona como agrupamento; exemplo "apartment" |
| **S9** | *IFC 4.3 — IfcSpatialZone* | zona com forma própria |
| **S10** | *IFC 4.3 — IfcRelSpaceBoundary* | 1º/2º nível, physical/virtual, geometria de conexão |
| **S11** | *IFC 4.3 — IfcElementQuantity* | `MethodOfMeasurement`, exemplo DIN277-2/Wohnfläche, base quantities |
| **S12** | **ISO 9836:2017** — *Performance standards in building — Definition and calculation of area and space indicators* (preview iTeh, PDF) | 5.1.1–5.1.9, árvore de áreas, 2 casas decimais |
| **S13** | **ISO 9836:2011** (preview iTeh) | confirmação cruzada das cláusulas |
| **S14** | **IPMS: All Buildings** (IPMSC, 15/01/2023, PDF integral) | IPMS 1/2/3.1/3.2/4.1/4.2, IDF, Component Areas, relatório B.3 |
| **S15** | RICS — página *International Property Measurement Standards* | publicação/distribuição do IPMS |
| **S16** | BOMA — *BOMA Standards* / ANSI Webstore **ANSI/BOMA Z65.1-2024** | edição vigente |
| **S17** | Building Data Labs — *Glossary of Concepts for Real Estate Measurement* | termos BOMA (R/U, MJP, dominant portion, color schematics) `[SEC]` |
| **S18** | Tango Analytics — *What's the Difference Between Net Area and Net Floor Area?* | EN 15221-6 × BOMA; ambiguidade de "net area" `[SEC]` |
| **S19** | Wikipedia (de) — *DIN 277* (com base em DIN 277:2021-08) | BGF/NRF/NUF/TF/VF/KGF, R/S, BRI/NRI/KRI `[DOC-]` |
| **S20** | IDP — *A propriedade imobiliária no condomínio edilício: uma análise da ABNT NBR 12721* (cita 5.3, 5.4, 5.7 e Quadros I/II literalmente) | área real privativa, comum, equivalente, fração ideal |
| **S21** | **ABNT NBR 15575-1:2013** (PDF integral) | 3.33 pé-direito; 16.1.1 (2,50/2,30/80%); 16.2–16.4 |
| **S22** | **ABNT NBR 6492:2021** (PDF integral) | 3.x termos, 4.1.2 (corte 1,50 m), 4.5 (carimbo), A.1.3 (Tabela A.2), A.2 (Tabela A.3), A.3.1 escalas, A.9.2 quadro de áreas, A.10 materiais |
| **S23** | Marcelo Sbarra — *Peso gráfico — Representação de projetos de arquitetura (NBR 6492)* | hierarquia prática de pesos; ASBEA/CAD `[SEC]` |
| **S24** | ISO — *ISO 7519* (ed. vigente 2024/2025; 1991 retirada) | princípios de apresentação para desenhos de disposição geral/montagem |
| **S25** | FreeCAD Wiki — *Arch Space* (raw doc) | propriedades, `Area`, `Text/$area`, `TextPosition`, `TextAlign`, `Footprint`, `Internal` |
| **S26** | Bonsai 0.9 — `src/bonsai/bonsai/bim/module/model/space.py` | `generate_space`, `generate_spaces_from_walls`, `apply_space_height_to_selection`, mensagens |
| **S27** | Bonsai 0.9 — `core/spatial.py` | flood por ponto, `SpaceGenerationError`, mensagens |
| **S28** | Bonsai 0.9 — `tool/spatial.py` | buffer `0.03 m`, purga de furos `0.1 m²`, `get_space_reference_point` |
| **S29** | That Open — *web-ifc* README | leitura/escrita IFC em WASM, API, artefatos |
| **S30** | Speckle Docs — *Load a bundle in your own code* | separação propriedades × geometria; papéis `DISPLAY`/`SOLID`/`CENTERLINE` |
| **S31** | Autodesk Support — *"Room is not in a properly enclosed region"*; Revit API `RoomNotEnclosed` | precedente de validação de circuito |
| **S32** | W3C — *WCAG 2.2* (2.1.1, 1.1.1, 1.4.1, 1.4.3, 2.4.7, 4.1.2) | acessibilidade do editor |
| **S33** | `A-pesquisa-revit.md` / `B-pesquisa-archicad.md` (docs internos) | estado da arte por software; confirmação de NetFloorArea × GrossFloorArea |
| **S34** | Bonsai Docs — *Spatial Tool* | atalhos `Shift+Spacebar`, `Shift+8` |

### Itens abertos (verificar antes de virar requisito)

- `IfcRelSpaceBoundary` 2º nível: qual MVD/versão exigir e se o consumidor-alvo (prefeitura, engenharia) realmente usa. `[?]`
- Conteúdo exato do `Qto_SpaceBaseQuantities` que o Revit/ArchiCAD preenchem na prática (já levantado em `A`/`B`; falta medir num arquivo real gerado pelo alvo). `[?]`
- Coeficiente de área equivalente da NBR 12721 para **varanda/terraço** em residência (o texto de 5.7 lido trata do conceito, não da tabela de coeficientes por tipo). `[?]`
- Se a prefeitura-alvo exige `GFA` como `IfcSpace` explícito ou aceita área calculada. `[?]`
- Cláusulas exatas da ANSI/BOMA Z65.1-2024 para limites de parede em ambiente residencial (a norma é paga e voltada a escritórios). `[?]`
