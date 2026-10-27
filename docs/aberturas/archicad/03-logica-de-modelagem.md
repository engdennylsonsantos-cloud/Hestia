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
- **Não existe opção “centralizado”** na UI. O batente é posicionado pelo **reveal depth** a partir de uma face/core; para centralizar é preciso calcular `reveal = (WALL_THICKNESS − gs_frame_thk) / 2` [*[INFERIDO]* da ausência de controle “center” + do modelo Z de §4.4].

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

1. O **reveal** define o contorno do vão e a profundidade até o batente. O closure é desenhado **no espaço do revelo**, para fora do contorno do núcleo, limitado pelo contorno definido no Reveal Settings [DOC: “the turned plaster skin will be turned outside of the wall contour, as defined in Reveal Settings”].
2. O **Turn Plaster** “entra no batente” (extensão do composto até o frame) — é assim que o corte mostra o reboco encostando no batente, sem invadir o batente [DOC: ibid.].
3. **Alizar e Turn Plaster são mutuamente exclusivos.** Se o alizar está ligado, o Turn Plaster fica cinza; para usar Turn Plaster é preciso desligar `Inside Casing` e `Outside Casing` [DOC: Ajuda “Wall Closure” e “Casing”].

*[INFERIDO]* A profundidade do retorno é, na prática, a **profundidade do revelo** (`WIDO_SILL`): a skin é dobrada até a face do batente. Não achamos um campo “closure depth” separado; o controle é o reveal + o número de skins + a espessura de cada skin.

**Quando encosta no batente × quando entra no vão:** com `Reveal = 0` e batente rente à face, o reboco dobra praticamente no plano da face e encontra o batente ali; com `Reveal > 0`, o reboco **acompanha a profundidade do revelo** e só encontra o batente no fundo do vão. O `Turn Plaster` é justamente a extensão do composto “até o frame” mostrada no corte [DOC: Ajuda “Wall Closure”; AC18 “Wall Closure”].

### 5.3 Tipos de closure

| Closure Type | O que é | Campos típicos |
|---|---|---|
| **No Closure** | nenhuma skin dobra | — |
| **Traditional Cavity Closure** | closure de cavidade “tradicional”; pode incluir tira de isolamento | `Insulation Strip` + espessura; atributos de fill/pen |
| **Prefabricated** | perfil pré-fabricado de fechamento de cavidade | `Profile Width`; atributos próprios |
| **Insulated Reveal** | revelo com retorno de isolamento (muito usado em fachada) | `Turn-in Skin`, espessura por skin; `Reveal to Wall Core` para alinhar com o isolamento [FÓRUM (suporte Graphisoft)] |
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
- **Linhas de fim de skin no vão** são controladas em `Options > Element Attributes > Composites` (`Skin End Lines`), não no objeto da porta/janela. Se estiverem desligadas, as camadas parecem “sumir” no vão, mesmo com o closure ligado [DOC: suporte Graphisoft “Edges of composite walls are invisible at door openings”].
- **Exceção de junção parede-laje:** se a abertura está **rente ao topo da laje**, as skins de acabamento da laje continuam através da parede, ignorando prioridades; se a abertura está elevada, valem as prioridades normais [DOC: Ajuda “Specific Element Intersections and Junctions”].

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
- Em portas pivotantes, a biblioteca expõe um **offset de pivô** (`gs_pivotOffset`), que desloca o eixo para dentro da folha [FÓRUM: parâmetro citado em fio técnico; *[NÃO CONFIRMADO]* o nome em todas as versões].
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

## 8 · Pergunta 6 — bandeira e laterais (sidelight/transom)

### 8.1 O que são

- **Sidelight** = painel lateral fixo ou operável ao lado da folha.
- **Transom** (bandeira/overlight) = painel superior, acima da folha e/ou dos sidelights.
- Ambos são **componentes do mesmo Library Part**, não objetos separados. O arranjo é escolhido na página **Shape** [DOC: Ajuda “Shape”; “Door/Window Settings and Opening”].
- A página Shape é essencialmente gráfica: mostra as configurações de folha + sidelight(s) + transom, com divisões e hotspots. A ajuda não lista os campos textualmente (a página é uma imagem) [DOC: Ajuda “Shape”].

### 8.2 Como dividem largura e altura

Modelo geométrico *[INFERIDO]* a partir da composição e das dimensões nominais:

```
LARGURA (A / wallhole / unit)
| frame | sidelight | mullion | leaf | frame |
        ↑ largura do sidelight ↑       ↑ largura da folha ↑

ALTURA (B / wallhole / unit)
| frame |
| transom (bandeira) |
| mullion horizontal |
| leaf / sidelight |
| frame / peitoril |
```

