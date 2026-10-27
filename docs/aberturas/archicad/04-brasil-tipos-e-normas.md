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
- O batente de madeira mais usado no Brasil é **3 × 14 cm** (seção 30 × 140 mm), com rebaixo; a NBR 15930-2 pede alma de **30/35/45/50 mm** e largura mínima de **70/90/110/110 mm** para os padrões leve/médio/pesado/superpesado. Há divergência entre o “3 × 14” de mercado e o mínimo normativo do padrão médio (35 mm) [S95, S16, S64].
- O alizar comum é **5 × 1,5 cm** (50 × 15 mm). A NBR 15930-2 padroniza **40×8, 50×10, 60×12 e 70×15 mm**; portanto o 5×1,5 de mercado é mais espesso que o alizar médio normativo (50×10). Isso precisa ser tratado como **dois parâmetros independentes** (largura e espessura), não como um único “5×1,5” [S16, S63].
- A NBR 9050:2020 exige **vão livre ≥ 0,80 m × 2,10 m** (tolerância de −20 mm), maçaneta alavanca de **≥ 100 mm**, a **0,80–1,10 m** do piso, e puxador vertical/horizontal com dimensões específicas. Em porta de duas folhas, pelo menos uma deve dar 0,80 m; em correr e sanfonada o vão livre de 0,80 m também deve ser garantido [S21, S90].
- Para esquadrias externas, a **NBR 10821-2:2017** classifica desempenho em **Mínimo / Intermediário / Superior** para permeabilidade ao ar, estanqueidade à água, cargas uniformes, manuseio e corrosão, em função da **região de vento (I–V)** e da **altura da edificação** (até 6, 15, 30, 60 e 90 m). As pressões de ensaio vão de **350 Pa** (até 6 m, região I) a **1.400 Pa** (até 30 m, região V) nas linhas que confirmei; a tabela completa da norma vai além disso [S18, S19, S20, S88].
- O PBQP-H fixa **dimensões máximas** de tipologias homologadas: correr de alumínio **1,00 × 1,50 m**, **1,20 × 1,20 m** e **1,20 × 1,50 m** (altura × largura); correr de PVC **1,40 × 1,60 m** e **1,60 × 1,60 m**; maxim-ar **1,00 × 1,00 m**. Isso é limite de avaliação, não catálogo comercial [S10, S11, S13, S14].
- A **NBR 15575-1** recomenda, para salas e dormitórios, peitoril **≤ 1,00 m** e testeira do vão **≤ 2,20 m**; para ventilação, **7% da área de piso** nas zonas bioclimáticas 1–7, **12%** no Norte (ZB 8) e **8%** no Nordeste/Sudeste (ZB 8) [S25, S92].
- Medidas comerciais de janela mais recorrentes: **60×60, 80×80, 100×100, 120×120, 120×100, 150×100, 150×120, 200×120 cm** (largura × altura, normalizado; as fontes às vezes usam altura × largura). Há muita variação de orientação entre fabricantes; o editor deve guardar **largura e altura em campos separados** [S30, S32, S96].
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

Onde `L` e `H` são largura e altura da **folha**. Para fixação com espuma PU, a NBR 15930-2 tem outra tabela; o catálogo Sincol usa, para folha 800, vão **880 × 2.150 mm** (L + 80, H + 50), que coincide com o padrão pesado [S16, S33]. **Ressalva**: a tabela da PBH reproduz três valores (L+60/70/80 e L+45/55/65) para quatro padrões; adotei o maior valor para o superpesado, mas a tabela original da NBR 15930-2 deve ser conferida [S16].

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
| 60 × 210 | 600 × 2.100 | 680 × 2.150 | 655 × 2.134 | padrão leve; vão L+80 no exemplo Sincol |
| 70 × 210 | 700 × 2.100 | 780 × 2.150 | 755 × 2.134 | Sincol informa kit 755 × 2.134 |
| 80 × 210 | 800 × 2.100 | 880 × 2.150 | 855 × 2.134 | o “80 × 210” não é o vão |
| 90 × 210 | 900 × 2.100 | 980 × 2.150 | 955 × 2.134 | vão de 980 para folha de 900 |

Fontes: [DOC] S16 (fórmulas), [FABRICANTE] S33 (tabela de vãos Sincol), [FABRICANTE] S36 (tabela Pormade). **Divergência**: a NBR 15930-2 dá L+60/70/80 conforme o padrão; a Sincol usa L+80 para todas as larguras de giro. A coluna **Kit** acima usa os valores Sincol (L+55, H+34) para 60–90; a NBR 15930-2 dá L+45/55/65 e H+30/35/40. Não misture as duas bases. O editor deve permitir **vão = folha + folga lateral configurável**, com defaults por padrão, em vez de fixar um único valor.

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
- Vidro de segurança: em porta, usar **laminado ou temperado**; temperado de 8 ou 10 mm é o comum em portas de vidro [S27, S97, S91].

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

Fontes: [DOC] S16 (Tabela 7), [ORÇAMENTO] S95 (batente 3×14), [FABRICANTE] S33, [FÓRUM/LOJA] S61. **Divergência importante**: o batente 3×14 é onipresente no mercado, mas a NBR 15930-2 exige 35 mm de alma para o padrão médio. Se o editor certificar “NBR 15930”, precisa avisar; se for só “padrão de mercado”, 30 mm é aceitável.

**“Batente da parede” vs. “batente de reboco”**: não achei definição normativa. Na prática, “batente da parede” é o marco cuja largura acompanha a **espessura acabada** da parede; “batente de reboco” é o marco mais estreito, usado quando o reboco é grosso, deixando o alizar cobrir a diferença. [INFERIDO; NÃO CONFIRMADO como termo de norma]. O editor deve tratar isso como **largura do marco** + **largura do alizar**, não como dois tipos rígidos.

**Marco envolvente vs. não envolvente** (NBR 15930-2): o envolvente acompanha a largura nominal da parede; o não envolvente atende apenas ao mínimo e deixa o alizar fazer o arremate [S16].

#### 3.5.2 Alizar

| Parâmetro | Valores comuns | NBR 15930-2 | Observações |
|---|---|---|---|
| Seção | **5 × 1,5 cm** (50 × 15 mm) | 40×8, 50×10, 60×12, 70×15 mm | o 5×1,5 é uma combinação de largura média com espessura superpesada |
| Largura | **5 cm e 7 cm**; também 4, 6, 9,8 cm | 40 / 50 / 60 / 70 mm | cobre a junta parede–marco; **7 × 1,5 cm** é comum em portas de entrada |
| Espessura | 1,5 cm; também 0,8 / 1,0 / 1,2 cm | 8 / 10 / 12 / 15 mm | quanto maior, mais proeminente |
| Fixação | pregos sem cabeça, cola, encaixe | — | a fixação não muda a geometria |
| Encontro | meia-esquadria a 45° | — | regra de desenho/execução |
| Regulável | aba que absorve pequenas diferenças de parede | — | não substitui medir a parede |

Fontes: [DOC] S16 (Tabela 8), [ORÇAMENTO] S63 (alizar 5×1,5), [FÓRUM/LOJA] S61, S62. O alizar **não** é elemento de desempenho da porta (salvo portas especiais), por isso a norma permite variação; para o editor, é um acabamento independente [S16]. A medida **7 × 1,5 cm** é prática de mercado; em dimensões ela coincide com o padrão superpesado da norma (70 × 15 mm), mas não é o “médio” [INFERIDO; S16].

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

## 4. Portas de outros materiais e sistemas de abertura

### 4.1 Tipologia de abertura e representação

| Tipo | Geometria/eixo | Planta | Elevação | Medidas usuais | Opções | Fonte |
|---|---|---|---|---|---|---|
| **Giro 1 folha** | eixo vertical na borda; dobradiças | folha aberta a 90°, arco de raio = largura | retângulo; maçaneta no lado oposto à dobradiça; triângulo/V | 60/70/80/90/100 × 210; vão 680–1.080 | sentido esquerda/direita; para dentro/fora; 2 ou 3 dobradiças | [DOC] S15, S16; [FÓRUM/LOJA] S43 |
| **Giro 2 folhas** | dois eixos verticais nas bordas | duas folhas + dois arcos; encontro no centro | duas folhas; divisão central; dois símbolos | 120/140/160/180 × 210; cada folha ≥ 60 | uma folha fixa + uma móvel; com bandeira | [DOC] S15; [FÓRUM/LOJA] S43 |
| **Pivotante** | eixo vertical deslocado da borda (pivô no piso e na travessa) | folha aberta; arco com centro no pivô; eixo fora do centro | folha; puxador vertical; sem dobradiça aparente | 100/110/120 × 210; sob medida | eixo a 10–20 cm da borda; 180°; mola de piso | [DOC] S15; [FABRICANTE] S34, S28 |
| **Correr de embutir** | trilho dentro de bolsão na parede | folha desliza para dentro da parede; linhas tracejadas do bolsão | folha embutida; trilho oculto | 620/720/820/920 × 210; vão 680–980; bolsão ~1.305–1.905 | 1 folha; com puxador cava; parede nova | [FABRICANTE] S33, S35; [FÓRUM/LOJA] S86 |
| **Correr de sobrepor** | trilho aparente na face da parede | folha corre paralela à parede; trilho visível | folha sobreposta; trilho e roldanas aparentes | 620/720/820/920 × 210; vão 680–980 | 1 ou 2 folhas; trilho aparente; reforma | [FABRICANTE] S33, S35 |
| **Camarão / dobradiça** | 2+ folhas articuladas; trilho superior; dobram para um lado | folhas em “V”, meio abertas (≈60°), com arcos; guia tracejada | folhas articuladas; puxadores centrais; triângulos | 2 ou 4 folhas; sob medida; profundidade aberta ~700 (4 folhas) | 2/4 folhas; madeira, alumínio, PVC; puxador | [FABRICANTE] S33; [FÓRUM/LOJA] S43, S78 |
| **Sanfonada PVC** | lâminas articuladas; trilho superior; dobram em sanfona | linhas em zigue-zague; trilho; recolhe lateralmente | lâminas verticais; puxador; sem batente | 60/70/80/90 × 210 | PVC branco/cinza/bege/amadeirado; banheiro/despensa | [FABRICANTE] S55, S56; [FÓRUM/LOJA] S87 |
| **Vai-e-vém** | dobradiças de duplo sentido; eixo vertical | dois arcos, um para cada lado; folha central | folha com visor; mola/ dobradiça vai-e-vém | 80/90/100 × 210 | cozinha industrial, restaurante, hospital | [DOC] S15; [FÓRUM/LOJA] S43 |
| **Porta-balcão** | 2–6 folhas; giro ou correr; veneziana + vidro | folhas abertas ou trilhos; veneziana e vidro | divisão horizontal; veneziana embaixo, vidro em cima; cremona | 120/140/150/200 × 210 (L×A) | 2/4/6 folhas; madeira, alumínio; vidro/veneziana | [FABRICANTE] S38, S39, S40 |
| **Basculante (porta/garagem)** | eixo horizontal; contrapesos | folha fechada; eixo e sentido | painel; articulação; contrapeso | sob medida | manual/automática; metal; madeira | [FÓRUM/LOJA] S50, S51 |
| **Enrolar** | eixo horizontal acima do vão; cortina de lâminas | vão; guias; rolo tracejado | lâminas horizontais; guias; rolo | vão + 7 cm de largura; + 5 cm de altura; exemplo 2,80 × 2,25 | manual/motor; aço/galvanizado; slats 100 mm | [FÓRUM/LOJA] S49, S50 |
| **Seccionado** | painéis horizontais; trilhos verticais e horizontais | vão; trilhos; painéis | 4 painéis; frisos; puxador | exemplo 2,50 × 2,125; quadro 2,70 × 2,225 | 4/5 painéis; motor; isolamento | [FÓRUM/LOJA] S50, S51 |

#### 4.1.1 Porta de correr: embutir vs. sobrepor

- **Embutir (pocket)**: a folha corre para dentro de um bolsão na parede. Exige planejamento na obra; o bolsão tem cerca de **uma largura de folha + folgas**. A Sincol informa, para folha 620, abertura 1 de **680 × 2.150** e abertura 2 (bolsão) de **1.305 mm**; para 920, **980 × 2.150** e **1.905 mm** [S35].
- **Sobrepor (surface)**: a folha corre na face da parede, com trilho aparente. É a solução de reforma; exige espaço livre na parede e afastamento de **10–12 mm** para não raspar [S86].
- **Transpasse**: a folha sobreposta deve ser maior que o vão; a prática usa **5 cm de transpasse** em cada lado e **5 cm** no topo, com folga inferior de **5–8 mm** [S86]. Isso é regra de mercado, não norma; parametrizar.
- **Desenho**: em planta, a folha é um retângulo paralelo à parede; o trilho e o percurso aparecem em linha tracejada; a seta indica o sentido. Em elevação, a folha cobre o vão e o trilho aparece no topo [S43, S86].

#### 4.1.2 Camarão e sanfonada: não são a mesma coisa

