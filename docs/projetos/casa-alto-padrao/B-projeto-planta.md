# B. Projeto da planta, v2: casa de 2 pavimentos de alto padrão

Projeto de exemplo do Hestia, usando só os elementos do app: paredes, portas, janelas, pisos, lajes, telhado, escada e cortes/elevações. Esta v2 substitui a v1.

**Estado: partido com coordenadas, verificado por script** (`scratchpad/check_planta.py`, ver seção 5). A área de cada cômodo, a colisão das folhas de porta, a conectividade entre cômodos e os percursos foram conferidos a partir das coordenadas. **Não foi montado nem validado no app.** Os itens marcados com ⚠ pedem conferência na montagem ou não cumprem uma meta.

Notação: coordenadas em metros, escritas como **(x; y)** com vírgula decimal. (5,5; 0) é x = 5,5 e y = 0.

## 0. Convenções (fontes no código)

| Convenção | Valor | Fonte |
|---|---|---|
| Unidades | metros | modelo inteiro |
| Eixos | x = leste, y = norte | `apps/web/src/editor/elevations.ts` |
| Origem | canto sudoeste da casa, sobre o eixo externo | escolha deste projeto |
| Lado externo | à **esquerda** de a→b | `types.ts` (`flipped`); `templates.ts` |
| Offset da abertura | distância do centro do vão ao início (a) da parede | `types.ts` (`Opening.offset`) |
| Giro da porta | padrão: folha para a **esquerda** de a→b; `flipFacing = true` gira para a direita; `flipHand = false` (dobradiça no início, a) | `packages/geom/src/openingSymbol.ts` |
| Corte/elevação | observador olha para a **esquerda** de a→b | `packages/engine/src/section.ts` |

Dimensões de referência:

- Pegada: 11,75 × 14,00 m de eixo a eixo. Paredes externas PE-19 (0,242 m), então as faces externas medem 11,99 × 14,24 m.
- Lote 15 × 30 m, recuos frontal 5 m, laterais 1,50 m, fundos 3 m. Largura útil entre recuos: 12,00 m. A pegada de 13 m pedida na revisão não cabe nesses recuos (ver A, seção 1).

## 1. Croquis

Os croquis são esquemáticos, fora de escala. As tabelas das seções 2 e 3 são a referência.

### 1.1 Térreo (lv_0), norte para cima

```
 y 14 ┌────────────┬──────────────────────────────────────────┐
      │ ÁREA DE    │ ░░░░░░░░ VARANDA GOURMET (22,5 m²) ░░░░░ │ face norte ABERTA
      │ SERVIÇO    │ x 5,5 a 11,75 ; y 10,4 a 14              │ (sem guarda-corpo)
      │ 5,5 x 2,5  │                                          │
 11,5 ├────────────┤                                          │
      │ DESPENSA   │  SALA DE JANTAR (3,4 x 3,84 = 13,06 m²)  │ SALA DE ESTAR (L)
      │ 5,5 x 2,0  │  vão p/ varanda (x 6,0 a 8,4)            │ 25,84 m²
 10,4 │            ├──────────────────────────────┬───────────┤ vão p/ varanda
      │            │ vão p/ sala (y 7,2 a 9,6)    │           │ (x 9,1 a 11,5)
  9,5 ├────────────┤                              │           │
      │ COZINHA    │ vão cozinha↔jantar (y 7,3 a 8,7)         │
      │ 5,5 x 4,0  │                                          │
  6,56│            ├──────┬─────────────────────┐ ─vão hall──┤
      │            │ ESC. │ HALL                │ (y 2,2 a 4,0)
      │            │ 1,20 │ 2,20 x 4,56         │
  5,5 ├────────────┤ x    │                     │
      │ GARAGEM    │ 5,5-6,7                    │ LAVABO
      │ 5,5 x 5,5  │ 17 espelhos                │ (8,9 a 10,8 ; 0 a 2)
  2,0 │            │      │                     │
      │            │      │                     │
  0   └────────────┴──────┴─────────────────────┴─────────────
                    │ VESTÍBULO (3,4 x 2,0) │ ← porta da rua T1 em x 7,3 a 8,5
```

Leitura: a garagem fica no sudoeste, com portão para a rua e porta direta à cozinha. A entrada abre para o vestíbulo, que tem o pé da escada na direção do hall. A escada sobe encostada à parede oeste do hall (x 5,5 a 6,7), e o hall (2,20 m livres) segue para a sala (vão 1,80) e para a jantar (vão 1,80). O lavabo fica ao sul da sala, com porta para o vestíbulo, e não abre para sala nem jantar. A cozinha liga à jantar por vão de 1,40. A área de serviço e a despensa ficam atrás da cozinha, na face oeste.

### 1.2 Pavimento 2 (lv_1), norte para cima

