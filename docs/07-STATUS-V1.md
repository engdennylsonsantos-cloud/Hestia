# 07 · Status da versão de teste

Estado em 2026-10-22, conferido no código, nos testes e nos documentos de decisão desta árvore (esquema 19). Os
checklists de [docs/paridade](paridade/) são a fonte por elemento; `docs/paridade/ORDEM.json` registra o portão, e os
nove elementos estão `concluido` (`npm run parity`: paredes 99%, pisos 98%, lajes 98%, os demais 100%). Os itens que
sobram são não bloqueantes (ver "Pendências").

## O que está pronto

**Fundação**
- Monorepo npm workspaces com CI (lint, tipos, testes, build); fronteiras entre camadas por `scripts/check-boundaries.mjs`;
  limite de 420 linhas por arquivo (ESLint `max-lines`, sem linhas em branco nem comentários; testes fora).
- Modelo versionado (`SCHEMA_VERSION` 19) com desfazer/refazer e migrações v15→v16 (caracol), v16→v17 (ambientes),
  v17→v18 (forros) e v18→v19 (contorno associativo). Ida e volta de arquivo em `esquema.test.ts`. Autosave e `.hestia.json`.

**Paredes** — 67 feitos, 15 fora de escopo, 1 pendente (E3) (`docs/paridade/paredes.md`).
- Reta, em arco e por retângulo; alturas, deslocamentos de base e topo; linha de localização (6 opções).
- Camadas com função, material, espessura, prioridade e "envolve"; membranas de espessura zero; faixas verticais; perfil superior.
- Junções L/T/X por prioridade, com encosto, esquadria, cortes oblíquos de 30° a 150° e paredes empilhadas. Arco no
  domínio suportado (raio ≥ 3 m, quina de 60° a 120°); fora dele vale CV-2.
- Aberturas hospedadas com recorte em todas as camadas; ferramentas de edição (mover, copiar, aparar, dividir, juntar,
  medir, anexar topo ao telhado etc.); planta, corte, 3D, DXF, tabela com CSV e painel de avisos.
- Parede anexada a piso ou laje por trecho, com perfil de base (0023 P9).

**Pisos** — 40 feitos, 7 fora de escopo, 1 pendente (C6) (`docs/paridade/pisos.md`).
- Contorno por cliques, retângulo, medida, seleção de paredes ou área fechada; furos; edição por alças.
- Contorno associativo às paredes (0023 P1–P3): "Desvincular" e "Revincular às paredes"; avisos de contorno aberto e duplicado.
- Tipo em camadas com seção ao vivo; tipo `ft_acab` sobre laje (P5); quantitativos líquidos por camada; membrana de
  espessura zero (P4); "Término na junção" por camada (P8, parcial).
- Planta com hachura, 3D por camada, corte, subpavimento, etiqueta, DXF, quantitativos e tabela com CSV.

**Lajes** — 38 feitos, 3 fora de escopo, 1 pendente (C8) (`docs/paridade/lajes.md`).
- Contorno por cliques, retângulo, medida, automático pelo perímetro ou por área fechada; furos; mesmo vínculo, membrana
  e término dos pisos. Inclinação por linha e percentual; parede anexada à laje.
- Planta, 3D com inclinação e furos, corte com hachura por camada, DXF, quantitativos e tabela com CSV.
- Junção piso/laje × parede (0023 P7, parcial): prioridade efetiva alimenta os quantitativos; planta, corte e 3D de piso
  e laje usam a região resolvida. A parede ainda não é recortada (ver pendências).

**Telhados** — 43 feitos, 1 fora de escopo, 0 pendentes (`docs/paridade/telhados.md`).
- Formas uma, duas e quatro águas, contorno qualquer e extrusão de perfil; cumeeira, espigões e rincões; furos; beiral.
- Topo da parede ajustado ao telhado; planta com águas e setas, 3D, corte, planta de cobertura, DXF, quantitativos e CSV.

**Escadas (inclui caracol)** — 36 feitos, 4 fora de escopo, 0 pendentes (`docs/paridade/escadas.md`).
- Croqui de lance com patamar, "Pegar linhas" e validação com as mensagens do Revit.
- Geradores reto, L, U, leque e caracol (até duas voltas, varredura ≤ 4π, decisão 0014), com dois estilos de caracol.
- Tipos de escada com seção ao vivo; corpo monolítico; furo derivado por laje/piso; avisos de norma e folga de cabeça.
- Planta com numeração contínua, 3D, corte, DXF, quantitativos e tabela com CSV.

