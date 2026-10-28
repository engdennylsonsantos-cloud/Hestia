# R1 · ArchiCAD — Configuração de portas (diálogo e abas)

Pesquisa para o Hestia. Data: 2026-10-26. Escopo: ferramenta **Porta** do ArchiCAD e biblioteca **INT** (Internacional), com foco no diálogo *Door Settings* / *Configurações da Porta*, campo por campo, e no efeito de cada opção em planta, corte/elevação e 3D.

**Marcações usadas**
- **[DOC]** página oficial da Graphisoft lida nesta rodada (URL na §Fontes).
- **[FÓRUM/LOJA]** comunidade, tutorial ou catálogo de apoio.
- **[INFERIDO]** dedução nossa, com o raciocínio explícito.
- **NÃO CONFIRMADO** — não achei fonte ou a página não detalha o suficiente.

> Observação importante: a documentação da Graphisoft descreve o *painel* e o *significado* dos parâmetros, mas **não publica a lista completa de valores dos pop-ups** (nomes de estilos de folha, de maçaneta, de soleira etc.). Esses valores vêm do objeto GDL carregado e variam com a versão da biblioteca. Onde a lista não foi confirmada, está marcado.

---

## 1 · Resumo executivo

1. A porta do ArchiCAD é um **objeto GDL paramétrico** inserido numa parede; o diálogo é dividido em **browser de biblioteca** (esquerda) e **painéis** (direita). O painel central chama-se genericamente **Custom Settings** e muda de nome conforme o objeto (“Hinged Door Settings”, “Sliding Door Settings” etc.) [DOC].
2. Os painéis fixos do diálogo são: **Preview and Positioning**, **Custom Settings**, **Floor Plan and Section**, **Dimension Marker**, **Marker Custom Settings** (condicional) e **Classification and Properties**; **Model** e **Reveal** existem, mas não aparecem por padrão [DOC].
3. O Custom Settings é uma **hierarquia de abas**; a Graphisoft recomenda começar por três: **Settings and Opening**, **Wall Opening** e **Fixtures and Fittings**. As demais são detalhamento [DOC].
4. **Tamanho nominal** pode ser definido por quatro réguas: **Wallhole**, **Unit**, **Egress** e **Leaf**. A escolha afeta o campo “Nominal W x H” do mapa e as cotas automáticas [DOC].
5. **Tolerances** (folga de montagem) aumentam o vão cortado na parede, mas **não** mudam o tamanho nominal; **Oversize** (na aba Wall Opening) também aumenta o corte e também não muda o nominal [DOC].
6. A folha tem **estilo** (leaf type) escolhido por miniatura; há estilos de grade (**H-V Grid**, **French Panel**, **Prairie Style**) com mullions **Inside/Outside/Throughout**, além de **Custom** para folha desenhada pelo usuário [DOC].
7. A **Opening Type** é escolhida *por componente* (folha, luz lateral, bandeira) e limita o **Frame Style**; há **ângulo 2D e 3D separados** e, em correr, o valor vira **distância** [DOC].
8. O **Frame Style** tem **três estilos** (1 simples; 2 e 3 com batente/parada e rebaixo da folha). Em abertura **double-egress** o estilo mais simples (**Block**) é forçado [DOC/AC18].
9. **Sidelight/Transom** têm direção **Same as Leaf / Opposite to Leaf**, tipo de abertura e ângulo/distância próprios; o **Board** só faz sentido com luz lateral elevada [DOC].
10. **Reveal** (requadro) tem tipo e profundidade; a profundidade ancora na **face** ou no **núcleo** da parede composta. Mudar a composição da parede com âncora no núcleo preserva o alinhamento [DOC].
11. **Wall Closure** dobra camadas da parede composta para dentro do batente; **Turn Plaster** é independente, mas **não coexiste com Casing** [DOC].
12. **Casing** interno/externo, **Threshold** (soleira), **Sill** (peitoril), **Board**, **Sunshade** e **Masonry Arch** são “fixtures” opcionais, cada um com aba própria e atributos 2D/3D [DOC].
13. A exibição em planta é uma escolha explícita: **Symbolic** (padrão), **Overhead All**, **Projected** ou **Projected with Overhead**. O símbolo simbólico é independente do modelo 3D [DOC].
14. O **Model View Options** global controla “porta inteira / só vão / esconder”, marcadores, maçanetas, **Opening Lines** e o **nível de detalhe** dos símbolos; o tipo pode sobrescrever as Opening Lines [DOC].
15. Para o nosso editor, o desenho mais produtivo é copiar a **hierarquia** (poucas abas principais + detalhes opcionais), separar **dimensão nominal × vão × folha**, e tratar abertura, batente, requadro e guarnições como **componentes independentes** — que é exatamente o que o GDL faz.

---

## 2 · Estrutura do diálogo

### 2.1 Partes fixas

| Parte | Conteúdo | Fonte |
|---|---|---|
| Browser de biblioteca (esquerda) | Pastas/ícones, busca, favoritos, subtypes, “folder view with sources”; escolhe o objeto | [DOC AC28 150-9] |
| Preview and Positioning | Largura, altura, peitoril/padieira e referência, reveal, flip, anchor point, opening plane, prévia | [DOC AC28 150-16] |
| Custom Settings | Interface gráfica do objeto; nome varia (Hinged/Sliding/…); abas detalhadas abaixo | [DOC AC28 151-1] |
| Floor Plan and Section | Atributos 2D simplificados (corte, vista, acima) e *Floor Plan Display* | [DOC AC28 150-18 / 151-29] |
| Dimension Marker | Marcador GDL, subfloor thickness, texto | [DOC AC28 150-19] |
| Marker Custom Settings | Interface do marcador escolhido; fica cinza se não houver marcador | [DOC AC28 150-15] |
| Classification and Properties | Classificação/IFC e propriedades do elemento | [DOC AC28 150-15] |
| Model (não visível por padrão) | Uma única superfície para a porta/janela | [DOC AC28 150-19] |
| Reveal (legado, não padrão) | Head depth, sill/threshold depth, jamb depth, reveal depth para objetos fora da biblioteca padrão | [DOC AC28 150-19] |

### 2.2 “Empty Opening”

O botão **Empty Opening** limpa a escolha de biblioteca e usa um **vão vazio** (buraco), sem objeto de porta. Serve para estudar o corte da parede e para aberturas sem esquadria [DOC AC28 150-15].

### 2.3 Onde ficam os parâmetros

A Graphisoft explica que os mesmos parâmetros existem em dois formatos: **Custom Settings** (gráfico, agrupado em abas, com figuras) e **All Parameters** (lista). No AC28 o diálogo lista o painel **Custom Settings**; no AC18 havia também um painel **Parameters** separado e a opção *All Parameters* [DOC AC28 150-17; DOC AC18 150-29].

---

## 3 · Custom Settings — aba por aba

### 3.1 Nominal Sizes and Tolerance (Tamanhos Nominais e Tolerância)

| Campo / opção | O que faz | Valores | Padrão |
|---|---|---|---|
| Wallhole Dimensions | Vão bruto recortado na parede | Largura = Unit + tolerâncias laterais; altura = Unit + tolerância superior | — |
| Unit Dimensions | Tamanho da estrutura completa da abertura (batente incluso) | L × A | — |
| Egress Dimensions | Vão livre de passagem = largura Unit − largura do batente | L | — |
| Leaf Dimensions | Dimensão da folha | L × A | — |
| **Set as Nominal** | Escolhe qual das quatro réguas é o “Nominal Size” | Wallhole / Unit / Egress / Leaf | — |
| **Transfer Current Nominal Size to Selection** | Ao trocar a régua nominal, transfere os valores antigos para a nova régua e recalcula o resto | on/off | — |
| **Show Dimensions in Marker** | Dimensão exibida no marcador | Wallhole / Unit / Leaf / Egress | — |
| **Uniform Tolerances** | Uma tolerância para todos os lados + tolerância superior | on/off | on |
| Tolerances (atalho) | Vai à aba Tolerances para variar por lado | — | — |

A definição escolhida também alimenta **Automatic Dimensioning** e o **Interactive Schedule** (campo “Nominal W x H Size”) [DOC AC28 151-2].

### 3.2 Shape (Forma)

Define a **configuração** da porta: quantas folhas, luz lateral esquerda/direita, bandeira superior e suas divisões. A página é essencialmente gráfica (miniaturas/ícones); a documentação não lista os campos textualmente [DOC AC28 151-3; DOC AC18 151-36]. **NÃO CONFIRMADO**: nomes exatos dos combos (ex.: “Number of Leaves”, “Sidelight Left/Right”, “Transom”) — a página não os transcreve.

### 3.3 Door/Window Settings and Opening (Definições e Abertura) — aba “principal”