```
 y 14 ┌─────────┬──────────┬────────────┬──────────────────────┐
      │ BANH. 2 │ CLOSET 2 │ BANH. 3    │ SUÍTE 3              │ janelões N e L
      │ 2,8x2,5 │ 2,7x2,5  │ 2,5 x 4,0  │ 3,75 x 6,24 (23,4 m²)│
 11,5 ├─────────┴──────────┴────────────┤                      │
      │ SUÍTE 2 (quarto)                │                      │
      │ 5,5 x 3,74 (20,6 m²)            │                      │
 10,0 │                                 ├──────────────────────┤
      │                                 │ CLOSET 3 ◄─ porta ── │ (8,0 a 10,0 do lado)
  7,76├─────────────────────────────────┴──────────────────────┤
      │ CORREDOR ÍNTIMO 1,20 m — recebe a escada (topo y 6,56)│ 11,75 de comprimento
  6,56├──────────────────────┬──────────────────┬─────────────┤
      │ HOME OFFICE          │ vazio da escada  │ CLOSET M    │
      │ 5,5 x 6,56           │ 1,20 x 3,36      │ 2,2 x 3,36  │
      │ (36,1 m²)            │ (furo, auto)     │             │
  3,2 │                      ├──────────────────┤ SUÍTE MASTER│
      │                      │ BANHEIRO M       │ quarto      │
      │                      │ 3,4 x 3,2 (10,9) │ 2,85 x 6,56 │
  0   └──────────────────────┴──────────────────┴─────────────┘
                                                  sacada sul (⚠)
```

Leitura: a escada chega ao pavimento 2 na extremidade norte do furo e entra no corredor íntimo, que atravessa a casa de oeste a leste. Os quartos e o home office abrem para o corredor com porta própria. A suíte master tem banheiro e closet acessados a partir do quarto. A sacada da master fica na fachada sul, sobre o recuo frontal (⚠, a confirmar).

### 1.3 Cobertura

```
 ┌──────────────────────────────────────────────────┐   beiral: x −0,72 a 12,47
 │ ╲                                              ╱ │   y −0,72 a 14,72
 │   ╲       CUMEEIRA ≈ 7,78 m (eixo x)         ╱   │   4 águas, 30 %
 │     ╲______________________________________╱    │   beiral 5,80 m
 └──────────────────────────────────────────────────┘
```

### 1.4 Cotas principais

| Cota | Valor (m) |
|---|---|
| Pegada, eixo a eixo (x × y) | 11,75 × 14,00 |
| Faces externas (x × y) | 11,99 × 14,24 |
| Piso térreo | 0,00 |
| Piso pavimento 2 (nível lv_1) | 3,00 |
| Pé-direito livre térreo (sob laje de 0,17 m) | 2,83 |
| Beiral (topo das paredes do pavimento 2: 3,00 + 2,80) | 5,80 |
| Cumeeira | ≈ 7,78 |

## 2. Tabela de paredes

Tipos do catálogo:

| Código | Tipo (id) | Espessura | Uso |
|---|---|---|---|
| EXT | `wt_ext19` (PE-19) | 0,242 m | fachadas |
| PA-14 | `wt_alv14` | 0,184 m | paredes de molhados e de fechamento de banheiro |
| PA-09 | `wt_alv9` | 0,124 m | divisórias de salas, quartos e corredor |

⚠ Divisória hidráulica: o catálogo não tem tipo específico. As paredes de molhados usam PA-14, pela espessura para tubulação. Ver seção 7.

Altura: térreo com topo anexado ao piso do pavimento 2 (`topLevelId = lv_1`, `attachTopToFloor = true`), que desce até a face inferior da laje (2,83 m). Pavimento 2: 2,80 m (`height`), topo no beiral.

Todas as paredes são retas, com `locationLine = wallCenter`, `flipped = false` e junções em encosto (`butt`). Nas externas, a→b é orientado para que o externo fique à esquerda.

### 2.1 Térreo (lv_0)

| id | a | b | tipo | topo | lado de cada lado / observação |
|---|---|---|---|---|---|
| T-EXT-O | (0; 0) | (0; 14) | EXT | anexa a lv_1 | externo = oeste |
| T-EXT-S | (11,75; 0) | (0; 0) | EXT | anexa a lv_1 | externo = sul (rua) |
| T-EXT-L | (11,75; 14) | (11,75; 0) | EXT | anexa a lv_1 | externo = leste |
| T-EXT-N | (0; 14) | (5,5; 14) | EXT | anexa a lv_1 | externo = norte, no trecho da área de serviço. **Sem parede** de x 5,5 a 11,75 (varanda aberta) |
| T-I-01 | (5,5; 0) | (5,5; 14) | PA-14 | anexa a lv_1 | oeste: garagem, cozinha, despensa, serviço. Leste: vestíbulo, escada, jantar, varanda. Vão cozinha ↔ jantar em y 7,3 a 8,7 |
| T-I-02 | (0; 5,5) | (5,5; 5,5) | PA-14 | anexa a lv_1 | garagem (sul) e cozinha (norte); porta em x 1,6 a 2,4 |
| T-I-03 | (0; 9,5) | (5,5; 9,5) | PA-09 | anexa a lv_1 | cozinha (sul) e despensa (norte); porta em x 2,1 a 2,9 |
| T-I-04 | (0; 11,5) | (5,5; 11,5) | PA-14 | anexa a lv_1 | despensa (sul) e área de serviço (norte); porta em x 2,1 a 2,9 |
| T-I-05 | (6,7; 2,0) | (6,7; 5,9) | PA-09 | anexa a lv_1 | escada (oeste) e hall (leste): fecha a passagem sob o lance, onde o pé-direito fica abaixo de 2,10 m |
| T-I-06 | (5,5; 6,56) | (8,9; 6,56) | PA-09 | anexa a lv_1 | topo da escada (oeste), hall e jantar (sul e norte); vão hall ↔ jantar em x 6,9 a 8,7 |
| T-I-07 | (8,9; 0) | (8,9; 10,4) | PA-09 | anexa a lv_1 | vestíbulo/hall (oeste) e lavabo/sala/jantar (leste). Porta do lavabo em y 0,65 a 1,35; vão hall ↔ sala em y 2,2 a 4,0; vão sala ↔ jantar em y 7,2 a 9,6 |
| T-I-08 | (8,9; 2,0) | (10,8; 2,0) | PA-09 | anexa a lv_1 | lavabo (sul) e sala (norte) |
| T-I-09 | (10,8; 0) | (10,8; 2,0) | PA-09 | anexa a lv_1 | lavabo (oeste) e sala (leste, trecho em L) |
| T-I-10 | (5,5; 10,4) | (8,9; 10,4) | PA-09 | anexa a lv_1 | jantar (sul) e varanda (norte); vão em x 6,0 a 8,4 |
| T-I-11 | (8,9; 10,4) | (11,75; 10,4) | PA-09 | anexa a lv_1 | sala (sul) e varanda (norte); vão em x 9,1 a 11,5 |

