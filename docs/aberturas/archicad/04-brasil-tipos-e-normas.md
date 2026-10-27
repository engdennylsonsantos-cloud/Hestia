# 04 · Portas e janelas no Brasil: tipos, materiais, medidas, normas e convenções

Pesquisa R4 · Data: 2026-10-26 · Escopo: catálogo real de portas e janelas usado em projetos brasileiros, com foco em **lógica de modelagem** e **opções de configuração** para o editor do Hestia. Não altera código.

Este documento foi escrito em partes e commitado a cada tema. A numeração de fontes (`[S1]`, `[S2]`…) está no fim do arquivo. As marcações usadas são:

- **[DOC]** — norma ABNT, manual público ou documento oficial que eu li (integralmente ou em trecho substancial).
- **[FABRICANTE]** — catálogo, site ou ficha de fabricante; é apoio de mercado, não norma.
- **[FÓRUM/LOJA]** — blog, marketplace, material de disciplina, tutorial ou site de loja; é apoio, não norma.
- **[INFERIDO]** — dedução minha, com o raciocínio explicitado.
- **[NÃO CONFIRMADO]** — não achei fonte suficiente; não inventei número.

## 1. Resumo executivo

- A espinha dorsal dimensional da porta de madeira brasileira é a **ABNT NBR 15930-2:2018**. Para porta interna, a folha padronizada é **600, 700, 800 ou 900 mm** de largura por **2.100 mm** (ou 2.400 mm), com espessura **35, 40 ou 45 mm** conforme a massa (leve, média, pesada). Para entrada/externa, a largura vai a **800–1.200 mm** e a espessura a **35–50 mm** [S15, S16, S26].
- O “**80 × 210**” do comércio é a **folha**, não o vão. Pela NBR 15930-2, o vão acabado para folha de 800 mm é **880 × 2.150 mm** (folha + 80 na largura, + 50 na altura, no padrão pesado); para folha de 700 mm, **780 × 2.150 mm**. O kit porta tem largura **L + 45/55/65** e altura **H + 30/35/40** [S16, S26, S33].
- O batente de madeira mais usado no Brasil é **3 × 14 cm** (seção 30 × 140 mm), com rebaixo; a NBR 15930-2 pede alma de **30/35/45/50 mm** e largura mínima de **70/90/110/110 mm** para os padrões leve/médio/pesado/superpesado. Há divergência entre o “3 × 14” de mercado e o mínimo normativo do padrão médio (35 mm) [S4, S16, S64].
- O alizar comum é **5 × 1,5 cm** (50 × 15 mm). A NBR 15930-2 padroniza **40×8, 50×10, 60×12 e 70×15 mm**; portanto o 5×1,5 de mercado é mais espesso que o alizar médio normativo (50×10). Isso precisa ser tratado como **dois parâmetros independentes** (largura e espessura), não como um único “5×1,5” [S16, S63].
- A NBR 9050:2020 exige **vão livre ≥ 0,80 m × 2,10 m** (tolerância de −20 mm), maçaneta alavanca de **≥ 100 mm**, a **0,80–1,10 m** do piso, e puxador vertical/horizontal com dimensões específicas. Em porta de duas folhas, pelo menos uma deve dar 0,80 m; em correr e sanfonada o vão livre de 0,80 m também deve ser garantido [S21, S90].
- Para esquadrias externas, a **NBR 10821-2:2017** classifica desempenho em **Mínimo / Intermediário / Superior** para permeabilidade ao ar, estanqueidade à água, cargas uniformes, manuseio e corrosão, em função da **região de vento (I–V)** e da **altura da edificação** (até 6, 15, 30, 60 e 90 m). As pressões de ensaio vão de **350 Pa a 1.820 Pa** [S18, S19, S20, S88].
- O PBQP-H fixa **dimensões máximas** de tipologias homologadas: correr de alumínio **1,00 × 1,50 m**, **1,20 × 1,20 m** e **1,20 × 1,50 m** (altura × largura); correr de PVC **1,40 × 1,60 m** e **1,60 × 1,60 m**; maxim-ar **1,00 × 1,00 m**. Isso é limite de avaliação, não catálogo comercial [S10, S11, S13, S14].
- A **NBR 15575-1** recomenda, para salas e dormitórios, peitoril **≤ 1,00 m** e testeira do vão **≤ 2,20 m**; para ventilação, **7% da área de piso** nas zonas bioclimáticas 1–7, **12%** no Norte (ZB 8) e **8%** no Nordeste/Sudeste (ZB 8) [S25, S92].
- Medidas comerciais de janela mais recorrentes: **60×60, 80×80, 100×100, 120×120, 100×120, 120×150, 150×120, 200×120 cm** (largura × altura, salvo indicação). Há muita variação de orientação entre fabricantes; o editor deve guardar **largura e altura em campos separados** [S29, S30, S31, S37].
- Em planta, a convenção brasileira é desenhar **porta aberta** (folha + arco de 90°) e **janela fechada** (linhas paralelas no vão). O plano de corte é recomendado a **1,50 m**; janela com peitoril acima disso aparece **tracejada**. A cota é **P = L × H** e **J = L × H / P** (largura × altura / peitoril) [S22, S45, S46, S47].
- Em elevação, o **triângulo/V tracejado** é convenção de prática, **não prescrição explícita da NBR 6492:2021**: o **vértice indica o lado da dobradiça/eixo fixo** e a **linha tracejada, o caminho da borda livre**; triângulo contínuo vs. tracejado já foi usado para distinguir abertura para dentro vs. para fora. Isso precisa ser um **símbolo configurável**, não uma regra única [S22, S43, S44, S80].
- A lógica de modelagem que a norma sugere é: **vão bruto → vão acabado → marco/batente → folha → ferragens → alizar → soleira/peitoril → verga/contraverga**. O que depende do quê: a folha depende do rebaixo e das folgas; o alizar depende da espessura acabada da parede; o vão depende da folha e do padrão de massa, não o contrário [S15, S16, S22].

