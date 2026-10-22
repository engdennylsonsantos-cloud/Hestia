# 07 · Status da versão de teste

Estado em 2026-10-22, conferido no código e nos testes desta árvore (esquema 16). Os checklists de
[docs/paridade](paridade/) são a fonte por elemento; `docs/paridade/ORDEM.json` registra o portão.

## O que está pronto

**Fundação**
- Monorepo npm workspaces com CI (lint, tipos, testes, build), fronteiras entre camadas verificadas por
  `scripts/check-boundaries.mjs` e limite de 420 linhas por arquivo.
- Modelo versionado (`SCHEMA_VERSION` 16), comandos serializáveis com desfazer/refazer, migrações e ida e volta de
  arquivo (`packages/model/src/esquema.test.ts`). Autosave no navegador e abertura/gravação de `.hestia.json`.
- Tipos, materiais e níveis com editores; navegador de projeto com vistas, famílias e materiais.

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
- Símbolo de planta por família, 3D por família (batente, folha, vidro e trilhos), corte/elevação por família, DXF com
  o símbolo no vão de corte e nas projeções.
- Instância com lado da dobradiça, sentido de abertura, peitoril próprio e marca; quadro de portas e janelas com código,
  família, dimensões, folhas, quantidade, áreas e CSV.

**Vistas, gráficos e seleção**
- **Planta** por nível com intervalo de vista (topo, corte, base e profundidade), classificação em corte/projeção
  acima/abaixo/além/oculto, subpavimento, projeção da cobertura e avisos de elementos fora do intervalo (decisão 0013).
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
  por categoria na planta; pesos de linha por categoria/escala; estilos, sombras, arestas, sol, fundo e visibilidade no
  3D; hachura sólida; largura de linha no DXF (código 370).
- **Documentação e quantitativos**: DXF da planta do nível atual, tabelas de paredes, pisos, lajes, telhados, escadas e
  portas/janelas com filtros, totais e CSV; validação do modelo com painel de avisos e "Ir para".
- **GPU/CPU**: WebGL2 (WebGPU opt-in) com queda para planta em CPU.

## O que ainda não existe

- **Ambientes** e quadro de áreas por ambiente: próximo elemento de `ORDEM.json`, ainda `nao-iniciado`; o botão
  "Ambiente" da faixa está desabilitado.
- **Forro** e planta de forro: o campo `direction: 'up'` do intervalo de vista é aceito e guardado, mas a planta ainda
  desenha como `down` e a opção está desabilitada.
- **Estrutura e complementos**: pilar, viga, sapata, cortina de vidro, guarda-corpo/corrimão e escada de vários andares
  (fases posteriores; ver `docs/04-ROTEIRO.md`).
- **Documentação impressa**: pranchas, PDF, cotas permanentes e texto; hoje há cota temporária na seleção e DXF.
- **Interoperabilidade e nuvem**: IFC, importação do Hestia 1, salvar na nuvem e link de compartilhamento (Fase 8).
- **Paredes**: parede inclinada, espessura variável de camada, contorno vertical livre e regiões gráficas na elevação
  (B9); cotas associativas de parede (H5).
- **Telhados**: seta de inclinação e águas livres editadas na tela (A5, fora de escopo da v1); mansarda automática fica
  para o v2 (a extrusão cobre o caso manual).
- **Aberturas**: vão bruto e tolerâncias, peitoril saliente/pingadeira, alizar, verga/contraverga, formas não
  retangulares e folha de porta aberta no 3D (decisão 0017 §8).
- **Limites conhecidos**: junção de parede curva fora do domínio (CV-2, raio < 3 m ou quina de 30°/150°) e código de
  arco sem uso (CV-3); seleção em corte unido por material pode apontar o vizinho do mesmo material; não há seleção por
  janela no 3D; o intervalo de vista é por nível, não por vista, e não há modelos de vista nem filtros por regra.

## Roteiro de teste (10 minutos)

1. `npm run dev`; em **Novo**, escolha **Casa de alto padrão, 2 pavimentos**. No navegador de projeto, confira os dois níveis, as
   32 paredes, 38 aberturas, 2 pisos, 1 laje, 1 telhado, 1 escada e as vistas de corte/elevação.
