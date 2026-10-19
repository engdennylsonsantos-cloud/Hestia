# 0005 · Retorno de acabamento, faixas, perfil superior, cortes e membranas

Origem: fechamento do checklist de paredes (docs/paridade/paredes.md). Decisões tomadas sem consulta, com o motivo.

| # | Decisão | Motivo / efeito |
|---|---|---|
| 1 | O acabamento "envolve" por tipo de parede (`wrapInserts`, `wrapEnds`: nenhum, interno, externo, ambos) e por camada (`wraps`); o tipo de abertura pode forçar o fechamento (`closure`) | Revit decide o retorno pelo tipo de parede e pela família; ArchiCAD pelo "núcleo/acabamento" do composto. Padrão: retorno nos vãos nos dois lados, extremidades livres sem retorno |
| 2 | Retorno do vão é uma camada à parte (peças `returns`) que entra no pintor | O reboco que volta no vão disputa prioridade com os vizinhos como qualquer camada; os vãos nos cortes mostram o vão livre menor que a porta (reboco dos dois lados) |
| 3 | Faixas verticais (`strips`: rodapé, barra de azulejo, friso) são varreduras na face, não camadas | Revit usa "Wall Sweeps/Reveals"; evita partir a camada em regiões. Têm altura própria, entram na planta só se cruzam o corte de 1,20 m, no 3D, no corte e nos quantitativos |
| 4 | Geometria vertical por faixas de altura (`LayerBand`) | Um vão só fura as faixas que atravessa; uma parede só corta a vizinha onde as duas existem na mesma altura (3D e quantitativos corretos) |
| 5 | Perfil superior poligonal (`topProfile`), só em parede reta | Cobre empena, topo inclinado e degraus (o uso real do "Editar perfil"). O polígono em planta é fatiado por retas perpendiculares ao eixo; cada fatia fica inteira, some ou ganha topo plano ou inclinado (`slope`). Furos internos e laterais livres ficaram fora (A10) |
| 6 | Esquadria entre tipos diferentes acompanha a cadeia de vértices (limites de camada dos dois lados e saturações) | Antes, camadas vizinhas usavam cortes retos diferentes e deixavam dentes no contorno; agora os dois lados dividem arestas exatas (caso dourado K2) |
| 7 | Corte e elevação são o mesmo cálculo sobre as faixas: interseção da linha com os polígonos (par-ímpar) para o que é cortado; projeção por profundidade (pintor) para o que está além | Elevação = linha fora da construção. Nome da elevação segue a fachada mostrada (Norte mostra a fachada norte). Atalho do corte: K (C já é Copiar) |
| 8 | Membrana de espessura zero vira linha na planta e área de face nos quantitativos, sem área nem volume | Revit trata membrana como linha de detalhe; evita polígonos degenerados no pintor |
| 9 | Tolerância de junção configurável por projeto (2 cm padrão) | Medida em distância real, não em pixels |
| 10 | Esquema do arquivo na versão 6 com migrações encadeadas desde a 1 | Arquivos antigos continuam abrindo; versão futura é recusada com mensagem clara |
