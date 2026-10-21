# Decisão 0011 · Escadas

Fontes: `docs/escadas/` (relatório externo em fonte primária: Revit 2026, ArchiCAD 29, NBR 9050:2020, NBR 9077, IT 11, IFC 4.3).
Decidido pelo dono do projeto em 2026-10-21: (1) A5 dos telhados reclassificado como fora de escopo da v1; (2) furo na laje
automático; (3) guarda-corpo fica para a etapa própria; (4) perfil de norma abaixo; (5) escada de vários andares e IFC depois.

## 1 · Decisões

| # | Decisão | Motivo |
|---|---|---|
| 1 | **O croqui é a representação única do lance.** Um lance é: limite esquerdo, limite direito, linhas de espelho e linha de caminhada (opcional). Os geradores (reto, L, U, leque) só produzem esse croqui; o modo croqui o deixa livre (retas e arcos) | Mesmo comportamento do Revit (Create Sketch) com um só motor de geometria; croqui livre desde o primeiro dia |
| 2 | Patamar é croqui também: contorno fechado de retas e arcos, plano, na cota do último espelho do lance anterior. Liga-se ao lance só por ordem (a sequência de componentes), sem vínculo paramétrico | Revit: `CreateSketchedLanding` exige laço fechado; "sem relação automática" (B7) |
| 3 | Sequência de componentes: a escada guarda `components` em ordem (lance, patamar, lance...). A cota de um patamar é a base + (nº de espelhos dos lances anteriores) × altura do espelho | Sem cota explícita no patamar; nada a dessincronizar |
| 4 | Altura do espelho real h = H ÷ N, com H = cota do topo − cota da base e N = total de linhas de espelho de todos os lances. O nº desejado é `ceil(H / espelhoMáximo)` (hipótese do relatório A5: confirmar no experimento E1 do Revit). Aviso/erro quando h > espelho máximo do tipo ou N ≠ nº desejado | Revit B4/A5 |
| 5 | Espelhos que ultrapassam um limite são APARADOS ao limite; erro quando toca/ao longo do limite, cruza outro espelho, cruza o limite mais de uma vez ou tem as duas pontas no mesmo limite em escada com dois limites (mensagens no §3) | Revit B6/B14 |
| 6 | Convenção de degraus: N espelhos dão N−1 degraus dentro do lance. O espelho k (1..N) vai da cota base+(k−1)h até base+kh; o degrau k (entre os espelhos k e k+1) tem o topo em base+kh; o último espelho encosta no piso superior (ou no patamar). Opções "começa com espelho"/"termina com espelho" ficam fixas em ligado na v1 | Revit B4 (pisos = espelhos − 1) |
| 7 | Cota de base = elevação do nível da escada + `baseOffset`; cota do topo = elevação do nível de topo + `topOffset`. O nível de topo padrão é o nível imediatamente acima (`levelAbove`); sem nível acima, vale `height` (padrão = pé-direito de parede padrão) | Revit: Base/Top Level + Offsets |
| 8 | Tipo da escada (`StairType`): espelho máx. 0,18 m, piso mín. 0,28 m, largura mín. do lance 0,80 m, estilo do lance (`monolithic` ou `assembled`), profundidade estrutural (monolítico, padrão 0,20 m), espessura do piso (assembled, 0,03 m) e do espelho (assembled, 0,02 m), nariz (0,015 m, só 3D/quantitativo), espessura do patamar (0,15 m), pé-direito livre mínimo (2,10 m), material. Sem apoios laterais nem central na v1 | Revit A10–A13 simplificado; apoios (stringer/carriage) ficam para depois (fora de escopo v1) |
| 9 | Regras do tipo (espelho máx., piso mín.) valem só para o lance CALCULADO (gerador); no croqui livre elas não bloqueiam, mas a altura real do espelho continua limitada pelo máximo do tipo | Revit A10 + B4 |
| 10 | Perfil de norma (avisos, nunca bloqueio): espelho 0,16–0,18 m, piso 0,28–0,32 m, 2e+p entre 0,63 e 0,64 m (interseção NBR 9050 × NBR 9077), degraus iguais no lance (dif. > 5 mm entre lances é aviso), patamar a cada 3,20 m de desnível e comprimento ≥ 1,20 m, largura ≥ largura mínima do tipo, folga de cabeça ≥ pé-direito livre do tipo (2,10 m), degraus do leque com piso ≥ 0,28 m a 0,55 m da borda interna. Valores em um perfil editável em `Project.settings` | Divergências normativas: não bloquear |
| 11 | Furo na laje e no piso do nível de topo é DERIVADO (não guardado): união das projeções dos degraus (e patamares) cuja cota de topo fica acima de `cotaTopo − espessuraDaLaje − folgaMínima` (a escada ainda não passou pela laje com folga de cabeça). Recalcula sozinho ao mover a escada. O modo de abertura por escada é o item 15 (substitui o "Abrir laje" booleano) | Dono: furo automático. Fora de paridade (Revit e ArchiCAD pedem Shaft/Solid Element Operations) |
| 12 | Guarda-corpo/corrimão: fora desta etapa (etapa própria "guarda-corpo") | Dono |
| 13 | Escada de vários andares, IFC e apoios (stringer/carriage): fora desta etapa | Dono |
| 14 | A conversão de lance gerado em croqui é livre (o gerador só preenche o croqui); o lance guarda `generatedBy` para saber a origem, sem vínculo paramétrico depois da edição manual. Diferença consciente em relação ao Revit (conversão irreversível) | Menos atrito; sem regra paramétrica a manter |
| 15 | Abertura da laje por escada (§6): modo **pé-direito livre** (padrão; folga `openingHeadroom`, ou o mínimo do tipo), **contorno completo** (projeção inteira, degraus e patamares) ou **sem abertura**; folga lateral `openingMargin` (0,05 m) e furo retangular `openingRect` (envolvente de menor área). Tudo derivado. Substitui o booleano `openSlab` (migração 13 → 14: ligado = pé-direito livre, desligado = sem abertura) | Dono: abertura configurável por escada, com o furo sempre derivado |

