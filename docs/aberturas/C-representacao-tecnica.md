# C · Representação técnica de aberturas (planta, corte, elevação e o "X")

Data da pesquisa: 2026-10-22 (revisão desta data sobre o rascunho anterior, que não havia sido conferido na web).
Escopo: **como** o Revit, o ArchiCAD e a norma brasileira desenham portas e janelas em planta, corte e elevação, e
**onde** aparece o "X" ligando vértices. Complementa `A-pesquisa.md` (valores e peças) e `B-estado-atual.md`
(o que o Hestia faz hoje).

## 0. Acesso e marcações

- **[DOC]** = página oficial lida nesta rodada (WebFetch), com URL e data. **[SEC]** = fórum, tutorial, blog, concurso,
  ou trecho de busca (não lido na íntegra). **[INFERIDO]** = dedução a partir de fontes parciais ou da prática corrente.
  **[NÃO ENCONTRADO]** = não achei fonte; não preenchi regra.
- Autodesk `help.autodesk.com/cloudhelp` foi lida nesta rodada. Fóruns Autodesk, AUGI e Arkance responderam **403**
  ao WebFetch; usei só o trecho da busca (marcado [SEC]). A ABNT NBR 6492 é paga: não consegui o texto. Um PDF da
  edição de 1994 (PUCGO) veio como binário ilegível.

## 1. Em planta

### 1.1 Porta

| Item | Convenção | Fonte |
|---|---|---|
| Folha de giro | Segmento de comprimento igual à largura livre, origem na dobradiça; traço mais forte que o arco | [INFERIDO; prática corrente; o Hestia já faz em `openingSymbol.ts`] |
| Arco de giro | Arco de 90° com raio = largura, da ponta da folha até a ombreira oposta; traço fino | [INFERIDO; o Hestia já faz] |
| Porta dupla | Duas folhas de W/2, dobradiças nas ombreiras, dois arcos que se encontram no centro | [SEC; IFSC/PBA 2009 em `A-pesquisa.md` §3] |
| Porta pivotante | Eixo + folha e dois arcos até as ombreiras; posição do eixo W/4 é **provisória** | [NÃO ENCONTRADO]; decisão 0017 §8 |
| Porta de correr | Duas folhas em faces opostas com sobreposição + seta de deslizamento | [SEC; `A-pesquisa.md` §1] |
| Batente/ombreiras | A linha da parede termina no vão; o batente só aparece no nível fino se houver perfil | [INFERIDO] |
| Projeção acima do corte | Tracejada, para o que fica acima do corte (peitoril alto, verga) | [DOC] Autodesk "About the View Range" (repo `docs/05` §5); o Hestia já faz em `plan/view.ts` |
| Níveis de detalhe | Grosseiro sem símbolo; médio com; fino com tudo | [DOC] Graphisoft AC26 "Door/Window Settings and Opening": 2D `By MVO` / `Scale Sensitive` / escala fixa / `Off`; decisão 0015 §2 |
| Sentido de abertura (arco) | Qual lado é a dobradiça e para onde a folha abre | [NÃO ENCONTRADO] na NBR 6492 (texto pago; só questões de concurso [SEC]) |

**Revit (planta):** o símbolo de giro de porta é um arco de 2D simbólico, não geometria 3D [SEC; tutorial de família, busca].

### 1.2 Janela

| Item | Convenção | Fonte |
|---|---|---|
| Três linhas (peitoril/vidro) | Duas linhas nas faces do vão + a do vidro no plano médio (janela fixa) | [INFERIDO; o Hestia já faz] |
| Janela de correr | n folhas em linhas paralelas defasadas, ~50–60 % do vão | [SEC; o Hestia já faz com 60 %] |
| Maxim-ar / basculante | Arco tracejado (maxim-ar) / V no plano médio (basculante) | [INFERIDO; o Hestia já faz] |
| Janela alta (peitoril acima do corte) | Símbolo tracejado (projeção acima do corte) | [DOC] Autodesk View Range (repo `docs/05` §5) |

**Graphisoft AC26 [DOC]**, lido nesta sessão (URLs em §6):
- *Floor Plan Display of Door/Window: Symbolic vs. Projected*: `Symbolic` (padrão, símbolo independente do 3D),
  `Overhead All`, `Projected`, `Projected with Overhead`.
- *Door/Window Settings and Opening*: o Detail Level controla 2D e 3D; no 2D: `By MVO`, `Scale Sensitive`, escala fixa ou `Off`.
- *Floor Plan and Section Tab Page*: `Show Reveal on Symbol`, `Wall Contour Lines`, e pens de **cut / uncut / overhead**.

