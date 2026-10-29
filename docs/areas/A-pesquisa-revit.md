# A-pesquisa-revit.md — Como o Revit realmente funciona em Ambientes / Áreas

> **Documento de pesquisa técnica** para o produto Hestia (BIM web em TypeScript).
> Data da pesquisa: **29/10/2026**. Fontes oficiais Autodesk consultadas em `help.autodesk.com`
> (builds 2022–2026 do Cloud Help), `autodesk.com/support` e documentação da Revit API.
> Fóruns usados apenas como fonte secundária.

## Legenda de confiança

| Marca | Significado |
|---|---|
| **[DOC]** | Afirmação lida diretamente em página oficial da Autodesk (help.autodesk.com, autodesk.com/support ou Revit API Reference). URL listada ao fim da seção. |
| **[SEC]** | Fonte secundária (fórum Autodesk, AUGI, RevitForum, blog de revenda/treinamento) ou inferência a partir de comportamento documentado. |
| **[?]** | Não confirmado nesta pesquisa. Tratar como hipótese. |
| **[H]** | Comportamento do Hestia conforme o briefing do produto (não é fonte externa). |

**Aviso de método:** nenhuma página bloqueou acesso. Todas as citações `[DOC]` abaixo foram
obtidas por leitura direta da página, não por snippet de busca.

---

## 0. Resumo executivo (leia isto primeiro)

Cinco fatos do Revit que mais afetam o desenho do Hestia:

1. **O Room do Revit não é derivado só de paredes.** A área é medida no *computation height*
   (altura de corte, propriedade do **nível**, padrão 0 mm) contra um conjunto de elementos
   *room-bounding* que inclui paredes, **pisos, lajes, forros, telhados, pilares, curtain systems,
   building pads e room separation lines**. O volume é um sólido 3D fechado (`ClosedShell` na API).
   Ou seja: o Revit resolve o ambiente em **3D**, o Hestia resolve em **2D (circuito de paredes)**. `[DOC]`
2. **A área é sempre "net"** — o texto oficial diz literalmente *"The net area computed from the
   room-bounding elements"*. Não existe um toggle "Gross/Net" no diálogo de computations.
   "Gross" no Revit é outra coisa: o **area scheme "Gross Building"**, das Area Plans. `[DOC]`
3. **O volume é sempre calculado até a face de acabamento**, independentemente da opção
   *Room Area Computation* escolhida. Isso é uma assimetria deliberada e documentada. `[DOC]`
4. **Room não aparece em vista 3D.** A Autodesk responde explicitamente: *"Rooms in Revit are not
   displayed in 3D views... this corresponds to the current product design of Revit."* O Room é um
   volume lógico, não um sólido visível em 3D. `[DOC]`
5. **A etiqueta é um elemento separado e é isso que a torna útil.** `Room` é modelo; `Room Tag` é
   anotação. Apagar a etiqueta não apaga o ambiente; apagar o ambiente apaga a etiqueta. A etiqueta
   pode ficar **fora** do ambiente (com warning). `[DOC]`

E uma divergência de produto que vale registrar: **o Revit só avisa sobre número duplicado, mas
permite continuar** (*"Revit warns you if the number is already used but allows you to continue"*),
enquanto o Hestia **bloqueia**. `[DOC]`

---

## 1. Fluxo de criação: a ferramenta Room

### 1.1 Onde fica e o que exige

| Item | Revit | Confiança |
|---|---|---|
| Caminho | **Architecture** tab → painel **Room & Area** → **Room** | [DOC] |
| Atalho de teclado | **RM** (`ID_OBJECTS_ROOM`) | [DOC] |
| Atalho da etiqueta | **RT** — "Tag Room; Room Tag" | [DOC] |
| Onde pode ser colocado | *"You can place rooms only in plan views."* (só vista de planta) | [DOC] |
| Exige circuito fechado? | **Não para criar.** Pode colocar em espaço livre e fechar depois: *"You can also place a room in a free space or one that is not entirely bounded, and then draw room-bounding elements around the room later."* Fechar é exigência para **calcular**, não para **criar**. | [DOC] |
| Limite mínimo | *"Revit will not place a room in a space that is less than 1' or 306 mm wide."* | [DOC] |

### 1.2 Barra de opções (Options Bar) da ferramenta Room

Itens exatos, na ordem documentada: `[DOC]`

1. **Upper Limit** — o nível a partir do qual se mede o limite superior do ambiente.
2. **Offset** — distância, medida a partir do Upper Limit, onde o limite superior ocorre.
   Positivo sobe, negativo desce. **Padrão: 10' (4000 mm).**
3. **Orientação da etiqueta** (horizontal / vertical / model — ver §5).
4. **Leader** — inclui linha de chamada na etiqueta.
5. **Room** — `New` (cria ambiente novo) ou escolher um ambiente **existente** na lista
   (é assim que se reposiciona um "unplaced room" — §9).

Fora da barra de opções, na faixa contextual **Modify | Place Room**:

- **Tag panel → Tag on Placement** — liga/desliga a criação automática da etiqueta junto com o ambiente. `[DOC]`
- **Room panel → Highlight Boundaries** — destaca **em dourado** todos os elementos room-bounding e
  abre um diálogo de aviso; **Expand** lista todos os elementos do modelo (inclusive os que não
  aparecem na vista); **Close** encerra. `[DOC]`
- **Room panel → Place Rooms Automatically** — criação em lote (§1.5).

### 1.3 Comportamento de clique

O fluxo documentado é **clique único**, não arraste de retângulo: `[DOC]`

> "Click in the drawing area to place the room." … "If you place a room inside bounding elements,
> **it expands to the element boundaries**."

Ou seja: o Revit **não pré-visualiza** contorno nem área antes do clique. Você clica, o ambiente é
criado e *depois* ele "infla" até as bordas. A ferramenta permanece ativa para colocar vários
ambientes em sequência (um ambiente por clique), até `Esc`.

Não há, na documentação, menção a "arrastar para definir o contorno" nem a pré-visualização com
área. Isso é uma **diferença real de UX** a favor do Hestia. `[DOC]` para o fluxo; `[?]` para a
afirmação de que não existe nenhum modo de pré-visualização (ausência de evidência).

### 1.4 Avisos e erros

| Aviso (texto real) | Quando | Confiança |
|---|---|---|
| **"Room is not in a properly enclosed region"** | Ponto fora de circuito fechado. Também aparece com massas in-place marcadas como room-bounding, ou com *computation height* / *view range* inadequados. | [DOC] |
| **"Multiple Rooms are in the same enclosed region. The correct area and perimeter will be assigned to one Room and the others will display 'Redundant Room.' You should separate the regions, delete the extra Rooms, or move them into different regions."** | Dois Rooms no mesmo circuito. O segundo vira **"Redundant Room"**. | [DOC] |
| **"Room Tag Is Outside of Its Room"** | Etiqueta arrastada para fora do contorno. | [DOC] (listado no índice de avisos de Rooms) |
| **"Room Volume Is Not Computed"** | Volume desligado. | [DOC] |
| **"Room's Lower Offset Is Above the Computation Height"** | Base offset acima do plano de corte. | [DOC] |

Os textos acima também existem como `BuiltInFailures.RoomFailures.RoomNotEnclosedRooms` e
`RoomsInSameRegionRooms` na API — confirmação de que são mensagens de primeira classe do produto. `[DOC]`

**Diagnóstico oficial do "not enclosed"** (artigo de suporte Autodesk): causas típicas são
`Computation Height` ou `View Range` que não cortam os elementos delimitadores; **In-Place Mass**
(por exemplo topographic solids) marcada como room-bounding; elementos **Generic Model in-place**,
que **não** são room-bounding por natureza; e bounding walls que estão em **design options**. `[DOC]`

### 1.5 "Criar em todos os circuitos fechados" → Place Rooms Automatically

O equivalente nativo existe, com regras próprias: `[DOC]`

- Cria ambientes em **todas as áreas fechadas e delimitadas do nível atual**.
- Critério mínimo: **áreas maiores que 0,25 sq ft** (≈ 0,023 m²).
- Usa os parâmetros da **Options Bar** no momento da execução.
- Os ambientes são nomeados **numericamente**.
- Ao final, um diálogo informa **quantos** ambientes foram criados.

Diferenças relevantes vs. o botão do Hestia: o Revit limita ao **nível corrente** (não ao modelo
inteiro), não mostra pré-visualização e não deixa escolher quais circuitos.

### Fontes da seção 1

- **Create a Room** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-B3420A54-A9BC-4AEE-A07C-CD7A9DC782FB.htm
  → passos, Tag on Placement, Options Bar (Upper Limit, Offset 10'/4000 mm, orientação, Leader, Room), Highlight Boundaries em dourado, limite de 306 mm, "expands to the element boundaries".
- **Place Rooms Automatically** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-D94E11E7-0956-4B5B-B50F-6BB28AD09F15.htm
  → "all closed and bounded areas on the current level", "> 0.25 sq. ft.", "named numerically".
- **About Rooms** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-DD74A51D-A0B0-4461-A4BA-0F9CCC191CDB.htm
  → "You can place rooms only in plan views"; dimensões atualizam automaticamente ao mover paredes.
- **Revit Keyboard Shortcuts (Autodesk)** — https://www.autodesk.com/shortcuts/revit
  → `RM` = ROOM "Creates a room bounded by model elements and separation lines"; `RT` = TAG ROOM.
- **BuiltInFailures.RoomFailures** — https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/7bece7b1-6ad8-1153-a15a-5b16feabe08b.htm
  → textos literais "is not in a properly enclosed region" e "Multiple [Room] are in the same enclosed region…".
- **Autodesk Support: "Room is not in a properly enclosed region" when trying to place rooms** — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Warning-Room-is-not-in-a-properly-enclosed-region-when-trying-to-place-rooms-in-Revit.html
  → causa: In-Place Mass com room bounding; solução: desmarcar Room Bounding.
- **Autodesk Support: Can't create rooms / incorrect spaces within bounded area** — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Revit-Can-t-create-rooms-within-bounded-area.html
  → causas: Computation Height, View Range, massas in-place, elementos cobrindo a área.

---

## 2. O que delimita um ambiente

### 2.1 Lista oficial de elementos room-bounding por padrão

> "By default, the following elements are room-bounding: **Walls** (curtain, standard, in-place,
> face-based); **Roofs** (standard, in-place, face-based); **Floors** (standard, in-place,
> face-based); **Ceilings** (standard, in-place, face-based); **Columns** (architectural,
> structural with material set to concrete); **Curtain systems**; **Room separation lines**;
> **Building pads**." `[DOC]`

Observações importantes embutidas nessa lista:

- **Pilar estrutural só é room-bounding se o material for concreto.** Pilar de aço não entra por
  padrão. `[DOC]`
- **Telhado e forro contam** — não só paredes. `[DOC]`
- **Building pad** (a laje de terreno/site) conta como delimitador horizontal. `[DOC]`

### 2.2 A propriedade que liga/desliga: **Room Bounding**

- Fica no **Properties palette → grupo Constraints → checkbox "Room Bounding"**. `[DOC]`
- Efeito é **duplo**: o elemento deixa de valer para *este* ambiente **e para os ambientes
  adjacentes que compartilham o elemento**. `[DOC]`
  > "When you specify that an element is non-bounding, the element is not used when Revit computes
  > the area or volume of the room **or any adjacent rooms that share the non-bounding element**."
- É **global por elemento**, não por ambiente. Não existe "esta parede delimita o ambiente A mas
  não o B". `[DOC]` (por definição da propriedade) — e é justamente o pedido de diversas Ideas: `[SEC]`
  > Idea "Room Bounding Options" pede poder desmarcar categorias (ex.: Columns) **para um room
  > específico**, e reclama que "Right click onto a room and choose *select bounding elements*…
  > Sadly there is no such function in R24 yet."

### 2.3 Exemplo canônico de exceção

Divisórias de banheiro (toilet partitions) são o exemplo dado pela própria Autodesk de elemento que
o usuário deve **desmarcar** como room-bounding, porque não costumam entrar no cálculo. `[DOC]`

### 2.4 Room Separation Lines

- São **room-bounding por definição** e servem para subdividir espaço **sem parede**. Exemplo
  oficial: uma **área de jantar dentro de uma sala de estar**. `[DOC]`
- São **visíveis em planta e em 3D**. `[DOC]`
- **Uso crítico — vãos:** *"If you add openings to those walls and still want to maintain separate
  room area computations, you must sketch room separation lines through the openings."* `[DOC]`
  - Nota de vocabulário: em Revit, **"opening"** é a ferramenta *Opening* (Wall Opening, Opening by
    Face, Shaft Opening), que **corta** a parede. Portas e janelas são famílias **hospedadas** na
    parede — a parede continua sendo um delimitador contínuo. Portanto a regra "vão de porta conta
    como parede" do Hestia está alinhada com o Revit **para portas/janelas**, mas **não** para
    aberturas de parede puras. `[DOC]` para o texto sobre openings; `[SEC]` para a distinção
    porta/janela vs. Opening.
