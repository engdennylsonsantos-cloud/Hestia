# N3 — matriz visual e interoperabilidade (manual)

O N3 é o único nível de qualidade que **não roda em CI**: ele responde "o arquivo, aberto num programa de fora,
mostra o mesmo projeto que o Hestia mostra?". Os níveis anteriores já foram fechados por script:

| Nível | O que garante | Onde |
|---|---|---|
| N0 | IFC4 válido, sem erro de schema | `scripts/ifc-quality/validate.py` |
| N1 | tipo/pavimento/vão/material layer set certos | contagens + psets |
| N2 | volume/área da **geometria exportada** = volume/área medidos no IFC | `npm run ifc:compare` |
| N4 | round-trip Hestia → IFC → Hestia idêntico | `roundtrip.mts --strict` |

O N2 compara `ifcGeometryOf` (o que o exportador recebeu) com o que o IfcOpenShell mede no arquivo. Ele **não** diz
nada sobre cor, transparência, hierarquia espacial na árvore do visualizador ou legibilidade. Isso é o N3, e é
manual por definição: depende de olho humano e da versão de cada programa.

Este documento fixa o procedimento, as contagens esperadas e o formato da evidência para que duas pessoas cheguem
ao mesmo resultado. O plano geral da exportação está em [exportacao.md](exportacao.md).

## 1. Pré-requisitos

- Node 20+ (só para gerar os IFC).
- Navegador atualizado — Any3D roda no navegador, sem instalar nada.
- Blender 4.2+ com a extensão **Bonsai** (antiga BlenderBIM) — é o visualizador de referência, o único que lê
  camadas, psets e estilos de material por completo.
- Opcional: **ConstructCAD** instalado (se não estiver, registre "não executado" na evidência).
- Python com `ifcopenshell` 0.8.x **não** é necessário para o N3; só para regerar `report.json`/`compare.json`.
- Espaço em disco: os 6 arquivos somam ~3,2 MB (`predio10.ifc` é 2,6 MB).

## 2. Gerar os IFC

```powershell
# na raiz do repositório
npx vite-node scripts/ifc-quality/export-fixtures.mts
```

Saída em `test-results/ifc-quality/`, com data fixa (`2026-10-29T00:00:00Z`) — o mesmo texto em toda máquina:

| Arquivo | Níveis | Elementos do projeto | Tamanho |
|---|---:|---:|---:|
| `house2.ifc` | 2 | 20 | 189 kB |
| `studio.ifc` | 2 | 11 | 102 kB |
| `house-premium.ifc` | 3 | 75 | 559 kB |
| `predio10.ifc` | 10 | 600 | 4.785 kB |
| `esquadrias.ifc` | 1 | 25 | 236 kB |
| `casa-ambientes.ifc` | 2 | 6 | 49 kB |

"Elementos do projeto" é a contagem do `ProjectStore` (paredes, aberturas, pisos, lajes, forros, telhados,
escadas e ambientes); grades não entram. Por isso o `casa-ambientes` tem 6: 4 paredes + 1 ambiente + 1 forro.

Para atualizar as contagens e o relatório de qualidade:

```powershell
npm run ifc:quality    # exporta, valida no IfcOpenShell, roda round-trip e N2
                       # escreve test-results/ifc-quality/report.json e compare.json
```

Não edite os `.ifc` à mão. Se precisar de outro estado, mude o fixture (`export-fixtures.mts`) e regenere.

## 3. Ferramentas

### 3.1 Any3D — navegador, arquivo local

Serve para a conferência rápida de **forma, posição e contagem**. Não serve para cor de material nem semântica.

1. Abra <https://any3d.cc/tools/ifc-viewer> (a página equivalente em `any3d.art/tools/ifc-viewer` é só uma
   landing de conversão).
2. Arraste o `.ifc` para a área "Drop files here" ou clique em **Select File**. O processamento é local, no
   navegador, segundo a própria ferramenta; ainda assim, use apenas os fixtures deste repositório.