- **Camarão**: 2 ou mais folhas **rígidas** articuladas, com dobradiças entre elas; recolhem para um lado; aceitam madeira, alumínio e PVC; vedação melhor que a sanfonada, mas ainda inferior à de giro [S33, S43].
- **Sanfonada**: uma única folha contínua de lâminas finas (geralmente PVC), dobrando em sanfona; é mais barata, mais leve e com vedação pior; não serve como porta de segurança [S55, S56, S87].
- **Desenho**: camarão em planta é uma sequência de folhas em “V”, com arcos; sanfonada é um zigue-zague. Em elevação, camarão mostra folhas e puxadores; sanfonada mostra lâminas verticais [S43, S78].

### 4.2 Portas de alumínio e vidro

| Tipo | Construção | Medidas comerciais | Vidro/perfil | Ferragens | Fonte |
|---|---|---|---|---|---|
| **Giro** | quadro de alumínio + folha + vidro | 70/80/90/100 × 210; sob medida | perfil 25/30/40; vidro 4–10 mm | 2–3 dobradiças; fechadura; maçaneta | [FABRICANTE] S29, S30 |
| **Correr** | 2/3/4/6 folhas; trilhos superior/inferior | 120/160/180 × 210; 200 × 210 | perfil 25; vidro 4–10 mm | roldanas, fecho, puxador | [FABRICANTE] S29, S30; [DOC] S18 |
| **Pivotante** | folha de alumínio/vidro; pivô superior/inferior | 100/120 × 210; sob medida | perfil 30/40; vidro 8–10 mm | pivô, mola de piso, puxador | [FABRICANTE] S29, S28 |
| **Porta-balcão** | 2–6 folhas; vidro e/ou veneziana | 120/150/200 × 210 (L×A) | perfil 25; vidro 4–6 mm | cremona, roldanas, fecho | [FABRICANTE] S38, S40 |

- A ferragem de giro em alumínio das linhas 20/25/32 tem **dimensão máxima de 900 × 2.100 mm** por folha, com carga de 10 kg por dobradiça de 2 abas e 20 kg por dobradiça de 3 abas [S28].
- A NBR 10821-2 se aplica a portas externas; a NBR 15930-2 não se aplica a alumínio. Para porta interna de alumínio, usar a NBR 10821-6 (esquadrias internas) ou especificação do fabricante [S18, S20].
- **Cores**: branco, preto, bronze, natural anodizado, brilhante, fosco; pintura eletrostática ou anodização [S29, S30].

### 4.3 Portas de vidro temperado (blindex)

| Tipo | Como é construído | Medidas usuais | Ferragens | Observações | Fonte |
|---|---|---|---|---|---|
| **Giro 1 folha** | vidro temperado monolítico, sem caixilho; ferragens pontuais | 72–92 × 210; máxima ~1.000 × 2.100 | dobradiças de vidro, mola de piso, fechadura, puxador | vidro 8 ou 10 mm; furação antes da têmpera | [FABRICANTE] S27, S97, S28 |
| **Giro 2 folhas** | duas folhas; encontro central | 120–140 × 210 | dobradiças, mola de piso, fecho | uma folha pode ser fixa | [FABRICANTE] S97 |
| **Correr** | 2/4/6 folhas; trilho superior/inferior | 1 folha 72–92; 2 folhas 120–140; 4 folhas 160–200 | carrinhos, trilho, puxador, fechadura | vidro 10 mm é o padrão para automatizadores | [FABRICANTE] S97, S28 |
| **Pivotante** | eixo vertical/horizontal; ferragens | sob medida; 1.000 × 2.100 é limite comum | pivô, mola de piso | 180°; muito usada em entrada | [FABRICANTE] S97, S28 |

- O vidro temperado **não pode ser cortado, furado ou lapidado depois da têmpera**; todos os recortes e furos devem ser previstos antes [S91].
- A NBR 7199 (edição vigente; li a versão de 2017) exige **vidro de segurança** (temperado ou laminado) em portas; a NBR 14698 caracteriza o temperado [S27, S91].
- Ferragens FVT para vidro são projetadas para **8 e 10 mm**; as dimensões máximas variam por ferragem (por exemplo, 600 × 1.900, 700 × 2.100, 800 × 2.100, 1.000 × 2.100) [S28].
- Em planta, a porta de vidro é desenhada como folha + arco (giro) ou retângulo + seta (correr); em elevação, sem caixilho, com puxador e fechadura; em corte, mola de piso e folga inferior [INFERIDO; S28].

### 4.4 Portas de aço/ferro, corta-fogo, enrolar e seccionado

#### 4.4.1 Porta de aço de giro

- Folha de chapa dobrada com quadro interno; batente de aço galvanizado; pintura anticorrosiva [S84, S20].
- Medidas comuns: **800/900 × 2.100** (faixa usual); sob medida; 3 dobradiças; fechadura; maçaneta ou barra [INFERIDO; S84].
- Uso: externa, serviço, indústria, áreas de segurança.
- No 3D: folha fina (40–50 mm), batente metálico, sem alizar de madeira; acabamento pintado.

#### 4.4.2 Porta corta-fogo (NBR 11742)

| Classe | Resistência mínima | Uso recomendado (NBR 11742) |
|---|---:|---|
| **P-30** | 30 min | paredes CF-60; apartamentos residenciais |
| **PF-30** | 30 min + fumaça | acesso a escadas com antecâmara; corredores de fuga |
| **P-60** | 60 min | paredes CF-120; acesso à antecâmara; escritórios |
| **PF-60** | 60 min + fumaça | escadas sem antecâmara, quando inevitável |
| **P-90** | 90 min | paredes CF-180; recintos de medição/proteção/transformação |
| **P-120** | 120 min | paredes CF-240; ligações industriais específicas |

Fonte: [DOC] S24. A norma não admite classes intermediárias; a letra **F** após P indica “à prova de fumaça” (ex.: PF-30) [S24].

Requisitos dimensionais e construtivos [S24]:

- **Vão-luz**: largura mínima **800 mm**, máxima **2.200 mm**; altura mínima **2.000 mm**, máxima **2.300 mm**.
- Vão-luz ≥ 1.200 mm: **duas folhas iguais**; pelo menos uma folha móvel com vão-luz ≥ 800 mm.
- Folgas: folha–batente **4–8 mm**; entre folhas **4–8 mm**; folha–soleira **5–10 mm**.
- Folha deve transpor o batente em faixa contínua de **≥ 25 mm** no rebaixo.
- Ferragens obrigatórias: **3 dobradiças** por folha; fechadura com maçaneta alavanca ou barra antipânico; **fechamento automático**; em duas folhas, **seletor de fechamento**.
- Barra antipânico a **0,90 m** do piso; maçaneta a **1.050 mm** da borda inferior da folha; alavanca ≥ 100 mm [S24, S21].
- Batente de aço galvanizado; em alvenaria/concreto, chapa mínima 1,2 mm (tipo I) ou 1,9 mm (tipo II); batente preenchido com argamassa [S24].
- Soleira incombustível; porta sempre fechada; não pode ser trancada no sentido de fuga [S24].
- Desenho: em planta, folha + arco; em elevação, barra antipânico, mola/braço, letreiro; em corte, batente de aço e soleira [INFERIDO; S24].

#### 4.4.3 Porta de enrolar

- Cortina de lâminas de aço/galvanizado enrolada em um rolo acima do vão; guias laterais [S49, S50].
- Para instalar, prever **7 cm a mais de largura** que o vão e **5 cm a mais de altura** para o motor/suporte [S49].
- Exemplo de desenho: vão **2,80 × 2,25 m**; rolo **350 × 350 mm**; lâminas de **100 mm** [S50].
- Acionamento manual ou motorizado; chapa 22 (0,80 mm) ou chapa 20 (0,95 mm); peso ~6,4–7,6 kg/m² [S49].
- Desenho: planta com o rolo tracejado dentro/atrás da parede; elevação com lâminas horizontais e guias; corte com rolo e guia [S50].

#### 4.4.4 Portão seccionado

- Painéis horizontais articulados que sobem por trilhos verticais e correm para o teto [S50, S51].
- Exemplo de desenho: vão **2,50 × 2,125 m**; 4 painéis; quadro **2,70 × 2,225 m**; trilhos horizontais para dentro [S50].
- Precisa de altura de forro e espaço livre para o trilho; é a solução quando há altura e não há espaço lateral [S50].
- Desenho: planta com trilhos tracejados; elevação com 4 painéis, frisos e puxador; corte com trilho e motor [S50].

#### 4.4.5 Portão basculante

- Painel rígido que gira em torno de eixo horizontal, com contrapesos laterais; abre para fora ou para dentro [S49, S51].
- Precisa de área livre para o raio de giro; não é indicado para recuo curto [S49].
- Desenho: planta com o painel aberto e o raio; elevação com contrapesos; corte com eixo [INFERIDO; S50].

### 4.5 Portas de PVC

| Tipo | Construção | Medidas | Cores | Observações | Fonte |
|---|---|---|---|---|---|
| **Sanfonada** | lâminas de PVC articuladas; trilho superior | 60/70/80/90 × 210 | branco, cinza, bege, amadeirado | impermeável, não propaga chama, baixa vedação; não é segurança | [FABRICANTE] S55, S56 |
| **De abrir** | folha de PVC com alma de aço; batente de PVC | 60/70/80/90 × 210 (faixa usual; sob medida) | branco, marfim, bege, cinza | boa para banheiro/área úmida; ferragens específicas | [INFERIDO; S57] |
| **De correr** | folhas de PVC com alma de aço; trilho | 120/140/160 × 210 (faixa usual; sob medida) | branco, cinza | externa; NBR 10821; persiana integrada | [DOC] S10, S11; [FABRICANTE] S57 |

- O PVC é fornecido pronto, com vidro e ferragens; não precisa pintura; é autoextinguível; tem baixo coeficiente de transmissão de calor [S57].
- Para esquadrias externas de PVC, o PBQP-H homologa correr **1,40 × 1,60** e **1,60 × 1,60 m**, com e sem persiana integrada [S11, S14].
- Desenho: igual ao da porta de madeira/alumínio; a diferença é a seção do perfil e o acabamento [INFERIDO].

## 5. Janelas

### 5.1 Tipologias, funcionamento e desenho

| Tipo | Como funciona | Planta | Elevação | Medidas usuais | Opções | Fonte |
|---|---|---|---|---|---|---|
| **Correr 2/3/4/6 folhas** | folhas deslizam na horizontal, em trilhos paralelos | janela fechada; 3–4 linhas; folhas sobrepostas; seta | folhas com montantes; divisão; seta de correr | 120×100, 150×100, 120×120, 150×120, 120×150, 200×120 (L×A) | bandeira fixa; veneziana; persiana integrada; grade | [DOC] S18; [FABRICANTE] S29, S30 |
| **Maxim-ar** | folha articulada no topo; braços laterais; a base projeta-se para fora e o topo desce | janela fechada; 3–4 linhas; seta/eixo | triângulo/V com vértice no topo; linha tracejada da base | 40×40, 50×50, 60×60, 80×60, 80×80, 100×100 (L×A) | 1–3 folhas; com fixo; com bandeira; grade | [DOC] S18, S41; [FABRICANTE] S32 |
| **Basculante** | eixo horizontal central ou excêntrico; parte superior entra e inferior sai (ou o inverso) | janela fechada; 3–4 linhas; linha diagonal do eixo | V/triângulo; eixo horizontal; seta de rotação | 40×40 a 100×100; 1–6 folhas; vitrô | eixo central/excêntrico; alavanca; 1–6 folhas | [DOC] S9, S41; [FÓRUM/LOJA] S42, S54 |
| **Pivotante** | eixo vertical ou horizontal fora do centro; folha gira 180° | folha fechada; eixo deslocado; arco (se vertical) | folha; eixo; puxador | 60×60 a 120×120 (faixa usual); sob medida | eixo vertical/horizontal; 1 folha; 180° | [DOC] S41; [FÓRUM/LOJA] S42 |
| **Guilhotina** | folha desliza na vertical, dentro do marco | janela fechada; 3–4 linhas; seta vertical | duas folhas sobrepostas; uma sobe | 60×120, 80×120, 100×150; sob medida | madeira/alumínio; contrapeso/mola; 2 folhas | [DOC] S41; [FABRICANTE] S30 |
| **Abrir 1/2 folhas** | eixo vertical na lateral; abre para dentro/fora | folha aberta + arco (1 ou 2) | folha + arco; maçaneta; divisão | 60×60 a 120×120; 2 folhas 120×120 | 1/2 folhas; madeira, PVC ou alumínio; para dentro/fora; veneziana | [DOC] S18; [FÓRUM/LOJA] S42 |
| **Fixa** | sem movimento; vidro fixo no caixilho | janela fechada; 3–4 linhas; sem seta | caixilho + vidro; divisões | 80×60 (L×A); qualquer dimensão | 1 ou mais painéis; grade; bandeira | [DOC] S18; [FABRICANTE] S30 |
| **Veneziana** | palhetas fixas ou móveis; ventilação permanente | janela fechada; linhas; sem arco | palhetas horizontais; 2/4/6 folhas | 120×100, 150×100, 120×120 (L×A) | 2/4/6 folhas; alumínio/madeira; fixa/correr | [FABRICANTE] S38 |
| **Pele de vidro** | fachada-cortina; vidro colado/encaixilhado em estrutura de alumínio | planta da fachada; montantes; módulos | grelha de vidro; sem caixilho aparente | sob medida; módulos usuais de 1,0–1,5 m | structural glazing; stick/unitizado; insulado | [FABRICANTE] S58, S59; [DOC] S18 |
| **Vidro temperado (blindex)** | folha de vidro temperado, sem caixilho ou com perfil mínimo; giro, correr ou fixa | folha + arco (giro) ou retângulo + seta (correr) | vidro + ferragens pontuais; sem moldura | 8/10 mm; 1 folha 72–92 × 210; 2 folhas 120–140; 4 folhas 160–200 | giro, correr, pivotante, fixa; ferragens 8/10 mm | [FABRICANTE] S27, S97, S28 |
| **Bandeira** | esquadria fixa ou basculante acima da folha | retângulo superior; linhas | fixa ou basculante; divisão | 30–60 cm de altura (usual); largura = vão | fixa; basculante; maxim-ar | [INFERIDO; S18] |
| **Porta-balcão** | 2–6 folhas; giro/correr; vidro + veneziana | folhas abertas/trilhos; veneziana | divisão horizontal; cremona | 120/140/150/200 × 210 (L×A) | madeira/alumínio; vidro/veneziana | [FABRICANTE] S38, S39, S40 |