## 2. Nomenclatura e lógica de modelagem

### 2.1 Termos que o editor precisa separar

A NBR 15930-1:2011 fixa a terminologia oficial. O mercado usa vários sinônimos; o editor deve escolher **um nome de campo** e guardar os sinônimos como ajuda [S15].

| Termo normativo (NBR 15930-1) | Sinônimos de mercado | O que é | Papel na modelagem |
|---|---|---|---|
| **vão da porta** | vão bruto, buraco, abertura | abertura na parede destinada à porta | primeiro parâmetro; vem do recorte da parede |
| **vão livre** | vão de luz, passagem livre | abertura limitada pelas faces internas do marco e pela soleira | é o que a NBR 9050 mede; não é o vão bruto |
| **marco** | batente, aduela, aro, caixão, caixilho, portal | parte fixa que guarnece o vão e sustenta a folha | ocupa o vão; tem seção, rebaixo e largura |
| **batente do marco** | rebaixo, jabre, degrau | rebaixo/ressalto no perímetro do marco que contém o movimento da folha | define o encosto e a folga da folha |
| **folha da porta** | folha, painel | parte móvel principal | largura, altura, espessura, núcleo, capa, vidro |
| **alizar** | guarnição, vista, moldura, cobre-junta, cercadura | peça que cobre a junta parede–marco | cobre a diferença entre a largura do marco e a parede acabada |
| **soleira** | limiar, peça de piso | superfície/peça de acabamento sob a porta | fecha o vão no piso; define a folga inferior |
| **peitoril** | parapeito, soleira de janela | peça na base da janela | altura do peitoril é parâmetro de projeto e de desenho |
| **bandeira** | imposta, sobreverga | esquadria fixa ou móvel acima da folha | altura adicional; pode ser fixa ou basculante |
| **seteira** | laterna, vitrô lateral | esquadria fixa ou móvel ao lado da folha | largura adicional; comum em portas externas |
| **contramarco** | contrafecho, marco secundário | peças fixas que guarnecem o vão para receber o marco | permite ajuste e troca sem quebrar a parede |
| **espaleta** | boneca | complemento de parede/verga para receber o alizar | explica por que o vão pode ser maior que o marco |
| **ferragens** | dobradiças, fechadura, maçaneta, puxador | conjunto de sustentação, manobra e travamento | define eixos, sentidos e limites de curso |

