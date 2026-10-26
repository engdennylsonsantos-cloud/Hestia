# 0032 · Interface no padrão Revit (faixa guiada por dados, docks, barras)

Data: 2026-10-25. Proposta visual: `docs/proposta_interface_revit.html`.

## Faixa de ferramentas

A faixa vem de dados (`apps/web/src/ui/ribbon/`): **abas → painéis → itens**. Os componentes só desenham. Ferramenta nova = uma linha
na lista do painel certo, em `tabsMain.ts` (abas com ferramentas) ou `tabsSoon.ts` (abas ainda vazias).

- **Abas** na ordem do Revit 2024: Arquivo, Arquitetura, Estrutura, Aço, Pré-moldado, Sistemas, Inserir, Anotar, Analisar, Massa e
  terreno, Colaborar, Vista, Gerenciar, Suplementos, **Modificar**; depois dela a aba **contextual** verde.
- **Contextual** (`context.ts`): nasce com ferramenta de criação ativa ("Modificar | Colocar Parede") ou com seleção ("Modificar | Paredes"),
  traz painéis do assunto (Desenhar com os modos de desenho, Modificar parede, Hospedeiro, Editar forma, Escada…), é selecionada sozinha e
  devolve a aba anterior quando some. Ferramentas de edição (mover, copiar…) não abrem aba.
- **Peças**: botão grande (ícone 32 px, rótulo de até 2 linhas), botão pequeno (16 px, rótulo à direita), **pilha de até 3 pequenos**
  na altura de um grande, **botão dividido** (ícone roda a variante padrão, rótulo com ▾ abre as variantes) e `soon` (esmaecido).
- **Regra de escolha**: mesmo comando em formas diferentes → dividido (Escada, Telhado, Piso, Tabelas); comando satélite do principal →
  pilha ao lado do grande (Ambiente + Separador); independentes e importantes → cada um grande; muitos parecidos → pilhas de 3 (Modificar);
  liga/desliga de vista → barra de controle da vista, não a faixa de criação. Nada de espaço reservado vazio.
- Só entra em dividido o que tem **2 ou mais variantes reais**. O que não existe é `soon` (tooltip "ainda não disponível").
- Atalho só no tooltip ("Parede (WA)"), nunca dentro do botão. Títulos de painel em caixa normal.
- Extras do Hestia sem equivalente no Revit ficam no painel mais parecido: Seleção e nível (Mesmo tipo, Mesmo nome, Mover para nível) na
  aba Modificar; Parede paralela e Trocar hospedeiro no painel Modificar; Cotas automáticas no painel Cota; Laje no dividido de Piso.

## Barras e painéis

- **Barra de título**: botão R e aba Arquivo abrem o menu Arquivo (Novo, Abrir, Salvar, Exportar DXF/PDF/IFC, Informações do projeto,
  Opções com idioma, tema e motor gráfico); Barra de Acesso Rápido só de ícones; título "Hestia - [Projeto] - Planta de piso: Térreo";
  Centro de informações com **pesquisa de comandos** (acha e executa o que está na faixa) e menu de ajuda.
- **Docks** (`Dock.tsx`, `editor/dockLayout.ts`): Propriedades e Navegador empilhados à esquerda, com divisórias arrastáveis (largura, altura)
  e ✕ para fechar; o navegador pode ir para a direita (Vista ▸ Interface do usuário). Guardado no navegador (`hestia.dock`).
  A largura mínima do dock (250 px) é conferida por `scripts/check-props-density.mjs`.
- **Navegador de projeto**: árvore ⊞/⊟ com Vistas (todas), Tabelas/Quantidades, Pranchas, Famílias (categoria ▸ família ▸ tipo), Grupos
  e Links. Duplo clique abre/edita, botão direito traz renomear, duplicar, excluir, substituir, onde é usado. Negrito = vista ativa ou tipo
  em uso. Materiais, níveis e pesos de linha saem da árvore (Gerenciar e Arquitetura).
- **Propriedades**: sem prévia no topo (fica no Editar tipo), grupos na ordem do Revit (Restrições, Construção, Dimensões, Junções,
  Dados de identidade) e divisória rótulo|valor arrastável (`LabelScroll`, duplo clique restaura 46%).
- **Barra de controle da vista**: faixa fixa na base da vista (escala, nível de detalhe, estilo visual; no 3D também Sombras, Arestas e
  Abrir vãos), com os controles ainda inexistentes esmaecidos. **Barra de navegação** no canto da vista (aproximar, afastar, enquadrar).
  Status ganha filtro de seleção e o motor gráfico.

## Aplicativo de Windows, painéis móveis e menu de contexto (2ª rodada)

- **Aparência de app** (`appshell.css`, `editor/appShell.ts`): janela cheia sem margens nem cantos; texto da interface não selecionável (campos,
  tabelas de dados e `.selectable` continuam); cursor de seta nos botões; barras de rolagem de 12 px quadradas; sem menu do navegador (exceto
  em campos de texto), sem arrastar imagem, sem zoom da página (Ctrl+roda/+/−) fora do desenho e sem Ctrl+A de página.
- **Painéis móveis** (`dockLayout.ts`, `Dock.tsx`, `PanelHead.tsx`, `dockDrag.ts`, `dockDragSession.ts`): Propriedades e Navegador vão para
  qualquer lado, juntos ou separados, arrastando o cabeçalho (ou Alt+←/→). A sessão de arrasto é imperativa: mede os retângulos uma vez,
  move o fantasma (miniatura do painel) por `transform` em requestAnimationFrame e só troca a prévia quando a zona muda. **A prévia é o
  retângulo exato** que o painel terá ao soltar (`previewRect`), e a zona de acerto é a borda de 25% do workspace (não desenhada). O gesto
  captura o ponteiro já no clique: movimento rápido que sai do cabeçalho antes dos 5 px não perde o arrasto. Nós abertos do navegador
  sobrevivem ao painel mudar de lado.
- **Menu de botão direito** (`contextMenu.ts`, `PopupMenu.tsx`, `useCanvasContextMenu.ts`, `docs/paridade/menu-contexto.md`): planta, corte e 3D,
  com e sem seleção e durante ferramenta de criação, como o Revit (Repetir, Comandos recentes, Selecionar anterior, zoom, Criar semelhante,
  Selecionar todas as instâncias, Excluir, Navegador, Propriedades). O botão direito não cancela mais a ferramenta; "Cancelar" está no menu.
  Itens inexistentes aparecem esmaecidos. **Barra de espaço repete o último comando** só em Selecionar e ao soltar sem arrasto (pan e o espaço
  da parede ficam como antes).

## Pendências conhecidas

Painéis das abas vazias têm nomes aproximados; botões `soon` aguardam as ferramentas; roda de navegação, caminho do sol, região de corte e
ocultar/isolar temporário não existem; o e2e foi ajustado nos seletores mas não foi rodado (precisa de Chromium Linux).
