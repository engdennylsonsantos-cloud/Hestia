# 08 · Pendências e correções

Documento de trabalho: o que está quebrado, o que já foi medido, como corrigir e como provar que a correção
funcionou. Escrito para ser retomado em outra máquina sem depender da conversa que o gerou.

Estado em que foi escrito: branch `claude/trusting-lamport-28zmit`, sobre `4ca0d10`, com o working tree descrito
na seção 2. Nada de geometria foi alterado nesta rodada — só instrumentação, testes e scripts.

---

## 1. Resumo

| ID | Defeito | Severidade | Estado | Onde |
|---|---|---|---|---|
| **P-1** | `difference()` entrava em laço no polygon-clipping (~10 s por tentativa sem limite) quando as coordenadas são transladadas; a resolução da semente 24 transladada custava 339 s | **alta** (trava a interface) | **corrigido** (`clipReturn` vai direto ao Clipper + memoização; seed 24 transladada: 339 s → 1,1 s) | `resolve.ts`, `boolean.ts` |
| **J-1** | Acabamento cortado pelo núcleo em **encosto** e **esquadro**: 75% e 74% da área do canto que em esquadria é do acabamento da fina passa para o bloco da grossa | **alta** (visual) | medido, **não corrigido**; aviso e lote cobrem o esquadro (§8.1, **decidido: sim**) | `joins.ts` |
| **J-2** | Nó de **3+ paredes** ignora a configuração de junção e aperta o núcleo da parede grossa | **média** (visual + UI enganosa) | medido, **não corrigido** | `joins.ts` (`starNode`) |
| **T-1** | Guardas de sobreposição vacuamente verdadeiras: `intersection(x.cut, y.cut)` é sempre 0 | **média** (teste que não testa) | provado, **não corrigido** | `quinas.test.ts` |
| **I-1** | `npm run test:completo` não rodava no Windows (sintaxe POSIX) | média | **corrigido** (`scripts/completo.mjs`) | `package.json` |
| **I-1b** | Suíte completa sai com código 1 por ruído do vitest (`Timeout calling "onTaskUpdate"`) mesmo com tudo passando | **alta para CI** | **aberto** | infra do vitest |
| **I-2** | Filtro `--seed` do script rápido casava por prefixo (`--seed 4` rodava 40–49) | média | **corrigido** (lookahead) | `scripts/test-esquadria.mjs` |
| **I-3** | `K4` (500 paredes) reprova **até isolado**: 1768 ms a quente contra limite de 1500 ms. `snapFaces` reprova na suíte inteira (2117 ms) e passa isolado (1241 ms) | **alta** (portão de qualidade vermelho) | medido, **não corrigido** | `perf.test.ts`, `snapFaces.test.ts` |
| **I-4** | `build:artifact` não verificado | baixa | não verificado | `scripts/make-artifact.mjs` |

---

## 2. Retomar em outra máquina

```powershell
git clone https://github.com/engdennylsonsantos-cloud/Hestia.git
cd Hestia
git switch claude/trusting-lamport-28zmit   # a branch de trabalho; `main` está atrasada
npm ci
```

Conferência do estado (tudo abaixo tem de passar antes de começar a mexer):

```powershell
npm run typecheck                                  # ~40 s, zero error TS
npm run lint                                       # ~30 s, exit 0
npx vitest run packages/geom/src/booleanSweep.test.ts          # 3 testes, ~6 s
npx vitest run packages/engine/src/juncoesAcabamento.test.ts   # 7 testes, ~4 s
npm run test:rapido:esquadria                      # semente 24, 5 testes, ~19-31 s
```

`npm test` (suíte normal, 15 sementes) e `npm run check` (lint + typecheck + test) são os portões de qualidade
antes de qualquer commit.

---

## 3. Instrumentação criada nesta rodada

Nada disso é correção: é o que permite iterar em segundos em vez de dezenas de minutos.

### 3.1 `npm run test:rapido:esquadria` → `scripts/test-esquadria.mjs`

