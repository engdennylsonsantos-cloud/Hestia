# B · Pesquisa · Como o ArchiCAD realmente funciona: **Zonas** (Zones)

Pesquisa feita em **29/10/2026**. Alvo: a ferramenta **Zone** do ArchiCAD (equivalente a ambientes/áreas do Hestia).
Base principal: **Archicad 30 Help** (documentação oficial 2026), complementada por Archicad 25/27/28 (mesma matéria, textos antigos), **GDL Center** (parâmetros que o carimbo lê da zona) e **C++ API 30** (o que está de fato gravado no arquivo). Fóruns só como fonte secundária.

Legenda de confiança usada no texto e na tabela final:

| Marca | Significado |
|---|---|
| `[DOC]` | Página oficial da Graphisoft lida na íntegra nesta sessão (help.graphisoft.com, gdl.graphisoft.com, graphisoft.github.io). |
| `[DOC-]` | Página oficial lida, mas de versão anterior (AC20/AC25/AC27/AC28) — comportamento não reconfirmado na versão atual. |
| `[SEC]` | Fórum, blog técnico ou KB da comunidade; vários relatos concordando, sem confirmação na doc oficial. |
| `[?]` | Não confirmado. Explicitamente marcado. |

> **Nota de método.** As páginas de ajuda da Graphisoft mudaram de estrutura de URL no AC30 (`/AC/30/INT/Topics/...`, HTML). As versões antigas usam `/AC/25/INT/_AC25_Help/...`, `.htm`. Quando o texto do AC30 é idêntico ao do AC25 eu cito o AC30 (mais atual) e registro a versão antiga como confirmação cruzada.

---

## 0. Resumo executivo (o que importa para o Hestia)

1. **Zona no ArchiCAD é um elemento com polígono próprio gravado**, não um "ponto + derivação". A `API_ZoneType` tem `API_Polygon poly` ("Polygon of the zone") **e** `API_Polygon refPoly` ("The found polygon of the zone") — os dois são persistidos. `[DOC]`
2. O polígono nasce de uma **varredura (flood) a partir de um ponto de referência** (`refPos`) clicado pelo usuário, e só é recalculado quando o usuário roda **Design → Update Zones**. Não há atualização automática. `[DOC]`
3. Existem **três modos** de construção: `Inner Edge`, `Reference Line` e `Manual` (polilinha / retângulo / retângulo girado). O modo fica gravado por zona (`manual`, `refLineFlag`, e o `ROOM_POLY_STATUS` = 0/1/2). `[DOC]`
4. **Não existe modo "core"/eixo de parede.** O mais próximo é `Reference Line`, que mede até a **linha de referência** da parede (que pode estar no eixo, na face externa ou interna, conforme o composto). `[DOC]`
5. **Parede inclinada ou de perfil complexo quebra a regra**: mesmo no modo `Reference Line`, o ArchiCAD usa a **borda interna**. `[DOC-]` (frase explícita na ajuda do AC20; o AC30 não repete a frase — a manutenção do comportamento é `[?]`, presumida, ver §1.4).
6. **Vãos de porta/janela não abrem o circuito** (a zona "fecha" por cima do vão). Vão que não é porta/janela (buraco na parede, "Empty Opening" de altura parcial) **faz a varredura vazar** para o ambiente vizinho. `[DOC]`
7. **Quatro áreas diferentes** por zona: `Measured Area` (bruta, até a linha de referência), `Measured Net Area` (até a face interna **e** já descontando elementos internos marcados como "Zone Boundary"), `Reduced Area` (desconta "Reduce Zone Area Only", fills, forros baixos) e `Calculated Area` (`Reduced Area` × fator do campo **Reduce by**). `[DOC]`
8. **"Nominal area" não existe no ArchiCAD.** Não há esse termo em nenhuma página oficial, em nenhum painel, em nenhum parâmetro GDL. As quatro áreas acima são o universo. `[DOC]`
9. **O que separa "polígono" de "área medida"**: no modo `Reference Line` a área é sempre medida até a linha de referência (bruta); o que o rádio `Gross/Net` muda é **só o desenho do polígono** — a área **não muda**. Além disso, com parede inclinada a planta mostra **dois polígonos** (um editável = projeção visível; outro não-editável = base real do sólido 3D). `[DOC]`
10. **Categoria de zona** (`Options → Element Attributes → Zone Categories`) é atributo de projeto e define **cor + carimbo (library part) + parâmetros salvos do carimbo**. `[DOC]`
11. **O carimbo (Zone Stamp) é um objeto GDL paramétrico**, sub-elemento da zona, **desligado por padrão desde o AC25**. Quem aparece hoje é o **Zone Label** — um **elemento Label separado**, associativo, que pode ser múltiplo por zona e existir em planta, corte, elevação e 3D. `[DOC]`
12. **Não existe renumeração automática de zonas.** O número é texto livre; ele **incrementa ao colocar** zonas em sequência, mas não há comando de renumerar, e o `Element ID Manager` **não** mexe no número da zona. `[SEC]`
13. **Norma nacional não é nativa.** DIN 277 / WoFlV vêm do add-on alemão **`Flächenberechnung`** (Áreas e Volumes), que usa **zonas + Morphs** e gera listas próprias no Navigator. `[DOC]` (help alemão)
14. **IFC**: zona → `IfcSpace`; há opção de exportar **Zone Categories como IFC Space Classification Reference**, **IFC Base Quantities** (`Qto_SpaceBaseQuantities`) e **IFC Space Boundaries** (`IfcRelSpaceBoundary`). No AC30 passou a existir mapeamento para **`IfcSpatialZone`**. `[DOC]`
15. **As dores conhecidas são as mesmas há 20 anos**: zona que não atualiza, zona manual que nunca atualiza, "não está fechada", zonas sobrepostas contando duas vezes, lentidão ao mover paredes com muitas zonas visíveis. `[DOC]`+`[SEC]`

---

## 1. A ferramenta Zone

### 1.1 Onde fica

- **Toolbox → grupo "Design" → ícone Zone** (o mesmo grupo de Wall, Column, Slab, Roof). Ajuda oficial: *"Activate the Zone tool."* `[S1]`
- **Info Box** da ferramenta concentra o que importa: os **ícones de método de construção** (Manual / Inner Edge / Reference Line), o toggle **Place Label**, categoria, nome, número, story, altura. `[S1]` `[S3]`
- **Menu Design** (não "Document"): `Design → Update Zones` e `Design → Roof Extras → Crop Zone` (e `Undo All Crops`). `[S13]` `[S9]`
- Diálogos de atributo: `Options → Element Attributes → Zone Categories`. Preferências globais: `Options → Project Preferences → Zones`. `[S4]` `[S12]`

### 1.2 Os dois modos automáticos

Texto oficial (AC30, idêntico ao AC25): `[S1]`

> "Most Zones are surrounded by Walls and the only openings in them are Doors and Windows. In this situation, the easiest way to create a Zone is using one of the automatic methods: **Inner Edge** or **Reference Line**."
> 1. Activate the Zone tool. 2. In the Info Box, choose the Inner Edge or Reference Line method. 3. In the Floor Plan or 3D window, **click within a closed polygon that consists of Walls and/or Curtain Walls**. 4. Click with the Hammer cursor to place the Zone Label (either inside or outside the Zone polygon).
>
> - **Inner Edge method**: Zone area extends to inner edges of Walls.
> - **Reference Line method**: Zone area extends to Wall reference lines.

Exigências práticas do modo automático:

| Requisito | Detalhe | Fonte |
|---|---|---|
| Circuito fechado | Só `Walls` e/ou `Curtain Walls`. **Colunas não servem como fechamento** ("Columns cannot serve as the enclosing boundary of a zone"). | `[DOC-]` `[S2]` |
| Clique dentro | O clique define o **ponto de referência** (`refPos`), marcado com um **"+" azul** na planta; é dele que a próxima atualização parte. | `[DOC]` `[S7]` |
| Segundo clique | Coloca o carimbo/rótulo ("Hammer cursor"), que pode ficar **fora** do polígono. | `[DOC]` `[S1]` |
| Paredes "Zone Boundary" | Por padrão `Relation to Zones = Zone Boundary` em toda parede; se uma parede estiver como `No Effect on Zones`, a varredura **passa através dela**. | `[DOC]` `[S1]` `[S11]` |
| Teto/altura | A varredura é 2D (planta), mas o resultado vira sólido 3D; `Crop Zone` recorta contra laje/telhado/viga. | `[DOC]` `[S9]` |

### 1.3 O modo manual

> "Use a manual method if the Zone's boundary is not clearly surrounded by elements (e.g. when doing space planning). 1. Activate the Zone tool. 2. In the Info Box, choose a Manual method: **Polyline, Rectangular, or Rotated Rectangular**. 3. Draw the Zone contour. 4. Click with the Hammer cursor to place the Zone Label." `[S1]`

Consequência dura: **zona manual nunca mais atualiza**. O diálogo `Update Zones` mostra um ícone específico ("The Zone was created manually and cannot be automatically updated"). `[DOC]` `[S13]`

### 1.4 Como o ArchiCAD detecta o contorno: Inner Edge × Reference Line

- `Inner Edge` → conta até a **face interna** da parede. É o que o Hestia faz hoje.
- `Reference Line` → conta até a **linha de referência** da parede. Depende de onde essa linha está no composto/perfil: eixo, face externa ou face interna, com deslocamento. Isso significa que "Reference Line" **não é sinônimo de eixo** — é "linha de referência", que o usuário posiciona.
- O AC20 é explícito sobre o caso torto:

> "Note: **In case of a slanted or complex wall, the Reference Line method will not consider the wall's reference line, but rather its inner edge.**" `[DOC-]` `[S2]`

  Ressalva de honestidade: essa frase **não aparece** na página equivalente do AC30 (que só diz, em `Relation to Zones`, que *"If the Wall/Curtain Wall is slanted, the Zone's geometry is slanted accordingly"*). Ou seja: o comportamento é oficial para o AC20 e **`[?]`** para o AC30. Todo o resto do mecanismo (dois polígonos, geometria 3D inclinada) está confirmado no AC30 `[DOC]` `[S5]`.

- E sobre a ordem de desenho: *"even if you constructed Walls with the reference line placed on the external edge, the Zone fill does not overlap the wall symbol until you choose Bring to Front from the Edit > Display Order."* `[DOC-]` `[S2]` — ou seja, no modo Reference Line o preenchimento **passa por baixo** do símbolo da parede.

**Parede inclinada** (o caso que o Hestia ainda não tem): a zona considera a geometria inclinada de verdade e a planta mostra **dois polígonos**: `[DOC]` `[S5]`

> "Zones bounded by one or more slanted walls will accurately consider the slanted geometry. Such Zones are displayed on the Floor Plan with two separate Zone polygons:
> - The polygon with **editable selection dots** delimits the visible part of the Zone on the Floor Plan (while you can edit this polygon, such editing has no effect on the true 3D Zone), and
> - The polygon with **regular selection dots** indicates the true extent of the base of the 3D Zone (you cannot edit the Zone shape by editing this polygon)."

**Parede complexa** (perfil complexo, com reentrâncias): cai na mesma regra — a detecção usa a borda interna, e a zona resultante é o sólido 3D aparado pela geometria real. `[DOC-]` `[S2]` (a frase cobre "slanted **or complex** wall"). `[?]` para detalhes finos de perfil complexo com nichos (não há página dedicada).

### 1.5 Fechar um circuito que "vaza"

O ArchiCAD **continua procurando** além do ambiente quando encontra uma abertura que não é porta/janela. Soluções oficiais, na ordem em que a doc apresenta: `[S1]`

1. Usar o método **Manual**;
2. Colocar um **Empty Opening** (porta vazia) na parede **com a mesma altura da parede** — em planta ela não aparece, mas serve de limite;
3. Desenhar **Line / Arc / Spline** e marcar **`Zone Boundary`** nas configurações do elemento. *"Any line-type element can also be set as 'Zone Boundary' in its Settings dialog box. Such a line acts as a 2D delimiter of the Zone."* `[DOC]` `[S11]`

E, se o contorno abranger formas/paredes soltas: *"you may get a warning message when clicking to place the Zone Stamp… you must click closer to the bounding elements."* `[DOC]` `[S1]`

> **Comparação direta com o Hestia:** o Hestia já acerta em tratar vão de porta/janela como parede (é exatamente o que o ArchiCAD faz por padrão). O que o Hestia não tem é (a) a **linha de separação** (`Zone Boundary` de line-type) e (b) a noção de **"parede que não delimita"** (`No Effect on Zones`).

---

## 2. Zone Settings — todos os painéis e parâmetros

Fonte principal: `Zone Tool Settings` do AC30 `[S3]` (idêntico ao AC25/AC28, exceto o texto de `Measured Area`, que ficou mais preciso no AC30).

### 2.1 Painel **Name and Positioning** (Nome e Posicionamento)

| Campo (nome exato na UI) | O que faz | Observações |
|---|---|---|
| **Zone Category** | Categoria da zona, definida em `Options → Element Attributes → Zone Categories`. | *"Their definition includes the Category name, code, color and zone stamp, and a set of parameters."* `[S3]` |
| **Zone Name** | Nome (texto livre). | Por instância. |
| **Number (No.)** | Número (texto livre). | Não é numérico; aceita "101A". |
| **Zone Top** | `Home+1`, `Home+2`, … ou **`Not linked`**. | *"By default the Zone top is linked to one story up."* |
| **Top offset** | Deslocamento do topo em relação ao story linkado (positivo/negativo/zero). | Indisponível quando `Not linked`. |
| **Zone height** | Altura total. | **Somente leitura** quando há top link. |
| **Subfloor Thickness** | Espessura do contrapiso — **este é o "Floor thickness"** do briefing. | *"Optionally, enter a Subfloor Thickness value (positive or negative). The bottom of the Zone will be offset."* Vira `ROOM_FL_THICK` no carimbo. |
| **Home Story** | Story a que o **fundo** está fisicamente ligado. | Se o nível do piso mudar, a zona acompanha. |
| **Bottom offset** (do Home Story) | Deslocamento da base. | Análogo ao `heightOffset` do Hestia. |
| **Bottom Elevation [to Reference level]** | Cota da base em relação ao **Reference Level** (padrão: Project Zero). | *"This is a calculated value, not a link."* Níveis em `Options → Project Preferences → Reference Levels`. |
| **Zone Polygon** (3 ícones) | `Manual` / `Inner Edge` / `Reference Line`; o Info Box desdobra o Manual em `Polyline`, `Rectangular`, `Rotated Rectangle`. | `[S3]` |
| **Zone Polygon Display: Gross / Net** | Só habilitado para zonas criadas no modo `Reference Line`. `Net`: o polígono não é desenhado além da face interna. `Gross`: desenha o polígono inteiro. | **"Regardless of the option, the Zone area remains unchanged, only the polygon is displayed differently."** `[DOC]` `[S3]` |

### 2.2 Painel **Floor Plan**

| Campo | O que faz |
|---|---|
| **Zone Fill Outline** | Liga/desliga o contorno; escolhe **Line Type** e **Pencolor** (cor da caneta). |
| **Zone (Cover) Fill Pattern** | Escolhe um **cover fill** (só fills marcados como Cover Fill em `Options → Element Attributes → Fills`). |
| **Use Fill from Surface** | Usa no preenchimento de planta o mesmo hatch da face superior definida no painel Model. |
| **Link Fill Orientation** | Orientação do fill vetorial/simbólico. |

`[DOC]` `[S3]`. E: *"Zone backgrounds (and other fills) can use Graphic Overrides."* `[DOC]` `[S5]`

### 2.3 Painel **Zone Stamp**

| Campo | O que faz |
|---|---|
| (nome do carimbo) | **Somente leitura**: *"You cannot assign a different zone stamp here; the zone stamp shown is the one associated with the Zone Category."* |
| **Uniform Stamp Pen** | Usa uma única caneta em todo o símbolo. |
| **Zone Stamp Angle** | Rotação + `Fixed Angle to Screen` vs `Fixed Angle to Model`. |

Nota oficial importante: *"Customization of the Zone Stamp parameters will be lost if you change the Category of the Zone. Parameters will revert to the values stored with the Zone Category attributes."* `[DOC]` `[S3]`

### 2.4 Painel **Custom Settings**

*"This panel contains additional choices linked to the Zone Stamp."* `[DOC]` `[S3]` — é o **UI script do GDL**. Muda conforme o carimbo escolhido (é aqui que aparecem páginas como "Finishes, Heights", "Area, Volume", "Appearance", "Scale Sensitivity" nos carimbos da biblioteca padrão). `[SEC]` (vídeo oficial de treinamento mostrando a página "Finishes, Heights" → `Floor Finish` → `Parquet`) `[SEC]`

### 2.5 Painel **Model**

| Campo | O que faz |
|---|---|
| Surface (pop-up) | Material/superfície do sólido 3D da zona. |
| **Use this Surface on All Zone Faces** | Uma superfície para todas as faces. |
| **Inherit Boundary Walls and Cropping Elements Surfaces** | Cada face herda a superfície da parede/elemento correspondente. |

*"If the Surface has a texture, the texture is automatically aligned to the longest edge of the Zone."* `[DOC]` `[S3]`

### 2.6 Painel **Area Calculation** — o coração da confusão

Texto do AC30 (mais preciso que o do AC25/AC28 — no AC30 ganhou a definição explícita de `Measured Area`): `[DOC]` `[S3]`

| Campo | Definição oficial |
|---|---|
| **Measured Area** | *"Area of the Zone Polygon, **including the area of bounding Walls all the way to their reference lines**."* |
| **Measured Net Area** | *"Area of the Zone Polygon only up to the **inside face** of the bounding Walls. Compared to the Measured Area, Measured Net Area is further reduced by Walls, Columns, and/or Curtain Walls that are inside the polygon IF their Relation to Zones is set to 'Zone Boundary.'"* |
| **Reduced Area** | Desconta do `Measured Net Area`: (a) Walls/CW/Columns internos com relação `Reduce Zone Area only`, sujeitos às `Zones Preferences`; (b) áreas de **Fills** com opção "reduce Fill area"; (c) **forros baixos** e reentrâncias de parede conforme `Zones Preferences`. |
| **Reduce by** (checkbox + %) | *"Click the Reduce by checkbox if you want to further reduce the Reduced Area by any given percentage… The result is the **Calculated Area**."* |
| **Area Subtraction** (somente leitura) | Três linhas: `Walls, Curtain Walls and Columns` / `Fills` / `Low ceilings` — mostram **quanto** foi subtraído e por quê. |

### 2.7 "measured" × "calculated" × "nominal" — e por que polígono ≠ área

**Fórmulas exatas**, tiradas dos parâmetros que o carimbo recebe (GDL Center, `Room Parameters`) `[DOC]` `[S15]`:

```
ROOM_AREA         = área do polígono bruto (gross) ou líquido (net)   -- o que está desenhado/medido
ROOM_NET_AREA     = área do polígono líquido, com furos
ROOM_WALL_EXTR_AREA, ROOM_COLUMN_EXTR_AREA,
ROOM_FILL_EXTR_AREA, ROOM_LOW_EXTR_AREA  = reduções parciais
ROOM_TOTAL_EXTR_AREA = soma das reduções acima
ROOM_REDUCED_AREA = ROOM_NET_AREA - ROOM_TOTAL_EXTR_AREA
ROOM_AREA_FACTOR  = 1 - (Reduce_by_no_diálogo / 100)
ROOM_CALC_AREA    = ROOM_REDUCED_AREA * ROOM_AREA_FACTOR
ROOM_VOLUME       = "Calculated from trimmed room upon net polygon"
```

Ou seja, a cadeia é **uma só, em cascata**, e cada número da UI é um ponto de parada diferente dela:

```
polígono (bruto)  →  Measured Area
   − espessura das paredes delimitantes  →  Measured Net Area
   − elementos internos (Reduce Zone Area Only) − fills − forros baixos  →  Reduced Area
   × (1 − Reduce by%)  →  Calculated Area
```

**Por que a zona mostra polígono e área medida separados**: porque no modo `Reference Line` o polígono **gravado/medido** vai até a linha de referência (área bruta), mas a **exibição** pode ser recortada na face interna (rádio `Gross/Net`) sem alterar o número. É deliberado: o arquiteto desenha "até a parede" e ainda assim obtém a área bruta para normas. E no caso de parede inclinada há **dois polígonos simultâneos** (projeção editável × base real do sólido), o que só faz sentido se polígono e área forem coisas separadas. `[DOC]` `[S3]` `[S5]`

**"Nominal area"**: **não existe no ArchiCAD.** Varri os painéis de Zone Settings, os parâmetros GDL de zona (`[S15]`), a estrutura de quantidades da API (`API_ZoneAllQuantity`, `[S17]`) e a doc de export IFC (`[S18]`) — não há "nominal". Os quatro nomes são `Measured`, `Measured Net`, `Reduced`, `Calculated`. Se o termo aparecer em algum material do Hestia/Revit, é importação conceitual de outra ferramenta.

**Exemplo numérico** (fonte secundária, didática): parede composta com linha de referência na face externa, 3 pilares com `Reduce Zone Area Only`, `Reduce by = 5%` → `9,23 m² − 0,05 × 9,23 = 8,77 m²` de área calculada. `[SEC]` `[S29]`

---

## 3. Cálculo de área: métodos, reduções, net × gross, normas

### 3.1 Métodos suportados

| Método | O que mede | Existe no ArchiCAD? |
|---|---|---|
| **Inner Edge** | face interna da parede | Sim (nativo) `[DOC]` |
| **Reference Line** | linha de referência da parede (eixo, face externa, face interna… conforme o composto) | Sim (nativo) `[DOC]` |
| **Core / eixo do núcleo** | eixo ou face do núcleo do composto | **Não.** Não há opção "core". Aproximação: posicionar a **linha de referência** no núcleo e usar `Reference Line`. `[DOC]` (ausência) + `[?]` para alguma macro/localização que emule |
| **Manual** | polígono desenhado à mão | Sim `[DOC]` |
| **Linha de separação** | line-type com `Zone Boundary` | Sim `[DOC]` |
| **Crop Zone** | recorte contra roof/slab/beam | Sim (`Design → Roof Extras → Crop Zone`) `[DOC]` |
| **Solid Element Operations na zona** | subtração/adición de sólidos | Sim (`[SEC]` KB, `[DOC]` implícito em Crop/SEO) |

### 3.2 Reduções — `Relation to Zones` (por elemento) + `Zones Preferences` (por projeto)

`Relation to Zones` existe para **Walls** (Model panel), **Columns** (Positioning panel) e **Curtain Walls** (Member Placement panel), com quatro valores. Tabela oficial, exemplo de 100 m² e 2,70 m de altura com um pilar de 1 × 1 m: `[DOC]` `[S11]`

| Relation to Zones | Measured Area | Volume | Regra |
|---|---|---|---|
| **Zone Boundary** | 99 m² | 267,3 m³ | Delimita a zona; a área do elemento **não** entra. Se a parede for inclinada, a geometria da zona fica inclinada. Pilar **vertical** com essa relação também sai da área. **Pilar inclinado não pode ser `Zone Boundary`** — usar `Subtract from Zones`. |
| **Reduce Zone Area Only** | 99 m² | 270 m³ | Área sai, **volume fica** (o volume do elemento continua dentro do volume da zona). Sujeito às `Zones Preferences`. |
| **Subtract from Zones** | 99 m² | 267,3 m³ | Subtrai da **Measured Area e da Net Area** e subtrai o volume. Único que aceita pilar inclinado. |
| **No Effect on Zones** | 100 m² | 270 m³ | Ignora o elemento: área e volume dele entram na zona. |

`Zones Preferences` (`Options → Project Preferences → Zones`) `[DOC]` `[S12]`:

- **Add Wall Recesses to Zones**: inclui reentrâncias de porta/janela na área, com filtros `If deeper than` / `If larger than` e combinador `AND`/`OR`. (É o inverso conceitual do Hestia: aqui o vão pode **somar** área.)
- **Walls & Column Subtraction**: `If larger than` (área mínima para o elemento contar) e `Subtract` (percentual, padrão 100%) — *"These options will affect only elements that are set to 'Reduce Zone Area Only' or 'Subtract from Zones'."*
- **Area reduction under low ceiling**: até **dois** limites de altura, cada um com seu percentual de subtração.

> Essas preferências são **do projeto** (`Project Preferences`), não da zona: *"The settings you make here are Project Preferences: specific to the Project you are working on and are saved with it."* `[DOC]` `[S12]`

### 3.3 Net × gross

- No modo `Inner Edge` **não há diferença por espessura de parede** entre `Measured Area` e `Measured Net Area` (ambas param na face interna); a diferença só aparece se houver elemento **interno** marcado como `Zone Boundary` (pilar, parede interna). Ou seja, nesse modo **não existe área bruta**: o máximo que se obtém é a área líquida. `[SEC]` `[S30]`
- No modo `Reference Line`, `Measured Area` = bruta (até a linha de referência) e `Measured Net Area` = líquida. `[DOC]`
- Aviso importante e honesto: mesmo a "bruta" do ArchiCAD **pode não ser a bruta da norma** — o `Reference Line` só vai até a linha de referência, que pode estar na face interna do composto; nesse caso "gross" ≠ "gross normativo". `[SEC]` `[S30]`
- Gross/Net **de exibição** (rádio no painel Zone Polygon) ≠ gross/net **de cálculo**. Confundir os dois é a dor nº 1 relatada em fórum. `[SEC]` `[S30]` `[S31]`

### 3.4 Normas nacionais (DIN 277, WoFlV, etc.)

**Não há suporte nativo de norma no núcleo da ferramenta Zone.** O que existe é um **add-on regional alemão**, documentado na ajuda alemã: `[DOC]` `[S21]`

> "Diese Beschreibung erläutert die Verwendung der Flächen- und Volumenberechnung in ARCHICAD und wie Sie Flächen- und Volumenberechnungen entsprechend der **DIN 277** durchführen können."

Como ele funciona (e isso é revelador):

- Exige **Räume** (zonas) colocadas corretamente: *"Normalerweise reichen die Räume von Oberkante Rohdecke bis zur Unterkante Rohdecke des darüberliegenden Geschosses. Unter Dach werden die Räume mit Dachflächen verschnitten."*
- Exige **Morphs** para o volume bruto: *"Für die Berechnung der Brutto-Volumen werden Morphkörper verwendet. Diese platzieren Sie nach Anforderungen der DIN 277 an den Außenkanten des Gebäudes."*
- Grandezas calculadas: **Netto-Raumfläche (NRF)** = *"entspricht der gemessenen Nettofläche des Raums. Abzüge durch Schraffuren, Wände, Dachflächen etc werden nicht berechnet"*; **Brutto-Grundfläche (BGF)** = projeção dos Morphs; **Konstruktionsgrundfläche (KGF)** = BGF − NRF; **Netto-Volumen**, **Brutto-Volumen**, **Konstruktionsvolumen**; e **Wohnfläche nach WoFlV** = *"die Fläche entspricht der berechneten Fläche, wie in den Raumflächen-Einstellungen angezeigt"*.
- O resultado sai em **listas próprias** no Navigator (seção `Flächenberechnung`) ou em `Dokumentation → Listen & Berechnungen`, com níveis de detalhe (`Nur die Summen`, `Berechnung anzeigen`, `Ohne Details`), opção de **planta de apoio**, 3D dos Morphs, ordenação, e **import/export XML** do esquema.

Ou seja: **norma = add-on + disciplina de modelagem (zonas + Morphs) + listas**, nunca um "método de cálculo" no painel da zona.

No Japão existe um add-on oficial **`Check for Area Conflicts`** (`Edit → Check Area Conflicts`) que acha sobreposições/gaps pequenos entre Zones e Fills e joga no Issue Organizer. `[DOC]` `[S22]` — útil como referência de "qualidade de áreas", que o Hestia resolve por construção (não há como duas zonas ocuparem o mesmo circuito).

---

## 4. Zone Categories e Zone Stamps

### 4.1 O que é uma categoria

> "Each Zone you create in your project is assigned a Zone Category in the Zone's Settings dialog box. Zone Categories are attributes of the project. Zone Category defines: the default color of the Zone background (for all Floor Plan Zones, and for cut Zones in Section-type views and 3D Documents), and **the Zone Stamp object used for the Zone**." `[DOC]` `[S4]`

Diálogo (`Options → Element Attributes → Zone Categories`): pop-up de categorias predefinidas, `New` (copia a selecionada com outro nome), `Rename`, `Delete`; **Zone Stamp** (pop-up da biblioteca carregada); **Color**; e uma **preview** que ajuda a visualizar os parâmetros do carimbo. `[DOC]` `[S4]`