3. Espere o parse. `predio10.ifc` leva mais tempo (2,6 MB, 600 elementos).
4. Órbita com o botão esquerdo, pan com o direito, zoom com a roda.
5. Clique num elemento para abrir o painel da direita com tipo, nome e propriedades.

O que conferir:

- a construção aparece **na escala certa** (porta ~2,10 m de altura contra a parede), sem espelhar o Norte;
- os pavimentos empilham na ordem certa (`predio10`: 10 volumes iguais; `house-premium`: 3);
- aberturas são **buracos de verdade** — dá para ver o interior pela janela, não uma chapa pintada na parede;
- portas e janelas mostram **batente, folha, vidro e montantes** como peças separadas, não uma caixa branca única;
- contagem visual bate com a tabela do §5 (ex.: 8 janelas na `house2`);
- o painel de propriedades mostra o tipo IFC (`IfcWall`, `IfcDoor`, `IfcWindow`…), não "mesh".

O que **não** dá para conferir no Any3D:

- cor por material: a ferramenta pinta por **tipo de elemento**, não pelo `IfcSurfaceStyle` do material;
- transparência do vidro (o vidro pode aparecer opaco ou cinza);
- `IfcSpace`/`IfcGrid` como objetos semânticos (podem virar sólidos soltos ou nem aparecer);
- camadas, psets e quantitativos.

Se algo acima falhar no Any3D, **repita no Bonsai antes de registrar divergência**.

### 3.2 Bonsai (Blender) — referência

É o mais completo dos três para inspeção: lê o arquivo como IFC de verdade — hierarquia espacial, tipos,
materiais com camadas, psets e estilos de superfície.

Instalação (uma vez):

1. Blender 4.2+ → **Edit → Preferences → Get Extensions**.
2. Procure **Bonsai** (antiga BlenderBIM) e instale; marque a extensão como habilitada.
3. Reinicie o Blender. A aba **Bonsai** aparece na barra lateral (tecla `N`) do viewport 3D.

Abrir:

1. **File → Open** e escolha o `.ifc` (o Bonsai registra o handler de IFC), **ou** `N` → aba **Bonsai** →
   **Project → Open IFC Project**. Se o arquivo abrir como texto, use o caminho pela aba Bonsai.
2. No **Outliner**, confira a árvore `IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey(s)`.
3. Viewport com `Z` → **Material Preview** para ver as cores dos materiais; `Z` → **Solid** para ler a forma.
4. Selecione um elemento e abra `N` → **Object Information** / **IFC Object**: tipo, `GlobalId`, material.
5. Para ver as camadas, selecione a parede e abra as **Material Properties** do Blender: cada camada do
   `IfcMaterialLayerSet` vira um slot, na ordem do projeto.
6. Para ver o interior e as camadas: isole a parede (`/` no teclado) e olhe a face de topo — as camadas aparecem
   em faixas, na ordem do layer set. Para um corte de verdade, use a ferramenta de seção do Bonsai (o caminho no
   painel muda entre versões; anote a versão usada na evidência).

O que conferir (é aqui que o N3 é julgado):

- cores: face acabada **branca/bege** (`Tinta branca #f4f1ea` no interior, `Revestimento cerâmico #e9e4da` no
  exterior do `wt_ext19`), estrutura **terracota** (`Bloco cerâmico 9/14/19`, `#c9784c` / `#c0693f` / `#b45f38`),
  telha **terracota** (`#b5522d`), escada **concreto** (`#8f9296`), portas **madeira** (`#a9794a`), esquadrias
  **alumínio** (`#b8bdc2`) e **vidro translúcido** (`#a9d6e5`, opacidade 35%);
- vidro **transparente** (`Vidro #a9d6e5`, opacidade 0,35 → `Transparency = 0,65`): vê-se o interior através dele;
- material layer set na ordem e com as espessuras do tipo. Exemplos de `DEFAULT_WALL_TYPES`: `wt_ext19`
  ("Externa 19 + cerâmica") = cerâmica 10 mm + argamassa 20 mm + bloco 19 (190 mm) + reboco 20 mm + tinta 2 mm;
  `wt_alv14` = tinta 2 mm + reboco 20 mm + bloco 14 (140 mm) + reboco 20 mm + tinta 2 mm. A parede aparece
  **branca/bege** nas faces acabadas e **terracota** só no corte, onde se vê o bloco;