#### 5.1.1 Basculante: para que lado abre?

Há duas situações:

- **Eixo central**: a folha gira em torno do meio; a **metade de cima entra** no ambiente e a **metade de baixo sai** (ou o contrário, conforme o lado empurrado). É a descrição usada por fontes brasileiras de tipologia [S41, S42, S54].
- **Eixo excêntrico**: o eixo não coincide com o centro nem com as extremidades. A parte maior da folha (do lado oposto ao eixo) é a que mais se projeta; a parte menor faz o movimento contrário. Assim, com eixo **acima do centro**, a **parte inferior maior abre para fora** e a **parte superior menor entra**; com eixo **abaixo do centro**, a **parte superior maior abre para fora** e a **parte inferior menor entra**. [INFERIDO a partir da geometria de rotação e das descrições de eixo central/excêntrico em S9, S41, S54; a direção final depende do lado em que se empurra a folha, que é um parâmetro.]
- O **sentido** (para dentro/fora) não é determinado só pelo eixo; é uma **opção de montagem**. O que o eixo determina é **qual parte da folha fica maior de um lado** e, portanto, qual parte se projeta mais.
- **Desenho em planta**: a janela é desenhada fechada; o tipo não é legível só pelas linhas. Usa-se uma **linha diagonal no vão** para indicar o eixo horizontal e/ou uma **nota/legenda** “basculante” no quadro. Em elevação, o **V/triângulo** com vértice no lado do eixo mostra o sentido; a linha tracejada mostra o caminho da borda livre [S43, S80, S81].
- **Desenho em corte**: o eixo aparece como um ponto/linha horizontal; a folha aberta é uma linha inclinada; a parte que entra e a que sai devem ser visíveis [INFERIDO].

#### 5.1.2 Maxim-ar: não confundir com basculante

- **Maxim-ar** = projetante-deslizante: eixo **no topo**, com translação simultânea; a folha abre para fora e a base desce. A folha inteira se projeta para fora, como uma “marquise” [S41, S42].
- **Basculante** = eixo **atravessa a folha** (central ou excêntrico); uma parte entra e outra sai [S41, S42].
- O maxim-ar permite abertura de até **90°** (alguns modelos até 180°); não permite grade/tela na parte externa; é comum em banheiro, cozinha e área de serviço [S41].
- **Desenho**: em planta, fechada; em elevação, **triângulo/V com vértice no topo** e linha tracejada da base; em corte, braço articulado e folha inclinada [S43, S44].

#### 5.1.3 Guilhotina

- Duas folhas no mesmo plano, uma superior e uma inferior; a inferior sobe e é fixada por borboletas/contrapeso [S84, S41].
- Libera cerca de **50% do vão**; boa para vãos altos e estreitos; usada em madeira e alumínio [S41, S42].
- Em planta, é desenhada fechada; a seta vertical e a nota “guilhotina” são necessárias porque o corte horizontal não mostra o movimento [INFERIDO].
- Em elevação, as duas folhas sobrepostas e a linha de encontro; em corte, os trilhos verticais e a folha que sobe [INFERIDO].

### 5.2 Medidas comerciais usuais

A tabela normaliza tudo para **largura × altura (L × A)**, mesmo quando a fonte usa “A × L”. Onde a fonte usa outra ordem, a coluna “origem” avisa.

| Família | Medidas L × A (cm) | Folhas | Origem/orientação | Fonte |
|---|---|---|---|---|
| Correr 2 folhas | 120×100; 150×100; 120×120; 150×120; 120×150 | 2 | SINAPI em A×L; JAP em L×A; convertido | [DOC] S96; [FABRICANTE] S30 |
| Correr 3 folhas | 120×100; 150×100; 150×120; 200×120 | 3 | JAP em L×A | [FABRICANTE] S30 |
| Correr 4 folhas | 200×100; 120×150; 150×120; 200×120 | 4 | SINAPI em A×L; JAP em L×A; convertido | [DOC] S96; [FABRICANTE] S30 |
| Correr 6 folhas | 150×120; 200×120; sob medida | 6 | catálogos de mercado | [FABRICANTE] S30 |
| Maxim-ar | 40×40; 50×50; 60×60; 80×60; 80×80; 100×100 | 1–3 | MGM em A×L; convertido | [FABRICANTE] S32 |
| Basculante | 40×40; 60×40; 80×40; 100×40; 50×50; 60×60; 80×60; 100×60; 80×80; 100×80; 100×100 | 1–6 | MGM em A×L; convertido | [FABRICANTE] S32 |
| Fixa | 80×60; sob medida | 1+ | SINAPI em A×L; convertido | [DOC] S96 |
| Veneziana | 120×100; 150×100; 120×120 | 2/4/6 | SINAPI em A×L; convertido | [DOC] S96 |
| Abrir | 60×60; 70×70; 80×80; 90×90; 100×100; 120×120 | 1–2 | faixa usual; sob medida | [INFERIDO; S30] |
| Guilhotina | 60×120; 80×120; 100×150; sob medida | 2 | faixa usual; sob medida | [INFERIDO; S30] |
| Pivotante | 60×60; 80×80; 100×100; 120×120; sob medida | 1 | faixa usual; sob medida | [INFERIDO; S30] |
| Porta-balcão | 120×210; 140×210; 150×210; 200×210 | 2–6 | Ideal Madeiras/MadeiraMadeira | [FABRICANTE] S39, S40 |

**Limites PBQP-H (altura × largura, não catálogo)** [S10, S11, S13, S14]:

| Tipologia | Máximo homologado |
|---|---|
| Correr alumínio, 2 folhas, 1 fixa | 1,00 × 1,50 m |
| Correr alumínio, 2 folhas móveis | 1,20 × 1,20 m |
| Correr alumínio, 2 folhas móveis | 1,20 × 1,50 m |
| Correr alumínio, 3 folhas com veneziana | 1,00 × 1,50 m |
| Correr alumínio, 3 folhas móveis com veneziana | 1,20 × 1,20 m |
| Correr alumínio, 3 folhas móveis com veneziana | 1,20 × 1,50 m |
| Correr alumínio, persiana integrada | 1,20 × 1,50 m |
| Correr PVC, 2 folhas | 1,40 × 1,60 m |
| Correr PVC, 2 folhas | 1,60 × 1,60 m |
| Correr PVC, persiana integrada | 1,40 × 1,60 m |
| Correr PVC, persiana integrada | 1,60 × 1,60 m |
| Maxim-ar alumínio | 1,00 × 1,00 m |

**Cuidado**: o PBQP-H avalia **tipologias homologadas**; ele não diz que a janela pode ser maior. Para vãos maiores, é necessário projeto específico e verificação estrutural (NBR 10821-2 / NBR 6123) [S10, S18].

### 5.3 Vidros: tipos, espessuras e uso

| Vidro | Espessuras usuais | Cores/acabamentos | Comportamento | Uso típico | Fonte |
|---|---|---|---|---|---|
| **Float / liso / cristal** | 4, 6, 8, 10 mm (até 19 mm) | incolor, verde, fumê, bronze | transparente; não é segurança | janelas e portas com caixilho | [FABRICANTE] S93, S94 |
| **Extra clear** | 4–10 mm | incolor de baixo ferro | mais transparente, sem tom verde | vitrines, divisórias, portas | [FABRICANTE] S93 |
| **Canelado / mini boreal** | 3–4 mm | incolor, âmbar, etc. | translúcido; privacidade | banheiro, cozinha, portas | [FABRICANTE] S93, S94 |
| **Jateado / acidato / fosco** | 4 mm | incolor | translúcido; privacidade | banheiro, clínica, escritório | [FABRICANTE] S93 |
| **Aramado** | 6 mm | incolor | malha de arame; resistência ao fogo | portas corta-fogo, fachadas | [FABRICANTE] S93, S94 |
| **Laminado** | 6, 8, 10, 12 mm (3+3, 4+4, 5+5, 6+6) | incolor, verde, fumê, bronze | segurança; fragmentos presos ao PVB | portas, janelas, guarda-corpo, cobertura | [FABRICANTE] S93, S94 |
| **Temperado** | 6, 8, 10 mm (portas: 8/10) | incolor, verde, fumê, bronze | 4–5× mais resistente; quebra em pequenos fragmentos | portas, box, janelas, divisórias | [FABRICANTE] S27, S91 |
| **Insulado** | composições duplas | incolor/colorido | câmara de ar; térmico/acústico | fachadas, janelas de alto desempenho | [FABRICANTE] S93 |
| **Refletivo** | 4–10 mm | prata, bronze, verde, cinza | reflete radiação solar | fachadas, janelas | [FABRICANTE] S93 |

- A espessura **não é escolhida só pelo tipo**: a NBR 7199 exige cálculo conforme dimensão, apoio, pressão de vento e tipo de vidro. 4 mm é comum em janelas pequenas; 6/8 mm em vãos maiores; 8/10 mm em portas [S91].
- Em portas, usar **vidro de segurança** (temperado ou laminado). Em guarda-corpo, usar **laminado ou temperado laminado** e confirmar a edição vigente da NBR 7199; temperado simples deve ser evitado [S27, S91; recomendação de segurança, não prescrição literal lida].
- **Vidro temperado** não pode ser cortado/perfurado depois; **vidro laminado** pode ser cortado antes da laminação; **aramado** tem malha metálica [S91, S93].

### 5.4 Perfis de alumínio: linhas e cores

| Linha | Profundidade nominal | Vidro típico | Vãos | Uso | Fonte |
|---|---:|---|---|---|---|
| **Linha 20** | 20 mm | 3–4 mm | pequenos | vitrô, maxim-ar, janela econômica | [FABRICANTE] S30 |
| **Linha 25** | 25 mm | 4 mm (até 6) | pequenos/médios | linha mais popular; correr, maxim-ar, basculante, porta | [FABRICANTE] S30, S29 |
| **Linha 30 / 32** | 30 mm | até 20 mm | médios/grandes | prédios até ~30 andares; maior desempenho | [FABRICANTE] S29 |
| **Linha 40 / 42** | 40 mm | vidros espessos/duplos | grandes | alto padrão; grandes vãos; acústica | [FABRICANTE] S29 |
| **Linha 16** | 16 mm | 3 mm | muito pequenos | vitrô/maxim-ar econômico | [FABRICANTE] S30 |

- **Acabamentos**: anodizado natural (fosco/brilhante), anodizado bronze, pintura eletrostática branca, preta, bronze, marrom, amadeirada; também “acetato”/brilhante [S29, S30].
- A anodização e a pintura devem atender à NBR 12609 e à NBR 14125; a NBR 10821-2 exige proteção dos perfis [S18].
- **Cores de ferragens**: cromado, preto, bronze, branco, fosco/inox [S28].
- O perfil 25 é o mais usado em janelas residenciais; o 30/40 é escolhido para vãos maiores e vidros mais espessos [S29].

### 5.5 Como cada janela se desenha

| Tipo | Planta | Elevação | Corte |
|---|---|---|---|
| **Correr** | fechada; 3–4 linhas; folhas sobrepostas; seta | folhas, montantes, divisão; seta | caixilho, trilhos, vidro, peitoril |
| **Maxim-ar** | fechada; 3–4 linhas; eixo no topo | V/triângulo com vértice no topo; linha tracejada da base | braço, folha inclinada, peitoril |
| **Basculante** | fechada; 3–4 linhas; linha diagonal do eixo | V/triângulo; eixo horizontal; seta | eixo, folha inclinada, peitoril |
| **Pivotante** | fechada; eixo deslocado; se vertical, arco | folha, eixo, puxador | eixo, folga, peitoril |
| **Guilhotina** | fechada; 3–4 linhas; seta vertical | duas folhas; linha de encontro | trilhos, folha que sobe, peitoril |
| **Abrir** | folha aberta + arco (1/2) | folha + arco; maçaneta | caixilho, folha, peitoril |
| **Fixa** | fechada; 3–4 linhas; sem seta | caixilho + vidro; divisões | caixilho, vidro, peitoril |
| **Veneziana** | fechada; linhas; sem arco | palhetas horizontais | palhetas, caixilho, peitoril |
| **Pele de vidro** | planta da fachada; montantes; módulos | grelha de vidro; sem caixilho aparente | montante, travessa, vidro, ancoragem |
| **Bandeira** | retângulo superior; linhas | fixa ou basculante | travessa, vidro, verga |
| **Porta-balcão** | folhas abertas/trilhos; veneziana | divisão horizontal; cremona | batente, folha, soleira/peitoril |

