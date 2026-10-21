# A · Pesquisa: representação de portas e janelas (planta, corte, elevação, 3D)

Data da pesquisa: 2026-10-21. Escopo: convenções de Revit e ArchiCAD, normas ABNT e referências de desenho, sem alteração de código. Par: `B-estado-atual.md` (o que o Hestia faz hoje, com caminhos e linhas). Commit do código analisado: `1be4648` (HEAD).

## 0. Limite de acesso e como ler este documento

**As fontes oficiais não puderam ser lidas diretamente.** Tentei em 2026-10-21:

- `help.autodesk.com`, `help.graphisoft.com`, `www.abntcatalogo.com.br`: o proxy de saída respondeu **403** (`CONNECT tunnel failed`), que é bloqueio de política. O README do proxy (`/root/.ccr/README.md`) manda não repetir nem contornar 403. Não tentei outra rota.
- O `WebFetch` não resolve esses domínios nem `arquivos.ufrrj.br` nem `planner5d.com` (`ENOTFOUND`).

Por isso, o conteúdo "oficial" abaixo vem de **trechos de resultados de busca** (títulos e textos exibidos pela busca), não de leitura integral. Quando a afirmação depende disso, a marcação diz.

**Marcações usadas:**

- **[DOC]**: fonte oficial (Autodesk, Graphisoft, ABNT, prefeitura), conhecida só por trecho de busca. Quando possível, a URL vem junto.
- **[FÓRUM]**: fórum, comunidade, blog, tutorial ou material de terceiros. Não é fonte oficial.
- **[ORÇAMENTO]**: composição ou catálogo de custo (SINAPI e similares). Dá valor praticado, não norma.
- **[ESTUDO]**: material de disciplina ou concurso. Serve de pista, não de norma.
- **[INFERIDO]**: dedução minha, a partir de fontes parciais ou da prática. Precisa de confirmação.
- **[NÃO ENCONTRADO]**: não achei fonte. Não preenchi com número.

## 1. Resumo

- **Não achei a simbologia de esquadrias da NBR 6492:2021.** O título oficial da 2ª edição (16/06/2021) é "Documentação técnica para projetos arquitetônicos e urbanísticos — Requisitos" [DOC, busca]. O texto da norma não foi lido. As convenções abaixo são de prática e de software, não de norma. Isso pesa na escolha: a referência que o projeto deve seguir precisa ser decidida pelo dono.
- **Giro (porta de 1 folha):** folha como segmento de comprimento igual à largura livre, origem na dobradiça, e arco de 90° com raio igual à largura. É o que o Hestia já faz (verificado em `B` §7). Revit separa o símbolo de giro em subcategorias "Plan Swing" e "Elevation Swing" [FÓRUM/TUTORIAL]. ArchiCAD tem opções de sentido de abertura ("Double-Acting" e "Side Hung") [DOC, busca].
- **Pivotante:** o arco atual do Hestia está errado (raio e fim do arco não chegam à ombreira). Não achei a convenção de pivô em norma nem em software; ver §6.
- **Janela de correr:** duas folhas em linhas paralelas defasadas, cada uma ocupando cerca de metade do vão [FONTE ESTRANGEIRA, busca: "dos líneas paralelas… ocupan metade del vano"]. Não achei a convenção brasileira exata.
- **Corte e elevação:** o padrão de software separa batente, caixilho, peitoril, soleira e vidro. ArchiCAD tem abas próprias para isso ("Frame Widths", "Sill", "Board", "Reveal", "Wall Closure", "Wall Inset") [DOC, busca AC17]. O Hestia não desenha nenhuma dessas peças.
- **Valores com fonte razoável:** folha de madeira de 35 a 40 mm [ORÇAMENTO]; batente maciço de 3 cm por 14 cm para porta de giro de 60 a 120 cm [ORÇAMENTO, SINAPI]; alizar de 5 cm por 1,5 cm [ORÇAMENTO, SINAPI]; vão livre de porta acessível de 0,80 m por 2,10 m [RESUMO de NBR 9050, a verificar].
- **Valores sem fonte (não preenchidos):** espessura de caixilho de 5 a 6 cm (pedido), altura de verga de 0,20 m (pedido), profundidade do batente na parede, altura mínima de peitoril (NBR 15575), espessura de caixilho de alumínio. Ver §3 e §6.
- **Divergência:** o transpasse de verga e contraverga aparece com 20 cm e com 30 a 40 cm em fontes diferentes. Nenhuma das duas é altura de verga.

## 2. Tabelas

### 2.1 Tipo × vista: convenção recomendada

A coluna "Convenção recomendada" é proposta. Quando a célula não tem fonte, a marcação diz. O dono decide a convenção final.