No Zone Settings a descrição é mais completa: a categoria carrega *"the Category name, **code**, color and zone stamp, and **a set of parameters**"*. `[DOC]` `[S3]` O `code` é o que o IFC exporta como `ItemReference` (§6.3).

### 4.2 O que é o carimbo (Zone Stamp)

> "**Zone Stamps** are intelligent parametric **GDL Objects** whose look, contents and behavior can be fitted to local architectural practice. They reside in the project library." … "Each Zone Stamp contains textual information about the Zone, including its name, number, area, and other optional parameters; the exact content of your Zone Stamp depends on the parameters you set in the Zone Stamp Panel of Zone Settings." `[DOC]` `[S7]`

Como o carimbo é personalizado, na prática:

1. **Escolher/trocar** o carimbo → só em `Zone Categories` (não no Zone Settings). `[DOC]` `[S4]` `[S3]`
2. **Campos e máscaras** → são **parâmetros do objeto GDL** + scripts (2D/3D/UI/property). Os valores que a zona entrega ao objeto são os **Room Parameters** `[DOC]` `[S15]`:

   | Parâmetro | Conteúdo |
   |---|---|
   | `ROOM_NAME`, `ROOM_NUMBER` | nome e número da zona |
   | `ROOM_AREA` | área do polígono bruto **ou** líquido (conforme gross/net) |
   | `ROOM_NET_AREA` | área do polígono líquido com furos |
   | `ROOM_PERIM`, `ROOM_NET_PERIMETER`, `ROOM_HOLES_PRM`, `ROOM_WALLS_PRM` | perímetros (total, líquido, furos, só trechos encostados em parede) |
   | `ROOM_CORNERS`, `ROOM_CONCAVES` | nº de quinas e quinas côncavas |
   | `ROOM_BASELEV`, `ROOM_HEIGHT`, `ROOM_FL_THICK` | cota da base, altura, espessura do contrapiso |
   | `ROOM_WALL_EXTR_AREA`, `ROOM_COLUMN_EXTR_AREA`, `ROOM_FILL_EXTR_AREA`, `ROOM_LOW_EXTR_AREA`, `ROOM_TOTAL_EXTR_AREA` | as reduções, uma a uma |
   | `ROOM_REDUCED_AREA`, `ROOM_AREA_FACTOR`, `ROOM_CALC_AREA` | área reduzida, fator, área calculada |
   | `ROOM_VOLUME` | volume |
   | `ROOM_WALLS_SURF`, `ROOM_DOORS_*`, `ROOM_WINDS_*`, `ROOM_*_SURF` | superfícies de parede, portas, janelas, faces de topo/base |
   | `ROOM_POLY_STATUS` | **0 = manual, 1 = Auto, 2 = Auto-refline** |

3. **UI do carimbo** → o painel **Custom Settings** do Zone Settings é o UI script; é onde aparecem toggles como "Floor Finish", "Scale Sensitivity", "Area, Volume". `[DOC]` `[S3]` + `[SEC]` (vídeo de treinamento) `[SEC]`
4. **Mover o carimbo independentemente da zona** → `Move Sub-Element` no pet palette (funciona em qualquer escala) ou `Move Node` (só 1:50/1:100/1:200 e se o objeto suportar). `[DOC]` `[S7]`

> **Detalhe de arquitetura que interessa ao Hestia:** acabamentos (piso/parede/forro) **não são dados nativos da zona**. No carimbo padrão eles existem como **parâmetros do GDL** (página "Finishes, Heights"), e por isso só aparecem em tabela via **Library Part Parameters** — não no grupo "Zone" do schedule. `[SEC]` `[S31b]` Ver §6.

### 4.3 Zone Stamp × Zone Label (mudança de paradigma no AC25)

Desde o **ArchiCAD 25**, o padrão é o **Zone Label**, e o carimbo vem **desligado**: `[DOC]` `[S4]` `[S7]`

> "Note: Zone Stamps are turned off by default; Zones are placed with Zone Labels instead."
> "To display Zone Stamps in the project, check **Show Zone Stamp** in `Document → Model View → Model View Options` (Construction Element Options panel)."

O que o Label resolve: `[DOC]` `[S23]` `[S24]`

- É um **elemento Label separado** (associativo), não um sub-elemento da zona → pode haver **vários por zona**, em **layers diferentes**, com **conteúdos diferentes**.
- Pode ser colocado em **planta, corte, elevação, elevação de interiores, 3D Document** — o carimbo só existia em planta.
- O label de biblioteca padrão **`Zone Label`** exibe **Zone Name, Number, Calculated Area**. `[DOC]` `[S24]`
- Ao criar a zona, o **último clique pode colocar o label automaticamente** (toggle **Place Label** no Info Box + escolha do favorito). `[DOC]` `[S1]`
- Se o label estiver associado a um elemento invisível, ele some junto, a menos que se desmarque **"Hide with Associated Element"**. `[DOC]` `[S23]`

Complemento oficial da Graphisoft (support): *"Zone stamps are integrated within the Zone, and their visibility can be adjusted by using the Model View Options. Also, when the layer of the Zone is turned off, the Zone Stamp will become hidden. On the other hand, Labels are separate elements."* `[SEC]` `[S37]`

### 4.4 Numeração: o que existe e o que **não** existe

- `Number (No.)` é **texto livre por instância**. `[DOC]` `[S3]`
- Ao colocar zonas em sequência, o número **tende a incrementar** (comportamento de campo, não documentado); ao copiar/colar ele se repete. `[SEC]` `[S38]`
- **Não existe comando de renumerar zonas.** Pedidos na comunidade continuam sem solução; o workaround é editar em **Interactive Schedule** (edição inline) ou via API. `[SEC]` `[S34]`
- O **Element ID Manager** numera o **ID do elemento**, não o `Zone Number` — e a sugestão da comunidade é *usar o ID como número de zona*, não o contrário. `[SEC]` `[S34]`
- Não há numeração por story, por categoria nem por prefixo automático. `[SEC]` `[S34]` `[?]` (add-ons de terceiros fazem isso — fora de escopo)

### 4.5 `Update Zones` quando as paredes mudam

> "When you modify your design, **automatically created Zones do not automatically adjust themselves** to the changes, so they may require you to use the Update Zones command." `[DOC]` `[S13]`

Fluxo: `Design → Update Zones` → diálogo lista as zonas (seleção sincronizada com o projeto) → `Update Selected Zones` (se há seleção) ou `Update All Zones` (se não há). Zonas atualizadas com sucesso ganham **checkmark** + **delta de área** (quanto foi somado/subtraído). `[DOC]` `[S13]`

Três estados de problema, com ícones próprios: `[DOC]` `[S13]`

| Ícone | Significado | Correção |
|---|---|---|
| Manual | "The Zone was created manually and cannot be automatically updated." | redesenhar/editar à mão |
| Cadeado | Layer da zona travado | destravar em `Layer Settings` |
| Interrogação | "no longer surrounded by a closed polygon, and can't be updated" | `Zoom to Selected Zones`, fechar o circuito, repetir |

Há ainda uma opção, no `Crop Zone`, de **desfazer os crops ao atualizar** zonas modificadas. `[DOC]` `[S9]`

---

## 5. Representação

### 5.1 Planta

- **Preenchimento padrão = cor da categoria**: *"By default, Zone backgrounds are displayed with Zone Category color."* `[DOC]` `[S5]`
- Pode ser trocado por qualquer **cover fill** (painel Floor Plan), com `Use Fill from Surface` e `Link Fill Orientation`. `[DOC]` `[S3]`
- **Contorno**: `Zone Fill Outline` (Line Type + Pencolor). **Não existe um checkbox "Show Zone Boundary"** com esse nome. O que existe com o nome "Zone Boundary" é: (a) o **valor de `Relation to Zones`** em paredes/colunas/CW; (b) o **checkbox em elementos lineares** (Line/Arc/Spline/Polyline) que os torna delimitadores 2D. Para "sumir com a borda" a prática é desligar o `Zone Fill Outline`, usar Graphic Override, ou desligar a layer da zona e deixar só labels numa layer própria. `[DOC]` `[S3]` `[S11]` + `[SEC]` `[S39]`
- **Gross/Net** muda o desenho do polígono (não a área). `[DOC]`
- **Parede inclinada** → dois polígonos (um editável, um "real"). `[DOC]` `[S5]`
- Zonas e fills aceitam **Graphic Overrides** (inclusive por regra). `[DOC]` `[S5]`

### 5.2 Corte / elevação / 3D Document

Tabela oficial de defaults (AC25 Update 2+; exige `Options → Project Preferences → Legacy` **desmarcado**): `[DOC]` `[S6]`

| Vista | Cut (cortado) | Uncut (não cortado) |
|---|---|---|
| Floor plan (simbólico) | cor da categoria | cor da categoria |
| Section/Elevation/Interior Elevation | **cor da categoria** | **superfície** |
| 3D Document | cor da categoria | superfície |
| 3D window + cutaway | superfície | superfície |

- Transparência de zona **cortada** em corte: `transmittance ≥ 50` → totalmente transparente; `≤ 49` → opaca. Em zona **não cortada** (elevação/3D), **qualquer valor > 0** já dá transparência, crescente. Ajuste em `Options → Element Attributes → Surfaces`. `[DOC]` `[S6]`
- Em projetos abertos de AC24 ou anterior o checkbox **Legacy** vem ligado e o comportamento antigo volta. `[DOC]` `[S6]`

### 5.3 3D