**Cuidado com a palavra “batente”**: no Brasil ela é usada para (a) o **marco inteiro** e (b) o **rebaixo** onde a folha encosta. A NBR 15930-1 chama o conjunto de **marco** e o rebaixo de **batente do marco**. No editor, sugiro `frame` para o conjunto e `stop`/`rebate` para o rebaixo, deixando “batente” apenas como rótulo de interface [S15].

### 2.2 Ordem de cálculo (do vão para a peça)

A NBR 15930-2:2018 trabalha com dimensões de **folha** e deriva o **vão** e o **kit**. A ordem que faz sentido para o editor é:

1. **Vão bruto** = recorte na parede (pode incluir espaleta e contramarco).
2. **Vão acabado** = vão pronto para receber a esquadria; é o que a NBR 6492 manda cotar [S22].
3. **Marco** = seção (largura × espessura), rebaixo e largura nominal; ocupa o vão acabado.
4. **Folha** = largura/altura/espessura; desconta rebaixo, folgas e, se houver, batente de encontro.
5. **Ferragens** = dobradiças/pivô/trilho; definem o eixo e o sentido.
6. **Alizar** = cobre a junta; depende da **espessura acabada da parede**, não da folha.
7. **Soleira/peitoril** = fecha o piso/base; depende do vão e do desnível.
8. **Verga/contraverga** = acabamento do recorte; dependem da alvenaria e do sistema construtivo.

Fórmulas normativas úteis (NBR 15930-2, porta de giro de 1 folha, fixação mecânica) [S16]:

| Parâmetro | Leve | Médio | Pesado | Superpesado |
|---|---:|---:|---:|---:|
| Largura do vão `Lv` | L + 60 | L + 70 | L + 80 | L + 80 |
| Altura do vão `Hv` (piso acabado) | H + 50 | H + 50 | H + 50 | H + 50 |
| Largura do kit `Lk` | L + 45 | L + 55 | L + 65 | L + 65 |
| Altura do kit `Hk` | H + 30 | H + 35 | H + 40 | H + 40 |
| Tolerância do vão | ±5 | ±5 | ±5 | ±5 |

Onde `L` e `H` são largura e altura da **folha**. Para fixação com espuma PU, a NBR 15930-2 tem outra tabela; o catálogo Sincol usa, para folha 800, vão **880 × 2.150 mm** (L + 80, H + 50), que coincide com o padrão pesado [S16, S33].

**Consequência para o editor:** o usuário deve informar se está digitando **folha** ou **vão**. Se digitar 800 × 2.100 como “porta”, o sistema não pode assumir que o vão é 800 × 2.100; deve aplicar a regra de vão do padrão escolhido. Caso contrário, a porta não fecha e o quadro de esquadrias fica errado.

### 2.3 O que depende do quê

| Elemento | Depende de | Não depende de |
|---|---|---|
| largura/altura da folha | vão, rebaixo, folgas, padrão de massa | espessura da parede |
| espessura da folha | padrão de massa (leve/médio/pesado) | largura do marco |
| largura do marco | espessura acabada da parede (marco envolvente) ou padrão mínimo (não envolvente) | largura da folha, exceto pelo rebaixo |
| rebaixo | espessura da folha + 2 mm (ou + amortecedor) | largura do vão |
| alizar | espessura acabada da parede e largura do marco | altura da folha |
| soleira | largura do vão e desnível entre pisos | altura da folha |
| peitoril | largura do vão, espessura da parede e saliência | altura da janela |
| bandeira | altura total do vão e altura da folha | largura da folha |
| ferragens | massa e largura da folha, uso | acabamento da parede |