- Na API, essas linhas pertencem à categoria `OST_AreaSeparationLines` e uma linha isolada é
  **ignorada**; paredes unidas por model lines são tratadas como segmentos contínuos. `[DOC]`

### 2.5 Ilhas dentro do ambiente (furos)

O Revit suporta **múltiplos loops** de contorno no mesmo ambiente. A API devolve
`Room.GetBoundarySegments()` como uma **lista de listas**, e os exemplos oficiais mostram Rooms com
tamanho 2 e 3 — exatamente o caso de ilha de parede/pilar dentro do circuito. `[DOC]`

```text
Room 1, 2, 3 -> GetBoundarySegments().Size = 1
Room 4       -> 2
Room 5, 6    -> 3
```

Isso valida a decisão do Hestia de tratar ilhas como furos. `[DOC]`

### 2.6 Modelos vinculados (links) e IFC

- **Por padrão o Revit NÃO reconhece** elementos room-bounding de um modelo vinculado. É preciso
  ligar o parâmetro **Room Bounding do link** para o modelo hospedeiro passar a considerá-los. `[DOC]`
- Se o link for **descarregado**, os ambientes do hospedeiro **perdem** o fechamento. `[DOC]`
- **Links aninhados**: um elemento de link aninhado é room-bounding quando o Room Bounding está
  ligado **no link aninhado E no link pai**. `[DOC]`
- **IFC:** *"You can also use many elements in linked IFC files as room boundaries."* `[DOC]`
- **Pegadinha do IFC:** as opções de *Room Area Computation* **não afetam paredes vindas de IFC** —
  paredes de arquivos IFC vinculados **usam sempre a face de acabamento** como limite. `[DOC]`

### 2.7 Elementos que NÃO são room-bounding (e por quê)

| Elemento | Status | Confiança |
|---|---|---|
| Generic Model in-place | **Não** é room-bounding; é a causa nº 1 documentada de "not enclosed" | [DOC] |
| In-Place Mass | Só se marcada manualmente; se marcada, pode **bloquear** a criação de rooms | [DOC] |
| Pilar estrutural de aço | Não, por padrão (só concreto) | [DOC] |
| Divisórias de banheiro / mobiliário | Não, por padrão; e o usuário deve mantê-las assim | [DOC] |
| Ruled curtain system (fachada) | **Não é wall** — em Area Plans a Autodesk manda desenhar o boundary manualmente | [DOC] |
| Elementos fora da fase ativa | Ignorados | [DOC] |
| Elementos em workset fechado | Deixam de delimitar na prática | [SEC] |

### Fontes da seção 2

- **About Room-Bounding Elements** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-241430FC-8084-43A1-AA3A-681B2883B0FC.htm
  → lista completa dos 8 tipos default; efeito sobre ambientes adjacentes; partitions; IFC.
- **About Room Separation Lines** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-6B8BDC71-D0A4-4ABA-8561-34F7AD6BAB55.htm
  → "dining area within a living room"; visíveis em planta e 3D; separation lines através de openings.
- **Make an Element Room Bounding** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-65968961-7D56-4D17-8F92-565D2C7CCB2D.htm
  → "Properties palette, under Constraints, select Room Bounding".
- **About Room-Bounding Elements in Linked Models / Using Room Boundaries in a Linked Model** — https://help.autodesk.com/BDS/2013/ENU/caas.html (Room Boundaries in Linked Models, GUID-76F60AC2-35AE-4FE8-8FA2-A7544EB7E75A)
  → link não reconhecido por padrão; unload quebra; aninhamento exige os dois parâmetros.
