# 0007 · Lajes

| # | Decisão | Motivo |
|---|---|---|
| 1 | Laje é um elemento próprio (`slab`) com tipos próprios (`slabTypes`), sem misturar com piso | Revit trata laje estrutural como Floor com a opção estrutural; aqui a separação deixa quantitativos, validação e interface mais claros |
| 2 | Contorno automático pelo perímetro externo das paredes (face externa) | Laje cobre a edificação inteira, ao contrário do piso, que é por cômodo |
| 3 | Inclinação por linha de origem, direção e percentual: cota = topo + percentual × distância ao longo da direção | Caimento de cobertura e de varanda; cobre o uso real sem cota por vértice |
| 4 | Topo da laje na cota do nível mais deslocamento (padrão 0); camadas descem a partir dele | Igual ao piso (decisão 0006) |
| 5 | A laje não é recortada pelas paredes e a planta a desenha atrás delas | Igual ao piso |
| 6 | A espessura das camadas é vertical e constante; volume = área em planta × espessura; a área real da face superior = área em planta / cos(atan(inclinação)) | Quantitativo coerente com o 3D; o caimento só altera a área de face (impermeabilização, revestimento) |
| 7 | Aviso `slab-floor-overlap` só quando laje e piso se cruzam também em cota (mais de 1 mm) | O piso de acabamento sobre a laje é o uso correto e não deve gerar aviso |

Nota (0023 P8): o término por camada da junção (`Término na junção`, campo `termino` em `Layer`) está em `docs/decisoes/0023-juncao-piso-laje-parede.md` §2 e §10. Vale para piso e laje vinculados às paredes; o padrão `auto` mantém o corte da tabela de §2.