- Ver zonas em 3D: `View → Elements in 3D View → Filter and Cut Elements in 3D` com **"Zone"** marcado. `[DOC]` `[S8]`
- Superfície no painel Model (uma para todas as faces, ou herdada das paredes/recortes). `[DOC]` `[S3]`
- Truque oficial: Layer Combination predefinida **"Show 3D Zones as Solid"** (zonas em shading, resto em wireframe). `[DOC]` `[S8]`

### 5.4 O carimbo/rótulo como elemento gráfico separado

- **Carimbo**: sub-elemento da zona (move com `Move Sub-Element`), visibilidade por **Model View Options → Show Zone Stamp**, morre junto com a layer da zona. `[DOC]` `[S7]` `[SEC]` `[S37]`
- **Label**: elemento próprio, múltiplo, independente em layer e conteúdo, funciona em corte/elevação/3D. `[DOC]` `[S23]` `[S24]`
- **Legenda de cores**: **não existe** legend/key automática por categoria de zona. Quem quer legenda desenha (Text/Label, ou Keynote Legend), ou usa Graphic Overrides + label de classificação. `[?]` → não achei nenhum recurso oficial de "zone legend"; a ausência é consistente em `[S4]` `[S5]` `[S24]`.

---

## 6. Listas, tabelas e exportação

### 6.1 Interactive Schedule

- `Document → Schedules → Scheme Settings` (ou botão `Scheme Settings` na janela do schedule). Esquerda: esquemas por tipo; direita: **Criteria** e **Fields**. `[DOC]` `[S26]`
- **Criteria** = quais elementos entram (`Zone` é um tipo de esquema). **Fields** = quais dados saem: lista pesquisável com `General`, parâmetros específicos e `Properties`; duplo clique adiciona. `[DOC]` `[S27]`
- Campos típicos de zona (do grupo `Zone` + `General`), conforme o treinamento oficial e a doc: `Home Story`, `Zone Name`, `Zone Number`, `Zone Category`, `Measured Area`, `Measured Net Area`, `Calculated Area`, `Net Volume`, `Zone Height`… `[SEC]` `[S40]` + `[DOC]` `[S27]`
- **Agrupamento e totais**: cada campo tem, na segunda coluna, opções de **subtotal por valor** (`Home Story` → subtotais por pavimento) e **soma** (`Calculated Area`, `Net Volume`). `[SEC]` `[S40]`
- **Parâmetros do carimbo como campo/critério**: `Add Criteria → seta → Library Part Parameters` → escolher o library part da categoria → escolher o parâmetro (ex.: `stApartmentId`, `stHouseNumber`, `stPosition` do "Zone Stamp 02"). `[SEC]` `[S31b]`
- **`Merge Uniform Items`** (mesclar itens iguais) agrupa por nome/categoria e **ignora** `Calculated Area`/`Measured Area` como critério de diferença — pegadinha relatada: 9 zonas com áreas diferentes viram 3 linhas. `[SEC]` `[S41]`
- Edição inline no schedule **altera o modelo** e vice-versa (Interactive Schedule é bidirecional). `[DOC]` `[S42]`

### 6.2 Exportação

- Schedule é **viewpoint**: vira view, entra em Layout, publica em PDF/DWG; pode ser **salvo** em outros formatos pela janela do schedule ("Save from Schedule Window"). `[DOC]` `[S42]`
- Copiar/colar num Worksheet → vira linha+texto, **perde associação**. `[DOC]` `[S42]`
- **XLS**: a comunidade confirma exportação de schedules para `.xls`, e o caminho recomendado é via **Element Schedule** em `File → Interoperability`. `[SEC]` `[S43]`
- **Esquema em XML**: import/export de schemes entre projetos. `[DOC]` `[S26]`
- Listas de área DIN (add-on alemão): XML também. `[DOC]` `[S21]`

### 6.3 IFC (o que o Hestia precisa espelhar)

- Zona → **`IfcSpace`**. `[DOC]` `[S19]`
- `Data Conversion for IFC Export`: `[DOC]` `[S18]`
  - **Zone Categories** → *"Export the Zone Categories data (Code and Name) of Zones as **IFC Space Classification Reference** data (ItemReference and Name)."*
  - **IFC Base Quantities** → quantitativos (`Qto_SpaceBaseQuantities`).
  - **IFC Space Boundaries** → `IfcRelSpaceBoundary` (posição, tamanho e adjacência de cada elemento que borda a zona; subdividido por aberturas) — para cálculo térmico.
  - **IFC Space Containment** → relação zona ↔ objetos/morphs/slabs contidos.
- AC30: **`IfcSpatialZone`** por *Type Mapping* (Classification → `ifcSpatialZone`), com container no IFC Project Manager. `[DOC]` `[S20]`
- **`Qto_SpaceBaseQuantities` — semântica exata** (buildingSMART) `[DOC]` `[S28]`:

  | Quantidade | Significado |
  |---|---|
  | `GrossFloorArea` | área do piso **incluindo** pilares e paredes internas; não desconta aberturas no piso |
  | `NetFloorArea` | área do piso **sem** pilares e paredes internas; desconta aberturas no piso |
  | `GrossPerimeter` | perímetro incluindo portas e limites virtuais |
  | `NetPerimeter` | perímetro "de rodapé": desconta portas, inclui perímetros internos (pilares) |
  | `GrossWallArea` / `NetWallArea` | parede com / sem aberturas |
  | `GrossCeilingArea` / `NetCeilingArea` | forro com / sem aberturas |
  | `GrossVolume` / `NetVolume` | volume com / sem elementos internos |
  | `Height`, `FinishFloorHeight`, `FinishCeilingHeight` | alturas |

  **Consequência para o Hestia:** a área que o Hestia calcula hoje (face interna, descontando ilhas) é `NetFloorArea`, **não** `GrossFloorArea`. Exportar as duas com o mesmo número é erro semântico de IFC. `[DOC]` `[S28]`

---

## 7. Limitações e dores conhecidas

| # | Dor | Detalhe | Fonte |
|---|---|---|---|
| 1 | **Zona não atualiza sozinha** | Comportamento documentado, não bug: *"automatically created Zones do not automatically adjust themselves"*. Existe wishlist aberta há 20+ anos. | `[DOC]` `[S13]` + `[SEC]` `[S31]` |
| 2 | **Zona manual nunca atualiza** | Ícone próprio no `Update Zones`; é definitivo, não é erro de configuração. | `[DOC]` `[S13]` |
| 3 | **"Zona não está fechada"** | Depois de mover uma parede, a varredura pode não fechar; o diálogo mostra "?" e a zona **para no tempo**. Diagnóstico é manual (`Zoom to Selected Zones`). | `[DOC]` `[S13]` |
| 4 | **Vazamento por abertura que não é porta/janela** | A varredura continua procurando limite **fora** do ambiente; resultado inesperado. Soluções: manual, Empty Opening full-height, linha `Zone Boundary`. | `[DOC]` `[S1]` |
| 5 | **Zonas sobrepostas contam duas vezes** | Não há bloqueio. Em schedule, o total soma as duas. Prática da comunidade: **"Never use overlapping zones"**; usar fills para zonas conceituais. | `[SEC]` `[S33]` |
| 6 | **Zona de conceito × zona de sala no mesmo lugar** | Schedules "se confundem" sobre qual zona um objeto/porta pertence; workaround: layers + criteria no schedule, ou `Override` de localização em porta/janela. | `[SEC]` `[S33]` |
| 7 | **Performance ao mover paredes** | *"if there is one long wall on which multiple zones are connected, it can decrease performance big time"*. | `[SEC]` `[S32]` |
| 8 | **Schedule de zonas lento** | Projeto de 16 pavimentos com schedules calculando área/volume de zonas: cálculo "extremamente lento". | `[SEC]` `[S32b]` |
| 9 | **Design Options / Renovation quebram a atualização** | Zonas em Design Options não detectam os elementos; relato de 2026 (AC29) sem solução. | `[SEC]` `[S35]` |
| 10 | **Parede inclinada / complexa** | Cai para borda interna; dois polígonos na planta; editar o polígono visível **não** altera o 3D. | `[DOC]` `[S2]` `[S5]` |
| 11 | **Pilar inclinado não pode ser `Zone Boundary`** | Precisa `Subtract from Zones`. | `[DOC]` `[S11]` |
| 12 | **Coluna não fecha circuito** | *"Columns cannot serve as the enclosing boundary of a zone."* | `[DOC-]` `[S2]` |
| 13 | **Trocar categoria apaga customização do carimbo** | Volta aos valores salvos na categoria. | `[DOC]` `[S3]` |
| 14 | **Quatro áreas confundem** | Erro clássico: `Reduce by` preenchido em 50% e todo mundo achando que a área está errada (o schedule acertava, o carimbo não). | `[SEC]` `[S44]` |
| 15 | **Label depende da layer/visibilidade da zona** | Autotext de zona não resolve se a layer da zona está desligada; labels "desassociam" em certas mudanças. | `[SEC]` `[S45]` |
| 16 | **Não há legenda automática de categorias** | Sem key/legend nativa; desenho manual. | `[?]` (ausência consistente) |
| 17 | **Split de zona não recalcula o carimbo** | Ao dividir uma zona, cada metade pode continuar mostrando a área antiga até `Update Zones`/resize. | `[SEC]` `[S31]` |

---

## 8. TABELA FINAL — ArchiCAD × Hestia

Coluna "Hestia hoje" = o que está no briefing do produto e em `docs/paridade/ambientes.md` / `docs/decisoes/0018-ambientes.md`. Onde o briefing e a doc de paridade divergem, anotei.

### 8.1 Geometria e criação

