# 07 · Status da versão de teste

Estado em 2026-10-22, conferido no código e nos testes desta árvore (esquema 18). Os checklists de
[docs/paridade](paridade/) são a fonte por elemento; `docs/paridade/ORDEM.json` registra o portão, e todos os nove
elementos estão `concluido` (`npm run parity`).

## O que está pronto

**Fundação**
- Monorepo npm workspaces com CI (lint, tipos, testes, build), fronteiras entre camadas verificadas por
  `scripts/check-boundaries.mjs` e limite de 420 linhas por arquivo.
- Modelo versionado (`SCHEMA_VERSION` 18), comandos serializáveis com desfazer/refazer, migrações (v16 → v17 para
  ambientes, v17 → v18 para forros) e ida e volta de arquivo (`packages/model/src/esquema.test.ts`). Autosave no
  navegador e abertura/gravação de `.hestia.json`.
- Tipos, materiais e níveis com editores; navegador de projeto com vistas, famílias, materiais e pranchas.

**Paredes** — 66 itens feitos, 17 fora de escopo, 0 pendentes (`docs/paridade/paredes.md`).
- Parede reta, em arco (centro/raio/ângulos e três pontos) e por retângulo; altura livre ou até nível, deslocamentos
  de base e topo, linha de localização (6 opções) e lado externo.
- Camadas com função, material, espessura, prioridade e "envolve"; membranas de espessura zero; faixas verticais
  (rodapé, barra de azulejo, friso); perfil superior (empena, inclinado, degraus).
- Junções L/T/X por prioridade, incluindo encosto, esquadria, cortes oblíquos de 30° a 150° e paredes empilhadas.
  Parede em arco no domínio suportado (raio ≥ 3 m e quina de 60° a 120°); fora dele vale a limitação CV-2.
- Aberturas hospedadas com recorte em todas as camadas, retorno de acabamento, troca de anfitriã e avisos de
  sobreposição/encurtamento.
- Ferramentas de edição: selecionar, mover, copiar, girar, espelhar, matriz, deslocar, parede paralela, aparar,
  alinhar, dividir, juntar, medir, trocar anfitriã e anexar/desanexar topo ao telhado.
- Planta, corte/elevação, 3D, etiquetas, depuração de junções, níveis de detalhe, DXF, tabela de paredes com filtros,
  totais e CSV, e validação do modelo com painel de avisos.

**Pisos** — 31 itens feitos, 7 fora de escopo, 0 pendentes (`docs/paridade/pisos.md`).
- Contorno por cliques, retângulo, medida digitada, seleção de paredes ou área fechada; furos; edição por alças
  (vértice, aresta, inserir/remover).
- Tipo em camadas com seção ao vivo, deslocamento de topo, parede com base/topo anexados ao piso, aviso de pisos
  sobrepostos.
- Planta com hachura, 3D por camada, corte/elevação, subpavimento, níveis de detalhe, etiqueta, DXF, quantitativos e
  tabela de pisos com CSV.

**Lajes** — 30 itens feitos, 3 fora de escopo, 0 pendentes (`docs/paridade/lajes.md`).
- Contorno por cliques/retângulo/medida, contorno automático pelo perímetro externo ou por área fechada, furos
  (escada, shaft), edição por alças.
- Inclinação por linha e percentual, tipo em camadas com seção ao vivo, deslocamento de topo, parede anexada à laje,
  avisos de sobreposição entre laje/piso e entre lajes.
- Planta, 3D com inclinação e furos, corte/elevação com hachura por camada, etiqueta, DXF, quantitativos e tabela de
  lajes com CSV.

**Telhados** — 43 itens feitos, 1 fora de escopo, 0 pendentes (`docs/paridade/telhados.md`).
- Contorno por cliques/retângulo/medida e pelas paredes com balanço; formas uma, duas e quatro águas; inclinação em
  % ou graus; direção da cumeeira/caimento; contorno qualquer com inclinação por aresta e empena.
- Cumeeira, espigões e rincões pelo encontro das águas; furos; edição por alças e por aresta; telhado por extrusão
  de perfil; junção de telhados; acabamentos do beiral (testeira, calha, forro e corte de caibro).
- Topo da parede ajustado ao telhado, anexar/desanexar pelo comando, avisos de parede fora do telhado ou atravessada.
- Planta com águas e setas, 3D, corte/elevação, subpavimento, planta de cobertura, etiqueta, DXF, quantitativos e
  tabela de telhados com CSV.