| Tipo | Planta | Corte | Elevação | 3D |
|---|---|---|---|---|
| **Porta de giro (1 folha)** | Folha: segmento de comprimento = largura livre, a partir da dobradiça, traço pesado. Arco de 90°, raio = largura, traço fino [INFERIDO; Revit "Plan Swing" e Hestia já fazem]. Parede interrompida nas faces do batente. | Vão com parede interrompida; batente como perfil (3 cm × 14 cm [ORÇAMENTO]); folha só se o corte a atravessa, com espessura de 3,5 a 4 cm [ORÇAMENTO] | Folha como retângulo. Símbolo de abertura: linha tracejada ou triângulo com vértice no lado da dobradiça [INFERIDO; pedido do dono; Revit usa "Elevation Swing" como linhas simbólicas, FÓRUM]. Maçaneta na face oposta à dobradiça [INFERIDO]; altura de 0,80 a 1,10 m [NBR 9050, resumo]. | Batente (ombreiras e verga), alizar (5 × 1,5 cm [ORÇAMENTO]), folha de 3,5 a 4 cm, vão 0,80 × 2,10 m. Folha fechada ou aberta conforme o modo de vista (ver §5) |
| **Porta dupla** | Duas folhas de comprimento = metade do vão, dobradiças nas extremidades, arcos de 90° de raio = metade do vão, encontro no centro [INFERIDO; ESTUDO IFSC: "arcos duplos" para folhas duplas] | Igual à de giro, com duas folhas no vão | Duas folhas com a divisão no centro | Dois painéis de largura (W − 2·batente)/2 com travessa central. Hoje o Hestia tem um painel só |
| **Porta de correr** | Duas folhas em faces opostas da parede, com sobreposição, e seta de direção [INFERIDO; mesma convenção da janela de correr] | Folha no trilho; altura e posição do trilho [NÃO ENCONTRADO] | Duas folhas com seta de correr [INFERIDO] | Dois painéis no trilho [NÃO ENCONTRADO: espessura de trilho] |
| **Porta camarão / sanfonada** | [NÃO ENCONTRADO] | [NÃO ENCONTRADO] | [NÃO ENCONTRADO] | [NÃO ENCONTRADO] |
| **Porta pivotante** | Eixo vertical, folha de comprimento = metade do vão a partir do eixo, arco de 90° até a ombreira [CRITÉRIO PROVISÓRIO: posição do eixo não encontrada] | Igual à de giro; eixo em altura | Folha com eixo horizontal ou vertical conforme o caso [NÃO ENCONTRADO] | Folha girando em torno do eixo [NÃO ENCONTRADO] |
| **Vão livre (sem folha)** | Parede interrompida; linha da soleira (tracejada, como o Hestia) [INFERIDO] | Vão aberto, soleira no piso | Vão aberto, sem folha | Sem peça de porta; o vão aparece no corte da parede |
| **Janela de correr (2 folhas)** | Duas linhas de face da parede e duas folhas defasadas em faces opostas, cada uma com cerca de metade do vão [FONTE ESTRANGEIRA, busca] e seta [INFERIDO] | Caixilho (ombreiras, verga, soleira), vidro como linha dupla, peitoril [INFERIDO] | Duas folhas com divisão e seta de correr [INFERIDO] | Caixilho com perfis, duas folhas (vidro em cada uma), peitoril saliente [INFERIDO] |
| **Janela de abrir (giro)** | Linha da folha com arco tracejado de abertura [pedido do dono; Hestia usa arco tracejado no maxim-ar] | Caixilho e vidro, peitoril | Folha com divisões e símbolo de abertura tracejado [pedido do dono] | Caixilho com folha de vidro |
| **Maxim-ar** | Linha horizontal de abertura e arco tracejado para o lado da abertura [INFERIDO; prancha pública de SP mostra "ABERTURA BASCULANTE (limitador de 25 cm)", busca] | Caixilho e vidro | Símbolo de abertura tracejado, com indicação do sentido [INFERIDO] | Caixilho com folha de vidro. Limitador de abertura [NÃO ENCONTRADO] |
| **Basculante** | Linha tracejada ou V no plano médio [INFERIDO; Hestia usa V] | Caixilho e vidro | Símbolo de abertura tracejado [INFERIDO] | Caixilho com folha de vidro |
| **Fixa** | Duas linhas de face e a linha do vidro no meio [INFERIDO; "3 linhas" do pedido] | Caixilho e vidro, sem folha | Divisões do caixilho e reflexo diagonal no vidro [INFERIDO] | Caixilho e vidro, sem folha |

### 2.2 Corte e elevação: detalhes de esquadria

| Peça | Convenção de software | Convenção recomendada | Status |
|---|---|---|---|
| Batente / caixilho (cabeçalho, travessa, montante) | ArchiCAD: aba "Frame Widths" (AC17) [DOC, busca]. Revit: parâmetros "Frame Width" e "Frame Depth" [FÓRUM/TUTORIAL, Novedge] | Retângulo do perfil, em cor de corte, com as larguras do tipo | Software confirmado; números [NÃO ENCONTRADO] para caixilho |
| Vidro | Linha dupla ou faixa de vidro. Revit: espessura do vidro como parâmetro ("Glass Thickness") [FÓRUM/TUTORIAL, Novedge] | Faixa de vidro com a espessura do tipo, na cor do vidro | [INFERIDO] |
| Peitoril (soleira da janela) | ArchiCAD: abas "Sill" e "Board" (AC17) [DOC, busca]. Revit: "Default Sill Height" (parâmetro integrado) [TUTORIAL, Imaginit] | Peça de peitoril com a altura e a saliência do tipo | Abas e parâmetro confirmados; pingadeira [NÃO ENCONTRADO] |
| Verga / contraverga | Verga é a peça acima do vão, contraverga a de baixo, em concreto armado [FÓRUM/tutorial, Sienge e Olhar Digital] | Peça de concreto com a hachura de concreto do projeto (no Hestia, `cross`, `defaults.ts:26`) | Função confirmada; altura [NÃO ENCONTRADO]; transpasse: 20 cm (memorial público) ou 30 a 40 cm (trabalho acadêmico), **divergente** |
| Folha de porta em corte | [NÃO ENCONTRADO] | Retângulo da folha, com espessura do tipo | [NÃO ENCONTRADO] |
| Soleira de porta | [NÃO ENCONTRADO] | Peça no piso, com altura do tipo (se houver) | [NÃO ENCONTRADO] |
| Retorno do acabamento no vão | Revit: "Wall Closure" é parâmetro da família; posição vem de planos de referência "Wall Closure" [DOC, busca "About Layer Wrapping", versões 2016 a 2023] | Já implementado no Hestia (`closure`, decisão 0005) | Confere com a doc Autodesk (busca) |