## 2 · Modelo de dados (packages/model)

```ts
/** Reta (sag = 0) ou arco por flecha, mesma convenção das paredes (arcFromSagitta). */
export interface StairCurve { a: Vec2; b: Vec2; sag: number }

export interface StairRun {
  id: Id; kind: 'run';
  boundaryLeft: StairCurve[];   // cadeia contínua, esquerda no sentido de subida
  boundaryRight: StairCurve[];  // cadeia contínua, direita
  risers: StairCurve[];         // linhas de espelho; a ordem no vetor NÃO importa (ordenadas pela caminhada ou pela direção)
  path: StairCurve[];           // caminhada opcional (cadeia), do primeiro ao último espelho; vazia = automática
  generatedBy?: 'straight' | 'lshape' | 'ushape' | 'winder';
}
export interface StairLanding { id: Id; kind: 'landing'; boundary: StairCurve[] /* laço fechado */ }

export interface Stair {
  id: Id; kind: 'stair'; levelId: Id; typeId: Id;
  topLevelId: Id | null; baseOffset: number; topOffset: number; height: number;
  components: Array<StairRun | StairLanding>;
  openingMode: 'headroom' | 'full' | 'none';  // abertura da laje (padrão 'headroom'; decisão 15)
  openingHeadroom: number | null;             // pé-direito livre do furo; null = minHeadroom do tipo
  openingMargin: number;                      // folga lateral em volta do furo (padrão 0,05 m)
  openingRect: boolean;                       // furo = retângulo envolvente de menor área (padrão false)
  mark: string; comments: string; order: number;
}
export interface StairType { id: Id; name: string; maxRiser: number; minTread: number; minRunWidth: number;
  runStyle: 'monolithic' | 'assembled'; structuralDepth: number; treadThickness: number; riserThickness: number;
  nosing: number; landingThickness: number; minHeadroom: number; materialId: Id; /* + campos de catálogo como os outros tipos */ }
```
`DEFAULT_STAIR_TYPES` (Escada monolítica concreto; Escada de piso e espelho); `makeStair`; comandos `addStair`, `updateStair`
(via `updateElements`), `upsertStairType`, `deleteStairType` (bloqueado se em uso), `setLevel...` como os demais; migração
`SCHEMA_VERSION` 11 → 12 (projetos sem escadas ganham `stairTypes` padrão); `levelAbove(project, levelId)` em `queries.ts`.

## 3 · Validação do croqui (engine: `stairSketch.ts`) — códigos e mensagens (pt-BR)

| Código | Mensagem | Origem (Revit) |
|---|---|---|
| `stair-boundaries-touch` | "Os limites esquerdo e direito do lance não podem se tocar." | B14 |
| `stair-boundary-gap` | "Cada limite deve ser uma cadeia contínua de retas e arcos." | B14 |
| `stair-riser-on-boundary` | "Parte do espelho está sobre o limite: não é permitido." | "Part of the riser lies on the boundary…" |
| `stair-riser-crossing` | "Espelhos que se cruzam não são permitidos." | "Crossing risers…" |
| `stair-riser-boundary-multi` | "O espelho cruza o mesmo limite mais de uma vez." | "Riser intersects with boundary more than once." |
| `stair-riser-not-spanning` | "Cada espelho deve ligar o limite esquerdo ao direito." | B14 |
| `stair-riser-same-location` | "Dois espelhos ocupam a mesma posição." | "…same location along the boundary line." |
| `stair-path-ends` | "A caminhada deve ir do primeiro ao último espelho." | B14 |
| `stair-path-misses-riser` | "A caminhada não cruza todos os espelhos." | "The stairs path doesn't intersect with riser lines." |
| `stair-risers-count` | "O nº de espelhos (N) difere do nº desejado (D): adicione/remova espelhos ou ajuste a altura." | "Actual Number of Risers is different…" |
| `stair-riser-too-high` | "A altura real do espelho (X m) excede a máxima do tipo (Y m)." | "Computed actual riser height…" |
| `stair-width-min` | "A largura do lance (X m) é menor que a mínima do tipo (Y m)." | "Actual run width is less than minimum…" |
| `stair-tread-min` | "O piso (X m) é menor que o mínimo do tipo (Y m)." (só lance gerado) | A22 (regra: atual ≥ mínimo) |
| `stair-landing-open` | "O contorno do patamar deve ser um laço fechado." | B7 |
Erros de geometria (`error`) impedem gerar degraus do lance; os de norma e tipo são `warning`.

