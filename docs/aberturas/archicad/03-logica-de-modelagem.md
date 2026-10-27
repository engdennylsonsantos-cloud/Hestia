# R3 · ArchiCAD: a lógica de modelagem de portas e janelas (GDL × parede)

Pesquisa para o Hestia. Data: 2026-10-26. Escopo: entender **como o ArchiCAD realmente constrói** uma porta/janela e como ela se relaciona com a parede, para parametrizar o nosso editor. Não altera código.

**Marcações.** *[DOC]* = página oficial da Graphisoft (ajuda, GDL Center, API) lida nesta rodada. *[FÓRUM]* = comunidade/tutorial/suporte, usado como apoio. *[INFERIDO]* = dedução nossa, com o raciocínio explícito. *[NÃO CONFIRMADO]* = não achamos fonte que feche a questão.

---

## 1 · Resumo executivo

1. Porta/janela **não é um sólido solto**: é um objeto GDL “hóspede” de uma parede, com subtipo próprio (`Door (Wall)` / `Window (Wall)`). A parede é quem manda na espessura, nas camadas e no recorte; o objeto manda na geometria da esquadria e no símbolo 2D [DOC: GDL Basics 17; GDL Reference “Doors and Windows”].
2. O **furo padrão é retangular** e tem largura/altura iguais às dimensões **A** e **B** do objeto. Tolerância e “oversize” ampliam esse retângulo; formas não retangulares exigem `WALLHOLE`/`WALLNICHE` (3D) e `WALLHOLE2`/`WALLBLOCK2` (2D) [DOC: GDL Reference; Ajuda “Wall Opening”].
3. A cadeia de dimensionamento é hierárquica: **Wallhole → Unit → Reveal → Egress → Leaf**. Cada uma é derivada da anterior por tolerância, revelo, largura de batente e rebate. Só um par (A/B) é “nominal” por vez [DOC: GDL Tips “Nominal sizes”; Ajuda “Nominal Sizes and Tolerance”].
4. **Reveal (revelo)** é a profundidade com que a esquadria é recuada a partir da face ou do **core** da parede. O mesmo campo controla o recuo do batente e o “sill depth” (`WIDO_SILL`) [DOC: Ajuda “Preview and Positioning”; “Anchor Reveal”].
5. O **reveal side** é o lado “externo” da parede, marcado pelo sol na colocação; é dele que a profundidade do revelo é medida. Ele é independente do lado de abertura da folha [DOC: Ajuda “Placing Doors or Windows”; GDL `WIDO_REVEAL_SIDE`].
6. O batente **não é obrigatoriamente da espessura da parede**: há o checkbox **Frame Thickness = Wall Thickness**; quando desligado, a profundidade do batente é um parâmetro próprio (e o encontro com a parede precisa ser resolvido por revelo, extensão de batente ou acabamento) [DOC: Ajuda “Frame Style and Dimensions”].
7. **Wall Closure** não é geometria 3D: é a regra de **como as camadas (skins) da parede composta “dobram” para dentro do vão**. Na INT library ela afeta a **planta 2D**; o “Turn Plaster” aparece em corte/elevação como extensão do reboco até o batente e, opcionalmente, em 3D [DOC: Ajuda “Wall Closure”].
8. O **alizar/casing** é um acessório separado, com faces interna e externa, largura, espessura, offset e overhang; **não pode coexistir com Turn Plaster** [DOC: Ajuda “Casing”; biblioteca AC9 SE].
9. A folha encaixa no batente por **rebate** (`gs_rebate_width`): a largura da folha é a largura do unit menos duas vezes (largura do batente − rebate). É esse mesmo rebate que define o “batedor” e o recobrimento [DOC: GDL Tips “Nominal sizes”].
10. O ângulo de abertura é **dois parâmetros independentes**: ângulo 2D (símbolo) e ângulo 3D (modelo). A folha gira em torno da dobradiça; a biblioteca é quem precisa garantir que ela não atravesse o batente — não há “colisão automática” documentada [DOC: Ajuda “Opening Type and Angle”; *[NÃO CONFIRMADO]* o teste de colisão].
11. **Sidelight/transom** são componentes do mesmo objeto: a página **Shape** define o arranjo; larguras/alturas são editadas por **hotspots** (ou Tab → “Sidelight Width”); cada componente tem tipo de abertura, direção (igual/oposta à folha) e ângulo próprios [DOC/FÓRUM].
12. O **símbolo 2D** não é um corte comum do 3D: por padrão é o desenho simbólico do objeto (script 2D), gerado a partir de uma projeção interna especial; alternativamente, **Projected** mostra o 3D cortado pelo plano de planta [DOC: GDL Reference “Doors and Windows”; Ajuda “Symbolic vs. Projected”].
13. **Nível de detalhe** é duplo (2D e 3D), com padrão **By MVO** e possibilidade de fixar Full/Medium/Low ou Full/Simplified/Schematic/Off por esquadria [DOC: Ajuda “Detail Level”].
14. Para o nosso editor, o mais importante é copiar a **cadeia de dependências** (nominal → furo → revelo → batente → folha → acabamento) e tratar o **reveal anchor** (face/core) como conceito de primeira classe; o resto é aparência.

---

## 2 · Fundamentos: o que é uma porta/janela no ArchiCAD

### 2.1 Dois objetos, um hóspede