## 3. Portas de madeira

### 3.1 Tipos, construção e opções

A classificação abaixo combina a terminologia da NBR 15930-1, a descrição de núcleos da NBR 15930-2 e o que os fabricantes brasileiros efetivamente vendem [S15, S16, S26, S33, S36, S68, S83].

| Tipo | Como é construído | Opções de configuração | Uso típico | Fonte |
|---|---|---|---|---|
| **Lisa semi-oca — colmeia** | quadro periférico de madeira; miolo de colmeia de papel; capas de HDF/MDF/compensado | largura 60/70/80/90; altura 210; espessura 35; acabamento pintura, laminado, melamínico; frisos; visor | quartos, salas, banheiros, interior | [FABRICANTE] S33, S36; [DOC] S16 |
| **Lisa semi-oca — sarrafeada** | quadro + sarrafos de madeira espaçados (Sincol: 23 mm); capas HDF/MDF | idem; mais firme que colmeia; aceita fechadura melhor | interior de uso médio | [FABRICANTE] S33; [DOC] S16 |
| **Lisa maciça** | madeira maciça (bloco ou colada); sem miolo vazado | 35–45 mm; 60–90 cm; 3–4 dobradiças; verniz/pintura | entrada, ambientes que pedem robustez | [DOC] S16; [FABRICANTE] S33 |
| **Sólida engenheirada** | núcleo 100% sólido de pinus ou MDP; capas | 35–46 mm; 60–120 cm; acabamentos premium | entrada, alto padrão, acústica | [FABRICANTE] S33, S36 |
| **Almofadada** | engradamento de montantes/travessas + almofadas salientes ou reentrantes; madeira maciça | 3, 4 ou mais almofadas; molduras; pintura/verniz | entrada, salas, estilo clássico | [FÓRUM/LOJA] S84; [FABRICANTE] S83 |
| **Com vidro** | quadro de madeira + caixilho interno + vidro; divisões | 1/4, 1/2, 3/4 de vidro; grade/quadriculado; vidro liso, jateado, canelado, laminado, temperado | cozinha, escritório, sala, banheiro | [FABRICANTE] S32, S83; [INFERIDO] para as frações |
| **Veneziana** | montantes + travessas + palhetas inclinadas fixas ou móveis | 2 ou 4 folhas; palheta fixa/móvel; madeira ou alumínio | áreas de serviço, varandas, banheiros | [FÓRUM/LOJA] S84; [FABRICANTE] S38 |
| **Macho e fêmea / lambri** | tábuas verticais ou horizontais com encaixe macho-fêmea; sem painel único | tábuas 10–20 cm; travessas Z; madeira maciça | portas rústicas, externas, celeiro | [FÓRUM/LOJA] S85; [INFERIDO] para o uso como porta |
| **Porta pronta / kit** | folha + marco + alizar + 3 dobradiças + furo de fechadura; às vezes fechadura | 60/70/80/90; vão 680/780/880/980 × 2.150; acabamento de fábrica | obra nova e reforma | [FABRICANTE] S33, S36; [DOC] S16 |

#### 3.1.1 Núcleos e capas: o que muda no modelo 3D

- **Colmeia de papel**: leve, barato, não é núcleo estrutural; a folha é um “sanduíche” de capas + colmeia. No 3D, pode ser uma caixa oca; a massa é baixa.
- **Sarrafeado**: sarrafos de madeira com espaçamento (23 mm na Sincol); mais rígido, melhor para fechadura e dobradiça. No 3D, o miolo pode ser representado por uma caixa de madeira com vazios internos, mas o volume externo é o mesmo.
- **Maciça**: madeira sólida; massa alta; 40–45 mm; exige 3–4 dobradiças e reforço no marco.
- **MDP/sólido engenheirado**: 100% compacto; mais estável que madeira maciça; usado em portas premium e acústicas.
- **Capa HDF**: placa de fibra de alta densidade; boa para pintura e laminado; é a capa típica do “porta lisa” brasileiro.
- **Capa MDF**: fibra de média densidade; mais comum em portas de interior; menor resistência à umidade.
- **Compensado**: capa de lâminas cruzadas; usado em portas mais baratas e em fundos.
- **Ficha / encabeçada**: “ficha” é a tira maciça que fecha a borda da folha; “encabeçada” é a folha com montantes/travessas maciços aparentes no topo e na base, para o compensado não ficar com o miolo à vista. É uma **opção de construção**, não um tipo de abertura [S84].