- **Revit API — Rooms (Developer's Guide)** — https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Discipline_Specific_Functionality/Architecture/Revit_API_Revit_API_Developers_Guide_Discipline_Specific_Functionality_Architecture_Rooms_html.html
  → `GetBoundarySegments()` retorna lista de listas; tabela com Size 1/2/3 para ilhas; `OST_AreaSeparationLines`; linha isolada ignorada.
- **Idea: Room Bounding Options** — https://forums.autodesk.com/t5/revit-ideas/room-bounding-options/idi-p/14004846
  → pedido de controle de bounding **por room** (ex.: desmarcar Columns só para um room); ausência de "select bounding elements".

---

## 3. Cálculo de área: o diálogo "Area and Volume Computations"

### 3.1 Onde fica

**Architecture** tab → painel **Room & Area** → **drop-down** → **Area and Volume Computations**.
(Comando `ID_SETTING_AREACALCULATIONS`.) `[DOC]`

O diálogo tem **duas abas**: **Computations** e **Area Schemes**. `[DOC]`

### 3.2 Aba Computations — Room Area Computation (4 opções exatas)

| Opção (nome exato) | Onde fica o limite | Confiança |
|---|---|---|
| **At wall finish** *(padrão)* | Na **face de acabamento interna** do ambiente | [DOC] |
| **At wall center** | Na **linha de eixo** da parede | [DOC] |
| **At wall core layer** | Na camada do **core** (núcleo estrutural) mais próxima do ambiente — "the interior or exterior layer of the core closest to the room" | [DOC] |
| **At wall core center** | Na **linha de eixo do core** | [DOC] |

Regras críticas:

- **É global do projeto.** *"You cannot change boundary locations separately for each room. All
  rooms in the project use the new boundary location."* `[DOC]`
- **Não afeta paredes IFC** — IFC sempre usa face de acabamento. `[DOC]`
- **At wall core layer** é a opção mais mal-entendida: ela ignora acabamentos e usa a **primeira
  camada do core** (o "núcleo" definido no compound wall), aproximando a área "estrutural". `[DOC]`

### 3.3 Aba Computations — Volume Computations

- Checkbox **"Areas and Volumes"** (ligado/desligado). `[DOC]`
- **Desligado por padrão**, por performance:
  > "Because volume computation may affect Revit performance, it is turned off by default. Turn it
  > on only when you want to prepare and print schedules or other views that report room volumes." `[DOC]`
- Com volume desligado, a propriedade **Volume** exibe **"Not Computed"**. `[DOC]`
- Na API, `Room.Volume` retorna **0** se a computação estiver desligada. `[DOC]`

**Assimetria documentada e muito relevante:**

> "Note: **Room volumes are computed to the wall finish, regardless of the Room Area Computation
> setting.**" `[DOC]`

Ou seja: você pode medir área no eixo da parede e ainda assim o volume irá até o acabamento. Área
e volume podem ser **geometricamente inconsistentes** por decisão de projeto do Revit.

### 3.4 Gross vs Net

**Não existe toggle "Gross/Net" no diálogo.** A distinção acontece em outro lugar:

| Conceito | Como o Revit implementa | Confiança |
|---|---|---|
| **Net (área do ambiente)** | `Area` do Room = *"the net area computed from the room-bounding elements"* | [DOC] |
| **Gross (área construída)** | **Area Plan** com scheme **Gross Building**: *"any area inside the outer face of the building's exterior walls"* | [DOC] |
| **Rentable** | **Area Plan** com scheme **Rentable**: *"Area measurements based on the standard method for measuring floor area in office buildings"* | [DOC] |

Portanto: **Gross/Net no Revit é uma escolha de *ferramenta*, não de parâmetro.** Isso é a chave
para a seção 8.

### 3.5 Computation Height

Definição oficial: `[DOC]`

- É a distância acima da **base level** do ambiente onde o Revit **mede o perímetro**.
- **Padrão: 0' ou 0 mm** acima da base.
- Serve para calcular **perímetro, área e volume**.
- É **propriedade da instância do nível** (Level), **não do ambiente**. Um `Computation Height`
  por nível afeta **todos** os ambientes daquele nível.
- Para paredes verticais o padrão funciona; para **paredes inclinadas** é preciso ajustar.
- **Aviso de performance:** *"Changing the computation height can affect the performance of Revit."* `[DOC]`

Como o usuário vê: ao selecionar o ambiente, aparece uma **linha pontilhada** na seção indicando o
plano de corte. `[DOC]`

O exemplo de 1,20 m citado no briefing é o caso clássico de **peitoril/guard-corpo**: em ambientes
com paredes que só existem até certa altura (ou com paredes inclinadas), cortar em 1,20 m captura
o contorno real do piso em vez de um contorno "aberto" no nível 0. `[SEC]` — a doc não prescreve
1,20 m; apenas explica que o valor deve ser ajustado quando há geometria atípica. `[DOC]` para o mecanismo.

**Efeito colateral documentado:** se o *Base Offset* do ambiente estiver **acima** do computation
height, o Revit emite o aviso **"Room's Lower Offset Is Above the Computation Height"**. `[DOC]`

### 3.6 Unbounded Height — o que é, exatamente

Definição literal: `[DOC]`

> "**Unbounded height**: The largest potential height of the room, based on the room height
> parameters: **Level, Upper Limit, Limit Offset, and Base Offset**. This value is read-only.
> (The room's **actual** height may be changed by room-bounding elements, such as intervening
> floors and roofs.)"

Traduzindo para engenharia:

```
UnboundedHeight = (UpperLimit.elevation + LimitOffset) − (Level.elevation + BaseOffset)
```

É o **envelope teórico** declarado pelos parâmetros. O **volume real** é esse envelope **cortado**
por lajes/forros/telhados que o interceptam. Por isso a propriedade se chama *Unbounded*: é o
"máximo possível", não o real.

Consequência prática: um ambiente de pé-direito 3,00 m com `Upper Limit = Nível 2` e um forro a
2,70 m terá `UnboundedHeight = 3,00 m` (ou o que os parâmetros disserem) mas `Volume` calculado até
o forro. `[DOC]`

### 3.7 Como o volume é calculado (passo a passo oficial)

> "When it computes room volumes, Revit does the following: **Determines the room area** …
> **Determines the room height** … **Uses the room area and the room height to compute the room
> volume**." `[DOC]`

Nota: a fórmula é `área × altura`, não uma integração de sólido qualquer. Em geometria complexa
isso gera os desvios descritos em §3.8.

### 3.8 Situações que distorcem o volume (documentadas)

1. **Elemento room-bounding que não chega ao teto** (parede parcial, pilar arquitetônico): o
   espaço **acima** do elemento **não entra** no volume. Solução oficial: **desmarcar Room Bounding**. `[DOC]`
2. **Paredes inclinadas + computation height**: partes do ambiente podem ser omitidas. `[DOC]`

### 3.9 Verdade incômoda sobre "área livre"

Fórum (AUGI): como as paredes são unidas (join), o Revit permite a **sobreposição** de paredes
adjacentes ao calcular volumes individuais, o que faz a soma dos volumes dos ambientes não
"fechar" com o volume do edifício. `[SEC]`

### Fontes da seção 3

- **Room Area and Volume** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-22B6D041-F6D8-4DB0-8094-B325CC3CC6B4.htm
  → caminho do diálogo (Architecture > Room & Area drop-down); índice das subtemas.
- **Change the Room Area Boundary Location** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-0BB62832-36DD-4E06-A9D4-EE98CE0FCF89.htm
  → as 4 opções com definição literal; "cannot change boundary locations separately for each room"; "These settings do not affect IFC-based walls".
- **About the Computation Height for Rooms** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-9D33F884-4BCA-4772-B3E5-1E15A53DEE6E.htm
  → default 0'/0 mm; "defined as a property of a level instance"; linha pontilhada ao selecionar; aviso de performance.
- **Room Instance Properties** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-21326970-0037-41C6-A996-980C24EE019F.htm
  → "Area: The net area computed from the room-bounding elements"; definição literal de Unbounded height; Volume read-only.
- **How Room Volume is Computed** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-06B6BB18-C968-4A7E-9147-65C294288F64.htm
  → "volumes are computed to the wall finish, regardless of the Room Area Computation setting"; 3 passos.
- **Enable Room Volume Computations** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-84D8BC77-AAF3-4F45-B77E-58E35858D3AA.htm
  → "Computations tab … under Volume Computations, select Areas and Volumes".
- **Situations That Can Affect Room Volume Computations** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-052DFFB9-5076-4CE6-BC8B-420C8D03ACF0.htm
  → elemento que não chega ao teto omite o volume acima; solução = desmarcar Room Bounding.
- **AUGI — "Revit doesn't calculate the real free area in a room?"** — https://forums.augi.com/showthread.php?10242-Revit-doesn-t-calculate-the-real-free-area-in-a-room
  → sobreposição de paredes unidas distorce a soma de volumes. **[SEC]**

---

## 4. Propriedades do Room

### 4.1 Lista completa (Properties palette), com grupo e editabilidade

| Grupo | Parâmetro | Editável? | Nota | Conf. |
|---|---|---|---|---|
| **Constraints** | **Level** | **Somente leitura** | "The base level on which the room resides. A read-only value." | [DOC] |
| | **Upper Limit** | Sim | Nível de referência do limite superior | [DOC] |
| | **Limit Offset** | Sim | Distância a partir do Upper Limit. **Padrão 10' (4000 mm)** | [DOC] |
| | **Base Offset** | Sim | Distância a partir do Level. **Padrão 0** | [DOC] |
| **Dimensions** | **Area** | **Somente leitura** | "net area computed from the room-bounding elements" | [DOC] |
| | **Perimeter** | **Somente leitura** | Perímetro medido no computation height | [DOC] |
| | **Unbounded Height** | **Somente leitura** | Máximo teórico (§3.6) | [DOC] |
| | **Volume** | **Somente leitura** | Só preenchido com volume computation ligado | [DOC] |
| **Identity Data** | **Number** | Sim | *"must be unique"*, mas **o Revit só avisa e permite continuar** | [DOC] |
| | **Name** | Sim | Ex.: "Conference Room", "Kitchen" | [DOC] |
| | **Comments** | Sim | Texto livre | [DOC] |
| | **Occupancy** | Sim | Ex.: Retail | [DOC] |
| | **Department** | Sim | Departamento | [DOC] |
| | **Base Finish** | Sim | Acabamento do piso/base | [DOC] |
| | **Ceiling Finish** | Sim | Acabamento do forro | [DOC] |
| | **Wall Finish** | Sim | Acabamento de parede | [DOC] |
| | **Floor Finish** | Sim | Acabamento de piso | [DOC] |
| | **Occupant** | Sim | Pessoa/grupo/organização | [DOC] |
| **Phasing** | **Phase** | **Somente leitura** | "A read-only value **based on view properties**" | [DOC] |

Além desses, o Room herda de `Element`/`SpatialElement` (visíveis conforme template): `Image`,
`Mark`, parâmetros compartilhados de projeto, `Workset` (quando worksharing ativo), `Design Option`,
`Edited by`, e os campos de IFC quando exportado. `[DOC]` (API `Room` : `SpatialElement` : `Element`)

**Não existe parâmetro "Room Bounding" no Room.** `Room Bounding` é propriedade dos **elementos
delimitadores** (paredes, lajes etc.), não do ambiente. O briefing lista "Room Bounding?" — a
resposta é: **não, isso não é parâmetro do Room**. `[DOC]`

**Não existe parâmetro "Cor" no Room.** Cor vem de **Color Scheme**, que é propriedade **da vista**. `[DOC]`

### 4.2 Por que Area/Perimeter/Volume/UnboundedHeight/Level/Phase são somente leitura

Porque são **resultados**, não entradas. A cadeia causal é:

```
geometria dos elementos room-bounding  +  computation height (nível)  +  parâmetros de altura
                                   ↓
                        Area / Perimeter / Volume
```

Se fossem editáveis, o modelo ficaria internamente inconsistente (um número que não corresponde a
nenhuma geometria). A API reforça isso: no `Room`/`SpatialElement` **não há setter** para `Area`,
`Perimeter`, `Volume`, `UnboundedHeight` — só getters. `[DOC]`

> "Rooms have these **read-only** dimension properties: Area, Perimeter, UnboundedHeight, Volume,
> ClosedShell." `[DOC]`

`Level` é read-only porque é consequência de **onde você clicou** (o nível da vista). Para mudar de
nível, você move o ambiente. `Phase` é read-only porque vem da **vista** em que foi criado. `[DOC]`

### 4.3 `ClosedShell` — o "volume 3D" que o Hestia não tem

`Room.ClosedShell` é a **geometria sólida fechada** formada pelas fronteiras do espaço (paredes,
pisos, forros, telhados, boundary lines). Serve, por exemplo, para testar interseção com elementos
físicos. `[DOC]`

Isso prova que **o Room do Revit é, internamente, um volume 3D** — mesmo que não se desenhe em 3D
(§6). É o principal *gap* conceitual do Hestia: um circuito de paredes 2D não gera esse sólido.

### Fontes da seção 4

- **Room Instance Properties** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-21326970-0037-41C6-A996-980C24EE019F.htm
  → tabela completa (Constraints / Dimensions / Identity Data / Phasing); textos "read-only value"; Number único com aviso mas permissivo; Phase read-only baseado na vista.
- **Revit API — Rooms (Developer's Guide)** — https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Discipline_Specific_Functionality/Architecture/Revit_API_Revit_API_Developers_Guide_Discipline_Specific_Functionality_Architecture_Rooms_html.html
  → "read-only dimension properties: Area, Perimeter, UnboundedHeight, Volume, ClosedShell"; Volume = 0 se computação desligada.
- **Room Class (API Reference)** — https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/75c9d2c7-a402-ea8b-9e7c-f8bc3510bbd5.htm
  → propriedades `Area`, `Perimeter`, `UnboundedHeight`, `Volume`; `BaseOffset`/`UpperLimit` com get/set; herança `Room : SpatialElement : Element`.
- **UnboundedHeight Property** — https://www.revitapidocs.com/2026/90d5ad07-8b4f-87fd-7ba1-4942496df7d5.htm
  → `public double UnboundedHeight { get; }` — **getter only**. **[SEC]** (espelho da API; a referência oficial lista como "Get the Unbounded Height of the Room").

---

## 5. Etiquetas (Room Tags)

### 5.1 O que são, arquiteturalmente

> "Rooms are **model elements** in Revit, like walls and doors. Room tags are **annotation elements**
> that can be added and displayed in plan views and section views." `[DOC]`

Consequências diretas dessa separação:

| Ação | Efeito | Conf. |
|---|---|---|
| Apagar a **tag** em planta | O **room permanece** no projeto e na tabela | [DOC] |
| Apagar o **room** (inclusive pela tabela) | A **tag correspondente é apagada também** | [DOC] |
| Mover a tag sozinha | O room **não** se move | [DOC] |
| Selecionar room + tag e arrastar | Ambos se movem juntos | [DOC] |

### 5.2 Como criar

| Método | Caminho | Conf. |
|---|---|---|
| **Auto-tag on placement** | faixa contextual **Modify › Place Room** → **Tag** panel → **Tag on Placement** (ligado por padrão) | [DOC] |
| **Tag manual** | **Architecture** → **Room & Area** → **Tag Room** drop-down → **Tag Room** (atalho **RT**) | [DOC] |
| **Em lote** | **Annotate** → **Tag** panel → **Tag All** (Tag All Not Tagged) | [DOC] |

**Tag a Room** — barra de opções: **orientação** da etiqueta e **Leader**. Nota oficial: *"When the
leader is enabled for a room tag, you may need to move the room tag to see the leader. The leader
end will remain in the tagged room."* `[DOC]`

Comportamento ao clicar: *"As you place room tags, they **align with existing tags**."* E: se dois
rooms se sobrepõem no ponto do clique, **só um é etiquetado**; se um room do modelo atual e outro
de um link se sobrepõem, **o do modelo atual ganha**. `[DOC]`

### 5.3 Tag All Not Tagged — parâmetros exatos do diálogo

`Annotate` tab → `Tag` panel → `Tag All`. O diálogo **Tag All Not Tagged** oferece: `[DOC]`

1. **Escopo:** `All objects in current view` / `Only selected objects in current view` /
   `Include elements from linked files`.
2. **Categorias de tag** (multi-seleção) — aqui se marca **Rooms**.
3. **Leader** + **Leader Length** (comprimento padrão).
4. **Tag Orientation**: `Horizontal` ou `Vertical`.
5. `OK`.

Pré-requisito: **as famílias de tag precisam estar carregadas** no projeto. Se a visibilidade da
categoria de tag estiver desligada (ou um view template a bloquear), aparece uma mensagem pedindo
confirmação. `[DOC]`

### 5.4 Parâmetros da etiqueta

**Type Properties** (`Room Tag Type Properties`): `[DOC]`

| Parâmetro | Função |
|---|---|
| **Show Volume** | Exibe o volume calculado. Se aparecer "Not Computed", ligue a computação de volumes |
| **Show Room Number** | Exibe o número |
| **Show Area** | Exibe a área calculada |
| **Leader Arrowhead** | Forma da seta da linha de chamada |

**Instance Properties** (`Room Tag Instance Properties`): `[DOC]`

| Parâmetro | Valores |
|---|---|
| **Leader Line** | liga/desliga |
| **Orientation** | `Horizontal`, `Vertical`, `Model` |

Além disso, a etiqueta pode exibir **qualquer parâmetro do room** — porque, como a própria Autodesk
explica, *"all fields that appear in the room schedule are part of the properties list for the
room"* e a tag é apenas uma família de anotação que referencia esses parâmetros. `[DOC]`

### 5.5 Como mover a etiqueta sem mover o ambiente

1. Selecione **apenas** a etiqueta (clique nela; o room só é selecionado se você clicar dentro do
   contorno / sobre as reference lines).
2. Arraste. Se houver leader, o **ponto final do leader permanece dentro do room**. `[DOC]`
3. Se você arrastar demais, o Revit avisa **"Room Tag Is Outside of Its Room"**. `[DOC]`

Também existe o comando **"Room:Re-center Reference"** (`ID_RECENTER_REFERENCE_LINE`), que
recentraliza a referência (e da tag) sem mover o ambiente — útil quando a tag "descola". `[DOC]`

### 5.6 Por que a etiqueta é um elemento separado (e por que isso é bom)

Razões que a documentação deixa explícitas ou implícitas:

1. **A etiqueta é por vista; o room é do modelo.** A mesma room pode estar etiquetada na planta
   baixa e **não** etiquetada no forro (RCP) — e é justamente esse o exemplo oficial de uso do
   Tag All Not All Tagged. `[DOC]`
2. **A etiqueta pode sair do ambiente** (com leader) para não colidir com mobiliário/cota. `[DOC]`
3. **A etiqueta é uma família editável** — você desenha o símbolo, escolhe fontes, cria variantes. `[DOC]`
4. **Apagar a etiqueta é reversível e não destrutivo** ao dado. `[DOC]`

O Hestia decidiu o oposto: **etiqueta desenhada pela vista, sem elemento/família**. Isso é mais
simples e resolve 90% dos casos, mas perde (a) múltiplas etiquetas por ambiente, (b) etiqueta
manual arrastada com leader, (c) famílias customizáveis e (d) etiqueta em RCP separada da planta.

### Fontes da seção 5

- **Room Tags** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-6DB755B9-1830-4CCA-A358-511AC9D48FC6.htm
  → "Rooms are model elements… Room tags are annotation elements"; valores que podem exibir.
- **About Rooms and Room Tags** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-65668F88-4429-4992-AA0D-1C4FBDCFA650.htm
  → aviso de região não fechada; Tag on Placement; Tag All Not Tagged; redundância; apagar tag vs apagar room.
- **Tag a Room** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-5FBF2AA2-B811-4443-9DBB-9DE62191F332.htm
  → Options Bar (orientação, Leader); "leader end will remain in the tagged room"; alinhamento entre tags; sobreposição modelo vs link.
- **Tag All Not Tagged** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-13EA386B-E613-4126-B634-67BEC622177E.htm
  → escopo (all/selected/linked), categorias, Leader Length, Tag Orientation Horizontal/Vertical, pré-requisito de família carregada.
- **Room Tag Type Properties** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-FA88005E-CCBD-43A6-A5E7-FE40785CC71E.htm
  → Show Volume / Show Room Number / Show Area / Leader Arrowhead.
- **Room Tag Instance Properties** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-0B44C18B-2688-48E7-822C-69D971F8B399.htm
  → Leader Line; Orientation horizontal/vertical/model.
- **About Room Schedules and Room Tags** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-AA99D45A-D6BD-4230-836C-9324582F851F.htm
  → "all fields that appear in the room schedule are part of the properties list for the room"; edição bidirecional.
- **Revit Keyboard Shortcuts** — https://www.autodesk.com/shortcuts/revit
  → `RT`; `Room:Re-center Reference` listado no PDF `RVTKeyboardShortcuts.pdf` (`ID_RECENTER_REFERENCE_LINE`).

---

## 6. Representação gráfica

### 6.1 Regra de ouro: **Room não aparece por padrão**

> "By default, rooms **do not display** in plan views and section views. However, you can change
> visibility/graphic settings to make rooms and their reference lines visible in these views." `[DOC]`

Ligar em: **View** tab → **Graphics** → **Visibility/Graphics** → aba **Model Categories** →
expandir **Rooms** → marcar: `[DOC]`

| Subcategoria | Efeito | Conf. |
|---|---|---|
| **Interior Fill** | Preenchimento com a cor do interior | [DOC] |
| **Reference** | Linhas de referência (o contorno/linha de seleção) | [DOC] |

**Pegadinha crítica de documentação/impressão:**

> "**Note:** The room fill color is only visible **on screen**. The room fill color **cannot be
> printed**. Apply a **Color Scheme** to the view to print color filled rooms." `[DOC]`

Ou seja: `Interior Fill` ≠ cor impressa. Para sair no PDF, **tem que ser Color Scheme**. O Hestia
faz o certo ao pintar direto com preenchimento translúcido.

### 6.2 Color Schemes + Color Fill Legend

**O que é:** esquema que colore ambientes/áreas por **valor de parâmetro** ou **faixa de valores**. `[DOC]`

- Caminho: **Architecture** tab → **Room & Area** drop-down → **Color Schemes**
  (`ID_SETTINGS_COLORFILLSCHEMES`). `[DOC]`
- Categorias suportadas: **Rooms**, **Areas** (e, no MEP, Spaces, Zones, Ducts, Pipes). `[DOC]`
- Pode colorir por: **Name**, **Area**, **Occupancy**, **Department**, **Comments**, e qualquer
  outro parâmetro. `[DOC]`
- **Pré-requisito:** ter rooms/areas definidos no projeto. `[DOC]`
- Exemplo oficial: colorir por **Department**, com o usuário preenchendo `Department` em cada room. `[DOC]`

**Configuração (Edit Color Scheme):** `[DOC]`
- `Schemes` (lista, com **Duplicate** e **New**)
- **Scheme Definition** — título que aparece **acima da legenda**
- **Values** — lista de valores; cores e **fill patterns** por valor
- **Include elements from linked files** — permite colorir rooms/areas de links

**Aplicação na vista:** `[DOC]`
- Propriedades da vista → **Color Scheme** (escolher o esquema)
- **Color Scheme Location**: `Background` (só o fundo — no piso, em planta) ou `Foreground`
  (aplica sobre **todos** os elementos do modelo). `[DOC]`

**Legenda (Color Fill Legend):** `[DOC]`
- Inserida pela ferramenta **Legend** (no painel Room & Area na versão clássica).
- Ao clicar na vista, abre **Choose Space Type and Color Scheme**.
- Editável depois: **Modify Color Fill Legends** tab → **Scheme** panel → **Edit Scheme**.
- Type Properties: **Swatch Width**, **Swatch Height**, **Show Title**.
- Reordenar valores afeta **todas as vistas** que usam o esquema. `[DOC]`

**Limitação conhecida:** a legenda mostra **ou o nome ou a área**, não os dois. Workarounds de
fórum: legenda por Name + schedule unitemizado só com Area ao lado, alinhados "na mão"; ou um
schedule com campo Image. `[SEC]`

### 6.3 Planta vs 3D vs corte

| Vista | Como o Room aparece | Conf. |
|---|---|---|
| **Planta** | Preenchimento (Interior Fill, só na tela) + Reference lines + tag. Perímetro medido no computation height | [DOC] |
| **3D** | **Não aparece.** A Autodesk: *"Rooms in Revit are not displayed in 3D views… This corresponds to the current product design of Revit."* A categoria nem é listada no V/G de vistas 3D | [DOC] |
| **Corte/seção** | Aparece como **retângulo** (volume desligado) ou com as **fronteiras reais** (volume ligado) | [DOC] |

Detalhe do corte, muito útil: `[DOC]`

- **Volume computation OFF** → o Revit desenha o room como um **retângulo**. Se paredes/teto/telhado
  são inclinados, o contorno **não** acompanha a inclinação. É uma "estimativa grosseira" — a doc
  diz literalmente *"does not reflect actual boundary settings and volume computations"*.
- **Volume computation ON** → o Revit desenha as **fronteiras reais** usadas no cálculo, incluindo
  superfícies inclinadas.

**Respondendo à pergunta do briefing "o Room é um volume 3D?":**

- **Logicamente sim** — tem `ClosedShell` (sólido fechado), `Volume`, e fronteiras 3D.
- **Visualmente não** — não é renderizado em vistas 3D por design do produto. `[DOC]`

Isso é uma decisão de UX, não uma limitação técnica. O Hestia pode (e provavelmente deve) fazer
diferente e mostrar o volume em 3D — seria um diferencial.

### Fontes da seção 6

- **Control the Visibility of Rooms** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-35838C67-A54C-44BF-A4BA-1217326FFB12.htm
  → "By default, rooms do not display"; V/G > Rooms > Interior Fill / Reference; "fill color cannot be printed"; usar Color Scheme para imprimir.
- **About Rooms in Section Views** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-D6153263-2A4D-4F6A-8C3C-F331FA6AE419.htm
  → retângulo com volume off vs fronteiras reais com volume on; imagens comparativas.
- **About Rooms in Plan Views** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-E5291792-0FFD-4171-939F-C056957BBC55.htm
  → perímetro no plano; dica de tilar planta + corte.
- **Color Schemes** — https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-4809E31D-8385-4EB9-89C2-B58D7FB25B00.htm
  → aplica-se a floor plans e section views; "different color scheme to each view"; categorias rooms/areas/spaces/pipes.
- **About Color Schemes (Revit LT)** — https://help.autodesk.com/cloudhelp/2025/ENU/RevitLT-DocumentPresent/files/GUID-8EE49924-9905-4E1F-9269-C819B1E1A683.htm
  → exemplos por Name/Area/Occupancy/Department; legenda; valores definidos no Properties palette.
- **Creating a Color Scheme / Applying a Color Scheme / Adding a Color Fill Legend / Modifying a Color Fill Legend** — https://help.autodesk.com/view/RVT/2013/ENU/caas.html (guias clássicos, GUIDs 1267/1269/1276/2032)
  → Duplicate, Scheme Definition, Include elements from linked files; Color Scheme Location Background/Foreground; Choose Space Type and Color Scheme; Swatch Width/Height, Show Title.
- **Autodesk Support: Visibility graphics settings of 3D views do not list rooms** — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Visibility-graphics-settings-of-3D-views-do-not-list-rooms-under-model-categories-in-Revit.html
  → "Rooms in Revit are not displayed in 3D views… corresponds to the current product design of Revit."
- **Fórum: Show name AND area in color fill legend** — https://forums.autodesk.com/t5/revit-architecture-forum/show-name-and-area-in-color-fill-legend/td-p/8872927
  → "I think it's one or the other"; workarounds com schedule. **[SEC]**

---

## 7. Tabelas (Room Schedule)

### 7.1 Natureza

> "The room schedule and rooms are **associated**; therefore, **all fields that appear in the room
> schedule are part of the properties list for the room**." `[DOC]`

Consequência: **editar na tabela = editar no modelo**, e as **tags atualizam junto**. `[DOC]`

### 7.2 Campos típicos

Como os campos são exatamente os parâmetros do Room (§4.1), os típicos são: `Number`, `Name`,
`Level`, `Area`, `Perimeter`, `Volume`, `Unbounded Height`, `Base Offset`, `Limit Offset`,
`Upper Limit`, `Occupancy`, `Department`, `Comments`, `Base Finish`, `Ceiling Finish`,
`Wall Finish`, `Floor Finish`, `Occupant`, `Phase`. `[DOC]`

A tabela também inclui **parâmetros calculados** (Calculated Value) e **campos de contagem**
(`Count`), e aceita **Embedded Schedule** para listar componentes dentro dos rooms. `[DOC]`

### 7.3 Sorting/Grouping (agrupamento)

Aba **Sorting/Grouping** do **Schedule Properties**: `[DOC]`

| Controle | Função |
|---|---|
| **Sort by** (até 4 níveis) | Ordena e agrupa |
| **Header** | Título acima de cada grupo |
| **Footer** | Title / Count / Totals |
| **Blank line** | Linha em branco entre grupos |
| **Itemize every instance** | Ligado = uma linha por room. **Desligado = linhas agrupadas** (resumo) |
| **Grand Totals** | Soma de todos os grupos |
| **Custom grand total title** | Texto do total geral |

**Opções de exibição do Grand Totals:** `Title, count, and totals` / `Title and totals` /
`Count and totals` / `Totals only`. `[DOC]`

### 7.4 Calculate Totals — a pegadinha

`Calculate totals` **não** é um botão na aba Sorting/Grouping. Fica na aba **Formatting**, por campo: `[DOC]`

> "select a field in a numeric column, then select **Calculate totals** from the drop-down. This
> setting is available only for fields that can be totaled, such as **room area**, cost, count, or
> **room perimeter**. **If you clear the Grand Totals option on the Sorting/Grouping tab, no totals
> display.**"

E: **subtotais só aparecem em summary schedules** — é preciso **desmarcar `Itemize every instance`**. `[DOC]`

Ou seja, para ver "Área total = 1.234 m²" são necessárias **três** coisas simultâneas:

1. `Itemize every instance` **desmarcado** (aba Sorting/Grouping)
2. `Grand Totals` **marcado** (aba Sorting/Grouping)
3. `Calculate totals` **no campo Area** (aba Formatting)

Isso é uma das reclamações mais comuns de usuários novos. `[DOC]` + `[SEC]`

Também existem `Calculate minimum`, `Calculate maximum`, `Calculate minimum and maximum` para
campos numéricos em summary schedules. `[DOC]`

### 7.5 Schedule de Rooms vs Schedule de Areas

| Aspecto | Room Schedule | Area Schedule |
|---|---|---|
| Categoria | `Rooms` (`OST_Rooms`) | `Areas` (`OST_Areas`) |
| Escopo | Todos os rooms do projeto (por fase) | **Por area scheme** — cada scheme tem sua própria tabela |
| Número | Único no projeto (com aviso, não bloqueio) | Único **dentro do scheme** — "duplicate value message if the same value… is used for 2 areas in an area scheme" |
| Volume | Existe (com volume computation ON) | **Não existe** — "Area" não calcula volume |
| "Not Placed" | Sim: campos read-only mostram `Not Placed` | Não se aplica (a Area é sempre delimitada) |
| Pré-criação | Sim, adicionar linhas antes de existir geometria | Sim, idem |
| Conf. | [DOC] | [DOC] |

A doc confirma explicitamente: **"You can create schedules for area schemes."** e cada scheme
aparece como um nó separado no Project Browser. `[DOC]`

Sobre volume em Area: fórum oficial responde que *"'Area' feature of Revit does not calculate
volumes, hence the name 'Area'"*. `[SEC]`

### 7.6 Recursos correlatos úteis

- **Isolate (Not Placed / Unenclosed)** — botão `Filter Not Placed & Unenclosed Items panel →
  Isolate` (aba `Modify Schedule/Quantities`). Filtra a tabela para mostrar **só** rooms não
  colocados ou não fechados. `[DOC]`
- **Show** — com um room selecionado na tabela, `Modify Schedule/Quantities → Show` localiza o room
  em qualquer vista relacionada. `[DOC]`
- **Export CSV** — o Revit exporta schedules; a doc de comandos lista `ExportReportsSchedule`
  ("Saves a schedule or Room/Area report"). `[DOC]`

### Fontes da seção 7

- **About Room Schedules and Room Tags** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-AA99D45A-D6BD-4230-836C-9324582F851F.htm
  → associação tabela↔room↔tag; Show.
- **Add Grand Totals to a Schedule** — https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-99524E19-F30D-43DD-BBD7-B2E4F99FFAC2.htm
  → Sorting/Grouping; 4 opções de exibição; Custom grand total title; dependência de Calculate totals.
- **Format a Schedule (Revit LT)** — https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-DocumentPresent/files/GUID-44DD5F85-F715-450B-B98D-1AB23D5F5074.htm
  → "Calculate totals… available only for fields that can be totaled, such as **room area**… **room perimeter**"; "If you clear the Grand Totals option… no totals display"; "Subtotal calculations only display on summary schedules. Deselect Itemize every Instance".
- **Autodesk Support: How to display Grand Totals** — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-display-grand-total-in-a-Revit-schedule.html
  → passo a passo: Itemize off + Calculate totals no campo.
- **Autodesk Support: total sums of area, volume, length** — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-calculate-total-sums-of-area-volume-length-properties-in-Revit-schedules.html
  → Grand Totals + Title/Count/Totals + Calculate Totals em Area/Length/Volume.
- **List Unplaced Rooms** — https://help.autodesk.com/cloudhelp/2024/ENU/Revit-ArchDesign/files/GUID-5A4874EC-F8D4-4AC7-9096-FDFDC4DCBD91.htm
  → "Not Placed" nos campos read-only (Area, Perimeter, Level, Upper Limit, Volume); botão Isolate.
- **Area Properties** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-863BEFBD-CD33-43C8-B08B-E9F496291DD4.htm
  → Number único **por area scheme**; Level/Area/Perimeter read-only; Area Type.
- **About Area Schemes and Schedules** — GUID-15A760B9-858F-4C76-90FB-F6C226B86C70 (referenciado em Area Schemes)
  → "You can create schedules for area schemes."
- **Fórum: gross and rentable volume** — https://forums.autodesk.com/t5/revit-architecture-forum/revit-2021-how-can-the-gross-and-rentable-volume-of-a-building-be-calculated/td-p/13853743
  → "'Area' feature of Revit does not calculate volumes". **[SEC]**

---

## 8. A ferramenta AREA (área construída / rentável)

Esta é a seção mais importante para decidir "Room vs Area" no Hestia.

### 8.1 O que é uma Area

- **Area é um elemento de modelo** (como walls e doors); **Area Tag é anotação**. `[DOC]`
- Vive **exclusivamente dentro de uma Area Plan view**. `[DOC]`
- **Area Plans** são vistas que mostram relações espaciais baseadas em **area schemes** e **níveis**. `[DOC]`
  > "You can have an area plan for each area scheme and level."
- Cada area plan tem **boundaries, tags e color schemes distintos**. `[DOC]`
- Ficam no nó **Area Plans** do Project Browser; **cada scheme ganha um nó próprio**. `[DOC]`

### 8.2 Area Schemes (os "tipos" de área)

**Duas schemes padrão:** `[DOC]`

| Scheme | Definição oficial | Editável? |
|---|---|---|
| **Gross Building** | *"Total constructed area of a building."* | **Não pode ser editada nem apagada** |
| **Rentable** | *"Area measurements based on the standard method for measuring floor area in office buildings."* | **Modificável** |

Você pode criar schemes adicionais (`Area and Volume Computations` → aba **Area Schemes** → **New** →
Name + Description). **Ao criar uma nova scheme, ela herda os type values da Rentable.** `[DOC]`

Apagar uma scheme apaga **todas as area plans associadas**. `[DOC]`

### 8.3 Area Types (as "regras de medição")

**Area Type é propriedade de instância da Area** e **contém regras de medição que o Revit aplica
aos boundaries**. `[DOC]`

**Gross Building scheme — 2 tipos:** `[DOC]`

| Tipo | Definição |
|---|---|
| **Gross Building Area** | *"The total constructed area of a building. It is any area inside the **outer face** of the building's exterior walls."* |
| **Exterior Area** | *"Any area outside the outer face of a building's external walls, for example, an exterior courtyard enclosed by 4 walls."* |

**Rentable scheme — 6 tipos:** `[DOC]`

| Tipo | Exemplos dados pela Autodesk |
|---|---|
| **Building Common Area** | Lobbies, átrios, salas de conferência, lounges, vending area, security desks, concierge, food service, fitness, day care, locker/shower, mail rooms |
| **Office Area** | Onde o inquilino instala pessoal, mobiliário ou ambos |
| **Exterior Area** | Fora das paredes externas |
| **Floor Area** | Banheiros, depósitos de limpeza, salas elétricas/telefone/mecânicas, elevators lobbies, corredores públicos |
| **Major Vertical Penetration** | Escadas, poços de elevador, flues, pipe shafts, dutos verticais e suas paredes |
| **Store Area** | Área de varejo |

### 8.4 Regras de medição (Apply Area Rules)

O comportamento mais "esperto" e menos conhecido: `[DOC]`

> "If you select the **Apply Area Rules** option, Revit automatically changes the wall boundary
> position when you change the area type. For example, **office area is measured at the wall
> centerline, while exterior area is measured to the exterior wall face.**"

Ou seja: ao trocar o `Area Type` da Area, **o boundary se move sozinho** para respeitar a regra
BOMA-like daquele tipo. Isso só funciona se `Apply Area Rules` estiver marcado **no momento de
pegar as linhas**. Se você desenhar à mão, as regras não se aplicam. `[DOC]`

Detalhe: *"You must place an area tag in the boundary to change the area type."* — o `Area Type` é
editado pela **tag** / propriedades da Area. `[DOC]`

### 8.5 Criar Area Plan — passo a passo

1. **Architecture** → **Room & Area** → **Area** drop-down → **Area Plan**. `[DOC]`
2. No diálogo **New Area Plan**: **Type** = area scheme.
3. Selecionar **nível(is)** — mais de um nível cria uma planta por nível, agrupadas por scheme.
4. `Do not duplicate existing views` (marcar = vistas únicas; desmarcar = cópias).
5. **Scale**.
6. `OK` → o Revit **pergunta se deve criar boundaries automaticamente** a partir de todas as
   paredes externas. `Yes` = boundaries no loop externo; `No` = você desenha. `[DOC]`
7. Limitações documentadas: **não funciona se as paredes externas não formarem loop fechado**;
   **ruled curtain systems não são walls** → é preciso desenhar o boundary à mão. `[DOC]`

### 8.6 Area Boundaries

- Ferramenta: **Architecture** → **Room & Area** → **Area** drop-down → **Area Boundary Line**
  (`ID_OBJECTS_AREASCHEME_BOUNDARY`). `[DOC]`
- Dois modos: **desenhar** (ferramentas de sketch) ou **Pick Lines** (pegar paredes). `[DOC]`
- **Apply Area Rules** + **Offset** na Options Bar. `[DOC]`
- Tecnicamente: *"The area boundary can only be a ModelCurve with the category Area Boundary
  (`BuiltInCategory.OST_AreaSchemeLines`)"* — **diferente** do boundary de Room, que pode ser
  paredes e outros elementos. `[DOC]`

### 8.7 Criar a Area

1. Abrir a area plan.
2. Criar os boundaries.
3. **Architecture** → **Room & Area** → **Area** drop-down → **Area**.
4. `Tag on Placement` ligado/desligado; orientação da tag; `Leader`.
5. Options Bar → **Area**: `New` ou escolher existente.
6. Clicar dentro → *"it expands to the extents of the boundaries"*. `[DOC]`

Visibilidade: a Area **não aparece** por padrão — é preciso V/G → **Area** → **Interior Fill** e/ou
**Reference**. `[DOC]`

### 8.8 Propriedades da Area

| Parâmetro | Grupo | Editável? | Conf. |
|---|---|---|---|
| **Level** | Constraints | **Read-only** | [DOC] |
| **Area** | Dimensions | **Read-only** ("Total area within area boundaries") | [DOC] |
| **Perimeter** | Dimensions | **Read-only** | [DOC] |
| **Number** | Identity Data | Sim, **auto-gerado**; avisa duplicidade **por scheme** | [DOC] |
| **Name** | Identity Data | Sim | [DOC] |
| **Comments** | Identity Data | Sim | [DOC] |
| **Area Type** | Other | Sim — **altera a posição dos boundaries criados com Apply Area Rules** | [DOC] |

Notar: **Area tem `Area` e `Perimeter`, mas não tem `Volume`, `Volume Computations`, `Upper Limit`,
`Limit Offset`, `Base Offset`, `Unbounded Height`, nem acabamentos/ocupantes.** `[DOC]`

### 8.9 Room vs Area — quadro decisório

| Pergunta | Use **Room** | Use **Area** |
|---|---|---|
| Preciso de nome/número por ambiente, acabamentos, ocupação, departamento? | ✅ | ❌ (não tem esses campos) |
| Preciso de volume / pé-direito / IFC Space? | ✅ | ❌ |
| Preciso de área construída total do edifício (BOMA Gross)? | ❌ (é net) | ✅ **Gross Building** |
| Preciso de área rentável por inquilino / common area / vertical penetration? | ❌ | ✅ **Rentable** com Area Types |
| Quero que a área se ajuste automaticamente às paredes? | ✅ (automático) | ❌ (boundaries são manuais/pick lines) |
| Quero medir "dentro do acabamento"? | ✅ (wall finish) | ✅ (se desenhar assim) |
| Quero medir "face externa da parede"? | ❌ (só via Wall Center/Core — não externa) | ✅ (`Gross Building Area` / `Exterior Area`) |
| Quero que apareça em schedule de componentes/room data? | ✅ | ❌ (não popula schedules de room) |
| Quero múltiplas medições concorrentes (gross, rentable, zoning)? | ❌ (uma única medição de área, global) | ✅ (uma scheme por leitura) |

**Regra prática consolidada por revendas/treinadores:** `[SEC]`
> "Use **Area tags** to calculate overall footage of a building, or areas that are not
> distinguished as a 'space'. Utilise **Room Area tags** when defining rooms… Do NOT use Area to
> calculate areas of rooms, as it will not populate in-room schedules correctly."
> — ARKANCE UK

E o inverso também vale: **não use Room para medir área construída**, porque o Room é sempre net e o
limite é global do projeto.

### 8.10 O que o Hestia tem hoje e o que falta aqui

O Hestia tem **apenas o equivalente a Room** (circuito de paredes, área net, acabamentos, tabela,
IFCSPACE). **Não tem nada equivalente a Area Plans / Area Schemes / Area Boundaries.** Se o produto
quiser atender programa de necessidades de arquitetura, isso basta. Se quiser atender **área
construída legal / BOMA / estudo de viabilidade / laudo de metragem**, falta um conceito inteiro:
uma camada de "medição" independente do modelo de paredes, com boundaries próprios e regras.

### Fontes da seção 8

- **Area Plans** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-4E0F18E2-1F19-4993-A252-57717A7DB66D.htm
  → "views that show spatial relationships based on area schemes and levels"; um plan por scheme+nível; boundaries/tags/color schemes distintos; nó por scheme.
- **Create an Area Plan** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-D237E6DA-CC5B-4BBE-86E1-3C8AC28CF8AF.htm
  → diálogo New Area Plan (Type, levels, Do not duplicate, Scale); prompt de boundaries automáticos; loop fechado; ruled curtain systems.
- **Area Schemes** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-194A8E37-06C5-426D-964C-D9148A1FEFE3.htm
  → 2 schemes padrão; Gross Building não editável/apagável; Rentable modificável; schemes adicionais.
- **Create an Area Scheme** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-AB773B3B-5C5C-441C-90FC-C10896C6A50D.htm
  → aba Area Schemes → New → Name + Description.
- **About Area Types** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-FF0555DF-C278-46F8-BB09-496FBDF61648.htm
  → regras de medição; 2 tipos Gross + 6 tipos Rentable com definições; nova scheme herda Rentable.
- **Area Boundaries** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-0AB09044-22FC-4116-8845-0D558BA129C1.htm
  → Apply Area Rules; "office area is measured at the wall centerline, while exterior area is measured to the exterior wall face".
- **Create Area Boundaries** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-C3F4D1B7-83E0-4354-919A-101D6B86A220.htm
  → Pick Lines vs draw; Apply Area Rules + offset; "area boundary position is dependent on the area type parameter of the area tag".
- **Areas and Area Tags** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-38416B2B-DF04-461D-99A1-3F1EA2CD83BC.htm
  → "Areas are model elements… Area tags are annotation elements"; pré-criação por schedule.
- **Create an Area** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-21AB5490-9DCA-4716-9823-DAF47A530575.htm
  → fluxo, Tag on Placement, Options Bar (Area: New/existing), expansão até os boundaries, V/G Area > Interior Fill/Reference.
- **Area Properties** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-863BEFBD-CD33-43C8-B08B-E9F496291DD4.htm
  → Level/Area/Perimeter read-only; Number único por scheme; Area Type altera boundaries.
- **ARKANCE — Revit Room Areas vs Area** — https://ukcommunity.arkance.world/hc/en-us/articles/21566338603410-Revit-Room-Areas-vs-Area
  → "Do NOT use Area to calculate areas of rooms, as it will not populate in-room schedules correctly". **[SEC]**
- **Fórum: area boundary lines going wherever** — https://forums.autodesk.com/t5/revit-architecture-forum/area-boundary-lines-going-where-ever/td-p/8005655
  → Gross = contorno externo; Rentable = face interna; "Rentable area rules are useless cause…" (crítica). **[SEC]**

---

## 9. Fases, unplaced rooms, worksets e dores conhecidas

### 9.1 Fases (Phases)

Regras oficiais: `[DOC]`

- **Todo Room é phase-specific.** Ao colocar numa vista, ele é atribuído à **fase da vista**.
- Um Room é definido pelos **boundaries que existem naquela fase**. O Revit **ignora** elementos
  room-bounding que não existem na fase ativa.
- É possível ter **o mesmo nome e número** em fases diferentes (ou em locais diferentes), desde que
  em fases diferentes.
- **Não troque a fase na mesma vista.** A recomendação oficial é **duplicar a vista** com fases
  dedicadas.
- Editar elementos room-bounding numa fase **não afeta** as outras (desde que o elemento não exista
  nelas).
- `Copy a Room Between Phases` existe para preservar propriedades.
- `Phase` **não é editável** no Room: vem da vista. `[DOC]`

### 9.2 Unplaced Rooms

- **Unplace** = remove do modelo mas **mantém os dados** (nome, número, acabamentos, parâmetros). `[DOC]`
- **Delete** = remove tudo, inclusive a informação. `[DOC]`
- Na tabela, um room unplaced mostra **`Not Placed`** nos campos read-only: **Area, Perimeter,
  Level, Upper Limit, Volume**. `[DOC]`
- **Reposicionar:** ferramenta **Room** → Options Bar → **Room: escolher o ambiente na lista** →
  clicar no lugar. `[DOC]`
- **Listar os pendentes:** schedule → **Modify Schedule/Quantities** → **Filter Not Placed &
  Unenclosed Items** → **Isolate**. `[DOC]`
- **Ocultar da tabela:** `Hide Unplaced Rooms in a Room Schedule`. `[DOC]`

Este é um conceito que o Hestia **não tem**: no Hestia, ambiente sem circuito válido é erro, não
um estado persistente. No Revit, "unplaced" é um **estado de primeira classe** — útil para
pré-dimensionar programa antes de modelar.

### 9.3 Pré-criar rooms pela tabela (early design)

> "As an aid to early design and programmatic studies, you can add rooms (for example, from a
> program list) to a schedule **before you define walls or place rooms in a plan view**." `[DOC]`

Mecânica: abrir a room schedule → **Modify Schedule/Quantities** → **Rows panel** → **New**.
Depois, com a ferramenta Room ativa, escolher o room pré-criado na lista da Options Bar. `[DOC]`

Isso é o "programa de necessidades" do Revit. O Hestia hoje não tem: a tabela só lista ambientes
que já existem geometricamente.

### 9.4 Worksets

- **Todo elemento pertence a exatamente um workset.** `[DOC]`
  > "Each element in the document must belong to one and only one workset."
- Room é elemento → **está num workset**. Não há "room compartilhado entre worksets".
- `WorksetId` é **read-only** na API; para mover, usa-se o parâmetro `ELEM_PARTITION_PARAM`. `[DOC]`
- Implicação prática: **se o workset que contém paredes delimitadoras estiver fechado/não
  carregado, o room perde o fechamento** e vira "not enclosed". `[SEC]` (consequência lógica;
  há relatos em fórum de rooms que "mudam" ao abrir/fechar worksets).

### 9.5 Dores conhecidas (o que arquitetos reclamam)

| Dor | Descrição | Conf. |
|---|---|---|
| **"Not enclosed" opaco** | Você vê a área vazia mas não sabe **qual** elemento está faltando ou sobrando. Não existe "selecionar elementos delimitadores do room". Pedido antigo na Idea Board | [DOC] (aviso) + [SEC] (ausência de ferramenta) |
| **Bounding é global** | Não dá para dizer "esta coluna delimita o room A mas não o B". Pedido explícito de "Room Bounding Options" por room | [SEC] |
| **Room não aparece em 3D** | Decisão de produto da Autodesk; usuários pedem há anos | [DOC] |
| **Interior Fill não imprime** | Cor só na tela; obriga a usar Color Scheme | [DOC] |
| **Legenda não mostra nome + área** | "I think it's one or the other" | [SEC] |
| **Totais escondidos** | Precisa de Itemize off + Grand Totals + Calculate totals | [DOC] |
| **Volume custa performance** | Ligar/desligar volume é recomendado pela própria Autodesk | [DOC] |
| **Volume ≠ área** | Volume sempre até o acabamento, mesmo com área no eixo | [DOC] |
| **Rooms "mudam sozinhos"** | Causados por separation lines ocultas, elementos em design options, links, fases, worksets fechados | [SEC] |
| **Computation height no nível** | Um valor por nível afeta todos os rooms; ajustar "pode afetar performance" | [DOC] |
| **Avisos que não bloqueiam** | Número duplicado só avisa; "Redundant Room" só avisa | [DOC] |
| **Room bounding em massa in-place** | Massa marcada como bounding **impede** criar rooms | [DOC] |

Exemplos de relatos: `[SEC]`
- RevitForum, "Edit Room Boundary": *"I would look for a hidden room separation line located at
  the wall's previous location"*; *"Double check them for room bounding lines. Review any turned off
  worksets… Is anything in design options?"*
- RevitCity, "Room tag tags only half of the room": *"it is a room limit problem. A room bounding
  element is restricting your room… It could be a hidden wall or a hidden room separation line."*
- AUGI, "Room bounding unchecked but still shown as bound": bounding "volta" após sync — sintoma de
  elemento em outro lugar (workset/link/fase).

### Fontes da seção 9

- **About Phase-Specific Rooms and Boundaries** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-2D1748B4-D94B-4445-BF90-6C2FDFB4B86E.htm
  → room na fase da vista; ignora elementos de outras fases; mesmo número em fases diferentes; duplicar vistas.
- **Removing Rooms** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-BC1DC181-B6D0-4479-8385-363A9EE5E75E.htm
  → Unplace vs Delete; tópicos de unplaced.
- **List Unplaced Rooms** — https://help.autodesk.com/cloudhelp/2024/ENU/Revit-ArchDesign/files/GUID-5A4874EC-F8D4-4AC7-9096-FDFDC4DCBD91.htm
  → "Not Placed" em Area/Perimeter/Level/Upper Limit/Volume; Isolate.
- **Place an Unplaced Room** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-AB7A1523-9FF3-46C7-A81A-C311C4B5857C.htm
  → Room tool → Options Bar → escolher room → clicar.
- **About Rooms and Room Tags** — https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-65668F88-4429-4992-AA0D-1C4FBDCFA650.htm
  → pré-criar rooms por schedule (Rows > New); "redundant room".
- **Worksharing Terminology** — https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Collaborate/files/GUID-6ED32B4D-4BDE-4AB0-83A8-C2D284AD0950.htm
  → definição de workset, active workset, element borrowing.
- **Elements in Worksets (API)** — https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Advanced_Topics/Worksharing/Revit_API_Revit_API_Developers_Guide_Advanced_Topics_Worksharing_Elements_in_Worksets_html.html
  → "Each element in the document must belong to one and only one workset"; WorksetId read-only; ELEM_PARTITION_PARAM.
- **RevitForum — Edit Room Boundary** — https://www.revitforum.org/forum/revit-architecture-forum-rac/architecture-and-general-revit-questions/39349-edit-room-boundary **[SEC]**
- **RevitCity — ROOM TAG TAGS ONLY HALF OF THE ROOM** — https://www.revitcity.com/forums.php?action=viewthread&thread_id=29276 **[SEC]**
- **AUGI — Room bounding unchecked but still shown as bound** — https://forums.augi.com/showthread.php?164205-Room-bounding-unchecked-but-still-shown-as-bound **[SEC]**

---

## 10. TABELA FINAL — Revit × Hestia

Legenda: **[DOC]** / **[SEC]** / **[?]** conforme §0. **[H]** = comportamento do Hestia segundo o briefing.

### 10.1 Criação

| # | Item | Revit | Hestia hoje | Falta / observação | Conf. |
|---|---|---|---|---|---|
| 1 | Comando | Architecture > Room & Area > Room (`RM`) | Ferramenta "Ambiente", atalho `Z` | Equivalente funcional | [DOC] / [H] |
| 2 | Pré-visualização antes do clique | **Não documentada**. Clica → o room "expande até as bordas" | Pré-visualiza contorno + rótulo "Ambiente N · 12,34 m²" | **Hestia melhor** | [DOC] |
| 3 | Exige circuito fechado | **Não** para criar; sim para calcular | Exige (valida ponto fora/aberto) | Revit permite "unplaced"; Hestia não | [DOC] |
| 4 | Colocação em lote | **Place Rooms Automatically**: todos os circuitos do **nível atual**, > 0,25 sq ft | "Criar em todos os circuitos fechados" | Revit é por nível; Hestia parece global | [DOC] |
| 5 | Barra de opções | Upper Limit, Offset (10'/4000 mm), orientação, Leader, Room (New/existente) | Nenhuma (cria com defaults) | Falta escolher Upper Limit/Offset na criação | [DOC] |
| 6 | Destaque de delimitadores | **Highlight Boundaries** (dourado + diálogo com Expand) | Não existe | Falta diagnóstico visual de "o que está delimitando" | [DOC] |
| 7 | Aviso "não fechado" | "Room is not in a properly enclosed region" | Validação de ponto fora/aberto | Equivalente, mas Revit **cria mesmo assim** | [DOC] |
| 8 | Duplicado no mesmo circuito | "Redundant Room" (aviso, não bloqueia) | Validação de duplicado (bloqueia) | Divergência deliberada de rigor | [DOC] |
| 9 | Número duplicado | **Avisa mas permite continuar** | **Bloqueia** | Verificar se bloqueio é desejado | [DOC] |
| 10 | Largura mínima | Não cria em espaços < 1' / 306 mm | Não mencionado | Detalhe de robustez | [DOC] |

### 10.2 Delimitação

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 11 | Paredes | Sim (standard, curtain, in-place, face-based) | Sim | ✔ | [DOC] |
| 12 | **Pisos / lajes** | **Sim** (delimitador horizontal) | **Não** | **Gap grande** — sem laje, não há base 3D | [DOC] |
| 13 | **Forros / tetos** | **Sim** | **Não** | Gap — pé-direito não é limitado por forro real | [DOC] |
| 14 | **Telhados** | **Sim** | **Não** | Gap — sótão/atrio sem limite superior real | [DOC] |
| 15 | **Pilares** | Sim (arquitetônico; estrutural **só concreto**) | Ilha dentro do circuito vira furo | Funcionalmente equivalente ao loop múltiplo | [DOC] |
| 16 | **Curtain systems** | Sim | Vidro é parede? Não especificado | Confirmar tratamento de fachada-cortina | [DOC] |
| 17 | **Building pad** | Sim | Não | Provavelmente irrelevante para o escopo | [DOC] |
| 18 | Linha de separação | Room Separation Line (elemento real, visível, com propriedades) | Faixa de 1 mm (implícita) | Revit é **elemento**; Hestia é geometria de 1 mm | [DOC] |
| 19 | Propriedade que liga/desliga | **Room Bounding** (Constraints, por elemento, global) | Regra fixa (parede = delimitador) | Falta override por elemento (ex.: divisória de banheiro) | [DOC] |
| 20 | Escopo do override | Global, afeta também ambientes adjacentes | Não existe | — | [DOC] |
| 21 | Vão de porta/janela | Parede continua delimitando (família hospedada) | Conta como parede (não abre circuito) | **Alinhado** | [SEC] / [H] |
| 22 | Abertura de parede (Opening tool) | **Quebra** o circuito; exige separation line | Não distingue | Falta conceito de "abertura que atravessa" | [DOC] |
| 23 | Ilhas (loop interno) | Suportado: `GetBoundarySegments()` retorna N loops | Furos no circuito | **Alinhado** | [DOC] |
| 24 | Modelos vinculados | Só se Room Bounding do link ligado; unload quebra | Não existe | Fora de escopo (single-doc?) | [DOC] |
| 25 | IFC como delimitador | Sim, e sempre na face de acabamento | N/A | — | [DOC] |
| 26 | Elementos de outras fases | Ignorados | Não existe fase | Gap se houver reforma | [DOC] |
| 27 | Massa / Generic Model in-place | **Não** delimitam (causa nº 1 de bug) | N/A | — | [DOC] |

### 10.3 Cálculo

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 28 | Área | **Sempre net**; read-only | Derivada do circuito | Conceito equivalente | [DOC] |
| 29 | Opções de limite | 4 globais: wall finish / wall center / wall core layer / wall core center | Fixo em face de acabamento interna | **Hestia = default do Revit.** Falta as outras 3 (ou assumir que não são escopo) | [DOC] |
| 30 | Escopo da opção | Global do projeto, não por room | Fixo | — | [DOC] |
| 31 | Perímetro | Medido **no computation height** | Derivado do circuito 2D | Equivalente se circuito for único | [DOC] |
| 32 | Computation height | Propriedade **do nível**, padrão 0 mm | Não existe (implícito no plano) | **Gap** para paredes inclinadas/peitoris | [DOC] |
| 33 | Volume | `área × altura`; **sempre até o acabamento**, independente da opção de área | Derivado (pé-direito × área) | Equivalente em geometria simples; diverge em inclinados | [DOC] |
| 34 | Toggle de volume | "Areas and Volumes"; **off por padrão**, por performance | Sempre calculado | Decisão de UX; ok | [DOC] |
| 35 | Unbounded Height | Read-only, envelope teórico dos parâmetros | Não existe (pé-direito é input) | Falta separar "pé-direito declarado" de "altura real" | [DOC] |
| 36 | Altura real | Cortada por lajes/forros/telhados | = pé-direito | Gap se houver forro/laje | [DOC] |
| 37 | Gross vs Net | Não é toggle: Gross = **Area Plan / Gross Building** | Só net | **Gap estrutural** (§8) | [DOC] |
| 38 | Inconsistência área×volume | Documentada e aceita | Não ocorre (mesma base) | Hestia é mais coerente; Revit é mais fiel a normas | [DOC] |

### 10.4 Propriedades

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 39 | Level | Read-only (decorre do clique) | Nível (editável?) | Verificar se Hestia permite mover de nível | [DOC] |
| 40 | Base Offset | Sim, padrão 0 | "Deslocamento da base" | ✔ | [DOC] |
| 41 | Upper Limit | Sim | Não | Falta (especialmente p/ átrio) | [DOC] |
| 42 | Limit Offset | Sim, padrão 4000 mm | Pé-direito (equivalente semântico) | Equivalente | [DOC] |
| 43 | Unbounded Height | Read-only | Não | — | [DOC] |
| 44 | Area / Perimeter / Volume | Read-only | Read-only | **Alinhado** | [DOC] |
| 45 | Number | Editável, único com aviso | Editável, único com bloqueio | Divergência | [DOC] |
| 46 | Name | Editável | Editável | ✔ | [DOC] |
| 47 | Comments | Sim | Não | Falta campo livre | [DOC] |
| 48 | **Occupancy** | Sim | Não | Falta | [DOC] |
| 49 | **Department** | Sim (base dos Color Schemes por dept.) | Não | Falta — e é o que habilita colorir por setor | [DOC] |
| 50 | **Occupant** | Sim | Não | Falta | [DOC] |
| 51 | Acabamentos | **4**: Base, Ceiling, Wall, Floor Finish (texto) | **3** (texto livre) | Falta 1 (ou mapear) | [DOC] |
| 52 | Phase | Read-only, vinda da vista | Não | Gap se houver fases | [DOC] |
| 53 | **Color** | **Não existe no room** — é do Color Scheme, por vista | Cor no elemento | **Hestia diverge**; Revit é mais flexível (multi-esquema) | [DOC] |
| 54 | Room Bounding no room | **Não existe** (é dos delimitadores) | N/A | — | [DOC] |
| 55 | Ponto interior | `LocationPoint` (implícito, é onde você clicou) | Ponto interior explícito | **Alinhado** | [DOC] |

### 10.5 Etiquetas

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 56 | Natureza | **Família de anotação separada** | Desenhada pela vista, sem elemento | Hestia mais simples | [DOC] |
| 57 | Múltiplas tags por room | Sim (planta + RCP + seção) | Uma por vista | OK para o escopo | [DOC] |
| 58 | Tag on placement | Sim (toggle no ribbon) | Sim (implícito) | ✔ | [DOC] |
| 59 | Tag All Not Tagged | Sim, com escopo/categorias/leader/orientação | Não (só cria junto) | Falta "etiquetar tudo que não tem" | [DOC] |
| 60 | Mover tag sem mover room | Sim (leader ancora no room) | N/A (centrada automática) | Hestia perde liberdade, ganha consistência | [DOC] |
| 61 | Tag fora do room | Permitido, com warning | Não | — | [DOC] |
| 62 | Parâmetros na tag | Type properties: `Show Room Number`, `Show Area`, `Show Volume` (o **Name** vem do label da família) | "Nome (número) · área" | Hestia mostra os 3 de uma vez; Revit varia por tipo | [DOC] |
| 63 | Apagar tag | Room permanece | N/A | — | [DOC] |
| 64 | Famílias customizáveis | Sim (Family Editor) | Não | Fora de escopo provavelmente | [DOC] |

### 10.6 Gráfico

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 65 | Visibilidade default | **Room não aparece** — precisa V/G > Rooms > Interior Fill/Reference | Aparece sempre | Hestia mais direto | [DOC] |
| 66 | Preenchimento | Interior Fill: **só na tela, não imprime** | Translúcido, presumivelmente imprime | **Hestia melhor** | [DOC] |
| 67 | Cor imprimível | Só via **Color Scheme** | Cor do elemento | Hestia mais simples | [DOC] |
| 68 | Color Scheme | Por qualquer parâmetro (Name, Area, Occupancy, Department…), com legenda, por vista | Cor única por ambiente | **Gap**: sem esquemas múltiplos / legenda | [DOC] |
| 69 | Legenda (Color Fill Legend) | Elemento próprio, com título, swatches, Show Title | Não | Falta | [DOC] |
| 70 | Color Scheme por vista | Sim, `Background` ou `Foreground` | Cor é do modelo, global | Hestia não permite "planta de setores" e "planta de uso" ao mesmo tempo | [DOC] |
| 71 | Planta | Preenchimento + reference + tag | Preenchimento + etiqueta centrada | ✔ | [DOC] |
| 72 | **3D** | **Room não aparece em 3D** (decisão de produto) | Não mencionado | Oportunidade: Hestia pode mostrar volume 3D | [DOC] |
| 73 | Corte/seção | Retângulo (volume off) ou fronteiras reais (volume on) | Não mencionado | Falta | [DOC] |
| 74 | Cor de preenchimento em corte | Via Color Scheme | N/A | — | [DOC] |

### 10.7 Tabelas

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 75 | Tabela de rooms | Sim, associada bidirecionalmente (edita modelo e tags) | Sim | ✔ | [DOC] |
| 76 | Agrupamento | Sorting/Grouping, até 4 níveis, headers/footers | Não mencionado | Falta agrupar por nível/setor | [DOC] |
| 77 | Totais | `Itemize off` + `Grand Totals` + `Calculate totals` (3 passos) | Não mencionado | Falta total geral por coluna | [DOC] |
| 78 | Min/Max | Calculate minimum/maximum | Não | Nice-to-have | [DOC] |
| 79 | Campos calculados | Calculated Value | Não | Nice-to-have | [DOC] |
| 80 | Embedded schedule | Sim (componentes dentro do room) | Não | Fora de escopo | [DOC] |
| 81 | CSV | Sim (`ExportReportsSchedule`) | Sim | ✔ | [DOC] / [H] |
| 82 | Pré-criar rooms sem geometria | Sim (Rows > New) → "unplaced" | Não | **Gap conceitual** (programa de necessidades) | [DOC] |
| 83 | Filtrar "not placed" | Isolate | Não | — | [DOC] |
| 84 | Schedule de Areas | Sim, por scheme | Não | **Gap estrutural** | [DOC] |

### 10.8 Area (construída/rentável)

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 85 | Conceito de Area | Elemento separado, em Area Plan | **Não existe** | **Gap estrutural** | [DOC] |
| 86 | Area Schemes | Gross Building + Rentable + custom | Não | Falta | [DOC] |
| 87 | Gross Building | Área até a **face externa** das paredes externas | Não | Falta | [DOC] |
| 88 | Rentable + 6 Area Types | BOMA-like, com regras por tipo | Não | Falta | [DOC] |
| 89 | Area Boundaries | Elemento próprio (ModelCurve), pick lines ou desenho | Não | Falta | [DOC] |
| 90 | Apply Area Rules | Move o boundary ao trocar Area Type | Não | Falta | [DOC] |
| 91 | Area Volume | **Não existe** | N/A | — | [SEC] |
| 92 | Área "manual" independente das paredes | Sim | Não (tudo derivado) | **Gap** para metragem legal | [DOC] |

### 10.9 Interoperabilidade

| # | Item | Revit | Hestia hoje | Falta | Conf. |
|---|---|---|---|---|---|
| 93 | Export IFC de ambientes | Rooms → `IfcSpace` | `IFCSPACE` | ✔ | [DOC] |
| 94 | Space boundaries | `None` / `1st level` / `2nd level` (2nd = split por espaço do outro lado; usado em energia) | Não mencionado | Falta nível 2 | [DOC] |
| 95 | Base quantities | Checkbox **"Export base quantities"** no Modify Setup | `Qto_SpaceBaseQuantities` | ✔ (verificar completude) | [DOC] / [?] |
| 96 | Geometria do volume no IFC | "Use 2D room boundaries for room volume": marcado = extrusão 2D; desmarcado = geometria calculada pelo Revit (default IFC2x3) | Extrusão do contorno 2D | Equivalente ao modo "marcado" | [DOC] |
| 97 | Phase to export | Sim | Não | — | [DOC] |
| 98 | Export rooms in 3D views | Sim (respeita section box) | N/A | — | [DOC] |

> **[?] sobre `Qto_SpaceBaseQuantities`:** o nome do property set é da especificação IFC
> (buildingSMART), **não** da documentação do Revit. A doc Autodesk apenas diz que existe um
> checkbox "Export base quantities". Não validei nesta pesquisa se o Revit preenche
> **todos** os campos de `Qto_SpaceBaseQuantities` (NetFloorArea, GrossFloorArea, Height,
> GrossPerimeter, etc.) nem como ele decide `Net` vs `Gross`. **Recomendo testar com um IFC real
> antes de prometer paridade.**

### Fontes da seção 10

- **IFC Export Setup Options** — https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm
  → `Space boundaries` None/1st/2nd; `Export rooms in 3D views`; `Use 2D room boundaries for room volume` (extrusão = default IFC2x2; geometria calculada = default IFC2x3); `Export Revit property sets`.
- **Autodesk Support: export to IFC with quantities** — https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-export-model-from-Revit-to-IFC-export-with-quantities.html
  → File > Export > IFC > Modify setup > Property sets > **Export base quantities** (+ Revit property sets + IFC common property sets).
- **Catenda — Revit IFC Export Manual** — https://support.catenda.com/en/articles/4670341-revit-ifc-export-manual
  → "Export rooms, areas and spaces in 3D views"; interpretação de 1st vs 2nd level. **[SEC]**
- **IFC Export — Revit API Developer's Guide** — https://help.autodesk.com/cloudhelp/2018/ENU/Revit-API/Revit_API_Developers_Guide/Advanced_Topics/Export.html
  → `IFCExportOptions`; "whether to export IFC standard quantities currently supported by Revit". **[DOC]**

---

## 11. Recomendações para o Hestia (síntese)

### 11.1 O que já está certo e não deve mudar

1. **Derivar contorno/área/perímetro do circuito, nunca gravar.** O Revit faz o mesmo: `Area`,
   `Perimeter`, `Volume` são read-only e recalculados. `[DOC]`
2. **Limite na face de acabamento interna.** É exatamente o **default** do Revit (`At wall finish`). `[DOC]`
3. **Vãos de porta/janela não abrem o circuito.** Coerente com famílias hospedadas. `[DOC]`/`[SEC]`
4. **Ilhas viram furos.** Coerente com múltiplos loops de `GetBoundarySegments()`. `[DOC]`
5. **Pré-visualização com área antes do clique.** O Revit não tem; é diferencial real. `[DOC]`
6. **Bloquear número duplicado.** Mais rigoroso que o Revit — defensável em produto web multiusuário. `[DOC]`

### 11.2 Lacunas de maior impacto (ordenadas por custo/benefício)

| Prioridade | Lacuna | Por quê | Esforço |
|---|---|---|---|
| **P0** | **`Upper Limit` / `Limit Offset` reais** (hoje só "pé-direito") | Sem isso não há átrio, mezanino, pé-direito duplo | Baixo |
| **P0** | **`Unbounded Height` separado do pé-direito real** | Evita inconsistência semântica | Baixo |
| **P0** | **Campos `Department` + `Occupancy`** | Habilitam color scheme por setor e tabela de programa | Baixo |
| **P1** | **Color Schemes por vista + legenda** | O Revit permite "planta de setores" e "planta de uso" simultâneas; Hestia não | Médio |
| **P1** | **Totais e agrupamento na tabela** | Pedido universal; Revit exige 3 passos, Hestia pode fazer melhor | Baixo |
| **P1** | **"Etiquetar todos os não etiquetados"** | Equivalente ao Tag All Not Tagged | Baixo |
| **P1** | **Estados "não colocado" / programa sem geometria** | Permite pré-dimensionar antes de modelar | Médio |
| **P2** | **Override de `Room Bounding` por elemento** | Divisórias de banheiro, mobiliário, pilar de aço | Médio |
| **P2** | **Diagnóstico de "por que não fechou"** | O Revit é ruim nisso (Highlight Boundaries ajuda pouco); oportunidade de UX | Médio |
| **P2** | **Volume 3D visível** | O Revit **não** mostra room em 3D; Hestia pode virar referência aqui | Alto |
| **P3** | **Area Plans / Area Schemes / Area Boundaries** | Só se o produto quiser metragem legal/BOMA | Alto |
| **P3** | **Fases** | Só se houver reforma/retrofit | Alto |

### 11.3 Onde o Hestia está à frente

- Pré-visualização de área antes de criar (Revit: cria e depois expande). `[DOC]`
- Preenchimento que imprime sem precisar de Color Scheme (Revit: "cannot be printed"). `[DOC]`
- Etiqueta sempre centrada e vinculada (Revit: pode ficar "fora do room" e gerar warning). `[DOC]`
- Um único conceito mental (ambiente = circuito) vs. dois do Revit (Room vs Area), que é fonte
  perene de confusão para usuários novos. `[SEC]`

### 11.4 Onde o Hestia está atrás (conceitual, não cosmético)

- **Não tem 3D no ambiente**: sem laje/forro/telhado, `Volume` é `área × pé-direito`, não um sólido.
- **Não tem "gross"**: qualquer exigência de área construída (prefeitura, ABNT, BOMA) fica sem resposta.
- **Não tem fases**: reforma é impossível de representar.
- **Não tem programa sem geometria**: não dá para começar pelo programa de necessidades.

---

## 12. Índice de fontes (consolidado)

### Documentação oficial Autodesk — Rooms

| Tema | URL |
|---|---|
| Índice Rooms | https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-3D8B61D3-38C6-4B8F-97E1-797A05F5C5AD.htm |
| About Rooms | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-DD74A51D-A0B0-4461-A4BA-0F9CCC191CDB.htm |
| Create a Room | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-B3420A54-A9BC-4AEE-A07C-CD7A9DC782FB.htm |
| Place Rooms Automatically | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-D94E11E7-0956-4B5B-B50F-6BB28AD09F15.htm |
| Select a Room | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-40DDBA89-885E-4BAF-93AC-1E5756A2BCE4.htm |
| Room Instance Properties | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-21326970-0037-41C6-A996-980C24EE019F.htm |
| Removing Rooms | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-BC1DC181-B6D0-4479-8385-363A9EE5E75E.htm |
| List Unplaced Rooms | https://help.autodesk.com/cloudhelp/2024/ENU/Revit-ArchDesign/files/GUID-5A4874EC-F8D4-4AC7-9096-FDFDC4DCBD91.htm |
| Place an Unplaced Room | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-AB7A1523-9FF3-46C7-A81A-C311C4B5857C.htm |

### Documentação oficial — Boundaries / Área e Volume

| Tema | URL |
|---|---|
| Room Boundaries (índice) | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-C7338362-6D35-471B-90B0-6A893534FFE2.htm |
| About Room-Bounding Elements | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-241430FC-8084-43A1-AA3A-681B2883B0FC.htm |
| Make an Element Room Bounding | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-65968961-7D56-4D17-8F92-565D2C7CCB2D.htm |
| About Room Separation Lines | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-6B8BDC71-D0A4-4ABA-8561-34F7AD6BAB55.htm |
| Add a Room Separation Line | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-94A9F88B-93EE-4213-8991-252E92873FE0.htm |
| About Rooms in Plan Views | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-E5291792-0FFD-4171-939F-C056957BBC55.htm |
| About Rooms in Section Views | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-D6153263-2A4D-4F6A-8C3C-F331FA6AE419.htm |
| Room Area and Volume | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-22B6D041-F6D8-4DB0-8094-B325CC3CC6B4.htm |
| About Room Area | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-9348929C-18CA-40AC-BB64-71D01CC52F2B.htm |
| About the Computation Height | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-9D33F884-4BCA-4772-B3E5-1E15A53DEE6E.htm |
| Change the Room Area Boundary Location | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-0BB62832-36DD-4E06-A9D4-EE98CE0FCF89.htm |
| Enable Room Volume Computations | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-84D8BC77-AAF3-4F45-B77E-58E35858D3AA.htm |
| How Room Volume is Computed | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-06B6BB18-C968-4A7E-9147-65C294288F64.htm |
| About Room Height | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-21560A99-86E5-4114-B4A5-DD2F57FFFBD7.htm |
| Situations That Affect Volume | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-052DFFB9-5076-4CE6-BC8B-420C8D03ACF0.htm |
| About Rooms Spanning Floors | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-50C282D8-2856-4B5C-88E8-5A2A92774F0B.htm |

### Documentação oficial — Tags / Schedules / Graphics

| Tema | URL |
|---|---|
| Room Tags (índice) | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-6DB755B9-1830-4CCA-A358-511AC9D48FC6.htm |
| About Rooms and Room Tags | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-65668F88-4429-4992-AA0D-1C4FBDCFA650.htm |
| Tag a Room | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-5FBF2AA2-B811-4443-9DBB-9DE62191F332.htm |
| Tag All Not Tagged | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-13EA386B-E613-4126-B634-67BEC622177E.htm |
| Room Tag Type Properties | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-FA88005E-CCBD-43A6-A5E7-FE40785CC71E.htm |
| Room Tag Instance Properties | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-0B44C18B-2688-48E7-822C-69D971F8B399.htm |
| About Room Schedules and Room Tags | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-AA99D45A-D6BD-4230-836C-9324582F851F.htm |
| Control the Visibility of Rooms | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-ArchDesign/files/GUID-35838C67-A54C-44BF-A4BA-1217326FFB12.htm |
| Color Schemes (índice) | https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-4809E31D-8385-4EB9-89C2-B58D7FB25B00.htm |
| About Color Schemes (LT) | https://help.autodesk.com/cloudhelp/2025/ENU/RevitLT-DocumentPresent/files/GUID-8EE49924-9905-4E1F-9269-C819B1E1A683.htm |
| Add Grand Totals to a Schedule | https://help.autodesk.com/cloudhelp/2025/ENU/Revit-DocumentPresent/files/GUID-99524E19-F30D-43DD-BBD7-B2E4F99FFAC2.htm |
| Format a Schedule | https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-DocumentPresent/files/GUID-44DD5F85-F715-450B-B98D-1AB23D5F5074.htm |
| Create a Schedule or Quantity | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-DocumentPresent/files/GUID-6D4DBBDA-3611-40CD-9A45-BE40EB07188A.htm |

### Documentação oficial — Areas

| Tema | URL |
|---|---|
| Area Plans | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-4E0F18E2-1F19-4993-A252-57717A7DB66D.htm |
| Create an Area Plan | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-D237E6DA-CC5B-4BBE-86E1-3C8AC28CF8AF.htm |
| Area Schemes | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-194A8E37-06C5-426D-964C-D9148A1FEFE3.htm |
| Create an Area Scheme | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-AB773B3B-5C5C-441C-90FC-C10896C6A50D.htm |
| About Area Types | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-FF0555DF-C278-46F8-BB09-496FBDF61648.htm |
| Area Boundaries | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-0AB09044-22FC-4116-8845-0D558BA129C1.htm |
| Create Area Boundaries | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-C3F4D1B7-83E0-4354-919A-101D6B86A220.htm |
| Areas and Area Tags | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-38416B2B-DF04-461D-99A1-3F1EA2CD83BC.htm |
| Create an Area | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-21AB5490-9DCA-4716-9823-DAF47A530575.htm |
| Area Properties | https://help.autodesk.com/cloudhelp/2022/ENU/Revit-Model/files/GUID-863BEFBD-CD33-43C8-B08B-E9F496291DD4.htm |

### Documentação oficial — API / IFC / Worksharing / Atalhos

| Tema | URL |
|---|---|
| Revit API — Rooms (Developer's Guide) | https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Discipline_Specific_Functionality/Architecture/Revit_API_Revit_API_Developers_Guide_Discipline_Specific_Functionality_Architecture_Rooms_html.html |
| Room Class (API Reference) | https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/75c9d2c7-a402-ea8b-9e7c-f8bc3510bbd5.htm |
| BuiltInFailures.RoomFailures | https://help.autodesk.com/cloudhelp/2026/ENU/Revit-API-MainReference/files/html/7bece7b1-6ad8-1153-a15a-5b16feabe08b.htm |
| IFC Export Setup Options | https://help.autodesk.com/cloudhelp/2026/ENU/Revit-DocumentPresent/files/GUID-E029E3AD-1639-4446-A935-C9796BC34C95.htm |
| IFC Export (API guide) | https://help.autodesk.com/cloudhelp/2018/ENU/Revit-API/Revit_API_Developers_Guide/Advanced_Topics/Export.html |
| Worksharing Terminology | https://help.autodesk.com/cloudhelp/2024/ENU/Revit-Collaborate/files/GUID-6ED32B4D-4BDE-4AB0-83A8-C2D284AD0950.htm |
| Elements in Worksets (API) | https://help.autodesk.com/cloudhelp/2024/ENU/Revit-API/files/Revit_API_Developers_Guide/Advanced_Topics/Worksharing/Revit_API_Revit_API_Developers_Guide_Advanced_Topics_Worksharing_Elements_in_Worksets_html.html |
| Revit Keyboard Shortcuts (oficial) | https://www.autodesk.com/shortcuts/revit |
| PDF de atalhos (2027) | https://revit.downloads.autodesk.com/download/2027RVT_RTM/Docs/InProd/RVTKeyboardShortcuts.pdf |

### Suporte Autodesk (artigos técnicos)

| Tema | URL |
|---|---|
| Rooms não aparecem em 3D | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Visibility-graphics-settings-of-3D-views-do-not-list-rooms-under-model-categories-in-Revit.html |
| "not in a properly enclosed region" (massa in-place) | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Warning-Room-is-not-in-a-properly-enclosed-region-when-trying-to-place-rooms-in-Revit.html |
| Can't create rooms within bounded area | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Revit-Can-t-create-rooms-within-bounded-area.html |
| Grand totals em schedule | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-display-grand-total-in-a-Revit-schedule.html |
| Somar área/volume/comprimento | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-calculate-total-sums-of-area-volume-length-properties-in-Revit-schedules.html |
| Exportar IFC com quantidades | https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/How-to-export-model-from-Revit-to-IFC-export-with-quantities.html |

### Fontes secundárias (fóruns / blogs) — usar com [SEC]

| Tema | URL |
|---|---|
| Room Areas vs Area (ARKANCE) | https://ukcommunity.arkance.world/hc/en-us/articles/21566338603410-Revit-Room-Areas-vs-Area |
| Idea: Room Bounding Options (por room) | https://forums.autodesk.com/t5/revit-ideas/room-bounding-options/idi-p/14004846 |
| Fórum: Edit Room Boundary | https://www.revitforum.org/forum/revit-architecture-forum-rac/architecture-and-general-revit-questions/39349-edit-room-boundary |
| Fórum: Room tag tags only half | https://www.revitcity.com/forums.php?action=viewthread&thread_id=29276 |
| AUGI: bounding unchecked but still bound | https://forums.augi.com/showthread.php?164205-Room-bounding-unchecked-but-still-shown-as-bound |
| AUGI: área livre real | https://forums.augi.com/showthread.php?10242-Revit-doesn-t-calculate-the-real-free-area-in-a-room |
| Fórum: nome + área na color fill legend | https://forums.autodesk.com/t5/revit-architecture-forum/show-name-and-area-in-color-fill-legend/td-p/8872927 |
| Fórum: Area vs volume | https://forums.autodesk.com/t5/revit-architecture-forum/revit-2021-how-can-the-gross-and-rentable-volume-of-a-building-be-calculated/td-p/13853743 |
| Catenda — IFC export manual | https://support.catenda.com/en/articles/4670341-revit-ifc-export-manual |
| Revitapidocs (espelho da API) | https://www.revitapidocs.com/2026/75c9d2c7-a402-ea8b-9e7c-f8bc3510bbd5.htm |

---

## 13. Perguntas abertas (não resolvidas nesta pesquisa)

1. **[?] `Qto_SpaceBaseQuantities`** — o Revit preenche **todos** os campos (NetFloorArea,
   GrossFloorArea, Height, GrossPerimeter)? Como decide Net vs Gross? Só se confirma exportando.
2. **[?] Room tool tem algum modo de arraste / "place multiple"?** A doc descreve clique único e
   colocações sucessivas. Não encontrei página que negue explicitamente um modo de arraste.
3. **[?] Comportamento de `Area` quando o boundary está aberto** — a doc diz que a Area "expands to
   the extents of the boundaries", mas não descreve o estado "não fechado" da Area com o mesmo
   detalhe que faz para Room. Pode haver um "not enclosed" análogo.
4. **[?] Interação entre `Computation Height` e `Base Offset` negativo** — a doc cita o aviso
   "Room's Lower Offset Is Above the Computation Height", mas não detalha o que acontece
   geometricamente.
5. **[?] Quantos loops de boundary o Revit aceita** antes de degradar performance. Só medição empírica.
6. **[?] `Include elements from linked files` em Color Schemes** — funciona com rooms de links IFC
   ou só Revit? A doc não distingue.

---

*Fim do documento. Pesquisa encerrada em 29/10/2026.*