- A porta/janela é um **Library Part** (GDL) do subtipo `Model Element/Opening/Wall Opening/Door (Wall)` ou `.../Window (Wall)`. O subtipo é o que permite ao ArchiCAD tratá-la como abertura e **só permitir colocação em parede** [DOC: GDL Basics 17].
- A parede fornece: espessura (`WALL_THICKNESS`, medida no eixo do vão), inclinação (`WALL_INCL`), camadas (`WALL_SKINS_*`), materiais (`WALL_MAT_A/B/EDGE`) e o recorte. O objeto fornece: batente, folha, vidro, ferragens e símbolo [DOC: GDL Reference “Wall, Door, Window and Wall-end Parameters”].
- O objeto **inclui o wallhole** no seu comportamento; não é um “furo” separado com lifecycle próprio [DOC: GDL Basics 17: “door and window objects include the wallhole as well”].

### 2.2 Origem e sistema de coordenadas

| Contexto | Origem | Eixos | Observação |
|---|---|---|---|
| **3D** | **centro da base do vão**, na **face externa** da parede | X/Y paralelos ao plano da parede; Z perpendicular, “para dentro” da parede | `A` é medido em X (largura), `B` em Y (altura). A origem é deslocada em Z por `WIDO_SILL` (reveal depth) [DOC: GDL Reference “Doors and Windows”; GDL Basics 17] |
| **2D** | centro do vão, alinhado à **borda externa** da parede | X/Y de planta | O símbolo e o modelo 3D são ajustados à origem pelo **centro inferior da bounding box**; **não há ajuste em Z**, para permitir que o objeto avance para fora da parede [DOC: LPM “Creating Doors and Windows”; GDL Reference “Doors and Windows”] |
| **Curva** | idem, com `WIDO_ORIG_DIST` = distância ao centro de curvatura | idem | 0 em parede reta; negativo no fim de parede curvo [DOC: GDL `WIDO_ORIG_DIST`] |

Consequência prática: **modela-se a esquadria “deitada” no plano da parede**, como se o observador estivesse dentro da parede. O que deve ficar “dentro da parede” (batente) tem Z positivo; o que abre para fora (folha) tem Z negativo [DOC: GDL Reference “Doors and Windows”].

### 2.3 A cadeia de dimensões (o “coração” da parametrização)

O ArchiCAD reconhece seis pares de dimensões nominais e permite escolher **um** deles como nominal (A/B):

| Nível | Parâmetros | Definição | Relação com o anterior |
|---|---|---|---|
| **Wallhole** | `ac_wallhole_width` / `ac_wallhole_height` | vão cortado na parede, incluindo tolerância | = Unit + tolerâncias (lados e superior) |
| **Unit** | `ac_unit_width` / `ac_unit_height` | o “produto” que se compra: esquadria completa (batente incluso) | = Wallhole − tolerâncias |
| **Reveal** | `ac_reveal_width` / `ac_reveal_height` | vão livre entre as arestas mais internas do revelo | = Wallhole − 2·(profundidade do revelo), conforme geometria |
| **Egress** | `ac_egress_width` / `ac_egress_height` | distância entre os pontos mais internos do batente (só portas) | = Unit − 2·`gs_frame_width` (largura); = Unit − `gs_frame_width` (altura) |
| **Leaf** | `ac_leaf_width` / `ac_leaf_height` | extensão da folha (só portas) | = Unit − 2·(`gs_frame_width` − `gs_rebate_width`) |
| **A / B** | `A`, `B` | o par que o objeto expõe como nominal | recebe o par escolhido no Parameter Script |

Fórmulas textuais [DOC: GDL Tips “Nominal sizes – Automatic dimensioning”]:

```
ac_unit_width   = ac_wallhole_width  - 2 * tolerance
ac_unit_height  = ac_wallhole_height - 2 * tolerance      (nessa página)
ac_egress_width  = ac_unit_width  - 2 * gs_frame_width
ac_egress_height = ac_unit_height - gs_frame_width
ac_leaf_width    = ac_unit_width  - 2 * (gs_frame_width - gs_rebate_width)
ac_leaf_height   = ac_unit_height - (gs_frame_width - gs_rebate_width)
ac_leaf_width    = ac_egress_width  + 2 * gs_rebate_width
ac_leaf_height   = ac_egress_height + gs_rebate_width
```

**Atenção — divergência documentada:** a Ajuda INT diz que **Wallhole Height = Unit Height + Upper Tolerance** (só a superior), enquanto a página de GDL Tips usa `2 * tolerance` também na altura e a LPM fala em “tolerância vertical”. Isso indica que a tolerância inferior é tipicamente **0** na biblioteca INT, mas o conceito admite os quatro lados. Para o nosso editor, o correto é guardar **quatro tolerâncias independentes** (esquerda, direita, superior, inferior) e default 0 na inferior [DOC: Ajuda “Nominal Sizes and Tolerance”; “Tolerances”; LPM “Creating Doors and Windows”].

### 2.4 Ordem de geração (o que o ArchiCAD calcula primeiro)