- `IfcSpace` (só `casa-ambientes`) e `IfcGrid` com os eixos A e 1;
- telhado como `IfcRoof` com águas e beiral, escada como `IfcStair` com lances e patamares.

### 3.3 ConstructCAD — opcional

Só execute se o programa estiver instalado; caso contrário, registre "não executado" na evidência e siga com
Any3D + Bonsai.

1. **File → Open** (ou **Import**) e escolha o `.ifc`; em algumas versões basta arrastar o arquivo para a janela.
2. Se o programa oferecer "converter para o formato nativo", aceite — o objetivo é ver como ele **reconstrói** o
   modelo, não preservar o arquivo.
3. Vista 3D em perspectiva e uma vista de planta do pavimento térreo.

O que conferir:

- paredes chegam como paredes (não como blocos genéricos) e portas/janelas como vãos com esquadria;
- nada deslocado, duplicado ou faltando em relação ao Bonsai;
- o telhado da `house-premium` não virou uma laje plana;
- se o programa mostrar tabela de ambientes/quantitativos, ela existe e tem os valores do §5 (é bônus; o N3 não
  depende disso).

Onde o ConstructCAD reconstruir tipos, juntar paredes ou renomear elementos, isso é **esperado** e vai para a
coluna "observação" — não é falha do exportador.

### 3.4 Alternativa offline (quando não se quer navegador)

`openifcviewer.com` (desktop, processamento local) abre IFC4 e mostra propriedades. Serve como terceira opinião
quando o Any3D não carregar; o checklist é o mesmo do §3.1.

## 4. Checklist comum

Marque em cada ferramenta, para cada modelo:

| # | Item | Como se vê | Falha típica |
|---|---|---|---|
| 1 | Escala e orientação | porta com ~2,10 m; Norte do projeto | modelo deitado, 1000× maior, espelhado |
| 2 | Contagens | §5, elemento por elemento | faltando laje/escada, vão sem esquadria |
| 3 | Cores por material | Bonsai, Material Preview | tudo cinza (ver §7) |
| 4 | Transparência do vidro | Bonsai, olhando através da janela | vidro opaco, ou parede "vazada" |
| 5 | Vãos nas posições | buraco no lugar do desenho, peitoril certo | vão deslocado, porta sem buraco |
| 6 | Materiais/camadas | Bonsai, Material Properties | camada faltando ou fora de ordem |
| 7 | `IfcSpace` | `casa-ambientes`: "Sala 101" | ambiente ausente ou solto |
| 8 | `IfcGrid` | `casa-ambientes`: eixos A e 1 | eixos ausentes ou como linhas soltas |
| 9 | Telhado com águas | `house-premium`: 4 águas, 30 %, beiral 0,60 m | laje plana, água faltando |
| 10 | Escada com lances | `house-premium` (1 lance) e `predio10` (10 escadas) | degraus como bloco único, patamar faltando |

Itens 7 a 10 são "não aplicável" quando o modelo não tem o elemento (ver §5).

## 5. Matriz por modelo (contagens reais)

Fonte: `test-results/ifc-quality/report.json` (gerado por `npm run ifc:quality`), em 2026-10-29. Volume e área são
a soma dos produtos medidos pelo IfcOpenShell (`validate.py --geometry`), não a área útil do projeto. Se algum
número divergir do que você vê, rode `npm run ifc:quality` de novo antes de abrir pendência — o código muda e o
relatório é derivado dele.