Vestíbulo ↔ hall: não há parede para y = 2,0 e x de 6,7 a 8,9. É uma passagem aberta de 2,20 m.

### 2.2 Pavimento 2 (lv_1)

| id | a | b | tipo | lado de cada lado / observação |
|---|---|---|---|---|
| S-EXT-O | (0; 0) | (0; 14) | EXT | externo = oeste |
| S-EXT-S | (11,75; 0) | (0; 0) | EXT | externo = sul; porta-janela da master em x 9,1 a 11,5 |
| S-EXT-L | (11,75; 14) | (11,75; 0) | EXT | externo = leste |
| S-EXT-N | (0; 14) | (11,75; 14) | EXT | externo = norte |
| S-I-01 | (0; 6,56) | (5,5; 6,56) | PA-09 | norte: corredor. Sul: home office. Porta em x 1,6 a 2,4 |
| S-I-02 | (5,5; 0) | (5,5; 6,56) | PA-14 | oeste: home office (y 0 a 6,56). Leste: banheiro da master (y 0 a 3,2) e vazio da escada (y 3,2 a 6,56) |
| S-I-03 | (5,5; 3,2) | (6,7; 3,2) | PA-14 | sul: banheiro da master. Norte: vazio da escada |
| S-I-04 | (6,7; 3,2) | (8,9; 3,2) | PA-14 | sul: banheiro da master. Norte: closet da master |
| S-I-05 | (6,7; 3,2) | (6,7; 6,56) | PA-09 | oeste: vazio da escada. Leste: closet da master |
| S-I-06 | (8,9; 0) | (8,9; 6,56) | PA-14 | oeste: banheiro da master (y 0 a 3,2) e closet (y 3,2 a 6,56). Leste: quarto da master. Portas em y 1,2 a 2,0 e 4,4 a 5,2 |
| S-I-07 | (6,7; 6,56) | (11,75; 6,56) | PA-09 | norte: corredor. Sul: closet da master (x 6,7 a 8,9) e quarto da master (x 8,9 a 11,75). Porta do quarto em x 9,75 a 10,65 |
| S-I-08 | (0; 7,76) | (11,75; 7,76) | PA-09 | sul: corredor. Norte: suíte 2 (x 0 a 5,5), closet 3 (x 5,5 a 8,0), suíte 3 (x 8,0 a 11,75). Portas em x 1,1 a 1,9 e 9,2 a 10,0 |
| S-I-09 | (5,5; 7,76) | (5,5; 14) | PA-09 | oeste: suíte 2 (y 7,76 a 11,5) e closet 2 (y 11,5 a 14). Leste: closet 3 (y 7,76 a 10) e banheiro 3 (y 10 a 14) |
| S-I-10 | (8,0; 7,76) | (8,0; 14) | PA-09 | oeste: closet 3 (y 7,76 a 10) e banheiro 3 (y 10 a 14). Leste: suíte 3. Portas em y 8,4 a 9,2 (closet 3) e y 11,4 a 12,1 (banheiro 3) |
| S-I-11 | (0; 11,5) | (5,5; 11,5) | PA-14 | sul: suíte 2. Norte: banheiro 2 (x 0 a 2,8) e closet 2 (x 2,8 a 5,5). Portas em x 1,05 a 1,75 e 3,6 a 4,4 |
| S-I-12 | (2,8; 11,5) | (2,8; 14) | PA-14 | oeste: banheiro 2. Leste: closet 2 |

Nota: as portas do banheiro e do closet da master (S-I-06) têm `flipFacing = false`. A folha gira para dentro do banheiro e do closet, a oeste, sem invadir o quarto.

## 3. Tabela de aberturas

Convenção: `offset` é a distância do centro do vão ao início (a) da parede. `flipFacing = true` gira a folha para a direita de a→b. `flipHand = false` em todas (dobradiça no início, a). Tipos novos (N) estão na seção 7. Peitoril em metros.

### 3.1 Térreo