1. **Colocação**: escolhe-se a parede, o **reveal side** (lado externo) e a direção de abertura; a âncora horizontal (centro ou lado) define o ponto fixo [DOC: Ajuda “Placing Doors or Windows”].
2. **Parameter Script** resolve a cadeia acima: escolhe o par nominal, recalcula wallhole/unit/reveal/egress/leaf e trava `A`/`B` [DOC: GDL Tips “Nominal sizes”].
3. **Corte da parede**: gera o retângulo A×B (ou o `WALLHOLE`/`WALLNICHE`, se o script existir); soma `oversize` [DOC: GDL Reference; Ajuda “Wall Opening”].
4. **Revelo**: recorta/desenha o reveal conforme `WIDO_HEAD_DEPTH`, `WIDO_THRES_DEPTH`, `WIDO_LEFT_JAMB`, `WIDO_RIGHT_JAMB` e `WIDO_SILL` [DOC: GDL Tips “Reveal options”].
5. **Objeto 3D**: batente na profundidade do revelo, folha/sash com rebate e ângulo, vidro, ferragens [DOC: GDL Basics 17].
6. **Parede composta**: aplica Wall Closure/Turn Plaster por skin (2D e corte; 3D opcional) [DOC: Ajuda “Wall Closure”].
7. **Acessórios**: peitoril, soleira, alizar, toldo, etc., com contra-transformações para não virarem “do avesso” no Flip [DOC: GDL Basics 17].
8. **Símbolo 2D / LOD**: escolhe simbólico × projetado e o nível de detalhe [DOC: Ajuda “Symbolic vs. Projected”; “Detail Level”].
9. **Listagem/IFC**: expõe dimensões nominais, orientação (`ac_openingside`), operação IFC, classificação [DOC: GDL `dw-params`; LPM].

---

## 3 · Pergunta 1 — geometria do furo, folga e camadas

### 3.1 O furo padrão

- Colocar uma porta/janela **sempre corta um furo retangular** na parede. O tamanho é determinado pelos parâmetros **A** e **B** do objeto [DOC: GDL Reference “Doors and Windows”, seção “Non-Rectangular…”].
- Se o objeto tiver elevação não retangular, ele **não preenche** o retângulo; a solução é cortar a forma real com `WALLHOLE`/`WALLNICHE` ou desenhar os “remendos” de parede no 3D [DOC: ibid.].
- O furo é **transversal**: o comando `WALLHOLE` corta a parede com um “tubo infinito” de seção poligonal; o corte padrão atravessa a espessura no eixo do vão (`WALL_THICKNESS`) [DOC: GDL Reference `WALLHOLE`; GDL `WALL_THICKNESS`].

### 3.2 Tolerância × Oversize × Reveal

| Conceito | O que faz | Afeta o nominal? | Onde se define |
|---|---|---|---|
| **Tolerance** | folga entre o **unit** (produto) e o **wallhole** (furo). Wallhole = Unit + tolerâncias | **Sim** (se o nominal for Wallhole) | Custom Settings → **Nominal Sizes and Tolerance** → **Tolerances**; `Uniform Tolerances` liga/desliga por lado |
| **Oversize** | aumenta o furo para **esquerda, direita, cima e/ou baixo**, sem mexer no tamanho nominal | **Não** | Custom Settings → **Wall Opening** → **Opening Oversizes** |
| **Reveal depth** | recua a esquadria a partir da face/core; não muda o tamanho do furo em planta, muda a posição e o “sill depth” | Não (mas `ac_reveal_*` deriva dele) | **Preview and Positioning** / **Wall Opening** / **Reveal** |
| **Wall Inset** (janelas) | rebaixo **abaixo** da janela (ex.: radiador), simétrico ou assimétrico | Não | **Wall Inset** |

Fontes: [DOC: Ajuda “Nominal Sizes and Tolerance”; “Tolerances”; “Wall Opening”; “Wall Inset”].

### 3.3 O furo atravessa todas as camadas?

- **O corte padrão atravessa a parede inteira** (é um prisma de A×B ao longo de `WALL_THICKNESS`) [DOC: GDL Reference `WALLHOLE`; GDL `WALL_THICKNESS`].
- Em parede composta, as camadas não “sobrevivem” ao furo: o que existe é o **Wall Closure**, que **redesenha** as skins dobradas para dentro do vão (2D) e o **Turn Plaster** (corte/elevação). Ou seja: o furo é único e integral; o que muda é o **desenho das camadas nas bordas** [DOC: Ajuda “Wall Closure”; AC18 “Wall Closure” (exemplos de plaster wrapped × custom closure)].
- **Ressalva:** não encontramos uma frase literal “o furo corta todas as skins”. A conclusão acima é *[INFERIDO]* do comportamento do `WALLHOLE` (tubo infinito) + do Wall Closure (as skins são redesenhadas dentro do vão). O que é [DOC] é que o furo é único, retangular e do tamanho A×B, e que o closure é um desenho sobreposto.

### 3.4 Furo customizado (não retangular)

| Comando | Onde | Para que serve | Observações |
|---|---|---|---|
| `WALLHOLE n, status, x1,y1,mask1 …` | 3D script | corta um ou mais polígonos no 3D | Se existir **pelo menos um** `WALLHOLE`, **nenhum** furo retangular é gerado; pode haver vários, até intersectantes; não gera revelo automático; **não tem efeito em 2D** [DOC] |
| `WALLNICHE n, method, status, rx,ry,rz, d, …` | 3D script | corte prismático/piramidal/cunha, finito/semi-infinito/infinito | Mais estável que `WALLHOLE` sob espelhamento; usado para revelos e nichos [DOC] |
| `WALLHOLE2` / `WALLHOLE2{2}` | 2D script | define o polígono do vão **em planta**, com polígono de cobertura | Só afeta a parte cortada da parede; o polígono de cobertura não tem contorno [DOC] |
| `WALLBLOCK2` / `WALLARC2` / `WALLLINE2` | 2D script | estende/redesenha a parede em planta (reveals, guarnições) | `WALLHOLE2` de **outro** objeto corta; do mesmo objeto, não [DOC] |