A NBR 6492:2021 recomenda plano de corte a **1,50 m**; janelas com peitoril acima disso são representadas **tracejadas** (projeção), e as paredes continuam em linha larga porque estão sendo cortadas [S22, S45, S46, S47]. O número exato de linhas (3 ou 4) **não é fixado pela NBR**; é convenção de escritório. O importante é: **duas linhas externas = faces do caixilho; duas internas = vidro**; para janela alta, tudo tracejado [S45, S46].

## 6. Normas e convenções

### 6.1 NBR 15930 — portas de madeira

A NBR 15930 é dividida em partes. As que interessam ao editor são [S15, S16, S26, S68]:

| Parte | Título | Conteúdo para o editor |
|---|---|---|
| **15930-1:2011** | Terminologia e simbologia | define marco, folha, alizar, batente, bandeira, seteira, vão, vão livre, soleira, contramarco, espaleta; fixa sentidos de abertura |
| **15930-2:2018** | Requisitos | dimensões de folha, vão, kit, marco, alizar; tolerâncias; desempenho; massa; ensaios |
| **15930-3** | Requisitos de desempenho adicionais | acústico, térmico, fogo, segurança (quando aplicável) |
| **15930-4** | Instalação e manutenção | fixação, folgas, ajustes |

**Classificação por uso** [S15, S16, S68]:

- **PIM** — porta interna de madeira.
- **PIM-RU** — porta interna resistente à umidade.
- **PEM** — porta de entrada de madeira.
- **PEM-RU** — porta de entrada resistente à umidade.
- **PXM** — porta externa de madeira.

**Níveis de desempenho**: **Mínimo (M), Intermediário (I), Superior (S)**. A escolha depende da ocupação e do uso; a norma dá tabelas de requisitos por nível (Anexos K e L) [S16, S26, S68]. A norma classifica o tráfego por **classes de ciclos**; fabricantes divulgam faixas de 50.000 a 200.000 ciclos (e linhas premium acima disso), mas o número exato depende da tabela da edição vigente [S68]. **Não** use um número de catálogo como default normativo.

**Simbologia de abertura (NBR 15930-1)** [S15]:

| Código | Significado |
|---|---|
| **HO** | abertura no sentido horário |
| **AH** | abertura no sentido anti-horário |
| **CD** | correr à direita |
| **CE** | correr à esquerda |
| **FA** | face de abertura |
| **FAi** | face de abertura interna |
| **FAe** | face de abertura externa |
| **FF** | face de fechamento |
| **FFi** | face de fechamento interna |
| **FFe** | face de fechamento externa |

Esses códigos são úteis no **quadro de esquadrias** e no modelo de dados: `openingDirection = HO|AH|CD|CE`, `face = FA|FF`, `faceSide = i|e`. Eles não substituem o desenho, mas evitam ambiguidade em porta de duas folhas e em correr.

#### Divergências que o editor deve expor

1. **Batente 3 × 14 vs. NBR**: 30 mm de alma é padrão leve; o médio pede 35 mm. O mercado chama o mesmo 3×14 de “batente médio” [S16, S95].
2. **Alizar 5 × 1,5 vs. NBR**: 50 × 15 mm não é o médio normativo (50 × 10); é uma combinação de largura média com espessura superpesada [S16, S63].
3. **“80 × 210” vs. vão**: 80 × 210 é folha; o vão é 880 × 2.150 (ou 860/870 dependendo do padrão) [S16, S33].
4. **Folga inferior**: 7 mm (piso seco), 17 mm (molhado) e 27 mm (ventilação) são valores normativos; a prática usa 5–10 mm [S16].
5. **Massa vs. espessura**: a classificação é por **kg/m²**, não só por espessura; uma folha de 35 mm pode ser leve ou média conforme a massa [S16, S26].

### 6.2 NBR 10821 — esquadrias externas

A NBR 10821 também é dividida em partes [S18, S20]. A edição que li é a de **2017**; o catálogo ABNT indica uma publicação de **08/2023**, que deve ser conferida antes de certificar [S70].

| Parte | Título | Uso |
|---|---|---|
| **10821-1** | Terminologia | define tipos, folhas, venezianas, etc. |
| **10821-2** | Esquadrias externas — requisitos e classificação | desempenho e classes |
| **10821-3** | Métodos de ensaio | ensaios de ar, água, vento, manuseio |
| **10821-4** | Requisitos adicionais de desempenho | acústico, térmico, etc. |
| **10821-5** | Instalação e manutenção | fixação, vedação |
| **10821-6** | Esquadrias internas | portas/janelas internas |

**Requisitos de desempenho** [S18, S19, S20]:

- Permeabilidade ao ar.
- Estanqueidade à água.
- Resistência às cargas uniformemente distribuídas (vento).
- Resistência às operações de manuseio.
- Manutenção da segurança durante os ensaios.
- Resistência à corrosão.
- Desempenho acústico.
- Desempenho térmico.
- Iluminação e ventilação natural (opcionais).

**Níveis**: **Mínimo (M), Intermediário (I), Superior (S)** para cada requisito. A classificação depende da **região de vento (I–V)** e da **altura da edificação** (até 2, 5, 10, 20 e 30 pavimentos; 6, 15, 30, 60 e 90 m) [S18, S19].

**Pressões de ensaio (NBR 10821-2, Tabela 1)** — valores em Pa, para as regiões I a V [S19]:

| Altura / pavimentos | Região I (Pe/Ps/Pa) | Região II | Região III | Região IV | Região V |
|---|---|---|---|---|---|
| até 6 m / 2 pav. | 350 / 520 / 60 | 470 / 700 / 80 | 610 / 920 / 100 | 770 / 1.160 / 130 | 950 / 1.430 / 160 |
| até 15 m / 5 pav. | 420 / 640 / 70 | 580 / 860 / 100 | 750 / 1.130 / 130 | 950 / 1.430 / 160 | 1.180 / 1.760 / 200 |
| até 30 m / 10 pav. | 500 / 750 / 80 | 680 / 1.030 / 110 | 890 / 1.340 / 150 | 1.130 / 1.700 / 190 | 1.400 / 2.090 / 230 |

`Pe` = pressão de ensaio; `Ps` = pressão de segurança; `Pa` = pressão de água. A tabela completa (20 e 30 pavimentos) e as notas estão na norma; aqui estão as linhas que consegui confirmar em fonte pública [S19]. **Não** trate esses valores como “carga de vento de projeto”: eles são pressões de **ensaio**; o projeto estrutural usa NBR 6123 [S18, S19].

**Níveis de estanqueidade** [S19, S20]:

- **Ar — Mínimo**: vazão maior; **Intermediário**: média; **Superior**: menor vazão.
- **Água — Mínimo**: permite passagem entre perfis, desde que não ultrapasse a face interna da parede; **Intermediário**: permite acúmulo apenas no perfil inferior do marco; **Superior**: não permite passagem em nenhuma parte; deve ser estanque.
- **Cargas uniformes**: não pode haver ruptura/colapso; deformações limitadas.
- **Manuseio**: esforço de abertura ≤ 100 N e fechamento ≤ 50 N (exemplo de ensaio) [S19].

**PBQP-H**: as FADs fixam tipologias e **dimensões máximas** avaliadas; não são catálogo. Para o editor, o campo `performanceClass` deve ser independente de `width/height`; a combinação só é válida se estiver dentro da FAD ou de um projeto específico [S10, S11, S13, S14].

### 6.3 NBR 9050 — acessibilidade

A NBR 9050:2020 (Emenda 1) é a referência para portas acessíveis. Os valores que afetam o editor [S21, S90]:

| Requisito | Valor | Observação |
|---|---|---|
| Vão livre da porta | **≥ 0,80 m × 2,10 m** | tolerância de **−20 mm** |
| Porta de duas ou mais folhas | pelo menos uma folha com vão livre ≥ 0,80 m | — |
| Correr e sanfonada | vão livre ≥ 0,80 m mesmo com maçaneta | a maçaneta não pode reduzir o vão |
| Locais de prática esportiva | vão livre ≥ 1,00 m | — |
| Maçaneta | alavanca, **≥ 100 mm** de comprimento, **40 mm** de afastamento da porta | altura **0,80–1,10 m** |
| Puxador vertical | diâmetro **25–35 mm**; comprimento **≥ 0,30 m**; **0,10 m** do batente | altura **0,80–1,10 m** (medida da metade) |
| Puxador horizontal | diâmetro **25–35 mm**; comprimento **≥ 0,40 m**; **0,10 m** das dobradiças | altura da maçaneta ou 0,80–1,10 m |
| Barra antipânico | altura **0,90 m** | NBR 11785 |
| Abertura | um único movimento | — |
| Proteção contra impacto | até **0,40 m** do piso, no lado oposto ao da abertura | recomendação |
| Porta de sanitário/vestiário | puxador horizontal no lado oposto ao da abertura | vão entre batentes ≥ 0,80 m |

**Vão livre vs. largura da folha**: a NBR 9050 mede o **vão livre** (passagem), não a folha. Em uma porta de giro, a folha, a dobradiça, o batente e a fechadura reduzem a passagem. Por isso, uma folha de **800 mm** normalmente **não** garante 800 mm livres; para garantir 0,80 m, a prática usa folha de **900 mm** (vão ~980 mm) e verifica o hardware. [INFERIDO a partir de S21 + S16; não é uma fórmula da norma]. O editor deve calcular o **clear width** com os componentes, não apenas copiar a largura nominal.

**Porta de banheiro acessível**: além do vão de 0,80 m, precisa de puxador horizontal e espaço de manobra; a NBR 9050 dá figuras para o posicionamento da cadeira e da maçaneta [S21, S90]. Para o editor, é um **preset de acessibilidade** que ajusta largura, ferragens e sentido.

### 6.4 NBR 6492 — representação

A NBR 6492:2021 não é uma norma de geometria de esquadria; é uma norma de **documentação**. O que ela exige [S22]:

- Plantas de todos os pavimentos, com **esquadrias (portas e janelas)**, cotas e identificação dos ambientes.
- **Cortes** com esquadrias, cotas e níveis.
- **Elevações** com esquadrias e **indicação de funcionamento**.
- **Detalhes** de lateral, verga, soleira e peitoril, quando necessário.
- **Designação**: portas `P1, P2, … Pn`; janelas `J1, J2, … Jn`.
- **Cota dos vãos**: indicar o **vão acabado pronto para receber a esquadria**.
- **Quadro de esquadrias**: os elementos que compõem as esquadrias devem estar especificados em quadro.
- **Plano de corte**: recomendação de **1,50 m**, podendo variar para representar o que é fundamental; exceções devem ser informadas.
- **Escalas usuais**: 1:1, 1:2, 1:5, 1:10, 1:20, 1:25, 1:50, 1:100, 1:200, 1:250, 1:500, 1:1000, 1:2000.
- **Linhas**: contínua extralarga para contornos em corte; contínua larga para arestas visíveis; contínua estreita para contornos em vista, cotas e hachuras; tracejada estreita para arestas não visíveis; traço-ponto para eixos e planos de corte.

**O que a NBR 6492 não fixa** [S22]:

- O número exato de linhas da janela em planta (3 ou 4).
- O desenho do arco de giro da porta.
- O triângulo/V de abertura em elevação.
- A orientação do vértice do triângulo.

Essas são **convenções de escritório**. A norma exige que o funcionamento seja indicado, mas não desenha o símbolo. Isso é uma lacuna importante para o editor: o símbolo precisa ser **configurável** e documentado na legenda da prancha.

### 6.5 NBR 14718 — guarda-corpos

A NBR 14718 (edição lida: 2001; há revisão de 2019) fixa [S23]:

| Requisito | Valor |
|---|---|
| Altura mínima do guarda-corpo | **1.100 mm** do piso acabado ao topo do peitoril |
| Mureta ≤ 200 mm ou > 800 mm | altura total ≥ 1.100 mm |
| Mureta entre 200 e 800 mm | guarda-corpo ≥ 900 mm |
| Vão entre perfis (gradil) | **≤ 110 mm** |
| Carga estática horizontal | **1.000 N/m** (uso privativo); **1.670 N/m** (uso comum) |
| Carga estática vertical | mesmos valores |
| Impacto | **700 J** no centro do painel |
| Ancoragem no concreto | penetração recomendada ≥ 90 mm |
| Vidro | conforme NBR 7199; não usar massa de gesso/óleo |