**Aberturas por família** — 35 feitos, 7 fora de escopo, 0 pendentes (`docs/paridade/aberturas.md`; decisão 0017).
- Dez famílias em `OPENING_FAMILIES`: portas giro, dupla, correr, pivotante e vão livre; janelas fixa, basculante,
  maxim-ar, correr (2 ou 3 folhas) e vão livre. Combinação fora das famílias é recusada.
- Basculante: a família existe, mas por decisão do dono (2026-10-22, 0017 §11) nenhum dos 14 tipos padrão a usa, e não
  há janela de giro vertical nova.
- **Acabamento por tipo** (seção "Acabamento" da tela de editar tipo): folga do vão bruto (`roughOversize`), alizar
  (`casing`), soleira saliente só de janela (`sillBoard`), verga e contraverga com transpasse (`lintel`, `sillBeam`).
  Sem o campo, nada é desenhado. Aparecem no 3D e no corte; na planta, verga e peitoril ainda não (P13).
- Favoritos no seletor (`favoriteOpeningTypes`, desfazível).
- Giro e X de vão em planta, corte e elevação (0024): o giro é o símbolo em "V" (vértice no lado da dobradiça, a meia altura; pontas no lado do
  trinco; decisão 0024 §2), tracejado quando a folha abre para o observador e contínuo quando abre para o lado oposto; o X de vão em parede é convenção própria; o X de furo de piso/laje segue o Shaft Opening
  do Revit.
- 3D por família; folha aberta com "Abrir vãos" (vidro, giro, correr e pivotante corrigidos, 0017 §11).
- Instância com lado da dobradiça, sentido de abertura e marca; "Tabela de portas e janelas" com CSV.

**Ambientes** — 24 feitos, 4 fora de escopo, 0 pendentes (`docs/paridade/ambientes.md`; decisão 0018).
- Contorno derivado do circuito fechado pelas paredes do nível; ferramenta **Ambiente** (**Z**) e "Ambientes em todos os
  circuitos fechados"; área líquida, perímetro e volume; tabela com filtros e CSV; DXF nas camadas `AMBIENTES` e `AMBIENTES_TEXTO`.

**Forros e planta de forro** — 32 feitos, 1 fora de escopo, 0 pendentes (`docs/paridade/forros.md`; decisão 0021).
- Forro por contorno, retângulo ou "No ambiente"; botão **"Forro em todos os ambientes"** (um Ctrl+Z); cota do topo
  (padrão 2,60 m); tipos em camadas (gesso 12,5 mm, PVC, laje aparente).
- **Planta de forro** em "Direção da vista → Para cima"; 3D, corte, quantitativos por camada, tabela e CSV; DXF na camada `FORRO`.

**Pranchas e PDF** — 19 feitos, 4 fora de escopo, 0 pendentes (`docs/paridade/pranchas.md`).
- Prancha A0–A4 com margem e carimbo; vistas de planta, corte ou 3D com escala; 3D aparece como quadro ("3D não vai no PDF").
- **Exportar PDF**: PDF 1.4 vetorial sem dependências, uma página por prancha.

**Anotações** — cota (**Y**, com referência à parede) e texto (**X**), na planta e no DXF (camadas `COTAS` e `TEXTOS`).

**Vistas, gráficos e seleção**
- **Planta** por nível com intervalo de vista, direção para cima ou para baixo, subpavimento e projeção da cobertura (0013).
- **Cortes e elevações**: corte por dois cliques; as quatro elevações em um passo; linha oculta; seleção e realce (0016).
- **3D** orbital com plano próximo dinâmico, sombras, sol e estilos (0015); seleção por clique com BVH (`triBvh.ts`);
  ViewCube com 26 zonas e alternância entre perspectiva e ortográfica.
- **Gráficos de vista** (0015): escala, detalhe, estilo e substituições por categoria; pesos de linha reais nas pranchas,
  PDF e DXF (código 370). **Linhas finas** só na tela (botão na aba Vista; desabilitado no 3D e na prancha).
- **IFC4 (exportação)**: **Exportar IFC** com IfcSite, IfcBuilding, IfcBuildingStorey, IfcWall, IfcDoor, IfcWindow,
  IfcOpeningElement (com relações de vazio e preenchimento), IfcSlab, IfcRoof, IfcStair, IfcStairFlight e camadas de
  material. Não exporta IfcSpace nem IfcCovering.
