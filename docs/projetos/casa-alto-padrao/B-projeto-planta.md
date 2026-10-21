# B. Projeto da planta: casa de 2 pavimentos de alto padrão

Projeto de exemplo para o Hestia, usando só os elementos do app: paredes, portas, janelas, pisos, lajes, telhado, escada e cortes/elevações.

**Estado: partido com coordenadas, conferido no papel. Ainda não foi montado nem validado no app.** Os números de escada foram conferidos contra as regras do próprio app (`packages/engine/src/stairNorms.ts`, `packages/model/src/stairTypes.ts`). Os itens marcados com ⚠ pedem atenção na montagem.

Notação: coordenadas em metros, escritas como **(x; y)** com vírgula decimal. Exemplo: (5,5; 0) é x = 5,5 e y = 0.

## 0. Convenções (fontes no código)

| Convenção | Valor | Fonte |
|---|---|---|
| Unidades | metros | modelo inteiro |
| Eixos | x = leste, y = norte | `apps/web/src/editor/elevations.ts` (a elevação "Norte" olha para −y) |
| Origem | canto sudoeste da casa, sobre o eixo externo | escolha deste projeto |
| Lado externo | à **esquerda** de a→b | `packages/model/src/types.ts` (`flipped`); `templates.ts` (perímetro em sentido horário) |
| Offset da abertura | distância do centro do vão ao início (a) da parede, ao longo de a→b | `types.ts` (`Opening.offset`) |
| Giro da porta | padrão: folha para a **esquerda** de a→b; `flipFacing = true` faz girar para a direita; `flipHand` troca a dobradiça | `packages/geom/src/openingSymbol.ts` |
| Corte/elevação | observador olha para a **esquerda** de a→b; x cresce para a direita do desenho | `packages/engine/src/section.ts` |

Nota de origem: os eixos das paredes externas ficam em x = 0 e x = 12, y = 0 e y = 14. A face externa fica 0,121 m além do eixo (parede PE-19 com 0,242 m). Com o recuo lateral de 1,50 m, a face externa fica a 1,50 m da divisa.

## 1. Croquis

### 1.1 Térreo (lv_0), esquemático, norte para cima, fora de escala

```
   y                 x=0            x=5,5     x=9,0  x=10,2          x=12
  17  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ VARANDA GOURMET (coberta, 6,5 x 3,0) ░░░░░
  14  ┌───────────────────────────────┬──────────────────────────────────────┐
      │  SALA DE ESTAR (5,5 x 5,0)    │  SALA DE JANTAR (6,5 x 5,0)          │
      │  janelão N, janela O          │  vão p/ varanda (N), janela N e L    │
   9  ├───────────────────────────────┼─────────────┬──────────┬─────────────┤
      │  COZINHA (5,5 x 3,5)          │ SERVIÇO     │ PASSAGEM │ DESPENSA /  │
      │  janela O                     │ (3,5 x 2,5) │ P (1,20) │ DEPÓSITO    │
      │                               │ ░ sob ░░░░  │          │ (1,8 x 6,5) │
   6,5 │                               ├─────────────┤          │             │
      │                               │ ESCADA L    │          │             │
   5,5 ├───────────────┐               │ 1º lance N  │          ├─────────────┤
      │  GARAGEM      │               │ patamar     │          │ LAVABO      │
      │  2 vagas      │  HALL DE      │ 2º lance O  │          │ (1,8 x 2,5) │
      │  5,5 x 5,5    │  ENTRADA      │ (3,5 x 3,5) │          │             │
   0  └───────────────┴───────────────┴─────────────┴──────────┴─────────────┘
           portão 4,5        porta de entrada 1,2 (x = 6,5)
```

Leitura: garagem no sudoeste, com portão para a rua e porta direta ao hall e à cozinha. O hall de entrada fica de frente para a porta da rua e ao lado da escada. A escada L sobe para o norte a partir do hall e depois volta para oeste: o lance 2 termina sobre a cozinha e chega ao corredor íntimo do pavimento 2. A passagem P (1,20 m) liga hall, serviço, lavabo, despensa e sala de jantar sem atravessar nenhum cômodo social.

### 1.2 Pavimento 2 (lv_1), esquemático

```
   y       x=0          x=4,3 x=5,5      x=9,0           x=12
  14   ┌─────────────┬────┬─────────────┬───────────────────┐
       │ SUÍTE 2     │CORR│ SUÍTE 3     │ SUÍTE MASTER      │  ░ varanda da
       │ (4,3 x 6,0) │1,2m│ (3,5 x 5,0) │ quarto 3,0 x 7,5  │  ░ master, sobre
       │             │    │             │ (22,5 m²)         │  ░ a varanda
   8   ├─────────────┤    ├─────────────┤                   │  ░ gourmet
       │ BANHEIRO    │    │ BANHEIRO 3  │                   │
   6,5 ├─────────────┤    ├─────────────┼─────────┬─────────┤
       │ HOME OFFICE │    │ abertura da │ CLOSET / BANH.    │
       │ (4,3 x 6,5) │    │ escada      │ master (3,0 x 3,5)│
   3   │             ├────┴─────────────┤                   │
       │             │ SALA ÍNTIMA      │                   │
       │             │ (6,5 x 3,0)      │                   │
   0   └─────────────┴──────────────────┴───────────────────┘
```

Leitura: a escada chega ao pavimento 2 pela abertura da laje (furo automático, seção 4.4) e entra no corredor íntimo (x 4,3 a 5,5). A sala íntima fica na faixa sul e dá acesso ao closet e à suíte master. A suíte master tem janela para o leste e porta-janela para a varanda, no norte.

