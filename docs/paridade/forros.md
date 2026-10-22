# Paridade · Forros

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento.
Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) (Revit: Ceiling e Ceiling Plan). Decisões em [docs/decisoes/0021](../decisoes/0021-forros.md).

## A · Modelo
- [x] A1 Forro por nível com contorno e furos, tipo, marca e comentários **(bloqueante)**
- [x] A2 Cota do topo (`heightOffset`, padrão 2,60 m); face inferior derivada das camadas **(bloqueante)**
- [x] A3 Tipos de forro com camadas (gesso 12,5 mm, PVC, laje aparente) em `ceilingTypes`, com migração v17 → v18
- [x] A4 Vínculo com o ambiente de origem (`roomId`), contorno gravado na criação
- [-] A5 Contorno que acompanha o ambiente depois de criado: o forro grava o contorno (decisão 0021, §4)

## B · Motor
- [x] B1 `resolveCeilings`: contorno, cota do topo, face inferior e camadas **(bloqueante)**
- [x] B2 Quantitativos: área líquida, perímetro, espessura e volume por camada e por material **(bloqueante)**
- [x] B3 Tabela `ceilingSchedule` com filtros e CSV (`;`, decimal com vírgula, BOM)
- [x] B4 Avisos: sem contorno, tipo ausente, forro acima da parede mais baixa
- [x] B5 Forro por ambiente: um rascunho por ambiente com circuito fechado
- [x] B6 Recorte do forro por escada e por abertura de piso/laje do nível de cima (`ceilings.ts`, decisão 0021 §18)

## C · Planta de forro (direção para cima)
- [x] C1 `direction: 'up'` desenha a planta de forro; o topo não limita **(bloqueante)**
- [x] C2 Forro preenchido com a cor do material da primeira camada e hachura **(bloqueante)**
- [x] C3 Paredes cortadas no plano de corte; o que está abaixo do corte não aparece **(bloqueante)**
- [x] C4 Forro ausente da planta baixa e sem aviso de intervalo na planta baixa
- [x] C5 Opção "Para cima" habilitada em Propriedades, com a mesma preferência de nível de detalhe
- [x] C6 Seleção do forro pela planta de forro

## D · Outras vistas
- [x] D1 3D: sólido por camada, na categoria de pisos
- [x] D2 Corte e elevação: faixa t×z por camada, com origem do forro
- [x] D3 Hachura própria de forro (`gesso`, no tipo `hatch`) no corte e na elevação, com teste

## E · Edição
- [x] E1 Comandos `addCeiling`, `addCeilings` (lote), `updateCeiling`, `removeCeiling`, com desfazer/refazer **(bloqueante)**
- [x] E2 Tipos: `upsertCeilingType`, `deleteCeilingType` (recusa uso e o último), `duplicateCeilingType`
- [x] E3 Ferramenta Forro: contorno, retângulo e "No ambiente", com barra de opções e botão no Ribbon
- [x] E4 Diálogo do tipo com seção ao vivo (reuso do editor de camadas e da seção de laje)
- [x] E5 Propriedades do forro (tipo, cota, construção, dimensões, marca)
- [x] E6 Forro por ambiente do nível inteiro em um clique (botão na barra de opções e no Ribbon, aba Arquitetura; um Ctrl+Z)
- [x] E7 Furos pela ferramenta: modo "Furo (forro selecionado)", contorno interno como no piso (decisão 0021, 21)

## F · Saídas
- [x] F1 Tabela de forros na Vista e na Árvore de projeto, com CSV
- [x] F2 DXF: camada `FORRO` (polilinhas fechadas, com furos), só na planta de forro
- [x] F3 Validação integrada à lista de problemas (`useIssues`)

## G · Qualidade
- [x] G1 Migração v17 → v18 e ida e volta de JSON preservando forros e tipos **(bloqueante)**
- [x] G2 Testes de modelo, comandos, motor, planta, 3D, corte, ferramenta, captura e DXF
- [x] G3 Testes da planta de forro: presente quando `up`, ausente quando `down`, piso fora da vista de cima **(bloqueante)**