**Relação com janelas**: a NBR 14718 não diz “toda janela precisa de guarda-corpo”. Ela se aplica a guarda-corpos de sacadas, escadas, rampas, mezaninos e passarelas. Quando a janela tem peitoril baixo e abertura que permite queda, o projeto deve prever proteção (guarda-corpo, peitoril ou limitador), por análise de segurança e pelas normas de acessibilidade/desempenho. [INFERIDO; não é uma regra automática da NBR 14718]. Para o editor, `sillHeight` + `guardrailRequired` deve ser uma regra configurável, não um default cego.

### 6.6 NBR 11742 — porta corta-fogo

A NBR 11742 (edição lida: 1997 + Emenda 2003; há edição 2018) classifica as portas corta-fogo de saída de emergência em **P-30, P-60, P-90 e P-120**, com a variante **PF** (à prova de fumaça) [S24]. Não são admitidas classes intermediárias.

**Dimensões e folgas** [S24]:

| Parâmetro | Valor |
|---|---|
| Vão-luz — largura | mínimo **800 mm**; máximo **2.200 mm** |
| Vão-luz — altura | mínimo **2.000 mm**; máximo **2.300 mm** |
| Vão-luz ≥ 1.200 mm | duas folhas iguais; pelo menos uma com vão-luz ≥ 800 mm |
| Folga folha–batente | **4–8 mm** |
| Folga entre folhas | **4–8 mm** |
| Folga folha–soleira | **5–10 mm** |
| Transposição no rebaixo | **≥ 25 mm** |
| Dobradiças | **3 por folha** |
| Fechamento | automático; em duas folhas, seletor de fechamento |
| Barra antipânico | altura **0,90 m** |
| Maçaneta | a **1.050 mm** da borda inferior; alavanca ≥ 100 mm |

**Uso recomendado** (resumo da NBR 11742) [S24]:

- **P-30**: paredes CF-60; proteção de apartamentos residenciais.
- **PF-30**: acesso a escadas com antecâmara; corredores de fuga.
- **P-60**: paredes CF-120; acesso à antecâmara; escritórios.
- **PF-60**: escadas sem antecâmara, quando não há outra solução.
- **P-90**: paredes CF-180; recintos de medição/proteção/transformação.
- **P-120**: paredes CF-240; ligações industriais específicas.

**Desenho**: em planta, folha + arco; em elevação, barra antipânico, braço/mola, letreiro “PORTA CORTA-FOGO”; em corte, batente de aço, soleira incombustível e folgas [S24]. O letreiro deve ficar entre **1,60 e 1,80 m** do piso, no sentido de fuga [S24].

### 6.7 NBR 15575 — desempenho

A NBR 15575 é a norma de desempenho das edificações habitacionais. A edição que li é a **Emenda de 2020 da NBR 15575-1**; a versão 2021 deve ser conferida. Para janelas, os pontos mais úteis [S25, S92]:

| Tema | Critério | Observação |
|---|---|---|
| Comunicação com o exterior | peitoril **≤ 1,00 m**; testeira do vão **≤ 2,20 m** | recomendação para salas e dormitórios (NBR 15575-1, 13.2.6) |
| Ventilação | **≥ 7% da área de piso** (ZB 1–7); **12%** no Norte (ZB 8); **8%** no NE/SE (ZB 8) | percentual de abertura para ventilação (Pv,APP) |
| Iluminação natural | **≥ 60 lux** no nível mínimo; FLD **≥ 0,50%** | para sala, dormitório, copa/cozinha, área de serviço, banheiro |
| Acústico | Rw conforme NBR 15575-4 | depende do conjunto fachada/esquadria |
| Térmico | desempenho mínimo por simulação/medição | depende de vidro, sombreamento, ventilação |
| Segurança ao fogo | requisitos de compartimentação | integra NBR 11742/9077 |

**Cuidado**: o peitoril ≤ 1,00 m e a testeira ≤ 2,20 m são **recomendações** de projeto (texto “recomenda-se”), não uma obrigação dimensional absoluta. Já os percentuais de ventilação e os níveis de iluminação são **critérios de desempenho** com método de avaliação. O editor deve separar `recommendedSillHeight` de `requiredVentilationRatio` [S25, S92].

### 6.8 Vidro: NBR 7199, NBR 14698 e NBR 15737

| Norma | O que cobre | Consequência para o editor |
|---|---|---|
| **NBR 7199 (edição vigente; lida 2017)** | aplicações de vidros na construção civil | exige vidro de segurança em portas; cálculo de espessura por dimensão, apoio, vento e tipo; restrições a temperado simples em guarda-corpo/cobertura |
| **NBR 14698** | vidro temperado | caracteriza o temperado; quebra em fragmentos menores |
| **NBR 15737** | colagem de vidros com silicone estrutural | fachada pele de vidro/structural glazing |
| **NBR 16259** | fachadas cortina | desempenho de fachada |
| **NBR 14207** | box de banheiro | não detalhada nesta pesquisa; 8 mm é a prática de mercado |
| **NBR 12609 / 14125** | anodização e pintura de alumínio | acabamento dos perfis |
| **NBR 13756** | guarnição EPDM | vedação |
| **NBR 15969-1/-2** | roldanas e escovas de vedação | componentes de correr |

**Regras práticas** [S27, S91, S93]:

- Porta de vidro: **temperado 8 ou 10 mm** ou **laminado**; nunca vidro comum.
- Janela: 4 mm é comum em vãos pequenos; 6/8 mm em vãos maiores; o cálculo manda.
- Guarda-corpo: preferir **laminado/temperado laminado**; confirmar a edição vigente da NBR 7199 antes de especificar temperado simples.
- Vidro temperado **não pode ser cortado/perfurado** depois; o projeto de ferragens tem de vir antes.
- Vidro laminado mantém os fragmentos presos ao PVB; é o preferido para segurança e acústica.
- Vidro aramado tem malha metálica e é usado onde se quer resistência ao fogo.

### 6.9 Outras normas que aparecem no projeto

| Norma | Assunto | Uso no editor |
|---|---|---|
| **NBR 6123** | forças de vento | base para pressão de projeto; não confundir com pressão de ensaio da NBR 10821 |
| **NBR 9077** | saídas de emergência | largura de porta, sentido de fuga, corredores |
| **NBR 14913** | fechaduras de embutir | requisitos de fechadura |
| **NBR 7178** | dobradiças de abas | dimensões e desempenho |
| **NBR 10821-5** | instalação/manutenção de esquadrias | fixação, vedação, ajuste |
| **NBR 15930-4** | instalação/manutenção de portas de madeira | folgas, fixação, ajuste |
| **NBR 11785** | barra antipânico | portas de fuga |
| **NBR 11711** | portas corta-fogo com núcleo de madeira | portas de madeira resistentes ao fogo |
| **NBR 15873** | coordenação modular | vãos modulares; a NBR 10821-2 remete a ela |
| **NBR 16636** | elaboração de projetos | etapas e documentos |

## 7. Convenção de desenho

### 7.1 Planta baixa

**Regras gerais** [S22, S45, S46, S47]:

- O plano de corte recomendado é **1,50 m**; pode variar para mostrar o que interessa.
- **Porta**: desenhar a **folha aberta** (geralmente 90°) e o **arco de giro**; a folha é uma linha reta com o comprimento da largura; o arco tem o mesmo raio.
- **Janela**: desenhar **fechada**, com linhas paralelas no vão; não usar arco.
- **Janela alta** (peitoril acima do plano de corte): representar **tracejada**; a parede continua em linha larga.
- **Cota**: porta `P = L × H`; janela `J = L × H / P` (largura × altura / peitoril).
- **Código**: `P1…Pn`, `J1…Jn`; o código liga a planta ao quadro de esquadrias.
- **Alizar/batente**: em planta, o batente aparece como pequenos blocos nas laterais; o alizar não é desenhado em planta baixa (é acabamento de elevação/corte) [INFERIDO; S45, S46].

**Símbolos de porta em planta**:

| Tipo | Como desenhar | O que o desenho comunica |
|---|---|---|
| **Giro 1 folha** | linha da folha a 90° + arco de 90°; dobradiça no ponto onde a folha encosta na parede | lado da dobradiça e sentido de abertura |
| **Giro 2 folhas** | duas folhas + dois arcos; encontro no centro | duas folhas, sentido de cada uma |
| **Pivotante** | folha + arco com centro no pivô (fora da borda) | eixo deslocado; área de giro |
| **Correr** | dois retângulos/linhas paralelas no vão; seta no sentido do deslizamento; trilho tracejado | folha que corre e lado do trilho |
| **Correr de embutir** | folha “dentro” da parede; bolsão em linha tracejada | a folha desaparece na parede |
| **Camarão** | 2+ folhas em “V”, com arcos; guia superior tracejada | folhas articuladas que dobram para um lado |
| **Sanfonada** | linha em zigue-zague no vão; trilho | lâminas que dobram em sanfona |
| **Vai-e-vém** | dois arcos, um para cada lado da folha | abre nos dois sentidos |
| **Basculante (porta)** | folha fechada; linha diagonal do eixo; seta | eixo horizontal; movimento de basculação |
| **Enrolar** | vão + guias; rolo tracejado acima/atrás | cortina enrola no topo |
| **Seccionado** | vão + trilhos; painéis; linhas tracejadas do percurso | painéis sobem e correm para o teto |

**Símbolos de janela em planta**:

| Tipo | Como desenhar | Observação |
|---|---|---|
| **Correr** | 3–4 linhas paralelas; folhas sobrepostas; seta | a seta é opcional, mas ajuda |
| **Maxim-ar** | 3–4 linhas; linha diagonal/indicação do eixo no topo | o tipo não é legível só pelas linhas; usar código/legenda |
| **Basculante** | 3–4 linhas; linha diagonal do eixo horizontal | idem; o eixo pode ser central ou excêntrico |
| **Pivotante** | 3–4 linhas; eixo deslocado; arco se vertical | o arco só aparece se a folha for vertical |
| **Guilhotina** | 3–4 linhas; seta vertical | o corte horizontal não mostra o movimento |
| **Abrir** | folha aberta + arco (1/2) | igual à porta, mas com peitoril |
| **Fixa** | 3–4 linhas; sem seta | não confundir com vão livre |
| **Veneziana** | 3–4 linhas; hachura/palhetas | a hachura pode ser omitida em escala pequena |
| **Pele de vidro** | planta da fachada com montantes/módulos | não é uma janela isolada; é fachada |
| **Bandeira** | retângulo superior; linhas | indicar “fixa” ou “basculante” |

**Erro comum**: achar que a planta identifica o tipo de janela. Em escala 1:50/1:100, as linhas são genéricas; **o tipo tem de estar no quadro de esquadrias** (ou em uma legenda). O editor deve emitir o código e a descrição, não só a geometria [S45, S46].

### 7.2 Elevação: o triângulo/V e a linha tracejada

**O que a NBR 6492 diz**: a elevação de esquadria deve indicar o **funcionamento**, mas a norma **não define** o triângulo/V, o vértice nem a linha tracejada [S22]. Portanto, o símbolo é **convenção de prática**.

**Convenção mais difundida** (usada em blocos CAD e manuais brasileiros) [S43, S44, S80]:

- O **vértice do triângulo/V** fica no **lado da dobradiça** (ou no **eixo fixo**, no caso de pivotante/basculante/maxim-ar).
- A **base do triângulo** ou a **linha tracejada** representa a **borda livre** da folha e o **caminho de abertura**.
- O triângulo é desenhado em **linha tracejada** porque representa um movimento, não uma aresta visível.
- Em porta de **duas folhas**, desenham-se **dois triângulos**, com os vértices nas dobradiças externas e as bases no encontro central.
- Em **basculante**, o vértice fica no lado do **eixo horizontal**; as linhas tracejadas mostram a parte que entra e a que sai.
- Em **maxim-ar**, o vértice fica no **topo** (eixo) e a linha tracejada desce pela base.
- Em **correr**, não se usa triângulo; usa-se **seta** no sentido do deslizamento.
- Em **guilhotina**, usa-se **seta vertical**; em **fixa**, nenhum símbolo.

**Convenção europeia de traço** [S44, fonte francesa]: triângulo em **traço contínuo fino** = abertura para **dentro**; triângulo em **traço interrompido** = abertura para **fora**. No Brasil, a prática varia; muitas pranchas usam **sempre tracejado**. Por isso, a legenda da prancha deve dizer o que o símbolo significa. **Não** existe uma única convenção nacional confirmada [NÃO CONFIRMADO].

**Recomendação para o editor**:

- Tratar o símbolo como `elevationOpeningSymbol` com opções: `triangle-dashed`, `triangle-solid`, `V-dashed`, `V-solid`, `none`, `arrow`.
- Separar `hingeSide` (left/right/top/bottom/center) de `openingDirection` (inward/outward).
- Desenhar o vértice no lado de `hingeSide`; a base/linha tracejada no lado oposto.
- Para basculante, `hingeSide = top|bottom|center` e o símbolo acompanha o eixo.
- Para maxim-ar, `hingeSide = top`.
- Para correr, `symbol = arrow` e `slideDirection`.
- Para fixa, `symbol = none`.