### 1.3 Cobertura (esquema)

```
   ┌────────────────────────────────────────────┐   beiral: x −0,72 a 12,72
   │ ╲                                        ╱ │   y −0,72 a 14,72
   │   ╲          CUMEEIRA (≈ 7,8)          ╱   │   4 águas, inclinação 30 %
   │     ╲____________________________________╱   │
   │     ╱                                    ╲   │
   └────────────────────────────────────────────┘
   Varanda: água única caindo para o norte (x 5,5 a 12,7; y 14 a 17,7)
```

### 1.4 Cotas principais

| Cota | Valor (m) |
|---|---|
| Casa, eixo a eixo: largura (x) × profundidade (y) | 12,00 × 14,00 |
| Varanda gourmet, projeção ao norte (y 14 a 17) | 3,00 |
| Piso térreo | 0,00 |
| Piso pavimento 2 (cota do nível lv_1) | 3,00 |
| Pé-direito livre térreo (sob a laje de 0,17 m) | 2,83 |
| Beiral (topo das paredes do pavimento 2: 3,00 + 2,80) | 5,80 |
| Cumeeira | ≈ 7,8 |

## 2. Tabela de paredes

Tipos do catálogo usados:

| Código | Tipo (id) | Espessura total | Uso |
|---|---|---|---|
| EXT | `wt_ext19` (PE-19, externa 19 cm com cerâmica) | 0,242 m | fachadas |
| PA-14 | `wt_alv14` (alvenaria 14 + reboco) | 0,184 m | paredes com tubulação (serviço, lavabo, banheiros) e paredes do furo da escada |
| PA-09 | `wt_alv9` (alvenaria 9, divisória) | 0,124 m | divisórias de quarto, passagem e salas |

⚠ Divisória hidráulica: o catálogo não tem tipo próprio. Uso PA-14 nas paredes de molhados, por ter espessura para tubulação. Uma prumada de verdade pede um tipo "PA-14 hidráulica" (seção 7).

Altura: térreo com topo anexado ao piso do pavimento 2 (`topLevelId = lv_1`, `attachTopToFloor = true`), que desce até a face inferior da laje (2,83 m). Pavimento 2: 2,80 m (`height`), topo no beiral.

Todas as paredes são retas, com `locationLine = wallCenter`, `flipped = false` e junções em encosto (`butt`). Nas paredes externas, a→b está orientado para que o lado externo fique à esquerda.

### 2.1 Térreo (lv_0)

| id | a | b | tipo | topo | lado de cada lado / observação |
|---|---|---|---|---|---|
| T-EXT-O | (0; 0) | (0; 14) | EXT | anexa a lv_1 | externo = oeste |
| T-EXT-N | (0; 14) | (12; 14) | EXT | anexa a lv_1 | externo = norte; vão para a varanda em x 7,3 a 9,7 |
| T-EXT-L | (12; 14) | (12; 0) | EXT | anexa a lv_1 | externo = leste |
| T-EXT-S | (12; 0) | (0; 0) | EXT | anexa a lv_1 | externo = sul (rua) |
| T-I-01 | (5,5; 0) | (5,5; 9) | PA-14 | anexa a lv_1 | oeste: garagem (y 0 a 5,5) e cozinha (y 5,5 a 9); leste: hall (y 0 a 3), faixa livre do hall (y 3 a 5,4), serviço (y 6,5 a 9) |
| T-I-02 | (0; 5,5) | (5,5; 5,5) | PA-14 | anexa a lv_1 | garagem (sul) e cozinha (norte) |
| T-I-03 | (0; 9) | (5,5; 9) | PA-09 | anexa a lv_1 | cozinha (sul) e estar (norte); vão livre em x 1,3 a 3,7 |
| T-I-04 | (5,5; 6,5) | (9; 6,5) | PA-14 | anexa a lv_1 | serviço (norte) e área sob o 2º lance (sul) |
| T-I-05 | (5,5; 9) | (9; 9) | PA-14 | anexa a lv_1 | serviço (sul) e jantar (norte) |
| T-I-06 | (9; 9) | (12; 9) | PA-09 | anexa a lv_1 | despensa e passagem P (sul) e jantar (norte); porta P→jantar em x 9,2 a 10,1 |
| T-I-07 | (9; 0) | (9; 9) | PA-09 | anexa a lv_1 | hall, escada e serviço (oeste); passagem P (leste); porta H→P em y 1,1 a 1,9 e P→serviço em y 7,4 a 8,1 |
| T-I-08 | (10,2; 0) | (10,2; 2,5) | PA-09 | anexa a lv_1 | passagem P (oeste) e lavabo (leste); porta em y 0,9 a 1,6 |
| T-I-09 | (10,2; 2,5) | (12; 2,5) | PA-09 | anexa a lv_1 | lavabo (sul) e despensa (norte) |
| T-I-10 | (10,2; 2,5) | (10,2; 9) | PA-09 | anexa a lv_1 | passagem P (oeste) e despensa (leste); porta em y 4,65 a 5,35 |
| T-I-11 | (5,5; 9) | (5,5; 14) | PA-09 | anexa a lv_1 | estar (oeste) e jantar (leste); vão livre em y 10,3 a 12,7 |

### 2.2 Pavimento 2 (lv_1)

Altura 2,80 m, topo no beiral.

