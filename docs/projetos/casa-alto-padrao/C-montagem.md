# C. Montagem da casa de alto padrão no app

Montagem do projeto B (v2) como modelo inicial `house-premium`, com as alterações do coordenador. A geometria foi conferida pelos testes de `packages/engine/src/casaAltoPadrao.test.ts` (22 testes, todos passando). **A casa não foi aberta no navegador**: a conferência visual dos cortes e das elevações ainda precisa ser feita.

## 1. Como abrir

Barra superior, botão **Novo** ("Novo projeto a partir de um modelo"). No diálogo **Novo projeto**, o primeiro cartão da lista é **Casa de alto padrão, 2 pavimentos** (área 330 m²). A lista de modelos vem de `TEMPLATES` em `packages/model/src/templates.ts`.

## 2. O que foi montado

| Arquivo | Conteúdo |
|---|---|
| `packages/model/src/templateCasaAltoPadrao.ts` | `casaAltoPadrao(cmds)`: paredes, aberturas, tipos novos, pisos, laje, telhado, escada, cortes e elevações |
| `packages/model/src/templates.ts` | id `house-premium` em `TemplateId`, entrada em `TEMPLATES` e chamada em `buildTemplate` |
| `packages/engine/src/casaAltoPadrao.test.ts` | verificação (seção 7) |

Níveis: Térreo `lv_0` (0,00) e Pavimento 2 `lv_1` (3,00), já criados por `createEmptyProject`. Não há nível de cobertura: o telhado fica no `lv_1`.

Contagem: 32 paredes (15 no térreo, 17 no pavimento 2), 38 aberturas (22 portas, sendo 6 vãos livres, e 16 janelas), 2 pisos (`ft_ceram`, `ft_laje12`), 1 laje (`ls_mac15`), 1 telhado (`rt_ceramica`, 4 águas), 1 escada (`stt_monolitica`, `ES-01`), 6 vistas (Corte AA, Corte BB, Norte, Sul, Leste, Oeste).

Tipos de abertura criados no projeto com `upsertOpeningType` (9 tipos novos, pois `ot_pj240` saiu, ver 3.2). `DEFAULT_OPENING_TYPES` não foi alterado.

Marcas: portas `P-01` a `P-16`, vãos livres `V-01` a `V-06`, janelas `J-01` a `J-16`. A numeração segue a ordem das tabelas do B (T1 a T18 no térreo, S1 a S10 e J1 a J10 no pavimento 2), com as portas e janelas do térreo primeiro.

Nomes dos cômodos do pavimento 2, após a alteração (1) do coordenador (só rótulos; a geometria não mudou):

| Nome no B | Nome agora | Cômodo |
|---|---|---|
| Suíte 3 (3,75 × 6,24, NE) | **SUÍTE MASTER** | quarto, com banheiro e closet a oeste |
| Suíte master (2,85 × 6,56, SE) | **SUÍTE 3** | quarto, com banheiro e closet a oeste |
| Banheiro 3 / Closet 3 | banheiro e closet da SUÍTE MASTER | |
| Banheiro da master / Closet da master | banheiro e closet da SUÍTE 3 | |

O modelo não tem entidade de cômodo: os nomes existem nos comentários do template e nos rótulos deste documento.

## 3. Desvios do B

### 3.1 Alterações do coordenador

| Item | Como ficou |
|---|---|
| (1) Hierarquia das suítes | Renomeadas (tabela acima). A geometria é a do B. |
| (2) Sacada sul removida | Não há laje `L-P2-02`. A porta-janela `J5` virou janela normal `ot_j240x140` na fachada sul, x 9,10 a 11,50, peitoril 1,10 (marca `J-11`). |
| (3) Cabe em 11,99 × 14,24 m | Conferido: a face externa do pavimento 2 mede 11,992 × 14,242 m. |

### 3.2 Desvios por motivo do projeto