| Campo | O que faz | Valores | Onde mais aparece |
|---|---|---|---|
| **Door Leaf** | Estilo da folha | lista de miniaturas + **Custom** | aba Door Leaf Type |
| **Handle** | Estilo da maçaneta | lista de miniaturas | aba Handle and Kick Board |
| **Opening Type** | Como a folha abre, por componente | depende do objeto (ver §4) | aba Opening Type and Angle |
| **Frame Style** | Estilo do batente | 3 estilos; **Block** forçado em double-egress | aba Frame Style and Dimensions |
| **Natural Ventilation** | Existe ventilação? Onde? | off / **over Frame** / **over Glazing** | aba Natural Ventilation |

Cada campo tem um ícone à direita que “salta” para a aba detalhada correspondente [DOC AC28 151-4].

### 3.4 Frame Style and Dimensions (Estilo do Batente/Marco e Dimensões)

| Campo | O que faz | Valores | Observações |
|---|---|---|---|
| **Frame Style** | Perfil do batente | 3 estilos (1 = mais simples; 2 e 3 acrescentam **door stop** e **recesso** da folha) | double-egress força o mais simples |
| **Frame Width** | Largura do batente | mm | **Uniform Frame Width** on/off para variar por lado |
| **Frame Thickness** | Espessura do batente | mm | |
| **Frame Thickness = Wall Thickness** | Iguala batente à parede | on/off | |
| **Uniform Frame Thickness** | Espessura única | on/off; fica cinza até “= Wall Thickness” e todas as folhas abrirem no mesmo sentido | |
| Leaf / Glass thickness | Espessura da folha e do vidro | mm | conforme o estilo |

A documentação cita “frame width and thickness, and the thickness of the leaf and glass”, sem nomes de campo individuais [DOC AC28 151-5; DOC AC18 151-37].

**Em janelas**, as abas equivalentes são **Frame and Sash** (joinery **Mitered/Butt Joint**, **Uniform Frame Width**) e **Frame Widths** (largura por lado quando a uniforme está desligada) [DOC AC28 151-11/12]. O mesmo conceito aparece no batente da porta, mas com nomes de aba próprios.

### 3.5 Natural Ventilation (Ventilação Natural)

| Campo | O que faz | Valores |
|---|---|---|
| **Natural Ventilation** | Liga o componente | on/off |
| Posição | Onde fica o perfil | **over Frame** / **over Glazing** |
| Altura / largura do perfil | Dimensões do perfil ventilado | mm (por folha, se aplicável) |
| Atributos | Preenchimento em corte | definidos na aba Floor Plan and Section |

[DOC AC28 151-6]

### 3.6 Door Leaf Type (Tipo de Folha)

| Campo | O que faz | Valores |
|---|---|---|
| Lista/miniaturas | Estilo da folha | estilos predefinidos; em alguns, largura do caixilho ajustável |
| **Grid style** | Folha com divisões | **H-V Grid**, **French Panel**, **Prairie Style** |
| **Position** (grades) | Onde ficam os mullions | **Inside** / **Outside** / **Throughout** |
| **Custom** | Usa folha desenhada e salva como componente | objeto “Door Leaf” da biblioteca embutida |

A folha personalizada é criada desenhando elementos 3D, salvando em *File > Libraries and Objects > Save Selection as > Door Leaf* e escolhendo **Custom** no diálogo [DOC AC28 151-7; DOC AC26 040-296/297].

### 3.7 Handle and Kick Board (Maçaneta e Proteção de Borda)

| Campo | O que faz | Valores |
|---|---|---|
| **Handle** | Modelo da maçaneta | lista |
| **Uniform Handles** | Mesma maçaneta em todas as folhas | on/off |
| Handle height | Altura da maçaneta | mm |
| Handle position | Distância horizontal da borda da abertura | mm |
| **Kick Board Outside / Inside** | Placa de proteção na base | on/off |
| Kick board height | Altura da placa | mm |

Em portas de múltiplas folhas, cada folha pode ter maçaneta própria se **Uniform Handles** estiver desligado [DOC AC28 151-8].

### 3.8 Leaf and Sash Dimension (Dimensões da Folha e Caixilho)

Define **espessura e largura** da folha, dos caixilhos e do vidro [DOC AC28 151-9]. A página não transcreve os nomes dos campos. **NÃO CONFIRMADO**: lista exata (provavelmente Leaf Thickness, Sash Width, Sash Thickness, Glass Thickness).

### 3.9 Sash Type / Sash Options (Tipo/Opções de Caixilho)

| Campo | O que faz | Valores |
|---|---|---|
| Seleção | Qual caixilho/bandeira editar | pop-up por componente |
| **Uniform Sashes** | Um único tipo para todos | on/off |
| Padrão de mullions | Desenho da grade | lista (inclui **Editable Grid**) |
| Panes horizontais/verticais | Número de painéis | inteiros |
| Parâmetros de divisão | Posição das barras | mm/% |
| **Position** | Lado da grade | Inside / Outside / Throughout |
| **Custom Panel** | Caixilho desenhado pelo usuário | objeto “Window Sash” |

**Editable Grid** permite editar as divisões no projeto com **hotspots editáveis** [DOC AC28 151-10].

### 3.10 Opening Type and Angle (Tipo de Abertura e Ângulo)

| Campo | O que faz | Valores |
|---|---|---|
| **Opening Type** (por componente) | Modo de abertura da folha, luz lateral e bandeira | depende do objeto; ver §4 |
| **2D Opening Angle** | Ângulo mostrado no símbolo 2D | graus |
| **3D Opening Angle** | Ângulo do modelo 3D | graus; em correr vira **distância** |
| **Sidelight/Transom: Opening Direction** | Relação com a folha | **Same as Leaf** / **Opposite to Leaf** |
| Sidelight/Transom Opening Type | Modo próprio | pop-up |
| Sidelight/Transom 3D angle/distance | Abertura da luz/bandeira | graus ou mm |
| **2D & 3D Line Pen** | Caneta das linhas de abertura | número de caneta |

Os ângulos também podem ser editados **graficamente por hotspots** no projeto. O tipo de abertura escolhido **limita o Frame Style** [DOC AC28 151-13; AC18 151-41].

### 3.11 Model Attributes of Door/Window Opening (Atributos do Modelo)

| Campo | O que faz |
|---|---|
| **Shadow** | Sombra do objeto no 3D |
| **Curve Resolution** | Segmentos das partes curvas no 3D; maior = melhor, arquivo maior |
| **Frame Element Joinery** | **Mitered** ou **Butt Joint** |
| Surface materials / 3D pens | Por componente: folha, batente, grade, vidro, maçaneta e acessório |
| Frame/Leaf 3D Pen | Afeta 3D e partes “projetadas” na planta quando o display é Projected/Projected with Overhead |

[DOC AC28 151-14]

### 3.12 Wall Opening (Abertura na Parede)

| Campo | O que faz | Valores |
|---|---|---|
| **Reveal Type** | Tipo de requadro | lista + opções **No Reveal** |
| **Reveal Depth** | Profundidade do requadro | mm; também no Preview and Positioning e na aba Reveal |
| **Wall Closure** | Fechamento das camadas da parede composta | predefinido ou custom; depende do reveal |
| **Masonry Arch** | Arco de alvenaria | on/off + tipo |
| **Opening Oversizes** | Aumenta o corte à esquerda/direita/acima/abaixo | mm; não altera o nominal |
| **Wall Opening Surface** | Superfície aplicada às bordas | **Same as Wall Edge** / **Same as Wall Side** |

Em **Same as Wall Side**, a linha de divisão entre superfície externa e interna é a profundidade do reveal. Em paredes curvas, a divisão pode ser reta ou curva (ver Model Attributes of Wall Opening) [DOC AC28 151-15; 151-21].

### 3.13 Reveal Settings (Definições do Requadro)

Define **Reveal Type** e parâmetros de **Head** (padieira), **Jamb** (montante) e **Reveal Depth**. A profundidade é o mesmo valor do Preview and Positioning [DOC AC28 151-16].

### 3.14 Wall Closure (Fechamento da Parede)

| Campo | O que faz | Valores |
|---|---|---|
| **Closure Type** | Como as camadas fecham no batente | lista; **No Closure**; tipos variam com o reveal |
| **Turn Skin on Side** |Onde a camada dobra | Right / Left / Both |
| **Number of Skins to Turn** | Quantas camadas dobrar | inteiro |
| **Number from** | Origem da contagem | Outside face / Inside face |
| **Profile Width** | Largura do perfil de fechamento | mm (closure pré-fabricado) |
| **Insulation Strip** | Faixa de isolamento | on/off + espessura |
| **Turn Plaster** | Dobra o reboco, independente de closure | Automatically / número de camadas |
| **Plaster Skin Definition** | O que é “reboco” | **Use Wall Finish Component** / **Plaster Thickness Limit** |
| **Custom Closure** | Fechamento camada a camada | Left/Right/Both jamb; Turn-in Skin; Consider Skin as Plaster; thickness; hatch orientation; separating line pen |

Só afeta **2D**; o Turn Plaster aparece em corte/elevação e, se “Show in 3D”, no 3D. **Casing e Turn Plaster não podem coexistir** [DOC AC28 151-17].

### 3.15 Wall Inset (Recorte na Parede — janelas)

