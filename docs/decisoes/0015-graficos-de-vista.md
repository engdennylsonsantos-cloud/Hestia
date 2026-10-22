# Decisão 0015 · Gráficos de vista (estilo visual, pesos de linha, visibilidade, detalhe)

Fontes: docs/visualizacao/A-pesquisa.md, B-estado-atual.md e C-relatorio-pesquisa.md (Revit 2026, Archicad 30, NBR 16861:2020, NBR 6492:2021).
Decidido em 2026-10-21 com o dono ("seguir dessa forma"): estilo visual por vista; pesos de linha por categoria e por escala; visibilidade e
gráficos por categoria; nível de detalhe por vista; exibição parcial de estrutura; luz e fundo do 3D.

## 1 · Modelo (tudo opcional, sem migração; contrato em `packages/model/src/graphics.ts`)
- `Project.graphics?: ProjectGraphics` — tabela de pesos (16 × 3 colunas mm de papel, padrão = template do Revit `[SECUNDÁRIO]`, documento C §(c)),
  estilo de linha por categoria (`cutWeight`/`projectionWeight`, índices 1–16 do Revit) e limites de detalhe por escala.
- `Level.graphics?: ViewGraphics` — uma planta por nível (como o intervalo de vista, 0013): escala (denominador, padrão 100), detalhe (`byScale` ou
  coarse/medium/fine), estilo visual (wireframe | hiddenLine | shaded), exibição parcial de estrutura, substituições por categoria.
- `Project.view3d?: View3DSettings` — a vista 3D: estilo visual (os 5), parcial, substituições, sombras, arestas, sol (azimute e elevação) e fundo.
  Sombras e arestas deixam de ser só estado de tela e passam a ser da vista 3D (persistem no projeto; o alternador da faixa grava por comando).
