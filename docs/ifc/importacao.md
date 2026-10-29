# Importação IFC

O Hestia lê IFC **de volta** para o modelo nativo: `packages/io/src/ifcImport/` (leitor STEP sem dependências), o
script `scripts/ifc-import.mts`, que roda fora da interface, e o worker `apps/web/src/editor/ifcWorker.ts`, que atende
o menu **Arquivo → Importar IFC…**. A exportação é o outro lado, na [decisão 0020](../decisoes/0020-ifc.md).

## 1 · Como rodar

```powershell
npx vite-node scripts/ifc-import.mts <arquivo.ifc> [saida.hestia.json]
```

- Sem o segundo argumento, a saída é `<nome-do-ifc>.hestia.json` no diretório atual.
- O relatório sai no terminal **e** ao lado da saída, em `<saida>.relatorio.json`.
- O script só lê o arquivo: não sobrescreve o IFC e não abre a interface. Sai com código 2 quando falta o argumento.
- A API é `importIfc(texto, base?)`; sem `base`, parte dos tipos padrão de `createEmptyProject()` e substitui
  elementos, níveis, vistas, pranchas e grades.

Exemplo com o fixture de parede e janela:

```powershell
npx vite-node scripts/ifc-import.mts tests/ifc/fixtures/parede-janela.ifc "$env:TEMP/parede-janela.json"
# IFC IFC4 → C:\Users\...\Temp\parede-janela.json
#   2 elemento(s) em 11 ms; 1 nível(is)
#   importado: {"paredes":1,"janelas":1}
#   ignorado:  {}
```

