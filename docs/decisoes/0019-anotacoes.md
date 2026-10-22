# Decisão 0019 · Anotações da planta: cotas permanentes e textos

Decidido em 2026-10-22 para a tarefa I1. Referências de comportamento: Revit (*Aligned Dimension*, *Text*, cota
que acompanha a parede) e ArchiCAD (*Dimension*, *Text*). Até aqui a única cota era a temporária ao selecionar
(`selectTool`, comprimento da parede); esta decisão cria cotas e textos que ficam no desenho.

## 1 · Modelo

- Ficam em cada nível, como campos **opcionais** de `Level`: `dimensions?: Dimension[]` e `texts?: TextNote[]`.
  Sem migração e sem mudança de `SCHEMA_VERSION`: arquivo antigo não tem o campo e lê como vazio.
- `Dimension { id, a, b, offset, refs? }`: cota alinhada entre `a` e `b`; `offset` (m) é a distância da linha de
  cota ao segmento, para o lado esquerdo de `a→b` (negativo, para o direito). `refs.a` / `refs.b` apontam para
  `{ wallId, end }`: a extremidade acompanha a extremidade da parede. Parede apagada: a cota vira livre no ponto
  guardado.
- `TextNote { id, at, text, height, rotation }`: `at` é o centro do texto; `height` em mm de papel (padrão 2,5);
  `rotation` em graus.
- Valor da cota: distância entre os pontos resolvidos, arredondada a 1 mm e mostrada com duas casas em metros
  ("3,50 m"). Não há preferência de unidade (cm ou m) no projeto para reaproveitar: fica em metros.
- Comandos com desfazer: `addDimension`, `updateDimension`, `removeDimension`, `addText`, `updateText`,
  `removeText` (`packages/model/src/annotations.ts`). Recusam com mensagem pt-BR e não mudam o projeto. Remover o
  nível leva as anotações dele, porque elas moram no próprio nível.
- Geometria única (`packages/model/src/dimension.ts`), usada pelo render, pela ferramenta e pelo DXF: folga da
  chamada 1,5 mm de papel, passagem além da linha 2 mm, marca a 45° de 1,4 mm de meia-largura, texto do valor de
  2,5 mm acima da linha, centrado e legível pela esquerda ou por baixo.

## 2 · Categoria 'anotação'

- `GraphicsCategory` ganha `annotation` (rótulo "Anotação"): peso de corte e de projeção 1/1, visível por padrão.
  Ocultá-la em Visibilidade da vista tira as cotas e os textos da planta e do DXF.

## 3 · Render e ferramentas

- Planta (`packages/render/src/plan/notes.ts`): traços em `StrokeOp` com a espessura de corte da categoria; o valor
  e os textos saem como `LabelOp` com `fontPx` (mm de papel × escala da vista), `rotation` e `center`. A rotina de
  rótulos é a de `tags.ts` (`noteLabel`); o DOM (`PlanLabels.tsx`) desenha sem caixa, na cor da tinta.
- Ferramenta **Cota** (`dimensionTool.ts`): clique em A, clique em B, depois no lado da linha (ou digite o
  deslocamento e Enter). Pontos sobre uma extremidade de parede ficam referenciados a ela
  (`endRefAt`). Captura e inferência de faces e extremos vêm do `infer` de sempre.
- Ferramenta **Texto** (`textTool.ts`): clique no centro, digite (aceita letras; `Tool.freeText`) e Enter.
- Atalhos: Cota **Y**, Texto **X**. Botões no grupo **Anotar** da aba Arquitetura.
- Seleção (`selectTool`): cota e texto são achados pelo cursor, por último, para não roubar o clique de um
  elemento. A alça da cota selecionada é o ponto médio da linha; arrastá-la muda o deslocamento.
- Mover e copiar (`MoveTool`): a seleção de anotações entra junto com os elementos. Mover tira as referências
  da cota (a posição passa a ser livre); copiar cria ids novos.
- Excluir (Delete): `deleteSelectionIn` (apps/web) separa anotações e elementos num único passo de desfazer.
- Propriedades (`AnnotationProps.tsx`): cota com valor (só leitura) e deslocamento; texto com conteúdo, altura em
  mm e rotação.

## 4 · DXF da planta

- Camada `COTAS`: linhas da cota (LINE, na largura de "anotação") e o valor (TEXT).
- Camada `TEXTOS`: textos livres (TEXT). Altura em metros de desenho, na escala da vista (2,5 mm × 1:100 = 0,25 m).
- Não entram no DXF de corte e elevação (`dxfSection`): as anotações são da planta.

## 5 · Fora desta rodada

- Cota de corte e de elevação; cota entre duas paredes sem referência ao ponto de face (só o ponto guardado).
- Editar o estilo do texto (fonte, negrito, caixa); textos em 3D.
- Pré-visualização da cota usa a escala aproximada da vista (1 mm de papel = 4 px); a cota gravada sai exata.