Roda **uma** semente da suíte de propriedades com o limite do sweep line baixado, em ~19–31 s.

- Injeta `POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS=3000`, `POLYGON_CLIPPING_MAX_QUEUE_SIZE=3000` e `VITE_FULL=1`
  no `env` do filho (o polygon-clipping lê o limite **uma vez, no import** — `dist/polygon-clipping.cjs.js:1678`;
  por isso não adianta setar depois).
- Filtro por regex com lookahead negativo: `semente N(?!\d)`. **Não use `-t "semente N"`** (casa 40–49) nem
  `-t "semente N >"` (casa **zero** testes e sai 0 — o `>` existe só no nome do reporter, não em
  `getTaskFullName`, que é o que o filtro compara; ver `node_modules/@vitest/runner/dist/chunk-hooks.js:1031,1067`).
- Faixa validada 1..60; fora dela sai 2 com mensagem.
- **Limite conhecido:** filtro que casa zero testes ainda sai 0. Conferir sempre o `Tests 5 passed` na saída.
  Blindar isso exigiria `--reporter=json --outputFile` e contar os testes.

### 3.2 `packages/geom/src/__fixtures__/sweepLoop.ts` + `packages/geom/src/booleanSweep.test.ts`

O caso real do motor que estoura, congelado: `a` = 2 polígonos (8 pontos), `bs` = 33 polígonos (900 pontos),
`difference(a, ...bs)`. Foi gravado do dump `hestia-dump.json (arquivo local, fora do repositório)`
(SHA256 `DBB71F413C575E395DE82C2B5B04584AF5D5D969F4714ADB5D9DFBB98FBFC5A1`).

- É `.ts` e não `.json` de propósito: o repositório **não tem `@types/node`** e `packages/*/src` entra no
  `tsconfig` — ler arquivo com `node:fs` quebra o `typecheck` do CI. Importar o JSON também não serve: o TS
  inferiria um tipo literal gigante.
- Três testes: (1) o caso resolve em < 1 s com área de referência `0.002319941982005247 m²` (desde a correção do P-1 mede `differenceClipper`, o caminho que `clipReturn` usa); (2) tabela de
  diagnóstico por grade de snap; (3) `it.fails` guardando o defeito atual — **quando a correção entrar, esse
  teste passa a falhar de propósito** e deve ser removido ou convertido em `it`.

### 3.3 `packages/engine/src/juncoesAcabamento.test.ts`

Mede a junção por tipo: área por material numa caixa em volta do canto, para L (`miter`/`butt`/`square`), T e nó
de 3 paredes. Só asserções fracas (finito, ≥ 0, total = soma das linhas) — é medição, não veredito. **Imprime as
tabelas em todo `npm test`**; se incomodar, gate os `console.log` atrás de uma variável de ambiente.

### 3.4 `scripts/completo.mjs`

`npm run test:completo` agora usa este script em vez de `VITE_FULL=1 vitest run`. A forma antiga é sintaxe POSIX
e o npm no Windows usa `cmd.exe` (quando `script-shell` é `null`, que é o caso aqui) — o script nunca rodou nesta
máquina. A variável agora é injetada no `env` do filho, então funciona em qualquer shell.

---

## 4. P-1 · Laço do sweep line (desempenho) — corrigido

### 4.1 Sintoma

`resolveLevel` de um cenário com 30 paredes / 140 itens / 6 vãos (semente 24 de `property.test.ts`, modo completo).
Medido sem nenhum limite de polygon-clipping (produção):

| caso | antes (código original) | depois |
|---|---|---|
| coordenadas originais (R) | 2,1 s, 0 falhas | 1,5 s, 0 falhas |
| **transladado** por `{3.7, −2.1}` (S) | **339 s**, 32 falhas, ~10,5 s cada | **1,1 s**, 0 falhas |