Fonte: [DOC: GDL Reference “Doors and Windows”, seções WALLHOLE/WALLNICHE/WALLHOLE2/WALLBLOCK2/WALLLINE2/WALLARC2].

### 3.5 Campos de furo na interface

| Campo (EN) | Aba/painel | O que faz | Valores/padrão |
|---|---|---|---|
| `Reveal Type` | Wall Opening / Reveal | tipo de revelo ou “No Reveal” | lista depende da biblioteca |
| `Reveal Depth` | Wall Opening / Reveal / Preview and Positioning | profundidade do recuo | comprimento; 0 = rente à face/core |
| `Opening Oversizes` (Left/Right/Upper/Lower) | Wall Opening | amplia o furo sem afetar nominal | comprimentos; padrão 0 |
| `Wall Closure` | Wall Opening | escolhe o closure (parede composta) | No Closure / tipos |
| `Wall Opening Surface` | Wall Opening | superfície das bordas do vão | `Same as Wall Edge` / `Same as Wall Side` |
| `Uniform Tolerances` | Nominal Sizes and Tolerance | uma tolerância para todos os lados | ligado por padrão |
| `Tolerances` (Side/Upper) | Tolerances | valores por lado | comprimentos |
| `Set as Nominal` | Nominal Sizes and Tolerance | escolhe Wallhole/Unit/Egress/Leaf como nominal | rádio |
| `Transfer Current Nominal Size to Selection` | Nominal Sizes and Tolerance | ao trocar a definição, transporta o valor antigo | checkbox |

Fonte: [DOC: Ajuda “Wall Opening”; “Nominal Sizes and Tolerance”; “Tolerances”].

---

## 4 · Pergunta 2 — revelo, lado do revelo e posição do batente

### 4.1 O que é “Reveal” e “reveal side”

- **Reveal** é o **recuo** da esquadria em relação à face da parede. O valor é a **profundidade do revelo** (também chamado de *sill depth*, `WIDO_SILL`) [DOC: Ajuda “Preview and Positioning”; GDL `WIDO_SILL`].
- **Reveal side** é o **lado de referência** do revelo — o lado “externo” da parede, marcado pelo **sol** e pela linha grossa durante a colocação. Mover o cursor para o lado oposto troca o reveal side; **Tab** também alterna [DOC: Ajuda “Placing Doors or Windows”].
- O reveal side **não é** o lado de abertura da folha. São dois conceitos independentes: um define de que face se mede o recuo; o outro, para onde a folha gira [DOC: GDL `WIDO_REVEAL_SIDE` × `WIDO_ORIENTATION`; Ajuda “Placing…”].
- Padrão: `WIDO_REVEAL_SIDE = 0` para janelas e `1` para portas [DOC: GDL `WIDO_REVEAL_SIDE`].

### 4.2 Ancoragem do revelo: face × core

| `ac_revealAnchorPos` | Nome na UI | Comportamento |
|---|---|---|
| `1` | **Face** | o reveal depth é medido da **face** da parede (lado do reveal side) |
| `2` | **Core** | medido do **core** (a skin core mais próxima, se houver várias) |

- Ancorar no **core** é o que mantém a janela alinhada quando se engorda o isolamento ou se troca o acabamento externo: o recuo se ajusta sozinho para manter a distância ao core [DOC: Ajuda “Anchor Reveal”; API `APIWDRevealDepth_Core`].
- Se a parede deixar de ter core, o anchor volta para **Face** e a profundidade é recalculada para manter a posição [DOC: Ajuda “Anchor Reveal”].
- O `Reveal` da aba **Preview and Positioning** é o **mesmo** valor do `Reveal Depth` da aba **Reveal** [DOC: Ajuda “Preview and Positioning”].

### 4.3 O batente acompanha a parede?

- **Não por padrão conceitual.** O checkbox **Frame Thickness = Wall Thickness** força o batente a ter a espessura da parede; quando desligado, a espessura do batente é um parâmetro independente (`gs_frame_thk` / “Frame Thickness”) [DOC: Ajuda “Frame Style and Dimensions”; GDL Basics 17].
- Em várias portas da biblioteca, esse checkbox vem **ligado e cinza** (não editável); ele só se torna editável em certas combinações (ex.: `Frame Thickness = Wall Thickness` ligado e todas as folhas abrindo no mesmo sentido) [DOC: Ajuda “Frame Style and Dimensions”]. Em versões antigas, dependia também do “Wall Type” (Stud/Solid) [FÓRUM].
- Quando o batente é mais raso que a parede, a biblioteca histórica resolve com **Jamb Extension** (extensão de batente) e/ou com o próprio **Reveal** [DOC: AC9 SE “Casing”; Ajuda “Wall Closure” (reveal to wall core)].

### 4.4 Modelo numérico da posição

Com a origem 3D na **face externa** e Z positivo “para dentro”:

```
z_face_externa = 0
z_inicio_batente = WIDO_SILL            (reveal depth)
z_fim_batente    = WIDO_SILL + gs_frame_thk
z_face_interna   = WALL_THICKNESS
```

