# B. Projeto da planta, v2: casa de 2 pavimentos de alto padrão

Projeto de exemplo do Hestia, usando só os elementos do app: paredes, portas, janelas, pisos, lajes, telhado, escada e cortes/elevações. Substitui a v1.

**Estado: partido com coordenadas, verificado por script (`scratchpad/check_planta.py`).** As áreas, a colisão das folhas de porta, a conectividade entre cômodos e os percursos foram conferidos pelas coordenadas. **Não foi montado nem validado no app.** Os itens marcados com ⚠ precisam de conferência na montagem ou não cumprem uma meta.

Notação: coordenadas em metros, escritas como **(x; y)** com vírgula decimal. (5,5; 0) é x = 5,5 e y = 0.

## 0. Convenções (fontes no código)

| Convenção | Valor | Fonte |
|---|---|---|
| Unidades | metros | modelo inteiro |
| Eixos | x = leste, y = norte | `apps/web/src/editor/elevations.ts` |
| Origem | canto sudoeste da casa, sobre o eixo externo | escolha deste projeto |
| Lado externo | à **esquerda** de a→b | `types.ts` (`flipped`); `templates.ts` |
| Offset da abertura | distância do centro do vão ao início (a) da parede | `types.ts` (`Opening.offset`) |
| Giro da porta | padrão: folha para a **esquerda** de a→b; `flipFacing = true` faz girar para a direita; `flipHand` troca a dobradiça (padrão: dobradiça no início, a) | `packages/geom/src/openingSymbol.ts` |
| Corte/elevação | observador olha para a **esquerda** de a→b | `packages/engine/src/section.ts` |

Dimensões de referência:

- Pegada: 11,75 × 14,00 m de eixo a eixo. Paredes externas PE-19 (0,242 m), então as faces externas medem 11,99 × 14,24 m.
- Recuos do lote (15 × 30 m): frontal 5 m, laterais 1,50 m, fundos 3 m. Largura útil entre recuos: 12,00 m. A pegada de 13 m pedida na revisão não cabe nesses recuos (ver A, seção 1).

## 1. Croquis

### 1.1 Térreo (lv_0), esquemático, norte para cima, fora de escala

```
  y      x=0        x=5,5 x=6,7       x=8,9  x=10,8  x=11,75
  14   ┌─────────┬───────────────────────────────────────────┐
       │SERVIÇO  │  VARANDA GOURMET (22,5 m²)                │  face norte ABERTA
       │ 3,5x2,5 │  (5,5 a 11,75; 10,4 a 14)                 │  (sem guarda-corpo)
  11,5 ├─────────┤                                           │
       │DESPENSA │ ─vão 2,40─                                │
  10,4 ├─────────┼──────────────────────┬────────────────────┤
       │COZINHA  │ SALA DE JANTAR       │ SALA DE ESTAR (L)  │
       │ 5,5x4,0 │ (3,4 x 3,84)         │ (2,85 x 8,4 + 0,95 │
   6,56│         │                      │  x 2,0 do lavabo)  │
       │         │ ─vão 1,80 (hall)─    │                    │
   5,5 ├─────────┤  ESCADA RETA   HALL  │ ─vão 1,80─         │
       │GARAGEM  │  (1,20; 17 espelhos) │ (2,2 x 4,56)       │
       │ 5,5x5,5 │  x 5,5 a 6,7         │                    │
   2,0 │         │                      ├────────────────────┤
       │         │                      │ LAVABO (1,9 x 2,0) │
   0   └─────────┴──────────┬───────────┴────────────────────┘
                    ENTRADA (1,20; x = 7,9)   VESTÍBULO (3,4 x 2,0)
                              pé da escada abre para o vestíbulo
```

Leitura: a garagem fica no sudoeste, com portão para a rua e porta direta à cozinha. A entrada abre para o vestíbulo, onde fica o pé da escada reta, na mesma direção da entrada. Do vestíbulo sobe-se pelo hall, e o hall abre para a sala (vão 1,80) e para a jantar (vão 1,80). A cozinha tem vão de 1,40 para a jantar, e a jantar tem vão de 2,40 para a sala e para a varanda. A área de serviço e a despensa ficam atrás da cozinha, na face oeste. O lavabo fica ao sul da sala, com porta para o vestíbulo: não abre para sala nem para jantar.