- O **unit** cobre o conjunto inteiro; o **wallhole** cobre o unit + tolerâncias. Portanto `A` é a largura total, **não** a largura da folha [DOC: Ajuda “Nominal Sizes and Tolerance”; LPM].
- A **folha** tem largura própria (`ac_leaf_width` / `gs_leaf_panel_width`); o **sidelight** recebe o restante depois de descontar batentes e montantes.
- A **bandeira** tem altura própria; a folha/sidelight recebem o restante depois do transom e do batente.
- Rateio aproximado *[INFERIDO]*: `A ≈ 2·frame + Σ sidelights + Σ montantes + leaf` e `B ≈ 2·frame + transom + max(leaf, sidelight)`. O `unit` é sempre o **todo**; a folha é um dos parcelas. O valor exato de cada parcela é calculado no Parameter Script, não na UI.
- As divisões são editáveis por **hotspots**; ao arrastar, a folha pode manter o tamanho e o sidelight esticar (relato consistente) [FÓRUM: “Door with sidelight sizing”].
- Há um diálogo **“Sidelight Width”** acessível por **Tab** durante a edição por hotspot [FÓRUM: “Setting sidelight width”].

> **NÃO CONFIRMADO:** as fórmulas exatas de rateio (se o montante conta como frame width, se o transom usa frame width ou largura própria). A documentação lida não traz a equação; os valores são calculados no Parameter Script da biblioteca. Provável local: scripts `gs_general_lt_door` / `GS Door Functions` da library INT.

### 8.3 Abertura, tipo e ângulo por componente

- **Opening Direction** do sidelight/transom: `Same as Leaf` ou `Opposite to Leaf` [DOC: Ajuda “Opening Type and Angle”; AC18 “Leaf, Sash and Opening Direction”].
- **Opening Type** e **3D Opening Angle/Distance** são definidos **por componente** (folha, sidelight, transom). Em correr, o campo é distância, não ângulo [DOC: Ajuda “Opening Type and Angle”].
- O **2D Opening Angle** também é por componente; o símbolo pode mostrar a folha e os painéis em posições diferentes das do 3D [DOC: ibid.].
- **Flip** inverte a direção da folha e dos sidelights/transom de uma vez, mantendo o batente [DOC: Ajuda “Leaf, Sash and Opening Direction”; “Preview and Positioning”].

### 8.4 Sash/grid dos painéis

- A página **Sash Type** permite escolher o tipo de sash/transom, a divisão (nº de panes horizontal/vertical), a posição do grid (`Inside`, `Outside`, `Throughout`) e `Uniform Sashes` para usar o mesmo tipo em todos [DOC: AC18 “Sidelight and Transom Sash Type”].
- O tipo **Editable Grid** permite editar as divisões graficamente por hotspots [DOC: ibid.].

### 8.5 Tabela-resumo

| Campo (EN) | O que faz | Valores | Onde |
|---|---|---|---|
| `Shape` (configuração) | liga/desliga e arranja folha, sidelight(s), transom | combinações gráficas | Shape |
| `Sidelight Width` | largura do sidelight | comprimento (hotspot/Tab) | Shape / hotspot |
| `Transom Height` | altura da bandeira | comprimento (hotspot) | Shape / hotspot |
| `Opening Direction` (sidelight/transom) | direção relativa à folha | Same as Leaf / Opposite to Leaf | Opening Type and Angle |
| `Opening Type` (por componente) | modo de abertura | Side Hung / Fixed / Sliding / etc. | Opening Type and Angle |
| `2D Opening Angle` | ângulo no símbolo | graus | Opening Type and Angle |
| `3D Opening Angle/Distance` | ângulo/distância no modelo | graus ou comprimento | Opening Type and Angle |
| `Sash Type` | tipo de sash/transom | lista | Sash Type |
| `Uniform Sashes` | mesmo tipo para todos | checkbox | Sash Type |
| `Grid Position` | grid dentro/fora/atravessando | Inside / Outside / Throughout | Sash Type |
| `Editable Grid` | divisões editáveis por hotspot | tipo de sash | Sash Type |

Fonte: [DOC: Ajuda “Shape”; “Opening Type and Angle”; AC18 “Sidelight and Transom Sash Type”; FÓRUM “Setting sidelight width”].

---

## 9 · Pergunta 7 — símbolo 2D × modelo 3D

### 9.1 O símbolo não é um corte “comum”

- O GDL tem um comportamento especial: **o símbolo 2D é gerado a partir de uma projeção interna própria**, que o usuário não acessa — descrita como “vista lateral de cabeça para baixo, a 90°” [DOC: GDL Reference “Doors and Windows”].
- O símbolo e a forma 3D são ajustados à origem pelo **centro inferior da bounding box**; **não há ajuste em Z**. Isso permite projetar o objeto para fora da parede [DOC: ibid.].
- Na prática, o autor do objeto desenha o **símbolo 2D no 2D Script** (`POLY2`, `LINE2`, `ARC2`, `HOTSPOT2`), e o **modelo 3D no 3D Script** (`PRISM_`, `RECT`, `BLOCK`, etc.). São dois desenhos independentes que compartilham parâmetros [DOC: GDL Basics 17].
- Por isso o símbolo pode mostrar a folha aberta a 90° enquanto o 3D está fechado, ou usar um ângulo 2D diferente do 3D [DOC: Ajuda “Opening Type and Angle”].

### 9.2 Modos de exibição em planta

