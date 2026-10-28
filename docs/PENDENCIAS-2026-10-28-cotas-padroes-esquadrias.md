# Pendências (28/10/2026): cotas, padrões do projeto, esquadrias

Lista para montar o plano. Nada daqui foi implementado ainda, exceto onde diz "feito". Decisões do dono marcadas com **[decidido]**.
Branch de trabalho: `claude/fervent-newton-rfgz3y`. Nada foi mesclado na `main` nem em `integracao/telhados-grades` (aguarda confirmação do dono).

## A. Sistema único de cotas e referências (tudo de uma vez, reaproveitável)

**Decisões do dono**
- **[decidido]** Referências da cota: opção de **núcleo a núcleo**, **face a face** (face acabada) e **eixo**, configurável pelo usuário. Para a abertura (porta/janela): **vão livre**, **vão externo do batente** e **com alizar** (a "projeção da abertura"), mais **centro** como opcional.
- **[decidido]** Configuração no **projeto**, no menu de propriedades, em **"Padrões do projeto"**, com um botão ao estilo do "Editar níveis". Troca rápida na ferramenta e por clique na alça da cota.
- **[decidido]** Fazer **tudo de uma vez**, como ferramenta reaproveitável: incluir o controle numa ferramenta nova (ou esquecida) tem de ser rápido.
- **[decidido]** Ao **selecionar** parede, linha, porta, janela etc., reaparece a cota dinâmica; clicar no valor e digitar **reposiciona** o elemento. Elemento **hospedado não pode sair da parede**: alerta.
- **[decidido]** Estilo como o Revit (imagem do dono): linhas de chamada com tracinhos, texto azul editável, pontos de alça, ícone "I" para converter em cota permanente. Pesquisa do Revit pedida (R7, em andamento).

**Proposta técnica (a detalhar no plano)**
- `DimRef` com duas escolhas independentes por ponta: no elemento de referência (parede: eixo | face acabada | núcleo) e no elemento medido (abertura: centro | vão livre | vão externo | com alizar; parede/linha: eixo | faces).
- Módulo único de resolução de referências; cada tipo de elemento declara os pontos que oferece.
- Hoje existem **3 vocabulários**: `axis | face` (cotas temporárias, `openingPlacement.ts`), `externa | nucleo | eixo` e `centro | arestas` (`autoCotas.ts`), e nada nas ferramentas de parede e linha. Unificar e migrar `openingDimMode`.
- Componente único de cota temporária alimentado por provedores: abertura, parede (comprimento + distância aos vizinhos), linha, modo perímetro, eixos (grids), piso, laje, telhado, mover/copiar. O `OpeningTempDims` atual vira um provedor.
- Clicar na alça azul alterna a referência daquela ponta (eixo, face, núcleo), como no Revit.
- Conversão "I" para cota permanente, ligada ao `autoCotas` e ao `dimensionTool`.
- Validação de edição por cota: elemento hospedado que não cabe na parede gera alerta (barra de status e aviso na cota), sem sair da parede.
- Cuidados: desempenho, testes e goldens que dependem do símbolo antigo, desfazer/refazer, formato do valor (depende de B/unidades).

## B. Unidades do projeto (em avaliação)
- Hoje **não há configuração de unidades**: o modelo guarda tudo em metros (SI) e a interface mostra metros (cm em alguns campos por `scale={100}` no `NumField`). Ver a análise de custo na conversa de 28/10 (levantamento: ~355 `toFixed(` em 107 arquivos, ~71 campos `unit="m"`, ~41 `unit="cm"`, ~60 `scale={100}`, ~100 ocorrências de "m²").
- Decidir: escopo (comprimento, área, volume, ângulo, inclinação, custo), sistemas (m, cm, mm, ft-in), onde mora (Padrões do projeto), exportação (DXF `$INSUNITS`, IFC `METRE`) e entrada com sufixo ("120cm").
- Relação com A: o texto das cotas depende desse serviço.