### 2.3 Valores numéricos

| Grandeza | Valor usual | Fonte | Status |
|---|---|---|---|
| Largura de porta (folha) | 60, 70, 80, 90 cm (de 10 em 10 cm) | Página de busca sobre portas de madeira [FÓRUM] | Prática, não norma |
| Largura de porta acessível (vão livre mínimo) | 0,80 m | NBR 9050 [RESUMO: lawinsider, questão de concurso; itens 6.11.2.2 e 6.11.2.3 citados] | [SECUNDÁRIO]. Verificar NBR 9050:2020, 6.11 |
| Altura de porta (vão livre mínimo) | 2,10 m | Mesmo resumo de NBR 9050 e catálogos [ORÇAMENTO] | [SECUNDÁRIO] |
| Espessura de folha de madeira | 35 a 40 mm; semi-oca de 3,5 cm | Catálogo citando NBR 15930 [ORÇAMENTO]; SINAPI | Prática, citação de norma não verificada |
| Batente (marco) | 3 cm × 14 cm (E × L) para porta de giro de 60 a 120 cm × 210 cm | Composição SINAPI [ORÇAMENTO] | Interpretação: E = espessura da peça, L = largura, que cobre a parede. [INFERIDO] |
| Batente, outro catálogo | 70 × 210 × 12 cm (marco) | Fabricante [ORÇAMENTO] | **Divergente** do SINAPI |
| Altura de marco | 2,15 m (para porta de 2,10 m) | Blog de orçamento [FÓRUM] | Conflito com a porta de 2,10 m, a conferir |
| Rebaixo do batente para a folha | 3,5 cm | Fabricante de batentes, citado em busca [FÓRUM] | Coerente com folha de 3,5 cm |
| Alizar | 5 cm × 1,5 cm | Composição SINAPI [ORÇAMENTO] | Prática |
| Folga porta–piso | 7 mm | [FÓRUM], sem fonte identificada | [FRACO] |
| Espessura de caixilho (janela) | 5 a 6 cm | **Pedido do dono** | [NÃO ENCONTRADO] |
| Profundidade do batente na parede | — | — | [NÃO ENCONTRADO] como valor. Revit tem "Frame Depth" como parâmetro, sem valor padrão achado [FÓRUM/TUTORIAL] |
| Altura de verga | 0,20 m (pedido) | — | [NÃO ENCONTRADO]. A fonte que achei fala em transpasse de 20 cm, não em altura |
| Transpasse de verga e contraverga | 20 cm por lado (memorial público) ou 30 a 40 cm (trabalho acadêmico) | Olhar Digital (memorial de prefeitura); FAG [FÓRUM] | **Divergente**; conferir o projeto estrutural |
| Seção de verga pré-moldada | 10 × 10 cm, fck 20 MPa | Orçamento de obra pública [ORÇAMENTO] | É seção transversal, não altura |
| Altura de peitoril (janela) | — | NBR 15575 [NÃO ENCONTRADO]. O valor de 1,10 m achado é de **guarda-corpo** (NBR 14718), não de peitoril | [NÃO ENCONTRADO] |
| Limitador de abertura de maxim-ar | 25 cm | Prancha de licitação de SP (busca; provável origem `ses.saude.sp.gov.br`, "janelas e divisórias") | Único número de prancha achado; não generalizar |
| Largura mínima de porta de saída | 0,80 m (citado por resumos) | NBR 9077 [NÃO ENCONTRADO no texto]. NPT 011 do PR fixa 0,55 m para unidade de passagem e 1,20 m para acessos, mas é norma estadual | [NÃO ENCONTRADO] para NBR 9077 |
| Espessura de parede | 14 cm (padrão do Hestia) | `packages/model/src/defaults.ts:65` | Projeto, não norma |
| Peitoril padrão no Hestia | 1,10 m (janela de correr) e 1,50 m (maxim-ar) | `packages/model/src/defaults.ts:113-115` | Escolha do projeto, sem fonte de norma |

**Não pesquisei** espessura de vidro, perfil de alumínio por linha de fabricante e cotas de cálculo de verga. Ficam em [NÃO ENCONTRADO] por ausência de pesquisa.

## 3. Normas e referências