**Escadas (inclui caracol)** — 36 itens feitos, 4 fora de escopo, 0 pendentes (`docs/paridade/escadas.md`).
- Croqui de lance com limites, espelhos e caminhada em retas e arcos; patamar por croqui; validação com as mensagens
  do Revit; edição por alças e "Pegar linhas" (parede, outra escada, aresta de laje/piso).
- Geradores reto, L, U, leque e caracol (helicoidal, até duas voltas), com dois estilos de caracol: monolítico e poste
  central (decisão 0014).
- Tipo de escada (espelho/piso/largura mínimos, estilo monolítico ou piso e espelho, face inferior lisa ou escalonada,
  espessuras, nariz, patamar, pé-direito livre, material); editor de tipo com seção ao vivo.
- Corpo monolítico com chegada, patamar contínuo e fundo liso/escalonado; furo derivado por laje/piso do nível de topo
  (pé-direito livre, contorno completo ou sem abertura); avisos de norma, largura, folga de cabeça, espelhos e leque.
- Planta com numeração contínua e volta superior tracejada, 3D, corte/elevação, subpavimento, DXF, quantitativos e
  tabela de escadas com CSV.

**Aberturas por família** — 28 itens feitos, 3 fora de escopo, 0 pendentes (`docs/paridade/aberturas.md`).
- Dez famílias em `OPENING_FAMILIES` (5 de porta e 5 de janela): giro, dupla, correr, pivotante e vão livre; fixa,
  basculante, maxim-ar, correr (2 ou 3 folhas) e vão livre de janela. O tipo escolhe a família, as folhas aceitas e o
  símbolo; combinação fora das famílias é recusada.
- Tipo com código (Type Mark), descrição, largura, altura, peitoril, folhas e espessuras de esquadria com padrão;
  batente limitado ao núcleo da parede (decisão 0017).
- **Acabamento e vão bruto por tipo, campos opcionais do modelo**: folga do vão bruto (`roughOversize`: o furo cresce, a
  esquadria não), alizar nas duas faces (`casing`), verga e contraverga com transpasse (`lintel`, `sillBeam`) e peitoril
  saliente de janela (`sillBoard`). Sem o campo, nada é desenhado; quando preenchidos, aparecem na planta, no 3D e no corte.
  A interface de edição do tipo ainda não expõe esses campos (só o quadro mostra a verga); ver "ainda não existe".
- **Favoritos**: tipos marcados com estrela ficam no topo do seletor da barra de opções, na ordem gravada no projeto
  (desfazível).
- Símbolo de planta por família, 3D por família (batente, folha, vidro e trilhos), corte/elevação por família, DXF com
  o símbolo no vão de corte e nas projeções.
- Instância com lado da dobradiça, sentido de abertura, peitoril próprio e marca; quadro de portas e janelas com código,
  família, dimensões, folhas, quantidade, áreas e CSV.

**Ambientes** — 24 itens feitos, 4 fora de escopo, 0 pendentes (`docs/paridade/ambientes.md`; decisão 0018).
- Contorno derivado do circuito fechado pelas faces internas das paredes do nível; vãos de porta e janela fecham por
  padrão; pilares internos viram furos e descontam a área líquida.
- Ferramenta **Ambiente** (atalho **Z**, aba Arquitetura): clique dentro do circuito, e "Ambientes em todos os circuitos
  fechados" cria um por circuito do nível.
- Nome, número, ponto interior, pé-direito por instância, deslocamento da base e acabamentos (piso, parede, forro) e cor;
  área líquida, perímetro e volume derivados do circuito.
- Planta com preenchimento e etiqueta (nome, número e área); no subpavimento, o ambiente de baixo aparece apagado.
- Tabela de ambientes com filtros por nível, totais e CSV; seleção por clique e janela, "Mesmo nome", copiar/colar
  alinhado entre níveis; avisos de nome vazio, ponto fora de circuito e ambiente duplicado no painel de avisos.
- DXF: contorno na camada `AMBIENTES` e nome, número e área em `AMBIENTES_TEXTO`.

**Forros e planta de forro** — 32 itens feitos, 1 fora de escopo, 0 pendentes (`docs/paridade/forros.md`; decisão 0021).
- Forro por nível com contorno e furos, cota do topo (padrão 2,60 m) e face inferior derivada das camadas; tipos em
  camadas (gesso 12,5 mm, PVC, laje aparente) com seção ao vivo.
- Ferramenta Forro por contorno, retângulo ou **"No ambiente"**; "Forro nos ambientes" gera um forro por ambiente do
  nível em um clique (um Ctrl+Z); recorte pelo vão de escada e pelas aberturas de piso/laje do nível de cima.