2. Na planta do térreo, passe o mouse sobre as paredes (realce) e clique em uma. Confira as propriedades; com Shift,
   acrescente outra à seleção. Desfaça com Ctrl+Z.
3. Abra **Pavimento 2** (subpavimento apagado) e o **Modelo 3D**. Arraste para orbitar e use a roda para aproximar.
   Clique em faces, arestas e cantos do **ViewCube**, nos botões de 90°, em **Início** e alterne **Perspectiva/Ortogonal**.
4. Ainda no 3D, clique em parede, janela, piso, laje, telhado e escada; use Shift para somar, Esc para limpar e
   Delete/Backspace para excluir (Ctrl+Z desfaz).
5. Na planta, pressione **K** e desenhe um corte; abra-o no navegador e clique em parede e janela. Em **Elevações**,
   use **Gerar elevações** e abra **Sul**; confira a linha oculta e a seleção por clique.
6. Pressione **W**, desenhe um circuito; digite `3,5` e Enter para uma parede de 3,5 m; **Tab** inverte o lado externo.
   Em **Propriedades**, abra **Editar tipo…**, mude uma camada/material e veja a seção ao vivo. Desfaça.
7. Com **F** (piso) e **B** (laje), crie um contorno por paredes ou retângulo e abra um furo. Troque o tipo e o
   deslocamento em Propriedades; confira o resultado no 3D e a tabela de pisos/lajes.
8. Selecione o telhado e abra **Editar tipo…**; mude a inclinação e confira as águas na planta e o beiral no 3D. Na tabela
   de arestas em **Propriedades**, escolha uma aresta e altere "Define inclinação"/balanço.
9. Selecione a escada e use **Editar croqui** e **Tipos de escada**; confira a numeração dos degraus e o furo na laje.
   Com **Q**, escolha **Caracol**, clique no centro, no raio/ângulo inicial e no ângulo final (ou digite a varredura);
   confira 3D, corte e avisos. Desfaça.
10. Com **D** e **J**, insira porta e janela; **Tab** troca o lado e **Espaço** a dobradiça. Troque a família no tipo e
    confira símbolo, 3D, corte/elevação e o **Quadro de portas e janelas**. Por fim, ajuste escala/detalhe/estilo e
    **Visibilidade e gráficos** da vista, exporte o **DXF** e salve/abra o `.hestia.json`.

## Como rodar

```bash
npm install
npm run dev            # servidor de desenvolvimento
npm run check          # lint + tipos + testes (portão do CI)
npm run test:perf      # desempenho (K4 e captura de faces), fora do check
npm run build:artifact # gera apps/web/dist/artifact.html (verificado em 2026-10-22)
npm run test:visual    # regressão visual (requer build e Chromium do Playwright)
npm run e2e            # fluxo no navegador (requer Chromium do Playwright)
npm run parity         # percentual de paridade por elemento
```

## Qualidade e verificação

- Todos os elementos acima têm checklist sem item pendente: paredes 66+17, pisos 31+7, lajes 30+3, telhados 43+1,
  escadas 36+4 e aberturas 28+3 (feitos + fora de escopo). O portão de 95% e os bloqueantes são verificados por
  `scripts/check-parity.mjs` no `npm run lint` e no CI; todos aparecem como 100% concluídos.
- Suíte completa em 2026-10-22: 180 arquivos e 2713 testes verdes (~122 s); `npx tsc -p tsconfig.json --noEmit`,
  `npm run lint` e `node scripts/check-boundaries.mjs` limpos.
- Suítes de geometria e junções: `curvas.test.ts`, `juntasInvariantes.test.ts`, `quinas.test.ts`, `obliquas.test.ts`,
  `nos.test.ts` e `property.test.ts`; junções por imagem em `npm run visual:juntas`.
- Desempenho: `npm run test:perf` mede K4 (500 paredes) e a captura de faces com limites relativos; medido em
  2026-10-22, os dois arquivos passam.
- A conferência visual final em navegador real continua manual: os testes cobrem geometria, unidade e desenho, não a
  aparência em todas as combinações de zoom, tema e GPU.