Apesar de a tarefa ser portas, o parâmetro aparece em objetos de janela: **Automatic**, **Symmetric**, **Asymmetric**; overhangs direito/esquerdo; altura da base (0 = até o piso); profundidade; **Show Hidden Parapet on 2D** [DOC AC28 151-18].

### 3.16 Masonry Arch (Arco de Alvenaria)

| Campo | O que faz | Valores |
|---|---|---|
| **Masonry Arch** | Liga o arco | on/off |
| **Style** | Desenho do arco | lista (inclui “Jack”) |
| **Rise** | Flecha do arco | mm |
| **Skewback angle** | Ângulo de arranque (Jack) | graus |
| **Type** | Material | **Stucco** / **Brick** |
| Brick/Mortar thickness | Espessuras | mm |
| **Keystone** | Chave do arco | width, oversize, projection |
| Height/Depth/Rear Hold Depth/Projection | Geometria do arco e do nicho atrás | mm |
| **Arch on Header** | Arco apoiado diretamente na padieira | on/off; se off, define distância |
| **Niche below Arch** | Nicho sob o arco | on/off |
| **Horizontal Overhang** | Balanço esquerdo/direito | mm |

[DOC AC28 151-19]

### 3.17 Tolerances (Tolerâncias)

**Uniform Tolerances** on: um valor lateral + **Upper Tolerance**. Off: valores por lado (esquerda, direita, superior), útil quando as luzes laterais têm peitoris diferentes [DOC AC28 151-20].

### 3.18 Fixtures and Fittings (Equipamentos e Acessórios)

| Campo | O que faz |
|---|---|
| **Casing Outside / Inside** | Liga alizar externo e/ou interno |
| **Ganging** | Alinha aberturas adjacentes horizontal/vertical; exige marcação nos dois lados; faz desaparecer linhas de junção |
| **Threshold / Sill / Board / Sunshade** | Liga o componente e escolhe o tipo |
| **Custom Corner** (janelas) | Canto personalizado direito/esquerdo |

Ganging pode desabilitar outras opções estruturais (ficam cinza) [DOC AC28 151-22].

### 3.19 Threshold Settings (Soleira)

| Campo | O que faz |
|---|---|
| **Threshold Type** | Tipo de soleira |
| **Threshold Thickness** | Espessura |
| **Nosing / Side overhangs** | Avanços, nos tipos “Extended” |

[DOC AC28 151-23]

### 3.20 Sill Settings (Peitoril)

| Campo | O que faz |
|---|---|
| **Sill** | Liga o peitoril |
| **Sill Type** | Tipo |
| **3D Detail** | **Simple** / **Detailed** |
| Thickness / Width / Angle / Nosing | Geometria |
| **Slip in Depth** | Quanto o peitoril entra sob o batente; máximo = espessura do batente; soma à largura |

[DOC AC28 151-24]

### 3.21 Board Settings (Peitoril Interno / “tábua”)

Usado quando há **luz lateral elevada**. Campos: **Board** on/off; **Is Curved in Curved Walls**; em parede poligonal, **Parallel to Wall Polygon** ou paralelo à janela [DOC AC28 151-25].

### 3.22 Casing Outside/Inside (Alizar/Guarnição)

Liga **Outside Casing** e/ou **Inside Casing** e define os parâmetros do alizar. **Não pode coexistir com Turn Plaster** [DOC AC28 151-26].

**Relação com a parede**: o alizar é aplicado na **face externa** e/ou **interna** da parede, envolvendo o vão; a profundidade do requadro é a linha de divisão entre as duas faces (é o mesmo conceito de `Wall Opening Surface = Same as Wall Side`) [DOC AC28 151-15; 151-26]. A documentação **não publica** os offsets/afastamentos do alizar em relação à face: eles vêm do tipo escolhido e do script do objeto. **[INFERIDO]** Como o alizar é uma “fixture” opcional, o posicionamento deve ser calculado a partir da face da parede (não do eixo), para permanecer correto quando a espessura ou o acabamento mudam.

### 3.23 Sunshade Settings (Toldo)

| Campo | O que faz |
|---|---|
| **Sunshade** | Liga |
| **Type** | Tipo (varia) |
| **Open in 3D** | Mostra abertura no 3D |
| **3D Opening (Angle)** | Ângulo de abertura; editável por hotspot no 3D |
| **2D Symbol** | Mostra símbolo do toldo em planta |
| **Extra Frame** | Mostra moldura do toldo no 3D |
| **Shutter Height** / **Automatic Shutter Height** | Altura da persiana |

Indisponível se a porta tem luz lateral elevada [DOC AC28 151-27].

### 3.24 Model Attributes of Fixtures and Fittings

Superfícies e canetas 3D para **Threshold, Sill, Casing, Board, Sunshade** [DOC AC28 151-28].

### 3.25 Floor Plan and Section (aba do Custom Settings)

Contém **todos os parâmetros 2D do script GDL**: linhas de contorno da parede (visíveis/ocultas), **Use Fills**, tipos de linha/caneta/trama por componente. É a via detalhada; o painel *Floor Plan and Section* do diálogo é a via simplificada (overrides) [DOC AC28 151-29].

### 3.26 Minimal Space (Espaço Mínimo)

Define folgas mínimas de utilização em cada lado da porta. Pode ser exibido em planta ligando **Minimal Space of Doors** no Model View Options; o desenho usa contorno e trama configuráveis [DOC AC28 151-30; 140-40].

---

## 4 · Opening Type: o que a documentação confirma

A documentação é explícita em poucos pontos:

- No objeto **Hinged Door** (porta de abrir), os valores são **Side Hung** e **Double-Acting** (vai-e-vem). “Outros tipos de porta podem ter opções adicionais” [DOC AC18 151-41; DOC AC18 151-35].
- Em **double-egress** (abertura dupla, duas folhas opostas), o Frame Style é forçado para **Block** [DOC AC28 151-5].
- Em portas de **correr**, o campo de 3D deixa de ser ângulo e passa a ser **distância de abertura** [DOC AC28 151-13].
- O tipo de abertura escolhido **limita os Frame Styles disponíveis** [DOC AC28 151-13].
- Há **tipos especiais** citados nas notas de biblioteca: **Top Hinged Door**, **Bottom Hinged Door**, **Bi-Fold Lift Up**, **Multipanel Sliding Door** (2 a 10 folhas), além de portas de elevador [FÓRUM: release notes AC28 LU1/LU2 e AC29, seção “Doors”].

**NÃO CONFIRMADO**: a lista fechada de valores do pop-up para cada objeto da biblioteca INT 28 (ex.: “Sliding Left/Right”, “Folding”, “Pocket”, “Revolving”, “Garage”). A documentação oficial não publica essa enumeração; ela é propriedade do GDL. Para o nosso mapeamento, o caminho seguro é tratar `Opening Type` como **string livre por família**, com um conjunto mínimo nosso (giro esquerda/direita, vai-e-vem, correr, dobrar, basculante, garagem) e marcar o resto como “custom”.

### 4.1 O que muda entre famílias (confirmado)

| Família | O que muda | Fonte |
|---|---|---|
| Hinged (abrir) | Side Hung / Double-Acting; 3 Frame Styles; maçaneta e kick board | [DOC AC18 151-35/41] |
| Sliding (correr) | Abertura por **distância**, não ângulo; opening line com seta no MVO | [DOC AC28 151-13; DOC AC28 140-40] |
| Folding / Bifold | Objeto “Sliding Folding Multipanel Bifold”; número de folhas; abertura por largura | [FÓRUM/BIMcomponents] |
| Multipanel Sliding | 2 a 10 folhas (AC28 LU1) | [FÓRUM: release note] |
| Top/Bottom Hinged | Maçaneta em posição predefinida (não editável) | [FÓRUM: release note AC29] |
| Garage | Objeto de biblioteca próprio (não é um “Opening Type” do Hinged) | [INFERIDO: a doc só descreve o Hinged; garage aparece como objeto separado em catálogos] |
| Empty Opening | Sem objeto; só o vão | [DOC AC28 150-15] |

---

## 5 · Nomes em português (UI BRA)