- Se `WIDO_SILL = 0`, o batente começa na face externa → **rente à face**.
- Se `WIDO_SILL > 0`, o batente é **recuado**; o espaço entre 0 e `WIDO_SILL` é o revelo (a parede aparece).
- Se `gs_frame_thk = WALL_THICKNESS`, o batente atravessa a parede; se for menor, sobra um vão do lado interno que o acabamento/closure/jamb extension precisa cobrir.
- Em **Flip**, o objeto é espelhado e **arrastado de volta** por `WIDO_FRAME_THICKNESS` [DOC: GDL Reference “Doors and Windows”; `WIDO_FRAME_THICKNESS`].

*[INFERIDO]* O desenho acima é a leitura direta de “origem deslocada em Z por `WIDO_SILL`” + “frame thickness = wall thickness” + “flip desloca por frame thickness”. Não há uma página que escreva a equação completa.

### 4.5 Onde ficam os controles

| Campo (EN) | Aba/painel | O que faz | Valores/padrão |
|---|---|---|---|
| `Width` / `Height` | Preview and Positioning | dimensões nominais do vão (A/B) | comprimento |
| `Sill/Header Value` + pop-up | Preview and Positioning | altura do peitoril/verga a partir da referência escolhida | `Sill to Wall Base`, `Sill to Wall Top`, `Sill to Story`, `Header to …`, `Relink Anchor Story` |
| `Reveal` | Preview and Positioning | profundidade do revelo | comprimento; = Reveal Depth |
| `Anchor` (Face/Core) | Preview and Positioning | referência do revelo | Face / Core |
| `Flip` | Preview and Positioning / Info Box | troca o lado de abertura mantendo o batente | botão |
| `Anchor Point` | Preview and Positioning / Info Box | coloca pelo centro ou pelo lado | Center / Side |
| `Opening Plane` | Preview and Positioning | acompanha a parede inclinada ou fica vertical | `Associated to Wall` / `Vertical` |
| `Reveal Type` / `Reveal Depth` | Reveal | idem | lista + comprimento |
| `Head Depth`, `Sill/Threshold Depth`, `Left/Right Jamb Depth` | Reveal (legado) | dimensões do revelo por lado | só para objetos não padrão/legado |
| `ac_revealAnchorPos` | GDL (fix named) | 1=Face, 2=Core | inteiro |
| `ac_revealToWallCore` | GDL (fix named) | profundidade medida do core | comprimento |

Fontes: [DOC: Ajuda “Preview and Positioning”; “Other Panels in Door/Window Settings”; “Reveal Settings”; GDL `dw-params`; API `API_WindowType`].

### 4.6 Wall Inset (janelas) — um recuo diferente do revelo

- O **Wall Inset** cria um **rebaixo abaixo da janela**, para radiador/bancada. Não é o revelo.
- Modos: **Automatic** (largura = largura da janela), **Symmetric** (largura e altura fixas, centrado), **Asymmetric** (overhangs esquerdo/direito diferentes, altura única). Tem elevação de fundo (0 = até o piso), profundidade e “Show Hidden Parapet on 2D” [DOC: Ajuda “Wall Inset”].

---

## 5 · Pergunta 3 — Wall Closure (retorno do acabamento)

### 5.1 O que é

- **Wall Closure** é a regra que define **como as camadas (skins) da parede composta fecham em volta do vão**. Não é um sólido novo: é uma **representação** das skins dobradas para dentro do vão [DOC: Ajuda “Wall Closure”].
- Só se aplica a **paredes compostas**; em parede simples não há skins para dobrar [DOC: ibid.].
- Na biblioteca INT, o closure afeta **a planta 2D**. O **Turn Plaster** (reboco dobrado) é a parte que aparece em **corte/elevação** como extensão da parede até o batente, e só vai ao 3D se **Show in 3D** estiver marcado [DOC: ibid.].

> Importante para o nosso editor: **Wall Closure não “corta” o batente nem faz boolean**. Ele desenha o acabamento no espaço entre o núcleo e o batente. A ausência de colisão é resolvida por **ordem de desenho** e por **exclusividade com o alizar**, não por geometria de interseção.

### 5.2 Como evita sobreposição com o batente

O mecanismo é indireto, em três travas:

1. O **reveal** define o contorno do vão e a profundidade até o batente. O closure é desenhado **para dentro desse contorno**, ou seja, ocupa exatamente o espaço do revelo [DOC: “the turned plaster skin will be turned outside of the wall contour, as defined in Reveal Settings”].
2. O **Turn Plaster** “entra no batente” (extensão do composto até o frame) — é assim que o corte mostra o reboco encostando no batente, sem invadir o batente [DOC: ibid.].
3. **Alizar e Turn Plaster são mutuamente exclusivos.** Se o alizar está ligado, o Turn Plaster fica cinza; para usar Turn Plaster é preciso desligar `Inside Casing` e `Outside Casing` [DOC: Ajuda “Wall Closure” e “Casing”].

*[INFERIDO]* A profundidade do retorno é, na prática, a **profundidade do revelo** (`WIDO_SILL`): a skin é dobrada até a face do batente. Não achamos um campo “closure depth” separado; o controle é o reveal + o número de skins + a espessura de cada skin.

### 5.3 Tipos de closure