O sintoma visível ao usuário é travar a interface por minutos. O doc anterior dizia 1239 s; nesta rodada a mesma
semente deu 339 s (outra máquina). O gatilho é a **translação**: coordenadas não redondas.

### 4.2 Causa

`resolve.ts` chama `clipReturn` dentro do laço de faixas de altura e na planta: `difference(retornoDeAcabamento,
...paredesPintadas)`. O operando é pequeno (2 retângulos contra ~33 polígonos). As 32 falhas da semente 24
transladada vêm **todas** dessa chamada. Mensagem: `Infinite loop when passing sweep line over endpoints
(too many sweep line segments)`. O `robust()` cai no Clipper só depois de 1e6 segmentos.

O `SNAP = 1e7` de `toPc` cria o contato vértice-sobre-aresta que o sweep line não resolve. Isso fica como está
(decisão: não mexer no snap, ver 4.4).

**Correção de premissa (medida):**
- O laço aparece só na **transladada**; a semente original não tem nenhuma falha em produção.
- O limite `POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS=3000` do script rápido **não serve para contar falhas**: com ele,
  a semente original mostra 20 "falhas", mas todas são sweeps legítimos grandes que passam com 1e6. O número de
  falhas e o tempo só são confiáveis no limite de produção.
- Trocar a grade do snap continua sendo loteria (1e6 passa, 1e7 falha, 1e8 passa, 1e9 falha; §4.2 antigo).

### 4.3 O que a correção faz

1. **`differenceClipper(a, ...bs)`** (`boolean.ts`): diferença direto pelo Clipper, com o mesmo `reduce` de
   `clipperBinary` que o fallback de `difference` já usava. A saída é idêntica à do fallback.
2. **`clipReturn` usa `differenceClipper`** (`resolve.ts`, `clipOf`). Retornos de acabamento são pequenos e não
   precisam da precisão sub-micrométrica do polygon-clipping (a do Clipper é de 1 µm).
3. **Memoização de `clipReturn`** por (retorno, conjunto pintado). O mapa de tinta é o cache de `paintFor` (um por
   conjunto ativo), então a identidade do mapa é a identidade do conjunto. A chave do retorno é o objeto
   `{ poly }` (não `(parede, camada, vão)`, porque `insertReturns` pode gerar mais de um retorno por camada e
   vão). Vive só dentro de `solveCluster`, então não cresce entre clusters.
4. **Telemetria barata** (`booleanStats()` / `resetBooleanStats()`): chamadas por operação, tentativas exatas,
   falhas, tempo, vértices de entrada, motivo do erro e `clipperDirect`. Sem efeito no resultado.

**Não aplicado (e por quê):**
- **Pré-check genérico vértice-sobre-aresta** (4.4-b, tentado e removido). Com tolerância de 1 unidade de snap
  (1e-7 m) mandava 30% das chamadas para o Clipper, e na análise de falsos positivos a maioria dava certo no
  polygon-clipping. Como as falhas vêm de `clipReturn`, ir direto ao Clipper lá resolve sem tocar as outras
  chamadas. Removido: não altera áreas nem custa tempo fora do caso patológico.
- **Baixar `POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS` em produção** (4.4-d): não feito. Não há medida do maior número
  de segmentos de um sweep legítimo, então não há base para escolher um valor. Com ele, um laço custaria
  `limite/1e6 × 10 s`.

### 4.4 Medições

Código original (`6a5dfbc`) versus código novo. Produção = sem variáveis `POLYGON_CLIPPING_*`.

