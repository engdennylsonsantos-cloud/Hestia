# R2 - Perfis de esquadrias e encaixe do vidro (pesquisa para o Hestia)

Orçamento usado: 10 buscas (WebSearch standard) e 2 leituras de PDF (WebFetch). Ambas as leituras de PDF falharam (PDF binário, sem texto). Nenhuma fonte primária de catálogo de fabricante ou norma ABNT foi acessada; as normas só aparecem citadas em documentos de terceiros.

## Resumo para decisão

- Proposta: modelo de perfil **paramétrico**, com um registro de perfil por esquadria. Campos mínimos: `material`, `linha/série`, `largura_visivel` (mm), `profundidade` (mm), `rebaixo_vidro` (profundidade e folga, mm), `espessura_parede` (opcional), `tipo_secao` (L, T, retangular com rebaixo, com câmaras), `ferragem` (referência), `acabamento`.
- Seções por função (batente, contramarco, folha, travessa/montante, baguete, soleira, pingadeira) devem ser papéis de perfil, não tipos de objeto.
- Vidro não deve ser perfil. Ele deve ser um material de preenchimento com `espessura` e `composição` (temperado, laminado, insulado), encaixado no `rebaixo_vidro` do perfil da folha. O vidro temperado sem perfil (box) precisa de um modo separado, com ferragens de canto e folga, sem rebaixo.
- Dados confirmados nas fontes: profundidade de PVC de 60 e 70 mm; contramarco de alumínio de 60 mm; batente de alumínio de 6 a 7 cm para linha 25; marco de madeira 7x3 cm e batente 3x14 cm (SINAPI); caixilho de madeira de 3,5 x 7 cm; vidro insulado com câmaras de 6 a 35 mm; laminado de 3+3 a 12+12 mm.
- Não confirmado: larguras e profundidades exatas por linha (25, 20, Suprema, Euro, Aluplast), rebaixo e folga de vidro, perfis de soleira, trilho e pingadeira.
- Biblioteca nomeada: **compensa só em pequena escala**. Recomendo um conjunto inicial de 12 a 20 perfis nomeados (presets) sobre o modelo paramétrico, com os valores ajustáveis. Não recomendo uma biblioteca fechada de catálogo, pois os valores reais variam por fabricante e não consegui obter as tabelas.
- Estimativa de cobertura de 90% com ~15 perfis: PROVÁVEL, mas NÃO CONFIRMADO. Precisa de levantamento de catálogos (ver lacunas).
- Acabamentos (lisa, almofadada, veneziana, lambril) afetam a geometria da folha (painéis, travessas, grades). Modelar como parâmetros de folha, não como perfis separados.

## Detalhes

### 1. Perfis típicos por material