- **Entrega de arquivos** (`entregarArquivo.ts`): capability `downloads` do artefato; sem ela ou recusada, `<a download>`;
  se também falhar, o texto vai para a área de transferência. Nome sem acento (`nomeArquivo.ts`). Pelo código, DXF e IFC
  caem nessa cadeia dentro do link; a lista de extensões aceitas pela plataforma não foi conferida.
- **GPU/CPU**: WebGL2 por padrão; WebGPU com `?gpu=webgpu`; planta em CPU com `?cpu=1`.

## O que ainda não existe

- **Interoperabilidade e nuvem**: IFC de entrada (o código só escreve IFC), importador do Hestia 1 (J3), nuvem e link de
  compartilhamento (Fase 8).
- **Guarda-corpo e corrimão** (escadas C4, decisão do dono de 2026-10-21); **escada de vários andares** (C6).
- **Pilares, vigas, sapatas e cortina de vidro**: o modelo não tem esses elementos.
- **Aberturas**: vão em arco e formas não retangulares (0017 §8); verga e peitoril na planta quando o corte passa por
  eles (P13); janela de giro como família (P14); tipo basculante no catálogo; X no DXF de corte (X4) e X dos furos de
  piso/laje no DXF de planta (X5); porta pivotante com eixo provisório a W/4 (0024 §7). P13, X4 e X5 estão `[-]` por
  limite de escopo e não estão feitos.
- **Símbolo de giro**: em "V" (convenção própria: a NBR 6492:2021 é paga e não foi acessada; 0024 §2).
- **Junções**: "Inverter corte/Não cortar" por par (P-4, adiada; 0023 §13 e P10).
- **Ambientes**: sem geometria 3D própria (D2); sem linha separadora (A5); sem piso de acabamento gerado (C3).
- **Forros**: o forro grava o contorno do ambiente na criação (0021 §4). A decisão do dono de 2026-10-22 (0023 §13, P-5)
  manda o forro criado a partir de ambiente acompanhar o contorno dele; essa mudança não está implementada.
- **Pranchas**: carimbo com logotipo e campos personalizados, modelos (E1); quantitativos na prancha (E2); imagem do 3D (B5);
  pan (D7).
- **Paredes**: parede inclinada (A6), espessura variável (A9), contorno vertical livre (A10), regiões gráficas na elevação
  (B9), cotas associativas de parede (H5).
- **Telhados**: seta de inclinação e águas livres na tela (A5, fora da v1); mansarda automática (v2).
- **Limites conhecidos**: CV-2 e CV-3; seleção em corte unido por material pode apontar o vizinho do mesmo material; sem
  seleção por janela no 3D; intervalo de vista por nível, não por vista.
- **Checklists desatualizados**: `aberturas.md` C3 e C4 estão `[-]`, mas os campos existem no tipo e na tela; `escadas.md`
  C7, `paredes.md` J1 e `pisos.md` E5 marcam IFC como fora de escopo, mas a exportação IFC4 existe.

## Pendências não bloqueantes

- **Parede × piso/laje** (E3, C6 e C8): planta, corte e 3D ainda não recortam a parede pela região do piso ou da laje.
  Os quantitativos já seguem a prioridade de camada (0023 §1, P7). A parede ainda não é recortada nos desenhos pela camada de piso ou laje que vence (parte adiada da P7, chamada P7c nas conversas de projeto).
- **Término na junção** (0023 P8, parcial): falta o término em perímetro externo, cor e hachura por camada na planta, e
  IFC e DXF por camada.
- **Canto reentrante de um L** (achado do P8, não corrigido): o circuito de paredes deixa um quadrado d × d sem parede
  (d = meia espessura) que entra no cômodo. A área do L em `layerOutline.test.ts` inclui esse quadrado de propósito.
- **Close-ups 3D do L** (`tests/e2e/escadas-closeup.mjs`): tolerância própria de 1,5% (d) e 25% (f), porque o WebGL por
  software rasteriza sombras de outro jeito.

## Roteiro de teste manual (10 minutos)

1. `npm run dev`; em **Novo**, escolha **Casa de alto padrão, 2 pavimentos**. Confira os dois níveis, 32 paredes, 38
   aberturas, 2 pisos, 1 laje, 1 telhado, 1 escada e as vistas (contagens conferidas em `casaAltoPadrao.test.ts`).