O tempo varia com a máquina; as contagens, não. Para medir a importação com mais cuidado (mediana de várias execuções,
RSS, triângulos dos genéricos e o sample grande do Revit), veja a [seção 9](#9--desempenho).

O formato do relatório:

```json
{
  "schema": "IFC2X3",
  "broken": 0,
  "levels": 2,
  "imported": { "paredes": 13, "portas": 5, "janelas": 11, "lajes": 3, "pisos": 1, "ambientes": 7, "objetos": 57 },
  "skipped": { "IFCFURNISHINGELEMENT": 12 },
  "approximate": {},
  "geometry": {},
  "generic": { "IFCBEAM": 51 },
  "warnings": []
}
```

- `broken`: entidades STEP que o tokenizador não conseguiu ler (o resto do arquivo continua).
- `imported`: contagem por categoria que virou elemento nativo (`objetos` = genéricos).
- `skipped`: contagem por **classe IFC** de produto que ficou de fora — sem malha legível ou tipo sem corpo.
- `approximate`: formas aproximadas (hull de malha) por categoria.
- `geometry`: geometria que o leitor não representou, por motivo (`corte-booleano-ignorado`, `extrusao-inclinada`).
- `generic`: objetos importados como `kind: 'generic'`, por classe IFC de origem.
- `warnings`: avisos em texto, no máximo 200 e sem repetição.

## 2 · O que o importador aceita

- **Texto STEP** (ISO 10303-21), o formato dos `.ifc`: `FILE_SCHEMA` `IFC2X3`, `IFC4`, `IFC4X3` e afins. Não há
  validação de schema: o cabeçalho só nomeia o schema no relatório.
- **Não** abre ifcXML, ifcZIP nem arquivos com codificação diferente de UTF-8.
- **Colocações**: cadeia de `IfcLocalPlacement` (produto → pavimento → prédio) e `IfcAxis2Placement2D/3D`.
  `IfcGridPlacement` não é resolvido: vale a origem do produto.
- **Geometria de corpo** (`Body`), nesta ordem de preferência:
  - `IfcExtrudedAreaSolid` com eixo de extrusão vertical → prisma (o caso de parede, piso, laje e forro);
  - `IfcMappedItem` (portas, janelas e blocos compartilhados), com a transformação aplicada;
  - `IfcBooleanResult`/`IfcBooleanClippingResult` → **só o primeiro operando** (o corte é perdido);
  - `IfcFacetedBrep`, `IfcFaceBasedSurfaceModel`, `IfcShellBasedSurfaceModel`, `IfcTriangulatedFaceSet` e
    `IfcPolygonalFaceSet` → malha; em planta vira o hull (aproximação);
  - perfis: retângulo (com cantos arredondados e vazado), círculo (cheio e vazado), elipse, arbitrário (com furos),
    trapézio, `IfcDerivedProfileDef`, `IfcCompositeProfileDef` e as seções I/U/L/T/Z/C (estas como caixa envolvente).
- **Curvas 2D**: polilinha, `IfcIndexedPolyCurve`, curva composta e `IfcTrimmedCurve` de reta ou de arco de círculo.
  Arcos são amostrados em cordas (32 segmentos por círculo cheio).
- **Representação `Axis`**: a polilinha do eixo é lida, mas quem define a parede é o corpo.
- **Propriedades e cor**: `IfcPropertySet`, `IfcElementQuantity` e o estilo de superfície do item de representação
  (seção 5). `IfcMaterial*` e as camadas do IFC continuam fora.

## 3 · O que vira elemento nativo

| IFC | Elemento do Hestia | Regras |
|---|---|---|
| `IfcWall` (StandardCase/ElementedCase) | **Parede** | O contorno em planta precisa caber em um retângulo que cubra ≥ 80% da área (chanfro pequeno passa; L e forma livre não). Comprimento e eixo vêm desse retângulo; espessura = largura do retângulo; base = `z0` do prisma; altura = `z1 − z0`. `id` = `w_<GlobalId>`. |
| `IfcDoor` | **Porta** (`kind: door`) | Exige `IfcRelVoidsElement` (vão → parede) e a parede importada. Largura e altura saem do corpo do **vão**, não do batente; peitoril = 0. `id` = `o_<GlobalId>`. |
| `IfcWindow` | **Janela** (`kind: window`) | Mesmo caminho da porta; peitoril = base do vão menos a base da parede, nunca negativo. |
| `IfcSlab` `FLOOR` | **Piso** | Contorno + furos do primeiro prisma; espessura = `z1 − z0`; `heightOffset` = topo menos a cota do nível (o nível é o mais próximo abaixo do topo). |
| `IfcSlab` `CEILING` | **Forro** | Mesmas regras do piso. |
| `IfcSlab` `ROOF`, `LANDING`, `BASESLAB`, `PAVEMENT` | **Laje** | Mesmas regras; o tipo de laje é criado com uma camada estrutural de concreto. |
| `IfcSlab` com outro `PredefinedType` (ou vazio) | **Piso** | O importador assume piso quando não reconhece o tipo. |
| `IfcCovering` `CEILING` | **Forro** | Outros `IfcCovering` (revestimento, rodapé) são contados em `skipped`. |
| `IfcSpace` | **Ambiente** | Contorno em planta; o ponto do ambiente é o centróide (ou o hull, se o anel for degenerado); nome = `Name`, número = `LongName`. `ObjectType` não é usado. |
| `IfcGrid` | **Grade de eixos** | Cada `IfcGridAxis` (atributos U, V e W) vira um segmento entre o primeiro e o último ponto; tipo `gt_6mm`, balões nas duas pontas. |

Os **níveis** vêm dos `IfcBuildingStorey`, ordenados pela elevação (`Elevation` ou a origem da colocação). Sem
pavimentos, o projeto ganha um nível "Térreo" em 0. O nome do projeto vem de `IfcProject.Name`.

Os **tipos** são criados na hora, com nome + espessura (e, para portas e janelas, nome + largura × altura):

- parede: uma camada `structure` com a espessura medida, material `mat_bloco14`, sem retorno nem encontro;
- piso, laje e forro: uma camada estrutural com a espessura medida, material `mat_concreto`;
- porta e janela: `flipHand` quando a operação do tipo contém `RIGHT`, duas folhas quando contém `DOUBLE`/`TWO`,
  plano `sliding` quando contém `SLIDING`/`POCKET`, `fixed` para janela e `swing` para porta nos demais casos,
  materiais `mat_aluminio` (batente) e `mat_vidro` (vidro).

Paredes, portas, janelas, pisos, lajes, forros, ambientes e genéricos recebem `ifcProperties` quando o arquivo traz
pset ou quantitativo (seção 5). Grades não recebem.

## 4 · Objetos genéricos e o que fica de fora

Produto que não tem equivalente nativo entra como **elemento genérico** (`kind: 'generic'`): guarda a classe IFC de
origem (`sourceClass`), o `PredefinedType`/`ObjectType`, a malha triangular em coordenadas de mundo, o contorno em
planta (hull), a cor lida do estilo (`color`) e as propriedades (`ifcProperties`).
Entram assim: `IfcRoof`, `IfcStair`, `IfcRailing`, `IfcColumn`, `IfcBeam`, `IfcMember`, `IfcPlate`, `IfcFooting`,
mobiliário, MEP (terminais, tubos, dutos), `IfcCurtainWall` e `IfcBuildingElementProxy` quando têm corpo.

No 3D o genérico é uma malha com sombreamento chapado, na categoria gráfica `generic` e selecionável como os demais
elementos; na planta é um contorno tracejado fino. Ele **entra** no DXF da planta, nos quantitativos geométricos
(seção 8) e no IFC de exportação (seção 6). Fica fora de tabelas; as propriedades são somente leitura (seção 10).

`skipped` recebe só o que não deu para representar:

- produto sem malha legível (por exemplo, mobiliário só com `IfcBoundingBox`, ou `IfcBuildingElementProxy` sem
  malha);
- parede cujo contorno não cabe no retângulo (chave `parede-forma-livre`) — o corpo dela não vira genérico;
- `IfcCovering` que não é `CEILING`;
- porta/janela sem vão, sem parede hospedeira, sem corpo ou com menos de 3 pontos;
- piso, laje, forro ou ambiente sem corpo legível;
- `duplicado`: piso/laje/forro com o mesmo contorno e a mesma cota de um já importado.

Entidades que **não são produto** (`IfcPropertySet`, `IfcElementQuantity`, `IfcMaterial*`, estilos, cores, camadas de
desenho) não entram na conta de `skipped`: não são objeto do modelo, ainda que psets e cores sejam lidos para compor o
elemento (seção 5).

`approximate` registra a parede que veio de malha (hull da projeção), o piso/laje/forro aproximado e o ambiente
aproximado. `geometry` conta o que foi descartado dentro de um corpo que entrou: `corte-booleano-ignorado` (só o
primeiro operando do `IfcBooleanResult` é usado) e `extrusao-inclinada`.

## 5 · Propriedades e cores

As propriedades vêm de `IfcRelDefinesByProperties`: o importador segue a relação tanto para o **elemento** quanto para
o **tipo** (`IfcRelDefinesByType`) e lê:

- `IfcPropertySet` com `IfcPropertySingleValue`, `IfcPropertyEnumeratedValue` e `IfcPropertyListValue`;
- `IfcElementQuantity` com `IfcQuantityLength`, `IfcQuantityArea`, `IfcQuantityVolume`, `IfcQuantityCount`,
  `IfcQuantityWeight` e `IfcQuantityTime`.

O resultado fica em `ifcProperties` (opcional, ausente quando não há nada): lista de `{ name, value, pset? }` em que
`value` é **texto, número ou booleano**, nunca `undefined`/`NaN`/vazio, e `pset` guarda o nome do conjunto de origem
(`Pset_WallCommon`, `Qto_BeamBaseQuantities`…). Regras:

- o `name` é o nome da propriedade no arquivo; nomes repetidos ficam com o **primeiro** valor (instância vence o tipo);
- a lista é ordenada por nome e limitada a **200** propriedades por elemento;
- booleano (`IFCBOOLEAN`/`IFCLOGICAL`) vira `true`/`false`; medidas e quantidades viram número; enumerado ou lista com
  mais de um valor vira texto separado por `", "`;
- propriedade vazia, ilegível ou de tipo não suportado (tabela, propriedade complexa) é descartada em silêncio.

A **cor** vem de `IfcStyledItem` → `IfcPresentationStyleAssignment` (IFC2X3) ou `IfcSurfaceStyle` →
`IfcSurfaceStyleRendering`/`IfcSurfaceStyleShading` → `IfcColourRgb`, convertida para `#rrggbb`. O estilo do item vence
o do tipo; o importador segue `IfcMappedItem` e o primeiro operando de `IfcBooleanResult` para achar o item estilizado.
Hoje só o **genérico** guarda a cor (`Generic.color`): os elementos nativos não têm campo de cor por instância e
continuam com os materiais padrão do Hestia. A cor fica no modelo, mas ainda não pinta o 3D nem a planta.

Na **reexportação**, os conjuntos são refeitos a partir de `pset`: cada nome de origem vira um `IfcPropertySet`
próprio, e a propriedade sem `pset` cai no conjunto padrão **`Pset_Hestia`**. Ou seja, um arquivo importado nesta versão
mantém os nomes dos conjuntos; o que ainda colapsa em `Pset_Hestia` são as propriedades sem conjunto de origem (modelos
gravados antes de o campo existir). Os `ifcProperties` dos elementos nativos não são reexportados, e a cor não volta
como `IfcStyledItem`.

## 6 · Exportação de volta

O exportador (`packages/io/src/ifc/ifcExport.ts`, IFC4) continua escrevendo paredes, aberturas, pisos, lajes, forros,
telhados e escadas nativos como antes ([decisão 0020](../decisoes/0020-ifc.md)). Os objetos genéricos entram no fim,
um a um, dentro do pavimento do nível:

- o produto é um **`IFCBUILDINGELEMENTPROXY`** com `Name` = nome do objeto (ou a classe de origem) e
  **`ObjectType` = `sourceClass`** (`IFCBEAM`, `IFCCOLUMN`, `IFCFURNITURE`…), então a classe de origem não se perde;
- `PredefinedType` sai como `.ELEMENT.`: o enum do proxy é próprio (`IfcBuildingElementProxyTypeEnum`), não o da classe
  de origem;
- o corpo é uma malha **`IFCTRIANGULATEDFACESET`** (IFC4) com `IfcCartesianPointList3D` em metros e cota local do nível
  (`z` absoluto menos a elevação), dentro de `IFCSHAPEREPRESENTATION` `'Body'`/`'Tessellation'`; triplas de índice
  inválidas são descartadas e, sem malha válida, o proxy sai sem representação;
- as propriedades viram `IfcPropertySet` (um por `pset` de origem, em ordem de nome), com um `IfcPropertySingleValue`
  por propriedade (`IFCBOOLEAN`, `IFCINTEGER`, `IFCREAL` ou `IFCLABEL`), ligados ao proxy por
  `IfcRelDefinesByProperties`. Propriedade sem `pset` vai para **`Pset_Hestia`**; sem `ifcProperties`, nenhum pset é
  escrito.

O conjunto de origem é preservado quando existe (`Pset_WallCommon` volta como `Pset_WallCommon`; quantitativos
`Qto_*` também). O que **colapsa em `Pset_Hestia`** é só a propriedade sem conjunto de origem — por exemplo, um modelo
antigo, anterior ao campo `pset`. Cor, material e `PredefinedType` não voltam.

## 7 · DXF

O DXF da planta (`planDxf` em `apps/web/src/editor/dxfExport.ts`) desenha o contorno em planta de cada genérico do
nível, e só ele — a malha 3D não entra:

- um **`POLYLINE` fechado no formato R12** (`AC1009`), com um `VERTEX` por ponto e `SEQEND`, como o resto do arquivo;
- camada **`IMPORTADO`**, cor **8** (cinza) no próprio registro (código 62), largura zero;
- ordem determinística por `id`; contorno com menos de 3 pontos depois de removido o vértice de fechamento repetido
  não desenha nada;
- a **visibilidade da categoria `generic`** na vista manda: com a categoria oculta, nenhum registro é acrescentado;
- sem genéricos no nível, o DXF é **byte a byte** o mesmo de antes (os registros só são inseridos antes do
  `ENDSEC`/`EOF` quando existem).

É só o DXF da planta: corte e elevação não têm representação de genérico. Na prancha, o viewport de **planta** desenha
o mesmo contorno tracejado (o de corte/elevação não). Como o contorno é o hull da malha, o DXF não mostra concavidades
nem furos do objeto.

## 8 · Quantitativos

Os genéricos têm um quantitativo **geométrico de fallback** em `packages/engine/src/genericQuantities.ts`, para orçar
o que o motor nativo não modela:

- `genericQuantities(project, levelId?)` devolve uma linha por genérico com `id`, `levelId`, `sourceClass`, `volume`,
  `area` e `triangles`, ordenada por `id`;
- **volume**: soma dos tetraedros assinados (origem → triângulo, `Σ a·(b × c) / 6`), com valor absoluto no fim; para
  malha fechada e orientada para fora é o volume real;
- **área**: soma de `0,5 · |(b − a) × (c − a)|` de cada triângulo, em m²;
- **triângulos**: `indices.length / 3` arredondado para baixo; tripla incompleta no fim é descartada. Índice fora da
  faixa ou coordenada não finita é ignorado no volume e na área, sem lançar;
- `genericQuantitiesTotal(rows)` soma volume, área e contagem.

O quantitativo nativo (paredes, pisos, lajes, forros, telhados e escadas) continua saindo das regras de junção e
camadas e **não** inclui genéricos. Um genérico com malha aberta ou faces invertidas pode ter volume irreal: o painel
de propriedades detecta aresta que não é compartilhada por exatamente dois triângulos (comparando posições, porque a
malha importada repete vértices por triângulo) e troca o rótulo para **"Volume indicativo"**. A área não depende de a
malha ser fechada.

## 9 · Desempenho

`scripts/bench-ifc.mjs` importa cada fixture e imprime duas tabelas Markdown (tempos/RSS e elementos por `kind`) ou,
com `--json`, o mesmo resultado em JSON:

```powershell
npx vite-node scripts/bench-ifc.mjs --repeticoes 2
npx vite-node scripts/bench-ifc.mjs --repeticoes 1 --grandes
```

`--repeticoes N` (padrão 2) mostra a **mediana** da leitura e da importação; `--grandes` baixa o sample do Revit para
`%TEMP%/revit-amostra.ifc` se ainda não existir (e o inclui). O RSS é `process.memoryUsage().rss` antes da leitura e
depois da importação, no mesmo processo.

Medido em 2026-10-28 com `--repeticoes 2` (medianas; uma máquina Windows, sem `--expose-gc`):

| Fixture | Tamanho | Leitura (ms) | Importação (ms) | Elementos | Genéricos | Triângulos | RSS antes (MB) | RSS depois (MB) | Δ RSS (MB) |
|---|---|---|---|---|---|---|---|---|---|
| `parede-janela.ifc` | 12,2 kB | 0,2 | 9,1 | 2 | 0 | 0 | 121,4 | 121,4 | −0,0 |
| `casa-pequena.ifc` | 55,6 kB | 0,3 | 9,4 | 1 | 0 | 0 | 122,0 | 123,4 | 1,4 |
| `predio-simples.ifc` | 139,0 kB | 1,2 | 18,9 | 14 | 5 | 942 | 126,0 | 126,2 | 0,2 |
| `fzk-haus.ifc` | 3,96 MB | 10,6 | 355,7 | 97 | 57 | 10 576 | 178,6 | 278,2 | 99,6 |

Sample do Revit com `--repeticoes 1 --grandes` (o arquivo já estava em `%TEMP%`; uma repetição, então não é mediana):

| Fixture | Tamanho | Leitura (ms) | Importação (ms) | Elementos | Genéricos | Triângulos | RSS antes (MB) | RSS depois (MB) | Δ RSS (MB) |
|---|---|---|---|---|---|---|---|---|---|
| `revit-amostra.ifc` | 24,22 MB | 63,5 | 3 986,3 | 429 | 329 | 301 458 | 227,3 | 649,7 | 422,4 |

Os tempos oscilam com a carga da máquina: em execuções simultâneas de build/teste, a mesma máquina mediu
`parede-janela.ifc` em 25 ms, `fzk-haus.ifc` em 830 ms e o sample do Revit em ~4,0 s — a tabela acima é de uma rodada
mais tranquila. As contagens são estáveis. O RSS é do processo inteiro e não volta ao patamar anterior entre fixtures,
por isso o "antes" de um arquivo pode ser maior que o "depois" do anterior (e o Δ pode sair negativo quando o GC roda
no meio) — o Δ é o que vale para cada importação. O sample de 24 MB é o caso pesado: ~4,0 s e ~422 MB de RSS a mais
para 429 elementos, dos quais 329 genéricos e 301 mil triângulos.

## 10 · Interface

O menu **Arquivo → Importar IFC…** (`apps/web/src/editor/ifcImport.ts`) lê o arquivo como texto e chama
`importIfcText`. O resultado substitui o projeto aberto, com o nome `<base>.hestia.json` (o IFC original não é
sobrescrito), e a barra de status mostra o resumo do relatório (`resumoImportacao`).

- **Worker de importação**: com `Worker` disponível, `importIfcText` roda o `importIfc` em
  `apps/web/src/editor/ifcWorker.ts` — `new Worker(new URL('./ifcWorker.ts', import.meta.url), { type: 'module' })` —
  para o arquivo grande não congelar a janela. O worker devolve `{ project, report }` ou `{ error }`. Há um teto de
  **120 s**; se o worker não puder ser criado/carregado, a importação repete na thread principal (mesmo resultado);
  erro dentro do worker e estouro de tempo não repetem — a mensagem aparece no menu. Sem `Worker` (Node, testes), o
  caminho é o `importIfc` síncrono.
- **Painel do genérico**: selecionar um objeto importado (ou vários, desde que a seleção seja só de genéricos) abre
  `apps/web/src/ui/GenericProps.tsx` (somente leitura):
  grupo **Objeto importado** com classe IFC, tipo predefinido e tipo de objeto; por objeto, o nível, o nº de
  triângulos, volume (ou "Volume indicativo" para malha aberta), área e até **30** propriedades do IFC (o resto vira
  "+N propriedades IFC não exibidas"). Não há edição de viga, pilar, mobiliário ou MEP importado.
- **3D**: a malha entra na categoria `generic`, com sombreamento chapado e picking como os demais elementos; a
  categoria pode ser ocultada nas configurações gráficas do nível. Na planta, o hull é desenhado tracejado e fino.

## 11 · Unidades

O importador lê `IfcProject.UnitsInContext` e converte tudo para **metro** e **radiano** (o modelo do Hestia):

- comprimento: `IfcSIUnit` com prefixo (`MILLI`, `CENTI`, …) ou `IfcConversionBasedUnit` (pés, polegadas);
  sem unidade declarada, assume metro;
- ângulo: `PLANEANGLEUNIT`; sem unidade declarada, o importador assume **grau** (`π/180`);
- área e volume do IFC são lidos como propriedades (`IfcQuantityArea`/`IfcQuantityVolume`), mas não alimentam o
  quantitativo do Hestia; o genérico tem o quantitativo geométrico da seção 8.

Cotas de nível, alturas, espessuras e coordenadas já saem em metros. Um arquivo em milímetros entra com os mesmos
valores de um arquivo em metros — a escala não muda.

## 12 · Tolerâncias

As duas tolerâncias de projeto:

- **1 mm para tipo**: a espessura de parede/piso/laje/forro é arredondada ao milímetro para compor o tipo
  (`Parede 150 mm`) e a chave da porta/janela usa milímetros (`1200x1400`). Paredes com 149,6 mm e 150,4 mm
  compartilham o mesmo tipo.
- **5 mm para forma**: parede com espessura menor que 5 mm é recusada (`parede-forma-livre`) em vez de virar um
  plano; o retângulo mínimo da parede também exige comprimento de 1 cm.

Outros cortes que aparecem no código e explicam o resultado:

- pontos repetidos a menos de **1 µm** são colapsados (`cleanLoop`), inclusive o ponto de fechamento;
- o nível de um elemento é o pavimento mais próximo **abaixo** da cota, com **1 cm** de folga;
- altura mínima de parede e espessura mínima de piso/laje/forro: **5 cm**;
- largura e altura mínimas de vão: **30 cm**; o centro do vão é preso ao comprimento da parede;
- área de contorno nula (1e-9) ou retângulo que cobre menos de **80%** do polígono recusam a parede.

O nome do tipo de porta/janela usa centímetros (`Janela 120x140`), embora o `id` use milímetros — herdado da
convenção de esquadrias do Hestia, não é erro de escala.

## 13 · Limitações conhecidas

- **Telhado e escada não são nativos**: `IfcRoof`, `IfcStair` e `IfcStairFlight` com corpo entram como **genérico**
  (malha + contorno), não como telhado ou escada editáveis. Águas de telhado que venham como `IfcSlab` `ROOF` entram
  como laje; patamares como `IfcSlab` `LANDING` também. Não há geração de planos de telhado nem de degraus/patamares
  a partir do IFC.
- **O genérico agora entra no 3D, no DXF da planta, nos quantitativos e no IFC de exportação** (seções 6 a 8). O que
  continua fora: tabelas e a edição das propriedades — o painel é somente leitura, e a cor importada ainda não é
  aplicada na visualização.
- **Extrusão inclinada** (parede fora do eixo vertical, painel de fachada) não vira prisma: os vértices ficam em
  `points` e a parede pode cair no hull aproximado. `IfcSweptDiskSolid` (tubos) é descartado.
- **Telas e formas complexas** (cortina de vidro, B-rep não planar, malha esférica) entram como genérico quando a
  malha é legível; em planta só o hull aparece. Não há reconstrução de faces.
- **Cortes booleanos** são perdidos: vale o primeiro operando. Furos de piso/laje só entram quando já são anéis do
  perfil.
- **Parede de forma livre** (L, curva, polígono irregular) é recusada em vez de virar caixa.
- **Aberturas** dependem de `IfcRelVoidsElement` + `IfcRelFillsElement` + parede importada; porta ou janela solta ou
  sem parede hospedeira é descartada (no sample do Revit, 7 portas e 2 janelas ficam de fora por isso).
- **Sem anotação ou tabela**: textos, cotas e tabelas do IFC não são lidos, e o genérico não entra em tabela. As
  propriedades do IFC são lidas, mas não editáveis. Pranchas de planta mostram o contorno tracejado do genérico; as de
  corte/elevação, não.
- **Uma camada por tipo**: a espessura é a total medida; a divisão em camadas do IFC não é reconstruída.
- **`IfcGridPlacement`** não é resolvido (a geometria fica na origem do produto).
- **Sem validação**: arquivo truncado ou com entidade quebrada gera `broken` e segue; o importador não confere o
  schema nem a integridade referencial.

## 14 · Fixtures de teste

Os modelos ficam em `tests/ifc/fixtures/` (não versionar o conteúdo) e são baixados por
`node scripts/baixar-ifc.mjs`:

```powershell
node scripts/baixar-ifc.mjs                # conjunto normal (~4,3 MB)
node scripts/baixar-ifc.mjs --grandes      # inclui o sample do Revit (25 MB)
node scripts/baixar-ifc.mjs --so-verificar # confere bytes e sha256 contra o manifest.json
node scripts/baixar-ifc.mjs --forcar       # troca um arquivo com sha diferente
```

O script grava `tests/ifc/fixtures/manifest.json` (`arquivo`, `url`, `bytes`, `sha256`, `licenca`, `fonte`) e
`tests/ifc/fixtures/README.md`. Arquivo existente com `sha256` diferente do remoto **não** é sobrescrito sem
`--forcar`. `--so-verificar` não usa a rede.

| Arquivo | Tamanho | Conteúdo | Licença |
|---|---|---|---|
| `parede-janela.ifc` | 12,2 kB | parede com vão e janela (buildingSMART, ReferenceView) | uso livre para teste |
| `predio-simples.ifc` | 139,0 kB | prédio de dois pavimentos (buildingSMART, Simple-Scene) | uso livre para teste |
| `casa-pequena.ifc` | 55,6 kB | casinha pequena (IfcOpenShell) | repositório sem licença declarada — uso local |
| `fzk-haus.ifc` | 3,96 MB | FZK-Haus completo, IFC2X3 (KIT) | CC BY 4.0 — atribuição obrigatória |
| `revit-amostra.ifc` | 24,2 MB | sample do Revit, IFC4 (Autodesk) | sample do Revit — só com `--grandes` |

Resultado medido em 2026-10-28 (contagens do relatório; tempos na seção 9):

| Fixture | Schema | Níveis | Importado | Ignorado |
|---|---|---|---|---|
| `parede-janela.ifc` | IFC4 | 1 | 1 parede, 1 janela | — |
| `predio-simples.ifc` | IFC4 | 1 | 4 paredes, 3 pisos, 2 ambientes, **5 objetos** | — |
| `casa-pequena.ifc` | IFC4 | 1 | 1 parede | — |
| `fzk-haus.ifc` | IFC2X3 | 2 | 13 paredes, 5 portas, 11 janelas, 3 lajes, 1 piso, 7 ambientes, **57 objetos** | 12 `IfcFurnishingElement` sem malha, 6 `IfcFlowTerminal`, 1 `IfcDistributionFlowElement`, 1 `IfcStair` |
| `revit-amostra.ifc` | IFC4 | 6 | 48 paredes, 9 portas, 15 janelas, 10 pisos, 2 lajes, 2 forros, 14 ambientes, **329 objetos** | 7 `IfcDoor` e 2 `IfcWindow` sem vão/parede hospedeira, 1 `IfcCovering` de revestimento, 27 `IfcBuildingElementProxy` sem malha |

No `predio-simples.ifc` os 5 objetos são 1 `IfcFurniture`, 1 `IfcSpatialZone` e 3
`IfcBuildingElementProxy` — os antigos "ignorados" deste fixture agora entram como genérico. No `fzk-haus.ifc` os 57
objetos são 51 vigas, 3 mobiliários, 2 guarda-corpos e 1 pilar; os 12 mobiliários restantes não têm malha. O arquivo
também traz 9 cortes booleanos e 16 extrusões não verticais, que aparecem em `geometry`; os três `IfcSlab` entram como
piso/laje. No sample do Revit, os 329 genéricos são 148 `IfcMember`, 50 `IfcBuildingElementProxy`, 46 `IfcPlate`, 32
`IfcFurniture`, 23 `IfcFooting`, 10 `IfcRailing`, 10 `IfcLightFixture`, 3 `IfcColumn`, 3
`IfcSystemFurnitureElement`, 3 `IfcStairFlight` e 1 `IfcRoof` — vigas, chapas, mobiliário, fundações e escada
aparecem no 3D; as 9 aberturas sem vão/parede hospedeira, o `IfcCovering` de revestimento e os 27 proxies sem malha
ficam de fora.
