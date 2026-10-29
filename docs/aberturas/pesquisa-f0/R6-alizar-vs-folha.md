# R6 - Alizar x folha aberta (porta de giro)

## Resumo para decisão

- Não encontrei, em fonte oficial, regra numérica para afastar o alizar da folha aberta. A pesquisa não confirmou nenhum valor em mm para isso.
- Regra geométrica recomendada para o Hestia (PROVÁVEL): na face de abertura, o alizar do lado da dobradiça não deve ocupar a faixa varrida pela folha a 90°. Na prática, a faixa começa no batente e vai até a espessura da folha mais a folga da dobradiça.
- Valor de partida (NÃO CONFIRMADO): recuo do alizar de ~25 mm a partir da face interna do batente, com espessura da folha de 35 mm. Validar com teste de colisão 3D em 90°.
- Parâmetro sugerido: "recuo do alizar do lado da dobradiça" (editável por porta). Padrão = 0 se a face não abre para aquele lado.
- Alternativa de projeto: deixar de modelar o alizar na face de abertura do lado da dobradiça e marcar o alizar como "interrompido" na planta.
- Revit e ArchiCAD: parâmetros de alizar existem, mas não confirmei se o modelo acusa colisão com a folha aberta. Não assumir que o software resolve isso sozinho.
- Obra: a fonte brasileira encontrada não traz recuo da dobradiça em mm. Folga folha-batente de 4 a 8 mm (fonte de manual de porta padrão, só pelo trecho de busca; PDF não lido).

## Detalhes

**1. Revit (CONFIRMADO no que foi lido; ausência de recurso CONFIRMADA na busca)**
- Revit tem Flip Hand (lado da dobradiça) e Flip Facing (sentido de abertura), disponíveis só em famílias com controles horizontais/verticais. Fonte: https://help.autodesk.com/cloudhelp/2026/ENU/Revit-ArchDesign/files/GUID-ED3765CA-7876-4716-8AB3-7482810BC775.htm
- Tipo de porta tem Exterior Trim Projection, Interior Trim Projection e largura do trim (parâmetros de tipo). Fonte: https://help.autodesk.com/cloudhelp/2014/ENU/Revit-LT/files/GUID-29905EE0-3D7D-422E-A627-5A7A8AC34D7B.htm
- Não encontrei parâmetro para afastar o trim da folha aberta, nem menção a colisão do trim com a folha em 90°. Marcar como NÃO CONFIRMADO: se o Revit detecta isso, depende de Verificar Interferências entre elementos do modelo (não testado).
- Página de Trim da família não foi lida; o tratamento de trim pode estar em família de guarnição separada.

**2. ArchiCAD (CONFIRMADO para a exclusão mútua; NÃO CONFIRMADO para o comportamento 3D)**
- Casing Outside/Inside é ativado em Fixtures and Fittings (checkboxes Outside e Inside). Configurações em "Casing Outside/Inside Settings". Fonte: https://helpcenter.graphisoft.com/user-guide/129166/ (página retornou redirecionamento e não pude ler os parâmetros de largura, espessura e offset).
- Casing e Turn Plaster não podem ser usados ao mesmo tempo no mesmo lado. Turn Plaster fica em Wall Closure; a pele de reboco volta para dentro do vão. Fontes: https://helpcenter.graphisoft.com/user-guide/89562/ e https://helpcenter.graphisoft.com/user-guide/66047/
- Não encontrei tratamento específico para o lado da dobradiça nem comportamento da folha aberta em relação ao casing.

**3. Prática de obra (PROVÁVEL / NÃO CONFIRMADO)**
- Salice Série 200 (autofechante): documento de fabricante indica afastamento de ~5,5 mm entre folha aberta e lateral, nas condições de teste dobradiça collo 0, calço H=0, furação K=3. Não é regra geral. Fonte: https://www.salice.com/downloads/2391/3391/Salice-Self-Closing-Hinges-Series-200-165-standard-POR.pdf (trecho de busca, não lido por completo). Status: PROVÁVEL apenas para este tipo de dobradiça.
- Folga folha-batente: 4 a 8 mm laterais e superior (manual de porta padrão, trecho de busca). Fonte: https://api.aecweb.com.br/cls/catalogos/8250/34939/AALC15%20-%20MANUAL%20DE%20INSTRU%C3%87%C3%95ES-ESPECIFICA%C3%87%C3%83O-FOLHA%20DA%20PORTA%20PADR%C3%83O%20-%20Rev%2003.pdf (PDF não pôde ser extraído; status NÃO CONFIRMADO).
- Corta-fogo Mocelin: folga superior e inferior de 10 mm. Fonte: https://mocelin.ind.br/upload/produtos-ficha-tecnica/6092.pdf (trecho, NÃO CONFIRMADO para porta comum).
- Dobradiças: fixação em batente sem furação prévia a 25 cm das extremidades (busca, NÃO CONFIRMADO). Caneco de 90° com profundidade de 11,3 a 11,5 mm (Häfele e outro fabricante, trechos; PROVÁVEL).
- Recuo do alizar do lado da dobradiça para abrir 90°: não encontrei fonte brasileira com valor. Não confirmado se é prática usual de obra ou se o alizar é simplesmente ajustado no local.
- Abertura de 90° sem bater: depende da folga entre folha e alizar e do batente. Sem valor de fonte confirmado.

**4. Convenção de planta (NÃO CONFIRMADO)**
- Não pesquisei convenção específica de planta para este caso. Sugestão de projeto: mostrar a varredura da folha em 90° (arco tracejado) e, no alizar, a linha de interrupção. Confirmar com a norma de desenho adotada pelo escritório.

## Não confirmado

- Parâmetro do Revit ou do ArchiCAD para afastar alizar da folha aberta: não encontrado.
- Se o Revit ou o ArchiCAD detectam colisão entre alizar e folha aberta no 3D: não testado.
- Valor do recuo do alizar (25 mm como ponto de partida): derivado de raciocínio geométrico, sem fonte.
- Folga folha-batente de 4 a 8 mm: só trecho de busca; PDF não extraído.
- Valor de 5,5 mm da Salice: específico de um modelo e condição de instalação.
- Página de parâmetros do Casing no ArchiCAD: redirecionamento, não lida.
- mendesmadeiras.com.br: bloqueado pela rede da sessão (DNS não resolvido). Não foi possível ler a fonte.