| medida | antes | depois |
|---|---|---|
| semente 24 transladada, produção | 339 s, 32 falhas do sweep | 1,1 s, 0 falhas |
| semente 24 original, produção | 2,1 s | 1,5 s |
| `npm run test:rapido:esquadria` (wall) | 11,5 s | 4,8 s |
| `booleanSweep` teste 1 (fixture = chamada de `clipReturn`; antes medido com `difference`, cap 3000) | 104 ms | 14,9 ms |
| 60 sementes, produção: falhas do sweep (R+S) | não medido para as 60 no código original (semente 24: 32, só na S) | 1 (semente 45 R, ver 4.5) |
| 60 sementes, produção: chamadas `difference` (R+S) | não medido | 22272, das quais 1237 diretas ao Clipper (`clipperDirect`) |
| 60 sementes, produção: maior diferença de área total | — | 2,7e-5 m² (tol `max(5e-5, 2e-4·t0)` ≥ 6,7e-3) |
| 60 sementes, produção: áreas fora da tolerância | — | 0 |

Os 60 instantâneos de área foram comparados com `baseline.json` (código original, cap 3000, modo completo). A
base é com cap 3000, então a diferença mistura o efeito da correção (retornos em Clipper, ~1 µm) com o efeito do
cap; não foram separados. Maior diferença: 2,7e-5 m², dentro da tolerância. Semente 24 transladada: 27,0419119 m²
(original em produção, 32 retornos pelo fallback) contra 27,0419126 m² (nova): diferença 7e-7 m².

**Dourados:** `golden.test.ts`, `floorGolden`, `roofGolden`, `slabGolden`, `roofEdgesGolden` passam (53 testes).
Nenhum arquivo dourado foi alterado.

### 4.5 Pendências do P-1

- **Uma falha residual** (semente 45, lado R): `Unable to complete output ring starting at` em uma chamada de
  `difference` que não é `clipReturn`. Cai no Clipper como antes, sem laço, custo normal. Não investigado a
  origem.
- **`resolve.ts` está em 420 linhas de código** (limite do eslint). Qualquer mudança futura nele deve extrair o
  bloco de retornos (`clipOf`/`clipReturn`/memo) para um arquivo próprio, por exemplo `clipReturn.ts`.
- O teste 3 de `booleanSweep` (`it.fails` do snap 1e-7) segue verde: ele registra que o **polygon-clipping**
  continua laçando nesse snap. A correção não muda o polygon-clipping, só deixa de chamá-lo nos retornos.

### 4.6 Critérios de aceitação

- `npm run test:rapido:esquadria` ≤ 10 s — **4,8 s**, 5 testes verdes.
- Semente 24 transladada ≤ 15 s — **1,1 s** (produção).
- `booleanSweep.test.ts` teste 1 ≤ 100 ms e área `0.002319941982005247 m²` — **14,9 ms**, área exata.
- Nenhuma área de nenhuma semente muda além de `max(5e-5, 2e-4·t0)` — **0 de 60** (maior 2,7e-5 m²).
- Nenhum arquivo dourado muda sem justificativa — **nenhum mudou**; os 53 testes dourados passam.

---

## 5. J-1 · Acabamento cortado pelo núcleo (encosto e esquadro)

### 5.1 O que foi medido

L de 19 cm (`wt_ext19`) com 14 cm (`wt_alv14`), caixa de quina de 0,072000 m² (`juncoesAcabamento.test.ts`):

| material | esquadria | encosto | esquadro |
|---|---|---|---|
| bloco19 (estrutura, grossa) | 0,022800 | **0,040280** | **0,040280** |
| bloco14 (estrutura, fina) | 0,021560 | 0,008260 | 0,011340 |
| argamassa (substrato, grossa) | 0,000800 | 0,001440 | 0,001440 |
| cerâmica (finish1, grossa) | 0,000282 | 0,000320 | 0,000320 |
| reboco (substrato) | 0,010160 | 0,005800 | 0,003080 |
| tinta (finish2) | 0,001038 | 0,000540 | 0,000180 |
| **total na caixa** | **0,056640** | **0,056640** | **0,056640** |

Conclusões:

1. **Nada some** — o total é idêntico; o canto troca de dono.
2. Em encosto, **0,005100 m² (75%)** da área que em esquadria é do acabamento da fina passa a ser do bloco da
   grossa (acabamento da fina: 0,006776 → 0,001676 m²; a tinta cai de 0,000616 para 0,000116).
