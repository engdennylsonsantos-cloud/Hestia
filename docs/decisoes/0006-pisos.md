# 0006 · Pisos

| # | Decisão | Motivo |
|---|---|---|
| 1 | O topo do piso fica na cota do nível mais `heightOffset`; as camadas descem a partir dele, a primeira é a de cima | Revit mede o piso pela face superior no nível; a espessura cresce para baixo |
| 2 | Contorno e furos são listas de pontos em planta, sem sentido obrigatório | O motor normaliza; evita erro de usuário ao desenhar horário ou anti-horário |
| 3 | Criar por paredes usa a face interna das paredes (borda do espaço livre) | Igual ao "Pick Walls" do Revit com a face de acabamento; permite depois cobrir até o eixo por opção |
| 4 | O tipo de piso reutiliza `Layer` do tipo de parede | Mesmo editor de camadas e mesmos quantitativos |
| 5 | Piso inclinado, vão estrutural e IFC ficam fora desta etapa | Dependem de cota por ponto (lajes e telhados) e da fase de interoperabilidade |
| 6 | Parede com a base anexada ao piso começa na face superior do piso do próprio nível; com o topo anexado, termina na face inferior do piso do nível `topLevelId` (campos `attachBottomToFloor`/`attachTopToFloor`, padrão desligados) | Evita parede atravessando o piso; E2/E3 do checklist de paredes são resolvidos aqui. Sem piso sobre o ponto médio da parede, nada muda; pisos sobrepostos: vale o mais alto para a base e o mais baixo para o topo |