**Exemplo de tabela de elevação**:

| Tipo | Símbolo | Vértice | Linha tracejada | Fonte |
|---|---|---|---|---|
| Giro 1 folha | V/triângulo | na dobradiça | borda livre/arco | [S43, S80] |
| Giro 2 folhas | dois V/triângulos | nas duas dobradiças externas | bases no centro | [S43] |
| Pivotante | V/triângulo | no pivô | arco de 180° | [INFERIDO] |
| Correr | seta | — | percurso | [S43, S81] |
| Camarão | V por folha | nas dobradiças | folhas dobradas | [S43, S78] |
| Sanfonada | V/zigzag | nas articulações | lâminas | [INFERIDO] |
| Maxim-ar | V/triângulo | no topo | base que desce | [S44, S42] |
| Basculante | V/triângulo | no eixo horizontal | partes que entram/saem | [S43, S80] |
| Guilhotina | seta vertical | — | percurso vertical | [INFERIDO] |
| Fixa | nenhum | — | — | [INFERIDO] |

### 7.3 Corte

O corte de esquadria deve mostrar [S22, S45, S46]:

- **Parede** em linha larga/contínua (elemento cortado).
- **Marco/batente** em linha média, com **rebaixo** e **batedor**.
- **Folha** em linha média, com espessura real (35/40/45/50 mm) e folgas.
- **Alizar** cobrindo a junta parede–marco, com seção 5×1,5 cm (ou a configurada).
- **Soleira** no piso, com espessura e pingadeira.
- **Peitoril** na janela, com saliência e caimento.
- **Verga** e **contraverga** como complementos do vão.
- **Vidro** em linha dupla/faixa, com espessura.
- **Ferragens** (dobradiça, fechadura, pivô, mola) quando o corte passa por elas.

**Espessuras de linha** (NBR 6492 / prática) [S22, S47]:

| Elemento | Linha | Espessura relativa |
|---|---|---|
| Alvenaria/estrutura em corte | contínua larga/extralarga | 0,50–0,70 mm (1:50) |
| Esquadria em corte | contínua média | 0,25–0,35 mm |
| Elemento em vista | contínua estreita | 0,13–0,18 mm |
| Aresta invisível | tracejada estreita | 0,13–0,18 mm |
| Eixo/plano de corte | traço-ponto | 0,25–0,50 mm |
| Cota/hachura | contínua estreita | 0,10–0,13 mm |

### 7.4 Quadro de esquadrias

A NBR 6492:2021 (A.9.3) exige um quadro com os elementos que compõem as esquadrias [S22]. Um modelo útil para o Hestia:

| Campo | Exemplo P1 | Exemplo J1 |
|---|---|---|
| Código | P1 | J1 |
| Quantidade | 8 | 4 |
| Tipo | giro 1 folha, esquerda | correr 2 folhas |
| Material | madeira, folha média | alumínio, linha 25 |
| Largura × altura (folha/vão) | 800 × 2.100 (folha) / 880 × 2.150 (vão) | 1.200 × 1.200 (vão) |
| Peitoril | 0 | 1,00 m |
| Marco/batente | 3 × 14 cm, rebaixo 1 cm | perfil 25, batente 6 cm |
| Folha | 35 mm, semi-oca sarrafeada, capa HDF | 2 folhas, vidro 4 mm |
| Alizar | 5 × 1,5 cm, uma face | guarnição 5 cm |
| Vidro | — | liso incolor 4 mm |
| Acabamento | pintura branca | anodizado natural |
| Ferragens | 3 dobradiças 3½", fechadura | roldanas, fecho, puxador |
| Sentido | HO, abre para dentro | CD, esquerda |
| Observações | — | com bandeira fixa de 40 cm |

**Regras** [S22, S15]:

- Usar **P** para portas e **J** para janelas; numerar por tipo/dimensão.
- Não repetir código para dimensões diferentes.
- Indicar **vão acabado** e, se necessário, a **folha** separadamente.
- Indicar **peitoril** para janelas; para portas, zero.
- Indicar **material, acabamento, ferragens e sentido**.
- Anexar **elevação/corte** de cada tipo, quando o quadro não bastar.

### 7.5 Escalas e níveis de detalhe

| Desenho | Escala usual | O que mostrar |
|---|---|---|
| Planta de pavimento | 1:50 / 1:100 | vão, código, dimensões, sentido |
| Elevação de esquadria | 1:50 / 1:25 / 1:20 | folhas, divisões, símbolo, ferragens |
| Corte de esquadria | 1:20 / 1:10 | marco, folha, alizar, soleira/peitoril, folgas |
| Detalhe de batente/alizar | 1:5 / 1:2 / 1:1 | seção, rebaixo, fixação, vedação |
| Detalhe de ferragem | 1:2 / 1:1 | dobradiça, fechadura, pivô, roldana |

## 8. Parametrização recomendada para o editor

A tabela abaixo é uma proposta de **modelo de dados** derivada das normas e do mercado. Os nomes são sugestões; o importante é separar **vão**, **folha**, **marco**, **acabamento** e **desempenho**.

| Campo | Tipo | Unidade | Default | Depende de | Observação |
|---|---|---|---|---|---|
| `kind` | enum | — | `door` | — | `door` / `window` |
| `subtype` | enum | — | `swing` | `kind` | `swing`, `pivot`, `sliding`, `folding`, `accordion`, `double-action`, `fixed`, `maxim-ar`, `basculante`, `guilhotina`, `pele-vidro` |
| `widthMode` | enum | — | `leaf` | — | `leaf` / `opening`; evita a confusão 80×210 |
| `leafWidth` | number | mm | 800 | `widthMode` | 600/700/800/900 (interna); 800–1.200 (entrada) |
| `leafHeight` | number | mm | 2.100 | `widthMode` | 2.100/2.400 |
| `leafThickness` | number | mm | 35 | massa | 35/40/45/50 |
| `leafMassClass` | enum | — | `medium` | — | `light`, `medium`, `heavy`, `superheavy` |
| `openingWidth` | number | mm | 880 | `leafWidth` | vão acabado; L + 60/70/80 |
| `openingHeight` | number | mm | 2.150 | `leafHeight` | H + 50 |
| `openingTolerance` | number | mm | 5 | — | ±5 |
| `frameWidth` | number | mm | 140 | wall | largura do marco (profundidade na parede) |
| `frameThickness` | number | mm | 30 | massClass | alma do marco; 30/35/45/50 |
| `frameRebateDepth` | number | mm | 10 | leafThickness | 10/10/15/20 |
| `frameRebateWidth` | number | mm | leafThickness + 2 | leafThickness | + amortecedor se houver |
| `frameType` | enum | — | `enveloping` | wall | `enveloping` / `non-enveloping` |
| `clearanceTop` | number | mm | 3 | — | NBR 15930-2 |
| `clearanceSide` | number | mm | 5 | — | total (não por lado) |
| `clearanceBottom` | number | mm | 7 | floorType | 7/17/27 |
| `floorType` | enum | — | `dry` | — | `dry`, `wet`, `mechanical-vent` |
| `hingeSide` | enum | — | `left` | subtype | `left`, `right`, `top`, `bottom`, `center` |
| `openingDirection` | enum | — | `inward` | hingeSide | `inward`, `outward`, `left`, `right` |
| `openAngle` | number | ° | 90 | subtype | 90/180 |
| `leafCount` | integer | — | 1 | subtype | 1/2/4/6 |
| `panelWidths` | array | mm | — | leafCount | para folhas desiguais |
| `trackType` | enum | — | `none` | subtype | `none`, `pocket`, `surface`, `top`, `bottom` |
| `pocketDepth` | number | mm | — | trackType | bolsão da correr embutida |
| `overlap` | number | mm | 50 | trackType | transpasse da correr sobreposta |
| `glassType` | enum | — | `float` | kind | `float`, `extra-clear`, `laminated`, `tempered`, `wired`, `canelado`, `jateado`, `reflective`, `insulated` |
| `glassThickness` | number | mm | 4 | glassType | 4/6/8/10; cálculo NBR 7199 |
| `glazingHeightRatio` | number | 0–1 | 0 | kind | 1/4, 1/2, 3/4 viram presets |
| `glazingWidthRatio` | number | 0–1 | 1 | kind | — |
| `glazingOffset` | number | mm | 0 | — | posição vertical do vidro |
| `gridRows` / `gridCols` | integer | — | 0 | glassType | grade/quadriculado |
| `sillHeight` | number | mm | 1.000 | kind | peitoril; NBR 15575 ≤1.000 |
| `sillDepth` | number | mm | 170 | wall | largura do peitoril |
| `sillThickness` | number | mm | 20/30 | exposure | 20 interno; 30 externo |
| `sillOverhang` | number | mm | 30 | exposure | saliência |
| `sillSlope` | number | % | 1–2 | exposure | caimento |
| `casingWidth` | number | mm | 50 | wall | alizar 5 cm |
| `casingThickness` | number | mm | 15 | wall | alizar 1,5 cm |
| `casingSides` | enum | — | `both` | — | `both`, `one`, `none` |
| `thresholdType` | enum | — | `stone` | kind | `stone`, `wood`, `aluminum`, `none` |
| `thresholdThickness` | number | mm | 20 | thresholdType | 20/30 |
| `lintel` / `sillBeam` | boolean | — | false | — | verga/contraverga como peça |
| `frameMaterial` | enum | — | `wood` | — | `wood`, `aluminum`, `steel`, `pvc`, `glass` |
| `finish` | string | — | — | frameMaterial | pintura, verniz, laminado, anodizado |
| `profileLine` | enum | — | `25` | frameMaterial | 20/25/30/40 |
| `performanceClass` | enum | — | `M` | — | M/I/S (NBR 10821-2 / NBR 15930-2) |
| `windRegion` | enum | — | `III` | — | I–V |
| `buildingHeight` | number | m | — | — | para tabela NBR 10821-2 |
| `fireRating` | enum | — | `none` | — | `P-30`, `P-60`, `P-90`, `P-120`, `PF-30`, etc. |
| `smokeRating` | boolean | — | false | fireRating | “F” |
| `accessible` | boolean | — | false | — | aplica NBR 9050 |
| `clearWidth` | number | mm | — | accessible | calculado, não nominal |
| `scheduleCode` | string | — | — | — | P1/J1 |
| `quantity` | integer | — | 1 | — | — |
| `symbolStyle` | enum | — | `triangle-dashed` | — | para elevação |
| `notes` | string | — | — | — | — |

**Regras de validação úteis**:

- Se `widthMode = leaf`, calcular `openingWidth` pelo padrão; se `widthMode = opening`, calcular a folha para caber.
- Se `accessible = true`, exigir `clearWidth ≥ 800` e `clearHeight ≥ 2.100`; avisar se a folha nominal for 800 (provável folha insuficiente).
- Se `fireRating != none`, exigir `frameMaterial = steel`, 3 dobradiças, fechamento automático, barra antipânico e folgas 4–8/5–10 mm.
- Se `sillHeight < 1.000` e `kind = window`, sugerir guarda-corpo/limitador; não bloquear sem análise.
- Se `performanceClass` for usado, validar `windRegion` + `buildingHeight` + dimensões contra a FAD/NBR 10821-2.
- Se `glassType = tempered`, bloquear cortes/furos depois da têmpera; exigir projeto de ferragens.
- Se `trackType = pocket`, exigir `pocketDepth` e avisar que a parede precisa de espaço.
- Se `casingSides = both`, calcular duas faces de alizar.

## 9. Lacunas e o que não foi possível confirmar

