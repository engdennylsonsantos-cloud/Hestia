# 0007 · Lajes

| # | Decisão | Motivo |
|---|---|---|
| 1 | Laje é um elemento próprio (`slab`) com tipos próprios (`slabTypes`), sem misturar com piso | Revit trata laje estrutural como Floor com a opção estrutural; aqui a separação deixa quantitativos, validação e interface mais claros |
| 2 | Contorno automático pelo perímetro externo das paredes (face externa) | Laje cobre a edificação inteira, ao contrário do piso, que é por cômodo |
| 3 | Inclinação por linha de origem, direção e percentual: cota = topo + percentual × distância ao longo da direção | Caimento de cobertura e de varanda; cobre o uso real sem cota por vértice |
| 4 | Topo da laje na cota do nível mais deslocamento (padrão 0); camadas descem a partir dele | Igual ao piso (decisão 0006) |
| 5 | A laje não é recortada pelas paredes e a planta a desenha atrás delas | Igual ao piso |
| 6 | Volume e área consideram a inclinação (altura média no centroide da fatia) | Quantitativo coerente com o 3D |