| id | tipo (id) | parede | offset | vão no eixo | peitoril | flipFacing | razão |
|---|---|---|---|---|---|---|---|
| T1 | porta pivotante 1,20 (N) `ot_pv120` | T-EXT-S | 3,85 | x 7,30 a 8,50 | 0,00 | **T** | entrada da rua; abre para dentro, para o vestíbulo |
| T2 | portão de garagem 4,50 (N) `ot_portao450` | T-EXT-S | 9,00 | x 0,50 a 5,00 | 0,00 | — | centrado nas duas vagas; correr |
| T3 | janela 0,60 × 1,00 (N) `ot_j60x100` | T-EXT-S | 1,85 | x 9,60 a 10,20 | 1,50 | — | lavabo |
| T4 | janela 1,50 × 1,00 `ot_j150` | T-EXT-L | 7,00 | y 6,25 a 7,75 | 1,10 | — | sala, leste |
| T5 | janelão 2,40 × 2,20 (N) `ot_j240x220` | T-EXT-L | 10,00 | y 2,80 a 5,20 | 0,00 | — | sala, leste, piso a teto |
| T6 | porta 0,70 `ot_p70` | T-I-07 | 1,00 | y 0,65 a 1,35 | 0,00 | **T** | vestíbulo → lavabo; abre para dentro do lavabo (leste) |
| T7 | porta 0,80 `ot_p80` | T-I-02 | 2,00 | x 1,60 a 2,40 | 0,00 | F | garagem → cozinha; abre para a cozinha (norte) |
| T8 | vão livre 1,40 (N) `ot_vao140` | T-I-01 | 8,00 | y 7,30 a 8,70 | 0,00 | — | cozinha ↔ jantar |
| T9 | porta 0,80 `ot_p80` | T-I-03 | 2,50 | x 2,10 a 2,90 | 0,00 | F | cozinha → despensa; abre para a despensa (norte) |
| T10 | porta 0,80 `ot_p80` | T-I-04 | 2,50 | x 2,10 a 2,90 | 0,00 | F | despensa → área de serviço; abre para o serviço (norte) |
| T11 | vão livre 1,80 (N) `ot_vao180` | T-I-06 | 2,30 | x 6,90 a 8,70 | 0,00 | — | hall ↔ jantar |
| T12 | vão livre 1,80 (N) `ot_vao180` | T-I-07 | 3,10 | y 2,20 a 4,00 | 0,00 | — | hall ↔ sala |
| T13 | vão livre 2,40 (N) `ot_vao240` | T-I-07 | 8,40 | y 7,20 a 9,60 | 0,00 | — | sala ↔ jantar |
| T14 | vão livre 2,40 (N) `ot_vao240` | T-I-10 | 1,70 | x 6,00 a 8,40 | 0,00 | — | jantar ↔ varanda |
| T15 | vão livre 2,40 (N) `ot_vao240` | T-I-11 | 1,40 | x 9,10 a 11,50 | 0,00 | — | sala ↔ varanda |
| T16 | janela 2,40 × 1,60 (N) `ot_j240x160` | T-EXT-O | 7,50 | y 6,30 a 8,70 | 1,10 | — | cozinha, oeste |
| T17 | janela 1,20 × 1,20 `ot_j120` | T-EXT-O | 12,75 | y 12,15 a 13,35 | 1,10 | — | área de serviço, oeste |
| T18 | janela 1,20 × 1,20 `ot_j120` | T-EXT-N | 2,75 | x 2,15 a 3,35 | 1,10 | — | área de serviço, norte |

### 3.2 Pavimento 2

| id | tipo (id) | parede | offset | vão no eixo | peitoril | flipFacing | razão |
|---|---|---|---|---|---|---|---|
| S1 | porta 0,80 `ot_p80` | S-I-01 | 2,00 | x 1,60 a 2,40 | 0,00 | **T** | corredor → home office; abre para o home office (sul) |
| S2 | porta 0,90 `ot_p90` | S-I-07 | 3,50 | x 9,75 a 10,65 | 0,00 | **T** | corredor → suíte master; abre para o quarto (sul) |
| S3 | porta 0,80 `ot_p80` | S-I-06 | 1,60 | y 1,20 a 2,00 | 0,00 | F | suíte master → banheiro; abre para o banheiro (oeste) |
| S4 | porta 0,80 `ot_p80` | S-I-06 | 4,80 | y 4,40 a 5,20 | 0,00 | F | suíte master → closet; abre para o closet (oeste) |
| S5 | porta 0,80 `ot_p80` | S-I-08 | 1,50 | x 1,10 a 1,90 | 0,00 | F | corredor → suíte 2 (norte) |
| S6 | porta 0,80 `ot_p80` | S-I-08 | 9,60 | x 9,20 a 10,00 | 0,00 | F | corredor → suíte 3 (norte) |
| S7 | porta 0,80 `ot_p80` | S-I-10 | 1,04 | y 8,40 a 9,20 | 0,00 | F | suíte 3 → closet 3 (oeste) |
| S8 | porta 0,70 `ot_p70` | S-I-10 | 4,24 | y 11,40 a 12,10 | 0,00 | F | suíte 3 → banheiro 3 (oeste) |
| S9 | porta 0,70 `ot_p70` | S-I-11 | 1,40 | x 1,05 a 1,75 | 0,00 | F | suíte 2 → banheiro 2 (norte) |
| S10 | porta 0,80 `ot_p80` | S-I-11 | 4,00 | x 3,60 a 4,40 | 0,00 | F | suíte 2 → closet 2 (norte) |
| J1 | janela 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-O | 1,80 | y 0,60 a 3,00 | 1,10 | — | home office, oeste |
| J2 | janela 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-O | 4,50 | y 3,30 a 5,70 | 1,10 | — | home office, oeste |
| J3 | janela 2,40 × 1,60 (N) `ot_j240x160` | S-EXT-O | 9,60 | y 8,40 a 10,80 | 1,10 | — | suíte 2, oeste |
| J4 | janela 1,20 × 1,20 `ot_j120` | S-EXT-S | 4,55 | x 6,60 a 7,80 | 1,50 | — | banheiro da master, sul |
| J5 | porta-janela 2,40 × 2,20 (N) `ot_pj240` | S-EXT-S | 1,45 | x 9,10 a 11,50 | 0,00 | — | suíte master → sacada, correr |
| J6 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-L | 11,00 | y 1,80 a 4,20 | 1,10 | — | suíte master, leste |
| J7 | janela 1,20 × 1,20 `ot_j120` | S-EXT-N | 1,00 | x 0,40 a 1,60 | 1,50 | — | banheiro 2, norte |
| J8 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-N | 9,80 | x 8,60 a 11,00 | 1,10 | — | suíte 3, norte |
| J9 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-L | 4,00 | y 8,80 a 11,20 | 1,10 | — | suíte 3, leste |
| J10 | janela 1,20 × 1,20 `ot_j120` | S-EXT-N | 6,60 | x 6,00 a 7,20 | 1,50 | — | banheiro 3, norte |