1. **NBR 10821-2 integral**: li a estrutura, os níveis e a Tabela 1 em fontes secundárias oficiais (CBIC/AFEAL) e no índice da norma; a extração integral do PDF oficial falhou (PDF binário/422). A Tabela 1 acima é confiável, mas a Tabela 2/3 completa e as notas de cada nível devem ser conferidas na edição vigente [S18, S19, S20].
2. **FADs 012 e 019**: os PDFs do PBQP-H não abriram (422/“Request Rejected”). Usei o índice oficial, que dá as tipologias e dimensões máximas; os detalhes de desempenho (tabelas de ensaio) não foram lidos [S10, S11, S13, S14].
3. **Símbolo de elevação**: não há prescrição explícita da NBR 6492 para o triângulo/V. A convenção “vértice na dobradiça” é de prática; a convenção “contínuo = dentro / tracejado = fora” é europeia e não é universal no Brasil. Precisa de decisão do dono e legenda na prancha [S22, S43, S44, S80].
4. **Frações de vidro 1/4, 1/2, 3/4**: não achei norma que as defina; são nomes comerciais. Parametrizar por proporção, não por enum fechado [INFERIDO; NÃO CONFIRMADO].
5. **“Batente de reboco”**: não achei definição normativa. A distinção “batente da parede” (largura = parede acabada) vs. “batente de reboco” (mais estreito, alizar cobre) é prática; confirmar com o fabricante/regionalismo [INFERIDO; NÃO CONFIRMADO].
6. **NBR 14718**: li a edição 2001; há revisão 2019. A altura de 1,10 m e o vão de 110 mm são estáveis, mas as cargas e os ensaios podem ter mudado. Conferir a edição vigente [S23].
7. **NBR 11742**: li 1997 + Emenda 2003; há edição 2018. As classes e dimensões são estáveis, mas requisitos de ferragens/ensaio podem ter sido atualizados. Conferir a 2018 [S24].
8. **NBR 15930-2 — tabela de vão com espuma PU**: a tabela que usei é a de fixação mecânica (L+60/70/80; H+50) e a tabela Sincol (L+80). A tabela específica de PU não foi lida integralmente; os valores podem variar ±5 mm [S16, S33].
9. **Medidas comerciais de janela**: há grande variação de orientação (A×L vs. L×A) e de linha de perfil. As tabelas são uma síntese; cada fabricante deve ser consultado para o catálogo vigente [S30, S32, S96].
10. **Portão basculante/seccionado**: as medidas 2,80×2,25 e 2,50×2,125 são **exemplos de desenho**, não padrões. Não há norma ABNT de dimensão para portão residencial; cada fabricante calcula [S50, S51].
11. **Vidro**: a espessura é calculada; não existe “tabela fixa” universal. 4/6/8/10 mm são referências de mercado, não garantia de desempenho [S91].
12. **NBR 15575**: peitoril ≤1,00 m e testeira ≤2,20 m são recomendações; não são requisitos absolutos. Os percentuais de ventilação são critérios de desempenho [S25, S92].
13. **Porta de alumínio interna**: a NBR 10821-2 não se aplica a divisórias/fechamentos internos; usar NBR 10821-6 ou especificação do fabricante. Não li a 10821-6 [S18, S20].
14. **Porta corta-fogo de madeira**: a NBR 11711 existe, mas não foi lida; os requisitos de núcleo de madeira podem diferir da NBR 11742 (aço) [S24].
15. **Medidas de batente 9/11/13/14/15 cm**: são prática de mercado; a NBR 15930-2 trabalha com mínimos por padrão, não com uma lista fechada. Não há garantia de que “14 cm” seja uma medida normativa [S16, S61].

## 10. Fontes

As URLs foram acessadas em 2026-10-26. Quando a página é um PDF oficial, indico a versão; quando é um catálogo, indico o fabricante. A coluna “tipo” usa as mesmas marcações do texto.