| `Floor Plan Display` | O que mostra | Quando usar |
|---|---|---|
| **Symbolic** (padrão) | símbolo padrão do objeto, definido no 2D Script, **independente** do 3D | planta padrão; esquadria “desenhada” |
| **Overhead All** | símbolo com atributos de “acima do plano de corte” | elementos acima do cut plane |
| **Projected** | parte **cortada** do modelo 3D + parte não cortada abaixo | parede inclinada/complexa, quando se quer o corte real |
| **Projected with Overhead** | parte cortada + parte acima do cut plane + parte abaixo | idem, com overhead |

Fonte: [DOC: Ajuda “Symbolic vs. Projected”; “Floor Plan Display of Doors/Windows”].

- Em **parede inclinada**, a recomendação oficial é usar **Projected** ou **Projected with Overhead** para ver o corte real [DOC: Ajuda “Symbolic vs. Projected”].
- No modo **Projected**, as partes do frame/sash usam a **Contour Pen** para as superfícies cortadas; no modo **Projected with Overhead**, as partes 3D usam as penas 3D [DOC: AC18 “Frame Style and Dimensions”].
- O símbolo simbólico pode ser **desligado** (`Detail Level 2D = Off`) ou **sensível à escala** [DOC: Ajuda “Detail Level”].

### 9.3 Níveis de detalhe

| Dimensão | Opções | Padrão | Onde |
|---|---|---|---|
| **3D Detail Level** | By MVO / Full / Simplified / Schematic / Off | By MVO | Settings and Opening → Detail Level |
| **2D Detail Level** | By MVO / Scale Sensitive / fixed scale (ex.: 1:200) / Off | By MVO | idem |
| **MVO – Detail Level of Door and Window Symbols** | níveis por vista (planta, corte/elevação, 3D) | conforme combination | Document → Model View → Model View Options |

- **Off** no 3D mostra **apenas o vão vazio**; **Off** no 2D não mostra símbolo nenhum [DOC: Ajuda “Detail Level”; “Door/Window Settings and Opening” (AC27)].
- As opções de **2D** e **3D** são independentes; é possível ter símbolo completo em planta e modelo esquemático em 3D [DOC: Ajuda “Detail Level”].
- A página **Floor Plan and Section** controla: `Show Reveal on Symbol` (escala mínima para mostrar o revelo), `Wall Contour Lines`, `Use Fills`, penas de corte/não cortado/overhead [DOC: Ajuda “Floor Plan and Section Tab Page”].
- **Opening Lines** (linhas de abertura/arco) são configuradas separadamente para **2D simbólico** e **projeções 3D**, com orientação `Hinges` ou `Handle` [DOC: Ajuda “Opening Lines”; MVO “Detail Level of Door and Window Symbols”].

### 9.4 Resumo da resposta

**O símbolo 2D padrão é simbólico (script), não um corte automático do 3D.** O ArchiCAD oferece o modo **Projected** justamente para quem quer o corte do modelo; mas o padrão da biblioteca INT é **Symbolic**, com desenho próprio e ângulo 2D próprio. O acoplamento com o 3D é feito **pelos mesmos parâmetros**, não pela geometria [DOC: GDL Reference; Ajuda “Symbolic vs. Projected”; “Opening Type and Angle”].

---

## 10 · Pergunta 8 — parâmetros-chave da biblioteca INT e relações

### 10.1 Parâmetros de dimensão (fix named, `ac_*`)

| Parâmetro | Tipo | Significado | Relação | Onde |
|---|---|---|---|---|
| `A` / `B` | length | par nominal exposto (largura/altura) | recebe o par escolhido | Parameter Script |
| `ac_wallhole_width` / `_height` | length | vão cortado | = unit + tolerâncias | Nominal Sizes |
| `ac_unit_width` / `_height` | length | esquadria completa (batente incluso) | = wallhole − tolerâncias | Nominal Sizes |
| `ac_reveal_width` / `_height` | length | vão livre entre revelos | = wallhole − 2·reveal | Nominal Sizes |
| `ac_egress_width` / `_height` | length | vão livre entre batentes (portas) | = unit − 2·frame_width | Nominal Sizes |
| `ac_leaf_width` / `_height` | length | largura/altura da folha (portas) | = unit − 2·(frame_width − rebate) | Nominal Sizes |
| `tolerance` | length | folga unit×wallhole | usada nas fórmulas | Tolerances |
| `revealSize` / `bReveal` | length/bool | profundidade/flag do revelo | usado em `ac_reveal_*` | Reveal |
| `gs_frame_width` | length | largura do batente | base de egress/leaf | Frame Style |
| `gs_frame_thk` | length | espessura do batente | posição Z do batente | Frame Style |
| `gs_rebate_width` | length | rebate folha×batente | base de leaf | Frame Style |
| `gs_leaf_thk` | length | espessura da folha | clareira/egress real | Leaf and Sash |
| `gs_sash_width` / `gs_sash_thk` | length | perfil do sash | janela | Frame and Sash |
| `gs_leaf_panel_width` | length | largura do painel | folha | Leaf |
| `gs_secondleaf_w` | length | largura da 2ª folha | porta dupla | Leaf |
| `gs_pivotOffset` | length | offset do eixo pivotante | porta pivotante | [FÓRUM] |
| `gs_list_doorleafwidths` | string | lista das larguras das folhas | listagem | [FÓRUM] |

### 10.2 Parâmetros de posição e orientação