- **Planta de forro**: "Direção da vista → Para cima (planta de forro)" em Propriedades; a planta baixa não mostra o forro.
- 3D por camada, corte e elevação com faixa por camada e hachura própria de gesso; quantitativos (área líquida,
  perímetro, espessura e volume por camada), tabela com filtros e CSV, avisos integrados à lista de problemas.
- DXF: camada `FORRO` (polilinhas fechadas, com furos), só na planta de forro.

**Pranchas e PDF** — 19 itens feitos, 4 fora de escopo, 0 pendentes (`docs/paridade/pranchas.md`).
- Prancha A0–A4 em paisagem ou retrato, margem e carimbo, em `Project.sheets`; grupo **Pranchas** no navegador
  (abrir, editar, duplicar, excluir e nova prancha).
- Vistas de planta, corte/elevação ou 3D com escala (1:S), posição e tamanho; arrastar a vista e trocar a escala pela
  faixa; hachura de padrão de superfície recortada ao polígono; 3D aparece como quadro com o aviso "3D não vai no PDF".
- **Exportar PDF** (barra de título): PDF 1.4 vetorial sem dependências, uma página por prancha, Helvetica WinAnsi,
  xref com offsets reais; nome do arquivo com o nome do projeto.

**Anotações** (sem checklist de paridade próprio)
- Ferramenta **Cota** (atalho **Y**) em sequência de cliques, com referência à parede; ferramenta **Texto** (atalho **X**);
  seleção, propriedades e exclusão das anotações; grupo Anotar.
- Cotas e textos entram na planta e no DXF (camadas `COTAS` e `TEXTOS`).

**Vistas, gráficos e seleção**
- **Planta** por nível com intervalo de vista (topo, corte, base e profundidade), direção para baixo ou para cima,
  classificação em corte/projeção acima/abaixo/além/oculto, subpavimento, projeção da cobertura e avisos de elementos
  fora do intervalo (decisão 0013).
- **Cortes e elevações**: corte por dois cliques na planta; as quatro elevações (Norte, Sul, Leste e Oeste) são geradas
  em um passo; linha oculta e oclusão; seleção por clique, Shift/Ctrl, realce e Delete/Backspace (decisão 0016).
- **3D** com câmera orbital, luz, sombras, arestas, sol e fundo configuráveis; estilos realista, sombreado, cores
  consistentes, linhas ocultas e só arestas (decisão 0015).
- **Seleção no 3D** por clique para paredes, portas, janelas, pisos, lajes, telhados e escadas, com Shift/Ctrl para
  múltipla, Esc para limpar e Delete/Backspace para excluir. O picking usa faixas por elemento e BVH por geometria
  (F1); o realce é uma sobreposição fora do modelo.
- **ViewCube** com 26 zonas (6 faces, 12 arestas e 8 cantos), giro por arrasto, botões de 90°, Início (vista padrão e
  enquadramento) e alternância entre perspectiva e **ortográfica** (`packages/render/src/model3d/orbit.ts`,
  `apps/web/src/ui/viewcube.test.ts`).
- **Gráficos de vista** (decisão 0015): escala, detalhe, estilo visual, exibição parcial de estrutura e substituições
  por categoria na planta; pesos de linha por categoria e escala (em mm de papel nas pranchas); estilos, sombras,
  arestas, sol, fundo e visibilidade no 3D; hachura sólida; largura de linha no DXF (código 370).
- **Linhas finas por vista** (decisão 0015 §6): botão "Linhas finas" na aba Vista e caixa nas propriedades; traços com 1 px só na tela, a prancha, o PDF e o DXF mantêm os pesos reais.
- **Documentação e quantitativos**: DXF da planta do nível atual (camadas de paredes, pisos, lajes, telhados, escadas,
  ambientes, forros, cotas e textos); tabelas de paredes, pisos, lajes, telhados, escadas, portas/janelas, ambientes e
  forros com filtros, totais e CSV; validação do modelo com painel de avisos e "Ir para".
- **IFC4 (exportação)**: botão **Exportar IFC** (metros) com IfcSite, IfcBuilding, IfcBuildingStorey, IfcWall, IfcDoor,
  IfcWindow, IfcOpeningElement com relações de vazio e preenchimento, IfcSlab, IfcRoof, IfcStair e IfcStairFlight, e
  camadas de material. Não exporta ambientes (IfcSpace) nem forros (IfcCovering).
- **GPU/CPU**: WebGL2 (WebGPU opt-in) com queda para planta em CPU (`?cpu=1`).