| Norma / referência | O que é | O que achei | Status |
|---|---|---|---|
| **ABNT NBR 6492:2021** | Documentação técnica para projetos arquitetônicos e urbanísticos (Requisitos), 2ª edição, 16/06/2021, 40 p. | Título e data [DOC, busca em grancursos, IFPB e cópia UFRRJ]. A cópia de `arquivos.ufrrj.br` não pôde ser lida (sem DNS). Símbolos de esquadria: [NÃO ENCONTRADO] | Texto não lido |
| NBR 6492 (versão de 1994) | Mesma matéria, versão antiga | Escopo: "fixa as condições exigíveis para representação gráfica de projetos de arquitetura" [DOC, busca; cópia de edisciplinas.usp.br, id 2957252 ou 2297951, não identifiquei qual] | Versão antiga; não usar como fonte da versão atual |
| NBR 6492, anexo de linhas | Decisão 0015 do Hestia cita "NBR 6492 A.1" para pesos de linha | Não consegui confirmar a referência | [NÃO ENCONTRADO]. Ver `docs/decisoes/0015-graficos-de-vista.md:21` |
| **ABNT NBR 10067** | Princípios gerais de representação em desenho técnico | Escopo não lido. Datas divergentes (1987 e 1995) em material de ensino [ESTUDO] | [NÃO CONFIRMADO] |
| **ABNT NBR 10126** | Cotagem em desenho técnico (princípios gerais de cotagem) | Define cota funcional, não funcional e auxiliar [ESTUDO, citação] | Escopo confirmado por resumo; versão não confirmada |
| **ABNT NBR 9050** | Acessibilidade a edificações | Vão livre de porta 0,80 m; altura 2,10 m; maçaneta entre 0,80 e 1,10 m; puxador com diâmetro de 25 a 45 mm; círculo de 1,50 m entre portas em sequência [RESUMO: lawinsider, artigo jurídico] | [SECUNDÁRIO]. Conferir itens 6.11 e 7.5 da NBR 9050:2020 |
| **ABNT NBR 15575** | Desempenho de edificações habitacionais | Altura de peitoril de janela: [NÃO ENCONTRADO]. Só achei questão de concurso sem gabarito | [NÃO ENCONTRADO] |
| NBR 14718 | Guarda-corpos | Altura mínima de 1,10 m [SIENGE, resumo]. Revisão da norma citada pela CBIC | Não se aplica a peitoril de janela |
| **ABNT NBR 9077** | Saídas de emergência em edificações | Texto não lido. Resumos não confirmaram 0,80 m para porta de saída | [NÃO ENCONTRADO] |
| NPT 011 (Corpo de Bombeiros do PR) | Saídas de emergência, norma estadual | Unidade de passagem 0,55 m; acesso, escada, rampa e descarga 1,20 m [DOC estadual, busca] | Norma estadual, não NBR |
| NBR 15930 | Portas de madeira (citada em catálogo) | Só como citação em orçamento | [NÃO ENCONTRADO] no texto |
| Código de obras / prefeitura de SP | Alturas de peitoril e iluminação | Prancha de licitação com "abertura basculante" [DOC, busca] | Parcial |
| **Revit** (Plan Representation, Swing, Show Elevation Swing, Opening Cut, Wall Closure, níveis de detalhe) | Software | "About Layer Wrapping" e "Video: Wall Layer Wrapping at Doors and Windows" [DOC, busca: help.autodesk.com/cloudhelp/2016, 2017, 2020, 2021, 2023]: Wall Closure é parâmetro da família, posição por planos "Wall Closure". Subcategorias "Plan Swing [Cut/Projection]" e "Elevation Swing [Projection]" [FÓRUM/TUTORIAL: augi, bimpure, cad-notes]. "Opening Cut" é retângulo sobre a face da parede [FÓRUM]. "Default Sill Height" é parâmetro integrado [TUTORIAL, Imaginit]. "Frame Width", "Frame Depth" e "Glass Thickness" são parâmetros mínimos [TUTORIAL, Novedge] | Nomes confirmados por trecho; comportamento a conferir na versão do Revit |
| **ArchiCAD** (Door/Window Settings, Opening Symbol, Show Swing, Detail Level, sill, lintel, Wall Inset) | Software | "Door/Window Settings and Opening" (AC19 a AC21): Detail Level 2D com opções "seguir Model View Options", "Scale Sensitive" e escala fixa [DOC, busca]. Abas do caixilho (AC17): "Frame Widths", "Opening", "Opening Lines", "Reveal Settings", "Wall Closure", "Inside Casing", "Sill", "Board", "Wall Inset", "Sunshade", "Masonry Arch" [DOC, busca]. "Wall Inset" (AC24 e AC25): recesso sob a janela, com tamanho automático, simétrico ou assimétrico [DOC, busca]. Opening Type: "Double-Acting" ou "Side Hung" (AC17 e AC18) [DOC, busca]. "Visualização em Planta da Porta/Janela: Simbólica vs. Vista e Corte" (AC27 e AC29) [DOC, busca, título] | Abas e opções confirmadas por trecho. **Não achei os rótulos "Opening Symbol" e "Show Swing" como nomes de campo** |
| Fóruns ArchiCAD | Comportamento de arco | "Projected display" não desenha arco simbólico; arco de giro em planta depende de script no 3D [FÓRUM, community.graphisoft.com] | [FÓRUM] |
| Material de ensino (IFSC, planos de disciplina IFPB, UNIPAMPA) | Prática brasileira | Porta com arco simples é porta de abrir; arcos duplos, folhas duplas; porta desenhada com folha e linhas auxiliares para movimento e espaço [ESTUDO, IFSC, planner5d, busca] | [ESTUDO] |

## 4. Adaptação à estrutura de dados (`OpeningType`)