Conferência de offsets: os vãos de uma mesma parede não se sobrepõem, e nenhum fica a menos de 0,15 m de um canto. Foi verificado pelo script (seção 5.4).

## 4. Pisos, lajes, telhado, escada e vistas

### 4.1 Pisos e laje

| id | tipo | nível | contorno | topo | observação |
|---|---|---|---|---|---|
| F-T-01 | `ft_ceram` (cerâmico sobre contrapiso) | lv_0 | (5,5; 0); (11,75; 0); (11,75; 14); (0; 14); (0; 5,5); (5,5; 5,5) | 0,00 | interior, varanda e área de serviço; a garagem fica fora |
| F-T-02 | `ft_laje12` (laje de concreto 12 cm) | lv_0 | (0; 0); (5,5; 0); (5,5; 5,5); (0; 5,5) | 0,00 | garagem |
| L-P2-01 | `ls_mac15` (laje maciça 15 cm) | lv_1 | (0; 0); (11,75; 0); (11,75; 14); (0; 14) | 3,00 | pavimento 2 e teto da garagem e da varanda gourmet |
| L-P2-02 | `ls_mac15` | lv_1 | (9,0; −1,2); (11,75; −1,2); (11,75; 0); (9,0; 0) | 3,00 | sacada da suíte master, sobre o recuo frontal (⚠ a confirmar) |

O furo da escada não é desenhado: o app o recorta sozinho (seção 4.4). Pé-direito livre térreo: 3,00 − 0,17 = 2,83 m.

### 4.2 Telhado

| id | forma | nível | contorno do beiral | inclinação | `heightOffset` | observação |
|---|---|---|---|---|---|---|
| R-01 | `hip` (4 águas) | lv_1 | (−0,72; −0,72); (12,47; −0,72); (12,47; 14,72); (−0,72; 14,72) | 30 % | 2,80 (beiral em 5,80) | balanço de 0,60 m a partir da face externa; testeira de 0,20 m; calha e forro de beiral ativos |

Cumeeira: 5,80 + 0,30 × 6,60 ≈ 7,78. A varanda gourmet fica coberta pelo pavimento 2, então não tem telhado próprio. Platibanda: não usada, porque não cabe sem tirar o beiral.

### 4.3 Escada

| Campo | Valor |
|---|---|
| Tipo | `stt_monolitica` (ES-01, concreto monolítico), `openingMode: 'headroom'`, `openingMargin: 0,05` |
| Forma | reta (`generateStraightRun`), sem patamar intermediário |
| Nível de base / topo | lv_0 (0,00) / lv_1 (3,00); `topLevelId = null` (nível acima automático) |
| Ponto de início (eixo do 1º espelho) | (6,10; 2,00), centro da largura |
| Direção de subida | (0; 1), norte |
| Largura | 1,20 m |
| Espelhos | 17 |
| Pisos | 16 (projeção de 16 × 0,285 = 4,56 m, de y 2,00 a 6,56) |
| Espelho | 3,00 / 17 = 0,176 m (faixa 0,16 a 0,18) |
| Piso | 0,285 m (faixa 0,28 a 0,32) |
| 2e + p | 2 × 0,176 + 0,285 = 0,637 m (faixa 0,63 a 0,64) |
| Patamar | não exigido: desnível de 3,00 m abaixo de 3,20 m (`maxRiseBetweenLandings`) |
| Pé-direito livre | ≥ 2,10 m (`minHeadroom`). O furo do pavimento 2 é aproximadamente x 5,5 a 6,7 e y 3,2 a 6,56 |
| Footprint | x 5,50 a 6,70; y 2,00 a 6,56 |

Posição e fluxo. A escada começa no vestíbulo, no eixo da entrada. Quem entra vê o pé da escada, a 2 m da porta, sem nenhuma parede na frente. O lance sobe encostado à parede oeste do hall. O lado leste fica fechado de y 2,0 a 5,9 (T-I-05), porque ali o pé-direito é menor que 2,10 m. Entre y 5,9 e 6,56, a passagem é livre, com pé-direito maior. O topo da escada chega direto ao corredor íntimo, sem patamar. O corredor atravessa a casa, então ninguém fica sem saída.