3. Em esquadro, **0,005020 m² (74%)**. O bloco da grossa dá exatamente o mesmo valor do encosto: em quina de 90°
   o esquadro **degenera em encosto**. Não são dois defeitos, é um.
4. A causa é a prioridade: `paint` (`resolve.ts:131`) ordena por prioridade crescente e subtrai as já aceitas;
   `structure = 1` corta `finish1 = 4` e `finish2 = 5` (`packages/model/src/priority.ts:8`).

### 5.2 Por que a esquadria resolveu

Porque trocou **sobreposição resolvida por prioridade** por **geometria que não se sobrepõe**: `pairDepth`
(`joins.ts:54`) mapeia uma profundidade de uma parede na correspondente da outra, em três regimes (fora do núcleo
desloca 1:1, dentro do núcleo interpola, depois do núcleo volta a 1:1), e `miterBreaks`/`miterPoint` geram os
vértices que as duas pontas compartilham.

A regra arquitetônica que ele codifica: **cada camada encontra a camada do mesmo tipo do outro lado**.

### 5.3 Por que os outros caminhos não pareiam

Todos cortam a extremidade com **um escalar** e deixam a sobreposição para o pintor:

| caminho | como corta | pareia? |
|---|---|---|
| `miter` (`joins.ts:202-209`) | cadeia por `pairDepth` | sim |
| `square` (`joins.ts:211-215`) | `outerExtension` calculado em profundidade **0** e aplicado a todas as camadas | não |
| `butt` (`joins.ts:216-222`) | a ponta do seguidor vai até a **linha de centro** da dominante | não |
| `tee` (`tryTee` → `toCenterline`, `joins.ts:335`) | idem: linha de centro da hospedeira | não |
| nó de 3+ (`starNode`, `joins.ts:253`) | setor a partir das **faces externas** | não |

### 5.4 Correção correta

Generalizar o pareamento de "propriedade da esquadria" para **propriedade da face da extremidade**, porque numa
extremidade há **duas faces** que podem ter vizinhos diferentes.

**Arquitetura alvo:** `EndSpec` deixa de carregar um vizinho por extremidade e passa a carregar um por **lado**:

```ts
type SideSpec =
  | { kind: 'flat'; t: number }
  | { kind: 'miter'; self: MiterSide; other: MiterSide };
interface EndSpec {
  /** face de s maior (externa do canto quando sigma > 0) */
  hi: SideSpec;
  /** face de s menor */
  lo: SideSpec;
}
```

`layerQuad` (`layerGeom.ts:70`) passa a montar cada lado com a sua própria cadeia (`chainBetween`), em vez de um
`ends.a`/`ends.b` único. Casos de hoje degeneram: numa junção de duas paredes, `hi` e `lo` recebem o mesmo vizinho
e o resultado tem de ser **bit a bit igual** ao atual.

**Passos, nesta ordem (cada um com a suíte verde):**

1. **Refatorar os tipos sem mudar comportamento.** `EndSpec` com dois lados; `computeEnds` preenchendo `hi.e lo`
   com o mesmo `SideSpec`; `layerQuad` consumindo. Critério: nenhum dourado muda.
2. **Nó de 3+ paredes (J-2).** Cada parede pareia com o vizinho **angular de cada lado** (o anterior e o próximo no
   sentido horário), reaproveitando `sideOf`/`pairDepth`. Aposentar `starNode`.
3. **T e encosto.** A ponta do seguidor para na **face do núcleo** (ou da camada correspondente) da dominante,
   em vez da linha de centro. Aqui é preciso **revisitar a decisão 0009 #1** — o comportamento atual é
   deliberado e tem aviso próprio; mudar exige atualizar a decisão, não só o código.
4. **`square`.** Não tem conserto por pareamento: um corte reto é um plano só e não pode respeitar limites de
   camada e cobrir o canto externo ao mesmo tempo. As opções são (i) manter e **avisar**, ou (ii) redefinir o que
   "esquadro" significa. Recomendo (i) — ver seção 8.