## O que ainda não existe

- **Interoperabilidade e nuvem**: importação de IFC, importador de arquivos do Hestia 1, salvar na nuvem e link de
  compartilhamento (Fase 8). Não há código para nenhum deles.
- **Guarda-corpo e corrimão**: etapa própria, decisão do dono de 2026-10-21 (`escadas.md` C4).
- **Escada de vários andares** (`escadas.md` C6, decisão do dono).
- **Pilares, vigas, sapatas e cortina de vidro**: o modelo não tem esses elementos (fases posteriores; ver
  `docs/04-ROTEIRO.md`).
- **Ambientes**: sem geometria 3D própria (`ambientes.md` D2); sem linha separadora de ambiente (A5); sem piso de acabamento
  gerado pelo ambiente (C3), que continua sendo um contorno de piso.
- **Forros**: o contorno não acompanha o ambiente depois de criado; o forro grava o contorno (`forros.md` A5, decisão 0021 §4).
- **Pranchas**: carimbo com logotipo e campos personalizados, modelos de prancha (E1); quantitativos e tabelas na prancha
  (E2); imagem do 3D no papel (B5); deslocar o conteúdo da vista com pan (D7).
- **Aberturas**: edição na interface do vão bruto, alizar, verga/contraverga e peitoril saliente (hoje só pelo modelo);
  vão em arco e formas não retangulares (decisão 0017 §8); folha de porta aberta no 3D. O checklist
  `aberturas.md` ainda marca C3 (peitoril saliente) e C4 (verga e contraverga) como fora de escopo, mas o código já tem
  essas peças como campos opcionais do tipo (ver acima); a atualização do checklist está pendente.
- **Escadas e IFC**: `escadas.md` C7, `paredes.md` J1 e `pisos.md` E5 ainda marcam IFC como fora de escopo, mas
  a exportação IFC4 já existe (ver acima); os checklists precisam ser atualizados.
- **Paredes**: parede inclinada, espessura variável de camada, contorno vertical livre e regiões gráficas na elevação
  (B9); cotas associativas de parede (H5). As cotas permanentes da planta não são associativas à parede.
- **Telhados**: seta de inclinação e águas livres editadas na tela (A5, fora de escopo da v1); mansarda automática fica
  para o v2 (a extrusão cobre o caso manual).
- **Limites conhecidos**: junção de parede curva fora do domínio (CV-2, raio < 3 m ou quina de 30°/150°) e código de
  arco sem uso (CV-3); seleção em corte unido por material pode apontar o vizinho do mesmo material; não há seleção por
  janela no 3D; o intervalo de vista é por nível, não por vista, e não há modelos de vista nem filtros por regra.

## Roteiro de teste manual (10 minutos)

Cobre as frentes novas (aberturas, ambientes, forros, pranchas, anotações e IFC) e as anteriores em resumo.

1. `npm run dev`; em **Novo**, escolha **Casa de alto padrão, 2 pavimentos**. No navegador de projeto, confira os dois
   níveis, as 32 paredes, 38 aberturas, 2 pisos, 1 laje, 1 telhado, 1 escada e as vistas de corte/elevação.
2. **Aberturas**: selecione uma janela e abra **Editar tipo…**; confira família, folhas e símbolo. Marque o tipo como
   **favorito** (estrela na barra de opções) e confira que ele sobe para "★ Favoritos" no seletor. Com **D** e **J**, insira porta e
   janela (**Tab** troca o lado, **Espaço** a dobradiça) e abra o **Quadro de portas e janelas**.
3. **Ambientes**: com **Z**, clique dentro de uma sala fechada e confira a etiqueta com nome, número e área. Em
   **Tabela de ambientes**, altere nome e pé-direito no painel de propriedades e confira área e volume. Use a opção
   "Ambientes em todos os circuitos fechados" e confira os avisos (um circuito aberto deve gerar aviso).
4. **Forros**: na aba Arquitetura, use **Forro nos ambientes** e confira o forro no 3D e no corte. Em Propriedades,
   em **Direção da vista**, escolha **Para cima (planta de forro)**: o forro aparece hachurado e a planta baixa não o
   mostra. Abra a tabela de forros e confira área e volume por camada. Se houver escada no pavimento de cima, confira o
   recorte do forro no vão.
5. **Pranchas**: no navegador, em **Pranchas**, clique em **Nova prancha** (A3 paisagem). Use **Adicionar vista** para
   uma planta 1:100 e um corte 1:50; arraste a vista e troque a escala pela faixa. Confira o carimbo no diálogo de
   propriedades da prancha.