⚠ A escada é reta, com 17 espelhos e 16 pisos. Confirmar no painel de avisos do app: `stair-risers-count`, `stair-uneven` e `stair-blondel`. O furo do pavimento 2 é calculado pelo app, e a faixa de pé-direito de 2,10 m pode pedir um ajuste de 0,1 m no início.

### 4.4 Cortes e elevações

| Nome | Linha (a → b) | Observador | Profundidade | O que mostra |
|---|---|---|---|---|
| **Corte AA (pela escada)** | (6,10; −1) → (6,10; 15) | olha para o oeste | 17 m | corta a escada no eixo, o vestíbulo, o jantar, a varanda e, no pavimento 2, o banheiro da master, o vazio da escada, o corredor, o banheiro 3 e o closet 3 |
| **Corte BB** | (−1; 8,5) → (13; 8,5) | olha para o norte | 17 m | corta a cozinha, o vão para a jantar, a sala em L e, no pavimento 2, a suíte 2, o closet 3 e a suíte 3 |
| Elevação Norte | gerada pelo app | olha para −y | automática | janelões da sala, varanda aberta, janelas das suítes 2 e 3 |
| **Elevação Sul (frente)** | gerada pelo app | olha para +y | automática | portão, porta de entrada, janela do lavabo, porta-janela e sacada da master |
| Elevação Leste | gerada pelo app | olha para −x | automática | janelão e janela da sala, janelão da suíte 3, janela da master |
| Elevação Oeste | gerada pelo app | olha para +x | automática | janelas da cozinha, home office, suíte 2 e serviço |

O app gera as quatro elevações com os nomes "Norte", "Sul", "Leste" e "Oeste". Para ficar "Elevação Sul (frente)", renomear depois (`updateView`). Os cortes AA e BB são criados com `addView` (`kind: 'section'`).

## 5. Auto-revisão

Verificação feita por script sobre as coordenadas da seção 2 e 3. O script está em `scratchpad/check_planta.py`.

### 5.1 Áreas (medidas pelas coordenadas, eixo a eixo)

Térreo, soma 164,50 m² = pegada 11,75 × 14,00.

| Cômodo | Área (m²) | Meta | Situação |
|---|---|---|---|
| Garagem | 30,25 | 27–30 | ok; largura interna ≈ 5,26 m |
| Cozinha | 22,00 | 12–20 | acima da meta |
| Despensa | 11,00 | 2–3 | depósito grande; aceito |
| Área de serviço | 13,75 | 4–6 | acima da meta |
| Vestíbulo | 6,80 | — | — |
| Hall | 10,03 | — | — |
| Escada | 5,47 | — | — |
| Lavabo | 3,80 | 2–3 | pouco acima |
| Sala de jantar | 13,06 | 12–16 | ok |
| Sala de estar (em L) | 25,84 | 25–40 | ok |
| Varanda gourmet | 22,50 | ≥ 20 | ok |

Pavimento 2, soma 164,50 m².

| Cômodo | Área (m²) | Meta | Situação |
|---|---|---|---|
| Suíte master (quarto) | 18,70 | 18–24 | ok |
| Banheiro da master | 10,88 | ≥ 8 | ok |
| Closet da master | 7,39 | ≥ 6 | ok |
| Suíte 2 (quarto) | 20,57 | 12–14 | acima da meta |
| Banheiro 2 | 7,00 | — | ok |
| Closet 2 | 6,75 | — | ok |
| Suíte 3 | 23,40 | 11–13 | acima da meta |
| Banheiro 3 | 10,00 | — | ok |
| Closet 3 | 5,60 | — | ⚠ abaixo de 6 m² |
| Home office / sala íntima | 36,08 | 9–12 | acima da meta; fundo de corredor, não passagem |
| Corredor íntimo | 14,10 | ≥ 1,20 | ok |
| Vazio da escada (furo) | 4,03 | — | — |

### 5.2 Percursos e cômodos atravessados

"Atravessa" = cômodo que a pessoa pisa no caminho, sem ser destino. Passagem indevida = cômodo social, de serviço ou íntimo usado como corredor.

| Percurso | Cômodos atravessados | Passagem indevida? |
|---|---|---|
| Rua → sala de estar | vestíbulo → hall → sala | não; hall é circulação |
| Rua → sala de jantar | vestíbulo → hall → jantar | não |
| Rua → pé da escada | vestíbulo (pé na frente) | não |
| Rua → lavabo | vestíbulo → lavabo | não; porta do lavabo não abre para sala nem jantar |
| Garagem → cozinha | direto (porta T7) | não |
| Cozinha → sala de jantar | direto (vão T8) | não; não passa pela sala de estar |
| Cozinha → varanda | cozinha → jantar → varanda | não; a jantar é o caminho social |
| Área de serviço → cozinha | área de serviço → despensa → cozinha | não; a despensa é o caminho de serviço |
| Escada → corredor íntimo | topo da escada, sem cômodo | não; sobe direto ao corredor |
| Corredor → suíte master | direto (porta S2) | não |
| Suíte master → banheiro e closet | direto (portas S3, S4) | não; acesso pelo quarto |
| Corredor → suíte 2 → banheiro 2 | direto, depois direto | não |
| Corredor → suíte 3 → banheiro 3 | direto, depois direto | não |
| Corredor → home office | direto (porta S1) | não; é fundo de corredor, não passagem |