### 5.5 Critérios de aceitação

- No L 19×14, o acabamento da fina na caixa volta a **≥ 0,0065 m²** em `butt` (hoje 0,001676; esquadria 0,006776).
- Nenhuma camada de acabamento da fina com área dentro do **bloco cheio** da grossa (medido sobre a geometria
  pré-pintura, não sobre `cut` — ver T-1).
- Total na caixa continua idêntico ao da esquadria (nada pode sumir).
- Os cinco invariantes das 15 sementes seguem verdes.

### 5.6 Aviso importante de acoplamento

Qualquer pareamento novo **gera cadeias de vértices quase coincidentes** — exatamente o insumo do P-1. Portanto:

> **P-1 antes de J-1/J-2.** Mexer na junção antes de resolver o desempenho aumenta a superfície do travamento.

---

## 6. J-2 · Nó de 3+ paredes ignora a configuração

### 6.1 Medição

Nó com grossa 19 (0,0)→(4,0), fina 14 (0,0)→(0,3) e fina 14 (0,0)→(−2,−2). Caixa de 0,090000 m²:

| material | esquadria | encosto | esquadro |
|---|---|---|---|
| argamassa | 0,001464 | 0,001464 | 0,001464 |
| bloco14 | 0,038439 | 0,038439 | 0,038439 |
| bloco19 | 0,024983 | 0,024983 | 0,024983 |
| cerâmica | 0,000618 | 0,000618 | 0,000618 |
| reboco | 0,009315 | 0,009315 | 0,009315 |
| tinta | 0,000820 | 0,000820 | 0,000820 |
| total | 0,075640 | 0,075640 | 0,075640 |

**Delta zero em todos os materiais**: a escolha da UI é decorativa. Compare com o T, onde o bloco19 ocupa
0,057000 = 0,30 × 0,19 exatos (encosto limpo): no nó, o `starNode` dá setor às duas finas e **aperta o núcleo da
grossa** para 0,024983.

### 6.2 Causa

`resolveNode` (`joins.ts:290`) só chama `joinPair` — o único que lê `joinStart`/`joinEnd` — quando `g.length === 2`.
Com 3+ paredes vai para par colinear (`toCenterline`, também sem configuração) ou para `starNode`, que usa apenas
`sHi`/`sLo`/setores. Ou seja: **não existe caminho de esquadria para 3+ paredes**, qualquer que seja a escolha do
usuário.

### 6.3 Correção

Passo 2 da seção 5.4: pareamento por lado, com o vizinho angular de cada lado. Critérios:

- A área por material no nó **muda** entre `miter`, `butt` e `square` (hoje o delta é 0,000000).
- O bloco da grossa no nó fica **≥ 0,0280 m²** na caixa (largura cheia da metade da caixa; hoje 0,024983).
- Nenhuma camada de acabamento das finas entra no bloco cheio da grossa.
- Nenhum dourado muda; se mudar, é porque havia nó de 3 paredes nos cenários dourados e a mudança precisa ser
  justificada material por material.

---

## 7. T-1 · Guardas vacuamente verdadeiras

### 7.1 Prova

No L em esquadria, dentro da caixa de 0,072000 m²: o bloco19 ocupa 0,022800 m² e as camadas de acabamento da fina
têm área positiva **na mesma caixa** (tinta 0,000076 e 0,000540; reboco 0,000980 e 0,005180) — e mesmo assim
`multiArea(intersection(a.cut, b.cut))` dá **0,000e+0 exato** nos quatro pares.

Motivo: `paint` subtrai de cada camada as de prioridade menor já aceitas (e, na mesma prioridade, as de outra
parede — `resolve.ts:147`). Portanto `cut` **nunca** contém área de camada alheia: a interseção é zero por
construção, não por geometria correta.