| Parâmetro | Tipo | Significado | Valores | Onde |
|---|---|---|---|---|
| `WIDO_SILL` | length (global) | profundidade do revelo / sill depth | ≥ 0 | GDL global |
| `WIDO_FRAME_THICKNESS` | length (global) | espessura nominal do batente | > 0 | GDL global |
| `WALL_THICKNESS` | length (global) | espessura da parede no eixo do vão | > 0 | GDL global |
| `WIDO_REVEAL_SIDE` | int (global) | lado do revelo (1 = lado oposto ao opening side) | 0/1; default 0 janela, 1 porta | GDL global |
| `WIDO_LEFT_JAMB` / `WIDO_RIGHT_JAMB` | length (global) | profundidade do revelo à esquerda/direita | ≥ 0 | Reveal |
| `WIDO_HEAD_DEPTH` / `WIDO_THRES_DEPTH` | length (global) | revelo no topo/peitoril | ≥ 0 | Reveal |
| `WIDO_SILL_HEIGHT` / `WIDO_HEAD_HEIGHT` | length (global) | altura nominal do peitoril/verga | ≥ 0 | Preview |
| `WIDO_RSIDE_*` / `WIDO_OPRSIDE_*` | length (global) | medidas no lado do revelo/oposto | — | GDL |
| `WIDO_ORIG_DIST` | length (global) | distância ao centro de curvatura | 0 em reta | GDL |
| `WIDO_POSITION` | length/angle (global) | offset ao longo da parede | — | GDL |
| `WIDO_ORIENTATION` | string (global) | orientação L/R | L/R | GDL |
| `SYMB_MIRRORED` | bool (global) | espelhamento em Y | 0/1 | GDL |
| `SYMB_ROTANGLE` | angle (global) | rotação 180° | 0/180 | GDL |
| `ac_revealAnchorPos` | int | âncora do revelo | 1 Face, 2 Core | dw-params |
| `ac_revealToWallCore` | length | revelo medido do core | ≥ 0 | dw-params |
| `ac_vertAnchorPos` | int | âncora vertical | 1 Sill, 2 Header | dw-params |
| `ac_hole_direction_type` | int | plano do vão | 1 Associated to Wall, 2 Vertical | dw-params |
| `ac_hole_display_option` | int | exibição em planta | 1 Projected, 2 Projected+Overhead, 3 Symbolic, 5 Overhead All | dw-params |
| `ac_openingside` | string | orientação para listagem | L/R/Custom/Fix/Sliding | dw-params |
| `ac_wido_rotation` | angle | rotação do objeto no corte | — | dw-params |
| `ac_walltype` / `ac_wallContourPolygon` | int/array | parede poligonal | 1/2 | dw-params |

### 10.3 Como se ligam (grafo de dependência)

```
A/B  ──escolha do nominal──►  ac_wallhole_*  ──tolerância──►  ac_unit_*
                                   │                              │
                                   │                              ├─► ac_egress_* ──► ac_leaf_*
                                   │                              │        (frame_width)   (rebate)
                                   ▼                              ▼
                             corte da parede               posição do batente
                             (WALLHOLE/A×B)                (WIDO_SILL + gs_frame_thk)
                                   │                              │
                                   └──────────► reveal ◄──────────┘
                                                  │
                                                  ▼
                                         Wall Closure / Turn Plaster
                                                  │
                                                  ▼
                                         alizar / peitoril / soleira
```

**Regra de ouro:** só **A/B** são “esticados” diretamente pelo usuário; todo o resto é **derivado** no Parameter Script. O par nominal escolhido (`Set as Nominal`) define qual família de dimensões A/B representa. Mudar A/B dispara recálculo em cadeia (o script testa `GLOB_MODPAR_NAME`) [DOC: GDL Tips “Nominal sizes”].

---

## 11 · Lógica de modelagem (síntese operacional)

### 11.1 Ordem de cálculo, do geral para o particular

1. **Parede** existe e tem espessura/camadas. O objeto é colocado **numa** parede; Tab escolhe entre paredes sobrepostas [DOC: Ajuda “Placing Doors or Windows”].
2. **Reveal side** é escolhido (lado “externo”, sol). Isso fixa de que face se mede o recuo [DOC].
3. **Âncora horizontal** (centro/lado) fixa o ponto de inserção [DOC].
4. **Nominal** (Wallhole/Unit/Reveal/Egress/Leaf) é escolhido; A/B recebem esse par [DOC].
5. **Tolerâncias** geram o **wallhole** a partir do unit; **oversizes** ampliam o furo [DOC].
6. **Corte** retangular A×B (ou `WALLHOLE`/`WALLNICHE`) atravessa a parede [DOC].
7. **Reveal** recua a esquadria a partir da face/core; `WIDO_SILL` posiciona o batente em Z [DOC].
8. **Batente** é gerado com `gs_frame_width`/`gs_frame_thk`; pode ou não igualar a parede [DOC].
9. **Folha/sash** são gerados com rebate e ângulo; egress/leaf derivam do unit [DOC].
10. **Wall Closure/Turn Plaster** desenham as skins no vão (2D; corte/elevação; 3D opcional) [DOC].
11. **Alizar/peitoril/soleira** são acrescentados nas faces, com offsets e overhangs [DOC].
12. **Símbolo 2D** é escolhido (Symbolic/Projected) e o **LOD** (2D/3D) é aplicado [DOC].
13. **Listagem/IFC** recebem dimensões nominais, orientação e operação [DOC].