| Material / série | Elemento | Dimensão típica (mm) | Status | Fonte |
|---|---|---|---|---|
| Alumínio linha 25 (correr) | Batente/marco (largura total) | 60 a 70 (6 a 7 cm, para janela 100x150 de 2 folhas) | CONFIRMADO (snippet SINAPI) | https://orcamentor.com/insumos/janelas-em-aluminio/ |
| Alumínio linha 25 / Suprema | Contramarco | 60 | CONFIRMADO (DER-ES, esp. esquadrias de correr) | https://der.es.gov.br/media/Documentos/Tabela%20Referencial%20de%20Pre%C3%A7o/Referencial%20de%20Edifica%C3%A7%C3%B5es/CADERNO_ESPECIFICACOES/0717-esquadrias-metalicas-esquadrias-metalicas-m2-v2.pdf |
| Alumínio linha 25 / Suprema | Liga e tratamento | 6063-T5, anodizado mín. 18 µm | CONFIRMADO (DER-ES 0717) | mesma URL |
| Alumínio linha 20 (Bergamo) | Largura de moldura | 80 (8 cm) | CONFIRMADO (listagem de varejo, Bergamo) | https://www.madeiramadeira.com.br/janela-veneziana-de-aluminio-3-folhas-100-x-150cm-linha-25-com-grade-esquadrias-bergamo-preto-874664.html?seller=1 |
| Alumínio linha 25 (Bergamo) | Largura de moldura | 110 (11 cm) | CONFIRMADO (listagem de varejo) | mesma URL |
| Alumínio porta basculante | Batente (tubular) | 45 | CONFIRMADO (listagem; variação por produto) | https://orcamentor.com/insumos/janelas-em-aluminio/ |
| Alumínio (linha 25) | Perfil de acabamento (guarnição) | Não confirmado | NÃO CONFIRMADO | - |
| PVC "Euro-Design 60" (REHAU) | Profundidade construtiva | 60 | CONFIRMADO | https://www.aecweb.com.br/produto/perfil-para-janelas-euro-design-60/37597 |
| PVC 60 (BauPlaza) | Altura do perfil do aro | 60 | CONFIRMADO (listagem Leroy Merlin PT) | https://www.leroymerlin.pt/produtos/bauplaza-janela-pvc-largura-x-altura-600-x-700-mm-60-x-70-cm-esquerda-branca-vidro-transparente-vidro-duplo-oscilobatente-93384855.html |
| PVC 70 (Aluplast Ideal 4000) | Espessura do caixilho | 70 | CONFIRMADO (listagem Leroy Merlin PT) | https://www.leroymerlin.pt/produtos/janela-pvc-reforcado-60-60-cm-branca-oscilobatente-direita-vidro-fosco-perfil-aluplast-96674778.html |
| PVC (Winwindo basculante) | Espessura do perfil | 72 | CONFIRMADO (fabricante no varejo) | busca de PVC, sem URL direta confiável |
| Madeira marco (porta interna) | Marco retangular | 70 x 30 (7x3 cm) | CONFIRMADO (cláusula de licitação, snippet) | https://lawinsider.com/pt/clause/portas-internas |
| Madeira batente maciço regulável (TJCE) | Batente | 70 x 33 (7x3,3 cm) | CONFIRMADO (snippet) | https://portal.tjce.jus.br/uploads/scon/2016/01-2016/cp_01_2016_p5-2.pdf |
| Madeira batente maciço (SINAPI) | Batente com rebaixo | 30 x 140 (3x14 cm) | CONFIRMADO | https://orcamentor.com/composicao/90801/ |
| Madeira caixilho (acabamento simples) | Espessura x largura | 35 x 70 (3,5x7 cm) | PROVÁVEL (CEHOP-SE, o trecho veio de busca e a URL exata do trecho não foi confirmada) | https://orse.cehop.se.gov.br/esp/ES00113.pdf |
| Madeira folha de porta | Espessura | 35 (3,5 cm, podendo +10 mm) | CONFIRMADO (edital Joinville) | https://www.joinville.sc.gov.br/public/edital/anexo/b36b10c53d5d73c399902ace20486445.pdf |
| Aço | - | Não pesquisado | NÃO CONFIRMADO | - |

Seções de perfil (L, T, retangular com rebaixo, com câmara):
- Retangular com rebaixo: madeira de marco e caixilho (CONFIRMADO, pela descrição de "seção retangular" e "rebaixo").
- Com câmaras: PVC (4 a 6 câmaras, CONFIRMADO pelos catálogos citados).
- L, T e perfis de alumínio: NÃO CONFIRMADO. A busca não trouxe seções transversais.

### 2. Encaixe do vidro

| Item | Dado | Status | Fonte |
|---|---|---|---|
| Vidro insulado, câmara | 6, 9, 12, 14, 15, 20, 24, 27, 35 mm | CONFIRMADO (Divinal, via snippet) | https://www.aecweb.com.br/produto/vidro-duplo-ou-insulado/34369 |
| Vidro laminado | 3+3, 4+4, 5+5, 6+6, 8+8, 10+10, 12+12 | CONFIRMADO (fabricante, via snippet) | https://www.aecweb.com.br/produto/vidros-laminados-vitrotec/4600 |
| Vidro 6 mm no caixilho | Limite 170 x 95 cm | CONFIRMADO (SUDECAP) | https://prefeitura-ds.pbh.gov.br/sites/default/files/noticia/sudecap_capitulo_16.pdf |
| Vidro temperado para box | 8 mm | CONFIRMADO (produtos de box) | https://www.archiexpo.com/pt/prod/relax/product-67144-1889086.html |
| Vidro temperado em esquadria | 8 mm, sem folga excessiva no requadro, gaxeta de neoprene ou cartão | CONFIRMADO (memorial TP011/2020) | https://taquari.rs.gov.br/uploads/edital/34497/MemorialDescritivoFechamento_TP011_2020.pdf |
| Vidro, espessura 4 mm: conferir com paquímetro (0,05 mm) | - | CONFIRMADO (DER-ES 0801) | https://der.es.gov.br/media/Documentos/Tabela%20Referencial%20de%20Pre%C3%A7o/Referencial%20de%20Edifica%C3%A7%C3%B5es/CADERNO_ESPECIFICACOES/0801-vidros-vidros-para-esquadrias.pdf |
| Rebaixo (profundidade e folga) | - | NÃO CONFIRMADO | - |
| Baguete, gaxeta, silicone, calços (valores) | - | NÃO CONFIRMADO (só o uso de gaxeta de neoprene, acima) | - |