6. **PDF**: com a prancha aberta, clique em **Exportar PDF** na barra de título e abra o arquivo no leitor. Confira o
   carimbo, as vistas com a espessura das linhas e o aviso do 3D.
7. **Cotas e textos**: na planta, use **Y** (cota, com referência à parede) e **X** (texto); selecione e apague uma
   anotação (Ctrl+Z desfaz). Clique em **Exportar DXF** e confira as camadas `COTAS`, `TEXTOS`, `AMBIENTES` e, na planta de
   forro, `FORRO`.
8. **Cortes e 3D**: pressione **K**, desenhe um corte e use **Gerar elevações** para abrir a Sul; clique em uma parede e
   uma janela na elevação. No **Modelo 3D**, orbite, use a roda, clique nas faces e arestas do **ViewCube**, alterne
   **Perspectiva/Ortogonal** e selecione parede, piso, laje, telhado e escada com Shift/Esc/Delete.
9. **Paredes e tipos**: selecione uma parede, use **Editar tipo…** para mudar uma camada e veja a seção ao vivo; faça o
   mesmo com uma escada (**Tipos de escada**) e confira a numeração dos degraus. Desfaça com Ctrl+Z.
10. **Exportação e arquivo**: clique em **Exportar IFC** e confira que o arquivo abre (paredes, janelas, lajes, telhado e
    escada); grave o `.hestia.json`, feche, reabra e confira que ambientes, forros e pranchas voltaram. Por fim, abra o
    painel de avisos e use **Ir para** em um aviso.

## Como rodar

```bash
npm install
npm run dev            # servidor de desenvolvimento
npm run check          # lint (inclui fronteiras e paridade) + tipos + testes (portão do CI)
npm run test:perf      # desempenho (K4 e captura de faces), fora do check
npm run build          # build da aplicação em apps/web/dist
npm run build:artifact # gera apps/web/dist/artifact.html a partir do build
npm run e2e            # fluxo no navegador (requer Chromium do Playwright)
node tests/e2e/pranchas.mjs         # pranchas: aba, vistas, carimbo e PDF (requer build e Chromium)
node tests/e2e/visual-regression.mjs  # regressão visual da planta (requer build; --update regrava as referências)
npm run parity         # percentual de paridade por elemento
```

## Qualidade e verificação

- Todos os elementos acima têm checklist sem item pendente: paredes 66+17, pisos 31+7, lajes 30+3, telhados 43+1,
  escadas 36+4, aberturas 28+3, ambientes 24+4, forros 32+1 e pranchas 19+4 (feitos + fora de escopo). O portão de 95% e
  os bloqueantes são verificados por `scripts/check-parity.mjs` no `npm run lint` e no CI; todos aparecem como 100%.
- `npm run check` em 2026-10-22: lint, tipos e testes verdes, 229 arquivos e 3043 testes (`npm run test`, sem os testes
  de tempo).
- `npm run build` e `npm run build:artifact` sem erro em 2026-10-22 (`dist/index.html` de 2.495,62 kB; `artifact.html`
  de 2.435 kB, sem `TMPDIR`).
- Suítes de geometria e junções: `curvas.test.ts`, `juntasInvariantes.test.ts`, `quinas.test.ts`, `obliquas.test.ts`,
  `nos.test.ts` e `property.test.ts`; junções por imagem em `npm run visual:juntas`.
- Desempenho (`npm run test:perf`, 2026-10-22, ambos passam): K4 com 500 paredes, base 54 ms, a frio 1260 ms (razão 23,3
  contra limite de 60), depois de mover uma parede 737 ms (razão 13,8 contra 40); captura de faces com 500 chamadas a
  `infer`, base 55 ms, 601 ms (razão 10,9 contra 30).
- `npm run e2e` e `node tests/e2e/pranchas.mjs` saem sem erro de página (12 e 17 conferências de fluxo e de PDF).
- Regressão visual (`tests/e2e/visual-regression.mjs`, 2026-10-22): as 21 baselines passam sem diferença (0,000 %) em duas execuções seguidas; as 20 antigas foram regravadas depois de conferidas (paredes e pesos de traço por escala, decisão 0015; telhados cortados com topo 6,0 m e corte 2,75 m, decisão 0013). O script espera as fontes e o enquadramento assentarem antes de cada captura.
- A conferência visual final em navegador real continua manual: os testes cobrem geometria, unidade e desenho, não a
  aparência em todas as combinações de zoom, tema e GPU.