Nota de "fundo de saco": o corredor íntimo tem dois braços, um para oeste (home office e suíte 2) e um para leste (suíte master e suíte 3). Cada braço termina em porta de quarto, e nenhum leva a lugar sem saída: o corredor sempre volta ao topo da escada.

### 5.3 Folhas de porta

Cada porta foi varrida em 10 ângulos e 6 raios (folha de comprimento igual à largura). Resultado: 15 portas, nenhuma colisão com paredes ou outras folhas. A ponta da folha a 90° fica no cômodo do lado de giro. Nenhuma folha abre para fora da casa: a entrada T1 foi configurada com `flipFacing = true` para abrir para dentro.

### 5.4 Offsets, cantos e corredor

- Vãos da mesma parede não se sobrepõem, com folga de pelo menos 0,10 m.
- Nenhum vão fica a menos de 0,15 m de um canto da parede (conferido pelos offsets). Os vãos mais próximos de um canto são a porta-janela da master (0,20 m do canto da suíte e 0,25 m do canto leste) e o portão (0,50 m do canto da garagem).
- Pé-direito de passagem: o vestíbulo, o hall e o corredor íntimo têm teto de 2,83 m ou mais. Sob o lance da escada não há passagem: o trecho de y 2,0 a 5,9 fica fechado.

### 5.5 Pontos não verificados

- Furo da escada no pavimento 2: calculado pelo app. Pode ficar 0,1 m diferente do retângulo de 3,2 a 6,56.
- Entrada do pavimento 2 pela escada: o topo do lance é o eixo y = 6,56, mas a faixa de x de 5,5 a 6,7 ainda precisa ser confirmada no app.
- A tabela não incluiu a espessura do guarda-corpo, porque o app não tem esse elemento.

## 6. Iluminação, ventilação e prumadas

### 6.1 Janelas e áreas

Critério adotado: área de janela ≥ 1/6 da área do piso para dormitório, sala e cozinha. Para banheiro e lavabo, ≥ 1/8, com exaustão quando não chega. O índice de 1/6 não foi confirmado no texto oficial (ver A, seção 6).

| Cômodo | Área (m²) | Janelas (m²) | Razão | Situação |
|---|---|---|---|---|
| Sala de estar | 25,84 | 1,50 + 5,28 = 6,78 | 26,2 % | ok |
| Sala de jantar | 13,06 | sem janela externa | — | ⚠ ventilação e luz pelos vãos para a sala e a varanda aberta; a confirmar |
| Cozinha | 22,00 | 2,40 × 1,60 = 3,84 | 17,5 % | ok |
| Despensa | 11,00 | sem janela | — | depósito; aceito |
| Área de serviço | 13,75 | 1,20² + 1,20² = 2,88 | 20,9 % | ok |
| Lavabo | 3,80 | 0,60 × 1,00 = 0,60 | 15,8 % | ok |
| Suíte master | 18,70 | 2,40 × 2,20 + 2,40 × 1,40 = 8,64 | 46,2 % | ok |
| Banheiro da master | 10,88 | 1,20² = 1,44 | 13,2 % | ok |
| Home office | 36,08 | 2 × (2,40 × 1,40) = 6,72 | 18,6 % | ok |
| Suíte 2 | 20,57 | 2,40 × 1,60 = 3,84 | 18,7 % | ok |
| Banheiro 2 | 7,00 | 1,20² = 1,44 | 20,6 % | ok |
| Suíte 3 | 23,40 | 2 × (2,40 × 1,40) = 6,72 | 28,7 % | ok |
| Banheiro 3 | 10,00 | 1,20² = 1,44 | 14,4 % | ok |

Todo banheiro tem janela para o exterior. Nenhum banheiro depende de exaustão.

### 6.2 Prumadas

| Prumada | Térreo | Pavimento 2 | Situação |
|---|---|---|---|
| Lavabo | lavabo (x 8,9 a 10,8; y 0 a 2,0) | banheiro da master (x 5,5 a 8,9; y 0 a 3,2) | ⚠ parcial: os dois compartilham a parede x = 8,9, e a prumada sobe por ela. Não estão sobrepostos |
| Área de serviço | área de serviço (x 0 a 5,5; y 11,5 a 14) | banheiro 2 (x 0 a 2,8; y 11,5 a 14) | alinhado: o banheiro 2 fica sobre a área de serviço |
| Cozinha | cozinha (x 0 a 5,5; y 5,5 a 9,5) | sobre a cozinha: home office e suíte 2 | ⚠ sem banheiro acima; a prumada da pia sobe pela parede x = 5,5 |
| Banheiro 3 | sobre a varanda e a jantar | banheiro 3 (x 5,5 a 8,0; y 10 a 14) | ⚠ sem parede molhada embaixo; a tubulação sobe pela parede x = 5,5 até a cota de esgoto |

Os três ⚠ ficam como decisão em aberto (seção 8, item 5). Não há solução sem mexer na distribuição dos quartos do pavimento 2.

## 7. Catálogo: tipos que faltam

Tipos novos para o projeto. Todos vêm de `upsertOpeningType` (projeto) ou de `DEFAULT_OPENING_TYPES` (padrão).