### 3.2 Medidas normativas e comerciais

#### Folha (NBR 15930-2:2018)

| Padrão | Espessura (mm) | Altura (mm) | Largura (mm) | Massa superficial |
|---|---:|---|---|---|
| **Leve** | 35 | 2.100 | 600, 700, 800, 900 | > 6 até 10 kg/m² |
| **Médio** | 35 ou 40 | 2.100 ou 2.400 | 600, 700, 800, 900 | > 10 até 20 kg/m² |
| **Pesado** | 40 ou 45 | 2.100 ou 2.400 | 600, 700, 800, 900 | > 20 até 30 kg/m² |
| **Superpesado** | 45 ou 50 | 2.100 ou 2.400 | 800, 900, 1.000, 1.100, 1.200 | > 30 kg/m² |

Fonte: [DOC] S16 (adaptação da Tabela 4 da NBR 15930-2), confirmada por [S26] e [S68]. A Tabela 4 da norma separa portas internas (leve/médio/pesado) das de entrada/externas (médio/pesado/superpesado). Para entrada/externa, as larguras padronizadas começam em 800 mm e vão até 1.200 mm; a altura vai a 2.400 mm [S16, S68].

#### Vão, kit e folha: o exemplo que resolve a confusão

| Porta vendida como | Folha L × H (mm) | Vão acabado Lv × Hv (mm) | Kit Lk × Hk (mm) | Observação |
|---|---|---|---|---|
| 60 × 210 | 600 × 2.100 | 680 × 2.150 | 645 × 2.130 | padrão leve; vão L+80 no exemplo Sincol |
| 70 × 210 | 700 × 2.100 | 780 × 2.150 | 755 × 2.134 | Sincol informa kit 755 × 2.134 |
| 80 × 210 | 800 × 2.100 | 880 × 2.150 | 855 × 2.134 | o “80 × 210” não é o vão |
| 90 × 210 | 900 × 2.100 | 980 × 2.150 | 955 × 2.134 | vão de 980 para folha de 900 |

Fontes: [DOC] S16 (fórmulas), [FABRICANTE] S33 (tabela de vãos Sincol), [FABRICANTE] S36 (tabela Pormade). **Divergência**: a NBR 15930-2 dá L+60/70/80 conforme o padrão; a Sincol usa L+80 para todas as larguras de giro. O editor deve permitir **vão = folha + folga lateral configurável**, com defaults por padrão, em vez de fixar um único valor.

#### Espessuras comerciais e massas

- 35 mm é o mínimo normativo para folha leve; 40 mm para médio/pesado; 45–50 mm para pesado/superpesado [S16, S26].
- Porta de entrada de madeira comum no Brasil: **90 × 210 cm**, folha 35–45 mm; portas de alto padrão chegam a **1,00–1,20 m** de largura e **2,40 m** de altura [S16, S68].
- Porta interna de banheiro: **60 × 210** ou **70 × 210**; quarto: **80 × 210**; entrada: **90 × 210** [S83, S84].
- A massa superficial é o critério normativo, não a espessura isolada: uma folha 900 × 2.100 com 45 kg tem ~23,8 kg/m² e é **pesada** [S26, S68].

### 3.3 Como cada tipo é construído (detalhes que afetam o modelo)

#### Porta lisa (semi-oca, sarrafeada ou maciça)

