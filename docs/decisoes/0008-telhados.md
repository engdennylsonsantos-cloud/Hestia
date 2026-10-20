# 0008 · Telhados

| # | Decisão | Motivo |
|---|---|---|
| 1 | O telhado guarda a FORMA (uma, duas, quatro águas ou livre) e a inclinação; as águas são calculadas no motor | O usuário edita poucos parâmetros e o resultado fica consistente; águas livres cobrem os casos fora das formas |
| 2 | `boundary` é o contorno do beiral (já com o balanço); a cota do beiral é nível + deslocamento | O beiral é a referência de altura em obra; o balanço vem da ferramenta (perímetro externo + offset) |
| 3 | Quatro águas: altura = inclinação × distância à aresta mais próxima (contorno convexo) | É exatamente o telhado de águas iguais; cumeeira e espigões saem do encontro dos planos |
| 4 | Duas águas: cumeeira paralela a `dir` no meio do contorno; uma água: sobe na direção `dir` | Predefinições mais comuns |
| 5 | Camadas com espessura vertical constante, como as lajes | Quantitativo coerente (volume = área em planta × espessura × 1; área real = planta / cos) |
| 6 | O topo da parede se ajusta ao telhado reaproveitando o perfil superior já existente (recorte por faixas) | Menos código, empenas corretas, mesmas quantidades |
| 7 | Telhado por extrusão de perfil, mansardas e contorno não convexo com quatro águas automáticas ficam para o v2 | Esqueleto reto de polígonos côncavos é um projeto à parte |
| 8 | Inclinação por aresta (forma `edges`): cada aresta do contorno define inclinação (percentual) ou não (empena vertical); as águas vêm do esqueleto reto com pesos | É o que o Revit faz ("Define Slope"); cobre contornos côncavos, furos, 3, 10 ou mais águas. Aresta sem inclinação = peso 0 |
| 9 | `shed`, `gable` e `hip` viram predefinições que preenchem `edgeSlopes`; `free` e `extrusion` ficam à parte | Um só caminho de cálculo para as formas comuns |
| 10 | Telhados do mesmo nível se unem (`joinOthers`): na sobreposição vale a maior cota, com a divisa (rincão) no encontro dos planos | Equivale ao Join Roof do Revit para alas que encontram o corpo principal |
| 11 | Telhado por extrusão: perfil `{t, z}` extrudado ao longo de `dir` e recortado pelo contorno | Cobre arco, mansarda, dente de serra; arcos viram trechos retos |
| 12 | Acabamentos do beiral (testeira, calha, forro) e corte de caibro (prumo/esquadro) são propriedades do telhado | Revit: Fascia, Gutter, Soffit e Rafter Cut |
| 13 | A ferramenta nunca "some": contorno que o motor não resolve mostra o motivo na hora e não cria o telhado | Falha silenciosa foi o erro do telhado em L |
| 14 | Anexar topo é um comando de duas etapas (paredes, depois telhado) que grava `attachTopToRoof` e o telhado escolhido em `attachTopRoofId` (opcional; ausente = qualquer telhado que cubra o eixo, como antes). No 3D o clique vira o (x, y) da superfície sob o cursor e a ferramenta acha o telhado pela planta, sem id por malha | Revit: Attach Top/Base. As malhas são agrupadas por material, então não há id por malha; a planta já tem o telhado sob o ponto |