## C. Correções pequenas (primeiro lote sugerido)
1. **Prévia de colocação com a porta real do tipo** (hoje `symbolPreviewItems`/`openingSymbolPaths`, símbolo antigo); usar o modelo real (`buildOpeningModel` + `openingPlanPaths`, com cache por tipo e inversão). Isso inclui bandeiras e composições.
2. **Espaço e Tab não redesenham a prévia** (`openingTool.ts`: `space()`/`tab()` só invertem estado; o desenho só refaz no próximo movimento do mouse).
3. **Alças de inversão da porta selecionada** (`OpeningFlipGrips`): o dono relata que só clicar não inverte o lado. Reproduzir no navegador.
4. **Planta no modal de propriedades do tipo** só mostra parede e arco, segundo o dono. A lista de desenho tem os traços do batente e da folha (medido); reproduzir no navegador e achar a causa (SVG do modal, detalhe, espessura).
5. **Batente com a espessura da parede** **[decidido]**: **espessura acabada** da parede como padrão, com **opção de espessura do núcleo**; vale para **paredes de todos os tipos e para janelas**, não só porta de madeira. Hoje o padrão é o núcleo (`frameDepthMode 'core'`; existe `'wall'`). Revisar alizar, retorno do acabamento e testes.

## D. Esquadrias (composição): pendências conhecidas
- **Validar o alizar no 3D** pelo dono (recuo de 14 mm na face de abertura; alternativa: alizar colado ao batente aceitando a folha tocá-lo).
- **Maçanetas:** conferir de perto no 3D (só a elevação foi vista). Com a folha aberta a maçaneta passa a linha do vão em t (isenta no teste).
- **IFC:** cada vão sai como caixa única; exportar membros e vidro por peça.
- **Bay, bow e janela de canto** (F8): exigem células não coplanares.
- **Vidro:** rebaixo, folga e baguete são estimativas "a validar"; aço e catálogos de fabricantes sem pesquisa; NBR 10821 e 7199 não lidas.
- **Ids de célula** com hífen podem colidir com ids internos da folha (baixo).
- **Documento B, lacunas L-5 a L-16** (folha em corte e elevação, planta sem alizar/soleira/verga, perfil de caixilho, DXF sem corte): não foram reconferidas após a `v3`.
- **Decisões do catálogo E4** (handoff §5): PF-90/120, tipos antigos P-01..P-03 coexistindo com os novos, peitoris escolhidos pelo agente.
- **Sentido no quadro de esquadrias** em porta de correr/janela, e a convenção "abre para fora".
- **Baselines de imagem** (`tests/e2e/baseline*`) não regravados; a regressão visual da CPU falha por diferença de ambiente (fontes/SO).
- Vidro de bandeira acima do plano de corte aparece como linha na planta (`addHighExtras`): convenção a confirmar.
- **Integração:** mesclar `claude/fervent-newton-rfgz3y` em `integracao/telhados-grades` e na `main` (aguarda o dono).

## E. Pesquisas
- R7 (concluída): `docs/aberturas/pesquisa-f0/R7-revit-cotas-temporarias.md`. Confirmado: cotas aparecem ao colocar e ao selecionar; medem até o perpendicular mais próximo; linhas de chamada podem ser movidas para trocar a referência; paredes: Centerlines | Faces | Core centerline | Core faces; portas e janelas: Centerlines | Openings; ajuste em Manage > Settings > Additional Settings > Temporary Dimensions; converter em permanente mantém a cota; porta fora da parede gera erro ("Can't cut instance ... out of wall"). Não confirmado: escopo (projeto ou usuário), digitar para mover, ícones, unidades.
- Pesquisas anteriores salvas em `docs/aberturas/pesquisa-f0/` (R1 a R6).

## F. Processo
- Economia: Haiku (esforço médio) para tarefas com padrão pronto; Sonnet (esforço médio) para modelo, motor e revisão.
- Worktrees de agentes devem começar com `git fetch origin claude/fervent-newton-rfgz3y` e `git checkout -B <branch> origin/claude/fervent-newton-rfgz3y`, depois `npm ci`.
- Estado e histórico da composição: `docs/aberturas/F-PROGRESSO.md`.