| ID | URL | Versão/data | Tipo | O que continha |
|---|---|---|---|---|
| S1 | https://sienge.com.br/blog/janela-basculante-o-que-e/ | atualizado 12/05/2026 | FÓRUM/LOJA | basculante vertical/horizontal, eixo central/excêntrico, diferença para maxim-ar, altura de banheiro |
| S2 | https://www.telhanorte.com.br/portas-e-janelas/janelas/janelas-maxim-ar | 2026 | FÓRUM/LOJA | catálogo de maxim-ar, medidas 50×50, 60×60, 60×80, 80×80, materiais alumínio/aço/PVC |
| S3 | https://www.aecweb.com.br/produto/janela-maxim-ar-de-aluminio/116291 | 2026 | FÓRUM/LOJA | descrição de maxim-ar, uso, composição |
| S4 | https://orcamentor.com/insumo/4987/ | SINAPI 09/2026 | ORÇAMENTO | porta de giro 900×2.100, folha média, 35–40 mm, núcleo sarrafeado, capa HDF |
| S5 | https://orcamentor.com/insumo/5020/ | SINAPI 09/2026 | ORÇAMENTO | porta 600×2.100, folha média, 35–40 mm |
| S6 | https://orcamentor.com/insumo/10555/ | SINAPI 09/2026 | ORÇAMENTO | porta 800×2.100, primer |
| S7 | https://orcamentor.com/insumo/39496/ | SINAPI 09/2026 | ORÇAMENTO | kit porta pronta 800×2.100, marco, alizares, 3 dobradiças |
| S8 | https://orcamentor.com/insumo/4992/ | SINAPI 09/2026 | ORÇAMENTO | porta de abrir 800×2.100, folha média |
| S9 | https://orcamentor.com/insumo/40662/ | SINAPI 09/2026 | ORÇAMENTO | janela basculante de madeira 60×60, batente 10/12 cm, 2 básculas, ferragens |
| S10 | https://pbqp-h.cidades.gov.br/biblioteca/fad-no-007/ | 2026 | DOC (PBQP-H) | FAD 007: correr alumínio 1,00×1,50 m, 2 folhas, uma fixa; descrição e limites |
| S11 | https://pbqp-h.cidades.gov.br/tipo-documento/esquadria/ | 2026 | DOC (PBQP-H) | índice de FADs: 007–016, 019, 056, 057; tipologias e dimensões máximas |
| S12 | https://pbqp-h.cidades.gov.br/wp-content/uploads/2021/09/Texto-Referencia-8.pdf | 2021 | DOC (PBQP-H) | texto de referência: janelas de correr e maxim-ar, produtos-alvo |
| S13 | https://pbqp-h.cidades.gov.br/wp-content/uploads/2021/09/FAD-No-07-1.pdf | mar/2023 | DOC (PBQP-H) | FAD 007: tipologia, dimensões, vidro, condições de uso |
| S14 | https://pbqp-h.cidades.gov.br/wp-content/uploads/2021/09/FAD-No-10-1.pdf | mar/2023 | DOC (PBQP-H) | FAD 010: correr 1,00×1,50, 3 folhas com veneziana |
| S15 | https://www.passeidireto.com/arquivo/195150780/nbr-15930-1 | 2011 | DOC (NBR 15930-1) | terminologia, componentes, núcleos, sentidos HO/AH/CD/CE, faces FA/FF |
| S16 | https://prefeitura.pbh.gov.br/sites/default/files/estrutura-de-governo/obras-e-infraestrutura/Capitulo_12_R4.pdf | 4ª ed., set/2019 | DOC (PBH, adapta NBR 15930-2) | tabelas de folha, vão, kit, marco, alizar, folgas, definições |
| S17 | https://www.sincol.com.br/sinkit-giro/ | 2026 | FABRICANTE | kit giro, núcleos colmeia/sarrafeado/MDP/sólido, vãos, batentes reguláveis, guarnições |
| S18 | https://pdfcoffee.com/nbr-10821-2-esquadrias-externas-requisitos-classificaao-pdf-free.html | 2017 | DOC (NBR 10821-2, cópia) | escopo, requisitos, classificação, tabelas de desempenho |
| S19 | https://cbic.org.br/wp-content/uploads/2017/11/Guia_de_Esquadrias_para_Edificacoes_2017.pdf | 2017 | DOC (CBIC) | guia de esquadrias, requisitos, Tabela 1 de pressões, níveis M/I/S |
| S20 | https://afeal.com.br/wp-content/uploads/2024/07/Guia_de_Esquadrias_para_Edificacoes.pdf | 2024 | DOC (AFEAL) | guia de esquadrias, tipologias, requisitos, ensaios |
| S21 | https://www.macae.rj.gov.br/midia/uploads/NBR%209050_2020.pdf | 2020 | DOC (NBR 9050) | acessibilidade: portas, maçanetas, puxadores, barras antipânico |
| S22 | https://arquivos.ufrrj.br/arquivos/2021103028882828758439fd707c0a63a/NBR_6492_2021.pdf | 2021 | DOC (NBR 6492) | documentação, plantas/cortes/elevações, cotas, P/J, quadro de esquadrias, linhas |
| S23 | https://www.macae.rj.gov.br/midia/uploads/NBR%2014718_Guarda-Corpos_Edificacoes.pdf | 2001 | DOC (NBR 14718) | guarda-corpos: 1.100 mm, 110 mm, cargas, impacto, ancoragem |
| S24 | https://solobrasid.com/wp-content/uploads/2021/08/NORMA-NBR-11742-Porta-Corta-Fogo-para-Saida-de-Emergencia.pdf | 1997 + Emenda 2003 | DOC (NBR 11742) | classes P-30–P-120, vão-luz, folgas, ferragens, uso |
| S25 | https://labeee.ufsc.br/sites/default/files/documents/DT_NBR-15575-1_Emenda_Out2020.pdf | 2020 | DOC (NBR 15575-1) | desempenho, iluminação, ventilação, comunicação com o exterior |
| S26 | https://psqportas.com.br/noticias/serie-dimensoes-folha-da-porta/ | 2020 | DOC/FÓRUM (PSQ) | dimensões de folha, massa, classificação leve/média/pesada |
| S27 | https://www.blindex.com.br/produtos/por-aplicacao/portas | 2026 | FABRICANTE | vidro temperado 6/8/10 mm, cores, portas de correr/basculante/pivotante |
| S28 | https://fvtacessorios.com.br/wp-content/uploads/2025/01/Catalogo-Metal-12-2021.pdf | 2021 | FABRICANTE | ferragens para vidro 8/10 mm, dimensões máximas, dobradiças, carrinhos |
| S29 | https://www.alumitec.ind.br/post/conhe%C3%A7as-as-linhas-de-alum%C3%ADnio-dispon%C3%ADveis-para-esquadrias | 2022 | FABRICANTE | linhas 25, 30/32, 40/42; profundidades, vidros, vãos |
| S30 | https://livrozilla.com/doc/530421/em-pdf. | s/d | FABRICANTE (JAP) | catálogo de janelas/portas de alumínio, medidas J2/J3/J4, acabamentos |
| S31 | https://www.madeiramadeira.com.br/janela-maxim-ar-0-40x0-40-aluminio-linha-25-816040153.html | 2026 | FÓRUM/LOJA | maxim-ar 40×40 linha 25, vidro 3 mm, abertura para cima |
| S32 | https://madeireiradoafonsinho.com.br/wp-content/uploads/2024/07/Catalogo-MGM-Maio-2024-1.pdf | 2024 | FABRICANTE (MGM) | medidas de basculante e maxim-ar 40×40 a 100×100 |
| S33 | https://www.sincol.com.br/sinkit-giro/ | 2026 | FABRICANTE | kit giro, vãos 680–980, batentes 90–290, guarnições 50/63/98, núcleos |
| S34 | https://www.sincol.com.br/sinkit-pivotante/ | 2026 | FABRICANTE | pivotante 1.000–1.200, vãos, batentes reguláveis |
| S35 | https://www.sincol.com.br/en/sinkit-correr-sobreposta/ | 2026 | FABRICANTE | correr sobreposta/embutida, vãos, bolsão, medidas |
| S36 | https://mdrepresentacao.com.br/wp-content/uploads/2022/05/CATALOGO-PORMADE-2022.pdf | 2022 | FABRICANTE (Pormade) | kit porta pronta, lisa, visor, veneziana, correr, dupla, vãos |
| S37 | https://www.sasazaki.com.br/downloads/Sasazaki_Catalogo.pdf | 2016 | FABRICANTE (Sasazaki) | catálogo de portas/janelas, códigos e medidas |
| S38 | https://portalmad.com.br/wp-content/uploads/2026/01/Catalogo-Tecnico-de-Esquadrias-de-madeira-Portalmad.pdf | 2007/2026 | FABRICANTE (Portalmad) | janela de abrir, maxim-ar, guilhotina, porta-balcão, veneziana, correr |
| S39 | https://idealmadeiras.com.br/product/porta-balcao-veneziana-quadriculada/ | 2026 | FABRICANTE | porta-balcão 210×100/120/140, 4 folhas, veneziana + vidro |
| S40 | https://www.madeiramadeira.com.br/portas-e-janelas/portas/porta-balcao | 2026 | FÓRUM/LOJA | porta-balcão 210×120/140/150/200, madeira/alumínio |
| S41 | https://www.etsi.com.br/glossario/esquadrias/tipologias-de-esquadrias | 2023 | FÓRUM/LOJA | tipologias: maxim-ar, basculante, projetante, pivotante, guilhotina |
| S42 | https://esquadriasmartins.com.br/maxim-ar-ou-basculante/ | 2026 | FABRICANTE | diferença maxim-ar vs. basculante, eixos, abertura |
| S43 | https://cadtorial.com/pt/portas-e-janelas/ | 2026 | FÓRUM/LOJA | blocos CAD de portas/janelas, arcos, triângulos, layers, medidas |
| S44 | https://cadtorial.com/pt/portas-e-janelas/janela/ | 2026 | FÓRUM/LOJA | janela de abrir/correr/fixa, triângulos tracejados, peitoril 900 mm |
| S45 | https://www.drb-assessoria.com.br/cad/7esquadrias.htm | s/d | FÓRUM/LOJA | representação de esquadrias, planta/corte/vista, cotas, escalas 1:20/1:25 |
| S46 | https://cdn.univicosa.com.br/files/sistemas/sispex/files/representacao-grafica-desenho-tecnico-arquitetura-e-urbanismo-2025187eb8d9336da.pdf | 2025 | FÓRUM/LOJA | representação gráfica, janelas altas tracejadas, quadro de esquadrias |
| S47 | https://www.ufrgs.br/destec/wp-content/uploads/2016/07/Apostila-desenho-de-edifica%C3%A7%C3%B5es-ARQ-3322-UFRGS.pdf | 2007 | FÓRUM/LOJA | desenho de edificações, espessuras de linha, cotagem de esquadrias |
| S48 | https://proedu.rnp.br/bitstream/handle/123456789/725/desenho_tecnico_12.pdf?isAllowed=y&sequence=8 | s/d | FÓRUM/LOJA | quadro de esquadrias, desenho técnico |
| S49 | https://guaruportas.com.br/porta-de-aco-de-enrolar-comercial-como-calcular-as-medidas/ | 2022 | FABRICANTE | porta de enrolar: 7 cm de largura e 5 cm de altura extras |
| S50 | https://cadtorial.com/pt/portas-e-janelas/portao-de-garagem/ | 2026 | FÓRUM/LOJA | portão seccionado 2.500×2.125 e porta de enrolar 2.800×2.250; rolo 350×350, lâminas 100 mm |
| S51 | https://newsite.naport.com.br/wp-content/uploads/2025/08/Naport_Catalogo_A4-1.pdf | 2025 | FABRICANTE (Naport) | portas de enrolar e seccionadas, automação, medidas |
| S52 | https://pt.wikipedia.org/wiki/Esquadria | 2019 | FÓRUM/LOJA | definição de esquadria, tipos, materiais |
| S53 | https://www.alumecaluminio.com.br/tipos-portas-janelas.htm | s/d | FABRICANTE | tipos de janelas de alumínio, maxim-ar, pivotante, guilhotina |
| S54 | https://www.westwing.com.br/guiar/janela-basculante/ | s/d | FÓRUM/LOJA | basculante: parte para fora/parte para dentro, pivô excêntrico |
| S55 | https://www.chatuba.com.br/portas-e-janelas/portas/porta-sanfonada | 2026 | FÓRUM/LOJA | sanfonada PVC 60–90×210, cores, umidade, vedação |
| S56 | https://www.telhanorte.com.br/portas-e-janelas/portas/porta-sanfonada | 2026 | FÓRUM/LOJA | sanfonada PVC 60/70/80/90, segurança, medidas |
| S57 | https://ptdocz.com/doc/456620/tc025-esquadrias---parte-1---dcc---universidade-federal-do-paran | s/d | FÓRUM/LOJA (UFPR) | tipologias, PVC, alumínio, madeira, vidro, classificação |
| S58 | https://www.safetyglass.com.br/pele-de-vidro | 2026 | FABRICANTE | pele de vidro, fachada cortina, structural glazing, stick/unitizado |
| S59 | https://abraei.com.br/noticias/pele-de-vidro-e-sistema-que-assegura-estanqueidade-e-estetica/ | 2023 | FÓRUM/LOJA | pele de vidro, silicone estrutural, NBR 10821/15737 |
| S60 | https://arquitetura.vivadecora.com.br/tipos-de-portas/ | 2019 | FÓRUM/LOJA | tipos de portas, medidas 60/70/80/90, PVC, camarão, sanfonada |
| S61 | https://blog.obramax.com.br/acabamento-decoracao/batente-de-porta/ | 2024 | FÓRUM/LOJA | larguras de batente 7,5/9,5/12/13/14 cm, drywall/alvenaria |
| S62 | https://www.rivocalc.com/pt-br/construcao/batente-alizar | 2026 | FÓRUM/LOJA | batente fixo/regulável, 70–200 mm, alizar, espessuras de parede |
| S63 | https://www.orcamentor.com/composicao/100659/ | SINAPI 09/2026 | ORÇAMENTO | alizar 5×1,5 cm, madeira maciça, instalação |
| S64 | https://orcamentador.com.br/composicoes/sinapi/98689 | SINAPI 2026 | ORÇAMENTO | soleira granito 15 cm × 2,0 cm |
| S65 | https://marmorariacerto.com.br/servicos/soleiras-e-peitoris-em-brasilia/ | 2026 | FÓRUM/LOJA | soleira 2 cm, peitoril 3 cm, pingadeira 1,5 cm, projeção 2–3 cm |
| S66 | https://www.fnde.gov.br/phocadownload/programas/plano_de_acoes_articuladas/projetos_arquitetonicos/2salas/2salas_memorial_descritivo_do_projeto.pdf | s/d | DOC (FNDE) | soleira 15×2 cm; peitoril 17×2 cm; pingadeira |
| S67 | https://psqportas.com.br/noticias/serie-dimensoes-folha-da-porta/ | 2020 | DOC/FÓRUM (PSQ) | mesma base de S26; dimensões de folha |
| S68 | https://concremportas.com.br/wp-content/uploads/2025/03/guia-de-portas.pdf | 2025 | DOC/FABRICANTE (ABIMCI/PSQ) | guia de portas: tabelas 8/9, massas, alizares, desempenho |
| S69 | https://www.target.com.br/produtos/normas-tecnicas/42435/nbr15930-2-portas-de-madeira-para-edificacoes-parte-2-requisitos | 2018 | DOC (resumo comercial) | sumário e data da NBR 15930-2 |
| S70 | https://www.normas.com.br/visualizar/abnt-nbr-nm/30418/abnt-nbr10821-2-esquadrias-para-edificacoes-parte-2-esquadrias-externas-requisitos-e-classificacao | 2017 | DOC (resumo comercial) | título, escopo, palavras-chave da NBR 10821-2 |
| S71 | https://files.comunidades.net/doutorvidros/NBR_10821-2__-_2017_-_Esquadrias_para_edificacoes_-_Parte_2_Esquadrias_externas_-_Requisitos_e_classificacao.pdf | 2017 | DOC (PDF) | cópia da NBR 10821-2; extração de texto falhou |
| S72 | https://www.passeidireto.com/arquivo/123009052/abnt-nbr-11742-2018-pcf-p-saida-de-emergencia | 2018 | DOC (NBR 11742:2018) | definições, classes, requisitos gerais |
| S73 | https://levantebh.com.br/wp-content/uploads/2026/08/ABNT_2019a-NBR-14.718.2019.pdf | 2019 | DOC (NBR 14718:2019) | guarda-corpos: requisitos e cargas |
| S74 | https://www.canoas.rs.gov.br/wp-content/uploads/2020/07/norma-abnt-NBR-9050-2015-emenda-1-2020.pdf | 2020 | DOC (NBR 9050 Emenda 1) | alterações de portas, vão livre, maçanetas, puxadores |
| S75 | https://labeee.ufsc.br/sites/default/files/documents/P_ABNTNBR15575_4_2020CNGPR_PosCN_SiteLabEEE.pdf | 2020 | DOC (NBR 15575-4) | ventilação, percentual de abertura, desempenho |
| S76 | https://www.passeidireto.com/arquivo/195150784/nbr-15930-2 | 2018 | DOC (NBR 15930-2) | sumário, tabelas, requisitos |
| S77 | https://acervodigital.ufpr.br/xmlui/bitstream/handle/1884/71934/2021_Resumo_NBRs_Des_Tec_Arq.pdf?sequence=1 | 2021 | DOC/FÓRUM (UFPR) | resumo das NBRs de desenho, cotas de vãos, P/J |
| S78 | https://cadtorial.com/pt/portas-e-janelas/porta-camarao/ | 2026 | FÓRUM/LOJA | porta camarão em planta/elevação, 60°, triângulos, 4 folhas |
| S79 | https://cadtorial.com/pt/portas-e-janelas/porta/ | 2026 | FÓRUM/LOJA | porta de abrir 800/900/1.600, arco 90°, triângulo tracejado |
| S80 | https://plancio.com/pt/plantas-baixas/simbolos-de-planta-baixa/ | 2026 | FÓRUM/LOJA | símbolos de planta, arco tracejado, janela sem arco, linhas |
| S81 | https://interiorai.com.br/blog/planta-baixa-de-casas-simbolos-tecnicos-que-voce-precisa-saber | 2026 | FÓRUM/LOJA | porta de abrir, correr, janela 3 linhas, basculante com linha diagonal |
| S82 | https://concremportas.com.br/wp-content/uploads/2025/03/guia-de-portas.pdf | 2025 | FABRICANTE/ABIMCI | mesma base de S68; alizares e desempenho |
| S83 | https://portalmad.com.br/portas/ | 2022 | FABRICANTE | lista de tipos de portas de madeira, porta-balcão, veneziana, vidro, maciça |
| S84 | http://www.demilito.com.br/7-esquadrias-rev.pdf | s/d | FÓRUM/LOJA (manual) | portas de madeira, folha, batente, guarnição, veneziana, caixilhos |
| S85 | https://parede.net/revestimentos/lambri/ | 2026 | FÓRUM/LOJA | lambri macho-fêmea, tábuas, instalação |
| S86 | https://larpontual.com.br/portal/como-instalar-porta-de-correr | 2026 | FÓRUM/LOJA | correr sobreposta, transpasse 5 cm, folga 5–8 mm, 10–12 mm da parede |
| S87 | https://construcaoeacabamento.com.br/banheiro/porta-sanfonada-para-banheiro-quando-usar-na-reforma/ | 2026 | FÓRUM/LOJA | sanfonada 60–90×210, vedação, PVC, uso |
| S88 | https://pdfcoffee.com/nbr-10821-2-esquadrias-externas-requisitos-classificaao-pdf-free.html | 2017 | DOC (cópia) | NBR 10821-2, tabelas e níveis (texto extraído) |
| S89 | https://www.macae.rj.gov.br/midia/uploads/NBR%209050_2020.pdf | 2020 | DOC (NBR 9050) | texto completo de portas, maçanetas, puxadores |
| S90 | https://www.canoas.rs.gov.br/wp-content/uploads/2020/07/norma-abnt-NBR-9050-2015-emenda-1-2020.pdf | 2020 | DOC (Emenda 1) | vão livre 0,80×2,10, tolerância −20 mm, portas de correr/sanfonada |
| S91 | https://files.comunidades.net/doutorvidros/NBR_7199_.pdf | 2017 | DOC (NBR 7199) | vidro temperado, recortes, distâncias, cálculo de espessura |
| S92 | https://labeee.ufsc.br/sites/default/files/documents/DT_NBR-15575-1_Emenda_Out2020.pdf | 2020 | DOC (NBR 15575-1) | peitoril ≤1,00 m, testeira ≤2,20 m, iluminação, ventilação |
| S93 | https://www.spaceglass.com.br/_files/ugd/990962_bc2e2cd2043d4ca6a9e2186b13897a50.pdf | 2023 | FABRICANTE | float, laminado, impresso, cores, espessuras |
| S94 | https://cristalcor.com.br/vidros/ | 2026 | FABRICANTE | float, laminado, extra clear, aramado, canelado, jateado |
| S95 | https://www.orcamentor.com/composicao/90801/ | SINAPI 07/2026 | ORÇAMENTO | batente 3×14 cm, madeira maciça, montagem |
| S96 | https://orcamentor.com/insumos/janelas-em-aluminio/ | SINAPI 09/2026 | ORÇAMENTO | família de janelas de alumínio: correr 100×120/150/200, 120×150, 150×120; maxim-ar 60×80; basculante 80×60; fixa 60×80; veneziana |
| S97 | https://www.novvasolutions.com.br/blog/portas-de-vidro-de-correr/ | 2026 | FABRICANTE | porta de vidro de correr: 1 folha 72–92, 2 folhas 120–140, 4 folhas 160–200; temperado 10 mm |

### Notas de leitura das fontes

- **S16** é a fonte mais completa para a NBR 15930-2: o Caderno de Encargos da PBH reproduz as tabelas 3 a 8 da norma, com adaptações. Usei essa fonte porque o PDF da ABNT não é público.
- **S18/S88** são cópias não oficiais da NBR 10821-2; usei apenas para estrutura e conceitos, e conferi os números com **S19/S20** (CBIC/AFEAL), que são documentos setoriais públicos.
- **S23/S24** são edições antigas (2001/1997) lidas integralmente; as edições 2019/2018 existem e podem ter alterado detalhes. As classes e dimensões principais são estáveis, mas confira antes de certificar.
- **S26/S68** são materiais do PSQ-PME/ABIMCI, que reproduzem tabelas da NBR 15930-2. São a melhor fonte pública para massa, dimensões e alizares.
- **S30/S32** são catálogos de fabricantes; as medidas são comerciais e variam por linha. Não são norma.
- **S43/S44/S78/S79** são blocos CAD comerciais; usei como evidência de convenção de desenho, não como norma. O texto do Cadtorial explicitamente chama a convenção do triângulo de “europeia”.

## 11. Conclusão operacional

Para o editor, os cinco parâmetros que mais impactam o resultado são:

1. **`widthMode`**: folha ou vão. Sem isso, toda a base de medidas fica ambígua.
2. **`leafMassClass` / `leafThickness`**: define vão, kit, dobradiças e massa.
3. **`frameWidth` / `frameThickness` / `rebateDepth`**: define o encaixe na parede e a folha.
4. **`sillHeight` / `floorType`**: define peitoril, guarda-corpo, folga inferior e desenho em planta.
5. **`subtype` + `hingeSide` + `openingDirection`**: define o símbolo, o arco, o sentido e a ferragem.

Se o editor acertar esses cinco, o resto (alizar, soleira, vidro, acabamento) é acabamento e catálogo. Se errar o primeiro, o modelo inteiro fica deslocado — e o quadro de esquadrias também.