| Modelo | Níveis | Paredes | Portas | Janelas | Vãos | Lajes | Forros | Telhados | Escadas | Ambientes | Eixos | Camadas | Psets | Volume | Área | Arquivo |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `house2` | 2 | 8 | 4 | 8 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 41 | 33,3 m³ | 405 m² | 100 kB |
| `studio` | 2 | 6 | 2 | 3 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 23 | 14,0 m³ | 193 m² | 69 kB |
| `house-premium` | 3 | 32 | 22 | 16 | 39 | 7 | 0 | 1 | 1 | 0 | 0 | 10 | 146 | 216,6 m³ | 2.866 m² | 339 kB |
| `predio10` | 10 | 240 | 160 | 140 | 309 | 50 | 0 | 0 | 10 | 0 | 0 | 53 | 1.141 | 1.458,4 m³ | 18.421 m² | 2.579 kB |
| `esquadrias` | 1 | 2 | 12 | 11 | 23 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 51 | 49,4 m³ | 634 m² | 110 kB |
| `casa-ambientes` | 2 | 4 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 2 | 11 | 66,5 m³ | 251 m² | 49 kB |

"Camadas" = `IFCMATERIALLAYERSET`; "Psets" = `IFCPROPERTYSET`; "Vãos" = `IFCOPENINGELEMENT`. Contagem de erros do
IfcOpenShell: **0** nos seis.

O que deve aparecer em cada modelo:

- **`house2`** — casa térrea de 2 quartos, 2 níveis, só paredes e esquadrias. Sem laje, telhado ou escada: itens 7
  a 10 do §4 não se aplicam. É o modelo mais rápido para a primeira conferência.
- **`studio`** — quitinete de um ambiente, 6 paredes, 2 portas e 3 janelas. Bom para ver vãos pequenos (J-03,
  0,60 × 0,60) e a transparência do vidro.
- **`house-premium`** — 3 níveis, 7 lajes, **1 telhado de 4 águas** (`IfcRoof`, 30 %, beiral 0,60 m) e **1 escada
  reta de 17 espelhos / 16 pisos**. É o modelo do checklist completo (itens 3 a 6, 9 e 10).
- **`predio10`** — 10 pavimentos, 240 paredes, 50 lajes e **10 escadas** (uma por pavimento, dois lances no
  núcleo). Sem telhado. Use para conferir repetição e desempenho do visualizador.
- **`esquadrias`** — mostruário: 2 paredes, **12 portas e 11 janelas** de todos os tipos do catálogo. Serve para
  ver folha, marco, peitoril e transparência sem distração.
- **`casa-ambientes`** — o único com **`IfcSpace`** ("Sala", número 101, 20 m² / 56 m³) e **`IfcGrid`** com os eixos
  **A** e **1**, além de **1 forro de gesso** (`IfcCovering .CEILING.`). Se o visualizador não mostrar o forro por
  padrão, ligue a visibilidade de `IfcCovering`/`IfcSpace` — eles existem no arquivo.

## 6. Evidência

Pasta (criada uma vez; `test-results/` está no `.gitignore`, então a evidência é local):

```powershell
New-Item -ItemType Directory -Force test-results/ifc-quality/capturas
```

Nome do arquivo: `<modelo>-<ferramenta>-<aspecto>.png`, tudo minúsculo, sem acento:

- `house2-any3d-3d.png`
- `house-premium-bonsai-3d.png`
- `house-premium-bonsai-telhado.png`
- `house-premium-bonsai-escada.png`
- `predio10-any3d-3d.png`
- `casa-ambientes-bonsai-ambiente-eixos.png`

Regras da captura:

1. Enquadre o modelo inteiro **e** um detalhe do item conferido; duas imagens por aspecto crítico.
2. Deixe visível na imagem a identificação do arquivo (barra de título do Blender, ou o nome no painel do
   visualizador). Se não der, o nome do PNG resolve — por isso a convenção acima.
3. Capture com `Win + Shift + S` (recorte) ou `Alt + Print Screen` (janela) e salve direto em `capturas/`.
4. Não recorte a ponto de esconder a escala: a parede e a porta precisam aparecer juntas.

Registro (opcional, mas recomendado): `test-results/ifc-quality/capturas/log.md`, uma linha por captura:

| Data | Modelo | Ferramenta (versão) | Captura | Resultado | Observação |
|---|---|---|---|---|---|
| 2026-10-29 | `house-premium` | Bonsai 0.8 / Blender 4.2 | `house-premium-bonsai-telhado.png` | ok | 4 águas, beiral 0,60 m |
| 2026-10-29 | `predio10` | Any3D (Chrome 141) | `predio10-any3d-3d.png` | ok | 10 pavimentos, sem telhado |