Estado atual (`packages/model/src/types.ts:174-190`): `id`, `kind`, `name`, `width`, `height`, `sill`, `leaves` (0, 1, 2), `plan`, `frameMaterialId`, `glassMaterialId`, `closure`. Instância (`types.ts:192-206`): `id`, `kind`, `typeId`, `hostId`, `offset`, `flipHand`, `flipFacing`, `sillOverride`, `mark`.

**Campos que faltam**, na ordem de prioridade:

| Campo proposto | Tipo e unidade | Padrão sugerido | Justificativa |
|---|---|---|---|
| `frame.width` | m, largura do perfil visto de frente | 0,05 (porta) e a definir (janela, pedido: 0,05 a 0,06) | Hoje é constante em `scene3d.ts:265`. Pedido do dono: caixilho de 5 a 6 cm |
| `frame.depth` | m, profundidade do batente na parede | `espessura da parede` (cobre a parede) | Hoje é `min(espessura, 0,09)` (`scene3d.ts:266`). Revit usa "Frame Depth" [FÓRUM/TUTORIAL] |
| `frame.alignment` | `centro \| face interna \| face externa` | `centro` | Hoje é sempre centro (`scene3d.ts:255-257`). Revit e ArchiCAD têm posição de referência (Wall Inset e Wall Closure) |
| `leaf.thickness` | m | 0,035 a 0,040 (porta de madeira) [ORÇAMENTO] | Hoje é 0,04 fixo (`scene3d.ts:275`) |
| `leaf.material` | id | igual ao batente | A folha hoje usa o material do batente (`scene3d.ts:275`) |
| `glass.thickness` | m | 0,012 (padrão atual) | Hoje é 0,012 fixo (`scene3d.ts:272`). Revit: "Glass Thickness" [FÓRUM/TUTORIAL] |
| `sashes` (janela) | inteiro, folhas de correr ou giro | derivado de `leaves` e `plan` | `leaves` hoje não muda o símbolo de janela de correr (verificado) |
| `jamb.rebate` (rebaixo) | m | 0,035 [FÓRUM] | Para encaixe da folha |
| `architrave` | `{ enabled, width, thickness }` | `enabled: false`; 0,05 × 0,015 se ligado [ORÇAMENTO] | Alizar: não existe no modelo |
| `threshold` | `{ enabled, height, depth }` | `enabled: false` | Soleira: não existe |
| `lintel` | `{ overhang, height }` | a definir (verga) | Verga e contraverga: altura e transpasse divergentes; não preencher sem o projeto |
| `sill.projection` e `sill.drip` | m e booleano | 0 e `false` | Peitoril saliente e pingadeira: não existem |
| `swing` | `{ hand, facing, angle }` | `hand` e `facing` já existem na instância (`flipHand`, `flipFacing`); `angle` 90 | Ângulo de abertura para o símbolo e para uma folha aberta no 3D |
| `plan` | `PlanSymbol` | sem `double` (ver abaixo) | `double` hoje é igual a `swing` com 2 folhas (verificado) |
| `code` | texto (P1, J1) | `kind` + número | Etiqueta por tipo, como `wallType.code` (`tags.ts`); hoje existe só `Opening.mark` na instância |
| `planDisplay` | `symbolic \| projected` | `symbolic` | Graphisoft tem "Simbólica vs. Vista e Corte" [DOC, busca]. Permite a convenção do dono por tipo |
| `clearance` | m, folga porta–piso | 0,007 [FRACO] | Só se o projeto pedir |

**Ajustes em campos existentes:**

- `kind` aparece em `Opening` e em `OpeningType`. Pode divergir. Proposta: manter só em `OpeningType`, e derivar em `Opening`, com migração (`packages/model/src/migrate.ts`).
- `PlanSymbol`: remover `double` (ou dar a ele sentido próprio, com o número de folhas). Hoje a família só duplica `swing`.
- `leaves = 0` para janela: decidir se é vão sem caixilho (sem nada) ou janela sem folha (caixilho fixo). Hoje planta e 3D discordam (ver `B` §7).
- `sillOverride` (instância) continua válido. Não criar `sillOverride` para verga.

**Migração:** o padrão do projeto é versionar o esquema (`SCHEMA_VERSION`, `packages/model/src/migrate.ts`). Cada campo novo precisa de valor padrão que reproduza a aparência atual, para o projeto antigo não mudar.

## 5. Critérios de aceitação verificáveis

Cada critério diz o que medir, em qual função, e qual valor é esperado. "Passa hoje" ou "falha hoje" refere-se ao HEAD `1be4648`, verificado em `B` §7.

**Planta (`openingSymbolPaths`, `packages/geom/src/openingSymbol.ts:68`)**

