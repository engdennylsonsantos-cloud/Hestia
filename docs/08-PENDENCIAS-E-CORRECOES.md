# 08 · Pendências e correções

Documento de trabalho: o que está quebrado, o que já foi medido, como corrigir e como provar que a correção
funcionou. Escrito para ser retomado em outra máquina sem depender da conversa que o gerou.

Estado em que foi escrito: branch `claude/trusting-lamport-28zmit`, sobre `4ca0d10`, com o working tree descrito
na seção 2. Nada de geometria foi alterado nesta rodada — só instrumentação, testes e scripts.

---

## 1. Resumo

| ID | Defeito | Severidade | Estado | Onde |
|---|---|---|---|---|
| **P-1** | `difference()` entra em laço no polygon-clipping e custa ~30 s por tentativa; a resolução do nível passa de 1,2 s para 20 min quando as coordenadas não são redondas | **alta** (trava a interface) | diagnosticado, **não corrigido** | `boolean.ts`, `resolve.ts` |
| **J-1** | Acabamento cortado pelo núcleo em **encosto** e **esquadro**: 75% e 74% da área do canto que em esquadria é do acabamento da fina passa para o bloco da grossa | **alta** (visual) | medido, **não corrigido** | `joins.ts` |
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
- Três testes: (1) o caso resolve em < 1 s com área de referência `0.002319941982005247 m²`; (2) tabela de
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

## 4. P-1 · Laço do sweep line (desempenho)

### 4.1 Sintoma

`resolveLevel` de um cenário com 30 paredes / 140 itens / 6 vãos:

| caso | sem limite | com limite (3000) |
|---|---|---|
| coordenadas originais (semente 24) | 9,0 s | ~9 s |
| **transladado** por `{3.7, −2.1}` | **1239 s** (e 857 s numa 2ª medição) | **23,2 s** (suíte inteira de 5 testes) |

O gatilho é a **translação**: qualquer coordenada não redonda. Isso é o que acontece quando alguém arrasta uma
parede para um ponto livre no editor — não é artefato de teste.

O sintoma visível ao usuário é **travar a interface por ~20 minutos**.

### 4.2 Causa

`resolve.ts` chama `clipReturn` (linha 271, chamado nas linhas 306 e 326) dentro do laço de faixas de altura:
`difference(retornoDeAcabamento, ...33ShapesPintados)`. Em 32 dessas chamadas o polygon-clipping entra em laço e
só lança depois de percorrer **1e6 segmentos de sweep line** (~30 s cada); o `robust()` de `boolean.ts` então cai
no Clipper, que responde em ~88 ms.

O laço é induzido pelo **snap de entrada** `SNAP = 1e7` em `toPc` (`boolean.ts:11,14`): ele arredonda tudo em
1e-7 m antes da operação exata, fazendo quadriláteros vizinhos se tocarem/sobreporem exatamente.

Evidência (reproduzida nesta rodada, ver `booleanSweep.test.ts`):

| grade | resultado |
|---|---|
| 1e-6 | passa (~41–92 ms) |
| **1e-7 (atual)** | **estoura** — `Infinite loop when passing sweep line over endpoints (too many sweep line segments)` |
| 1e-8 | estoura, outra mensagem: `Unable to find segment #11766 … in SweepLine tree` |
| 1e-9 | estoura, mesma mensagem do dump |
| sem snap (1e-12) | passa (~21–68 ms) |

Remover vértices colineares **não** resolve (testado em 1e-8…1e-12, nenhum vértice removido muda o resultado), e
não existem vértices quase coincidentes a 1e-6 — o contato é **vértice-sobre-aresta**, não vértice-sobre-vértice.
Foi por isso que a tentativa anterior de pré-arredondar `layerQuad` falhou.

### 4.3 O que a correção **não** precisa fazer

A correção geométrica nunca esteve errada: com o limite baixo, a semente 24 **passa nos cinco invariantes**
(a não lança, b áreas válidas, c soma dos cortes = união, d reprodutível, e translação preserva a área). O Clipper
cobre o caso. Portanto o alvo é **tempo e robustez**, não resultado.

### 4.4 Correções candidatas