| Inglês (INT) | Português (BRA) |
|---|---|
| Door Settings | Definições de Porta |
| Preview and Positioning | Previsualização e Posicionamento |
| Custom Settings | Definições Personalizadas |
| Settings and Opening | Definições de Porta/Janela e Abertura |
| Nominal Sizes and Tolerance | Tamanhos Nominais e Tolerância |
| Shape | Forma |
| Frame Style and Dimensions | Estilo do Batente (Marco) e Dimensões |
| Natural Ventilation | Ventilação Natural |
| Door Leaf Type | Tipo de Folha de Porta |
| Handle and Kick Board | Maçaneta e Proteção Borda |
| Leaf and Sash Dimension | Dimensões Folha e Caixilho |
| Sash Type / Sash Options | Tipo de Caixilho / Opções de Caixilho |
| Opening Type and Angle | Tipo de Abertura e Ângulo |
| Wall Opening | Abertura da Parede |
| Reveal Settings | Definições do Requadro |
| Wall Closure | Fechamento da Parede |
| Wall Inset | Recorte na Parede |
| Masonry Arch | Arco de Alvenaria |
| Tolerances | Tolerâncias |
| Fixtures and Fittings | Equipamentos e Acessórios |
| Threshold | Soleira |
| Sill | Soleira/Peitoril |
| Board | Peitoril Interno |
| Casing Outside/Inside | Guarnição (Alizar) Externa/Interna |
| Sunshade | Toldo |
| Floor Plan and Section | Planta e Corte |
| Minimal Space | Espaço Mínimo |
| Dimension Marker | Marcador de Cota |
| Classification and Properties | Classificação e Propriedades |
| Floor Plan Display: Symbolic | Visualização em Planta: Simbólica |
| Overhead All | Tudo em Projeção |
| Projected | Vista e Corte |
| Projected with Overhead | Vista, Corte e Projeção |
| Flip | Rotacionar |
| Anchor Point | Ponto de Inserção |
| Opening Plane | Plano de Abertura |
| Subfloor Thickness | Espessura do Contrapiso (marcador) |

Fonte: páginas `/BRA/` correspondentes [DOC AC28 BRA 151-1/2/4/5/7/8/13/15/16/17/22/23/24/26/29; 150-15/16/18; 140-39/40].

---

## 6 · Fontes consultadas — parte 1 (abas do diálogo)

| URL | Versão | Tipo | Conteúdo |
|---|---|---|---|
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-1.htm | AC28 INT | DOC | Índice do Custom Settings |
| .../151_DoorWindowCustomSettings-2.htm | AC28 INT | DOC | Nominal Sizes and Tolerance |
| .../151_DoorWindowCustomSettings-3.htm | AC28 INT | DOC | Shape |
| .../151_DoorWindowCustomSettings-4.htm | AC28 INT | DOC | Settings and Opening |
| .../151_DoorWindowCustomSettings-5.htm | AC28 INT | DOC | Frame Style and Dimensions |
| .../151_DoorWindowCustomSettings-6.htm | AC28 INT | DOC | Natural Ventilation |
| .../151_DoorWindowCustomSettings-7.htm | AC28 INT | DOC | Door Leaf Type |
| .../151_DoorWindowCustomSettings-8.htm | AC28 INT | DOC | Handle and Kick Board |
| .../151_DoorWindowCustomSettings-9.htm | AC28 INT | DOC | Leaf and Sash Dimension |
| .../151_DoorWindowCustomSettings-10.htm | AC28 INT | DOC | Sash Type/Options |
| .../151_DoorWindowCustomSettings-11.htm | AC28 INT | DOC | Frame and Sash (janelas) |
| .../151_DoorWindowCustomSettings-12.htm | AC28 INT | DOC | Frame Widths (janelas) |
| .../151_DoorWindowCustomSettings-13.htm | AC28 INT | DOC | Opening Type and Angle |
| .../151_DoorWindowCustomSettings-14.htm | AC28 INT | DOC | Model Attributes of Opening |
| .../151_DoorWindowCustomSettings-15.htm | AC28 INT | DOC | Wall Opening |
| .../151_DoorWindowCustomSettings-16.htm | AC28 INT | DOC | Reveal Settings |
| .../151_DoorWindowCustomSettings-17.htm | AC28 INT | DOC | Wall Closure |
| .../151_DoorWindowCustomSettings-18.htm | AC28 INT | DOC | Wall Inset |
| .../151_DoorWindowCustomSettings-19.htm | AC28 INT | DOC | Masonry Arch |
| .../151_DoorWindowCustomSettings-20.htm | AC28 INT | DOC | Tolerances |
| .../151_DoorWindowCustomSettings-21.htm | AC28 INT | DOC | Model Attributes of Wall Opening |
| .../151_DoorWindowCustomSettings-22.htm | AC28 INT | DOC | Fixtures and Fittings |
| .../151_DoorWindowCustomSettings-23.htm | AC28 INT | DOC | Threshold |
| .../151_DoorWindowCustomSettings-24.htm | AC28 INT | DOC | Sill |
| .../151_DoorWindowCustomSettings-25.htm | AC28 INT | DOC | Board |
| .../151_DoorWindowCustomSettings-26.htm | AC28 INT | DOC | Casing |
| .../151_DoorWindowCustomSettings-27.htm | AC28 INT | DOC | Sunshade |
| .../151_DoorWindowCustomSettings-28.htm | AC28 INT | DOC | Model Attributes of Fixtures |
| .../151_DoorWindowCustomSettings-29.htm | AC28 INT | DOC | Floor Plan and Section |
| .../151_DoorWindowCustomSettings-30.htm | AC28 INT | DOC | Minimal Space |
| .../151_DoorWindowCustomSettings-31.htm | AC28 INT | DOC | Custom Corner |
| https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-33.htm | AC18 INT | DOC | Índice do Graphical Interface (porta) |
| .../Appendix_Tools-34.htm a -55.htm | AC18 INT | DOC | Todas as abas de porta (nominal, general, shape, frame, leaf, handle, sash, opening, opening lines, material, reveal, closure, threshold, casings, sill, board, sunshade, tolerances, arch, minimal space) |
| https://help.graphisoft.com/AC/28/BRA/_AC28_Help/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-1.htm e páginas 2/4/5/7/8/13/15/16/17/22/23/24/26/29 | AC28 BRA | DOC | Nomes em português |
| https://help.graphisoft.com/AC/28/BRA/_AC28_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-15/16/18.htm | AC28 BRA | DOC | Painéis e display em português |
| https://help.graphisoft.com/AC/28/BRA/_AC28_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-39/40.htm | AC28 BRA | DOC | Model View Options em português |
| https://community.graphisoft.com/gowhw84577/attachments/gowhw84577/forum-gdl/8468/2/AC28%20LU1%20-%20Release%20Note.pdf | AC28 LU1 | FÓRUM | Multipanel Sliding, portas de elevador |
| https://community.graphisoft.com/gowhw84577/attachments/gowhw84577/forum-gdl/8468/3/AC28%20LU2%20-%20Release%20Note.pdf | AC28 LU2 | FÓRUM | Correções e Detail Level Override |
| https://community.graphisoft.com/gowhw84577/attachments/gowhw84577/forum-gdl/8468/5/AC29%20Library%20-%20Release%20Note.pdf | AC29 | FÓRUM | Top/Bottom Hinged, Bi-Fold Lift Up, multipanel |

---

## 7 · Colocação, Flip, Tab e lado externo

### 7.1 Sequência de colocação [DOC AC28 040-306]

Portas e janelas **só podem ser inseridas em paredes**; não são colocadas soltas no projeto [DOC AC28 040-306].

1. Ativar a ferramenta **Porta** (ou Janela) em planta ou 3D e escolher o objeto no browser.
2. Passar o cursor sobre a parede: aparece a **pré-visualização** do vão na posição atual.
3. Se houver paredes sobrepostas no ponto, **Tab** alterna qual parede está destacada.
4. O **ícone de sol** e a **linha grossa** indicam o lado **externo** (*reveal side*) da parede. Mover o cursor para o lado oposto troca o lado externo.
5. Primeiro clique: fixa a posição. O **Anchor Point** decide se a porta é colocada pelo **centro** ou por um **lado**; pode ser trocado no Info Box durante a colocação.
6. Segundo passo: escolher o **sentido de abertura** entre quatro posições (dentro/fora × esquerda/direita), mostradas por setas. **Tab** ainda alterna o lado externo nesse momento.
7. Segundo clique: confirma a porta.

### 7.2 Flip

O botão **Flip** (Info Box ou diálogo) inverte o **sentido de abertura** de um lado para o outro, **mantendo o batente no lugar**. Não é o mesmo que girar a porta 180°: o eixo/posição do batente permanece [DOC AC28 040-306; DOC AC28 150-16].

**Lado externo depois de colocada**: a documentação oficial só descreve a troca durante a colocação (cursor/Tab). A comunidade relata que, após inserir, abre-se o diálogo e usa-se **Flip** para trocar “outside/inside” [FÓRUM community “Changing door swing”]. Isso conflita parcialmente com a descrição oficial do Flip (sentido de abertura). **NÃO CONFIRMADO**: qual controle exato troca o *reveal side* depois de a porta estar colocada; provavelmente é um parâmetro GDL (`WIDO_REVEAL_SIDE`) exposto no diálogo, mas não localizamos a página que o nomeie.

### 7.3 Edição posterior

| Ação | Comportamento | Fonte |
|---|---|---|
| **Drag / Move / Multiply** | Move a porta dentro da parede; pode atravessar paredes diferentes se os planos de referência estiverem alinhados | [DOC AC28 040-314] |
| **Rotate** | Gira 180° em torno do centro, sem vetor; troca sentido e lado da dobradiça | [DOC AC28 040-314] |
| **Mirror** | Espelha a porta e inverte lateralmente o sentido; eixo é a parede ou uma perpendicular a ela | [DOC AC28 040-314] |
| **Elevate** | Move verticalmente, disponível em planta/corte/3D para paredes retas ou inclinadas | [DOC AC28 040-314] |
| **Stretch da parede / Marquee** | Portas dentro da marquise acompanham e mantêm a posição relativa | [DOC AC28 040-314] |
| **Hotspots editáveis** | Losangos permitem editar ângulo/abertura/distância e larguras de caixilho diretamente no projeto; **Tab** no Tracker digita o valor | [DOC AC30 040-287; DOC AC18 151-41] |
| **Curvar parede** | Diálogo pergunta **Keep distance** ou **Keep proportion** para reposicionar as aberturas | [DOC AC28 040-315] |