| # | Item | ArchiCAD | Hestia hoje | O que falta | Conf. |
|---|---|---|---|---|---|
| 1 | Modelo de dados | Elemento com **polígono gravado** (`poly`) **+** polígono encontrado (`refPoly`) + ponto de referência (`refPos`) | Nível, nome, número, **ponto interior**, offset, pé-direito, 3 acabamentos, cor; contorno/área/perímetro/volume **sempre derivados** | Nada a copiar. O Hestia é mais limpo; o preço é que não há "congelar" contorno (ver #14) | `[DOC]` |
| 2 | Modo de construção | 3 modos gravados por zona (`manual`, `refLineFlag`, `ROOM_POLY_STATUS` 0/1/2) | 1 modo fixo: varredura a partir do ponto, limite = face de acabamento interna | Expor `bordaDeCálculo` (face interna × linha de referência) — **já previsto em docs/05 §6, não implementado** | `[DOC]` |
| 3 | Criação automática | Clique **dentro** de circuito fechado de Walls/CW → 1º clique define `refPos`, 2º coloca label | Clique dentro do circuito → preview de contorno + rótulo com área → cria | Equivalente. Falta mostrar/guardar o **ponto de referência** como "+" visível | `[DOC]` |
| 4 | Criação manual (polígono) | `Polyline` / `Rectangular` / `Rotated Rectangle` | Não existe (só automático) | Modo manual para estudo de viabilidade/space planning | `[DOC]` |
| 5 | "Criar em todos os circuitos" | **Não existe** comando equivalente (cria uma por vez) | Botão "criar em todos os circuitos fechados" | — (Hestia é melhor aqui) | `[DOC]` |
| 6 | Colunas como fechamento | **Não** fecham circuito | Pilar/ilha vira **furo**, não fecha | Diferente por decisão: Hestia trata ilha como furo (mais perto de `Zone Boundary` de pilar) | `[DOC-]` |
| 7 | Vãos de porta/janela | Não abrem o circuito (contam como parede) | Contam como parede | Equivalente | `[DOC]` |
| 8 | Abertura que não é porta/janela | Varredura **vaza** para fora; corrige com linha `Zone Boundary`, Empty Opening ou manual | Não há conceito; o circuito simplesmente é o que é | Nenhuma ação: o Hestia nunca "vaza" | `[DOC]` |
| 9 | Parede que não delimita | `Relation to Zones = No Effect on Zones` por parede | Não existe (toda parede do nível delimita) | Propriedade por parede "não delimita ambiente" | `[DOC]` |
| 10 | Linha de separação | Line/Arc/Spline com **`Zone Boundary`** marcado; atua como delimitador 2D | Briefing diz "existe linha de separação"; `paridade/ambientes.md` **A5 diz fora de escopo** | **Divergência a resolver**: implementar ou remover da descrição | `[DOC]` |
| 11 | Parede inclinada | Zona acompanha a inclinação; planta mostra **2 polígonos**; editar o visível não muda o 3D | Parede inclinada não é suportada no motor de ambiente (limite é a face vertical) | Suporte a parede inclinada/complexa com polígono "real" separado do "visível" | `[DOC]` |
| 12 | Parede complexa (perfil) | `Reference Line` cai para borda interna; sólido aparado pela geometria real | Perfil de parede por faixas; limite = face interna | Avaliar se o perfil complexo muda a face interna no Hestia | `[DOC-]` |
| 13 | Furos na zona | Sim (`ROOM_HOLES_PRM`, `subtract from polygon`) | Ilhas viram furos | Equivalente | `[DOC]` `[S15]` |
| 14 | Atualização quando a parede muda | **Manual**: `Design → Update Zones`; sem auto-update; zona manual nunca atualiza | **Automática e sempre** (derivação a cada leitura) | — (Hestia é melhor; é a principal dor do ArchiCAD) | `[DOC]` |
| 15 | Congelar contorno | Trocar para `Manual` congela o polígono | Não existe (sempre derivado) | Opcional: "fixar contorno" para documentação assinada | `[DOC]` `[SEC]` |

### 8.2 Dados e parâmetros

| # | Item | ArchiCAD | Hestia hoje | O que falta | Conf. |
|---|---|---|---|---|---|
| 16 | Nome / número | `Zone Name` + `Number (No.)`, ambos texto livre | `name` + `number` texto livre | Equivalente | `[DOC]` |
| 17 | Categoria | Atributo de projeto: nome, **código**, cor, carimbo, parâmetros | Não existe (só `color` por instância) | Categoria de ambiente (nome/código/cor) é o que destrava tabela por tipo e IFC classification | `[DOC]` |
| 18 | Altura | `Zone Top` (`Home+N` ou `Not linked`) + offset + `Zone height`; base no Home Story + offset; `Subfloor Thickness` | `ceilingHeight` por instância (default = altura de parede) + `heightOffset` da base | `topLink` a pavimento superior (hoje a altura é isolada por instância, não segue o nível de cima) | `[DOC]` |
| 19 | Espessura de piso ("Floor thickness") | **`Subfloor Thickness`** (`ROOM_FL_THICK`), positivo ou negativo, desloca a base | Não existe | Campo de contrapiso (entra em volume e em `FinishFloorHeight` do IFC) | `[DOC]` |
| 20 | Acabamentos | **Não são dados da zona**: são parâmetros do carimbo (`Floor Finish` etc.) ou Properties | 3 textos livres nativos (`floorFinish`, `wallFinish`, `ceilingFinish`) | — (Hestia é melhor: dado estruturado, não parâmetro de GDL) | `[DOC]` `[SEC]` |
| 21 | Cor | Cor vem da **categoria**; fill pode ser coberto por cover fill ou Graphic Override | `color` por instância | Equivalente em efeito; falta fallback por categoria | `[DOC]` |
| 22 | Numeração automática | Incrementa ao colocar; **sem comando de renumerar**; `Element ID Manager` não afeta | Manual, sem geração automática (decisão 0018 #9) | Nada urgente. Se quiser paridade: "renumerar por nível" seria **melhor** que o ArchiCAD | `[SEC]` |
| 23 | Propriedades customizadas | Via `Property Manager` + Classification "Space" (aparecem em schedule e IFC) | Não existe (campos fixos) | Propriedades por ambiente (o Hestia já tem padrão de propriedades em outros elementos) | `[SEC]` |
| 24 | "Nominal area" | **Não existe** | Não existe | — | `[DOC]` |

### 8.3 Cálculo

| # | Item | ArchiCAD | Hestia hoje | O que falta | Conf. |
|---|---|---|---|---|---|
| 25 | Área | 4 valores: `Measured`, `Measured Net`, `Reduced`, `Calculated` | 1 valor: líquida (face interna, ilhas descontadas) = **`NetFloorArea`** | `GrossFloorArea` (incluir pilares/paredes internas) e, se houver norma, cascata de reduções | `[DOC]` `[S28]` |
| 26 | Métodos | Inner Edge / Reference Line / Manual | Só Inner Edge | `Reference Line` (medir até a linha de referência da parede) | `[DOC]` |
| 27 | Modo "core" | **Não existe** | Não existe | — (não é lacuna; não copiar) | `[DOC]` |
| 28 | Redução por elemento interno | 4 opções de `Relation to Zones` + mínimo de área e % nas Preferences | Ilha sempre vira furo e sempre desconta 100% | `Reduce Zone Area Only` (desconta área, mantém volume) e percentual/minárea configurável | `[DOC]` |
| 29 | Redução por percentual | `Reduce by` (%) por zona → `Calculated Area` | Não existe | Campo por ambiente (ou por categoria/projeto) | `[DOC]` |
| 30 | Forro baixo | Até 2 limites de altura com % de subtração (Preferences) | Não existe (forro é elemento do roteiro, sem interseção com ambiente) | Cruzar ambiente × forro/cobertura para descontar pé-direito baixo | `[DOC]` |
| 31 | Reentrância de vão | Pode **somar** área (`Add Wall Recesses to Zones`, filtros depth/area + AND/OR) | Vão sempre conta como parede "cheia" (não soma, não subtrai) | Recurso de nicho; documentar como decisão | `[DOC]` |
| 32 | Recorte por laje/telhado/viga | `Design → Roof Extras → Crop Zone` (+ `Undo All Crops`) | Não existe (ambiente é 2D derivado, sem sólido) | Só faz sentido se o Hestia der 3D ao ambiente | `[DOC]` |
| 33 | Norma nacional (DIN 277 etc.) | Add-on regional `Flächenberechnung` (zonas + Morphs + listas próprias) | Não existe | Se o mercado for BR: NBR 12721/13531 não é nativa em nenhum dos dois; decidir se é add-on/listas | `[DOC]` |
| 34 | Verificação de sobreposição/gaps | Add-on `Check Area Conflicts` (JPN) + prática "nunca sobrepor" | **Impossível por construção** (1 ambiente por circuito; duplicado é aviso) | — (Hestia é melhor) | `[DOC]` `[S22]` |

### 8.4 Representação

| # | Item | ArchiCAD | Hestia hoje | O que falta | Conf. |
|---|---|---|---|---|---|
| 35 | Planta | Preenchimento = cor da categoria (ou cover fill) + contorno (`Zone Fill Outline`) + Gross/Net | Preenchimento + etiqueta "Nome (número) · área" | Contorno como propriedade explícita (liga/desliga) e opção de não desenhar contorno | `[DOC]` |
| 36 | Etiqueta | `Zone Label` (elemento separado, múltiplo, também em corte/3D) **ou** `Zone Stamp` (sub-elemento, ligado por MVO) | Etiqueta desenhada junto do ambiente (não é elemento próprio) | Etiqueta como elemento **selecionável/movível** e colocável em corte | `[DOC]` |
| 37 | Corte / elevação | Zona aparece: cortada = cor da categoria; não cortada = superfície; transparência por `transmittance` | Ambiente não tem geometria 3D; não aparece em corte | Ambiente como sólido (para corte/3D/IFC volume) | `[DOC]` |
| 38 | 3D | Sólido com superfície; filtro `Filter and Cut Elements in 3D`; layer combo "Show 3D Zones as Solid" | Fora do 3D (D2) | 3D do ambiente (decisão de produto) | `[DOC]` |
| 39 | Legenda de cores | **Não existe nativa** | Não existe | Oportunidade: legenda automática por categoria seria diferencial | `[?]` |
| 40 | Graphic Overrides | Sim, inclusive em zonas/fills | Não existe (só cor) | Se o Hestia adotar overrides, zona entra na regra | `[DOC]` |

### 8.5 Listas e exportação

| # | Item | ArchiCAD | Hestia hoje | O que falta | Conf. |
|---|---|---|---|---|---|
| 41 | Tabela | `Interactive Schedule` (bidirecional, criteria + fields, agrupamento, subtotais, merge) | Tabela de ambientes com filtro por nível, totais, CSV | Agrupar por categoria/nome com subtotal; edição inline | `[DOC]` `[SEC]` |
| 42 | Campos de área na tabela | 4 áreas + `Net Volume` + parâmetros do carimbo como campo | Área, perímetro, pé-direito, volume, acabamentos | Escolha de qual área (bruta/líquida) por coluna | `[DOC]` |
| 43 | Export schedule | XLS (via Interoperability), PDF/DWG por Layout, XML do esquema | CSV (`;`, vírgula decimal) | XLSX nativo e export do "esquema" | `[SEC]` `[DOC]` |
| 44 | IFC | `IfcSpace`; `Qto_SpaceBaseQuantities`; `IfcRelSpaceBoundary`; Zone Category → Classification Reference; AC30 `IfcSpatialZone` | `IFCSPACE` com `Qto_SpaceBaseQuantities` | Separar `GrossFloorArea` × `NetFloorArea`; emitir `IfcRelSpaceBoundary` (se houver 3D); categoria → `IfcClassificationReference` | `[DOC]` `[S28]` |
| 45 | DXF | Publicação de planta (DWG/DXF) pelo Publisher; zonas saem como fills/hatches + textos do label | DXF com camadas `AMBIENTES` / `AMBIENTES_TEXTO` | Equivalente (Hestia tem camadas mais explícitas) | `[DOC]` `[SEC]` |

---

## 9. Recomendações concretas para o Hestia (derivadas da pesquisa)

Ordenadas por relação custo/benefício. Nenhuma delas exige copiar o modelo de dados do ArchiCAD.

1. **Nomear a área do Hestia corretamente no IFC.** Hoje o Hestia calcula `NetFloorArea`. Emitir `GrossFloorArea` com o mesmo valor é erro de semântica IFC (`[S28]`). Ou calcular as duas (bruta = incluir ilhas/pilares; líquida = descontar), ou emitir **só** `NetFloorArea` + `Height` e documentar.
2. **Adicionar `bordaDeCálculo` por projeto** (face interna × linha de referência), como já decidido em `docs/05 §6`, mapeando para Inner Edge/Reference Line. É a única forma de responder a norma que mede no eixo sem hack.
3. **Categoria de ambiente** (nome + código + cor, opcionalmente com "tipo"): destrava tabela por tipo, legenda de cores (diferencial — o ArchiCAD não tem), filtro e `IfcClassificationReference`. É o item de maior alavancagem depois da área.
4. **`roomBounding` por parede** (equivalente a `No Effect on Zones`): resolve mezanino, pé-direito duplo, parede de fachada que não deve delimitar.
5. **Linha de separação**: decidir. Hoje o briefing diz que existe e `paridade/ambientes.md` A5 diz que está fora. Um dos dois está errado — e a ausência é uma lacuna real frente ao ArchiCAD (que tem `Zone Boundary` em line-type).
6. **Percentual de redução (`Reduce by`)** por ambiente é barato de implementar e cobre dedução de shafts/áreas técnicas sem inventar furo no polígono.
7. **Etiqueta como elemento próprio** (selecionável, movível, com variantes por vista). O ArchiCAD gastou uma release inteira (25) para sair do carimbo único — vale aprender do erro: não acoplar etiqueta ao ambiente.
8. **Contorno ligável/desligável** por ambiente e por vista (`Zone Fill Outline`), em vez de sempre desenhar a linha de separação.
9. **Não implementar** (e documentar por quê): `Zone Stamp` como GDL paramétrico, `Crop Zone`, gross/net como opção de desenho, numeração automática sem comando de renumerar, 4 áreas cascateadas.

---

## 10. Pendências e o que não consegui confirmar

| Item | Situação | Por quê |
|---|---|---|
| `Show Zone Boundary` como checkbox | **Não encontrado** em nenhuma versão | O nome existe como `Relation to Zones` (parede/coluna) e como checkbox de line-type. Para contorno, o nome é `Zone Fill Outline`. A busca só devolve fóruns pedindo "como desligar a borda", o que confirma que **não há** um toggle com esse nome. `[DOC]`+`[SEC]` |
| Se o AC30 mudou algo em Zone além do `IfcSpatialZone` | **Não** — a lista de novidades do AC30 não menciona Zones; só IFC | `[DOC]` `[S20]` |
| Comportamento exato de `Reference Line` com perfil complexo (nichos, reentrâncias) | `[?]` | A frase do AC20 cobre "slanted or complex", mas não detalha perfil complexo |
| Zona em Design Options e Renovation | `[SEC]` apenas (relato 2026, sem solução) | Não há página oficial sobre interação Zone × Design Options |
| Existe legenda/key nativa de categorias de zona | Provável **não** | Não achei recurso; ausência consistente em 4 páginas oficiais |
| `Core` como método de cálculo | **Não** | Ausente de todas as páginas de Zone e dos parâmetros GDL; é conceito Revit |
| Numeração automática documentada | `[SEC]` | Só relatos de fórum; nenhuma página oficial descreve o incremento |
| Performance quantificada | `[SEC]` | Só relatos ("big time", "extremely slow"), sem números |

---

## 11. Fontes

Todas lidas nesta sessão, salvo indicação.

| ID | URL | O que foi usado |
|---|---|---|
| S1 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-137.html | Criar zonas: automático (Inner Edge/Reference Line), manual, label automático, excluir parede, fechar circuito |
| S2 | https://help.graphisoft.com/AC/20/INT/AC20Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-119.htm | `[DOC-]` Colunas não fecham; parede inclinada/complexa usa borda interna no modo Reference Line; ponto de referência |
| S3 | https://help.graphisoft.com/AC/30/INT/Topics/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-8.html | **Zone Tool Settings completo**: Name/Positioning, Floor Plan, Zone Stamp, Custom Settings, Model, Area Calculation |
| S4 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-139.html | Zone Categories: atributo, cor, carimbo, New/Rename/Delete, preview |
| S5 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-140.html | Planta: cor da categoria, cover fill, Graphic Overrides, dois polígonos com parede inclinada |
| S6 | https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-151.htm | `[DOC-]` Corte/elevação/3D Document: tabela cut/uncut, transmittance 50, checkbox Legacy |
| S7 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-142.html | Zone Stamps: GDL paramétrico, Show Zone Stamp (MVO), Move Sub-Element, ponto de referência |
| S8 | https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-153.htm | `[DOC-]` 3D: filtro `Filter and Cut Elements in 3D`, layer combo "Show 3D Zones as Solid" |
| S9 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-144.html | `Design → Roof Extras → Crop Zone`, `Undo All Crops`, opção de desfazer crop no update |
| S10 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-145.html | Cálculo depende de Relation to Zones + Zones Preferences + Area Calculation panel |
| S11 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-146.html | **Relation to Zones**: 4 valores, pilar inclinado, line-type como Zone Boundary, tabela 100 m² |
| S12 | https://help.graphisoft.com/AC/25/INT/_AC25_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-28.htm | `[DOC-]` Zones Preferences: recessos, mínimo/percentual, dois limites de forro baixo, "Project Preferences" |
| S13 | https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-147.html | Update Zones: diálogo, seleção, checkmark + delta, 3 ícones de problema |
| S14 | https://help.graphisoft.com/AC/25/INT/_AC25_Help/040_ElementsVB/040_ElementsVB-147.htm | Versão AC25 de "Creating Zones" (confirmação cruzada) |
| S15 | https://gdl.graphisoft.com/reference-guide/room-parameters | **Room Parameters**: `ROOM_AREA`, `ROOM_NET_AREA`, `ROOM_REDUCED_AREA`, `ROOM_AREA_FACTOR`, `ROOM_CALC_AREA`, `ROOM_POLY_STATUS` (0/1/2) etc. |
| S16 | https://graphisoft.github.io/archicad-api-devkit/struct_a_p_i___zone_type.html | **API_ZoneType**: `poly`, `refPoly`, `refPos`, `manual`, `refLineFlag`, `show_found_poly`, `reducePercent`, `roomFlThick`, `catInd`, `libInd`, `stampAngle` |
| S17 | https://graphisoft.github.io/archicad-api-devkit/struct_a_p_i___zone_all_quantity.html | `API_ZoneAllQuantity`: area, netarea, calcArea, reducementArea, reducedExtrArea, volume, etc. |
| S18 | https://help.graphisoft.com/AC/30/INT/Topics/121_IFC/121_IFC-42.html | IFC Data Conversion: Zone Categories → Classification Reference, Base Quantities, Space Boundaries, Space Containment |
| S19 | https://help.graphisoft.com/AC/30/INT/Topics/121_IFC/121_IFC-48.html | IFC Data Types: IfcSpace, IfcZone, IfcSpatialZone, hierarquia |
| S20 | https://help.graphisoft.com/AC/30/INT/Topics/005_NewFeatures/ifc_improvements.html | AC30: export para `ifcSpatialZone` via Type Mapping |
| S21 | https://help.graphisoft.com/AC/25/GER/_AC25_Help/930_ExtraTopics/930_ExtraTopics-1.htm | Add-on `Flächenberechnung`: DIN 277 (NRF/BGF/KGF/BRI), WoFlV, Morphs, listas no Navigator, XML |
| S22 | https://help.graphisoft.com/AC/27/INT/_AC27_Help/940_ExtraTopics_JPN/940_ExtraTopics_JPN-1.htm | `Check Area Conflicts`: overlaps/uncovered/gaps entre Zones e Fills, Issue Organizer |
| S23 | https://help.graphisoft.com/AC/30/INT/Topics/070_Documentation/070_Documentation-70.html | Labels: associativo × independente, múltiplos, "Hide with Associated Element", label na criação da zona |
| S24 | https://help.graphisoft.com/AC/30/INT/Topics/070_Documentation/070_Documentation-73.html | Symbol Labels: `Zone Label` = Zone Name, Number, Calculated Area |
| S25 | https://help.graphisoft.com/AC/25/INT/_AC25_Help/005_NewFeatures/005_NewFeatures-21.htm | `[DOC-]` Novidade AC25: Zone Label, múltiplos labels, carimbo desligado por padrão |
| S26 | https://help.graphisoft.com/AC/30/INT/Topics/055_InteractiveSchedule/055_InteractiveSchedule-7.html | Scheme Settings: criteria/fields, esquemas por tipo, import/export XML |
| S27 | https://help.graphisoft.com/AC/30/INT/Topics/055_InteractiveSchedule/055_InteractiveSchedule-9.html | Add Fields: lista pesquisável, General/Properties, Library Part Parameters |
| S28 | http://www.bimant.com/ifc/IFC4_3/RC1/HTML/schema/ifcproductextension/qset/qto_spacebasequantities.htm | `Qto_SpaceBaseQuantities` (espelho do schema buildingSMART): Gross/Net FloorArea, Perimeter, Volume, Wall/Ceiling Area, Height |
| S29 | https://archi-xt.com/posts/the-4-different-zone-stamp-areas-in-archicad | `[SEC]` As 4 áreas com exemplo numérico (9,23 → 8,77 m²) |
| S30 | https://community.graphisoft.com/t5/Project-data-BIM/Zone-Areas-and-Volumes/ta-p/336714 | `[SEC]` Inner Edge não tem gross; Reference Line pode não cobrir a gross normativa; cascata das áreas |
| S31 | https://community.graphisoft.com/t5/Documentation/Zone-Area-Calculation-Bug/td-p/383851 | `[SEC]` "standard and long-standing behavior"; wishlist de auto-update; split não recalcula |
| S31b | https://community.graphisoft.com/t5/Documentation/How-can-I-list-Zones-by-any-of-their-parameters-in-Schedules/td-p/682054 | `[SEC]` Parâmetros do carimbo (`stApartmentId`…) como criteria/field |
| S32 | https://community.graphisoft.com/t5/Wishlist/Performance-moving-walls-slow-due-to-visible-zones/idi-p/666261 | `[SEC]` (só trecho de busca; página retornou 403) parede longa com muitas zonas derruba performance |
| S32b | https://community.graphisoft.com/t5/Collaboration-with-other/Scheduling-Zones-calculation-extremely-slow/td-p/275094 | `[SEC]` schedule de zonas lento em prédio de 16 pavimentos |
| S33 | https://community.graphisoft.com/t5/Collaboration-with-other/Overlapping-Zones-Interior-Elevations-Gross-Areas-Fills-in/td-p/259305 | `[SEC]` "Never use overlapping zones"; usar fills |
| S34 | https://community.graphisoft.com/t5/Modeling/Mass-Renumber-of-Zone-Room-Numbers/td-p/193271 | `[SEC]` Não há renumeração; ID Manager não serve; workaround schedule |
| S35 | https://community.graphisoft.com/t5/General-discussions/Problem-with-Zones-automatic-update/td-p/689032 | `[SEC]` Zonas em Design Options não atualizam (AC29, 2026) |
| S36 | https://community.graphisoft.com/t5/Project-data-BIM/Global-Settings-Affecting-Zone-Data-and-Display/ta-p/303585 | `[SEC]` KB oficial: mapa de **todas** as configurações que afetam dados/exibição de zona |
| S37 | https://support.graphisoft.com/hc/en-us/articles/26897090358801 | `[SEC]` Zone Label × Zone Stamp: label é elemento separado; stamp morre com a layer |
| S38 | https://community.graphisoft.com/t5/Project-data-BIM/Moving-data/td-p/247995 | `[SEC]` O número incrementa ao colocar (e não ao copiar/colar) |
| S39 | https://community.graphisoft.com/t5/Documentation/Turning-off-Zone-Boundary/td-p/606636 | `[SEC]` Como "esconder" a borda: layer, MVO `Show Zone Stamp`, label em layer própria |
| S40 | https://www.youtube.com/watch?v=Ew6KFMQb0UE | `[SEC]` Zone List oficial (training series): campos, subtotal por story, soma, renomear colunas |
| S41 | https://community.graphisoft.com/t5/Collaboration-with-other/Total-Area-of-Zone-Category/td-p/204546 | `[SEC]` `Merge Uniform Items` ignora as áreas como critério de diferença |
| S42 | https://help.graphisoft.com/AC/26/INT/_AC26_Help/050_ViewsVB/050_ViewsVB-89.htm | `[DOC-]` Interactive Schedule: bidirecional, viewpoint, "Save from Schedule Window", copy/paste perde associação |
| S43 | https://community.graphisoft.com/t5/Collaboration-with-other/Export-Components-or-Surfaces-Schedules-to-Excel/td-p/260696 | `[SEC]` Export `.xls` de schedules via Interoperability |
| S44 | https://community.graphisoft.com/t5/Modeling/zone-areas-off-by-1-2-in-plan/td-p/98043 | `[SEC]` `Reduce by` = 50% deixando todas as áreas pela metade |
| S45 | https://community.graphisoft.com/t5/Documentation/autotext-labels-disassociating/td-p/271118 | `[SEC]` Label de zona depende da layer da zona; labels desassociam |

---

### Apêndice A — Onde cada coisa está no menu (cola rápida)

```
Toolbox → Design → Zone
Info Box → método (Manual | Inner Edge | Reference Line) + [Place Label]
Ctrl+T (Settings) → Name and Positioning | Floor Plan | Zone Stamp | Custom Settings | Model | Area Calculation
Options → Element Attributes → Zone Categories        (cor + carimbo + código)
Options → Element Attributes → Fills                   (quais fills podem ser cover fill de zona)
Options → Element Attributes → Surfaces                (transmittance da zona em corte/3D)
Options → Project Preferences → Zones                  (recessos, mínimo/%, forro baixo)
Options → Project Preferences → Dimensions             (unidade de área do carimbo)
Options → Project Preferences → Reference Levels        (cota da base)
Options → Project Preferences → Legacy                  (comportamento de corte pré-AC25)
Design → Update Zones                                   (o comando mais importante da ferramenta)
Design → Roof Extras → Crop Zone / Undo All Crops
Document → Model View → Model View Options → Show Zone Stamp
View → Elements in 3D View → Filter and Cut Elements in 3D → Zone
Document → Schedules → Scheme Settings                   (criteria + fields)
```

### Apêndice B — O modelo de dados, em uma tabela

| Campo (`API_ZoneType`) | Tipo | Papel |
|---|---|---|
| `poly` | `API_Polygon` | **Polígono da zona** (o que é desenhado/editado/medido) |
| `refPoly` | `API_Polygon` | **"The found polygon"** — o resultado da varredura nas paredes |
| `refPos` | `API_Coord` | Ponto de referência (`+`) de onde a varredura parte; vazio se manual |
| `manual` | `bool` | Zona manual: todas as arestas estáticas, **sem** ponto de referência |
| `refLineFlag` | `bool` | Delimitada por **linhas de referência** das paredes, não pelas faces |
| `show_found_poly` | `bool` | `true` = usa a linha de referência no cálculo; `false` = face interna (só vale se `refLineFlag`) |
| `reducePercent` | `double` | O **`Reduce by`** em % |
| `roomName`, `roomNoStr` | string | Nome e número |
| `roomBaseLev`, `roomHeight`, `roomTopOffset`, `roomFlThick` | double | Cota da base, altura, offset de topo, **subfloor thickness** |
| `catInd` | atributo | Índice da **categoria** de zona |
| `libInd` | int | Índice do **library part** (carimbo) |
| `stampAngle`, `fixedAngle`, `stampGuid` | — | Rotação e vínculo do carimbo |
| `useContourLine`, `floorContLPen`, `floorContLType` | — | Contorno (`Zone Fill Outline`) |
| `useFloorFill`, `floorFillInd`, `floorFillPen`, `floorFillBGPen` | — | Cover fill de planta |
| `material`, `oneMat` | — | Superfície 3D / herdar das paredes |
| `pen`, `useStampPens` | — | Caneta única do carimbo (`Uniform Stamp Pen`) |
| `linkToSettings`, `relativeTopStory` | — | Top link (`Home+N` / `Not linked`) |

Fonte: `[S16]`. A leitura desse struct é o argumento mais forte de que **o ArchiCAD grava o polígono** (e um segundo polígono "encontrado"), enquanto o Hestia grava só o ponto — decisões opostas, ambas defensáveis, com consequências opostas em atualização × congelamento.
