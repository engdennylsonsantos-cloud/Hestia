# 0028 · Cotas automáticas da planta

Origem: pedido do dono (2026-10-23), inspirado no `generateAutoDimensions` do ArquiFácil: em vez de cotar parede por
parede, o comando monta as cotas da edificação inteira em **camadas por lado**. Companheira da
[0019](0019-anotacoes.md), que define a cota manual, o modelo e o desenho.

## 1. O que o comando faz

`cotasAutomaticas(p, levelId, opts)` (`packages/engine/src/autoCotas.ts`) devolve as cotas do nível ativo prontas para
entrarem no modelo, no mesmo formato da cota manual (`Dimension`). Elas são gravadas como qualquer outra: desfazem com
Ctrl+Z, aparecem na planta, no DXF (camada `COTAS`) e no painel de propriedades.

Para cada um dos quatro lados (sul, norte, oeste, leste), o gerador:

1. projeta as coordenadas relevantes no eixo do lado (x para sul/norte, y para oeste/leste);
2. monta **camadas** de coordenadas, sempre de dentro para fora: **aberturas → paredes → total**;
3. emite uma cota por trecho entre coordenadas vizinhas, cada camada no seu `offset` (`0,60 m` da primeira,
   `+0,45 m` por camada);
4. descarta camada com a mesma lista de coordenadas de outra (o **total** só entra quando difere das paredes);
5. deduplica coordenadas a **2 cm** e descarta trechos abaixo de **1 cm**.

As pontas de parede viram `refs: { wallId, end }`: a cota é associativa e acompanha a parede quando ela muda de posição
(0019 §1). As coordenadas de abertura não têm referência e ficam livres no ponto guardado.

## 2. Interface

Botão **Cotas auto** no grupo **Anotar** da aba **Arquitetura**, depois de **Cota** (Y) e **Texto** (X). É uma **ação**,
não uma ferramenta: executa uma vez no nível ativo e mantém a ferramenta atual; não tem atalho nem estado "ligado".
O mesmo comando está disponível no console do navegador por `editor.cotasAutomaticasDaPlanta()`.

A ação usa `lados: 'todos'` e os padrões do motor. Escolher um lado só, esconder aberturas ou mudar `offset` e
`espacamento` ainda não tem controle na interface; o motor já aceita (`lados`, `clique`, `offset`, `espacamento`,
`aberturas`, `paredes`).

## 3. O que não faz

- **Não apaga nem regenera** cotas antigas: rodar de novo cria outra leva. A limpeza é manual (seleção + Delete).
- **Não cota o contorno de piso ou laje** isoladamente: as coordenadas vêm das paredes e das aberturas hospedadas nelas.
- **Não escolhe o lado pela vista**: os quatro lados são sempre cotados.
- A camada de aberturas é montada com as coordenadas de **todas** as aberturas do nível projetadas no eixo do lado;
  uma janela da parede norte também aparece na cadeia do lado sul. É o comportamento do ArquiFácil e o que a baseline
  registra. Se o dono preferir só as aberturas da parede paralela àquele lado, é uma mudança localizada no motor.
- Sem cota de nível, de ângulo ou de arco; sem estilo de cota.

## 4. Testes

- `packages/engine/src/autoCotas.test.ts` (6 casos): sem parede não gera cota; porta de 0,90 gera camada própria e o
  total é suprimido quando coincide com as paredes; as cotas saem para fora do ambiente; referência associativa
  presente; quatro lados sem camada repetida; afastamento de 0,60 m e 1,05 m; sem aberturas sobra uma cota de 6,00 m.
- Regressão visual `cotas-automaticas` (`tests/e2e/visual-regression.mjs`): casa 8 × 6 m com porta na parede sul e
  janela na norte, quatro lados, camadas de aberturas e total. Baseline nova, conferida a olho (os valores 0,80 / 1,00 /
  1,20 / 8,00 m e 6,00 m aparecem fora do contorno). A/B no mesmo ambiente: **0,000%**.

## 5. Verificação

`npx tsc -p tsconfig.json --noEmit` limpo, `npx eslint apps/web/src/ui/Ribbon.tsx` sem avisos e build
`npm run build -w @hestia/web -- --target esnext --minify false` verde. Os casos antigos da regressão visual continuam com
o ruído de ambiente já documentado (~0,373–0,747%, banner "Sem GPU" e texto/hachura); as baselines antigas não foram
regravadas.
