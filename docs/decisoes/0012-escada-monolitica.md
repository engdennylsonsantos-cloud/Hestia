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
  peça cujo plano cruza `baseZ` é DIVIDIDA pelo polígono em duas (uma de fundo plano em `baseZ`, outra com o plano). Piso base de cada lance depois de um patamar NÃO é cortado (só o lance que parte do nível de base).
- **landing (patamar):** `polygon` = contorno; `zTop = z` do patamar; fundo plano em `zTop − (h + T)` onde `T` é o da rampa anterior.
- **arrival (chegada):** só quando o último componente é um lance e o topo encontra o nível de topo: faixa atrás da última linha de espelho, comprimento `min(p_último, 0,30)`,
  largura = comprimento do último espelho, `zTop = topZ − slabThickness` (a laje cobre acima), fundo contínuo com o do último degrau (liso: mesmo plano estendido; escalonado: plano `zTop_último − h − T`). Garante que a face do último espelho é contínua até a laje.
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