| Closure Type | O que é | Campos típicos |
|---|---|---|
| **No Closure** | nenhuma skin dobra | — |
| **Traditional Cavity Closure** | closure de cavidade “tradicional”; pode incluir tira de isolamento | `Insulation Strip` + espessura; atributos de fill/pen |
| **Prefabricated** | perfil pré-fabricado de fechamento de cavidade | `Profile Width`; atributos próprios |
| **Insulated Reveal** | revelo com retorno de isolamento (muito usado em fachada) | `Turn-in Skin`, espessura por skin; `Reveal to Wall Core` para alinhar com o isolamento [FÓRUM/suporte oficial] |
| **Custom Closure** | configuração skin a skin | `Select Skin to Edit`, `Turn-in Skin`, espessura, orientação de hatch, pena de linha, `Consider Skin as Plaster` |

Fonte: [DOC: Ajuda “Wall Closure”; AC18 “Wall Closure”; suporte Graphisoft “How to add an Insulated Reveal”].

### 5.4 Campos do Wall Closure

| Campo (EN) | O que faz | Valores/opções | Onde |
|---|---|---|---|
| `Closure Type` | escolhe o tipo ou nenhum | No Closure / Traditional Cavity Closure / Prefabricated / Insulated Reveal / Custom | Wall Closure / Wall Opening |
| `Turn Skin on Side` | em que lados a skin dobra | Right / Left / Both | Wall Closure |
| `Number of Skins to Turn` | quantas skins dobram | inteiro | Wall Closure |
| `Number from` | de que face se conta a skin | Outside face / Inside face | Wall Closure |
| `Profile Width` | largura do perfil pré-fabricado | comprimento | Wall Closure (prefabricated) |
| `Insulation Strip` + thickness | tira de isolamento no closure | on/off + comprimento | Wall Closure (traditional) |
| `Select Skin to Edit` | escolhe o lado a editar no custom | Left jamb / Right jamb / Both | Custom Closure |
| `Turn-in Skin` | liga/desliga a dobra da skin selecionada | checkbox | Custom Closure |
| `Consider Skin as Plaster` | trata a skin como reboco (dobra conforme o reveal) | checkbox; **não funciona em skin Core** | Custom Closure |
| `Plaster Skin Definition` | como identificar o reboco | `Use Wall Finish Component` (skin tipo Finish) ou `Plaster Thickness Limit` (ex.: ≤ 40 mm) | Turn Plaster |
| `Turn Plaster` | modo de dobra do reboco | `Automatically` (todas as skins de reboco) ou `Number of Skins to Turn` | Turn Plaster |
| `Show in 3D` | mostra o turn plaster no 3D | checkbox | Turn Plaster |
| `Hatch orientation`, `Separating line pen` | aparência da skin dobrada | atributos | Custom Closure |

Fonte: [DOC: Ajuda “Wall Closure” (AC28/AC30); AC18 “Wall Closure”].

### 5.5 Regras de projeto que o editor deve reproduzir

- **Core não é reboco.** `Consider Skin as Plaster` não tem efeito em skin definida como Core; o core nunca “vira” acabamento [DOC: Ajuda “Wall Closure”].
- **Skins de core precisam ser adjacentes**; skins de finish também, e devem incluir uma ou ambas as faces externas [DOC: Ajuda “How to Define Components as Core or Finish”].
- **Closure não altera quantitativos.** As skins dobradas são representação; não entram nos volumes/áreas calculados da parede [FÓRUM: resposta oficial Graphisoft].
- **Closure em 3D é limitado.** A biblioteca stock gera a geometria de contorno, mas o turn-in pode não aparecer no 3D; em corte, o que vale é a extensão do composto até o frame [FÓRUM oficial; DOC “Show in 3D”].
- **Closure × alizar:** nunca os dois. O alizar cobre o encontro; o Turn Plaster mostra o reboco. Escolha de representação, não de construção [DOC: Ajuda “Wall Closure”; “Casing”].

---

## 6 · Pergunta 4 — alizar (casing): posição e dimensionamento

### 6.1 Duas faces, dois nomes

| Face | Nome na biblioteca | O que é |
|---|---|---|
| **Interna** | **Casing Trim** / `Inside Casing` | guarnição que cobre a junta entre batente e parede no lado interno |
| **Externa** | **Brick Molding** / `Outside Casing` | perfil externo que arremata e decora o batente |

Fonte: [DOC: AC9 SE “Graphic User Interface” §5.4 Casing; Ajuda “Casing Outside/Inside Settings”].

### 6.2 Como é posicionado e dimensionado

- **Largura e espessura** são independentes para interna e externa; a largura do **head casing** pode ser diferente da largura dos lados [DOC: AC9 SE §5.4].
- **Offset interno:** `Casing Trim Offset` = distância do **trim** à **aresta interna do batente**. Ou seja, o alizar interno “entra” sobre o batente; offset 0 = encostado na aresta interna [DOC: AC9 SE §5.4].
- **Offset externo:** `Brick Molding Offset` = distância do **molding** à **borda do vão** (opening edge). Offsets aplicam-se a **esquerda, direita e topo**, não à base (no peitoril) [DOC: AC9 SE §5.4].
- **Overhang:** `Head Casing Trim Overhang` e `Bottom Casing Trim Overhang` (e equivalentes do brick molding) permitem o alizar “passar” além do encontro, no estilo tradicional [DOC: AC9 SE §5.4].
- **Bottom Brick Molding** pode ser ligado/desligado (há casos em que a base é resolvida pelo peitoril) [DOC: AC9 SE §5.4].
- **Jamb Extension:** peça opcional Acrescentada ao batente para **estender a profundidade até a espessura da parede**; tem espessura configurável e pode ser desligada. É o recurso histórico para batente mais raso que a parede [DOC: AC9 SE §5.4].
- **Masonry Opening:** em parede com revestimento de alvenaria, a abertura externa pode ser calculada como `Unit + Masonry Opening Extra` ou `Unit + Brick Molding Width + Brick Molding Offset` [DOC: AC9 SE §5.4].

