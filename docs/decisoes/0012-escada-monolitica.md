# Decisão 0012 · Escada monolítica: espelho de chegada, patamar contínuo e fundo liso ou escalonado

Origem: revisão do dono do projeto (2026-10-21) com imagens do Revit: a escada termina antes da laje, há folga entre o último
degrau e o patamar, e o fundo da escada monolítica era uma fileira de blocos. No Revit (Underside Surface: Smooth ou Stepped), o
último espelho alcança o nível do topo e o fundo é uma rampa (liso) ou um dente de serra de espessura constante (escalonado).

## 1 · Decisões

| # | Decisão |
|---|---|
| 1 | Novo campo do tipo: `StairType.undersideStyle: 'smooth' \| 'stepped'` (padrão `smooth`). Só vale para `runStyle: 'monolithic'`. Migração `SCHEMA_VERSION` 12 → 13 acrescenta `undersideStyle: 'smooth'` aos tipos existentes |
| 2 | `structuralDepth` passa a ser a espessura PERPENDICULAR à rampa, medida a partir dos cantos internos dos degraus (como no Revit). Espessura vertical equivalente `T = structuralDepth / cosθ`, com `cosθ = p / √(p² + h²)`, `p` = distância em planta entre as linhas de espelho consecutivas (entre os pontos médios) e `h` = altura do espelho |
| 3 | Monolítico fecha o espelho de chegada: o patamar e o piso de cima encontram a escada sem fresta (decisão #6) |
| 4 | Patamar monolítico: espessura vertical = `h + T` (fundo contínuo com o das rampas). `landingThickness` do tipo vale só para o estilo piso e espelho |
| 5 | O estilo piso e espelho não muda (já fecha todos os espelhos com placas) |

## 2 · Geometria (engine, função pura `stairBody`)

Convenção de `ResolvedStair`: o degrau `k` (1..N−1) fica entre as linhas de espelho `k` e `k+1`, topo em `zk = baseZ + k·h`. A linha `j`
tem o canto interno (pé do espelho `j`) na cota `z = baseZ + (j−1)·h`. `T` como na decisão #2. `m_k` = ponto médio da linha de espelho `k`
(do espelho aparado); `d = m_{k+1} − m_k`.

Peças (`StairBodyPiece { kind: 'tread'|'landing'|'arrival'; componentIndex; index; polygon: Ring; zTop: number; bottom: {a:number;b:number;c:number} }`,
fundo `zFundo(x, y) = a·x + b·y + c`):
- **tread k, liso:** `polygon` = o degrau; `zTop = zk`; plano pelo fundo que vale `z0 = baseZ + (k−1)·h − T` em `m_k` e cresce `h` ao longo de `d`:
  `a = h·dx/|d|²`, `b = h·dy/|d|²`, `c = z0 − a·m_k.x − b·m_k.y`. Espessura média do degrau `h/2 + T`.
- **tread k, escalonado:** fundo PLANO em `z = zk − h − T` (`a = b = 0`). Dois degraus vizinhos se sobrepõem em `T` na vertical.
- **corte pelo piso base:** nenhuma peça desce abaixo de `baseZ` (a escada apoia no piso): peça com o plano inteiro abaixo de `baseZ` ganha fundo plano `baseZ`;
  peça cujo plano cruza `baseZ` é DIVIDIDA pelo polígono em duas (uma de fundo plano em `baseZ`, outra com o plano). O corte vale para TODAS as peças de qualquer lance (degraus, patamares e chegada), não só para o lance que parte do nível de base (`fit`, em `stairBody.ts`).
- **landing (patamar):** `polygon` = contorno; `zTop = z` do patamar; fundo plano em `zTop − (h + T)` onde `T` é o da rampa anterior (sem rampa anterior, o da seguinte). Também é cortado pelo piso base.
- **arrival (chegada):** só quando o último degrau é de um lance monolítico que sobe até o espelho de topo (nº N) e os espelhos N−1 e N existem (`stairArrivalFrame`): faixa atrás da última linha de espelho, comprimento `min(p_último, 0,30)`,
  largura = comprimento do último espelho, fundo contínuo com o do último degrau (liso: mesmo plano estendido; escalonado: plano `zTop_último − h − T`). `zTop` = a menor face inferior (`stairArrivalTopZ`, `stairArrival.ts`) das lajes e pisos do nível de topo que cobrem a faixa de 2 cm à frente do último espelho. Face inferior = nível + `heightOffset` − espessura total do tipo (a mesma do furo); laje inclinada usa `coverUnderside`. Sem cobertura, `zTop = topZ − 0,15 m` (`STAIR_ARRIVAL_SLAB_DEFAULT`). A chegada é cortada em `z ≤ zTop`: com profundidade estrutural baixa, o canto distante teria espessura negativa (antes da correção). Garante que a face do último espelho é contínua até a laje.
- **placas de espelho (estilo piso e espelho):** como hoje (`ResolvedStairRiser` com `riserThickness`).

Volume monolítico = Σ `área × (zTop − zFundo(centroide))` (exato porque o fundo é um plano). Exemplo de referência (lance reto, largura w, passo p, N espelhos):
degrau liso = `w·p·(h/2 + T)`; degrau escalonado = `w·p·(h + T)`; patamar = `área·(h + T)`.

## 3 · Quem usa
- engine: `stairQuantities` (volumes), `sectionStairs` (corte: para cada peça, o trapézio `[t0,t1] × [zFundo, zTop]` ao longo da linha de corte), `stairBody`;
- render 3D: `extrudePolygon(polygon, zFundo..zTop)` com `bottomAt` linear;
- interface: o editor de tipo ganha "Face inferior: Lisa | Escalonada" e a descrição de "Profundidade estrutural" passa a "perpendicular à rampa".

## 4 · Critérios de aceitação (testes)
- Reta, w = 1,20, p = 0,28, h = 0,175, N = 16, `structuralDepth` 0,15: `T = 0,15/cosθ` (cosθ = 0,28/√(0,28²+0,175²)); volume liso e escalonado conforme as fórmulas; sem peça com `zFundo` < `baseZ`.
- Estanqueidade: o corte longitudinal pelo eixo da escada (liso e escalonado) é UM polígono conexo sem furos; não há fresta vertical entre peças vizinhas; entre o último degrau e o patamar o corte é contínuo; entre o último degrau e a laje de cima também (com laje de 0,15).
- L e U: patamar à cota certa e contínuo com as duas rampas; fan e curva: peças com fundo plano (aproximação) sem sobreposição de área em planta.

## 5 · Estado final (código em 2026-10-21)

Onde está: `packages/engine/src/stairBody.ts` (peças), `stairBodyGeom.ts` (corte por plano), `stairArrival.ts` (topo da chegada),
`packages/render/src/model3d/stairSolids.ts` (malha 3D), `stairQuantities.ts` (volumes) e `sectionStairs.ts` (corte).

**Estilos da face inferior.** `undersideStyle`: `smooth` (padrão) e `stepped`, só no monolítico. O editor de tipo tem "Face inferior: Lisa |
Escalonada" (`StairTypeDialog.tsx`) e a prévia da seção mostra o estilo (`StairSectionPreview.tsx`).

**Espessura T.** `T = structuralDepth ÷ cosθ`, com `cosθ = p ÷ √(p² + h²)`, calculado para cada degrau (`treadOf`) a partir dos pontos
médios dos espelhos de trás e da frente. Exemplo: profundidade 0,20 m, p = 0,28 m, h = 0,175 m, T = 0,236 m.

**Patamar.** Cota = base + (nº do último espelho do lance anterior) × h. Fundo plano em `h + T` abaixo do topo, com o T da rampa anterior
(ou da seguinte, se não houver).

**Chegada.**
- Frente: o último espelho do lance; comprimento `min(p, 0,30 m)`; largura = comprimento do espelho.
- Topo (`zTop`): `stairArrivalTopZ` (`stairArrival.ts`) = a menor face inferior das lajes e pisos do nível de topo que cobrem a faixa de
  2 cm à frente do último espelho. Face inferior = nível + `heightOffset` − espessura total do tipo (a do furo, §6 da decisão 0011);
  laje inclinada usa `coverUnderside`. Sem cobertura, `topZ − 0,15 m` (`STAIR_ARRIVAL_SLAB_DEFAULT`). A chegada é cortada em `z ≤ zTop`.
- Consumidores: a malha 3D (`scene3d.ts` → `buildStairSolids` com `stairArrivalTopZ`) e o corte (`sectionStairs.ts`, com
  `stairArrivalTopZ`) usam o mesmo topo. O quantitativo não tem a chegada no volume: ela fica sob a laje de cima (`stairQuantities.ts`).

**Arestas do 3D (`stairSolids.ts`).** O corpo é uma peça de `stairBody` por degrau, patamar ou chegada, com topo plano e fundo por ponto
(o plano, limitado a `topo − 0,1 mm`, para a espessura nunca zerar). Duas funções deixam a malha limpa:
- `extrudeBodies`: a parede lateral de cada aresta sai só onde a face está exposta. Uma aresta que dois corpos dividem com sentidos
  opostos (espelho entre degraus, corte pelo piso base) não tem parede nessa parte: as duas paredes coincidentes são internas e se
  cancelam no volume. Se a ordem das cotas muda entre os extremos da aresta, nada é cortado.
- `splitTJunctions`: insere nos triângulos os vértices de outras faces que caem sobre uma aresta (T-junction), sem mudar a superfície.
  Assim cada aresta desenhada casa com a da face vizinha e o desenho de arestas não marca emendas.
- O que continua desenhado: a quina entre o fundo e o piso base (mudança real de plano para o piso) e as quinas do topo com o espelho
  e com o piso (teste "corte pelo piso base" e "topo do degrau 2" em `stairSolids.test.ts`).

**Volumes de referência.**
- Reta com o tipo padrão (profundidade 0,20 m, liso), w = 1,20, p = 0,28, h = 0,175, 16 espelhos: 15 degraus, volume de 1,5763 m³ com o
  corte pelo piso base (1,6297 m³ sem o corte). Teste: `stairQuantities.test.ts`. A referência do §4 usa 0,15 m, e o `stairBody.test.ts`
  confere as integrais com esse valor.
- Patamar de 1,44 m² em L com lances de 8 espelhos (0,20 m): 1,44 × (h + T) = 0,592 m³ (`stairBody.test.ts`, "L: patamar à cota 8h").
- Piso e espelho, mesma reta: 0,2184 m³ (0,1512 de pisos + 0,0672 de espelhos).
- O quantitativo da monolítica soma só degraus e patamares: a chegada fica sob a laje de cima e não entra no volume
  (`stairQuantities.ts`), mas entra na malha 3D e no corte.

**Limitações.**
- Leque e arco: cada degrau tem um plano de fundo ajustado pelos pontos médios dos espelhos de trás e da frente. A face inferior real de um
  leque ou de uma curva não é plana, então é aproximação. Os testes do leque (90°, 180° e 270°, `stairBody.test.ts`) conferem disjunção,
  áreas e cota não abaixo de `baseZ`, não a exatidão do fundo.
- Escalonado no leque e na curva: fundo plano por degrau, igual ao caso reto.
- Chegada: o topo depende da laje ou do piso que cobre a faixa à frente do último espelho; sem cobertura, usa a regra `topZ − 0,15 m`.