### 11.2 O que depende do quê (para o nosso modelo de dados)

| Nosso campo | Depende de | Não pode ser independente de |
|---|---|---|
| Largura/altura nominal | escolha do tipo de nominal | wallhole, unit, reveal, egress, leaf |
| Wallhole | unit + tolerâncias + oversize | nominal escolhido |
| Reveal depth | face/core + espessura da parede | posição do batente |
| Profundidade do batente | `gs_frame_thk` ou `WALL_THICKNESS` | revelo, closure |
| Largura da folha | unit − 2·(frame − rebate) | largura do batente, rebate |
| Altura da folha | unit − (frame − rebate) | idem |
| Egress | unit − frame | largura do batente |
| Posição do alizar | aresta do batente / borda do vão | offset, espessura, overhang |
| Wall closure | nº de skins + face de contagem + reveal | composição da parede |
| Símbolo 2D | parâmetros + LOD + modo de exibição | ângulo 2D |
| Modelo 3D | parâmetros + LOD + ângulo 3D | ângulo 2D |

### 11.3 Os 8 estados de orientação

O ArchiCAD representa a orientação com **três variáveis**: `SYMB_MIRRORED` (espelho em Y), `SYMB_ROTANGLE` (180° no eixo longitudinal da parede) e `WIDO_REVEAL_SIDE` (flip). As combinações geram **8 estados**; a biblioteca precisa **desfazer** as transformações automáticas para as partes que não devem virar (peitoril, alizar, toldo) e **deixar** as que devem (folha) [DOC: GDL Reference “Doors and Windows”; GDL Basics 17].

Código oficial para desfazer (2D/3D):

```
! 2D
if round_int(SYMB_ROTANGLE) = 180 then rot2 180
if SYMB_MIRRORED then mul2 -1, 1
if WIDO_REVEAL_SIDE exor bRotated then add2 0, WALL_THICKNESS

! 3D
if round_int(SYMB_ROTANGLE) = 180 then roty 180
if SYMB_MIRRORED then mulx -1
if WIDO_REVEAL_SIDE exor bRotated then addz -WALL_THICKNESS
```

Isso é a chave para entender por que **Flip mantém o batente no lugar**: o flip espelha e desloca de volta por `WIDO_FRAME_THICKNESS` [DOC: GDL Reference; `WIDO_FRAME_THICKNESS`].

### 11.4 O que o nosso editor deve copiar (e o que não deve)

**Copiar:**
- A **cadeia de dimensionamento** com um único par nominal e derivados.
- O conceito de **reveal side** separado do **opening side**.
- O **reveal anchor** face/core.
- A distinção **wallhole × unit × reveal × egress × leaf**.
- O **rebate** como mecanismo de encaixe da folha.
- **Ângulo 2D e 3D separados**.
- **Wall closure** como representação de camadas, não como boolean.
- **LOD 2D/3D independentes** e modo **Symbolic × Projected**.

**Não copiar (ou simplificar):**
- A dependência de scripts GDL e macros da biblioteca.
- O checkbox “Frame Thickness = Wall Thickness” travado por combinações.
- A ausência de colisão automática folha×batente.
- O modelo de “8 estados” com transformações automáticas — no nosso editor, o estado pode ser explícito (lado, sentido, flip) sem espelhar geometria.

---

## 12 · Fontes

### 12.1 Ajuda oficial (Graphisoft)

