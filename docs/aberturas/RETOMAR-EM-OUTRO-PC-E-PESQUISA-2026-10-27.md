# Retomar em outro PC e pesquisa de esquadrias (2026-10-27)

Leia junto: [HANDOFF-ESQUADRIAS-HESTIA-2026-10-27.md](HANDOFF-ESQUADRIAS-HESTIA-2026-10-27.md) (estado dos ramos e ordem de retomada) e
`docs/handoff/retomada-2026-10-27-telhados-grades.md` (rodada de telhados e grades).

## A. Como retomar em outro PC

Requisitos: Git, Node 22 ou maior, Chrome (para os e2e; defina `CHROME_PATH`), opcional `opencode` (precisa do login do provedor `opencode-go`).

```bash
git clone https://github.com/engdennylsonsantos-cloud/Hestia.git
cd Hestia
git fetch --all --tags
git checkout esquadrias/v3          # esquadrias; para telhados e grades: integracao/telhados-grades
npm ci
npm run dev                         # abre em http://localhost:5173
# worktrees dos agentes (ficam FORA do repositório; um npm ci em cada):
git worktree add ../wt/E2a esquadrias/E2a
git worktree add ../wt/E2b esquadrias/E2b
git worktree add ../wt/E3b esquadrias/E3b
```

O que está no GitHub: ramos `integracao/telhados-grades`, `esquadrias/v3` (já contém E1a, E3a, E3c e E4 mesclados), `esquadrias/E2a`,
`esquadrias/E2b`, `esquadrias/E3b`, e as 35 etiquetas `arquivo/*` (trabalho antigo, inclusive `arquivo/feat-esquadrias-v3` e
`arquivo/feat-esq-BRD`). A `main` NÃO foi alterada.

