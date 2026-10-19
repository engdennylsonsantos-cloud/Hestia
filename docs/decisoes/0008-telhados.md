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