| id | a | b | tipo | lado de cada lado / observação |
|---|---|---|---|---|
| S-EXT-O | (0; 0) | (0; 14) | EXT | externo = oeste |
| S-EXT-N | (0; 14) | (12; 14) | EXT | externo = norte; porta-janela da suíte master em x 9,3 a 11,7 |
| S-EXT-L | (12; 14) | (12; 0) | EXT | externo = leste |
| S-EXT-S | (12; 0) | (0; 0) | EXT | externo = sul |
| S-I-01 | (4,3; 0) | (4,3; 14) | PA-09 | oeste: home office, banheiro social, suíte 2; leste: corredor íntimo |
| S-I-02 | (5,5; 0) | (5,5; 3) | PA-09 | oeste: corredor; leste: sala íntima; porta em y 1,05 a 1,95 |
| S-I-03 | (5,5; 6,5) | (5,5; 14) | PA-09 | oeste: corredor; leste: banheiro 3 (y 6,5 a 9) e suíte 3 (y 9 a 14) |
| S-I-04 | (5,5; 6,5) | (9; 6,5) | PA-14 | norte: banheiro 3; sul: abertura da escada |
| S-I-05 | (9; 3) | (9; 14) | PA-14 | oeste: abertura da escada, banheiro 3 e suíte 3; leste: closet e quarto da master |
| S-I-06 | (5,5; 9) | (9; 9) | PA-09 | sul: banheiro 3; norte: suíte 3 |
| S-I-07 | (9; 3) | (12; 3) | PA-09 | sul: sala íntima; norte: closet da master; porta em x 10,05 a 10,95 |
| S-I-08 | (9; 6,5) | (12; 6,5) | PA-09 | sul: closet da master; norte: quarto da master; porta em x 10,05 a 10,95 |
| S-I-09 | (0; 6,5) | (4,3; 6,5) | PA-09 | sul: home office; norte: banheiro social |
| S-I-10 | (0; 8) | (4,3; 8) | PA-09 | sul: banheiro social; norte: suíte 2 |

## 3. Tabela de aberturas

Convenção: `offset` é a distância do centro do vão ao início (a) da parede. `flipFacing = true` gira a folha para a direita de a→b. Tipos novos são marcados (N) e listados na seção 7.

Peitoris: porta 0,00; janela de sala e dormitório 1,10; banheiro e lavabo 1,50; cozinha 1,10; janelão e porta-janela 0,00.

### 3.1 Térreo

| id | tipo (id) | parede | offset | vão no eixo | peitoril | flipFacing | razão |
|---|---|---|---|---|---|---|---|
| T-O-01 | portão 4,50 (N) `ot_portao450` | T-EXT-S | 9,00 | x 0,75 a 5,25 | 0,00 | F | portão da garagem, centrado nas duas vagas |
| T-O-02 | porta de entrada 1,20 pivotante (N) `ot_pv120` | T-EXT-S | 5,50 | x 5,90 a 7,10 | 0,00 | F | entrada social, de frente para o hall e a escada |
| T-O-03 | janela 0,60 × 0,60 `ot_j60` | T-EXT-S | 1,00 | x 10,70 a 11,30 | 1,50 | F | lavabo, peitoril alto por privacidade |
| T-O-04 | porta 0,80 `ot_p80` | T-I-01 | 2,25 | y 1,85 a 2,65 | 0,00 | **T** | garagem → hall; folha gira para o hall (leste) |
| T-O-05 | porta 0,80 `ot_p80` | T-I-02 | 2,00 | x 1,60 a 2,40 | 0,00 | F | garagem → cozinha; folha gira para a cozinha (norte) |
| T-O-06 | vão livre 2,40 (N) `ot_vao240` | T-I-03 | 2,50 | x 1,30 a 3,70 | 0,00 | — | cozinha ↔ estar, integração sem porta |
| T-O-07 | porta 0,80 `ot_p80` | T-I-07 | 1,50 | y 1,10 a 1,90 | 0,00 | F | hall → passagem P; folha gira para o hall (oeste) |
| T-O-08 | porta 0,80 `ot_p80` | T-I-01 | 7,50 | y 7,10 a 7,90 | 0,00 | F | cozinha → serviço; folha gira para a cozinha (oeste) |
| T-O-09 | porta 0,70 `ot_p70` | T-I-07 | 7,75 | y 7,40 a 8,10 | 0,00 | F | passagem P → serviço; folha gira para o serviço (oeste) |
| T-O-10 | porta 0,70 `ot_p70` | T-I-08 | 1,25 | y 0,90 a 1,60 | 0,00 | **T** | passagem P → lavabo; folha gira para o lavabo (leste), sem invadir a P |
| T-O-11 | porta 0,90 `ot_p90` | T-I-06 | 0,65 | x 9,20 a 10,10 | 0,00 | F | passagem P → sala de jantar; folha gira para a jantar (norte) |
| T-O-12 | porta 0,70 `ot_p70` | T-I-10 | 2,50 | y 4,65 a 5,35 | 0,00 | **T** | passagem P → despensa; folha gira para a despensa (leste) |
| T-O-13 | vão livre 2,40 (N) `ot_vao240` | T-I-11 | 2,50 | y 10,30 a 12,70 | 0,00 | — | estar ↔ jantar, integração |
| T-O-14 | vão livre 2,40 (N) `ot_vao240` | T-EXT-N | 8,50 | x 7,30 a 9,70 | 0,00 | — | jantar ↔ varanda gourmet |
| T-O-15 | janelão 2,40 × 2,20 (N) `ot_j240x220` | T-EXT-N | 2,00 | x 0,80 a 3,20 | 0,00 | — | estar: janelão para o norte (sol de inverno) |
| T-O-16 | janela 1,50 × 1,00 `ot_j150` | T-EXT-N | 10,90 | x 10,15 a 11,65 | 1,10 | — | jantar, luz pela face norte |
| T-O-17 | janela 1,50 × 1,00 `ot_j150` | T-EXT-O | 11,50 | y 10,75 a 12,25 | 1,10 | — | estar: janela menor para o oeste (sol da tarde) |
| T-O-18 | janela 2,40 × 1,40 (N) `ot_j240x140` | T-EXT-O | 7,25 | y 6,05 a 8,45 | 1,10 | — | cozinha: 3,36 m² de janela para 19,25 m² de piso (≈ 1/5,7) |
| T-O-19 | janelão 2,40 × 2,20 (N) `ot_j240x220` | T-EXT-L | 2,50 | y 10,30 a 12,70 | 0,00 | — | jantar: janelão para o leste, sol da manhã |
| T-O-20 | janela 0,60 × 0,60 `ot_j60` | T-EXT-L | 9,00 | y 4,70 a 5,30 | 1,50 | — | depósito: luz e ventilação mínimas |