| # | Correção | Prós | Contras | Veredito |
|---|---|---|---|---|
| a | Trocar/reduzir o snap de `toPc` (1e-6 ou sem snap) | simples, o dado apoia (1e-6 e 1e-12 passam) | muda estabilidade de coordenadas: dedupe, `sigOf`, dourados e reprodutibilidade; área pode mudar em outros casos | **não recomendado como primeira medida** |
| b | Detectar cedo o contato exato e ir **direto ao Clipper** | preserva a precisão nos casos normais; ataca só o caso patológico; determinístico | exige pré-check correto (`ponto-sobre-aresta`, O(n log n)) e teste do preditor | **recomendado** |
| c | Memoizar `clipReturn` (como `paintFor` já faz com `paint`) | colapsa as 32 repetições em 1; ganho em produção, não só em teste | não elimina o custo de uma tentativa patológica; precisa de chave estável | **recomendado (complementar)** |
| d | Baixar `POLYGON_CLIPPING_MAX_SWEEPLINE_SEGMENTS` em produção | o pior caso fica proporcional ao limite (`limite/1e6 × 30 s`) | empurra operações legítimas grandes para o Clipper (perde precisão sub-micrométrica); hoje **não se sabe** quantas são | **válvula de segurança, decidir com telemetria** |

### 4.5 Ordem de execução recomendada

1. **Telemetria primeiro** (barata, sem mudar resultado): contar em `robust()` quantas chamadas caem no fallback e
   por quê; logar o número de vértices/segmentos da entrada. Serve para dimensionar (d) e provar (c).
2. **Pré-check (b)**: antes da tentativa exata, procurar vértice sobre aresta não-adjacente depois do snap. Se
   houver, ir direto ao Clipper. Critério: o caso do fixture deixa de gastar a tentativa condenada.
3. **Memoização (c)** de `clipReturn` por (parede, material, assinatura do polígono, conjunto ativo).
4. **Só então** avaliar (a) e (d), com os números da telemetria.

### 4.6 Critérios de aceitação

- `npm run test:rapido:esquadria` ≤ 10 s (hoje 19–31 s) **e** os 5 invariantes verdes.
- Semente 24 transladada ≤ 15 s (hoje 1239 s sem limite; 23,2 s com limite).
- `booleanSweep.test.ts` teste 1 ≤ 100 ms e área igual a `0.002319941982005247 m²` (tol 1e-6).
- Nenhuma área de nenhuma semente muda além de `max(5e-5, 2e-4·t0)` (tolerância já usada no invariante (e)).
- **Nenhum** arquivo dourado muda sem justificativa escrita.

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
   lote "Quinas em esquadria" passar a corrigir essas quinas (a lista é compartilhada). É desejável? Decidir.
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
| 1 | Telemetria do `robust()` (4.5.1) | dimensiona o resto com número em vez de palpite | 30 min |
| 2 | **P-1**: pré-check + memoização (4.5.2, 4.5.3) | destrava 20 min → segundos; pré-requisito dos demais | 3–4 h |
| 3 | **T-1**: guardas sobre geometria pré-pintura (7.2a) | sem guarda confiável não se valida J-1 | 1 h |
| 4 | **J-1/J-2**: `EndSpec` por lado + nó por vizinho angular (5.4) | corrige o defeito visual de junção | 4–6 h |
| 5 | **I-1b**: ruído do vitest / CI (9.3) | libera a suíte completa em CI | 2 h |
| 6 | Decisões da seção 8 | fecham o escopo | — |
| 7 | Itens da seção 10 | verificação final | 1 h |

---

## 12. Resumo em uma frase por defeito

- **P-1**: o snap de entrada fabrica contato exato; o polygon-clipping entra em laço; 32 dessas tentativas custam
  20 min. Corrigir com pré-check + memoização, não mexendo no snap.
- **J-1**: encosto e esquadro cortam todas as camadas com um escalar e deixam o núcleo comer o acabamento (75% e
  74% da área do canto). Corrigir com pareamento por face, e o esquadro provavelmente só com aviso.
- **J-2**: nó de 3+ paredes ignora a configuração e aperta o núcleo da grossa. Corrigir junto com J-1.
- **T-1**: as guardas de quina testam uma interseção que é zero por construção. Corrigir testando a geometria
  pré-pintura.
- **I-1/I-2**: os scripts de verificação rápida agora funcionam no Windows; o ruído do vitest na suíte completa
  ainda derruba o código de saída.