Paramétrica (proposta, PROVÁVEL):
- Vidro é componente com `espessura` e `composição`, encaixado em um `rebaixo_vidro` do perfil de folha (ou no batente, no caso de vidro fixo).
- Campos do rebaixo: `profundidade_rebaixo`, `folga_lateral`, `folga_fundo`, `calço` (espessura e posição) e `baguete` (perfil separado, com `largura_visivel`).
- Vidro sem perfil: `tipo = frameless`, com `folga` e `ferragem_canto`, sem `rebaixo`.

### 3. Parâmetros mínimos e biblioteca

Parâmetros mínimos por perfil (proposta, PROVÁVEL):
- `id`, `material` (alumínio, PVC, madeira, aço), `serie` (ex.: linha 25, Euro-Design 60)
- `papel` (batente, contramarco, folha, travessa, montante, baguete, soleira, pingadeira, trilho)
- `largura_visivel` e `profundidade` (mm)
- `tipo_secao` (L, T, retangular com rebaixo, com câmaras)
- `rebaixo_vidro` (profundidade, folga)
- `ferragem` (referência, para cantos e dobradiças)
- `acabamento` (cor, anodizado, pintura, verniz)

Biblioteca inicial: estimativa PROVÁVEL de 15 a 20 presets para cobrir a maior parte dos casos. Não consegui confirmar "90%" com dados. A quantidade sugerida:
- Alumínio: linha 20, linha 25 (correr), Suprema, veneziana/grade, basculante/maxim-ar (4 a 5)
- PVC: 60 e 70 mm, 3 e 5 a 6 câmaras (2 a 3)
- Madeira: marco 7x3, batente 3x14, caixilho 3,5x7, folha 3,5 cm (3 a 4)
- Aço: 1 a 2 (NÃO PESQUISADO)
- Box temperado: 1 (vidro sem perfil)

### 4. Acabamentos e folhas

- Folha lisa: uma face plana, sem travessas (PROVÁVEL). Geometria simples.
- Folha almofadada (madeira): painéis com molduras e almofadas. Muda a espessura do painel e o recorte da moldura. Fonte: SENAI-RS, https://www.sesirs.org.br/sites/default/files/documents/porta_almofadada.pdf (documento de porta almofadada, sem dimensões confirmadas).
- Folha com vidro: rebaixo para vidro na folha (ver seção 2).
- Veneziana (alumínio e madeira): lâminas, com grade. Muda a geometria da folha e a área útil. Fonte: https://www.aecweb.com.br/produto/veneziana-tres-folhas/38230
- Lambril (madeira): painel de madeira, de folha simples ou dupla (fonte comercial, NÃO técnica). https://www.buscape.com.br/busca/porta+lambril
- Observação de BIM (CONFIRMADO, comunidade Graphisoft): o ArchiCAD não tem veneziana em porta, só em janela. Confirma uma lacuna de software para o Hestia. https://community.graphisoft.com/t5/Lista-de-Desejos/FOLHA-DE-PORTA-VENEZIANA/idc-p/654314

## Lacunas que pedem pesquisa mais profunda

1. Normas: NBR 10821 (esquadrias externas), NBR 7199 (vidros na construção) e NBR 15930 não foram lidas. Só apareceram citadas. É preciso o texto para rebaixo, folga e calço. Prioridade alta.
2. Catálogos de fabricantes com desenho de seção em PDF: Alumasa, Bergamo, Trifel, Sasazaki, Aluplast, REHAU, Deceuninck, Veka. Seriam as fontes para largura visível, profundidade e rebaixo. Os PDFs do DER-ES não se leram (sem texto). Prioridade alta.
3. Aço: nada pesquisado (perfis de aço para janelas e portas, séries comuns).
4. Seções em L e T de alumínio, e perfis de soleira, trilho e pingadeira (Schüco ASS 39 PD foi citado, mas sem dimensões: https://www.aecweb.com.br/produto/ass-39-pd-ni-panorama-design/54363).
5. Valores de baguete e gaxeta, e folgas do box (ferragem de canto).
6. Validação de cobertura de 90%: exige levantamento de projetos reais (escritórios brasileiros) ou de tabelas de compra de fornecedores.
7. Fontes de DER-ES e de editais (Joinville, TJCE) citam perfis de madeira de forma indireta. Confirmar em projeto-tipo, se necessário.