| URL | Versão | Tipo | O que continha |
|---|---|---|---|
| https://help.graphisoft.com/AC/30/BRA/Topics/046_LibraryPartMaker/046_LibraryPartMaker-16.html | AC30 BRA | DOC | LPM: LOD 2D/3D, origens 2D/3D, tolerância×wallhole, fixtures padrão, parâmetros de sistema |
| https://help.graphisoft.com/AC/30/BRA/Topics/046_LibraryPartMaker/046_LibraryPartMaker-12.html | AC30 BRA | DOC | índice de atribuições LPM |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/046_LibraryPartMaker/046_LibraryPartMaker-16.htm | AC28 INT | DOC | mesma matéria em inglês (conferência) |
| https://help.graphisoft.com/AC/20/INT/AC20Help/03_1_Elements_Virtual_Building/03_1_Elements_Virtual_Building-209.htm | AC20 INT | DOC | custom components; redimensionamento proporcional do Door Leaf |
| https://help.graphisoft.com/AC/27/INT/_AC27_Help/040_ElementsVB/040_ElementsVB-297.htm | AC27 INT | DOC | exemplo de folha customizada; rotação 90° do desenho de planta |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-1.htm | AC28 INT | DOC | índice do Custom Settings |
| .../151_DoorWindowCustomSettings-2.htm | AC28 INT | DOC | Nominal Sizes and Tolerance; wallhole/unit/egress/leaf |
| .../151_DoorWindowCustomSettings-3.htm | AC30 INT | DOC | Shape (imagem) |
| .../151_DoorWindowCustomSettings-4.htm | AC28 INT | DOC | Settings and Opening; Frame Style; Natural Ventilation |
| .../151_DoorWindowCustomSettings-5.htm | AC28 INT | DOC | Frame Style and Dimensions; Frame Thickness = Wall Thickness |
| .../151_DoorWindowCustomSettings-9.htm | AC28 INT | DOC | Leaf and Sash Dimension |
| .../151_DoorWindowCustomSettings-13.htm | AC28 INT | DOC | Opening Type and Angle; 2D/3D; sidelight/transom |
| .../151_DoorWindowCustomSettings-15.htm | AC28 INT | DOC | Wall Opening; oversizes; wall opening surface |
| .../151_DoorWindowCustomSettings-16.htm | AC28 INT | DOC | Reveal Settings |
| .../151_DoorWindowCustomSettings-17.htm | AC28 INT | DOC | Wall Closure; closure types; turn plaster; custom closure |
| .../151_DoorWindowCustomSettings-18.htm | AC28 INT | DOC | Wall Inset |
| .../151_DoorWindowCustomSettings-20.htm | AC28 INT | DOC | Tolerances |
| .../151_DoorWindowCustomSettings-21.htm | AC28 INT | DOC | Hole Surface’s Split is Curved |
| .../151_DoorWindowCustomSettings-26.htm | AC28 INT | DOC | Casing Outside/Inside |
| .../151_DoorWindowCustomSettings-29.htm | AC28 INT | DOC | Floor Plan and Section; override de atributos |
| https://help.graphisoft.com/AC/30/INT/Topics/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-10.html | AC30 INT | DOC | Settings of Library Part Elements |
| .../150_UserInterfaceToolSettings-16.html | AC30 INT | DOC | Door/Window Tool Settings; painéis |
| .../150_UserInterfaceToolSettings-17.html | AC30 INT | DOC | Preview and Positioning; Reveal; Anchor face/core; Flip; Anchor Point; Opening Plane |
| .../150_UserInterfaceToolSettings-18.html | AC30 INT | DOC | Where to Set Door/Window Parameters |
| .../150_UserInterfaceToolSettings-19.html | AC30 INT | DOC | Symbolic vs Projected |
| .../150_UserInterfaceToolSettings-20.html | AC30 INT | DOC | Other panels; reveal controls legado; dimension marker; subfloor |
| https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-306.html | AC30 INT | DOC | Placing Doors or Windows; sol/reveal side; 4 setas; Flip |
| .../040_ElementsVB-308.html | AC30 INT | DOC | Floor Plan Display; MVO |
| .../040_ElementsVB-309.html | AC30 INT | DOC | Slanted/complex walls; Opening Plane |
| .../040_ElementsVB-310.html | AC30 INT | DOC | Sill/Header Heights; referências |
| .../040_ElementsVB-312.html | AC30 INT | DOC | Anchor Reveal (face/core) |
| .../040_ElementsVB-313.html | AC30 INT | DOC | Empty Opening |
| https://help.graphisoft.com/AC/30/INT/Topics/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-3.html | AC30 INT | DOC | Shape |
| .../151_DoorWindowCustomSettings-31.html | AC30 INT | DOC | Detail Level (By MVO / Fixed) |
| https://help.graphisoft.com/AC/30/INT/Topics/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-40.html | AC30 INT | DOC | MVO Detail Level of Door and Window Symbols |
| https://help.graphisoft.com/AC/27/INT/_AC27_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-4.htm | AC27 INT | DOC | Detail Level 2D/3D; Off = vão vazio |
| https://help.graphisoft.com/AC/26/INT/_AC26_Help/150-1_DoorWindowCustomSettings/150-1_DoorWindowCustomSettings-14.htm | AC26 INT | DOC | Opening Lines; 2D simbólico × 3D |
| https://help.graphisoft.com/AC/26/INT/_AC26_Help/150-1_DoorWindowCustomSettings/150-1_DoorWindowCustomSettings-15.htm | AC26 INT | DOC | Opening Lines – Sidelight/Transom |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/050_ViewsVB/050_ViewsVB-117.htm | AC28 INT | DOC | Core/Finish/Other; skins adjacentes |
| https://help.graphisoft.com/AC/25/INT/_AC25_Help/020_Configuration/020_Configuration-54.htm | AC25 INT | DOC | Composite Structures; skins/core |
| https://help.graphisoft.com/AC/29/INT/_AC29_Help/040_ElementsVB/040_ElementsVB-272.htm | AC29 INT | DOC | interseções; parede-laje com abertura rente ao topo da laje |
| https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-33.htm | AC18 INT | DOC | índice da GUI do Door |
| .../Appendix_Tools-37.htm | AC18 INT | DOC | Frame Style 1/2/3; door stop; recess |
| .../Appendix_Tools-38.htm | AC18 INT | DOC | Leaf/Sash; Same as Leaf/Opposite |
| .../Appendix_Tools-40.htm | AC18 INT | DOC | Sidelight/Transom Sash Type |
| .../Appendix_Tools-46.htm | AC18 INT | DOC | Wall Closure detalhado; plaster wrapped × custom |
| .../Appendix_Tools-48.htm | AC18 INT | DOC | Inside Casing |
| .../Appendix_Tools-66.htm | AC18 INT | DOC | Wall Closure (janela) |