- **P1. Porta de giro, 1 folha.** Com `W = 0,90`, `plan = 'swing'`, `leaves = 1`, `flipHand = false`, `flipFacing = false`, `sHi = 0,07`, `sLo = −0,07`: (a) um traço `ink` de comprimento `W` com uma ponta na dobradiça `(−W/2, faceS)`; (b) um arco `soft` de 90° com centro na dobradiça e raio `W`; (c) o fim do arco em `(+W/2, faceS)`, na ombreira oposta. **Passa hoje** (raio 0,90; fim a 0,90 do centro). Manter como teste de regressão.
- **P2. Porta dupla.** Com `W = 1,60`, `leaves = 2`: duas folhas de comprimento `W/2`, dobradiças em `±W/2`, e arcos de 90° de raio `W/2` que terminam em `t = 0`. **Passa hoje** (0,80 para `W = 1,60`). Mas `plan = 'double'` gera o mesmo que `plan = 'swing'`. Ver P9.
- **P3. Porta pivotante.** Com `W = 0,90`, `t = 0,14`, `plan = 'pivot'`: (a) o arco `soft` termina na ombreira, em `(±W/2, sMid)`; (b) o raio do arco é igual ao comprimento da folha; (c) o comprimento da folha é `W/2` (ou o valor do tipo, a definir). **Falha hoje**: o arco termina em `(0,07; 0)`, com raio de 0,07 m; a folha tem 0,07 m. Critério provisório: a convenção de eixo ainda não tem fonte (§6).
- **P4. Porta de correr (folhas em faces opostas).** `plan = 'sliding'`, `leaves = 2`: dois retângulos fechados em faces opostas, cada um com comprimento entre 50% e 60% de `W`, com sobreposição no meio, e uma seta. **Passa hoje** (dois retângulos fechados e seta, 4 traços). A medida dos 50% é [FONTE ESTRANGEIRA, busca] e os 60% são do código atual.
- **P5. Janela de correr.** `plan = 'sliding'`, `kind = 'window'`: dois retângulos fechados, cada um com faixa de 0,3 da espessura, e nenhuma linha no plano médio. Com `leaves = 1` o número de traços deve mudar. **Falha hoje**: `leaves` é ignorado (8 traços com 1 ou 2 folhas).
- **P6. Janela fixa.** `plan = 'fixed'`, `leaves = 1`: duas linhas nas faces, uma linha no plano médio, duas ombreiras. Total de 5 traços. **Passa hoje**.
- **P7. Maxim-ar e basculante.** `casement`: um arco tracejado (`dash` definido), do lado de `flipFacing`, com extremos sobre a face do vão. `tilt`: um V com vértice em `sMid`. **Passa hoje** na contagem. A flecha do arco (hoje `hw × 0,5`) não tem fonte.
- **P8. Vão livre.** `leaves = 0`: um traço tracejado na linha média, de `−W/2` a `+W/2`. **Passa hoje.**
- **P9. Famílias com efeito.** Para cada `plan` em `{swing, double, sliding, pivot}` com `leaves` fixo, o símbolo deve ser diferente das outras famílias, ou a família deve ser removida do diálogo. **Falha hoje** para `double`.
- **P10. Janela sem folhas.** Uma janela com `leaves = 0` deve ter a mesma decisão na planta e no 3D (caixilho com vidro, ou vão livre). **Falha hoje** (planta: soleira; 3D: caixilho e vidro).

**Corte e elevação (`packages/render/src/section/build.ts:53-67`, `packages/engine/src/section.ts:227-235`)**

- **C1. Batente da janela em corte.** Com perfil `frame.width` e `frame.depth` no tipo: a ombreira e a verga desenhadas têm espessura igual a `frame.width` e profundidade igual a `frame.depth`, centradas em `frame.alignment`. **Falha hoje**: não há perfil.
- **C2. Vidro em corte.** Faixa de vidro com espessura `glass.thickness`, no centro do caixilho. **Falha hoje**.
- **C3. Peitoril.** Peitoril do tipo na altura `sill`, com saliência `sill.projection`. Sem saliência, nenhuma peça extra. **Falha hoje**: não há peça de peitoril.
- **C4. Verga e contraverga.** A peça de verga existe com altura `lintel.height` e transpasse `lintel.overhang`. Sem o valor no tipo, não desenhar. **Falha hoje**. Ver §6 para os valores.
- **C5. Porta em corte.** O vão de porta sem folha não tem preenchimento (`section/build.ts:61-63`). **Passa hoje.** Com folha, a folha deve aparecer só se o plano a atravessa.
- **C6. Linha central da janela.** Só aparece em janela de 2 folhas (ou em `sliding`). **Falha hoje**: aparece sempre (`section/build.ts:63-64`).

**Elevação**

- **E1. Símbolo de abertura.** Janela de abrir, basculante e maxim-ar mostram o símbolo tracejado no lado de abertura; porta de giro mostra o símbolo do lado da dobradiça. **Falha hoje**: a elevação usa o mesmo retângulo do corte, sem símbolo.
- **E2. Folha de correr.** A janela ou porta de correr mostra a seta de correr. **Falha hoje**.

**3D (`openingObject`, `packages/render/src/model3d/scene3d.ts:248-279`)**

- **D1. Batente.** Ombreiras e verga com largura `frame.width` (não 0,05 fixo). **Falha hoje** (`scene3d.ts:265`).
- **D2. Folha de porta.** Espessura `leaf.thickness`, material `leaf.material`. **Falha hoje** (fixo em 0,04 e material do batente).
- **D3. Porta dupla.** Dois painéis de largura `(W − 2·frame.width)/2`, com travessa central. **Falha hoje**: um painel só (`scene3d.ts:275`).
- **D4. Janela de 2 folhas.** Montante central com largura do tipo. **Passa hoje**, com largura fixa de 0,04 (`scene3d.ts:273`), a parametrizar.
- **D5. Vidro.** Espessura `glass.thickness` (0,012 hoje). **Passa hoje** com o valor fixo; falha quando o valor vem do tipo.
- **D6. Porta fechada ou aberta.** O modo de vista decide. Sem modo aberto, o critério é que a folha fechada fique no vão. **Passa hoje** (fechada).
- **D7. Vão livre.** Porta com `leaves = 0` não gera peça (`scene3d.ts:255`). **Passa hoje.**
- **D8. Janela com 0 folhas.** Ver P10. **Falha hoje**.