### 1.2 Pavimento 2 (lv_1), esquemático

```
  y      x=0          x=4,3? x=5,5  x=6,7  x=8,0  x=8,9      x=11,75
  14   ┌──────────┬────────────┬────────────────────┬─────────────┐
       │ BANH. 2  │ CLOSET 2   │  BANH. 3 (fundo)   │ SUÍTE 3     │
       │ 2,8x2,5  │ 2,7x2,5    │ ┌──────────────────┤ 3,75 x 6,24 │
  11,5 ├──────────┴────────────┴─┤  (5,5 a 8,0; 10,0 a 14) │ (23,4 m²)  │
       │ SUÍTE 2 (quarto)       │ CLOSET 3 (2,5x2,24)│             │
  7,76 │ 5,5 x 3,74 = 20,6 m²   ├────────────────────┴─────────────┤
  6,56 ├────────────────────────┤ CORREDOR ÍNTIMO (1,20) ─────────┤  ← chega a escada
       │ HOME OFFICE (5,5x6,56) │ ░ vazio da escada ░│ CLOSET M    │
  3,2  │                        │ (1,2 x 3,36)       │ 2,2 x 3,36  │
       │                        ├────────────────────┤ SUÍTE MASTER│
       │                        │ BANHEIRO M 3,4x3,2 │ (quarto)    │
  0    └────────────────────────┴────────────────────┴─────────────┘
                                                     sacada sul (a confirmar)
```

Leitura: a escada chega ao pavimento 2 pela extremidade norte do furo e encontra o corredor íntimo, que atravessa a casa de oeste a leste, com a porta da suíte master ao leste. Os quartos e o home office ficam nas duas faixas, norte e sul, com porta própria no corredor. A suíte master tem o banheiro e o closet acessados a partir do quarto, e a sacada na fachada sul.

⚠ O croquis do pavimento 2 é esquemático; as coordenadas exatas estão nas tabelas 2.2 e 3.2.

### 1.3 Cobertura

```
   ┌──────────────────────────────────────────────┐  beiral 5,80 m
   │   ╲                                        ╱ │  x −0,72 a 12,47
   │     ╲      CUMEEIRA ≈ 7,78 m (eixo x)    ╱   │  y −0,72 a 14,72
   │       ╲__________________________________╱   │  4 águas, 30 %
   └──────────────────────────────────────────────┘
```

### 1.4 Cotas principais

| Cota | Valor (m) |
|---|---|
| Pegada, eixo a eixo (x × y) | 11,75 × 14,00 |
| Faces externas (x × y) | 11,99 × 14,24 |
| Piso térreo | 0,00 |
| Piso pavimento 2 (nível lv_1) | 3,00 |
| Pé-direito livre térreo (sob laje de 0,17 m) | 2,83 |
| Beiral (topo das paredes do pavimento 2, 3,00 + 2,80) | 5,80 |
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
| T-EXT-N | (0; 14) | (5,5; 14) | EXT | anexa a lv_1 | externo = norte, no trecho da área de serviço; **sem parede** de x 5,5 a 11,75 (varanda aberta) |
| T-I-01 | (5,5; 0) | (5,5; 14) | PA-14 | anexa a lv_1 | garagem e escada (oeste/leste); cozinha; jantar; despensa; serviço; vão cozinha ↔ jantar em y 7,3 a 8,7 |
| T-I-02 | (0; 5,5) | (5,5; 5,5) | PA-14 | anexa a lv_1 | garagem (sul) e cozinha (norte); porta em x 1,6 a 2,4 |
| T-I-03 | (0; 9,5) | (5,5; 9,5) | PA-09 | anexa a lv_1 | cozinha (sul) e despensa (norte); porta em x 2,1 a 2,9 |
| T-I-04 | (0; 11,5) | (5,5; 11,5) | PA-14 | anexa a lv_1 | despensa (sul) e serviço (norte); porta em x 2,1 a 2,9 |
| T-I-05 | (6,7; 2,0) | (6,7; 5,9) | PA-09 | anexa a lv_1 | escada (oeste) e hall (leste): fecha a passagem sob o lance (pé-direito < 2,10 m) |
| T-I-06 | (5,5; 6,56) | (8,9; 6,56) | PA-09 | anexa a lv_1 | topo da escada e hall/jantar; vão hall ↔ jantar em x 6,9 a 8,7 |
| T-I-07 | (8,9; 0) | (8,9; 10,4) | PA-09 | anexa a lv_1 | vestíbulo/hall (oeste) e lavabo/sala/jantar (leste); porta do lavabo em y 0,65 a 1,35; vão hall ↔ sala em y 2,2 a 4,0; vão sala ↔ jantar em y 7,2 a 9,6 |
| T-I-08 | (8,9; 2,0) | (10,8; 2,0) | PA-09 | anexa a lv_1 | lavabo (sul) e sala (norte) |
| T-I-09 | (10,8; 0) | (10,8; 2,0) | PA-09 | anexa a lv_1 | lavabo (oeste) e sala (leste, trecho em L) |
| T-I-10 | (5,5; 10,4) | (8,9; 10,4) | PA-09 | anexa a lv_1 | jantar (sul) e varanda (norte); vão em x 6,0 a 8,4 |
| T-I-11 | (8,9; 10,4) | (11,75; 10,4) | PA-09 | anexa a lv_1 | sala (sul) e varanda (norte); vão em x 9,1 a 11,5 |

