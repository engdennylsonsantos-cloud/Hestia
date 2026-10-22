# C · Representação técnica de aberturas (planta, corte, elevação e o "X")

Data da pesquisa: 2026-10-22. Escopo: **como** o Revit, o ArchiCAD e a norma brasileira desenham portas e janelas em
planta baixa, corte e elevação, e **onde** aparece o "X" ligando vértices. Complementa `A-pesquisa.md` (valores e peças)
e `B-estado-atual.md` (o que o Hestia faz hoje). Sem alteração de código nesta etapa.

## 0. Limite de acesso e marcações

Nesta rodada **consegui ler** páginas do ArchiCAD 26 (ajuda Graphisoft) diretamente pelo WebFetch; as da Autodesk
(`help.autodesk.com`) e a ABNT continuam bloqueadas (403 / sem DNS), como registrado em `A-pesquisa.md` §0. Por isso:

- **[DOC]** = lida integralmente nesta sessão (Graphisoft AC26) ou conhecida por trecho de busca.
- **[SEC]** = tutorial, fórum, blog, material de disciplina. Não é fonte oficial.
- **[INFERIDO]** = dedução minha a partir de fontes parciais ou da prática corrente.
- **[NÃO ENCONTRADO]** = não achei fonte; não preenchi com número/regra. O que implementar por convenção própria fica dito.

## 1. Em planta

### 1.1 Porta

| Item | Convenção | Fonte |
|---|---|---|
| Folha de giro | Segmento de comprimento igual à largura livre, origem na dobradiça; traço mais forte que o arco | [INFERIDO; prática corrente; o Hestia já faz em `openingSymbol.ts`] |
| Arco de giro | Arco de 90° com raio = largura, do fim da folha até a ombreira oposta; traço fino | [INFERIDO; o Hestia já faz] |
| Porta dupla | Duas folhas de W/2, dobradiças nas ombreiras, dois arcos que se encontram no centro | [SEC; IFSC/PBA 2009 em `A-pesquisa.md` §3] |
| Porta pivotante | Eixo + folha e dois arcos até as duas ombreiras; a posição do eixo segue **provisória** (W/4) — sem fonte oficial | [NÃO ENCONTRADO] para o eixo; decisão 0017 §8 |
| Porta de correr | Duas folhas em faces opostas com sobreposição + seta de deslizamento | [SEC; fonte estrangeira em `A-pesquisa.md` §1] |
| Batente/ombreiras | A linha da parede termina no vão; o batente só aparece no nível fino se houver perfil | [INFERIDO] |
| Projeção acima do corte | Tracejada (elemento entre o topo e o corte não é "cortado": peitoril alto, verga) | [DOC] Revit "About the View Range" (docs/05 §5); o Hestia já faz em `plan/view.ts` |
| Níveis de detalhe | Grosseiro sem símbolo; médio com símbolo; fino com tudo | [DOC] ArchiCAD AC26: "2D Detail Level: By MVO / Scale Sensitive / fixo / Off" (abaixo); decisão 0015 §2 |

### 1.2 Janela

| Item | Convenção | Fonte |
|---|---|---|
| Três linhas (peitoril/vidro) | Duas linhas nas faces do vão + a do vidro no plano médio (janela fixa) | [INFERIDO; o Hestia já faz] |
| Janela de correr | n folhas em linhas paralelas defasadas, cada uma ~50–60 % do vão | [SEC; o Hestia já faz com 60 %] |
| Maxim-ar / basculante | Arco tracejado (maxim-ar) / V no plano médio (basculante) | [INFERIDO; o Hestia já faz] |
| Janela alta (peitoril acima do corte) | Símbolo tracejado ("projeção acima do corte") | [DOC] Revit View Range (docs/05 §5) |