**DXF (`packages/io/src/dxf.ts:330-337`; `apps/web/src/editor/dxfExport.ts:148-161`)**

- **X1. Vão de corte.** O vão de corte no DXF deve seguir a mesma regra da planta: símbolo ou retângulo. Hoje a planta usa símbolo e o DXF usa retângulo. **Discordância hoje**; escolher uma regra e testar.
- **X2. Projeção.** Símbolo na camada da projeção (`ABERTURA_ACIMA`, `ABERTURA_ABAIXO`, `ABERTURA_ALEM`). **Passa hoje** (`dxf.test.ts`, teste "porta acima do corte").

**Quantitativo**

- **Q1. Área de vão.** A área descontada da parede (`engine/quantities.ts:62-68`) não muda com a aparência. **Passa hoje.** Qualquer mudança de `OpeningType` precisa manter isso.

**Testes que faltam (lacuna de método)**

- **T1.** `symbols.test.ts` só conta traços. Acrescentar asserções sobre pontos: fim de cada arco na ombreira, comprimento de cada folha, raio de cada arco. Esses testes teriam pego o defeito do pivô (P3).

## 6. Perguntas que não consegui responder

1. **Simbologia oficial de porta e janela em planta, corte e elevação na NBR 6492:2021.** [NÃO ENCONTRADO]. Não consegui ler o texto. Precisa ser lido na ABNT ou em cópia autorizada.
2. **Convenção da porta pivotante em planta:** posição do eixo (centro da folha, ou junto a uma ponta) e comprimento da folha. [NÃO ENCONTRADO].
3. **Símbolo da porta camarão ou sanfonada.** [NÃO ENCONTRADO].
4. **Convenção brasileira da janela de correr:** número de folhas por padrão (2 ou 3) e defasagem das linhas. Só achei convenção estrangeira (duas linhas paralelas, metade do vão). [NÃO ENCONTRADO] para o Brasil.
5. **Símbolo de abertura na elevação:** triângulo com vértice no lado da dobradiça, ou linhas tracejadas, ou arco. O pedido do dono cita o triângulo; não achei fonte que confirme. [INFERIDO].
6. **Espessura de caixilho de alumínio para janela** (5 a 6 cm do pedido). [NÃO ENCONTRADO].
7. **Altura de verga e transpasse** (pedido: 0,20 m). Achei transpasse de 20 cm e de 30 a 40 cm, em fontes divergentes. [NÃO ENCONTRADO] para a altura.
8. **Altura mínima de peitoril de janela** (NBR 15575). [NÃO ENCONTRADO].
9. **Largura mínima de porta de saída** (NBR 9077). [NÃO ENCONTRADO].
10. **Valores de referência de Revit** (nomes e valores padrão de "Frame Width", "Frame Depth", "Glass Thickness", "Default Sill Height" nas famílias padrão, versão 2024 ou 2025). [NÃO ENCONTRADO] em fonte oficial.
11. **Nomes atuais de campos ArchiCAD** ("Opening Symbol", "Show Swing", "Lintel", "Sill") na versão em uso. [NÃO ENCONTRADO] para os rótulos pedidos.
12. **Porta "dupla com bandeira"** (citada em `docs/paridade/paredes.md`, D9): não sei o que é a bandeira no símbolo. [NÃO ENCONTRADO].
13. **Referência "NBR 6492 A.1"** usada na decisão 0015 para pesos de linha. [NÃO ENCONTRADO].

### Prompt de busca refinado para outro agente

Use este texto como ponto de partida. O agente deve manter as marcações deste documento.

> Pesquise a convenção brasileira de representação de portas e janelas em projetos de arquitetura. Objetivo: preencher as perguntas 1 a 13 de `docs/aberturas/A-pesquisa.md`, §6.
>
> Regras:
> 1. Não tente acessar `help.autodesk.com`, `help.graphisoft.com` nem `abntcatalogo.com.br` por outra rota. Esses domínios estão bloqueados por política (403). Use os trechos de busca e as fontes abertas.
> 2. Para cada número, dê a URL, a data de acesso, a versão da norma ou do software, e a marcação: [DOC] (fonte oficial), [FÓRUM], [ORÇAMENTO], [ESTUDO] ou [INFERIDO]. Se não achar, escreva [NÃO ENCONTRADO]. Não estime valores.
> 3. Procure manuais de apresentação de projetos de prefeituras brasileiras (consulta sugerida: "manual de apresentação de projetos arquitetônicos simbologia esquadrias", "padrão de desenho esquadrias planta corte elevação"). São o caminho mais provável de achar símbolos em norma pública.
> 4. Procure pranchas de projeto públicas de licitação (PDFs de prefeituras e órgãos estaduais) com legenda de esquadrias. Confira a legenda de cada símbolo.
> 5. Procure cópias de NBR 6492:2021 em repositórios de universidades, marcando a origem e a versão. Confirme se o texto traz símbolos de esquadria, o anexo de linhas e a referência "A.1".
> 6. Para a porta pivotante, a janela de correr brasileira, o símbolo de elevação e a verga, procure material de disciplinas de representação gráfica de universidades brasileiras, com data e instituição.
> 7. Para Revit e ArchiCAD, procure trechos de documentação em outros domínios (cópias de manuais em PDF, tutoriais oficiais de fabricantes de portas e janelas que citam a família). Marque como [FÓRUM] o que não for documentação oficial.
> 8. Entregue uma tabela com: pergunta, resposta, fonte (URL, data), marcação, e o que ainda falta.