| id | Nome | Kind | Largura × altura | Peitoril | Folhas | Símbolo (`plan`) | Usado em |
|---|---|---|---|---|---|---|---|
| `ot_pv120` | Porta 120 × 210 pivotante | door | 1,20 × 2,10 | 0 | 1 | `pivot` | T1 |
| `ot_portao450` | Portão de garagem 4,50 × 2,20 | door | 4,50 × 2,20 | 0 | 2 | `sliding` | T2 |
| `ot_vao140` | Vão livre 1,40 × 2,40 | door | 1,40 × 2,40 | 0 | 0 | `swing` | T8 |
| `ot_vao180` | Vão livre 1,80 × 2,40 | door | 1,80 × 2,40 | 0 | 0 | `swing` | T11, T12 |
| `ot_vao240` | Vão livre 2,40 × 2,40 | door | 2,40 × 2,40 | 0 | 0 | `swing` | T13, T14, T15 |
| `ot_j240x220` | Janelão 2,40 × 2,20 | window | 2,40 × 2,20 | 0 | 2 | `sliding` | T5 |
| `ot_j240x160` | Janela 2,40 × 1,60 | window | 2,40 × 1,60 | 1,10 | 2 | `sliding` | T16, J3 |
| `ot_j240x140` | Janela 2,40 × 1,40 | window | 2,40 × 1,40 | 1,10 | 2 | `sliding` | J1, J2, J6, J8, J9 |
| `ot_j60x100` | Janela 0,60 × 1,00 | window | 0,60 × 1,00 | 1,50 | 1 | `casement` | T3 |
| `ot_pj240` | Porta-janela de correr 2,40 × 2,20 | door | 2,40 × 2,20 | 0 | 2 | `sliding` | J5 |

Total: 10 tipos novos. Já existem e são usados: `ot_p70`, `ot_p80`, `ot_p90`, `ot_j60`, `ot_j120`, `ot_j150`.

Parede opcional: `wt_alv14h` (PA-14 hidráulica), com as mesmas camadas de `wt_alv14`, para marcar as paredes com tubulação.

Como criar:

1. **No projeto (recomendado):** `upsertOpeningType` (`packages/model/src/commands.ts`), com `id`, `kind`, `name`, `width`, `height`, `sill`, `leaves`, `plan`, `frameMaterialId` (`mat_aluminio` nas janelas e `mat_madeira` nas portas), `glassMaterialId` (`mat_vidro`) e `closure: 'inherit'`.
2. **No padrão (todo projeto novo):** acrescentar em `DEFAULT_OPENING_TYPES` (`packages/model/src/defaults.ts`), com a função `ot(...)`.

## 8. Riscos e decisões em aberto

1. **Varanda gourmet aberta ao norte, sem guarda-corpo.** O app não tem guarda-corpo. A face norte da varanda (x 5,5 a 11,75) fica sem parede. Exigir guarda-corpo no projeto executivo.
2. **Sacada da suíte master sobre o recuo frontal.** A sacada projeta 1,20 m além da fachada sul, dentro dos 5 m de recuo frontal. Confirmar no código municipal se é permitida, e como ela é apoiada (o app não tem pilar).
3. **Sala de jantar sem janela externa.** A ventilação e a luz dependem do vão para a sala e para a varanda aberta. Confirmar com o código municipal.
4. **Closet 3 com 5,60 m²**, abaixo de 6 m². Aceito como armário embutido.
5. **Prumadas:** banheiro 3 sem parede molhada embaixo; cozinha sem banheiro acima; lavabo e banheiro da master só parcialmente alinhados (seção 6.2).
6. **Escada reta com fechamento de y 2,0 a 5,9 no lado do hall.** Reduz a visão da escada a partir do hall; só o pé fica visível da entrada. Alternativa: fechamento em vidro ou guarda, se o app permitir.
7. **Índices normativos não confirmados.** 1/6 de janela, áreas mínimas e dimensões do Neufert não foram verificados (ver A, seção 6).
8. **Coordenadas não montadas no app.** O furo do pavimento 2 pode ficar 0,1 m diferente, e os encontros de paredes podem pedir ajuste de 0,01 a 0,05 m.
9. **Pegada 11,75 × 14 m.** Não é a 13 × 15 pedida na revisão, porque essa pegada não cabe nos recuos laterais de 1,50 m do lote de 15 m.

**Relatório curto**

- **O que mudou e por quê:** a escada passou de L (que cortava o hall) para reta, encostada na parede oeste do hall. O hall abre direto para a sala e a jantar com vãos de 1,80 m. A cozinha liga direto à jantar com vão de 1,40 m. O lavabo saiu do pé da escada e foi para o sul da sala, com porta para o vestíbulo. A suíte master foi reorganizada, com acesso pelo corredor, e o banheiro e o closet ficam acessados do quarto. A pegada passou para 11,75 × 14 m, porque 13 m de largura não cabem nos recuos.
- **Tipos que faltam no catálogo:** 10 tipos novos (seção 7). Como criar: `upsertOpeningType` no projeto, ou `DEFAULT_OPENING_TYPES` no padrão.
- **Riscos principais:** varanda aberta sem guarda-corpo, sacada sobre o recuo frontal, sala de jantar sem janela externa, prumadas não alinhadas (banheiro 3 e cozinha), e índices normativos não confirmados.
- **Estado:** partido verificado por script, sem montagem no app. Próximo passo: montar no app e conferir o painel de avisos.
