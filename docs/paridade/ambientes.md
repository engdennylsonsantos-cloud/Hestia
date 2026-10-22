# Paridade · Ambientes

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento.
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) §6 (Revit: Room; ArchiCAD: Zone). Decisões em [docs/decisoes/0018](../decisoes/0018-ambientes.md).

## A · Geometria
- [x] A1 Contorno derivado do circuito fechado pelas faces internas das paredes do nível (`resolveRooms`); acha o circuito pelo ponto interior **(bloqueante)**
- [x] A2 Vãos de porta e janela fecham por padrão (a silhueta da parede não recorta os vãos) **(bloqueante)**
- [x] A3 Pilares/shafts internos (ilhas de parede dentro do circuito) viram furos do polígono e descontam da área líquida **(bloqueante)**
- [x] A4 Criação por clique dentro do circuito na planta (ferramenta Ambiente, atalho Z); "Ambientes em todos os circuitos fechados" na barra
- [-] A5 Linha de separação de ambiente (Revit: *room separator*): fora desta etapa; o circuito vem sempre das paredes

## B · Dados
- [x] B1 Ambiente guardado por nível com nome, número, ponto interior, pé-direito e acabamentos (piso, parede, forro) e cor **(bloqueante)**
- [x] B2 Pé-direito por instância (`ceilingHeight`), padrão = altura de parede do projeto; `heightOffset` da base em relação ao nível
- [x] B3 Painel de propriedades do ambiente: nome, número, ponto interior (leitura), deslocamento, pé-direito, acabamentos, cor; área, perímetro e volume; aviso sem circuito

## C · Relação com piso/forro
- [x] C1 Acabamentos por instância alimentam a tabela e o CSV
- [-] C2 Forro por ambiente com altura e camadas: elemento próprio do roteiro (etapa "forro")
- [-] C3 Piso de acabamento gerado a partir do ambiente: o piso já existe por contorno; a associação automática ambiente→piso fica para a etapa de piso/forro

## D · Vistas
- [x] D1 Planta: preenchimento do ambiente (cor própria ou padrão do tema) e etiqueta com nome, número e área; no grosso, só o nome
- [-] D2 3D: o ambiente não tem geometria própria (é contorno em planta); fica fora do 3D
- [ ] D3 Subpavimento: ambiente do nível abaixo (pendente, não entrou na H2)

## E · Quantitativos
- [x] E1 Área líquida, perímetro e volume (área × pé-direito) derivados do circuito **(bloqueante)**
- [x] E2 Tabela de ambientes com número, nome, nível, área, perímetro, pé-direito, volume e acabamentos; filtros por nível, totais por nível e geral, e CSV (BOM, `;`, decimal com vírgula) **(bloqueante)**
- [x] E3 Etiqueta de ambiente na planta (nome, número e área)

## F · Edição
- [x] F1 Comandos `addRoom`, `updateRoom`, `removeRoom` e `updateElements` em lote, com desfazer/refazer; `transform` move o ponto interior
- [x] F2 Ferramenta Ambiente no Ribbon (aba Arquitetura), atalho Z e barra de opções
- [x] F3 Selecionar por clique e janela, "Mesmo nome", mover, copiar, girar, espelhar, excluir e copiar/colar alinhado entre níveis; categoria 'room' nos filtros

## G · Qualidade
- [x] G1 Validação de modelo: nome vazio e nível inexistente (`roomIssues`) integrados ao `validateProject` **(bloqueante)**
- [x] G2 Validação de geometria: ponto fora de circuito (`fora`/`aberto`) e ambiente duplicado no mesmo circuito (`roomValidationIssues`)
- [x] G3 Casos dourados de área/perímetro/volume (retângulo 4×5 → 20 m², com pilar interno, em L, circuito aberto → problema, nível sem paredes) **(bloqueante)**
- [x] G4 Testes de propriedade: ponto em 30 retângulos aleatórios (sem exceção, área e perímetro batem com o retângulo)
- [x] G5 Migração de arquivo v16 → v17 e ida e volta de JSON preservando os ambientes
- [ ] G6 Regressão visual por captura de tela (pendente; D1 já está pronto)
- [x] G7 Avisos de ambiente no painel de avisos (`roomValidationIssues` e `roomIssues`) com "Ir para" centrado no ponto interior

## H · Saída
- [x] H1 DXF da planta: contorno fechado na camada `AMBIENTES` e nome, número e área na `AMBIENTES_TEXTO`; oculto pela categoria 'ambiente' não sai