**Consequência:** o Hestia desenha sempre o modo `Symbolic` (decisão 0017 §8). O `Overhead` do ArchiCAD equivale à
projeção acima do corte; `plan/view.ts` já separa corte × projeção.

## 2. Em elevação e corte

| Item | Convenção | Fonte |
|---|---|---|
| Contorno do vão | Retângulo com largura × altura do tipo | [INFERIDO; o Hestia já faz] |
| Batente / caixilho | Perfil (ombreiras, verga, soleira) com `frameWidth`; no corte, `frameDepth` | [DOC] Graphisoft "Frame Style and Dimensions"; decisão 0017 §6 |
| Vidro | Face interna do caixilho; no corte, faixa de `glassThickness` | [INFERIDO; decisão 0017 §6] |
| Folha em corte | Só aparece se o plano a atravessa; fechada preenche o vão | [INFERIDO] |
| Símbolo de giro em elevação | No Revit, é **linha simbólica desenhada pelo usuário na família** para representar o giro em elevação | [DOC] Autodesk "About Creating 2D Geometry" (https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-4949A893-E556-4426-AE1D-0BC3C90BF672.htm, lido 2026-10-22): "Symbolic lines are not part of the actual geometry of the family." e "Example: You might sketch symbolic lines in an elevation view to represent a door swing." |
| Visibilidade da linha simbólica | Só aparece paralela à vista em que foi desenhada | [DOC] mesma página: "Symbolic lines are visible parallel to the view in which you sketch them." |
| Tracejado × contínuo (sentido de abertura) | Tracejado = abre para um lado; contínuo = para o outro | **[NÃO ENCONTRADO]** em fonte oficial. Forum e tutorial [SEC] dizem apenas que o giro em planta fica na subcategoria "Plan Swing (projection)" e que o tracejado de elevação do template métrico do Revit é problemático |
| Vértice do giro | Lado da dobradiça (diagonal do trinco à dobradiça) | [INFERIDO; prática corrente; o Hestia já faz 1 diagonal] |
| Seta de correr | Seta horizontal no centro do vão | [INFERIDO; o Hestia já faz] |

## 3. O "X" (diagonais ligando vértices)

**Correção do rascunho anterior:** o Revit **não cria o X sozinho**. O X é uma linha simbólica desenhada pelo usuário.

| Caso | O que a fonte diz | Fonte |
|---|---|---|
| **(i) Revit Shaft Opening** (abertura em piso/laje/telhado) | Ao sketchar o vão, o passo de **linhas simbólicas é opcional** ("If desired, add symbolic lines to the opening"). As linhas simbólicas ficam visíveis em **todos os níveis** que o shaft atravessa. A página não diz que o X é automático | [DOC] Autodesk "Cut a Shaft Opening" (https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-ArchDes/files/GUID-FA0CF7B6-D3E1-4F58-AE02-A19457BBCD02.htm, lido 2026-10-22) |
| (i) Forma do X | Diagonais ligando vértices opostos: a forma não é dita na página da Autodesk | [SEC] fórum AUGI (t=48399, 2006, em trecho de busca): o X de shaft aparece em RCP mesmo com a base do vão acima do forro |
| (i) Limitação | A ferramenta Shaft Opening **não gera** linhas simbólicas; o recomendado é família baseada em face com linhas simbólicas | [SEC] Arkance "Revit Tip – Cutting holes into slabs and walls" (trecho de busca) |
| **(ii) Revit Wall Opening** (vão em parede sem esquadria) | **Não achei** página oficial que diga que o Wall Opening desenha X. Fórum: vãos de parede não são filtráveis por "View Filter" sem geometria ou linha própria | **[NÃO ENCONTRADO]** (Wall Opening) · [SEC] fórum Autodesk "Show object as hidden lines" |
| **(iii) ArchiCAD "Opening"** | Símbolos de abertura em planta; na versão 23 não aparecem em corte/elevação. Um "X" de penetração em concreto em elevação é **rótulo personalizado** de usuário, não símbolo nativo | [SEC] Graphisoft AC23 e Community "Opening-Shape" (trechos de busca); [INFERIDO] que AC26 segue igual |
| (iv) Janela fixa / vão livre | Janela fixa tem as "3 linhas". O X é reservado ao vão **sem quadro** | [INFERIDO] |

