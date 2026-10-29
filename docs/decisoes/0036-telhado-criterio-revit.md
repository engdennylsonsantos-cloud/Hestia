# Decisão 0036 · Telhado por contorno aceito em qualquer formato (critério do Revit)

Decidido em 2026-10-27 com o dono: "independente do formato do telhado deve sempre permitir para o usuário, seguindo o mesmo
critério do Revit". Código: `packages/engine/src/roofSkeleton.ts` (esqueleto reto, caminho principal),
`roofEnvelope.ts` (envoltória, fallback) e `roofShapes.ts`.

1. **Critério.** Cada linha do contorno define inclinação ou não. A que não define vira **empena** vertical. O contorno só
   precisa ser fechado e simples. Recusa legítima: contorno aberto ou que se cruza, ou uma região do contorno que nenhuma
   aresta inclinada cobre ("o contorno tem uma região sem nenhuma aresta inclinada que a cubra").
2. **Telhado plano.** Nenhuma aresta com inclinação: uma água horizontal (`percent 0`) na cota do beiral, sem seta de caimento
   e sem o rótulo "0,0 %". É aviso (`roof-all-flat`), não erro. Mansarda é ignorada em telhado plano.
3. **Planos estendidos (fallback).** Para cada aresta inclinada i, `z_i(p) = eaveZ + s_i · d_i(p)`, com `d_i` a distância
   assinada à reta infinita da aresta (positiva por dentro). A superfície é o mínimo, entre os planos que valem no ponto
   (`d_i ≥ 0`), recortada pelo contorno; a região de cada água sai por recorte de polígono por semiplano e funciona em
   contorno côncavo. É a leitura que o Revit faz ao estender os planos até se encontrarem (a fonte do Revit confirma só o
   "Define inclinação" por linha e a empena; o algoritmo de canto é a nossa interpretação, **sem fonte**).
4. **Quando entra.** Só quando o esqueleto reto recusa **ou devolve degrau na superfície** (desvio decidido na implementação:
   com uma aresta interna sem inclinação o esqueleto deixa degrau e a verificação recusaria, contra a regra do dono). Os
   telhados que o esqueleto resolve sem degrau não mudam. Custo: 16 lados 95 ms, 32 lados 295 ms, 64 lados (32 inclinados) ~2 s.
5. **Projeção e planta de cobertura.** Telhado acima do corte: com "Projeção da cobertura" ligada, contorno, cumeeira, espigões
   e rincões tracejados finos (rincão pontilhado), empena e desnível, e preenchimento leve por água (opacidade 0,30, tom
   por água com o contraste do cortado aplicado duas vezes); sem seta nem rótulo. A vista **Planta de cobertura** (Navegador,
   um item por nível, aba própria `roof:<nível>`) mostra o telhado completo e opaco (`roofPlanMode`).

6. **Corte pelo plano da planta.** Telhado que o plano de corte atravessa (classe `cut`, faixa de cotas do beiral à cumeeira) é
   cortado de verdade (`packages/render/src/plan/roofsCorte.ts`): cada água fica só com a parte abaixo do plano
   (`d ≤ (cutZ − z0) / inclinação`, recorte por semiplano), cumeeira e espigões somem acima do plano e são aparados nele, e o
   contorno do que sobrou é cheio no peso de corte. A área da etiqueta continua sendo a do telhado inteiro. Telhado inteiro
   acima do plano segue como projeção (se ligada) e abaixo dele aparece inteiro. A planta de cobertura não corta.