### 12.2 GDL Center (oficial)

| URL | Tipo | O que continha |
|---|---|---|
| https://gdl.graphisoft.com/ | DOC | índice |
| https://gdl.graphisoft.com/reference-guide | DOC | índice do Reference Guide |
| https://gdl.graphisoft.com/reference-guide/doors-and-windows/ | DOC | origem 3D/2D, projeção especial do símbolo, 8 estados, WALLHOLE/WALLNICHE/WALLHOLE2/WALLBLOCK2/WALLLINE2/WALLARC2 |
| https://gdl.graphisoft.com/reference-guide/wall-door-window-and-wall-end-parameters/ | DOC | WIDO_*, WALL_*, skins |
| https://gdl.graphisoft.com/reference-guide/dw-params/ | DOC | ac_hole_*, ac_revealAnchorPos, ac_revealToWallCore, ac_openingside |
| https://gdl.graphisoft.com/reference-guide/opening-parameters/ | DOC | OPENING_* (altura/largura/peitoril/verga; símbolo) |
| https://gdl.graphisoft.com/gdl-basics/simple-doors-and-windows/ | DOC | origem, A/B, WIDO_SILL, frame/sash/glass, flipping, 2D symbol |
| https://gdl.graphisoft.com/gdl-basics/advanced-doorwindow-functions/ | DOC | trapezoid/curved/slanted; WALLHOLE/WALLNICHE |
| https://gdl.graphisoft.com/tips-and-tricks/nominal-sizes-automatic-dimensioning/ | DOC | fórmulas wallhole/unit/reveal/egress/leaf; GLOB_MODPAR_NAME |
| https://gdl.graphisoft.com/tips-and-tricks/reveal-options-automatic-or-scripted/ | DOC | reveal automático × script; WIDO_*_JAMB/HEAD/THRES; ac_wido_hide_options; AC_WallContours |
| https://gdl.graphisoft.com/tips-and-tricks/door-window-orientation/ | DOC | WIDO_ORIENTATION; ac_openingside; L/R/Fix/Sliding |

### 12.3 API e suporte

| URL | Tipo | O que continha |
|---|---|---|
| https://archicadapi.graphisoft.com/documentation/api_windowtype-api_doortype | DOC (API) | `revealDepthLocation` (Side/Core), `revealDepthOffset`, `revealDepthFromSide`, `jambDepth*`, `fixPoint` |
| https://support.graphisoft.com/hc/en-us/articles/20228579684881-How-to-add-an-Insulated-Reveal-to-a-Window-in-Archicad | Suporte oficial | Insulated Reveal; Turn-in Skin; Reveal to Wall Core |
| https://support.graphisoft.com/hc/en-us/articles/25932544502545-Can-I-control-the-skin-end-lines-on-my-composite-wall | Suporte oficial | skin end lines em aberturas |
| https://support.graphisoft.com/hc/en-us/articles/37841033418897-Edges-of-composite-walls-are-invisible-at-door-openings | Suporte oficial | linhas de fim de skin em portas |
| https://support.graphisoft.com/hc/en-us/articles/22598312495761-Door-leaf-type-not-updating-on-elevation | Suporte oficial | MVO Detail Level em corte/elevação |
| https://support.graphisoft.com/hc/en-us/articles/24257450192529-Opening-lines-of-Doors-and-Windows-are-not-showing-in-schedules | Suporte oficial | opening lines em schedules |

### 12.4 Biblioteca AC9 SE (documentação oficial arquivada)

| URL | Tipo | O que continha |
|---|---|---|
| https://graphisoft.com/support/archicad/documentation/library-2/archive_ac9_se/us/windows/5-2/ | DOC (AC9 SE; URL hoje 404, conteúdo indexado) | Casing Trim, Brick Molding, offsets, overhang, jamb extension, masonry opening |
| https://gsdownloads.blob.core.windows.net/archive/ftp/techsupport/downloads/library_updates/documentation/AC9_SE_Illustrated_Windows.pdf | DOC (PDF oficial) | mesma matéria, §5.4 |
| https://gsdownloads.blob.core.windows.net/archive/ftp/techsupport/downloads/library_updates/documentation/AC9_SE_Illustrated_Doors.pdf | DOC (PDF oficial) | idem para portas |

### 12.5 Comunidade (apoio)