| Item do B | Como ficou | Motivo |
|---|---|---|
| Tabela de paredes (§2.2) | Parede `S-I-13` (5,5; 10) a (8,0; 10), PA-09 | A tabela não tinha a parede entre closet 3 e banheiro 3. As áreas do B (5,60 e 10,00 m²) supõem essa parede; sem ela os dois formam um cômodo de 15,6 m². Coberto por teste. |
| Tipos novos (§7) | 9 tipos, sem `ot_pj240` | Não há mais porta-janela de sacada. |
| `S8` (§3.2) | offset 3,99 (B: 4,24) | A tabela do próprio B dá o vão de y 11,40 a 12,10, que é centrado em 11,75, ou seja offset 3,99. Com 4,24 o vão iria de 11,65 a 12,35. |
| Laje `L-P2-01` (§4.1) | contorno pela face externa, de (−0,121; −0,121) a (11,871; 14,121) | Defeito do app (seção 6.1): com o contorno no eixo, o topo de parede externa sobre a borda da laje não ancora. Ajuste de 0,121 m por lado. |
| `T-I-05` (§2.1) | em x = 6,854 (DEC-3, §5); topo fixo em 2,83 m | Afastada 0,154 m para leste (DEC-3, §5). Mantém a altura explícita de 2,83 m; o ponto médio agora (6,854; 3,95) cai na laje. |
| Folga do furo da escada (§4.3, `openingMargin` 0,05) | 0 | Com 0,05 o vazio desce até y ≈ 3,095 e invade 4 cm do banheiro da SUÍTE 3, cujo piso livre começa em y 3,138 (face sul da `S-I-03`). Com 0 o furo começa em y ≈ 3,14, na face da parede. Área do furo: ≈ 4,10 m². |
| Elevações (§4.4) | nomes "Norte", "Sul", "Leste", "Oeste", com as mesmas linhas de "Gerar elevações" | Assim "Gerar elevações" atualiza as quatro no lugar. O B pedia "Elevação Sul (frente)". |
| Cortes (§4.4) | "Corte AA" e "Corte BB" | Nome automático do app. O B pedia "Corte AA (pela escada)". Posição, observador e profundidade (17 m) são os do B. |
| Parede opcional `wt_alv14h` (§7) | não criada | Opcional no B. As paredes de molhados usam PA-14. |

### 3.3 Escada

Lance reto `generateStraightRun(start (6,10; 2,00), dir (0; 1), largura 1,20, 17 espelhos, piso 0,285)`. O lance do modelo é o mesmo croqui (teste). `openingMode: 'headroom'`, folga 0 (ver 3.2), `stt_monolitica`, sem patamar.

## 4. Avisos que sobraram

- `validateProject`: nenhum aviso e nenhum erro.
- Escada (`resolveStairs`): nenhum aviso de norma (`stair-risers-count`, `stair-uneven`, `stair-blondel`, pé-direito e largura, todos limpos). 17 espelhos, h = 0,1765 m, 2e + p = 0,637 m.
- Telhado (`roofSurfaceIssues`, `roofWallIssues`): nenhum aviso.
- Faixa de vista do pavimento 2: 1 aviso, telhado R-01 fora do intervalo de vista. É esperado, porque a planta corta em 1,20 m.
- Itens da seção 8 do B continuam em aberto e o app não os acusa: guarda-corpo da varanda aberta ao norte, sala de jantar sem janela externa, closet da SUÍTE MASTER com 5,60 m² (abaixo de 6 m²), prumadas do banheiro 3 e da cozinha e índices normativos não confirmados.

## 5. Problema de partido (corrigido em parte pela DEC-3)

**Escada de 1,20 m entre eixos invadia as paredes.** As paredes que a ladeiam são `T-I-01` (x = 5,5, espessura 0,184) e `T-I-05` (x = 6,7, espessura 0,124). A largura livre entre faces era 5,592 a 6,638, ou seja **1,046 m**, e o lance de 1,20 m entrava nas paredes:

- `T-I-01`: 0,42 m² em planta, ao longo de todo o lance;
- `T-I-05`: 0,24 m²;
- `T-I-06` (encontro no topo do lance): 0,07 m².

O app não acusa isso, porque nenhum validador compara escada e parede. Pelo mínimo de 0,01 a 0,05 m não havia ajuste que resolvesse: as opções eram de projeto e cabiam ao coordenador.

- (a) Lance de 1,05 m (cabia entre faces); o B fixa 1,20 m.
- (b) Afastar `T-I-05` 0,154 m, para x = 6,854. Com isso a largura livre do hall cai de 2,20 m para cerca de 2,05 m.

**Decisão (DEC-3): opção (b).** Mantido o lance de 1,20 m do projeto B e afastada `T-I-05` de x = 6,7 para x = 6,854 (`templateCasaAltoPadrao.ts`). A largura livre entre faces passa a 5,592 a 6,792 = **1,200 m**, igual à largura do lance.

Resultado:

- Largura livre entre faces: 1,046 → **1,200 m**.
- Largura livre do hall: 2,20 → **2,046 m**; cômodo do hall 10,032 → **9,32976 m²**; escada (projeção) 5,472 → **6,17424 m²**.
- Invasão da escada em `T-I-05`: **0,24 → 0 m²** (a face oeste passa a 6,792, fora do lance).
- **`T-I-01` (0,42 m²) e `T-I-06` (0,07 m²) NÃO vão a zero.** Nenhuma das duas depende de `T-I-05`: a aresta oeste do lance está no eixo de `T-I-01` (x = 5,5; face 5,592) e o último espelho está no eixo de `T-I-06` (y = 6,56). Zerar `T-I-01` exigiria deslocar o lance +0,092 m (para x 5,592 a 6,792, entre faces), o que cascateia no furo do pavimento 2; `T-I-06` pediria mover a parede ou encurtar o lance. **Em aberto — decisão do coordenador.**

## 6. Defeito do app

### 6.1 Topo anexado dependia do lado da borda da laje onde cai o ponto médio (corrigido)