Afetadas: `packages/engine/src/quinas.test.ts`, asserções nas linhas **74–78** e **175–177** (a de `nucleoReal`).
Elas são verdadeiras em qualquer configuração, inclusive na errada — e portanto **não distinguem esquadria de
encosto**, que é justamente o que deveriam guardar.

### 7.2 Correção correta

Testar sobre a **geometria pré-pintura**, não sobre `cut`. Duas opções:

- **(a) Expor a forma pré-pintura.** `ResolvedLayer` ganha o polígono de origem da camada (o `shape` do `Item`
  em `buildItems`), com nome explícito tipo `raw`. Aí a guarda vira
  `intersection(rawDoAcabamento, rawDoNucleo) < 1e-6` — que mede sobreposição de verdade.
- **(b) Medir redistribuição** (o que `juncoesAcabamento.test.ts` já faz): área por material numa caixa fixa,
  comparada entre configurações. Não precisa de API nova, mas não aponta a camada culpada.

Recomendo **(a)** para as guardas de quina e **(b)** para o teste de nó, onde o alvo é o efeito agregado.

### 7.3 Critérios de aceitação

- Com a junção deliberadamente quebrada (ex.: forçar `square` onde a guarda espera `miter`), a guarda **falha**.
  Esse é o teste do teste: hoje ela passaria.
- As guardas continuam verdes no estado correto.

---

## 8. Decisões que precisam do dono do projeto