| URL | Tipo | O que continha |
|---|---|---|
| https://community.graphisoft.com/t5/Libraries-objects/Finish-Issue-for-Wall-Cavity-Closure-on-Empty-Door-Openings/td-p/290089 | FÓRUM (resposta oficial) | closure não é 3D; “Symbolic” resolve planta; “Projected” não mostra skin |
| https://community.graphisoft.com/t5/Libraries-objects/Turning-skins-in-composite-walls/td-p/163232 | FÓRUM (resposta oficial) | skins dobradas não entram em quantitativos |
| https://community.graphisoft.com/t5/Libraries-objects/Setting-sidelight-width-Part-1/td-p/231572 | FÓRUM | “Sidelight Width” via hotspot/Tab |
| https://community.graphisoft.com/t5/Libraries-objects/Door-with-sidelight-sizing/td-p/229144 | FÓRUM | esticar sidelight mantendo a folha |
| https://community.graphisoft.com/t5/Libraries-objects/Various-Casing-Dimensions/td-p/241040 | FÓRUM | larguras de casing por lado/ganging |
| https://community.graphisoft.com/t5/Libraries-objects/Casing-overlap-dimension/td-p/373157 | FÓRUM | offset de casing limitado; leitura da parede |
| https://community.graphisoft.com/t5/Libraries-objects/Door-Jamb-Glitch/td-p/238022 | FÓRUM | reveal depth × frame thickness; leaf rebate depth |
| https://community.graphisoft.com/t5/Libraries-objects/Frame-Depth-in-Door-Schedule/td-p/281611 | FÓRUM | “frame depth” não existe; é Frame Thickness |
| https://community.graphisoft.com/t5/Libraries-objects/Door-and-Window-Frame-to-Match-wall-depth/td-p/31026 | FÓRUM | frame thickness = wall thickness |
| https://community.graphisoft.com/t5/Libraries-objects/door-frame-and-wall-thickness/td-p/108475 | FÓRUM | dependência de “Wall Type” (Stud/Solid) |
| https://community.graphisoft.com/t5/Libraries-objects/Door-s-clear-opening-width-UK-Documentation-for-planning/td-p/630470 | FÓRUM | fórmulas `gs_frame_width`, `gs_rebate_width`, `gs_leaf_thk` |
| https://gdl.graphisoft.com/forums/topic/find-number-of-hinge-door-leafs/ | FÓRUM | `gs_pivotOffset`, `gs_secondleaf_w`, `gs_list_doorleafwidths` |

---

## 13 · Lacunas (o que não fechamos)

| # | Lacuna | Status | Onde provavelmente está |
|---|---|---|---|
| 1 | Frase literal de que o wallhole **atravessa todas as skins** | *[INFERIDO]* | GDL Reference de `WALLHOLE` + help de Wall Closure; não há frase única |
| 2 | Equação exata da **posição Z do batente** (face, core, centro) | *[INFERIDO]* | GDL `WIDO_SILL` + `gs_frame_thk`; scripts da library |
| 3 | Offset exato do **eixo da dobradiça** em relação à face do batente | *[NÃO CONFIRMADO]* | macros `gs_general_lt_door` / door panel; não há doc |
| 4 | **Colisão automática** folha×batente/parede | *[NÃO CONFIRMADO]* — provavelmente **não existe** | não há doc; a biblioteca só limita ranges |
| 5 | Nomes exatos dos campos de **casing** na library AC28+ (width/thickness/offset) | *[NÃO CONFIRMADO]* | help moderno é imagem; AC9 SE tem os nomes históricos |
| 6 | Fórmulas de **rateio sidelight/transom** (montante, transom, frame) | *[NÃO CONFIRMADO]* | Parameter Script da library INT |
| 7 | Nome exato de **Transom Height** / **Sidelight Width** na UI moderna | *[NÃO CONFIRMADO]* | página Shape (imagem); hotspots |
| 8 | Profundidade do **Wall Closure** como campo separado | *[NÃO CONFIRMADO]* — aparenta ser o reveal | help não expõe campo |
| 9 | Lista completa dos **Closure Types** por versão | Parcial [DOC] | help diz “varia conforme o reveal”; AC18 lista Traditional/Prefabricated/Custom; suporte lista Insulated Reveal |
| 10 | Se **Wall Closure afeta 3D** na library atual | Parcial [DOC] — só Turn Plaster com “Show in 3D” | help AC28/AC30; fórum diz que stock não mostra skin em 3D |
| 11 | Disponibilidade de **Leaf Undercut** por país/biblioteca | *[NÃO CONFIRMADO]* | varia (FR tem; UK/US não) |
| 12 | Semântica do **reveal side** para portas (default 1) × janelas (default 0) | [DOC] para o default; semântica de colocação | GDL `WIDO_REVEAL_SIDE`; help “Placing” |
| 13 | Diferenças **LPM × INT library** na parametrização | Parcial [DOC] | LPM docs; library packages |
| 14 | Valores **default** de muitos campos (tolerância, frame width, rebate) | *[NÃO CONFIRMADO]* | variam por library/versão; não são universais |
| 15 | `gs_pivotOffset` — nome e disponibilidade em todas as versões | *[FÓRUM]* | scripts de portas pivotantes |

### 13.1 O que faria fechar as lacunas

- Abrir os **scripts GDL** da library INT (Parameter Script de `gs_general_lt_door` e `GS Door Functions`) — é onde estão as fórmulas de rateio, o eixo e os defaults.
- Comparar **AC27 × AC28 × AC30** no Library Part Editor, com “All Parameters” visível.
- Testar no ArchiCAD: variar `WIDO_SILL`, `gs_frame_thk`, `gs_rebate_width` e medir o 3D; variar ângulo 3D e verificar interseção.
- Consultar o **Profile Manager** para paredes complexas (o plano do vão em paredes complexas é definido pela camada “Opening Reference”).