`facesAt` (`packages/engine/src/wallZ.ts`) decidia se uma parede estava coberta por uma laje com `pointInMulti` → `pointInRing` (`packages/geom/src/polygon.ts`), que é ray-casting e não trata o ponto sobre a borda. O resultado dependia do lado da borda:

Reprodução mínima (no `lv_1`, laje `ls_mac15` de 0,17 m, contorno sobre o eixo (0,0)–(4,0)–(4,4)–(0,4), a 3,00 m; paredes em `lv_0` com `topLevelId: 'lv_1'`, `attachTopToFloor: true`):

| Parede (ponto médio na borda) | Topo obtido | Esperado |
|---|---|---|
| (0;4) a (4;4), borda superior | 3,000 | 2,83 |
| (4;0) a (0;0), borda inferior | 2,830 | 2,83 |
| (4;0) a (4;4), borda direita | 3,000 | 2,83 |
| (0;4) a (0;0), borda esquerda | 2,830 | 2,83 |

Impacto: se a laje estiver no eixo das paredes externas, as paredes da borda superior e direita subiam 17 cm além da face inferior da laje. O projeto estava usando a laje pela face externa (3.2) como contorno.

**Corrigido.** `facesAt` passou a tratar o ponto médio exatamente sobre a borda de um contorno como coberto: além do teste de interior (`pointInMulti`), testa se o ponto cai sobre algum segmento dos anéis (`onRing`, distância ≤ 1e-7 m). A decisão deixa de depender do lado da borda, e o `pointInRing`/`pointInMulti` de `packages/geom/src/polygon.ts` não mudaram. **Antes:** topo 3,000 m nas bordas superior e direita e 2,830 m nas bordas inferior e esquerda. **Depois:** 2,830 m nas quatro. Coberto pelo bloco "6.1" de `packages/engine/src/wallZSlab.test.ts`.

### 6.2 Limites sem defeito

- A escada não é checada contra paredes (seção 5).
- A vista de planta avisa telhado fora do intervalo de vista, o que é esperado.

## 7. Verificação

Testes (`npx vitest run packages/model packages/engine`, sem perf): 79 arquivos e 1337 testes passando, incluindo os 22 de `casaAltoPadrao.test.ts`.

Checagens do teste:

- `validateProject` sem erros; lista de avisos vazia.
- `resolveLevel` nos dois níveis, sem exceção; junções limpas (fresta < 2e-5 m², sobreposição < 1e-5 m²).
- Contorno externo: 1 anel por nível. Térreo 148,67 m² (caixa menos a varanda aberta ao norte, tolerância relativa 5e-4). Pavimento 2 170,79 m² (11,992 × 14,242).
- Cômodos pela grade de eixos das paredes: todos com a área do B, tolerância 1e-6 (térreo: garagem 30,25; cozinha 22,00; despensa 11,00; serviço 13,75; vestíbulo 6,80; hall 9,32976; escada 6,17424; lavabo 3,80; sala em L 25,84; jantar 13,06. Pavimento 2: SUÍTE MASTER 23,40; SUÍTE 3 18,70; suíte 2 20,57; home office 36,08; corredor 14,10; banheiros e closets nas áreas do B). Nº de cômodos fechados igual ao nº de furos do contorno: 8 no térreo e 11 no pavimento 2.
- Escada: `resolveStairs` sem avisos; 17 espelhos; h = 3/17; 2e + p entre 0,63 e 0,64; croqui igual ao de `generateStraightRun`.
- Laje do pavimento 2: furo com área > 0 (≈ 4,10 m²); cômodos da SUÍTE 3 (banheiro), closet da SUÍTE 3 e home office, com folga de 0,092 m (meia espessura de PA-14), continuam na laje.
- Pavimento 2 sob 2,83 m; paredes do térreo com topo em 2,83 m; paredes do pavimento 2 com topo em 5,80 m.
- Telhado: 4 águas, beiral 5,80 m, cumeeira 7,78 m no centro.
- Aberturas: nenhuma sobreposta na mesma parede, folga ≥ 0,10 m entre vãos, nenhuma a 0,15 m ou menos de uma quina.
- Folhas: 15 folhas de batente e pivotante varridas de 0° a 90°, sem colisão com parede (cortes de todas as paredes) nem entre folhas. Dobradiça 3 cm dentro do vão, folha com 6 cm de folga (retorno de reboco). Portão de correr e vãos livres fora da varredura.
- Cortes AA e BB e as quatro elevações calculam sem exceção. A elevação Sul mostra só vãos da fachada sul (`T-EXT-S` e `S-EXT-S`).
- Serialização de ida e volta idêntica (`migrateProject`).

Outras checagens:

- `npm run typecheck`: sem erros.
- `npx eslint` nos três arquivos alterados: sem erros.
- `node scripts/check-boundaries.mjs`: ok.
- `npm run build`: ok.

Não verificado: abertura no navegador (cortes, elevações e o cartão no diálogo Novo projeto). Os testes de `validate.test.ts` e `engine.test.ts` listam só `blank`, `house2` e `studio`; a casa nova não foi incluída nessas listas.
