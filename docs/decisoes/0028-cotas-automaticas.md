# 0028 · Cotas automáticas da planta

Origem: pedido do dono (2026-10-23), inspirado no `generateAutoDimensions` do ArquiFácil: em vez de cotar parede por
parede, o comando monta as cotas da edificação em **camadas por lado**, com **critérios de seleção** do que cotar.
Companheira da [0019](0019-anotacoes.md), que define a cota manual, o modelo e o desenho.

## 1. O que o comando faz

`cotasAutomaticas(p, levelId, opts)` (`packages/engine/src/autoCotas.ts`) devolve as cotas do nível ativo prontas para
entrarem no modelo, no mesmo formato da cota manual (`Dimension`). Elas são gravadas como qualquer outra: desfazem com
Ctrl+Z, aparecem na planta, no DXF (camada `COTAS`) e no painel de propriedades.

Para cada lado escolhido (sul, norte, oeste, leste), o gerador:

1. separa as paredes do lado: as da metade voltada para ele, em **paralelas** e **perpendiculares** ao eixo de medição;
2. **só cota o lado que tem parede paralela a ele** — sem parede vertical não nascem cotas verticais;
3. com `somenteExternas` (padrão), descarta as paredes paralelas escondidas atrás de outra (teste de sombra em 5
   amostras) e as perpendiculares que não encostam no contorno mantido;
4. projeta as coordenadas no eixo do lado (x para sul/norte, y para oeste/leste) e monta as camadas escolhidas, de
   dentro para fora: **aberturas → paredes (estruturas) → contorno (geometria) → total (geral)**;
5. emite uma cota por trecho entre coordenadas vizinhas, cada camada no seu `offset` (`0,60 m` da primeira,
   `+0,45 m` por camada), ancorado na face de referência do lado;
6. descarta camada com a mesma lista de coordenadas de outra (o **total** só entra quando difere do contorno);
7. deduplica coordenadas a **2 cm** e descarta trechos abaixo de **1 cm**.

### Camadas

- **Aberturas**: contorno do lado + o **centro** ou as **arestas** de cada vão. A abertura entra **só no lado da parede
  que a hospeda** — uma janela da parede norte não aparece na cadeia do sul. A corrente vai de ponta a ponta da fachada,
  então a cota mostra a posição do vão e a largura, não só a largura.
- **Paredes (estruturas)**: as duas faces de cada parede perpendicular (espessuras e vão livre) e as pontas livres das
  paralelas.
- **Contorno (geometria)**: uma face por parede perpendicular (o degrau do contorno) e as pontas livres das paralelas.
- **Total (geral)**: mínimo e máximo do contorno.

### Referência da parede

`referencia` escolhe a face usada na medição e no afastamento: `externa` (acabamento externo, padrão), `nucleo` (face
do núcleo) ou `eixo` (linha de localização). No eixo, as duas faces da parede colapsam e a camada de estruturas vira o
próprio total; nas faces externas aparecem as espessuras (0,18 m no `wt_alv14`).

### Referências associativas

As pontas de parede viram `refs: { wallId, end, axis }`: a cota acompanha a parede quando ela muda de posição (0019 §1)
e o `axis` projeta a ponta no eixo do lado. Sem essa projeção, uma cadeia que mistura pontas em alturas diferentes
mediria a diagonal em vez da distância ao longo da fachada.

## 2. Interface

Botão **Cotas auto** no grupo **Anotar** da aba **Arquitetura**, depois de **Cota** (Y) e **Texto** (X). É uma **ação**,
não uma ferramenta: abre o diálogo e mantém a ferramenta atual; não tem atalho nem estado "ligado". O comando também
está disponível no console por `editor.cotasAutomaticasDaPlanta(opts)`.

O diálogo **Cotas automáticas** oferece:

- **O que cotar**: total, contorno exterior, paredes/estruturas e aberturas (as quatro ligadas por padrão);
- **Aberturas por**: arestas do vão (padrão) ou centro da abertura;
- **Referência da parede**: faces externas (padrão), faces do núcleo ou eixos;
- **Cotar**: os quatro lados (padrão) ou um lado só (sul, norte, oeste, leste);
- **Afastamento inicial** (0,60 m) e **entre camadas** (0,45 m);
- **Apenas o contorno externo** (padrão ligado).

O motor também aceita `paredes` (só estas paredes, via `apenasParedes`), `clique` + `lados: 'maisProximo'` e
`modoAberturas`, mas o diálogo usa a escolha explícita de lado.

## 3. O que não faz

- **Não apaga nem regenera** cotas antigas: rodar de novo cria outra leva. A limpeza é manual (seleção + Delete).
- **Não cota o contorno de piso ou laje** isoladamente: as coordenadas vêm das paredes e das aberturas hospedadas nelas.
- **Não cota parede curva ou diagonal**: o motor considera só paredes retas horizontais ou verticais (`sag = 0`).
- **Não usa o clique** para escolher o lado no diálogo: a escolha é explícita no campo **Cotar**.
- Sem cota de nível, de ângulo ou de arco; sem estilo de cota.

## 4. Testes

- `packages/engine/src/autoCotas.test.ts` (14 casos): sem parede não gera cota; **lado sem parede paralela não recebe
  cota** (o caso do projeto só com paredes horizontais); abertura só no lado da parede hospedeira; centro × arestas;
  as duas faces da camada de estruturas; referência pelo eixo; total suprimido quando coincide com o contorno;
  referência projetada no eixo; cadeia reta entre pontas em alturas diferentes; contorno externo ignora divisória
  escondida; a face externa é escolhida pelo lado (independe do `flipped` da parede); afastamento de 0,60 / 1,05 /
  1,50 m; nenhuma camada escolhida; quatro lados.
- `packages/model/src/dimension.test.ts`: referência com `axis` projeta só a coordenada do eixo.
- Regressão visual `cotas-automaticas` (`tests/e2e/visual-regression.mjs`): casa 8 × 6 m desenhada no sentido horário,
  porta na parede sul e janela na norte, critérios do diálogo fixados no caso. Baseline nova, conferida a olho (8,18 m
  no total, 0,18 m de espessura, 7,82 m de vão livre, 1,69 / 0,80 / 5,69 m na porta e 2,49 / 1,20 / 4,49 m na janela).
  A/B no mesmo ambiente: **0,000%**.

## 5. Verificação

`npx tsc -p tsconfig.json --noEmit` limpo, ESLint dos arquivos alterados sem avisos e build
`npm run build -w @hestia/web -- --target esnext --minify false` verde. Os casos antigos da regressão visual continuam com
o ruído de ambiente já documentado (~0,373–0,747%, banner "Sem GPU" e texto/hachura); as baselines antigas não foram
regravadas.