### 6.3 O que a biblioteca moderna expõe

- A UI moderna (AC18–AC30) mostra **checkbox `Outside Casing` / `Inside Casing`** e, ao ligar, um conjunto de parâmetros (a página é essencialmente uma imagem na ajuda) [DOC: Ajuda “Casing Outside/Inside Settings”].
- Não há, na ajuda moderna lida, uma lista textual dos nomes exatos de largura/espessura/offset. Os nomes históricos (`Casing Trim Width/Thickness/Offset`, `Brick Molding Width/Thickness/Offset`, `Overhang`) são a melhor referência disponível [DOC: AC9 SE; *[NÃO CONFIRMADO]* se a biblioteca AC28+ usa exatamente esses nomes].
- A comunidade relata que, em algumas versões, **não é possível especificar offset do casing** e que larguras diferentes por lado dependem de “ganging”/shim space [FÓRUM]. Tratar como limitação de biblioteca, não como regra de modelagem.

### 6.4 Sobreposição e ordem

- O alizar é desenhado **depois** do batente e cobre a junta batente×parede; o offset positivo o afasta da aresta interna, o negativo o faz invadir o batente [DOC: AC9 SE; *[INFERIDO]* o sinal negativo é consequência direta da definição “distância à aresta”].
- **Não há detecção automática de colisão** com a folha ou com o closure. A biblioteca apenas posiciona o perfil; se o offset for grande demais, ele pode cobrir o batente/folha (relatos de campo) [FÓRUM].
- **Alizar × Turn Plaster:** mutuamente exclusivos [DOC].
- **Alizar × Wall Closure:** o closure desenha as skins no vão; o alizar cobre a transição na face. Como o Turn Plaster é desligado quando há alizar, o encontro é resolvido pelo perfil, não pelo reboco [DOC + INFERIDO].

### 6.5 Tabela-resumo do alizar

| Campo | Face | O que faz | Observação |
|---|---|---|---|
| `Inside Casing` / `Casing Trim` | interna | liga o alizar interno | — |
| `Outside Casing` / `Brick Molding` | externa | liga o alizar externo | — |
| `Casing Trim Width` | interna | largura do perfil | head pode diferir dos lados |
| `Casing Trim Thickness` | interna | espessura (salto) | valores usuais em lista |
| `Casing Trim Offset` | interna | distância à aresta interna do batente | 0 = encostado |
| `Brick Molding Width` | externa | largura do perfil | — |
| `Brick Molding Thickness` | externa | espessura | — |
| `Brick Molding Offset` | externa | distância à borda do vão | esquerda/direita/topo |
| `Head/Bottom Overhang` | ambas | transpasse no topo/base | estilo tradicional |
| `Bottom Brick Molding` | externa | liga/desliga o perfil na base | — |
| `Jamb Extension` + thickness | batente | estende o batente até a parede | recurso histórico |
| `Masonry Opening Extra` | externa | folga para a abertura na alvenaria | alternativa ao offset |

Fonte principal: [DOC: AC9 SE “Illustrated Windows/Doors” §5.4; Ajuda “Casing Outside/Inside Settings”].

---

## 7 · Pergunta 5 — folha × batente: rebaixo, batedor, folga, dobradiça e ângulo

### 7.1 Estilos de batente (Frame Style)

| Frame Style | O que tem | Consequência para a folha |
|---|---|---|
| **Style 1** | batente simples (bloco) | folha encosta na face; sem batedor |
| **Style 2** | batente com **door stop** (batedor) | folha para no batedor; recobrimento maior |
| **Style 3** | batente com batedor **e rebaixo** para embutir a folha | folha recuada dentro do batente; junta mais protegida |

Fonte: [DOC: AC18 “Frame Style and Dimensions”; AC30 “Frame Style and Dimensions”].

- Com **double egress** (dupla saída), o estilo é forçado para o mais simples (Block) e a opção de Frame Style desaparece [DOC: Ajuda “Frame Style and Dimensions”].
- `Frame Width` pode ser **uniforme** ou **por lado** (Uniform Frame Width); `Frame Thickness` idem (Uniform Frame Thickness) [DOC: AC18].
- **Frame Thickness = Wall Thickness** é o atalho para batente com a espessura da parede; se desligado, `Frame Thickness` vira livre — mas em muitas portas o checkbox está travado (ver §4.3) [DOC].

### 7.2 O encaixe da folha: rebate e fórmulas

A folha **não** é simplesmente “unit − 2·batente”. Ela **recobre** o batente pelo rebate:

```
ac_leaf_width  = ac_unit_width  - 2 * (gs_frame_width - gs_rebate_width)
ac_leaf_height = ac_unit_height - (gs_frame_width - gs_rebate_width)
```