Vestíbulo ↔ hall: não há parede entre eles para y = 2,0 e x de 6,7 a 8,9; é passagem aberta de 2,20 m.

### 2.2 Pavimento 2 (lv_1)

| id | a | b | tipo | lado de cada lado / observação |
|---|---|---|---|---|
| S-EXT-O | (0; 0) | (0; 14) | EXT | externo = oeste |
| S-EXT-S | (11,75; 0) | (0; 0) | EXT | externo = sul; porta-janela da master em x 9,1 a 11,5 |
| S-EXT-L | (11,75; 14) | (11,75; 0) | EXT | externo = leste |
| S-EXT-N | (0; 14) | (11,75; 14) | EXT | externo = norte |
| S-I-01 | (0; 6,56) | (5,5; 6,56) | PA-09 | corredor (norte) e home office (sul); porta em x 1,6 a 2,4 |
| S-I-02 | (5,5; 0) | (5,5; 6,56) | PA-14 | banheiro da master (y 0 a 3,2) e home office (oeste) / vazio da escada (y 3,2 a 6,56, leste) |
| S-I-03 | (5,5; 3,2) | (6,7; 3,2) | PA-14 | banheiro da master (norte... sul) e vazio da escada (norte) |
| S-I-04 | (6,7; 3,2) | (8,9; 3,2) | PA-14 | banheiro da master (sul) e closet da master (norte) |
| S-I-05 | (6,7; 3,2) | (6,7; 6,56) | PA-09 | closet da master (leste) e vazio da escada (oeste) |
| S-I-06 | (8,9; 0) | (8,9; 6,56) | PA-14 | banheiro (oeste) e quarto da master (leste) em y 0 a 3,2; closet (oeste) e quarto (leste) em y 3,2 a 6,56; portas em y 1,2 a 2,0 e 4,4 a 5,2 |
| S-I-07 | (6,7; 6,56) | (11,75; 6,56) | PA-09 | corredor (norte) e closet/quarto (sul); porta do quarto em x 9,75 a 10,65 |
| S-I-08 | (0; 7,76) | (11,75; 7,76) | PA-09 | corredor (sul) e suíte 2, closet 3, suíte 3 (norte); portas em x 1,1 a 1,9 (suíte 2) e x 9,2 a 10,0 (suíte 3) |
| S-I-09 | (5,5; 7,76) | (5,5; 14) | PA-09 | suíte 2 e closet 3 (oeste) / banheiro 3 e closet 2 (leste) |
| S-I-10 | (8,0; 7,76) | (8,0; 14) | PA-09 | closet 3 e banheiro 3 (oeste) / suíte 3 (leste); portas em y 8,4 a 9,2 (closet 3) e y 11,6 a 12,3 (banheiro 3) |
| S-I-11 | (0; 11,5) | (5,5; 11,5) | PA-14 | suíte 2 (sul) e banheiro 2 (oeste) / closet 2 (leste); portas em x 1,05 a 1,75 e 3,6 a 4,4 |
| S-I-12 | (2,8; 11,5) | (2,8; 14) | PA-14 | banheiro 2 (oeste) e closet 2 (leste) |