### 7.4 Preview and Positioning — campos

| Campo | O que faz | Valores / observações |
|---|---|---|
| **Width / Height** | Tamanho nominal da abertura | É o mesmo “Nominal Size” da aba Nominal Sizes |
| **Sill/Header Value** | Altura do peitoril ou da padieira | valor numérico |
| Referência do sill/header | De onde a altura é medida | **Sill to Wall Base**, **Sill to Wall Top**, **Sill to Story**, **Header to Wall Base**, **Header to Wall Top**, **Header to Story**, **Relink Anchor Story** |
| **Reveal** | Profundidade do requadro | igual à aba Reveal |
| **Reveal anchor** | Onde o requadro se ancora | **Wall Face** / **Wall Core** (camada de núcleo mais próxima) |
| **Flip** | Inverte o sentido mantendo o batente | botão |
| **Anchor Point** | Centro ou lado | trocável no Info Box |
| **Opening Plane** | Plano em parede inclinada | **Associated to Wall** / **Vertical** |
| **Preview** | 5 modos | 2D symbol, hidden line front, hidden line axonometry, 3D shaded axonometry, predefined picture |

Fonte: [DOC AC28 150-16; AC28 040-309; AC28 040-310; AC28 040-311; AC18 151-28].

**Sill/Header e Subfloor**: o peitoril é sempre medido a partir da base da parede (ou story). O campo **Subfloor Thickness** (no painel Dimension Marker) só corrige o **valor mostrado no marcador**, não move a porta. Exemplo: base da parede 100 mm abaixo do piso, peitoril 1000 mm → marcador mostra 900 mm [DOC AC28 040-310].

**Reveal ancorado no núcleo**: se a parede composta ganhar isolamento mais grosso, a profundidade do requadro se ajusta para manter a porta alinhada ao núcleo; se a parede deixar de ter núcleo, a âncora volta para “Wall Face” e a profundidade é recalculada [DOC AC28 040-311].

---

## 8 · Exibição em planta: simbólica × projetada

### 8.1 Floor Plan Display

| Valor | O que mostra | Quando usar |
|---|---|---|
| **Symbolic** (padrão) | Símbolo 2D padrão do objeto, **independente** do modelo 3D | Documentação corrente; é o que dá o desenho “de arquiteto” |
| **Overhead All** | O símbolo 2D inteiro com atributos de linha “acima” (*overhead*) | Quando se quer o contorno acima do plano de corte |
| **Projected** | Parte cortada do modelo 3D + parte não cortada (para baixo) | Parede inclinada ou desejo de representação mais realista |
| **Projected with Overhead** | Parte cortada + parte acima do plano de corte + parte não cortada | Idem, incluindo o que está acima do corte |

Fonte: [DOC AC28 150-18; AC28 040-307].

**Consequência para o nosso editor**: em `Symbolic`, o símbolo pode mostrar folha aberta, arco de giro e maçaneta sem que o 3D exista; em `Projected`, o desenho é derivado da geometria 3D e depende do plano de corte da vista. São dois “motores” de desenho distintos, não um modo de detalhe do mesmo desenho.

### 8.2 Atributos 2D: GDL × override

Há duas camadas de atributos [DOC AC28 040-307; AC28 151-29]:

1. **Atributos GDL** definidos no Custom Settings / Parameters (linha, caneta, trama por componente: folha, batente, vidro, grade, guarnição, soleira etc.). São muitos e permitem controle fino.
2. **Atributos 2D simplificados** no painel **Floor Plan and Section**: corte, vista e “acima” (cut/uncut/overhead), com tipos de linha e canetas. Só valem se as caixas **Override Object’s Line Types / Pens / Attributes** estiverem ligadas; caso contrário, o GDL manda.

**Use Fills**: se estiver desligado, nenhum componente usa trama, mesmo que haja parâmetros de trama definidos [DOC AC28 151-29].

**Paredes curvas**: a divisão entre as superfícies “Wall Side” pode ser **reta** ou **curva** (opção *Hole Surface’s Split is Curved*) [DOC AC28 151-21].

---

## 9 · Model View Options (global da vista)

### 9.1 Porta/Janela — Construction Elements

| Opção | Efeito |
|---|---|
| **Show entire Door/Window** | Porta/janela com símbolo completo em planta e cortes |
| **with Marker** | Inclui o marcador, se atribuído |
| **Show Opening Only** | Só o vão na parede; sem símbolo |
| **with Contours** | O vão mostra contornos |
| **Hide on Floor Plan** | Nada em planta; em corte, só o vão |

As opções são separadas para **portas** e **janelas** [DOC AC28 140-39].

### 9.2 Detail Level of Door and Window Symbols

| Controle | Efeito |
|---|---|
| **Detail level** (planta / corte-elevação / projeções 3D) | Define o nível de detalhe dos símbolos; depende da biblioteca carregada |
| **Minimal Space of Doors** | Mostra o espaço mínimo com contorno e trama; caneta, tipo de linha e trama configuráveis |
| **Accessories in 3D** | Mostra ou esconde maçanetas |
| **Opening Line (Floor Plan)** | Liga/desliga e escolhe tipo de linha/símbolo |
| **Opening Line (Section/Elevation & 3D)** | Idem para corte/elevação/3D, inclusive portas de correr |
| **Opening Line (Global)** | Canetas das opening lines em todo o projeto |

Fonte: [DOC AC28 140-40].

### 9.3 Nível de detalhe por esquadria

- **AC18**: a aba *General Settings* tem **2D Detail Level** com **Scale Sensitive**, escala fixa (ex. 1:200) ou **Off**; **3D Detail Level** com **Detailed**, **Simple** ou **Off**; e **Show Reveal on Symbol** com escala limite [DOC AC18 151-35].
- **AC28 LU2**: o *Detail Level Override* nas configurações de Porta/Janela/Skylight foi **restaurado** [FÓRUM release note AC28 LU2].
- **AC30** (referência de continuidade): o Custom Settings ganhou aba **Detail Level** com **By Model View Options** (com *Set Limits*) ou **Fixed** [DOC AC30 151-31].

**INFERIDO**: no AC28 o controle deve aparecer como “Detail Level” no painel Custom Settings/General, mas a página AC28 correspondente não foi localizada; a documentação AC28 lista 31 páginas de Custom Settings (1–31) e a 31 é *Custom Corner*, não *Detail Level*. Isso é uma lacuna da própria documentação.

---

## 10 · Marcador, cotas e classificação

### 10.1 Dimension Marker

| Campo | O que faz |
|---|---|
| **Marker** | Escolhe um marcador GDL predefinido ou navega por outro objeto |
| **Preview** | Mostra como o marcador ficará |
| **Subfloor Thickness** | Soma/subtrai do valor de peitoril **mostrado**, sem mover a porta |
| **Marker Text Style** | Fonte, corpo, caneta, estilo |
| **Marker Custom Settings** | Interface própria do marcador (se existir); fica cinza se o marcador não tiver UI |
| **Size to Show** | Qual dimensão aparece: **Wallhole**, **Unit**, **Leaf** ou **Egress** |

Unidades de cota e de peitoril são configuradas em *Options > Project Preferences > Dimensions* [DOC AC28 150-19; AC28 151-2].

**Marcador × símbolo**: o marcador é um objeto GDL paramétrico **permanentemente ligado** à abertura; não é uma etiqueta solta. Para mostrar/esconder na planta, usa-se o Model View Options (Door/Window > with Marker) [DOC AC28 150-19].

### 10.2 Cotas automáticas

As definições de dimensão escolhidas em **Nominal Sizes and Tolerance** alimentam:
- o campo **Nominal W x H Size** do mapa interativo;
- o **Automatic Dimensioning**;
- o **Dimension Marker**.

O comando de cota linear tem ainda **Dimension Details > Display the Height of Openings as well**, com três modos: **Always with Oversize**, **Always without Oversize**, **Determined by Width** [DOC AC28 150-22].

### 10.3 Classification and Properties

O painel **Classification and Properties** (dentro do diálogo do elemento) permite:
- associar o elemento a um **Classification System** (ex.: IFC, OmniClass, classificação do escritório);
- preencher **Properties** (texto, número, inteiro, área, comprimento, ângulo, volume, tags, option set, true/false);
- manter o valor **ligado ao default** (ícone de corrente) ou sobrescrever;
- usar os valores em **schedule**, **labels**, **markers** e exportação IFC.