- `gs_rebate_width` é a **largura do rebate** (o quanto a folha avança sobre o batente).
- Se `gs_rebate_width = 0`, a folha é exatamente o vão livre entre batentes (egress).
- Se `gs_rebate_width > 0`, a folha é **maior** que o egress e cobre o batente — é o que fecha a junta e forma o “batedor”.
- A **folga** folha×batente não é um campo separado: ela é o resultado de `gs_frame_width`, `gs_rebate_width` e `gs_leaf_thk`. O único campo explícito de folga é o **leaf undercut** (folga inferior), e existe só em algumas bibliotecas/portas [DOC: GDL Tips “Nominal sizes”; FÓRUM].

Fonte: [DOC: GDL Tips “Nominal sizes – Automatic dimensioning”; FÓRUM “Door's clear opening width” (fórmulas `gs_frame_width`, `gs_rebate_width`, `gs_leaf_thk`)].

### 7.3 Dimensões da folha, sash e vidro

| Campo (EN) | O que define | Onde |
|---|---|---|
| `Leaf Thickness` / `gs_leaf_thk` | espessura da folha | Leaf and Sash Dimension |
| `Leaf Width` / `gs_leaf_panel_width` | largura do painel da folha | Leaf and Sash Dimension / parâmetro |
| `Sash Width` / `gs_sash_width` | largura do perfil do sash (janela) | Frame and Sash / Leaf and Sash |
| `Sash Thickness` / `gs_sash_thk` | espessura do sash | idem |
| `Glass Thickness` | espessura do vidro | idem |
| `Rebate Width` / `gs_rebate_width` | recobrimento folha×batente | Frame Style / parâmetro |
| `Leaf Undercut` | folga inferior da folha | algumas portas (não todas) |

Fonte: [DOC: Ajuda “Leaf and Sash Dimension”; GDL Basics 17 (exemplo de frame/sash/glass com `gs_frame_width`, `gs_sash_width`, `gs_sash_thk`); FÓRUM para undercut].

### 7.4 Eixo da dobradiça

- A folha gira em torno de um **eixo vertical no lado da dobradiça**, que fica no **batente**, na região do rebate. O lado é determinado por **opening side** (L/R) + `SYMB_MIRRORED` (espelhamento) + `SYMB_ROTANGLE` (rotação 180°) [DOC: GDL Reference “Doors and Windows” (8 estados); GDL `WIDO_ORIENTATION`; `ac_openingside`].
- Em portas pivotantes, a biblioteca expõe um **offset de pivô** (`gs_pivotOffset`), que desloca o eixo para dentro da folha [FÓRMUM: parâmetro citado em fio técnico; *[NÃO CONFIRMADO]* o nome em todas as versões].
- **Nós não encontramos** uma página que declare “o eixo fica a X mm da face do batente”. A posição é consequência da geometria do batente + rebate + espessura da folha [*NÃO CONFIRMADO*].

*[INFERIDO]* Modelo mental correto: o eixo é **solidário ao batente**, não ao centro do vão. Por isso o Flip troca o lado de abertura **mantendo o batente no lugar** (§4.4) e a folha “nasce” do lado da dobradiça. Se o eixo ficasse no centro, o Flip teria de mover o batente.

### 7.5 Ângulo de abertura e não-colisão

- A biblioteca INT tem **2D/3D Opening Angle** por componente (folha, sidelight, transom): o ângulo **2D** controla a folha no símbolo de planta; o **3D** controla o modelo. São independentes [DOC: Ajuda “Opening Type and Angle”].
- O ângulo também pode ser editado por **hotspots** no desenho [DOC: ibid.].
- Em portas de correr, o campo vira **opening distance**, não ângulo [DOC: ibid.].
- **Não há documentação de “colisão automática”** entre folha e batente. A biblioteca gira a folha em torno do eixo; se o ângulo for muito grande, a folha pode atravessar o batente/parede. O que a biblioteca faz é **limitar o intervalo** do parâmetro e posicionar o eixo/rebate de modo que o giro “caiba” [*[INFERIDO]*; *[NÃO CONFIRMADO]* o teste exato].
- **Abertura além de 90°**: a folha pode girar mais que 90°; o “clear opening” real depende do cosseno da espessura no ângulo, o que a biblioteca stock não calcula [FÓRUM técnico].

### 7.6 Tabela-resumo da folha

| Campo (EN) | O que faz | Valores | Aba |
|---|---|---|---|
| `Frame Style` | estilo do batente (1/2/3) | 1, 2, 3 | Frame Style and Dimensions |
| `Frame Width` | largura do batente | comprimento / por lado | Frame Style and Dimensions |
| `Frame Thickness` | profundidade do batente | comprimento / por lado | Frame Style and Dimensions |
| `Frame Thickness = Wall Thickness` | iguala batente à parede | checkbox (às vezes travado) | Frame Style and Dimensions |
| `Uniform Frame Width/Thickness` | permite variar por lado | checkbox | Frame Style and Dimensions |
| `Leaf Thickness` | espessura da folha | comprimento | Leaf and Sash |
| `Sash Width` | largura do sash | comprimento | Frame and Sash |
| `Glass Thickness` | espessura do vidro | comprimento | Leaf and Sash |
| `Opening Type` | tipo de abertura por componente | Side Hung / Double Egress / Sliding / Pivot / etc. | Opening Type and Angle |
| `2D Opening Angle` | ângulo no símbolo | graus | Opening Type and Angle |
| `3D Opening Angle` | ângulo no modelo | graus (ou distância, se correr) | Opening Type and Angle |
| `Sidelight/Transom Opening Direction` | direção relativa à folha | Same as Leaf / Opposite to Leaf | Opening Type and Angle |

---