**Fonte lida nesta sessão ([DOC], Graphisoft AC26, 2026-10-22):**
- *Floor Plan Display of Door/Window: Symbolic vs. Projected* — `Symbolic` (padrão: símbolo independente do 3D),
  `Overhead All`, `Projected` (parte cortada + a de baixo), `Projected with Overhead`.
  `https://help.graphisoft.com/AC/26/INT/_AC26_Help/150_UserInterfaceToolSettings/150_UserInterfaceToolSettings-18.htm`
- *Door/Window Settings and Opening* — o **Detail Level** controla 2D e 3D; no 2D: `By MVO`, `Scale Sensitive`
  (pela escala do projeto), escala fixa, ou `Off` (nenhum símbolo 2D).
  `https://help.graphisoft.com/AC/26/INT/_AC26_Help/150-1_DoorWindowCustomSettings/150-1_DoorWindowCustomSettings-4.htm`
- *Floor Plan and Section Tab Page* — parâmetros 2D por componente, `Show Reveal on Symbol` (escala limite do peitoril
  no símbolo), `Wall Contour Lines` (linhas de contorno da parede no vão, visível/oculta) e linhas/pens de **cut/uncut/overhead**.
  `https://help.graphisoft.com/AC/26/INT/_AC26_Help/150-1_DoorWindowCustomSettings/150-1_DoorWindowCustomSettings-31.htm`

**Consequência:** o Hestia sempre desenha o modo `Symbolic` (decisão 0017 §8). O "Overhead" do ArchiCAD equivale à
projeção acima do corte do Hestia; as linhas `cut/uncut/overhead` são o que `plan/view.ts` já separa (corte × projeção).

## 2. Em elevação e corte

| Item | Convenção | Fonte |
|---|---|---|
| Contorno do vão | Retângulo com a largura × altura do tipo | [INFERIDO; o Hestia já faz] |
| Batente / caixilho | Perfil (ombreiras, verga, soleira) com `frameWidth`; no corte transversal, `frameDepth` | [DOC] ArchiCAD "Frame Style and Dimensions"; decisão 0017 §6 |
| Vidro | Região interna do caixilho (face) / faixa de `glassThickness` (corte) | [INFERIDO; decisão 0017 §6] |
| Folha em corte | Só aparece se o plano a atravessa; fechada preenche o vão | [INFERIDO; o Hestia desenha fechada] |
| Símbolo de giro (abertura) | Linha diagonal do canto da **dobradiça** (vértice) ao canto oposto (trinco) | [INFERIDO; prática corrente; o Hestia já faz 1 diagonal] |
| Tracejado × contínuo | **Tracejado** = a folha abre para o observador; **contínuo** = abre para o lado oposto | [NÃO ENCONTRADO] em fonte oficial/norma (ver §4) |
| Seta de correr | Seta horizontal no centro do vão | [INFERIDO; o Hestia já faz] |

O "símbolo de abertura" em elevação, com vértice no lado da dobradiça, é a convenção mais citada de desenho
arquitetônico (a diagonal do trinco à dobradiça), mas **não achei o texto da NBR 6492:2021 nem a página do Revit** que
fixe a regra tracejado/contínuo. Marcação honesta: **[NÃO ENCONTRADO]** para a regra exata; a implementação (ETAPA 3)
usa convenção própria documentada na decisão 0024.

## 3. O "X" (diagonais ligando vértices)

O pedido do dono é o "X" que liga vértices opostos. Onde ele aparece de verdade:

| Caso | Onde | Quando | Como | Fonte |
|---|---|---|---|---|
| **(i) Abertura sem esquadria em piso/laje/telhado** (Revit: *Shaft Opening* / *Vertical Opening*; claraboia) | Planta (e elevação do shaft) | Vista em que o elemento é cortado; categoria da abertura | Contorno do furo + **2 diagonais** ligando os vértices opostos | [INFERIDO; prática corrente do Revit/ArchiCAD "Opening"] |
| **(ii) Vão em parede sem folha/quadro** (Revit: *Wall Opening*; ArchiCAD: *Opening*; Hestia: vão livre `leaves = 0`) | Planta e elevação | O vão aparece como furo na parede, sem símbolo de esquadria | Contorno do vão + **2 diagonais** | [INFERIDO; prática corrente; o Hestia hoje desenha só a soleira tracejada] |
| **(iii) Planta de fôrma/estrutura** | Planta estrutural | Vão em laje sem esquadria | Contorno + X | [SEC; fora do escopo do Hestia v1] |
| **(iv) Janela fixa / "vão livre"** | — | — | **Não é o X**: janela fixa tem as "3 linhas"; o X é reservado a vãos SEM quadro | [INFERIDO] |

