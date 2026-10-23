# 0029 · Avisos do projeto (abertura, topo de parede e parede na laje)

Origem: pedido do dono (2026-10-23) para o painel de avisos apontar três situações que a validação do modelo não vê:
abertura que passa do eixo da parede, paredes alinhadas com topos desnivelados e parede atravessando a camada `passa`
de uma laje. O motor calcula em `packages/engine/src/projectIssues.ts`; a interface junta em `useIssues`.

## 1. Onde entra

`projectIssues(p)` devolve `ValidationIssue[]` e é somado em `apps/web/src/editor/useIssues.ts` depois de
`wallFloorIssues`. Fica **fora** de `validateProject`: a validação do modelo continua com os mesmos códigos, e
`casaAltoPadrao.test.ts` (que exige zero problemas em `validateProject`) não muda.

Pisos, lajes e telhados só são resolvidos quando o projeto tem um par candidato de topos (paredes colineares no mesmo
nível) ou uma laje existente com camada `passa`; um modelo grande sem esses casos não paga a resolução (o `predio10`
fica em poucos milissegundos).

## 2. `abertura-fora-da-parede`

Para cada abertura com parede e tipo existentes, compara `offset + largura do tipo` com o comprimento do eixo da parede.
Passa de 1 mm de folga, avisa. O `offset` do modelo é a distância do **centro** da abertura ao início da parede
(`types.ts`, `clampOffset`), mas a regra pedida pelo dono lê o offset como o **início** do vão: é essa leitura que
identifica os seis casos reais da casa de alto padrão.

Os seis casos ficam no template `house-premium` e são esperados, não regressão: T2, T11, T13, T14, T15 e J8. Os
templates `house2` e `studio` tinham um caso cada (janela `to_7` da parede norte e `to_17` da parede leste) e foram
ajustados para o limite exato do eixo (offsets 8,50 m e 4,40 m) para abrirem sem aviso. `blank`, `house2`, `studio` e
`predio10` ficam limpos.

A mensagem mostra offset, largura, soma e comprimento do eixo. Não corrige a abertura: o ajuste é manual.

## 3. `parede-topo-desnivelado`

Duas paredes do mesmo nível, retas e praticamente colineares (1° e 1 cm), que se sobrepõem ou se tocam ao longo do
eixo, com **topos resolvidos** diferentes em mais de 1 mm. O topo vem de `wallZRange`, então piso, laje e topo de nível
já entram na conta. Ficam fora:

- parede curva (`sag ≠ 0`);
- perfil superior editado (`topProfile`);
- topo anexado ao telhado (`attachTopToRoof`), porque o perfil segue a água;
- topo com perfil em degraus (piso ou laje cobrindo só parte do eixo).

O aviso liga as duas paredes (`elementId` na primeira, `ids` com as duas) e mostra os dois topos.

## 4. `parede-dentro-da-laje`

Só camadas de laje com término explícito `passa` (0025): a camada continua sob a parede, sem recorte, e o trecho comum
pode ser contado duas vezes (consequência conhecida em `docs/08`). Para cada parede, cinco amostras do eixo são testadas
no polígono resolvido da camada; se a faixa de cota da parede (`wallZRange`) cruza a faixa da camada em mais de 1 mm,
avisa. Laje inclinada usa `slabRiseAt` na amostra.

Sai **um aviso por parede e laje**, com a camada de maior interseção. Lajes sem `passa` não entram, e os templates não
têm `passa`, então nenhum deles avisa. A mensagem informa a camada (1-based) e o trecho comum; não desconta nada.

## 5. Testes

`packages/engine/src/projectIssues.test.ts` (17 casos):

- abertura: offset + largura passando do eixo, limite exato sem aviso, os seis ids do `house-premium` e os quatro
  templates limpos;
- topo: topos diferentes, iguais, níveis diferentes, deslocamento lateral maior que 1 cm, ângulo maior que 1°, parede
  curva e perfil superior;
- laje: camada `passa` com parede dentro, laje sem `passa`, base acima da camada e parede fora do contorno.

## 6. Verificação

`npm run lint` (fronteiras, paridade e porta de qualidade) verde; `npx tsc -p tsconfig.json --noEmit` limpo;
`npx vitest run --maxWorkers=4` com 293 arquivos e 3568 testes passando; build
`npm run build -w @hestia/web -- --target esnext --minify false` verde (`dist/index.html` com 6.452,60 kB). O
`npm run check` padrão continua sujeito a dois timeouts por carga nesta máquina (`predio10` e `ifcExport`); os mesmos
testes passam em paralelismo menor.