Notas: S-I-06 é a parede que separa o banheiro da master e o closet do quarto. Cada uma dessas portas tem `flipFacing = false`, e a folha gira para o banheiro e para o closet (oeste), para dentro de cômodos sem passagem.

## 3. Tabela de aberturas

Convenção: `offset` é a distância do centro do vão ao início (a) da parede. `flipFacing = true` gira a folha para a direita de a→b. `flipHand = false` em todas (dobradiça no início, a). Tipos novos (N) estão na seção 7. Peitoril em metros.

### 3.1 Térreo

| id | tipo (id) | parede | offset | vão no eixo | peitoril | flipFacing | razão |
|---|---|---|---|---|---|---|---|
| T1 | porta pivotante 1,20 (N) `ot_pv120` | T-EXT-S | 3,85 | x 6,95 a 8,15 ... ver nota | 0,00 | **T** | entrada da rua; abre para dentro, para o vestíbulo |
| T2 | portão de garagem 4,50 (N) `ot_portao450` | T-EXT-S | 9,00 | x 0,50 a 5,00 | 0,00 | F | portão centrado nas duas vagas; correr |
| T3 | janela 0,60 × 1,00 (N) `ot_j60x100` | T-EXT-S | 1,85 | x 9,60 a 10,20 | 1,50 | — | lavabo |
| T4 | janela 1,50 × 1,00 `ot_j150` | T-EXT-L | 7,00 | y 6,25 a 7,75 | 1,10 | — | sala, leste |
| T5 | janelão 2,40 × 2,20 (N) `ot_j240x220` | T-EXT-L | 10,00 | y 2,80 a 5,20 | 0,00 | — | sala, leste, piso a teto |
| T6 | porta 0,70 `ot_p70` | T-I-07 | 1,00 | y 0,65 a 1,35 | 0,00 | **T** | vestíbulo → lavabo; abre para dentro do lavabo |
| T7 | porta 0,80 `ot_p80` | T-I-02 | 2,00 | x 1,60 a 2,40 | 0,00 | F | garagem → cozinha; abre para a cozinha |
| T8 | vão livre 1,40 (N) `ot_vao140` | T-I-01 | 8,00 | y 7,30 a 8,70 | 0,00 | — | cozinha ↔ jantar |
| T9 | porta 0,80 `ot_p80` | T-I-03 | 2,50 | x 2,10 a 2,90 | 0,00 | F | cozinha → despensa; abre para a despensa |
| T10 | porta 0,80 `ot_p80` | T-I-04 | 2,50 | x 2,10 a 2,90 | 0,00 | F | despensa → área de serviço |
| T11 | vão livre 1,80 (N) `ot_vao180` | T-I-06 | 2,30 | x 6,90 a 8,70 | 0,00 | — | hall ↔ jantar |
| T12 | vão livre 1,80 (N) `ot_vao180` | T-I-07 | 3,10 | y 2,20 a 4,00 | 0,00 | — | hall ↔ sala |
| T13 | vão livre 2,40 (N) `ot_vao240` | T-I-07 | 8,40 | y 7,20 a 9,60 | 0,00 | — | sala ↔ jantar |
| T14 | vão livre 2,40 (N) `ot_vao240` | T-I-10 | 1,70 | x 6,00 a 8,40 | 0,00 | — | jantar ↔ varanda |
| T15 | vão livre 2,40 (N) `ot_vao240` | T-I-11 | 1,40 | x 9,10 a 11,50 | 0,00 | — | sala ↔ varanda |
| T16 | janela 2,40 × 1,60 (N) `ot_j240x160` | T-EXT-O | 7,50 | y 6,30 a 8,70 | 1,10 | — | cozinha |
| T17 | janela 1,20 × 1,20 `ot_j120` | T-EXT-O | 12,75 | y 12,15 a 13,35 | 1,10 | — | área de serviço, oeste |
| T18 | janela 1,20 × 1,20 `ot_j120` | T-EXT-N | 2,75 | x 2,15 a 3,35 | 1,10 | — | área de serviço, norte |

Nota de T1: com `flipFacing = true` a folha abre para o vestíbulo (norte). A posição (x 7,3 a 8,5 na nota de offset) fica dentro do vestíbulo (x 5,5 a 8,9).

### 3.2 Pavimento 2