### 3.2 Pavimento 2

| id | tipo (id) | parede | offset | vão no eixo | peitoril | flipFacing | razão |
|---|---|---|---|---|---|---|---|
| S-O-01 | porta 0,80 `ot_p80` | S-I-01 | 3,00 | y 2,60 a 3,40 | 0,00 | F | corredor → home office; folha gira para o home office (oeste) |
| S-O-02 | porta 0,70 `ot_p70` | S-I-01 | 7,25 | y 6,90 a 7,60 | 0,00 | F | corredor → banheiro social (oeste) |
| S-O-03 | porta 0,80 `ot_p80` | S-I-01 | 10,50 | y 10,10 a 10,90 | 0,00 | F | corredor → suíte 2 (oeste) |
| S-O-04 | porta 0,90 `ot_p90` | S-I-02 | 1,50 | y 1,05 a 1,95 | 0,00 | **T** | corredor → sala íntima; folha gira para a sala íntima (leste) |
| S-O-05 | porta 0,70 `ot_p70` | S-I-03 | 1,00 | y 6,65 a 7,35 | 0,00 | **T** | corredor → banheiro 3; folha gira para dentro do banheiro (leste) |
| S-O-06 | porta 0,80 `ot_p80` | S-I-03 | 4,00 | y 10,10 a 10,90 | 0,00 | **T** | corredor → suíte 3; folha gira para dentro da suíte (leste) |
| S-O-07 | porta 0,90 `ot_p90` | S-I-07 | 1,50 | x 10,05 a 10,95 | 0,00 | F | sala íntima → closet da master; folha gira para o closet (norte) |
| S-O-08 | porta 0,80 `ot_p80` | S-I-08 | 1,50 | x 10,10 a 10,90 | 0,00 | F | closet → quarto da master (norte) |
| S-O-09 | porta-janela 2,40 × 2,20 (N) `ot_pj240` | S-EXT-N | 10,50 | x 9,30 a 11,70 | 0,00 | — | suíte master → varanda, correr |
| S-O-10 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-N | 7,50 | x 6,30 a 8,70 | 1,10 | — | suíte 3: janela para o norte, sobre a varanda |
| S-O-11 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-N | 2,00 | x 0,80 a 3,20 | 1,10 | — | suíte 2: norte, sol da manhã |
| S-O-12 | janela 1,20 × 1,20 `ot_j120` | S-EXT-O | 11,00 | y 10,40 a 11,60 | 1,10 | — | suíte 2: janela lateral |
| S-O-13 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-O | 3,00 | y 1,80 a 4,20 | 1,10 | — | home office: oeste |
| S-O-14 | janela 0,60 × 0,60 `ot_j60` | S-EXT-O | 7,25 | y 6,95 a 7,55 | 1,50 | — | banheiro social |
| S-O-15 | janela 1,20 × 1,20 `ot_j120` | S-EXT-S | 9,85 | x 1,55 a 2,75 | 1,10 | — | home office: sul |
| S-O-16 | janelão 2,40 × 1,40 (N) `ot_j240x140` | S-EXT-S | 2,00 | x 8,80 a 11,20 | 1,10 | — | sala íntima: sul |
| S-O-17 | janela 1,50 × 1,00 `ot_j150` | S-EXT-L | 3,50 | y 9,75 a 11,25 | 1,10 | — | suíte master: leste, sol da manhã |

Notas de conferência: os offsets da mesma parede não se sobrepõem (a verificação está na seção 6). As portas da passagem P abrem para o hall, para o serviço, para a jantar, para o lavabo e para a despensa, mas nenhuma para dentro da passagem (T-O-10 e T-O-12 têm `flipFacing = true`, porque sem isso a folha invade os 1,20 m da passagem). T-O-07 abre para o hall, não para a P.

## 4. Pisos, lajes, telhado, escada e vistas

### 4.1 Pisos (térreo)

| id | tipo (id) | nível | contorno (sentido horário) | topo | observação |
|---|---|---|---|---|---|
| F-T-01 | `ft_ceram` (cerâmico sobre contrapiso, 0,19 m) | lv_0 | (5,5; 0); (12; 0); (12; 17); (5,5; 17); (5,5; 14); (0; 14); (0; 5,5); (5,5; 5,5) | 0,00 | interior e varanda gourmet; a garagem fica de fora |
| F-T-02 | `ft_laje12` (laje de concreto 12 cm) | lv_0 | (0; 0); (5,5; 0); (5,5; 5,5); (0; 5,5) | 0,00 | garagem |

### 4.2 Laje do pavimento 2 (inclui a varanda gourmet e a garagem)

| id | tipo (id) | nível | contorno | topo | observação |
|---|---|---|---|---|---|
| L-P2-01 | `ls_mac15` (laje maciça 15 cm, com regularização) | lv_1 | (0; 0); (12; 0); (12; 17); (5,5; 17); (5,5; 14); (0; 14) | 3,00 | piso do pavimento 2, teto da garagem e cobertura da varanda gourmet |

