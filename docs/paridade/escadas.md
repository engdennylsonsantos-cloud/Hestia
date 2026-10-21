# Paridade · Escadas

Legenda: `[x]` feito e testado · `[ ]` pendente · `[-]` fora de escopo, com o motivo na própria linha.
Itens marcados **(bloqueante)** precisam estar feitos antes de abrir o próximo elemento (ambientes).
Fonte: [docs/escadas](../escadas/) (Revit 2026: Stair by Component e croqui; ArchiCAD 29: Stair Tool). Decisões em [docs/decisoes/0011](../decisoes/0011-escadas.md).

## A · Geometria e croqui
- [x] A1 Croqui de lance: limites esquerdo e direito, linhas de espelho e caminhada opcional, com retas e arcos **(bloqueante)**
- [x] A2 Validação do croqui com as regras e mensagens do Revit (limites que se tocam, espelho que cruza, espelho sobre o limite, caminhada fora do 1º ao último espelho, contagem de espelhos) **(bloqueante)**
- [x] A3 Degraus gerados do croqui livre, incluindo leque e degraus curvos; N espelhos dão N−1 degraus de altura uniforme **(bloqueante)**
- [x] A4 Patamar por croqui (laço fechado de retas e arcos) na cota do último espelho do lance anterior **(bloqueante)**
- [x] A5 Gerador de lance reto (início, direção, largura, nº de espelhos, piso pela regra 2e+p) **(bloqueante)**
- [x] A6 Geradores em L e em U com patamar automático (largura do lance)
- [x] A7 Gerador de leque (espelhos radiais; na ferramenta, forma "Com leque" = winder de 90°)
- [ ] A8 Pegar linhas (paredes, linhas, arestas) com deslocamento e corrente por Tab no croqui — não implementado: o croqui usa linha e arco com captura nas faces e nos pontos já desenhados
- [x] A9 Distribuir N espelhos ao longo da caminhada (acelerador além do Revit)
- [x] A10 Editar o croqui da escada pronta e converter lance gerado em croqui **(bloqueante)**
- [x] A11 Edição por alças na planta (limites, espelhos, caminhada, patamar)

## B · Tipos e níveis
- [x] B1 Tipo de escada (espelho máx., piso mín., largura mín., estilo monolítico/piso e espelho, espessuras, nariz, patamar, folga de cabeça) **(bloqueante)**
- [x] B2 Editor de tipo de escada
- [x] B3 Duplicar, renomear, substituir e excluir tipo (bloqueado se em uso)
- [x] B4 Nível de base e de topo, deslocamentos e altura; altura do espelho = altura ÷ nº de espelhos **(bloqueante)**

## C · Relação com o modelo e avisos
- [x] C1 Furo derivado na laje e no piso do nível de topo (recalcula ao mover a escada; abertura por escada: pé-direito livre, contorno completo ou sem abertura, folga lateral e furo retangular; decisão 0011 §6) **(bloqueante)**
- [x] C2 Avisos de norma (2e+p, espelho, piso, patamar a cada 3,20 m, folga de cabeça, leque) no painel de avisos com "Ir para"
- [x] C3 Aviso de largura do lance menor que a mínima do tipo e de altura do espelho acima do máximo **(bloqueante)**
- [-] C4 Corrimão e guarda-corpo na escada: etapa própria "guarda-corpo" (decisão do dono, 2026-10-21)
- [-] C5 Apoios (stringer, carriage): fora da v1 (decisão 0011 #13)
- [-] C6 Escada de vários andares: fora desta etapa (decisão do dono)
- [-] C7 Exportação IFC (IfcStair, IfcStairFlight, patamar LANDING): Fase 8 do roteiro

## D · Vistas
- [x] D1 Planta: degraus, seta de subida com texto, linha de corte, degraus acima do corte tracejados **(bloqueante)**
- [x] D2 3D com degraus (monolítico e piso/espelho) e patamares **(bloqueante)**
- [x] D3 Corte e elevação com degraus **(bloqueante)**
- [x] D4 Subpavimento: escada do nível abaixo
- [x] D5 Exportação DXF

## E · Quantitativos
- [x] E1 Nº de espelhos, altura do espelho, piso médio, largura, área em planta, volume por tipo **(bloqueante)**
- [x] E2 Tabela de escadas com filtros, totais e CSV

## F · Edição
- [x] F1 Selecionar, mover, copiar, girar, espelhar **(bloqueante)**
- [x] F2 Painel de propriedades da escada (instância e tipo) **(bloqueante)**
- [x] F3 Colar alinhado entre níveis inclui escadas
- [x] F4 Ferramenta Escada no Ribbon, atalho e barra de opções com contador de espelhos "criados / restantes" **(bloqueante)**

## G · Qualidade
- [x] G1 Validação do modelo (erros de geometria impedem gerar degraus; norma e tipo geram aviso) **(bloqueante)**
- [x] G2 Painel de avisos com "Ir para"
- [x] G3 Casos dourados de alturas, nº de degraus, áreas e volumes **(bloqueante)**
- [x] G4 Testes de propriedade (degraus disjuntos, união = região entre espelhos, cotas crescentes, sem exceção)
- [x] G5 Migração de arquivo v11 → v12 e ida e volta
- [x] G6 Regressão visual por captura — `npm run test:visual` (após `npm run build`) compara as capturas determinísticas de `escadas.mjs`, `vista-planta.mjs` e `escadas-closeup.mjs` com `tests/e2e/baseline/` (`tests/e2e/visual.mjs`, tolerância 0,5% de pixels por captura; `UPDATE_BASELINE=1` regrava)