**Conclusão:** o X é o símbolo de **vão sem esquadria** (furo em piso/laje/telhado e vão livre em parede), desenhado
como **contorno + 2 diagonais exatas ligando os vértices opostos**. Não é o símbolo de porta/janela com folha (esses
têm arco/seta/V). Não achei a fonte oficial do traço (peso/tracejado) do X — **[NÃO ENCONTRADO]** —; a implementação usa
o peso de projeção da categoria e tracejado quando o vão está **acima do corte** (projeção), contínuo quando cortado.

Fonte de apoio lida nesta sessão ([DOC], Graphisoft AC26): *About Roofs* confirma que a projeção de telhado em planta
mostra "the edge of the hole in a pitched roof plane" e que telhados têm a ferramenta **Skylight** (abertura em telhado),
coerente com "furo = abertura".
`https://help.graphisoft.com/AC/26/INT/_AC26_Help/040_ElementsVB/040_ElementsVB-60.htm`

## 4. O que ficou sem fonte e o que o Hestia decide

1. **Regra tracejado × contínuo do símbolo de giro em elevação** — [NÃO ENCONTRADO]. Convenção própria (decisão 0024):
   tracejado = abre para o observador; contínuo = abre para o lado oposto; quando o lado não é resolvível, tracejado.
2. **Peso/tracejado do X** — [NÃO ENCONTRADO]. Convenção própria (decisão 0024): contorno do furo + 2 diagonais; peso de
   projeção da categoria; tracejado só quando o vão está acima do corte.
3. **Janela de giro (side-hung)** — não existe como família no Hestia (`OPENING_FAMILIES`); a "janela de giro" do pedido
   cai nas famílias maxim-ar (`casement`, topo) e basculante (`tilt`, base), que já têm arco/V.
4. **Porta pivotante em elevação** — [NÃO ENCONTRADO]; mantém a convenção do eixo (W/4) da planta, como na decisão 0017 §8.

## 5. Tabela resumo convenção × vista × fonte

| Convenção | Planta | Corte/Elevação | Fonte |
|---|---|---|---|
| Porta de giro (folha + arco 90°) | símbolo `swing` | diagonal da dobradiça ao trinco | [INFERIDO] |
| Porta dupla | 2 folhas + 2 arcos ao centro | 2 diagonais das ombreiras ao centro | [SEC/INFERIDO] |
| Porta de correr | 2 folhas + seta | seta | [SEC/INFERIDO] |
| Porta pivotante | eixo + 2 arcos | eixo + folha | [NÃO ENCONTRADO] (eixo provisório) |
| Janela fixa | 3 linhas | caixilho + vidro, sem símbolo | [INFERIDO] |
| Janela maxim-ar/basculante | arco tracejado / V | arco tracejado | [INFERIDO] |
| Janela de correr | n folhas + seta | seta | [SEC/INFERIDO] |
| Vão livre (sem esquadria) | **X** (contorno + 2 diagonais) + soleira | **X** | [INFERIDO] |
| Furo em piso/laje/telhado | **X** | (fora do corte de parede) | [INFERIDO] |
| Projeção acima do corte | tracejado | — | [DOC] Revit View Range |
| Nível de detalhe | grosso sem símbolo; médio/fino com | `By MVO`/`Scale Sensitive`/`Off` | [DOC] ArchiCAD AC26 |