O furo da escada não é desenhado: o app tira o furo sozinho (seção 4.4). Pé-direito livre térreo: 3,00 − 0,17 = 2,83 m.

### 4.3 Telhado

| id | forma (`shape`) | nível | contorno do beiral | inclinação | `heightOffset` (cota do beiral) | observação |
|---|---|---|---|---|---|---|
| R-01 | `hip` (4 águas) | lv_1 | (−0,72; −0,72); (12,72; −0,72); (12,72; 14,72); (−0,72; 14,72) | 30 % | 2,80 (beiral em 5,80) | balanço de 0,60 m a partir da face externa; testeira de 0,20 m (`eave.fascia`); calha e forro de beiral ativos |
| R-02 | `shed` (uma água, `dir` = (0; −1): sobe para o sul, cai para o norte) | lv_1 | (5,5; 14); (12,72; 14); (12,72; 17,72); (5,5; 17,72) | 10 % | 2,43 (beiral norte em 5,43; encontro com a parede em 5,80) | cobre a varanda gourmet |

Cumeeira do R-01: 5,80 + 0,30 × 6,72 ≈ 7,82. Platibanda: não usada. Com a caixa de 12 × 14, uma platibanda parcial tiraria o beiral de um lado sem ganho de programa.

### 4.4 Escada

| Campo | Valor |
|---|---|
| Tipo | `stt_monolitica` (ES-01, concreto monolítico, face inferior lisa), `openingMode: 'headroom'`, `openingMargin: 0,05` |
| Forma e gerador | L com patamar quadrado (`generateLShape`) |
| Nível de base / topo | lv_0 (0,00) / lv_1 (3,00); `topLevelId = null` (nível acima automático); `topOffset = 0` |
| Ponto de início (eixo do 1º espelho) | (8,40; 3,00) |
| Direção de subida do lance 1 | (0; 1), norte |
| Giro | `turn: 'left'`: o lance 2 sai do patamar para oeste |
| Largura | **1,20 m** (faixa do alto padrão; ver nota sobre o patamar) |
| Espelhos | 9 no lance 1 + 9 no lance 2 (17 no total, com o espelho do patamar contado uma vez) |
| Espelho | 3,00 / 17 = 0,176 m (faixa 0,16 a 0,18) |
| Piso | 0,285 m (faixa 0,28 a 0,32); 8 pisos por lance |
| 2e + p | 2 × 0,176 + 0,285 = 0,637 m (faixa 0,63 a 0,64) |
| Patamar | 1,20 × 1,20 m (lado mínimo de 1,20 m, `landingMinLength`) |
| Pé-direito livre | ≥ 2,10 m (`minHeadroom`) |
| Footprint | x 5,50 a 9,00 e y 3,00 a 6,50; lance 1 em x 7,80 a 9,00 (y 3,00 a 5,28); patamar em x 7,80 a 9,00 (y 5,28 a 6,48); lance 2 em y 5,28 a 6,48 (x 5,52 a 7,80) |

Por que a largura é 1,20 m: com 1,10 m o patamar teria lado menor que 1,20 m e a regra `landingMinLength` do app daria aviso. Largura de 1,20 m está dentro da faixa de alto padrão (1,10 a 1,20 m). A NBR 9077 cita 1,10 m para rotas de saída; para escada privativa, a faixa mínima é 0,80 a 0,90 m, e o projeto fica acima dela.

Posição e fluxo: a escada começa no hall, de frente para a porta de entrada (x 6,50). Quem entra vê a escada à direita, sem bloqueio. O lance 1 sobe junto à passagem P (parede em x 9,00) e deixa livre a faixa oeste do hall (x 5,50 a 7,80, y 3,00 a 5,30), por onde se vai da entrada para o lado da garagem e da cozinha. A escada não corta a sala de estar nem a sala de jantar, que ficam ao norte, separadas pela parede T-I-05 e pelo serviço. O lance 2 vai para oeste e chega ao corredor íntimo do pavimento 2 (x 4,30 a 5,50). A área sob o lance 2 e o patamar (x 5,50 a 7,80, y 5,28 a 6,48) tem pé-direito abaixo de 2,10 m: não é passagem, fica fechada pela parede T-I-04 e serve de armário.

⚠ Confirmar no app pelo painel de avisos: `stair-risers-count`, `stair-uneven` e `stair-blondel`. O ponto de início e a contagem exata podem pedir ajuste de 0,01 a 0,05 m para casar com a parede T-I-04 (y 6,50).

### 4.5 Cortes e elevações

| Nome | Linha (a → b) | Observador | Profundidade | Motivo |
|---|---|---|---|---|
| **Corte AA (pela escada)** | (8,40; −1) → (8,40; 15) | olha para o oeste (esquerda de a→b) | 16 m | corta o lance 1, o patamar, o serviço, a sala de jantar e a varanda; no pavimento 2, corta o closet e a suíte 3 |
| **Corte BB** | (−1; 11,5) → (13; 11,5) | olha para o norte | 16 m | corta estar, vão para a jantar, janelão, porta-janela da master e suítes 2 e 3 |
| Elevação Norte | gerada pelo app (`elevationSpecs`) | olha para −y | automática | fachada norte: janelões da sala, vão para a varanda, porta-janela da master |
| **Elevação Sul (frente)** | gerada pelo app | olha para +y | automática | fachada da rua: portão, porta de entrada, janela do lavabo |
| Elevação Leste | gerada pelo app | olha para −x | automática | janelão da jantar, janela da suíte master |
| Elevação Oeste | gerada pelo app | olha para +x | automática | janelas da cozinha, estar, home office e suíte 2 |