- **Quadro periférico**: montantes e travessas de madeira; a largura dos montantes precisa acomodar dobradiças e fechadura [S84].
- **Miolo**: colmeia de papel, sarrafeado, MDP ou madeira maciça; o miolo não aparece nas faces [S16, S33].
- **Capas**: HDF, MDF ou compensado; a capa define o acabamento (pintura, laminado, melamínico) [S33, S36].
- **Bordas**: ficha maciça ou fita de borda; se a borda for só compensado, aparece o miolo — daí a “encabeçada” [S84].
- **Frisos**: sulcos usados para imitar almofadas; não mudam a estrutura, mas mudam o desenho da elevação [S33, S36].

#### Porta almofadada

- Engradamento de couceiras (montantes) e travessas; as almofadas são encaixadas nos vazios e podem ser salientes ou reentrantes [S84].
- Número típico: 3 almofadas (uma inferior, uma superior e, às vezes, uma central); 4 ou mais em modelos de luxo [S84].
- A espessura do engradamento citada em manual antigo é **35–45 mm**; a largura das couceiras ~**110 mm**, travessa inferior **180–200 mm** [S84]. São valores de carpintaria tradicional, não norma atual; usar como referência de proporção, não como dimensional obrigatório.
- No 3D: a folha é uma caixa com painéis reentrantes/salientes; o número e a posição das almofadas são parâmetros.

#### Porta com vidro

- O vidro é fixado em um caixilho interno de madeira, com baguetes; a folha mantém o quadro periférico [S32, S83].
- **1/4, 1/2, 3/4**: são designações de mercado para a fração da altura da folha ocupada pelo vidro (visor baixo, médio ou quase total). **Não achei norma ABNT que fixe essas frações**; tratar como **nomenclatura comercial** e parametrizar por **altura do vidro / altura da folha** e **largura do vidro / largura da folha** [INFERIDO; NÃO CONFIRMADO como norma].
- **Grade/quadriculado**: divisões horizontais e verticais no vidro; no 3D, são montantes internos; no desenho, linhas finas [S32, S83].
- Vidro de segurança: em porta, usar **laminado ou temperado**; temperado de 8 ou 10 mm é o comum em portas de vidro [S27, S29, S91].

#### Porta veneziana

- Montantes e travessas formam um quadro; as **palhetas** (réguias inclinadas) preenchem o vão e permitem ventilação permanente [S84].
- Palhetas podem ser fixas ou móveis; a versão móvel permite regular a ventilação [S38].
- Pode ter 2 ou 4 folhas; para abrir totalmente em parede de um tijolo, usar batente duplo ou dobradiças especiais (palmela) [S84].
- No desenho de elevação, as palhetas são linhas horizontais inclinadas; em planta, a porta é desenhada como folha comum, com a indicação “veneziana” no quadro [INFERIDO].

#### Porta macho e fêmea / lambri

- Tábuas com encaixe macho-fêmea; a fixação fica escondida no encaixe; pode ter travessas Z ou diagonais para rigidez [S85].
- É uma porta **de tábuas**, não uma folha de miolo; a espessura é a da tábua (10–20 mm) ou do conjunto com estrutura [S85].
- Uso típico: externa, rústica, celeiro, áreas de serviço; não é boa para vedação acústica [INFERIDO].
- No 3D: representar as tábuas como ripas verticais/horizontais; o número de ripas depende da largura e da largura da tábua.

#### Porta pronta (kit)

- Composição: folha + marco + alizar + 3 dobradiças + furo de fechadura; fechadura e vedaporta podem ser opcionais [S33, S36].
- Instalação com espuma expansiva; o vão é padronizado (ex.: 880 × 2.150 para folha 800) [S33].
- Vantagem: acabamento de fábrica, instalação em uma etapa; desvantagem: menos flexível para vãos fora do padrão [S33, S36].
- No editor, “porta pronta” deve ser um **conjunto** (frame + leaf + casing), não uma folha solta.

