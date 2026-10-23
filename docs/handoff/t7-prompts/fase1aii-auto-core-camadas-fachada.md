# Tarefa (T7 · Fase 1, parte A-II) — `auto` inteligente no contorno pelo núcleo + testes de camada e de fachada

Repositório: `<raiz-do-repositorio>` (monorepo TypeScript, vitest). Código e comentários em
**português**. Arquivos ≤ 420 linhas. Sem `console.log`. Sem dependências novas. Imports internos com extensão `.ts`.

O que já existe (commit anterior): `OutlineSource.extend?: 'finish' | 'core'` no modelo, `coreOutline` em `WallFaces`
(`packages/engine/src/faces.ts`), `outerPerimeter(p, levelId, near?, extend)` e `buildingOutlines` com cache
`nível|extensão` (`enclosed.ts`), e `resolveBoundary` repassando o `extend` no modo `perimeter` (`outlineBound.ts`).
**Não mexa nesses arquivos.** Não mexa em `junctionPlanar.ts`, `junctionLevel.ts`, `junctionNet.ts`, `floors.ts`,
`slabs.ts`, `packages/tools` nem `apps/`.

Leia antes: `packages/engine/src/layerOutline.ts` (função `layerOutlines`, ramo final do `auto`), o teste que já existe
`packages/engine/src/perimeterCore.test.ts`, `packages/engine/src/slabs.ts` (`ResolvedSlabLayer.polygon`),
`packages/engine/src/wallJunction.test.ts` (auxiliares `build`, `corte`, `junc`, `nivel`, `layerVolumes`, `multiArea`).

## 1. `packages/engine/src/layerOutline.ts` — `auto` no contorno pelo núcleo (decisão D3)

Perto do topo da função `layerOutlines`, calcular uma vez:

```ts
// Elemento de perímetro com contorno no núcleo (decisão 0026, D3): a camada do núcleo fica no contorno inteiro (que já
// está na face do núcleo) e as demais param na face interna da parede. Fora do modo core, `auto` continua como antes.
const perimetroCore = !linked && src?.mode === 'perimeter' && src.extend === 'core';
```

e no último `return` do `map` (hoje `return core[i] && corePoly ? corePoly : finish;`) usar:

```ts
if (perimetroCore && !core[i]) return regionMinusWalls(p, base, wallsNow(), { kind: 'face' }, zoneOf(i).z0, zoneOf(i).z1);
return core[i] && corePoly ? corePoly : finish;
```

Atualize o comentário da função (o bloco que descreve `auto`) explicando esse caso: elemento de perímetro com
`extend === 'core'` — camada fora do núcleo do elemento para na face interna da parede (`regionMinusWalls` com
`{ kind: 'face' }` e a faixa de cota da própria camada), camada do núcleo (e tipo sem camada estrutura) fica no contorno
do elemento. Término explícito (`face`, `nucleo`, `passa`, `{ ate }`, `{ cm }`) continua mandando e não muda.
Não mude nenhum outro ramo.

## 2. `packages/engine/src/perimeterCore.test.ts` — camadas do `auto` core (acrescentar um `describe`)

Cenário já usado no arquivo: quatro paredes de 0,20 m (`finish1 0,02 | structure 0,16 | finish1 0,02`), retângulo
4 × 3 m, `locationLine: 'coreExterior'`, juntas `miter` (a função `build()` do arquivo já faz isso — reuse-a).

Contas a mão, com `coreExterior` (a face externa do núcleo cai no eixo):
- contorno do elemento no modo core = retângulo 4 × 3 → **12,0 m²** (camada do núcleo);
- camada fora do núcleo para na face interna da parede: a face interna fica 0,16 (núcleo) + 0,02 (acabamento interno)
  = 0,18 m para dentro do eixo → retângulo (4 − 0,36) × (3 − 0,36) = 3,64 × 2,64 → **9,6096 m²**.

Tipos de laje a criar no projeto de teste (todos com `heightOffset: 0.15`, de modo que a laje cruze a altura das
paredes; use `makeSlab` e `{ ...base.slabTypes.ls_mac12!, id, name, code, layers }`):

| tipo | camadas (topo → base) | área esperada por camada (m²) |
|---|---|---|
| `ls_a` | `structure 0,12` | `[12,0]` |
| `ls_b` | `substrate 0,02` + `structure 0,15` | `[9,6096, 12,0]` |
| `ls_c` | `finish1 0,03` + `membrane 0` + `structure 0,10` | `[9,6096, 9,6096, 12,0]` |
| `ls_d` | `finish1 0,01` + `substrate 0,03` (sem estrutura) | `[12,0, 12,0]` |
| `ls_e` | `substrate 0,02` com `termino: 'passa'` + `structure 0,15` | `[12,0, 12,0]` |

Casos:

1. **`ls_a`** (só estrutura): a camada única é núcleo → 12,0 (borda na face externa do núcleo).
2. **`ls_b`**: substrato para na face interna (9,6096) e estrutura vai até o núcleo (12,0).
3. **`ls_c`**: acabamento e membrana param na face interna (9,6096 cada, a membrana também), estrutura até o núcleo.
4. **`ls_d`** (sem camada estrutura): o elemento inteiro é núcleo → todas as camadas em 12,0.
5. **`ls_e`**: `passa` é término explícito e continua vencendo → a camada não é recortada (12,0), igual à estrutura.
6. **Associatividade (D3 + brief §5.5)**: troque o tipo das paredes por `finish1 0,03 | structure 0,16 | finish1 0,02`
   (acabamento externo de 2 → 3 cm) e verifique que a área da camada do núcleo continua **12,0** e a da camada fora do
   núcleo continua **9,6096** (a face interna não se move: total − núcleo − acabamento interno = 0,18 em ambos), enquanto
   o perímetro de acabamento **muda** (12,2816 → 4,06 × 3,06 = 12,4236). Isso prova que a área da laje é associativa e
   não depende da espessura do acabamento externo.

Como ler o resultado: `resolveLevel(p, 'lv_0').slabs` (de `./resolve.ts`) traz `layers[i].polygon` (MultiPolygon);
use `multiArea` de `@hestia/geom` e `toBeCloseTo(esperado, 6)`. Cada caso com um comentário curto da conta feita à mão.
Importe o que faltar; mantenha o estilo e os imports com extensão `.ts`.

## 3. `packages/engine/src/wallJunction.test.ts` — caso de aceitação da fachada (acrescentar um `it`)

Reuse os auxiliares do arquivo (`PAREDE`, `camada`, `rect`, `nivel`, `junc`, `corte`, `multiArea`). Monte um cenário
novo **dentro do próprio `it`** (função local `cerca(extend)`), com paredes fechando o retângulo **em sentido horário**
para a face externa ficar para fora:

- paredes `w1 (0,3)→(4,3)`, `w2 (4,3)→(4,0)`, `w3 (4,0)→(0,0)`, `w4 (0,0)→(0,3)`, tipo `wt_t` com `layers: PAREDE`
  (0,02 / 0,16 / 0,02), `height: 2.9`, `locationLine: 'coreExterior'`, `joinStart`/`joinEnd` miter;
- laje `s1` de tipo `ls_t` = `[camada('structure', 0.1)]` no nível `lv_0`, `heightOffset: 0.15` (faixa 0,05–0,15 m,
  dentro da altura das paredes) e
  `outlineSource: { mode: 'perimeter', seed: { x: 2, y: 1.5 }, linked: true, extend }`.

Asserções (valores conferidos a mão):

1. **Acabamento externo intacto**: com `extend: 'core'`, `corte(p, 0.10).layers[0]` é a **mesma camada** do nível
   (`nivel(p).walls.w1!.layers[0]`), ou seja, não foi recortada em cota nenhuma; e a área dela na cota 0,10 é **igual** à
   do mesmo projeto **sem laje** (compare os dois `multiArea`, não um número fixo: a esquadria mexe nos cantos).
2. **Núcleo da parede perde a faixa**: na cota 0,10 a área da camada 1 (núcleo) é **0** (`toBeCloseTo(0, 6)`), porque a
   laje ocupa toda a faixa do núcleo dentro do contorno: é a faixa cedida, sem sobra.
3. **A laje não perde nada**: `junc(p).elements.get('s1')!.cut` é `false`.
4. **Controle (prova o diagnóstico)**: com `extend: 'finish'` — ou seja, a laje até a face externa do acabamento — o
   acabamento externo **é recortado**: `corte(controle, 0.10).layers[0]` não é a camada do nível e a área dela é
   **menor** que a do caso do núcleo (use `toBeLessThan`).

Título do `it` em português: `'perímetro do núcleo: a laje no núcleo deixa o acabamento externo contínuo (e o de acabamento recorta)'`
(ou equivalente mais claro). Comentários curtos com a conta e a referência à decisão 0026.

## Proibições

- Mexer **somente** em `packages/engine/src/layerOutline.ts`, `packages/engine/src/perimeterCore.test.ts` e
  `packages/engine/src/wallJunction.test.ts`.
- Não editar `package.json`, `docs/`, outros pacotes nem `apps/`.
- Não rodar `npm install`, `git checkout`, `git reset`, `git push`; não criar commit.

## Verificação antes de responder

```
npx tsc -p tsconfig.json --noEmit
npx vitest run packages/engine
```

Baseline: 126 arquivos / 1748 testes verdes antes desta parte. Se algum teste antigo quebrar, o ramo novo está
capturando casos que não devia (o `auto` fora do perímetro core tem de ficar idêntico).

## Resposta final

Em português, curto: (a) o que mudou em cada arquivo (trechos principais), (b) como cada área esperada foi calculada a
mão, (c) saída resumida de `tsc` e `vitest run packages/engine`, (d) qualquer desvio do que foi pedido.