O app gera as quatro elevações com os nomes "Norte", "Sul", "Leste" e "Oeste". Para ficar "Elevação Sul (frente)", renomear a vista depois de gerada (`updateView`). Os cortes AA e BB são criados com `addView` (`kind: 'section'`). A linha do corte AA em x = 8,40 passa pelo lance 1 e pelo patamar.

## 5. Análise de fluxo

### 5.1 Percursos principais

```
  RUA ──► porta de entrada (T-O-02) ──► HALL (5,5..9 x 0..3)
                                          │
        ┌─────────────────────────────────┼──────────────────────────────┐
        ▼                                 ▼                              ▼
  GARAGEM (T-O-04)                   PASSAGEM P (T-O-07)         ESCADA L (1º lance N)
  ◄── portão (T-O-01)                     │                              │
        │                 ┌───────────────┼───────────────┐              │
        ▼                 ▼               ▼               ▼              ▼
  COZINHA (T-O-05)  SERVIÇO (T-O-09)   LAVABO (T-O-10)  DESPENSA (T-O-12)  PAVIMENTO 2
        │  (T-O-08)        ▲                                    corredor íntimo
        ▼                  │                                    (x 4,3 a 5,5)
  ESTAR (T-O-06) ◄─── COZINHA              JANTAR (T-O-11)
        │                                       │
        └────── (T-O-13) ─────────── JANTAR ◄───┘ ──(T-O-14)──► VARANDA GOURMET
```

Percursos verificados:

| Percurso | Caminho | Resultado |
|---|---|---|
| Entrada → hall → sala | rua → T-O-02 → hall → P (T-O-07) → jantar (T-O-11) → estar (T-O-13) | curto (≈ 8 m), sem cruzar cozinha nem garagem |
| Hall → escada → corredor íntimo | hall → 1º lance (passa à direita da faixa livre) → patamar → 2º lance → corredor (x 4,3 a 5,5) | sem atravessar sala; a escada fica visível da entrada |
| Corredor íntimo → quartos | corredor → home office (S-O-01), banheiro social (S-O-02), suíte 2 (S-O-03), sala íntima (S-O-04), banheiro 3 (S-O-05), suíte 3 (S-O-06) | cada quarto tem porta própria no corredor; nenhum quarto é passagem para outro |
| Suíte master | corredor → sala íntima (S-O-04) → closet (S-O-07) → quarto (S-O-08) → varanda (S-O-09) | acesso pela sala íntima, sem passar por outro quarto |
| Cozinha ↔ jantar ↔ varanda | cozinha → estar (T-O-06) → jantar (T-O-13) → varanda (T-O-14) | integração pelos vãos livres; sem porta fechada no caminho |
| Garagem → hall | garagem → T-O-04 → hall | direto, sem passar pela sala |
| Serviço | cozinha → T-O-08 → serviço → P (T-O-09) → hall | a passagem P atende o serviço sem entrar na sala de jantar |

### 5.2 Verificação de portas (giro e folga)

| Porta | Giro (flipFacing) | Folha abre para | Choca com | Veredito |
|---|---|---|---|---|
| T-O-02 entrada (1,20) | F | fora (sul), na calçada | nada | ok; pivotante, abre para fora. Se abrir para dentro (hall), a folha ocupa 1,20 m do hall: preferir fora |
| T-O-04 garagem→hall | T | hall | parede T-I-07 (distância 1,20 do eixo) | ok |
| T-O-05 garagem→cozinha | F | cozinha | parede T-I-01 | ok |
| T-O-07 hall→P | F | hall | escada (x 7,80 a 9,00, y ≥ 3,00) fica a 1,80 m da folha: sem choque | ok |
| T-O-08 cozinha→serviço | F | cozinha | parede T-I-04 | ok |
| T-O-09 P→serviço | F | serviço | parede T-I-04 | ok |
| T-O-10 P→lavabo | T | lavabo (1,80 x 2,50) | folha de 0,70 no lavabo; não invade P | ok |
| T-O-11 P→jantar (0,90) | F | jantar | parede da jantar T-I-06 | ok |
| T-O-12 P→despensa | T | despensa (1,80 x 6,50) | não invade P | ok |
| S-O-01 corredor→home office | F | home office | parede S-I-01 | ok |
| S-O-02 corredor→banheiro social (0,70) | F | banheiro social (1,50 m de profundidade) | parede S-I-10 | ok, folha ocupa 0,70 de 4,30 de largura |
| S-O-04 corredor→sala íntima (0,90) | T | sala íntima | parede S-I-02 | ok |
| S-O-05 corredor→banheiro 3 (0,70) | T | banheiro 3 | folha de 0,70 dentro de 3,5 x 2,5 | ok |
| S-O-06 corredor→suíte 3 (0,80) | T | suíte 3 | parede S-I-06 | ok |
| S-O-07 sala íntima→closet (0,90) | F | closet | parede S-I-08 | ok |
| S-O-08 closet→quarto master (0,80) | F | quarto | parede S-I-08 | ok |

Porta de banheiro não abre para a sala: os três banheiros (lavabo, banheiro social e banheiro 3) abrem para passagem ou corredor, nunca para estar ou jantar.

### 5.3 Ventilação e iluminação (janela / área do piso)

Critério adotado: área de abertura ≥ 1/6 da área do piso para dormitório, sala e cozinha (ver A-programa, seção 6: o número não foi confirmado em norma consultada; o critério é conservador). Para banheiro, lavabo e serviço, o critério é exaustão mecânica quando não há janela.