2. **Aberturas**: selecione uma janela e abra **Editar tipo…**; confira família, folhas, símbolo e a seção **Acabamento**.
   Marque um tipo como favorito (estrela). Com **D** e **J**, insira porta e janela (**Tab** troca o lado, **Espaço** a
   dobradiça) e abra a **Tabela de portas e janelas**.
3. **Ambientes**: com **Z**, clique numa sala fechada e confira nome, número e área. Em **Tabela de ambientes**, altere
   o pé-direito e confira área e volume. Use "Ambientes em todos os circuitos fechados" e confira os avisos.
4. **Forros**: use **Forro em todos os ambientes** e confira o forro no 3D e no corte. Em **Direção da vista**, escolha
   **Para cima (planta de forro)** e confira que a planta baixa não mostra o forro.
5. **Pranchas e PDF**: em **Pranchas**, crie uma **Nova prancha** A3 paisagem, adicione uma planta 1:100 e um corte 1:50,
   arraste a vista e troque a escala. Clique em **Exportar PDF** e confira o carimbo, os pesos de linha e o aviso do 3D.
6. **Cotas e DXF**: na planta, use **Y** e **X**; apague uma anotação (Ctrl+Z desfaz). Clique em **Exportar DXF** e
   confira as camadas `COTAS`, `TEXTOS`, `AMBIENTES` e, na planta de forro, `FORRO`.
7. **Cortes e 3D**: com **K**, desenhe um corte e use **Gerar elevações** para abrir a Sul; clique numa parede e numa
   janela. No **Modelo 3D**, orbite, use o **ViewCube**, alterne **Perspectiva/Ortogonal** e selecione elementos com Shift/Esc/Delete.
8. **Paredes, pisos e tipos**: selecione uma parede e use **Editar tipo…** para mudar uma camada (seção ao vivo). Com **F**,
   crie um piso pelas paredes, confira "Desvincular" e mova uma parede para ver o contorno acompanhar. Desfaça com Ctrl+Z.
9. **Escadas**: em **Tipos de escada**, altere um tipo e confira a numeração dos degraus.
10. **Exportação e arquivo**: clique em **Exportar IFC** e confira que o arquivo abre; grave o `.hestia.json`, feche, reabra
    e confira que ambientes, forros e pranchas voltaram. Abra o painel de avisos e use **Ir para**.

## Como rodar

```bash
npm install
npm run dev            # servidor de desenvolvimento
npm run check          # lint + tipos + testes (portão do CI)
npm run test:rapido    # testes sem property.test.ts e perf.test.ts
npm run test:completo  # suíte inteira, com as 60 sementes de property.test.ts (~8 min)
npm run test:perf      # desempenho (K4 e captura de faces), fora do check
npm run build          # build da aplicação em apps/web/dist
npm run build:artifact # gera apps/web/dist/artifact.html
npm run e2e            # fluxo no navegador (requer Chromium do Playwright)
node tests/e2e/pranchas.mjs            # pranchas: aba, vistas, carimbo e PDF (requer build e Chromium)
node tests/e2e/visual-regression.mjs   # regressão visual da planta (--update regrava as referências)
npm run parity         # percentual de paridade por elemento
```

Os fluxos de navegador estão em `tests/e2e/*.mjs` (22 fluxos; `helpers.mjs` é auxiliar).

## Qualidade e verificação

- Checklists (feitos + fora de escopo + pendentes): paredes 67+15+1, pisos 40+7+1, lajes 38+3+1, telhados 43+1+0,
  escadas 36+4+0, aberturas 35+7+0, ambientes 24+4+0, forros 32+1+0, pranchas 19+4+0. O portão de 95% e os bloqueantes
  são verificados por `scripts/check-parity.mjs` no lint e no CI.
- `npm run test:rapido` em 2026-10-22: 264 arquivos e 3276 testes, todos passando (72,8 s; `test:rapido`, sem property e perf).
- `npm run test:completo` em 2026-10-22: 265 arquivos e 3578 testes, todos passando, com as 60 sementes (590 s, código de saída 0).
- Build em 2026-10-22: `dist/index.html` 2.532,22 kB e `artifact.html` 2.531,98 kB (kB decimais, medidos em bytes); `build:artifact` sem erro e sem TMPDIR.
- Desempenho e regressão visual: os números estão na atualização de [08](08-PENDENCIAS-E-CORRECOES.md) e não foram
  repetidos nesta revisão, salvo onde indicado acima.
- A conferência visual final em navegador real continua manual: os testes cobrem geometria, unidade e desenho, não a
  aparência em todas as combinações de zoom, tema e GPU.