### 3.4 Portas de madeira com vidro: frações usuais

| Configuração | O que é | Uso típico | Status |
|---|---|---|---|
| **1/4 de vidro** | vidro ocupa cerca de 1/4 da altura, geralmente no topo (visor) | banheiro, cozinha, escritório | [INFERIDO] a partir da prática de mercado; [NÃO CONFIRMADO] como termo normativo |
| **1/2 de vidro** | metade superior (ou inferior) em vidro | cozinha, sala, divisória | [INFERIDO] |
| **3/4 de vidro** | quase toda a folha é vidro, com quadro periférico | sala, varanda, escritório | [INFERIDO] |
| **Grade / quadriculado** | vidro dividido em pequenos painéis por montantes | cozinha, banheiro, estilo colonial | [FABRICANTE] S32, S83 |
| **Visor** | pequeno vidro circular/retangular, normalmente na altura dos olhos | porta de entrada, hospital, cozinha | [FÓRUM/LOJA] S32 |

**Recomendação de parametrização**: em vez de um enum `vidro_1_4 / 1_2 / 3_4`, usar `glazingHeightRatio` (0–1), `glazingWidthRatio` (0–1), `glazingOffset` (posição vertical) e `gridRows/cols`. Os nomes comerciais viram **presets** desses campos.

### 3.5 Batente, alizar, soleira e folgas

#### 3.5.1 Batente/marco de madeira

| Parâmetro | Valores comuns no Brasil | NBR 15930-2 (mínimos por padrão) | Observações |
|---|---|---|---|
| Largura (profundidade na parede) | **9, 11, 13, 14, 15 cm**; também 7,5 / 9,5 / 12 / 18 / 22 cm | 70 / 90 / 110 / 110 mm (leve/médio/pesado/superpesado) | a largura deve acompanhar a **parede acabada** (com reboco) |
| Espessura da alma | **3 cm** no batente 3×14 | 30 / 35 / 45 / 50 mm | 3 cm atende ao leve; o padrão médio pede 35 mm |
| Rebaixo | ~1 cm de profundidade; largura = espessura da folha + 2 mm | 10 / 10 / 15 / 20 mm de profundidade | o rebaixo define o encosto e a folga |
| Seção típica | **3 × 14 cm** (30 × 140 mm) | largura mínima 90 mm no médio | o 14 cm é largura, não espessura |
| Fixação | argamassa, espuma PU, parafusos | depende do sistema | a fixação muda a folga e o vão |

Fontes: [DOC] S16 (Tabela 7), [ORÇAMENTO] S4 (batente 3×14), [FABRICANTE] S33, [FÓRUM/LOJA] S61. **Divergência importante**: o batente 3×14 é onipresente no mercado, mas a NBR 15930-2 exige 35 mm de alma para o padrão médio. Se o editor certificar “NBR 15930”, precisa avisar; se for só “padrão de mercado”, 30 mm é aceitável.

**“Batente da parede” vs. “batente de reboco”**: não achei definição normativa. Na prática, “batente da parede” é o marco cuja largura acompanha a **espessura acabada** da parede; “batente de reboco” é o marco mais estreito, usado quando o reboco é grosso, deixando o alizar cobrir a diferença. [INFERIDO; NÃO CONFIRMADO como termo de norma]. O editor deve tratar isso como **largura do marco** + **largura do alizar**, não como dois tipos rígidos.

**Marco envolvente vs. não envolvente** (NBR 15930-2): o envolvente acompanha a largura nominal da parede; o não envolvente atende apenas ao mínimo e deixa o alizar fazer o arremate [S16].

#### 3.5.2 Alizar