1. **Aviso de quina em esquadro.** `buttCornerFinishPairs` filtra `join !== 'butt'`
   (`packages/model/src/validateJoins.ts:72,76`), então quina em **esquadro** com acabamento é **silenciosa**,
   apesar de ter 74% do canto comendo o acabamento da fina. Estender o aviso ao esquadro também faz o comando em
   lote "Quinas em esquadria" passar a corrigir essas quinas (a lista é compartilhada). É desejável? **Decidido: sim**
   (decisão 0009 #10): o aviso e o lote cobrem o esquadro; a 90° ele degenera em encosto.
2. **Aviso para nó de 3+ paredes.** Hoje não existe; e como a configuração é ignorada ali, o usuário não tem nem
   como corrigir pela UI. Ou se implementa o pareamento (5.4 passo 2), ou se avisa que não há o que fazer.
3. **Limite do sweep line em produção (4.4-d).** Só decidir com a telemetria de 4.5.1 na mão.
4. **`main` está atrás.** O trabalho vive em `claude/trusting-lamport-28zmit`. Mesclar em `main` quando P-1 e J-1
   estiverem fechados, não antes.
5. **CI roda só `npm test` (15 sementes)** (`.github/workflows/ci.yml`). A semente 24 não é coletada ali. Incluir
   a suíte completa no CI exige resolver antes I-1b (abaixo).

---

## 9. I-1b · Suíte completa sai 1 sem falha de teste

### 9.1 Sintoma

`npm run test:completo -- -t "semente 1(?!\d)"` coletou 302 testes (prova de que `VITE_FULL` propagou; sem ele
seriam 77), rodou 55 e **todos passaram**, mas o processo saiu com **código 1**:

```
Unhandled Error: Timeout calling "onTaskUpdate"
  [vitest-worker] node_modules/vitest/dist/chunks/rpc.-pEldfrD.js:53
Errors 1 error
```

O vitest marca a run como falha por um erro de infraestrutura dele, não por asserção. **Pré-existente**: o mesmo
erro aparece nos logs da execução de 20 minutos do defeito P-1.

### 9.2 Por que acontece

O RPC `onTaskUpdate` tem timeout e os testes de propriedade bloqueiam o worker por 5–15 s cada (`resolveLevel` é
síncrono e pesado). O `collect` também foi anômalo (88 s para 302 testes).

### 9.3 Caminhos de correção (do mais barato ao mais caro)

1. **Reduzir o bloqueio por teste**: dividir `property.test.ts` em arquivos menores por faixa de sementes, para
   cada worker ter tarefas mais curtas. Ataca a causa.
2. **Ajustar o timeout do RPC**, se o vitest 3.2 expuser configuração (`test.rpc`/`poolOptions`). Verificar na
   documentação da versão instalada antes de tentar.
3. **Aceitar como ruído conhecido** e, no CI, tratar o resultado pela contagem de testes (`--reporter=json` +
   `--outputFile` e contar `numPassedTests`/`numFailedTests`), não pelo código de saída.

Recomendo (1) e, se não bastar, (3) como contrato explícito do CI.

### 9.4 Critério de aceitação

`npm run test:completo` sai 0 com 60 sementes verdes, e o run inteiro termina em tempo compatível com o CI
(< 15 min).

---

## 10. Itens não verificados nesta rodada

| Item | O que falta |
|---|---|
| **K4** (`packages/engine/src/perf.test.ts`) | **Reprova até isolado**: a frio 2504 ms (limite 6000, ok), a quente **1768 ms** contra limite de 1500 ms. Dentro da suíte inteira: 3415 ms. Não é contenção. Bisectar contra `10aa3aa` para saber se é custo novo do pareamento em duas pontas (`4ca0d10`) ou lentidão da máquina |
| **`build:artifact`** | `npm run build:artifact` (`scripts/make-artifact.mjs`) nunca foi executado nesta rodada. Verificar que o artefato publica |
| **captura de faces** (`snapFaces.test.ts`) | 500 chamadas a `infer`: **1241 ms isolado** (passa) e **2117 ms dentro da suíte** (reprova, limite 1500). É **contenção**, não regressão: o limite não sobrevive a rodar em paralelo com 110 arquivos. Ou subir o limite, ou marcar o teste como isolado |
| **`npm test` / `npm run check`** | `npm run check` sai **1** por causa de K4 e `snapFaces` (I-3). **`lint` e `typecheck` passam** (eslint 0, `tsc` 0 erros). O portão está vermelho antes deste trabalho, não por causa dele: nenhuma alteração desta rodada toca `packages/engine` ou `packages/tools` |

---

## 11. Ordem recomendada de trabalho

| Ordem | Tarefa | Por quê | Orçamento |
|---|---|---|---|
| 1 | Telemetria do `robust()` (seção 4.3, item 4) | dimensiona o resto com número em vez de palpite | feito |
| 2 | **P-1**: `clipReturn` direto ao Clipper + memoização (seção 4) | feito: 339 s → 1,1 s; pré-requisito dos demais | feito |
| 3 | **T-1**: guardas sobre geometria pré-pintura (7.2a) | sem guarda confiável não se valida J-1 | 1 h |
| 4 | **J-1/J-2**: `EndSpec` por lado + nó por vizinho angular (5.4) | corrige o defeito visual de junção | 4–6 h |
| 5 | **I-1b**: ruído do vitest / CI (9.3) | libera a suíte completa em CI | 2 h |
| 6 | Decisões da seção 8 | fecham o escopo | — |
| 7 | Itens da seção 10 | verificação final | 1 h |

---

## 12. Resumo em uma frase por defeito

- **P-1**: o snap de entrada fabrica contato exato; o polygon-clipping entra em laço nos retornos de acabamento
  da semente transladada (339 s). Corrigido: retornos vão direto ao Clipper, com memoização. O snap não foi tocado.
- **J-1**: encosto e esquadro cortam todas as camadas com um escalar e deixam o núcleo comer o acabamento (75% e
  74% da área do canto). Corrigir com pareamento por face, e o esquadro provavelmente só com aviso.
- **J-2**: nó de 3+ paredes ignora a configuração e aperta o núcleo da grossa. Corrigir junto com J-1.
- **T-1**: as guardas de quina testam uma interseção que é zero por construção. Corrigir testando a geometria
  pré-pintura.
- **I-1/I-2**: os scripts de verificação rápida agora funcionam no Windows; o ruído do vitest na suíte completa
  ainda derruba o código de saída.