**Conclusão:** o X é um **símbolo de vão sem esquadria** (furo em piso/laje/telhado e vão livre em parede), desenhado
como contorno + 2 diagonais ligando os vértices opostos. Ele é **opcional** no Revit (linha simbólica do usuário).
Não é o símbolo de porta/janela com folha (esses têm arco, seta ou V). **O traço exato (peso e tracejado) do X não tem fonte
oficial: [NÃO ENCONTRADO].**

## 4. O que ficou sem fonte e o que o Hestia decide (decisão 0024)

1. **Tracejado × contínuo do giro em elevação.** [NÃO ENCONTRADO] na NBR 6492 e na Autodesk. Convenção própria:
   tracejado = abre para o observador; contínuo = para o lado oposto; sem lado resolvível, tracejado.
2. **Traço do X.** [NÃO ENCONTRADO]. Convenção própria: contorno do furo + 2 diagonais; peso da categoria de projeção;
   tracejado só quando o vão está acima do corte.
3. **Janela de giro (side-hung).** Não é família do Hestia (`OPENING_FAMILIES`). O "giro" cai no maxim-ar (`casement`)
   e no basculante (`tilt`), que já têm arco/V.
4. **Porta pivotante em elevação.** [NÃO ENCONTRADO]; mantém a convenção do eixo (W/4) da planta, como na decisão 0017 §8.
5. **X opcional.** Como no Revit, o X é uma opção de família/abertura, não automático, para não mudar a planta de quem não pede.

## 5. Tabela resumo convenção × vista × fonte

| Convenção | Planta | Corte/Elevação | Fonte |
|---|---|---|---|
| Porta de giro (folha + arco 90°) | símbolo `swing` | diagonal da dobradiça ao trinco | [INFERIDO] |
| Porta dupla | 2 folhas + 2 arcos ao centro | 2 diagonais das ombreiras ao centro | [SEC/INFERIDO] |
| Porta de correr | 2 folhas + seta | seta | [SEC/INFERIDO] |
| Porta pivotante | eixo + 2 arcos | eixo + folha | [NÃO ENCONTRADO] (eixo provisório) |
| Giro em elevação (Revit) | — | linha simbólica da família, visível só na vista desenhada | [DOC] Autodesk 2016 |
| Janela fixa | 3 linhas | caixilho + vidro, sem símbolo | [INFERIDO] |
| Janela maxim-ar/basculante | arco tracejado / V | arco tracejado | [INFERIDO] |
| Janela de correr | n folhas + seta | seta | [SEC/INFERIDO] |
| Vão livre em parede (sem esquadria) | **X** (contorno + 2 diagonais) | **X** | [NÃO ENCONTRADO] no Revit (Wall Opening); [INFERIDO] |
| Furo em piso/laje/telhado (shaft) | **X** opcional | **X** opcional, em todos os níveis | [DOC] Autodesk 2024 (opcional); forma [SEC] |
| Projeção acima do corte | tracejado | — | [DOC] Autodesk View Range |
| Nível de detalhe | grosso sem símbolo; médio/fino com | `By MVO` / `Scale Sensitive` / `Off` | [DOC] Graphisoft AC26 |

## 6. Fontes lidas nesta rodada (2026-10-22)

- Autodesk, *Cut a Shaft Opening* (RevitLT 2024): https://help.autodesk.com/cloudhelp/2024/ENU/RevitLT-ArchDes/files/GUID-FA0CF7B6-D3E1-4F58-AE02-A19457BBCD02.htm
- Autodesk, *About Creating 2D Geometry* (Revit 2016): https://help.autodesk.com/cloudhelp/2016/ENU/Revit-Model/files/GUID-4949A893-E556-4426-AE1D-0BC3C90BF672.htm
- Graphisoft AC26, *Symbolic vs. Projected*: https://help.graphisoft.com/AC/26/INT/_AC26_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-18.htm
- Graphisoft AC26, *Door/Window Settings and Opening*: https://help.graphisoft.com/AC/26/INT/_AC26_Help/150-1_DoorWindowCustomSettings/150-1_DoorWindowCustomSettings-4.htm
- Graphisoft AC26, *Floor Plan and Section Tab Page*: https://help.graphisoft.com/AC/26/INT/_AC26_Help/150-1_DoorWindowCustomSettings/150-1_DoorWindowCustomSettings-31.htm
- Graphisoft AC26, *About Roofs* (furo em telhado, Skylight): https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-60.htm
- [SEC, só trecho de busca] AUGI t=48399 e t=113866; Autodesk forums "Door Elevation Swing Lines" e "Lines on Windows"; Arkance "Revit Tip – Cutting holes into slabs and walls"; Community Graphisoft "Opening-Shape"; ABNT NBR 6492 (texto não acessado).