| Parâmetro | Valores comuns | NBR 15930-2 | Observações |
|---|---|---|---|
| Seção | **5 × 1,5 cm** (50 × 15 mm) | 40×8, 50×10, 60×12, 70×15 mm | o 5×1,5 é uma combinação de largura média com espessura superpesada |
| Largura | 5 cm; também 4, 6, 7, 9,8 cm | 40 / 50 / 60 / 70 mm | cobre a junta parede–marco |
| Espessura | 1,5 cm; também 0,8 / 1,0 / 1,2 cm | 8 / 10 / 12 / 15 mm | quanto maior, mais proeminente |
| Fixação | pregos sem cabeça, cola, encaixe | — | a fixação não muda a geometria |
| Encontro | meia-esquadria a 45° | — | regra de desenho/execução |
| Regulável | aba que absorve pequenas diferenças de parede | — | não substitui medir a parede |

Fontes: [DOC] S16 (Tabela 8), [ORÇAMENTO] S63 (alizar 5×1,5), [FÓRUM/LOJA] S61, S62. O alizar **não** é elemento de desempenho da porta (salvo portas especiais), por isso a norma permite variação; para o editor, é um acabamento independente [S16].

#### 3.5.3 Soleira

| Parâmetro | Valores usuais | Fonte |
|---|---|---|
| Material | granito, mármore, madeira, alumínio, aço | [FÓRUM/LOJA] S64, S65 |
| Largura | **12–20 cm**, acompanhando a parede acabada; 15 cm é o padrão SINAPI | [ORÇAMENTO] S64 |
| Espessura | **2 cm** para soleira interna; **3 cm** para soleira externa/tráfego pesado | [FÓRUM/LOJA] S65 |
| Comprimento | largura do vão + folgas | [ORÇAMENTO] S64 |
| Pingadeira | 1,5 cm da borda, quando externa | [FÓRUM/LOJA] S65 |
| Caimento | 1–2% para fora, quando exposta | [FÓRUM/LOJA] S65 |

A NBR 15930-1 define soleira como “superfície do piso acabado ou peça de acabamento sob a porta, no alinhamento da parede” [S15]. No editor, `soleira` deve ser uma peça separada do piso, com `thickness`, `width`, `overhang` e `slope`.

#### 3.5.4 Folgas

| Folga | NBR 15930-2 | Prática de mercado | Observação |
|---|---:|---:|---|
| Folha–travessa do marco (topo) | 3 mm | 2–5 mm | padrão |
| Folha–montante (lateral, total) | 5 mm | 3–5 mm | total, não por lado |
| Folha–soleira (piso seco) | 7 mm | 5–10 mm | para ventilação/atrito |
| Folha RU–piso molhado | 17 mm | 10–20 mm | banheiro/área úmida |
| Folha–piso para ventilação mecânica | 27 mm | 20–30 mm | retorno de ar |
| Tolerância | ±2 mm | — | execução |

Fonte: [DOC] S16. **Divergência**: a prática frequentemente usa 5–8 mm de folga inferior; a norma diferencia piso seco (7), molhado (17) e ventilação (27). O editor deve ter um **tipo de piso** (seco/molhado/ventilação) que altere a folga.

### 3.6 Como a porta de madeira se desenha

| Vista | O que representar | Escala usual |
|---|---|---|
| **Planta** | vão na parede; marco; folha aberta a 90°; arco de giro; lado da dobradiça; soleira; alizar; cota L × H | 1:50 ou 1:100 |
| **Elevação** | contorno do vão; marco; folha; almofadas/frisos/veneziana/vidro; maçaneta; símbolo de abertura; cota L × H | 1:50 / 1:25 / 1:20 |
| **Corte** | parede cortada; marco; rebaixo; folha; alizar; soleira; verga; folgas | 1:20 / 1:10 / 1:5 |
| **Detalhe** | seção do batente, alizar, soleira, ferragens | 1:5 / 1:2 |

A NBR 6492:2021 exige, para esquadrias, “elevações com indicação de funcionamento e locação de detalhes, plantas e cortes esquemáticos” e “detalhes construtivos ou esquemáticos de lateral, verga, soleira e peitoril” [S22]. Ela **não** fixa o desenho do arco nem o triângulo; isso é convenção de prática (ver §7).

<!-- CONTINUA -->
