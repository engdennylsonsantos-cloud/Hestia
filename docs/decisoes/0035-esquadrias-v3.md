# Decisão 0035 · Esquadrias v3 (batente, acabamento, alizar, planta, basculante, catálogo brasileiro)

Decidido em 2026-10-26 com o dono, após a revisão da v2. Especificação: [E3](../aberturas/E3-spec-correcoes-v3.md).
Pesquisa do ArchiCAD (abas, opções e lógica de modelagem) e do catálogo brasileiro: `docs/aberturas/archicad/`.

1. O batente é **uma peça** com seção em L (rebaixo), não duas caixas; a profundidade do batente é configurável e, por padrão,
   **fica no núcleo da parede** (`frameDepthMode: 'core'`, decisão do dono). Opções por tipo: `'wall'` (espessura total da parede
   acabada, como o "Frame Thickness = Wall Thickness" do ArchiCAD) e `'fixed'` (valor de `frameDepth`).
2. O acabamento da parede **encosta no batente** (sem retorno por cima dele); retorno explícito é recortado pelo batente.
   Retorno com batente é **opt-in** (como o "Wrapping at Inserts" do Revit): só com `closure` explícito no tipo. Sem
   porta/janela (vão livre ou `block`) vale o `wrapInserts` da parede. **Alizar e retorno são exclusivos** (como no
   ArchiCAD): com `casing` o retorno é `none`, mesmo com `closure` explícito (aviso em `openingTypeWarning`). A pegada
   do batente que recorta o retorno usa a mesma seção da peça `jamb` (`jambSection`, uma só fonte da geometria).
3. O alizar assenta sobre a face acabada, cobre a junta e é uma silhueta única por face.
4. A folha articula pela face oposta ao lado de abertura: aberta ou fechada nunca se sobrepõe ao batente nem a si mesma.
5. Em planta, porta de giro/dupla/pivotante/vai-e-vem mostra **só a folha aberta** (com o arco).
6. Basculante = eixo horizontal central ou excêntrico (`tiltAxis`); bandeira de janela passa a ser uma faixa fixa (ou maxim-ar)
   acima das folhas.
7. Opções por família em tabela (`openingOptionSupport`); o diálogo mostra só o que se aplica e tudo o que se aplica funciona.
8. Catálogo de tipos brasileiros pré-cadastrados e configuráveis (madeira, madeira e vidro, alumínio, vidro temperado...).