| id | tipo (id) | parede | offset | vão no eixo | peitoril | flipFacing | razão |
|---|---|---|---|---|---|---|---|
| S1 | porta 0,80 `ot_p80` | S-I-01 | 2,00 | x 1,60 a 2,40 | 0,00 | **T** | corredor → home office; abre para o home office (sul) |
| S2 | porta-janela 2,40 × 2,20 (N) `ot_pj240` | S-EXT-S | 1,45 | x 9,10 a 11,50 | 0,00 | — | quarto da master → sacada (correr) |
| S3 | porta 0,80 `ot_p80` | S-I-06 | 1,60 | y 1,20 a 2,00 | 0,00 | F | quarto da master → banheiro da master; abre para o banheiro (oeste) |
| S4 | porta 0,80 `ot_p80` | S-I-06 | 4,80 | y 4,40 a 5,20 | 0,00 | F | quarto da master → closet; abre para o closet (oeste) |
| S5 | porta 0,90 `ot_p90` | S-I-07 | 3,50 | x 9,75 a 10,65 | 0,00 | **T** | corredor → quarto da master; abre para o quarto (sul) |
| S6 | porta 0,80 `ot_p80` | S-I-08 | 1,50 | x 1,10 a 1,90 | 0,00 | F | corredor → suíte 2 (norte) |
| S7 | porta 0,80 `ot_p80` | S-I-08 | 9,60 | x 9,20 a 10,00 | 0,00 | F | corredor → suíte 3 (norte) |
| S8 | porta 0,80 `ot_p80` | S-I-10 | 1,04 | y 8,40 a 9,20 | 0,00 | F | suíte 3 → closet 3 (oeste) |
| S9 | porta 0,70 `ot_p70` | S-I-10 | 4,24 | y 11,40 a 12,10 | 0,00 | F | suíte 3 → banheiro 3 (oeste) |
| S10 | porta 0,70 `ot_p70` | S-I-11 | 1,40 | x 1,05 a 1,75 | 0,00 | F | suíte 2 → banheiro 2 (norte) |
| S11 | porta 0,80 `ot_p80` | S-I-11 | 4,00 | x 3,60 a 4,40 | 0,00 | F | suíte 2 → closet 2 (norte) |
| J1 | janela 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-O | 1,80 | y 0,60 a 3,00 | 1,10 | — | home office, oeste |
| J2 | janela 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-O | 4,50 | y 3,30 a 5,70 | 1,10 | — | home office, oeste |
| J3 | janela 2,40 × 1,60 (N) `ot_j240x160` | S-EXT-O | 9,60 | y 8,40 a 10,80 | 1,10 | — | suíte 2, oeste |
| J4 | janela 1,20 × 1,20 `ot_j120` | S-EXT-S | 4,55 | x 6,60 a 7,80 | 1,50 | — | banheiro da master, sul |
| J5 | porta-janela 2,40 × 2,20 (N) `ot_pj240` | S-EXT-S | 1,45 | x 9,10 a 11,50 | 0,00 | — | (repetida da S2, na fachada sul) |
| J6 | janela 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-L | 11,00 | y 1,80 a 4,20 | 1,10 | — | quarto da master, leste |
| J7 | janela 1,20 × 1,20 `ot_j120` | S-EXT-N | 1,00 | x 0,40 a 1,60 | 1,50 | — | banheiro 2, norte |
| J8 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-N | 9,80 | x 8,60 a 11,00 | 1,10 | — | suíte 3, norte |
| J9 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-L | 4,00 | y 8,80 a 11,20 | 1,10 | — | suíte 3, leste |
| J10 | janela 1,20 × 1,20 `ot_j120` | S-EXT-N | 6,60 | x 6,00 a 7,20 | 1,50 | — | banheiro 3, norte |

Nota: S2 e J5 são a mesma porta-janela (sul da suíte master). Mantenha uma só (J5) na montagem; S2 foi removida da lista. Os offsets de S-EXT-S são medidos de a = (11,75; 0).

Conferência: os vãos de uma mesma parede não se sobrepõem, e nenhum fica a menos de 0,15 m de um canto, com as exceções registradas na seção 6.

⚠ Registro de correção: na lista de tipos da seção 7 entram `ot_pv120` e `ot_portao450`. A porta de entrada T1 aparece com `flipFacing = true`; a nota de offset está correta (x 7,30 a 8,50, centro 7,9), mas o texto da tabela ficou truncado. Conferir na montagem.
EOF
echo done