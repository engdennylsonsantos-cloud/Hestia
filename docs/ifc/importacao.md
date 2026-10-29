# Importação IFC

O Hestia lê IFC **de volta** para o modelo nativo: `packages/io/src/ifcImport/` (leitor STEP sem dependências) e o
script `scripts/ifc-import.mts`, que roda fora da interface. A exportação é o outro lado, na
[decisão 0020](../decisoes/0020-ifc.md).

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

O tempo varia com a máquina; as contagens, não.

O formato do relatório:

```json
{
  "schema": "IFC2X3",
  "broken": 0,
  "levels": 2,
  "imported": { "paredes": 13, "portas": 5, "janelas": 11, "lajes": 3, "pisos": 1, "ambientes": 7 },
  "skipped": {},
  "approximate": {},
  "geometry": {},
  "warnings": []
}
```

- `broken`: entidades STEP que o tokenizador não conseguiu ler (o resto do arquivo continua).
- `imported`: contagem por categoria que virou elemento nativo.
- `skipped`: contagem por **classe IFC** de produto que não entrou — inclusive as classes que o importador não
  representa (viga, pilar, escada, telhado, mobiliário), para o relatório não dizer "0 ignorados" com 51 vigas no
  arquivo.
- `approximate`: formas aproximadas (hull de malha) por categoria.
- `geometry`: geometria que o leitor não representou, por motivo (`corte-booleano-ignorado`, `extrusao-inclinada`).
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

## 4 · O que é ignorado ou apenas contado

Produto com colocação e forma que o importador não representa entra em `skipped`, por classe:

- `IfcRoof` e `IfcStair` (telhado e escada não são nativos na importação);
- `IfcColumn`, `IfcBeam`, `IfcMember`, `IfcPlate`, `IfcRailing`, `IfcRamp`, `IfcFooting`, `IfcPile`;
- `IfcFurnishingElement`, `IfcBuildingElementProxy`, `IfcElementAssembly`, `IfcCurtainWall`;
- `IfcSite`/`IfcBuilding` (só os pavimentos viram níveis), `IfcAnnotation`, grupos e sistemas;
- MEP (`IfcFlowTerminal`, `IfcDistributionFlowElement`...).

Entidades que **não são produto** (`IfcPropertySet`, `IfcElementQuantity`, `IfcMaterial*`, estilos, cores, camadas de
desenho) não entram na conta: não são objeto do modelo.

`skipped` também recebe os casos em que o importador tentou mapear e recusou:

- parede cujo contorno não cabe no retângulo (chave `parede-forma-livre`);
- `IfcCovering` que não é `CEILING`;
- porta/janela sem vão, sem parede hospedeira, sem corpo ou com menos de 3 pontos;
- piso, laje, forro ou ambiente sem corpo legível;
- `duplicado`: piso/laje/forro com o mesmo contorno e a mesma cota de um já importado.

`approximate` registra a parede que veio de malha (hull da projeção), o piso/laje/forro aproximado e o ambiente
aproximado. `geometry` conta o que foi descartado dentro de um corpo que entrou: `corte-booleano-ignorado` (só o
primeiro operando do `IfcBooleanResult` é usado) e `extrusao-inclinada`.

Material, cor e propriedades do IFC não são lidos: os tipos importados usam os materiais padrão do Hestia.

## 5 · Unidades

O importador lê `IfcProject.UnitsInContext` e converte tudo para **metro** e **radiano** (o modelo do Hestia):

- comprimento: `IfcSIUnit` com prefixo (`MILLI`, `CENTI`, …) ou `IfcConversionBasedUnit` (pés, polegadas);
  sem unidade declarada, assume metro;
- ângulo: `PLANEANGLEUNIT`; sem unidade declarada, o importador assume **grau** (`π/180`);
- área e volume são lidos, mas não usados (não há quantitativo na importação).

Cotas de nível, alturas, espessuras e coordenadas já saem em metros. Um arquivo em milímetros entra com os mesmos
valores de um arquivo em metros — a escala não muda.

## 6 · Tolerâncias

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

## 7 · Limitações conhecidas

- **Telhado e escada** não são nativos na importação: `IfcRoof` e `IfcStair` são ignorados. Águas de telhado que
  venham como `IfcSlab` `ROOF` entram como laje; patamares que venham como `IfcSlab` `LANDING` também. Os degraus e
  o corpo da escada não entram.
- **Extrusão inclinada** (parede fora do eixo vertical, painel de fachada) não vira prisma: os vértices ficam em
  `points` e a parede pode cair no hull aproximado. `IfcSweptDiskSolid` (tubos) é descartado.
- **Telas e formas complexas** (cortina de vidro, B-rep não planar, malha esférica) viram hull em planta ou são
  ignoradas. Não há reconstrução de faces.
- **Cortes booleanos** são perdidos: vale o primeiro operando. Furos de piso/laje só entram quando já são anéis do
  perfil.
- **Parede de forma livre** (L, curva, polígono irregular) é recusada em vez de virar caixa.
- **Aberturas** dependem de `IfcRelVoidsElement` + `IfcRelFillsElement` + parede importada; porta ou janela solta é
  descartada.
- **Sem anotação, quantitativo, propriedades, materiais, cores ou camadas**: a importação traz geometria e nomes.
  Textos, cotas e tabelas do IFC não são lidos.
- **Uma camada por tipo**: a espessura é a total medida; a divisão em camadas do IFC não é reconstruída.
- **`IfcGridPlacement`** não é resolvido (a geometria fica na origem do produto).
- **Sem validação**: arquivo truncado ou com entidade quebrada gera `broken` e segue; o importador não confere o
  schema nem a integridade referencial.

## 8 · Fixtures de teste

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

Resultado medido em 2026-10-28 (tempos de uma máquina; contagens são as do relatório):

| Fixture | Schema | Níveis | Importado | Ignorado |
|---|---|---|---|---|
| `parede-janela.ifc` | IFC4 | 1 | 1 parede, 1 janela | — |
| `predio-simples.ifc` | IFC4 | 1 | 4 paredes, 3 pisos, 2 ambientes | 1 `IfcFurniture`, 1 `IfcSpatialZone` |
| `casa-pequena.ifc` | IFC4 | 1 | 1 parede | — |
| `fzk-haus.ifc` | IFC2X3 | 2 | 13 paredes, 5 portas, 11 janelas, 3 lajes, 1 piso, 7 ambientes | 51 `IfcBeam`, 1 `IfcColumn`, 1 `IfcStair`, 2 `IfcRailing`, 15 `IfcFurnishingElement`, 7 MEP |

O `fzk-haus.ifc` também traz 9 cortes booleanos e 16 extrusões não verticais, que aparecem em `geometry`; os três
`IfcSlab` entram como piso/laje. O `sample` do Revit (25 MB) importa 48 paredes, 9 portas, 15 janelas, 10 pisos,
2 lajes, 2 forros e 14 ambientes em ~1,9 s, e relata 296 produtos não representados (vigas, chapas, mobiliário,
fundações, escada) — é o caso que mostra por que `skipped` precisa contar as classes não visitadas.