| Cômodo | Área do piso (m²) | Aberturas (m²) | Razão | Situação |
|---|---|---|---|---|
| Sala de estar | 27,5 | janelão N 5,28 + janela O 1,50 = 6,78 | 0,25 | ok |
| Sala de jantar | 32,5 | janelão L 5,28 + janela N 1,50 = 6,78 | 0,21 | ok |
| Cozinha | 19,25 | janela O 3,36 | 0,17 | ok (limite) |
| Suíte 2 | 25,8 | janelão N 3,36 + janela O 1,44 = 4,80 | 0,19 | ok |
| Suíte 3 | 17,5 | janelão N 3,36 | 0,19 | ok |
| Suíte master | 22,5 | porta-janela 5,28 + janela L 1,50 = 6,78 | 0,30 | ok |
| Home office | 28,0 | janelão O 3,36 + janela S 1,44 = 4,80 | 0,17 | ok (limite) |
| Sala íntima | 19,5 | janelão S 3,36 | 0,17 | ok (limite) |
| Lavabo | 4,5 | janela 0,36 | 0,08 | ⚠ exaustão mecânica |
| Banheiro social | 6,45 | janela 0,36 | 0,06 | ⚠ exaustão mecânica |
| Banheiro 3 | 8,75 | nenhuma (interno) | 0 | ⚠ exaustão mecânica (sem parede externa) |
| Serviço | 8,75 | nenhuma (interno) | 0 | ⚠ exaustão mecânica (sem parede externa) |
| Despensa / depósito | 11,7 | janela 0,36 | 0,03 | não é cômodo de permanência |

### 5.4 Alinhamento das prumadas

| Prumada | Pavimento térreo | Pavimento 2 | Situação |
|---|---|---|---|
| Serviço + banheiro 3 | serviço (x 5,5 a 9; y 6,5 a 9) | banheiro 3 (x 5,5 a 9; y 6,5 a 9) | **alinhadas**: a mesma faixa de x e y; uma só prumada |
| Cozinha + banheiro social | cozinha (x 0 a 5,5; y 5,5 a 9) | banheiro social (x 0 a 4,3; y 6,5 a 8) | parcialmente alinhadas: o banheiro social fica sobre a cozinha, não sobre a parede molhada |
| Lavabo | lavabo (x 10,2 a 12; y 0 a 2,5) | — | sem par no pavimento 2 |
| Banheiro da master | — | closet/banheiro (x 9 a 12; y 3 a 6,5) | ⚠ fica sobre a despensa: sem parede molhada embaixo; custa uma prumada nova |

## 6. Checklist de verificação do modelo

| # | Item | Como verificar | Situação no partido |
|---|---|---|---|
| 1 | Todos os cômodos fechados | cada cômodo tem paredes nos quatro lados, ou vão livre/porta em cada lado aberto | ok nos cômodos da seção 2; a varanda fica aberta (sem guarda-corpo, ⚠ risco 1) |
| 2 | Nenhuma parede com junção aberta | `wall-end-unjoined` no painel de avisos | ok: todas as junções são em encosto, `noJoin` = falso |
| 3 | Portas: largura livre ≥ 0,80 m (0,90 nas principais) e folga de 0,90 m em frente | croqui e seção 5.2 | ok |
| 4 | Sem choque de folhas | seção 5.2 | ok |
| 5 | Banheiro não abre para sala | seção 5.2 | ok |
| 6 | Escada com pé-direito livre ≥ 2,10 m no furo da laje | `stair-headroom` e `openingMode: 'headroom'` | ok pelo modo do app |
| 7 | Janelas em divisa: nenhuma a menos de 1,50 m da divisa | a face externa fica a 1,50 m do lote | ok: as paredes externas estão a 1,50 m; nenhuma janela em parede de divisa abaixo disso |
| 8 | Aberturas não sobrepostas na mesma parede | conferir offsets e larguras (seções 3.1 e 3.2) | ok na conferência do texto; repetir no app |
| 9 | Aberturas ≥ 0,15 m das quinas | distância da borda do vão ao canto da parede | ok nas portas principais (0,40 m no hall; 0,75 m no portão); repetir no app |
| 10 | Iluminação/ventilação por cômodo | seção 5.3 | ok para dormitórios, salas e cozinha; ⚠ exaustão nos molhados e no serviço |
| 11 | Prumadas alinhadas | seção 5.4 | ok para serviço/banheiro 3; ⚠ banheiro da master sem par |
| 12 | Degraus: espelho 0,16–0,18, piso 0,28–0,32, 2e+p 0,63–0,64 | `stair-riser-range`, `stair-tread-range`, `stair-blondel` | ok pelos números; confirmar no app |
| 13 | Patamar ≥ 1,20 m no lado menor | `stair-landing-length` | ok com largura 1,20 m |
| 14 | Paredes de cômodos alinhadas entre pavimentos | seção 2 | ok para x = 5,5 e x = 9; y = 6,5 com pequena diferença (T-I-04 e S-I-04) |
| 15 | Pé-direito do térreo ≥ 2,80 m | 3,00 − 0,17 | ok (2,83) |
| 16 | Todas as aberturas com hospedeira | `opening-host-missing` | ok |
| 17 | Sem sobreposição de pisos ou lajes | `floor-overlap`, `slab-overlap` | ok: garagem e piso térreo são polígonos separados |

## 7. Catálogo: tipos que faltam e como criar

Tipos novos para este projeto (todos de abertura, e um de parede):