Fonte: [DOC AC28 045-4/5/6]. **[INFERIDO]** Para portas, os campos usuais são classificação (ex.: `IfcDoor`), fire rating, acoustic rating, manufacturer, type mark etc. — mas **quais propriedades aparecem depende do template e do Classification System do projeto**, não do objeto porta em si. **NÃO CONFIRMADO**: lista exata de propriedades padrão da biblioteca INT 28 para portas.

---

## 11 · Opening Lines (linhas de abertura)

- As **Opening Lines** são as linhas que representam o movimento da folha (arco no giro, seta no correr) em planta e/ou em corte/elevação/3D.
- Por padrão são **globais**, definidas no **Model View Options > Detail Level of Door and Window Symbols > Opening Line**; o objeto porta pode **sobrescrever** com **Override Model View Options** na aba *Opening Lines* [DOC AC18 151-42/43; DOC AC28 140-40].
- Há controles separados para **2D Symbolic Display** e **3D Projections**, com caneta própria (“2D & 3D Line Pen”).
- No MVO, para **portas de correr**, a opening line pode ser **None** ou **Arrow**; há tipos de linha **curva** ou **reta** [DOC AC26 140-41].
- No MVO de **3D**, as opening lines podem ser **dashed / solid / dotted**, com orientação **Handle** ou **Hinges**, no lado da abertura e no lado oposto; são **dependentes de escala** e geralmente não aparecem em escalas pequenas [DOC AC26 140-41].
- Em **Sidelight/Transom**, a aba própria controla apenas as **3D Projections**; a 2D simbólica fica na aba da folha [DOC AC18 151-43].

---

## 12 · Corte, elevação e 3D: o que depende de quê

| Vista | O que a porta mostra | Depende de |
|---|---|---|
| **Planta simbólica** | Símbolo 2D: folha, arco/seta, batente, guarnição, soleira | script 2D do GDL + atributos 2D |
| **Planta projetada** | Corte do modelo 3D + partes abaixo/acima | geometria 3D + plano de corte + atributos de projeção |
| **Corte/Elevação** | Vão real, batente, folha, vidro (vidro aparece como sólido), guarnições, soleira, peitoril, **Turn Plaster** (o Wall Closure comum é só 2D) | geometria 3D + materiais + atributos de corte |
| **3D** | Objeto completo, com sombra, resolução de curva, materiais; vidro transparente | geometria 3D + materiais + opções de 3D |
| **Wall Closure** | Só 2D; em corte/elevação só o **Turn Plaster** aparece; no 3D só com **Show in 3D** | configuração da parede composta |
| **Opening Lines** | 2D e/ou 3D, conforme MVO/override | MVO + objeto |

Fontes: [DOC AC28 040-305; AC28 151-17; AC28 151-29; AC18 151-31].

**Porta corta a parede de verdade**: o vão é um buraco real no modelo 3D; o vidro deixa passar luz e é atravessável em renderização; em elevação, os vidros são representados como formas sólidas [DOC AC28 040-305].

---

## 13 · Fontes consultadas — parte 2 (colocação e documentação)

| URL | Versão | Tipo | Conteúdo |
|---|---|---|---|
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-304.htm | AC28 | DOC | Índice de ferramentas de objeto |
| .../040_ElementsVB-305.htm | AC28 | DOC | Doors/Windows (visão geral) |
| .../040_ElementsVB-306.htm | AC28 | DOC | Colocação, Tab, lado externo, Flip |
| .../040_ElementsVB-307.htm | AC28 | DOC | Floor Plan Display e atributos |
| .../040_ElementsVB-308.htm | AC28 | DOC | Plano em parede inclinada |
| .../040_ElementsVB-309.htm | AC28 | DOC | Sill/header e referências |
| .../040_ElementsVB-310.htm | AC28 | DOC | Subfloor Thickness |
| .../040_ElementsVB-311.htm | AC28 | DOC | Anchor Reveal |
| .../040_ElementsVB-312.htm | AC28 | DOC | Empty Opening |
| .../040_ElementsVB-314.htm | AC28 | DOC | Mover/rotacionar/mirror/elevate |
| .../040_ElementsVB-315.htm | AC28 | DOC | Portas em parede curva |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-16.htm | AC28 | DOC | Preview and Positioning |
| .../150_UserInterfaceToolSettings-18.htm | AC28 | DOC | Symbolic vs Projected |
| .../150_UserInterfaceToolSettings-19.htm | AC28 | DOC | Model, Reveal legado, Dimension Marker |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-39.htm | AC28 | DOC | MVO Construction Elements |
| .../140_UserInterfaceDialogBoxes-40.htm | AC28 | DOC | MVO Detail Level de portas/janelas |
| .../140_UserInterfaceDialogBoxes-42.htm | AC28 | DOC | MVO Miscellaneous (library parts) |
| https://help.graphisoft.com/AC/26/INT/_AC26_Help/140_UserInterfaceDialogBoxes/140_UserInterfaceDialogBoxes-41.htm | AC26 | DOC | Opening Line no MVO: Curved/Straight, None/Arrow, 3D dashed/solid/dotted, Handle/Hinges |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/045_PropertiesClassifications/045_PropertiesClassifications-4.htm | AC28 | DOC | Default Property Value |
| .../045_PropertiesClassifications-5.htm | AC28 | DOC | Property Manager |
| .../045_PropertiesClassifications-6.htm | AC28 | DOC | Property Availability |
| https://help.graphisoft.com/AC/18/INT/AC18Help/Appendix_Tools/Appendix_Tools-35.htm | AC18 | DOC | General Settings (detail level 2D/3D) |
| .../Appendix_Tools-41.htm | AC18 | DOC | Opening Type and Angle |
| .../Appendix_Tools-42.htm | AC18 | DOC | Opening Lines – Door |
| .../Appendix_Tools-43.htm | AC18 | DOC | Opening Lines – Sidelight/Transom |
| https://help.graphisoft.com/AC/30/INT/Topics/040_ElementsVB/040_ElementsVB-287.html | AC30 | DOC | Editable hotspots (complemento) |
| https://help.graphisoft.com/AC/30/INT/Topics/151_DoorWindowCustomSettings/151_DoorWindowCustomSettings-31.html | AC30 | DOC | Detail Level (By MVO/Fixed) |
| https://community.graphisoft.com/t5/Libraries-objects/Changing-door-swing/td-p/216484 | — | FÓRUM | Trocar outside/inside após colocação via Flip |

---

## 14 · Lógica de modelagem (como o ArchiCAD constrói a porta)

### 14.1 Sistema de coordenadas do objeto

A documentação de GDL é explícita [DOC GDL “Doors and Windows”]:

- Ao inserir a porta na parede, o sistema local é **rotacionado**: o plano **X-Y fica vertical** e o **eixo Z aponta horizontalmente para dentro da parede**.
- A **origem** fica no **centro da base do vão**, na **face externa** da parede.
- Portanto: **X** = largura ao longo da parede; **Y** = altura; **Z** = profundidade (para dentro da parede).
- O **zero do projeto** (no script) corresponde à **superfície externa** da parede.
- Elementos que ficam **dentro** da parede (batente) ficam **acima do zero** em Z; folhas que abrem **para fora** ficam **abaixo do zero**.

Essa é a referência que explica por que “lado externo”, “reveal” e “profundidade do batente” são conceitos separados: o objeto é modelado a partir da face externa, não do eixo da parede.

### 14.2 Os 8 estados de posição

O GDL representa a posição da abertura com **três variáveis** [DOC GDL “Doors and Windows”]:

| Variável | Efeito |
|---|---|
| `SYMB_MIRRORED` | Espelha no plano Y-Z (3D) / eixo Y (2D): troca a **mão** |
| `SYMB_ROTANGLE` | Rotação de **180°** em torno do eixo longitudinal da parede: troca o **sentido** (facing) |
| `WIDO_REVEAL_SIDE` | **Flip** do lado externo/interno: espelha e “puxa de volta” pela espessura nominal do batente |

Com 3 booleanos → **8 combinações** (2³), que cobrem as orientações possíveis de uma porta/janela numa parede. O script precisa decidir **o que acompanha cada transformação**: a folha acompanha; o fechamento de cavidade, não. Na troca de reveal side, o objeto é **espelhado e deslocado** pela espessura nominal do batente.

**Para o nosso editor**: não guardar “hand” e “facing” como ângulos; guardar dois booleanos (`mirrored`, `rotated`) + `revealSide`, e derivar a geometria. Isso evita estados inconsistentes e reproduz o modelo do ArchiCAD.

### 14.3 Cadeia de dependências (ordem de cálculo)

A ordem inferida a partir das abas e do GDL:

```
1. Parede anfitriã
   └─ face externa / side / espessura / composite / curvatura
2. Colocação
   ├─ anchor point (centro ou lado)
   ├─ reveal side (cursor/Tab)
   └─ opening plane (associado à parede ou vertical)
3. Tamanho nominal
   ├─ definição: Wallhole | Unit | Egress | Leaf
   └─ Width / Height
4. Vão
   ├─ tolerâncias (laterais + superior)
   ├─ oversizes (esq/dir/cima/baixo)
   └─ Wallhole (Unit + tolerances / oversizes)
5. Requadro
   ├─ Reveal Type
   ├─ Reveal Depth
   └─ âncora: face ou núcleo
6. Batente
   ├─ Frame Style
   ├─ Frame Width (uniforme ou por lado)
   ├─ Frame Thickness (= parede?)
   └─ joinery (mitered/butt)
7. Folha(s)
   ├─ Leaf Type / Leaf Dimensions / thickness
   ├─ Handle / Kick Board
   └─ Opening Type + ângulo 2D/3D
8. Sidelight / Transom
   ├─ Shape (quantidade/posição)
   ├─ Sash Type / grid
   ├─ Opening Type + direção (same/opposite)
   └─ ângulo/distância
9. Fixtures
   ├─ Threshold
   ├─ Sill (janela)
   ├─ Board (sidelight elevada)
   ├─ Casing in/out
   └─ Sunshade
10. Representação
    ├─ Floor Plan Display (symbolic/projected)
    ├─ atributos GDL ou override
    ├─ Opening Lines (MVO/override)
    └─ detail level
11. Documentação
    ├─ Dimension Marker + Subfloor Thickness
    ├─ Classification/Properties
    └─ Schedule/IFC
```

### 14.4 Dependências que “amarram” o modelo

| Se mudar… | Afeta… |
|---|---|
| **Definição do nominal** | valor de Width/Height, marcador, cota automática, schedule |
| **Tolerância** | apenas o vão (Wallhole); **não** o nominal |
| **Oversize** | apenas o corte; **não** o nominal |
| **Reveal Depth / âncora** | posição do batente, wall closure, turn plaster, casing, aparência em corte |
| **Frame Thickness = Wall Thickness** | libera ou não **Uniform Frame Thickness** |
| **Opening Type** | limita os **Frame Styles** disponíveis; em double-egress força **Block** |
| **Shape (sidelight/transom)** | habilita **Board**, **Sunshade** (não com sidelight elevada), muda a grade de caixilhos |
| **Sidelight/Transom direction** | abre igual ou oposto à folha; ângulo/distância independentes |
| **Casing** | impede **Turn Plaster** (mutuamente exclusivos) |
| **Floor Plan Display** | simbólico (script 2D) × projetado (3D + plano de corte) |
| **MVO** | detalhe, opening lines, marcadores, maçanetas, minimal space |
| **Override do objeto** | vence o MVO nas opening lines |

### 14.5 Geometria não retangular

Por padrão, a porta/janela **corta um retângulo** na parede, dimensionado pelos parâmetros A e B do objeto. Para arco, oculus ou forma livre, o script 3D usa **`WALLHOLE`** (ou `WALLNICHE` para nicho). Se existir pelo menos um `WALLHOLE`, **nenhum retângulo automático** é gerado. O **reveal 3D não é automático** nesse caso: precisa ser modelado no script. `WALLHOLE` **não afeta a planta 2D**; para o símbolo 2D usa-se `WALLHOLE2`/`WALLBLOCK2`/`WALLLINE2`/`WALLARC2` [DOC GDL “Doors and Windows”].

**[INFERIDO]** **Consequência**: portas em arco (Masonry Arch) e portas de forma livre são “buracos compostos”, não apenas um parâmetro de altura. No nosso editor, o arquétipo de vão precisa suportar **contorno poligonal** além do retângulo.

### 14.6 Símbolo 2D

O símbolo 2D não é uma projeção comum: é gerado por uma **projeção embutida especial** (vista lateral de 90° “de cabeça para baixo”), e o símbolo + a forma 3D são ajustados à origem da porta pelo **centro inferior** da bounding box, sem ajuste em Z. Isso permite que o objeto se estenda para fora da parede nos dois sentidos [DOC GDL “Doors and Windows”].

É por isso que:
- o símbolo pode ser completamente diferente do 3D;
- `Symbolic` e `Projected` são caminhos de desenho distintos;
- o eixo de referência do símbolo é o **centro da base do vão**.

---

## 15 · Biblioteca INT: famílias e o que muda

### 15.1 Como a biblioteca é organizada

- No AC28 a biblioteca é a **Global Library**, composta por **pacotes**; os objetos não têm mais sufixo de versão e o conteúdo é compartilhado entre idiomas. O **template** define idioma, tamanhos padrão, atributos, superfícies e canetas; a **Library Localization Preferences** troca idioma e estrutura de pastas [DOC AC28 020-41].
- Cada porta é um **objeto GDL separado**. O nome do painel Custom Settings e as abas disponíveis **mudam com o objeto**: “Hinged Door Settings”, “Sliding Door Settings” etc. [DOC AC28 150-15/17].
- Os **macros GDL** (frames, panels, sashes) são compartilhados; por isso várias portas têm o mesmo conjunto de parâmetros [DOC GDL “Doors and Windows”].

### 15.2 Famílias confirmadas ou prováveis

| Família / objeto | O que é | Controles que mudam | Confirmação |
|---|---|---|---|
| **Hinged Door** (porta de abrir) | 1 folha, giro lateral ou vai-e-vem | Opening Type **Side Hung / Double-Acting**; 3 Frame Styles; handle; kick board | [DOC AC18 151-35/41] |
| **Double Door / Arch Double Door** | 2 folhas, simétricas ou assimétricas, com/sem bandeira e luz lateral | 2 folhas, double acting/double egress, sidelight/transom | [FÓRUM BIMcomponents: “Hinged, double acting or double egress double door with arch top, sidelight and transom”] |
| **Sliding Door** (correr) | Folhas transladam; pode ter 1–4 painéis (limite do objeto clássico) | Abertura por **distância**; opening line com seta; trilhos | [DOC AC28 151-13; FÓRUM community “Customize sliding doors”] |
| **Sliding Folding Multipanel / Bifold** | Folhas dobram e empilham | Nº de folhas, largura de abertura, configuração de dobra | [FÓRUM BIMcomponents: “Sliding folding double door with optional number of leaves”] |
| **Multipanel Sliding Door** (AC28 LU1) | Correr com muitas folhas | **2–10 folhas**, **1–4 trilhos**, distribuição **equal/custom**, dentro/fora da parede, 1 ou 2 “winged”, até 3 esquemas de folhas | [FÓRUM release note AC28 LU1] |
| **Pocket Door** | Corre para dentro de um nicho na parede | Trilho/bolsão; abertura por distância | [FÓRUM community AC28 migration cita “pocket door”; comportamento é INFERIDO do nome] |
| **Top Hinged / Bottom Hinged** | Basculante (eixo superior/inferior) | Handle em posição predefinida (não editável) | [FÓRUM release note AC29] |
| **Bi-Fold Lift Up** | Dobra e levanta | Handle predefinido | [FÓRUM release note AC29] |
| **Elevator Doors** (stand-alone) | Portas de elevador, simples/duplas | 1 ou 2 “winged”, dentro/fora da parede | [FÓRUM release note AC28 LU1] |
| **Empty Opening** | Sem objeto; só o vão | Width/Height, reveal, sem folha | [DOC AC28 040-312] |
| **Garage Door** | Porta de garagem | — | **NÃO CONFIRMADO** na biblioteca INT 28; provavelmente é objeto separado ou de fabricante [INFERIDO] |

**NÃO CONFIRMADO**: a lista fechada de pastas/objetos da biblioteca INT 28. A documentação não publica um catálogo; as notas de versão e o BIMcomponents mostram exemplos, não o inventário completo. Para o nosso editor, o importante é o **contrato**: cada família declara quais abas/opções aceita.

### 15.3 O que é “da biblioteca” e não do ArchiCAD

| Item | Onde é definido |
|---|---|
| Lista de **Opening Types** | script de interface do objeto (GDL) |
| Lista de **Leaf Types** e **Handles** | objeto GDL (miniaturas) |
| Lista de **Frame Styles** | objeto (a doc do Hinged diz 3) |
| Lista de **Sill/Threshold/Casing/Sunshade Types** | objeto |
| **Nº máximo de folhas/painéis** | objeto (ex.: sliding clássico 4; multipanel 10) |
| **Custom Leaf / Custom Sash** | componentes salvos pelo usuário na Embedded Library |
| **Nomes das abas** | interface do objeto |

**Custom Door Leaf**: pode ser desenhado com elementos 3D e salvo como *Door Leaf*. Ao aplicar, o ArchiCAD **redimensiona proporcionalmente** para caber no vão: um leaf de 1000×2000 usado numa porta de 800×2000 com trim de 50 mm vira 700×1950 mm [DOC AC26 040-295]. Isso é diferente de “esticar” a porta: o componente é reescalado.

---

## 16 · Atalhos e comportamentos de teclado (confirmados)