O mínimo para fechar o N3 é: **1 captura geral + 1 do aspecto crítico por modelo**, nos dois visualizadores
obrigatórios (Any3D e Bonsai) — 12 gerais (6 modelos × 2 ferramentas) + 6 a 8 detalhes (telhado, escada, vidro,
ambiente/eixos). ConstructCAD entra se estiver instalado.

Se a evidência precisar ser versionada, anexe os PNG ao PR/issue; não commite `test-results/`.

## 7. Limitações (leia antes de registrar falha)

- **Any3D não valida semântica.** Ele desenha malha e pinta por tipo de elemento; não lê `Qto_*`, psets nem
  `IfcMaterialLayerSet`. Ausência de cor de material ali não é falha do arquivo.
- **Cor depende do caminho de estilo.** O exportador escreve o estilo no **material**
  (`IfcMaterialDefinitionRepresentation → IfcStyledItem → IfcSurfaceStyle`), não no item de representação. Um
  visualizador que só leia `IfcStyledItem` ligado ao `IfcRepresentationItem` mostra tudo cinza. Confira o estilo no
  texto antes de registrar:
  `(Select-String -Path test-results/ifc-quality/house2.ifc -Pattern 'IFCSURFACESTYLE\(').Count` — deve haver um
  por material (no `house2`, 17 — igual ao número de `IFCMATERIAL`).
- **Bonsai, Revit e ArchiCAD reconstroem tipos e juntas.** Parede que chega dividida em dois trechos, porta que
  vira família nativa, telhado que vira telhado do programa: esperado. O contrato exato só vale Hestia → IFC →
  Hestia (N4).
- **`IfcSpace` e `IfcGrid` não são geometria "de ver" em todo visualizador.** Podem vir desligados por padrão ou
  virar sólidos/caixas. Confira no Bonsai e na contagem do §5.
- **Telhado e escada são malhas por água/lance**, não sólidos únicos. Um programa que una tudo num sólido está
  reconstruindo, não corrompendo.
- **N3 é manual e não é gate de CI.** Não existe automação honesta para "a cor está certa"; o gate automático para
  no N2/N4.
- **Não há Revit nem ArchiCAD nesta máquina.** O N5 (interoperabilidade nos programas comerciais) continua
  aberto; este documento cobre Any3D, Bonsai e ConstructCAD.

## 8. Estado em 2026-10-29

Já fechado por script (reproduzível):

- 0 erros de `ifcopenshell.validate` nos 6 modelos;
- round-trip Hestia → IFC → Hestia exato nos 6 (`report.json` → `roundtripOk: true`);
- N2: 16 totais comparados, **0 fora da tolerância** (volume 0,5 %, área 1 %) — maior desvio relativo 0,007 %
  (`predio10`/paredes); os demais na ordem de 1e-13. Fonte: `ifcGeometryOf` × `validate.py --geometry`;
- estilos: 1 `IfcSurfaceStyle` + 1 `IfcMaterialDefinitionRepresentation` por material (vidro com
  `Transparency = 0,65`);
- forros (`IfcCovering .CEILING.`), espaços (`IfcSpace`) e eixos (`IfcGrid`) presentes no `casa-ambientes`;
- telhado de 4 águas e escada com lances no `house-premium`; 10 escadas no `predio10`.

Falta (é o trabalho deste documento):

1. rodar o checklist do §4 nos 6 modelos, em Any3D e Bonsai;
2. rodar no ConstructCAD, se instalado;
3. salvar as capturas em `test-results/ifc-quality/capturas/` e preencher o `log.md`;
4. abrir uma pendência para cada divergência real encontrada — com modelo, ferramenta, captura e item do §4.

Quando os passos 1–3 estiverem feitos sem divergência (ou com divergências aceitas e registradas), o N3 está
fechado. O N5 continua dependendo de Revit/ArchiCAD.