## 7. Fontes consultadas

**Acessadas por busca (trecho, não leitura integral), 2026-10-21:**

- Autodesk, "About Layer Wrapping": versões de help.autodesk.com/cloudhelp/2016, 2017, 2021 e 2023 (GUID `69B6DC75-56A9-4F35-BE24-80048360E2BB`). [DOC, busca]
- Autodesk, "Video: Wall Layer Wrapping at Doors and Windows" (RevitLT 2020). [DOC, busca]
- Autodesk, Revit Customize 2024 (GUID `253B2300-35C2-4024-AB70-43E576CEA49C`), só título. [DOC, busca]
- Graphisoft, "Door/Window Settings and Opening" (AC19, AC20, AC21): `help.graphisoft.com/AC/21/INT/AC21Help/Appendix_Tools/Appendix_Tools-34.htm`. [DOC, busca]
- Graphisoft, "General Settings" (AC17 e AC18). [DOC, busca]
- Graphisoft, "Graphical Interface Panel for a Window" (AC17). [DOC, busca]
- Graphisoft, "Wall Inset (for Windows)" (AC24 e AC25): `help.graphisoft.com/AC/24/INT/_AC24_Help/141_DoorWindowCustomSettings/...-20.htm`. [DOC, busca]
- Graphisoft, "Visualização em Planta da Porta/Janela: Simbólica vs. Vista e Corte" (AC27 e AC29, versão em português): `help.graphisoft.com/AC/27/BRA/...`. [DOC, busca, só título]
- Graphisoft Community, "Displaying doors in plan view" e "Detailed door on plan view with opening line". [FÓRUM]
- ABNT NBR 6492:2021, título e data. Fontes de busca: `questoes.grancursosonline.com.br`, `estudante.ifpb.edu.br` (plano de ensino). Cópia de `arquivos.ufrrj.br` **não lida**. [DOC, busca]
- NBR 6492, versão de 1994 (cópia em edisciplinas.usp.br). [DOC antigo, busca]
- NBR 10126 (cotagem), resumo em material de disciplina. [ESTUDO]
- NBR 9050 (vão livre, maçaneta, puxador). Resumos em `lawinsider.com/pt/clause/portas`, `jus.com.br`, questões de concurso. [SECUNDÁRIO]
- NBR 14718 (guarda-corpo), resumo em `sienge.com.br/blog/guarda-corpos-devem-atender-a-nbr-14718/`. [SECUNDÁRIO]
- NPT 011 (Corpo de Bombeiros do PR), `bombeiros.pr.gov.br/.../npt11.pdf`. [DOC estadual, busca]
- Composições SINAPI (folha de madeira, batente, alizar, portas de giro), em `orcamentor.com`: 91014, 91015, 91016, 90801, 100685. [ORÇAMENTO]
- Catálogo de portas de madeira (folha de 35 a 40 mm), `orcamentor.com/insumos/portas-em-madeira/`. [ORÇAMENTO]
- Vergas e contravergas (Sienge): `sienge.com.br/blog/vergas-contravergas-cinta-de-amarracao/`. [FÓRUM]
- Olhar Digital, verga e transpasse 20 cm: `olhardigital.com.br/curiosidades/?p=25717`. [FÓRUM]
- FAG, trabalho acadêmico sobre verga (30 a 40 cm): `www2.fag.edu.br/coopex/arquivos/producao/1480523864583f0058d0f67.pdf`. [ESTUDO]
- Prancha de licitação de SP (janela maxim-ar e limitador de 25 cm), `ses.saude.sp.gov.br`, PDF "janelas e divisórias" (origem provável, não verificada). [DOC de licitação, busca]
- Simbologia de planta baixa (Planner5d): `planner5d.com/blog/pt/simbologia-de-planta-baixa/`. **Não lido** (`ENOTFOUND`). Trecho de busca: arco simples = porta de abrir; arcos duplos = folhas duplas. [FÓRUM, busca]
- Material espanhol sobre símbolos (janela de correr com duas linhas paralelas que ocupam metade do vão): `es.scribd.com/document/713650821/Simbolos`. [FONTE ESTRANGEIRA, busca]
- IFSC, Aulas PBA 2009, "Projeto de bloco de apoio": `wiki.ifsc.edu.br/images/3/33/Aulas_PBA_2009_1_aula1.pdf`. [ESTUDO]
- Revit, comunidade e tutoriais: augi (t-113866, t-29740), Autodesk Community (10535378), bimpure (16 passos para família de porta), cad-notes (família de porta), augi (ângulos de giro de porta), Imaginit (família de janela, parte 1), Novedge (família paramétrica de janela). [FÓRUM/TUTORIAL]
- Modelos de famílias de janela do marketplace CGTrader: não usados como fonte de valor. [FÓRUM]

**Não acessadas (bloqueadas ou sem DNS):** `help.autodesk.com` (todas as páginas de ajuda), `help.graphisoft.com` (todas), `www.abntcatalogo.com.br`, `arquivos.ufrrj.br`, `planner5d.com`.