- Comandos com desfazer/refazer: `setProjectGraphics(patch)`, `setLevelGraphics(levelId, patch)`, `setView3D(patch)`; validação de intervalos (peso 1–16,
  escala > 0, transparência 0–1, cor #rrggbb). Leitura sempre com padrão: `graphicsOf(project)`, `levelGraphicsOf(project, levelId)`, `view3dOf(project)`
  mesclam o campo salvo com os padrões (qualquer subconjunto salvo vale).

## 2 · Regras
1. **Largura da linha** = `lineWeightMm(tabela, peso, escala)`: peso 1–16 na coluna 1:50 (escala ≤ 50), 1:100 (≤ 100) ou 1:200 (> 100); em pixels de tela
   `paperMmToPx(mm, zoom, escala)` = `mm·zoom·escala/1000` (mínimo 1 px). Peso de corte para o contorno cortado, de projeção para o que está acima/abaixo
   do corte (decisão 0013). Pesos padrão por categoria (escolha do Hestia, NBR 6492 A.1: contorno cortado com hachura = larga; projeção, abertura e escada
   simplificadas = larga/estreita): parede 5/2, porta e janela 3/2, piso 4/1, laje 4/1, telhado 4/2, escada 4/2 (laje, telhado e escada calibrados para manter a planta atual a ~45 px/m em 1:100; com zoom fixo, 1:50 fica mais fino em px que 1:100: a espessura é em papel).
2. **Detalhe** (`detailOf`): fino até 1:50, médio até 1:200, grosso acima (escolha do Hestia, editável; o Revit não publica o arranjo de fábrica `[NÃO
   ENCONTRADO]`). Efeito: grosso = só contornos das paredes (sem camadas), médio = camadas principais e símbolos de abertura, fino = todas as camadas,
   numeração de degraus e rótulos. O campo `Project.settings.detail` continua valendo para níveis sem gráficos salvos (padrão do projeto); só quando o nível tem `Level.graphics` o detalhe é o da vista (`byScale` ou fixo).
3. **Estilo visual (planta):** hiddenLine = aparência atual (preenchimento do papel + contornos); wireframe = só contornos, sem preenchimento nem hachura;
   shaded = preenchimento pela cor do material (opaco) e contornos. **3D:** wireframe = só arestas; hiddenLine = faces brancas com arestas; shaded = cores do
   material com luz simples; consistentColors = cores do material sem iluminação; realistic = como hoje (luz solar, sombras opcionais, brilho). Ray Trace não
   existe no Revit 2026 e não é objetivo. Sem texturas nesta etapa.
4. **Substituições por categoria:** `visible=false` oculta a categoria na vista (planta e 3D); `transparency` afeta o 3D e o preenchimento da planta;
   `halftone` clareia; pesos e cor substituem os do projeto só na vista. Aviso nas propriedades quando uma categoria está oculta (como o aviso do intervalo de vista).
5. **Exibição parcial de estrutura (planta e 3D, paredes/pisos/lajes/telhados):** `entire` = todas as camadas; `noFinishes` = sem as camadas de acabamento
   (função de acabamento do tipo); `coreOnly` = só a camada de núcleo/estrutura. Não altera o modelo nem os quantitativos.
6. **3D:** luz solar por azimute/elevação, fundo por cor (padrão pelo tema), `edges` com a espessura única de hoje (silhueta com peso configurável fica
   para depois).
7. **DXF:** cada camada recebe a largura de linha do peso da categoria na escala da vista (código de grupo 370, centésimos de mm), em vez de ignorá-la.
8. **Hachura `solid`** passa a ter ramo de desenho (hoje não aparece), tanto na planta por CPU quanto por GPU.
9. **Ordem de desenho da planta na GPU:** todo material da planta é transparente, para que a ordem seja só a da lista de desenho (`renderOrder`), como no CPU. Antes, a hachura (com textura) virava transparente e o three.js a desenhava depois das paredes opacas: a hachura da laje saía por cima da parede. A regressão com GPU (`tests/e2e/visual-regression-gpu.mjs`, seis casos, baselines em `tests/e2e/baseline-gpu/`) cobre o caso; a regressão CPU segue como referência de pixel.

## 3 · Interface
- Propriedades da vista (planta): Escala, Detalhe, Estilo visual, Exibição parcial de estrutura, botão "Visibilidade e gráficos…" (diálogo com a tabela
  categoria × visível/transparência/meio-tom/peso de corte/peso de projeção/cor), "Restaurar padrão".
- Propriedades da vista 3D (nada selecionado no 3D): Estilo visual, parcial, visibilidade e gráficos, sombras, arestas, sol, fundo.
- Diálogo de projeto "Pesos de linha" (Gerenciar): tabela 16 × 3 editável, pesos por categoria e limites de detalhe.

## 6 · Linhas finas por vista (só na tela)
- `ViewGraphics.thinLines?: boolean` (planta do nível e `Project.sectionGraphics`; padrão false; sem migração). Comandos `setLevelGraphics` e `setSectionGraphics`, com desfazer; botão "Linhas finas" na aba Vista (planta e corte; desabilitado no 3D e na prancha) e caixa "Linhas finas (só na tela)" nas propriedades da vista.
- Com o modo ligado, a tela desenha os traços da vista com 1 px (`thinStrokes`, opção `thinLines` de `buildPlanDrawList` e `buildSectionDrawList`). Seleção, cursor, cotas temporárias e guias mantêm a largura própria. Hachuras e preenchimentos não mudam.
- A plotagem nunca usa o modo: a prancha, o PDF e o DXF não passam a opção e seguem com os pesos da tabela (código 370 por camada no DXF). A opção é de entrada: as funções não leem o modelo.

## 4 · Fora desta etapa
Modelos de vista (view templates), filtros por regra, texturas e padrões de superfície, silhueta com peso próprio, motor Vectorial × hardware, névoa de
profundidade, planta de forro, regras de substituição por parâmetro (ArchiCAD GOR).

## 5 · Critérios de aceitação
- Mudar a escala de 1:100 para 1:50 engrossa as linhas conforme a tabela (parede cortada: 0,5 → 0,7 mm de papel) e o detalhe passa a fino; testes de planta
  verificam `widthPx` por categoria e escala.
- Estilo hiddenLine da planta é pixel-compatível com o atual (mesmas imagens de referência do `test:visual`).
- Cada estilo 3D tem teste de material/luz e imagem de referência.
- Ocultar a categoria "janela" some o símbolo e o vão na planta e as peças no 3D; transparência e meio-tom afetam o desenho.
- `coreOnly` mostra só o núcleo nas paredes (planta e 3D), `noFinishes` remove o acabamento.
- DXF contém o código 370 por camada coerente com a escala.
