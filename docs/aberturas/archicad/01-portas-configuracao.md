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

A Graphisoft explica que os mesmos parâmetros existem em dois formatos: **Custom Settings** (gráfico, agrupado em abas, com figuras) e **All Parameters** (lista). No AC28 o formulário antigo “Parameters” foi substituído pelo Custom Settings; no AC18 os dois conviviam [DOC AC28 150-17; DOC AC18 150-29].

---

## 3 · Custom Settings — aba por aba

### 3.1 Nominal Sizes and Tolerance (Tamanhos Nominais e Tolerância)

| Campo / opção | O que faz | Valores | Padrão |
|---|---|---|---|
| Wallhole Dimensions | Vão bruto recortado na parede | Largura = Unit + tolerâncias laterais; altura = Unit + tolerância superior | — |
| Unit Dimensions | Tamanho da estrutura completa da abertura (batente incluso) | L × A | — |
| Egress Dimensions | Vão livre de passagem = largura Unit − largura do batente | L | — |
| Leaf Dimensions | Dimensão da folha | L × A | — |
| **Set as Nominal** | Escolhe qual das quatro réguas é o “Nominal Size” | Wallhole / Unit / Egress / Leaf | Unit (implícito) |
| **Transfer Current Nominal Size to Selection** | Ao trocar a régua nominal, transfere os valores antigos para a nova régua e recalcula o resto | on/off | off |
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

Os ângulos também podem ser editados **graficamente por hotspots** no projeto. O tipo de abertura escolhido **limita o Frame Style** [DOC AC28 151-13].

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

## 6 · Fontes desta parte

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

*(Arquivos seguintes completam esta lista.)*