| Tecla / ação | Efeito | Fonte |
|---|---|---|
| **Tab** | Alterna entre paredes sobrepostas sob o cursor | [DOC AC28 040-306] |
| **Tab** (durante a colocação) | Alterna o **lado externo** (reveal side) | [DOC AC28 040-306] |
| **Tab** (hotspot editável) | Entra com valor numérico no **Tracker** | [DOC AC30 040-287] |
| **Ctrl/Cmd + M** | **Mirror** da porta/janela | [DOC AC28 040-314] |
| **Rotate** (comando) | Gira 180° em torno do centro, sem desenhar vetor | [DOC AC28 040-314] |
| **Flip** (botão) | Inverte o sentido mantendo o batente | [DOC AC28 040-306; 150-16] |
| **Anchor Point** (Info Box) | Troca centro/lado durante a colocação | [DOC AC28 040-306] |

**NÃO CONFIRMADO**: atalho de teclado exclusivo para Flip ou para trocar o lado externo depois de colocada. A documentação só cita o botão/Info Box e o Tab durante a colocação. **[INFERIDO]** **Space não é usado** para inverter dobradiça no ArchiCAD (isso é convenção do Revit); não transportar esse atalho.

---

## 17 · O que isso significa para o nosso editor

1. **Separar três coisas** que o ArchiCAD separa: (a) **vão** (wallhole + tolerances + oversizes), (b) **objeto** (batente/folha/acessórios), (c) **representação** (symbolic/projected + opening lines). Vale avaliar se o Hestia deve tratar o vão como entidade própria, em vez de guardá-lo só como atributos da esquadria.
2. **Nominal é uma escolha, não um número**: guardar `nominalDefinition` (`wallhole|unit|egress|leaf`) e derivar as demais dimensões. O usuário vê “L×A” e o mapa usa a mesma definição.
3. **Orientação com 3 booleanos** (`mirrored`, `rotated`, `revealSide`) em vez de ângulos; expor na UI como “mão”, “sentido” e “lado externo”.
4. **Opening Type como enum por família**, com fallback “custom”; não tentar uma lista única global. Guardar `openingAngle2D` e `openingAngle3D` separados; para correr, `openingDistance`.
5. **Frame Style + dimensões** independentes; o estilo só deve limitar opções quando a família declarar (ex.: double-egress → Block).
6. **Sidelight/Transom como componentes** com próprio tipo de abertura e direção; o `Shape` é a árvore de composição.
7. **Fixtures opcionais** (threshold, sill, board, casing, sunshade) como lista de componentes, não como dezenas de campos fixos.
8. **Representação em dois caminhos**: símbolo 2D desenhado (paramétrico) e projeção do 3D; o usuário escolhe `Symbolic`/`Projected` por instância/tipo, e o MVO global filtra.
9. **Detail level** por tipo com opção “By MVO” ou “Fixed” (como no AC30) — atende tanto escritório que quer controle global quanto projeto que quer exceção.
10. **Marcador e classificação** desacoplados: o marcador lê dimensões/sill; a classificação/IFC lê propriedades. Não são “campos da porta”, são camadas de documentação.

---

## 18 · Lacunas

| Lacuna | Onde provavelmente está |
|---|---|
| Lista completa de valores dos pop-ups (Opening Type, Leaf Type, Handle, Frame Style, Sill, Threshold, Casing) | Script de interface GDL de cada objeto; não publicado na ajuda |
| Nomes exatos dos campos de **Leaf and Sash Dimension** | A página AC28 151-9 só mostra a figura |
| Nomes exatos dos campos de **Shape** | A página AC28 151-3 só mostra a figura |
| Controle exato para trocar o **lado externo** depois de colocada | Provavelmente `WIDO_REVEAL_SIDE` no diálogo/Info Box; a ajuda só descreve durante a colocação |
| Página AC28 do **Detail Level** | Existe no AC30 (151-31); no AC28 a lista de Custom Settings vai até 31 e a 31 é Custom Corner. O recurso foi restaurado no LU2, mas a página não aparece no índice |
| Lista de **Opening Lines** no AC28 | As abas existem no AC18 (151-42/43); no AC28 o índice não as lista — podem ter sido absorvidas pelo MVO |
| Catálogo completo da **biblioteca INT 28** | Notas de versão e BIMcomponents mostram exemplos; não há inventário oficial |
| **Garage Door** na biblioteca INT | Provavelmente objeto separado ou de fabricante; não confirmado |
| Propriedades padrão de **Classification/Properties** para portas | Depende do template e do Classification System do projeto |
| Acesso à comunidade Graphisoft | Páginas bloqueadas por CAPTCHA/403 nesta sessão; usamos apenas snippets indexados |
| Nomes em português de alguns campos | A tradução BRA é inconsistente (ex.: “Rotacionar” para Flip; “Soleira/Peitoril” para Sill; “Tudo em Projeção” para Overhead All) |

---

## 19 · Fontes consultadas — parte 3 (GDL e biblioteca)

### 19.1 Lógica GDL

| URL | Tipo | Conteúdo |
|---|---|---|
| https://gdl.graphisoft.com/reference-guide/doors-and-windows/ | DOC | Sistema de coordenadas, origem, 8 estados (`SYMB_MIRRORED`, `SYMB_ROTANGLE`, `WIDO_REVEAL_SIDE`), `WALLHOLE`, `WALLHOLE2`, `WALLNICHE`, símbolo 2D |
| https://gdl.graphisoft.com/reference-guide/doorwindow-parameters-for-markers/ | DOC | Parâmetros do marcador (`ac_wido_*`, `ac_sill_*`, `ac_wido_reveal_side_2`) |
| https://gdl.graphisoft.com/reference-guide/opening-parameters/ | DOC | `OPENING_WIDTH/HEIGHT`, dicionários de sill/header/center, `OPENING_SYMBOL_DISPLAY` |

### 19.2 Biblioteca e custom components

| URL | Versão | Tipo | Conteúdo |
|---|---|---|---|
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/020_Configuration/020_Configuration-41.htm | AC28 | DOC | Global Library, pacotes, template, localização |
| https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-295.htm | AC26 | DOC | Custom components e redimensionamento proporcional |
| .../040_ElementsVB-296.htm | AC26 | DOC | Workflows de custom components |
| .../040_ElementsVB-297.htm | AC26 | DOC | Custom Door Leaf passo a passo |
| https://help.graphisoft.com/AC/28/INT/_AC28_Help/040_ElementsVB/040_ElementsVB-293.htm | AC28 | DOC | Salvar porta/janela retangular a partir de 3D |
| .../040_ElementsVB-294.htm | AC28 | DOC | Salvar porta/janela de forma customizada |
| https://community.graphisoft.com/gowhw84577/attachments/gowhw84577/forum-gdl/8468/2/AC28%20LU1%20-%20Release%20Note.pdf | AC28 LU1 | FÓRUM | Multipanel Sliding, elevator doors |
| .../3/AC28%20LU2%20-%20Release%20Note.pdf | AC28 LU2 | FÓRUM | Detail Level Override restaurado |
| .../5/AC29%20Library%20-%20Release%20Note.pdf | AC29 | FÓRUM | Top/Bottom Hinged, Bi-Fold Lift Up |
| https://bimcomponents.com/GSM/Details/16350 | AC17 | FÓRUM/LOJA | Arch Double Door com sidelight/transom (descrição) |
| https://bimcomponents.com/GSM/Details/7394 | AC17 | FÓRUM/LOJA | Sliding Folding Multipanel Bifold |
| https://community.graphisoft.com/t5/Libraries-objects/Customize-sliding-doors/td-p/628918 | — | FÓRUM | Limite de 4 painéis no sliding clássico |

### 19.3 Colocação/edição (já citadas acima)

- AC28 040-304 a 040-315 (índice, Doors/Windows, placement, previews, floor plan display, plane, sill, subfloor, anchor reveal, empty opening, moving, curved wall).
- AC28 150-16/18/19; 140-39/40/42; 045-4/5/6.
- AC18 151-35/41/42/43.
- AC30 040-287 (hotspots) e 151-31 (Detail Level).

---

## 20 · Resumo final em uma página

**O que parametrizar primeiro (MVP do nosso editor):**

1. **Vão**: largura, altura, definição do nominal, tolerâncias, oversizes.
2. **Assentamento**: lado externo, anchor point, reveal depth + âncora (face/núcleo), opening plane.
3. **Batente**: estilo (3), largura (uniforme/por lado), espessura (= parede?), joinery.
4. **Folha**: tipo, dimensões, espessura, maçaneta, kick board.
5. **Abertura**: tipo por componente, ângulo 2D, ângulo/distância 3D, direção de sidelight/transom.
6. **Composição**: shape (folhas + sidelights + transom), sash/grid.
7. **Acabamentos**: threshold, sill, board, casing in/out, sunshade.
8. **Representação**: symbolic/projected, atributos 2D, opening lines, detail level.
9. **Documentação**: marcador, subfloor thickness, classificação/propriedades.

**O que não copiar do ArchiCAD**: a explosão de abas e a dependência de GDL para listas de valores. O Hestia pode ter um schema fechado com enums próprios e um “modo avançado” para o que a família declarar.

**O que copiar**: a separação **vão × objeto × representação**, os **3 booleanos de orientação**, o **nominal como escolha**, o **ângulo 2D separado do 3D**, e a **árvore de componentes** (folha, sidelight, transom, fixtures).