| id sugerido | Nome | Kind | Largura × altura | Peitoril | Folhas | Símbolo (`plan`) | Usado em |
|---|---|---|---|---|---|---|---|
| `ot_portao450` | Portão de garagem 4,50 × 2,20 | door | 4,50 × 2,20 | 0 | 2 | `sliding` | T-O-01 |
| `ot_pv120` | Porta 120 × 210 pivotante | door | 1,20 × 2,10 | 0 | 1 | `pivot` | T-O-02 |
| `ot_vao240` | Vão livre 2,40 × 2,40 | door | 2,40 × 2,40 | 0 | 0 | `swing` (vão livre) | T-O-06, T-O-13, T-O-14 |
| `ot_j240x140` | Janela 2,40 × 1,40 | window | 2,40 × 1,40 | 1,10 | 2 | `sliding` | T-O-18, S-O-10, S-O-11, S-O-13, S-O-16 |
| `ot_j240x220` | Janelão 2,40 × 2,20 (piso a teto) | window | 2,40 × 2,20 | 0 | 2 | `sliding` | T-O-15, T-O-19 |
| `ot_pj240` | Porta-janela de correr 2,40 × 2,20 | door | 2,40 × 2,20 | 0 | 2 | `sliding` | S-O-09 |

Parede: `PA-14 hidráulica` (id sugerido `wt_alv14h`) com as mesmas camadas de `wt_alv14`, para a prumada. Hoje o catálogo não diferencia parede molhada. Esse tipo é opcional: sem ele, o projeto usa `wt_alv14`.

Como criar:

1. **No projeto (recomendado para este exemplo):** comando `upsertOpeningType` (`packages/model/src/commands.ts`), com o objeto `OpeningType` completo: `id`, `kind`, `name`, `width`, `height`, `sill`, `leaves`, `plan`, `frameMaterialId` (`mat_aluminio` nas janelas, `mat_madeira` nas portas), `glassMaterialId` (`mat_vidro`), `closure: 'inherit'`. O tipo fica em `project.openingTypes` e vai junto com o arquivo do projeto.
2. **No padrão do app (afeta todo projeto novo):** acrescentar na lista `DEFAULT_OPENING_TYPES` de `packages/model/src/defaults.ts`, usando a função `ot(...)`. Acrescentar tipos não muda o formato do arquivo, então não exige mudar `SCHEMA_VERSION`.
3. **Parede:** `upsertWallType` (projeto) ou a lista `DEFAULT_WALL_TYPES` (padrão).

## 8. Riscos e decisões em aberto

1. **Varanda sem guarda-corpo.** O app não tem guarda-corpo. A varanda gourmet e a varanda da master ficam sem proteção modelada. Uso: deixar a face da varanda sem parede e anotar a exigência no projeto executivo.
2. **Serviço e banheiro 3 sem janela.** Dependem de exaustão mecânica (sem previsão no app).
3. **Banheiro da master sobre a despensa.** Sem prumada alinhada. Opção: trocar a despensa pelo banheiro (ou deslocar o banheiro para a face do lavabo).
4. **Varanda gourmet pequena.** 6,50 × 3,00 (19,5 m²) fica abaixo da meta de 20 a 25 m². Ampliar exige sair da caixa 12 × 14 ou tirar o closet da master.
5. **Suíte master com 22,5 m²** (quarto 15 m² + closet e banheiro 7,5 m²): dentro da meta de 18 a 24 m², no limite.
6. **Dormitórios de 17,5 a 25,8 m².** Dentro da meta para suítes de alto padrão, mas a suíte 3 é apertada (3,5 m de largura).
7. **Cozinha sem ligação direta com a despensa.** A despensa fica na passagem P, do outro lado da parede. Opção: mover a despensa para a cozinha e o depósito para a passagem.
8. **Valores não confirmados:** índice de 1/6 para iluminação e ventilação (Código de Obras de São Paulo), áreas mínimas por cômodo e dimensões do Neufert. Ver A-programa, seção 6.
9. **Blondel 0,63–0,64 (app) × 0,63–0,65 (uma fonte).** Usei a faixa do app. Confirmar na norma em vigor.
10. **Pé-direito de escada de 2,10 m.** Uma fonte cita 2,00 m (NBR 9077). Usei 2,10 m, o mais conservador.
11. **Coordenadas do pavimento 2 e do térreo não foram montadas no app.** Há folgas de 0,05 a 0,10 m entre encontros (T-I-04 e S-I-04 em y 6,5). Ajustar ao montar.
12. **Divisória hidráulica.** O catálogo não tem tipo próprio; ver seção 7.
13. **Escada: a área sob o lance 2 (x 5,50 a 7,80, y 5,28 a 6,48) tem pé-direito abaixo de 2,10 m.** Fica fechada e não é passagem. Confirmar que o armário ou depósito proposto não fica em área de circulação.

**Relatório curto**

- **Decisões de projeto:** casa 12 × 14 com garagem a sudoeste, hall centro-sul com escada L de 1,20 m, passagem P de 1,20 m ao lado da escada, sala integrada ao norte com vão para a varanda gourmet, serviço ligado à cozinha e prumada de molhados alinhada entre pavimentos (serviço e banheiro 3).
- **Tipos que faltam no catálogo:** portão 4,50, porta pivotante 1,20, vão livre 2,40, janela 2,40 × 1,40, janelão 2,40 × 2,20 e porta-janela 2,40 × 2,20. Como criar: ver seção 7.
- **Riscos principais:** varanda sem guarda-corpo, exaustão mecânica nos molhados e no serviço, banheiro da master sem prumada alinhada, e valores normativos não confirmados (seção 8).
- **Estado:** partido montado em papel. A montagem no app e a conferência do checklist (seção 6) são o próximo passo.
