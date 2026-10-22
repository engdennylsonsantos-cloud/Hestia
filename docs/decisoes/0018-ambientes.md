# 0018 · Ambientes (Room/Zone)

Fonte: [docs/05](../05-REFERENCIA-REVIT-ARCHICAD.md) §6 (Revit: Room; ArchiCAD: Zone). Padrão seguido: o mesmo de pisos
(0006) e lajes (0007) — modelo, comandos, migração, `resolve*`, validação e quantitativos. Esta etapa entrega o modelo e o
motor; ferramenta, painel, planta/3D e etiqueta ficam para a etapa H2.

| # | Decisão | Motivo |
|---|---|---|
| 1 | Ambiente é um elemento próprio (`room`) guardado por nível (`levelId`) com um `point` interior em planta; contorno, área, perímetro e volume são DERIVADOS pelo motor a partir do circuito de paredes que contém o ponto (nunca gravados) | Revit/ArchiCAD recalculam o contorno quando as paredes mudam; gravar só o ponto evita contorno defasado |
| 2 | Limite do ambiente = face do acabamento (face interna) das paredes do nível, como o "Pick Walls" do Revit | docs/05 §6: Revit mede até a face do acabamento por padrão; ArchiCAD reconhece pela borda interna |
| 3 | Vãos de porta e janela fecham por padrão: a porta/janela conta como parede para o circuito | A porta não abre o cômodo para fins de área; o contorno usa a silhueta inteira da parede, sem recortar os vãos |
| 4 | Pilares/shafts internos (ilhas de parede dentro do circuito) viram furos do polígono e descontam da área líquida | Área líquida desconta elementos estruturais internos ao cômodo |
| 5 | Pé-direito por instância (`ceilingHeight`); ausente, vale `defaults.wallHeight`. Volume = área líquida × pé-direito | O campo é o dado do usuário (análogo ao "Limit Offset" do Revit); sem ele, usa a altura padrão de parede do projeto |
| 6 | Acabamentos (`floorFinish`, `wallFinish`, `ceilingFinish`) são texto livre por instância, além de `color` opcional para o preenchimento na planta | Alimentam a tabela e o CSV; gerar piso/forro derivados a partir deles é etapa própria (forro é elemento do roteiro) |
| 7 | Ponto fora de circuito é problema (`fora` sem circuito, `aberto` com vão), ambiente duplicado no mesmo circuito é aviso e nome vazio é erro de modelo | Nunca bloqueia; o circuito aberto impede o cálculo de área, então é sinalizado em vez de inventar um contorno |
| 8 | Migração v16 → v17 só avança a versão: `Room` é opcional (arquivo antigo simplesmente não o tem) e os campos novos têm padrão de leitura (`heightOffset` 0, `ceilingHeight` = `defaults.wallHeight`, acabamentos vazios, `color` ausente) | Como pisos/lajes, o elemento é guardado em `elements`; não há dado a converter |
| 9 | `number` (Revit: Number) e `name` são texto livre, sem geração automática | O número de ambiente é dado do usuário, como no Revit |