## 4 · Algoritmo do degrau (engine: `stairSketch.ts`, função pura)

`stairRunSteps(run, { baseZ, riserHeight })` →
1. Amostrar arcos em polilinhas (flecha máx. 0,3 mm). Ordenar os espelhos: pela caminhada (posição da interseção ao longo dela) se
   existir; senão pela projeção do ponto médio sobre a direção do 1º ao último limite. Aparar cada espelho ao interior dos limites.
2. Degrau k (k = 1..N−1) = polígono limitado pelo espelho k, o trecho do limite direito entre os pontos de k e k+1, o espelho k+1
   (invertido) e o trecho do limite esquerdo; topo em `baseZ + k·h`. Espelho k = segmento aparado com base em `baseZ + (k−1)h` e topo
   em `baseZ + k·h`.
3. Saída: `{ treads: Array<{ polygon: Ring; z: number }>; risers: Array<{ a: Vec2; b: Vec2; z0: number; z1: number }>; footprint: MultiPolygon }`.
Invariantes (testes de propriedade): degraus disjuntos; união dos degraus = região entre o 1º e o último espelho dentro dos limites;
áreas > 0; cotas estritamente crescentes com passo `h`; N espelhos → N−1 degraus; subida total = N·h.

## 5 · Geradores
`straight(start, dir, width, risers, tread)`; `lshape`, `ushape` (patamar automático = largura do lance); `winder` (espelhos radiais). Todos
devolvem `StairRun[]`/`StairLanding[]`. Regra do piso calculado: p = clamp(0,63 − 2h; pisoMín; 0,32); comprimento do lance = (N−1)·p.

## 6 · Abertura da laje (decisão 15; engine: `stairOpenings.ts`)

Por escada, `openingMode` escolhe a região que a laje (e o piso) do nível de topo perde. Tudo é derivado a cada resolução; nada é gravado no elemento da laje.

1. **`headroom` (pé-direito livre, padrão).** Usa `H = openingHeadroom ?? type.minHeadroom`. Degrau (ou patamar) de cota de topo `z` sai da laje quando `z + H ≥ cotaFaceInferior`, com `cotaFaceInferior = cotaTopo − espessuraDaLaje`, ou seja, quando a folga do degrau (`face inferior − z`) é ≤ H. A cota de referência é a do topo do degrau: o piso é plano, então o nariz (a quina da frente) e o resto do degrau estão na mesma cota. A espessura é a da laje ou piso que cobre a planta da escada (a maior; 0,15 m se nenhuma). Com H = 2,10 m (padrão) o resultado é o da decisão 11, sem mudança.
2. **`full` (contorno completo).** A região é o `footprint` da escada resolvida: união de todos os degraus e patamares, sem olhar a cota.
3. **`none`.** Sem furo.
4. **Folga lateral.** Com `openingMargin > 0`, a região cresce por offset positivo (`offsetMulti`, cantos em esquadria). Para uma região retangular de L × W, a área cresce `2(L + W)·m + 4m²`.
5. **Furo retangular.** Com `openingRect`, a região (já com a folga) vira o retângulo de menor área que a envolve: fecho convexo e um lado do retângulo alinhado a cada aresta do fecho (`minAreaRect`, `@hestia/geom`). Com a região retangular, ele coincide com ela; com L, a área fica entre a região e a caixa dos eixos.

Efeitos colaterais:
- O aviso `stair-headroom` (`stairChecks.ts`) não muda: com o furo, sobra só o que tem folga maior que H; com H abaixo do mínimo do tipo, os degraus entre os dois valores ficam sob a laje e avisam.
- Limitação: a face inferior é plana (`topo − espessura`), como antes. Laje inclinada usa a cota plana no furo, mas o aviso de folga usa a cota real; podem divergir.
- A barra de opções da ferramenta não expõe a abertura: a escada criada recebe o padrão e o ajuste é feito em Propriedades.
- `render/src/model3d/stairSolids.ts` tem uma cópia de `thicknessUnder` (espessura do furo) que precisa ficar sincronizada com `stairOpenings.ts` (fora do escopo desta etapa; registrado).