O que NÃO está no GitHub (só no PC de origem): (1) o que o `opencode` ainda gravava no E3b depois do último envio; (2) os scripts de
captura temporários (pasta temporária do Claude); (3) os arquivos `backup-*.bundle` em `Desktop\programas\Hestia\` (cinco, backup do
trabalho pendente do repositório antigo MiniBIM2: só levar se quiser guardar também esse histórico); (4) a conversa do Claude: o
contexto inteiro NÃO vai junto, por isso estes documentos existem.

Prompt para colar numa sessão nova do Claude no outro PC:

```
Repositório Hestia (BIM de arquitetura no navegador). Faça `git fetch --all` e `git checkout esquadrias/v3`. Leia, nesta ordem:
docs/aberturas/RETOMAR-EM-OUTRO-PC-E-PESQUISA-2026-10-27.md, docs/aberturas/HANDOFF-ESQUADRIAS-HESTIA-2026-10-27.md e
docs/handoff/retomada-2026-10-27-telhados-grades.md. Siga a ordem de retomada do handoff (seção 0 e seção 3): primeiro valide e
mescle esquadrias/E2a, E2b e E3b em esquadrias/v3, conferindo `npx tsc -p tsconfig.json --noEmit` e os testes de cada um. Use
subagentes: Sonnet (esforço médio) para motor e arquitetura do diálogo, Haiku (esforço alto) para tarefas mecânicas. Regras do dono:
batente no núcleo; com batente não há retorno do acabamento; alizar e retorno são exclusivos; planta só com a folha aberta; não
mesclar na main nem enviar nada sem a minha confirmação; responda em português; só comentar quando eu pedir "só comentar".
```

## B. Pesquisa (resumo do que os agentes encontraram)

**Defeito 1: acabamento sobre o batente.** O retorno do acabamento (`packages/engine/src/wrap.ts`, `insertReturns`, chamado em `resolve.ts` ~436-441)
não conhecia o batente (`openingModelContext.ts`, `openingModelDoors.ts`), e com `wrapInserts: 'both'` o retorno cobria a profundidade do
núcleo. Medido: 2,2 cm de reboco e tinta dentro dos 5 cm da ombreira, ~20 cm² por lado, em porta e janela. Resolvido em `esquadrias/v3`
(R1 a R3).

**Defeito 2: folha aberta e fechada em planta.** `openingPlan.ts:119` desenhava a folha fechada no nível de detalhe "alto" (zoom acima de
100 px/m ou `planDisplay: 'projected'`). 8 famílias afetadas. Resolvido em `esquadrias/v3` (R4, campo `leafPlan`).

**Outros defeitos medidos:** parede curva: cunha de acabamento de 10 a 12 cm em janela (`openingRect` reto em `resolve.ts` ~248-250 contra
retorno radial em `wrap.ts`): corrigido no `esquadrias/E2a`. O diálogo mostrava os mesmos 44 campos em todas as famílias: tratado no E3a.
A ferramenta de colocação já é contínua (sem defeito).

**ArchiCAD confirmado (ajuda oficial):** "Frame Style and Dimensions": largura do perfil uniforme ou por lado; espessura configurável com a caixa
"Frame Thickness = Wall Thickness"; 3 estilos de batente (bloco; com batedor; com batedor e rebaixo); porta de duplo sentido força o estilo bloco.
Turn Plaster (retorno) e alizar (casing) são mutuamente exclusivos. "Nominal Sizes": Wallhole, Unit, Egress e Leaf, com "Set as Nominal".
Exibição em planta: Symbolic, Overhead All, Projected, Projected with Overhead (Projected não mostra linhas de abertura).
**Revit confirmado:** "Wrapping at Inserts" (Do not wrap, Exterior, Interior, Both), padrão "Do not wrap"; depende dos planos Wall Closure da família.
**Não confirmado:** padrão da biblioteca do ArchiCAD para "= espessura da parede" e âncora face/núcleo; se o símbolo 2D padrão do ArchiCAD
mostra a folha fechada além da aberta (a regra "só aberta" é decisão do Hestia); lista de tipos de caixilho e vidro da janela do ArchiCAD;
semântica oficial de Rough Width/Height do Revit; arremate do reboco no marco (só fabricantes e SINAPI).

**Configurações por tipo (painel por painel do ArchiCAD), resumo e lacunas altas:**
- Comuns: vão e posição, reveal e fechamento da parede, alizar, moldura, vidro, bandeira, exibição em planta, nível de detalhe, quadro e IFC.
- Só de porta: estilos de folha (lisa, almofadada, vidro, veneziana, macho-fêmea), soleira, folga inferior (7, 17 ou 27 mm por tipo de piso),
  ferragens (maçaneta com altura 0,80 a 1,10 m e posição, dobradiças, fechadura), rebate, luz livre.
- Só de janela: divisões do caixilho, tipo de abertura por folha, tipo e composição do vidro, peitoril e tábua interna, persiana e tela, ventilação.
- Lacunas de prioridade alta: referência folha × vão (no Brasil "80×210" é a folha e o vão é 88×215, NBR 15930-2); reveal com âncora face/núcleo;
  soleira e folga inferior; estilos de folha brasileiros e ferragens com altura e posição; tipo de abertura misturado na mesma janela;
  tábua interna e peitoril detalhado; quadro de esquadrias com folha, vão, material, ferragens e sentido; exibição em planta com mais modos.
- Fora desta rodada: janela de canto, claraboia, modo de colocação em série, hospedagem em telhado.

**Personalização proposta:** tipo × instância (já existe), biblioteca do usuário (duplicar, exportar e importar tipos: feito no E3c),
convenções do projeto (linha de abertura e padrões), e propriedades livres só para tabela e IFC (sem efeito na geometria, para manter o schema fechado).

**Teste de mescla da v3 (feito):** a v3 mescla sem conflito; 105 testes vermelhos (84 goldens, ~15 contagens de peças por mudança intencional, 3
que fixavam a regra antiga do batente); a BRD tem 1 conflito, lint vermelho e arquivos acima de 420 linhas: fica arquivada.
