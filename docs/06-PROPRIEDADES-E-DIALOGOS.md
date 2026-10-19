# 06 · Propriedades e diálogos

Objetivo: configurar qualquer elemento sem listas intermináveis. A organização segue o **escopo da decisão**
(quem é afetado quando o valor muda). Cada parâmetro existe em **um único lugar**.

> Base: modelo de paleta de propriedades + propriedades de tipo + editor de camadas + navegador de materiais do Revit.
> Os detalhes de cada passo ainda devem ser confirmados em [05](05-REFERENCIA-REVIT-ARCHICAD.md) antes da implementação.

## 1. Os escopos

| Escopo | Pergunta | Lugar |
|---|---|---|
| Ferramenta | O que vou criar agora? | Barra de opções |
| Instância | O que é este elemento específico? | Painel de propriedades |
| Tipo | Como é este tipo em todo o projeto? | Diálogo do tipo |
| Camada | De que é feita cada camada? | Editor de camadas (dentro do diálogo do tipo) |
| Material | Como o material se comporta e aparece? | Navegador de materiais |
| Vista | Como esta vista mostra o modelo? | Propriedades da vista |
| Projeto | Padrões gerais (unidades, níveis, fases) | Configurações do projeto |

Profundidade máxima: ferramenta → painel → tipo → material. **Quatro níveis, nunca cinco.**

## 2. Barra de opções (ao criar)

No máximo ~5 campos, sem diálogo antes de desenhar.

| Ferramenta | Campos |
|---|---|
| Parede | tipo · linha de localização · altura/até nível · encadear · raio (arco) |
| Piso | tipo · nível · deslocamento · método (ambiente / faces de parede / croqui) |
| Laje | tipo · nível · deslocamento · método |
| Telhado | tipo · beiral padrão · inclinação padrão · "define inclinação" por lado |
| Porta/Janela | tipo · marcar ao inserir · inverter (Tab) |

## 3. Painel de propriedades

Dois blocos fixos.

1. **Seletor de tipo** (topo): lista de tipos da família, favoritos e recentes, botão "Editar tipo".
2. **Parâmetros de instância**, em grupos recolhíveis. Parâmetros do tipo aparecem só como resumo em leitura,
   com link para editar o tipo.

Sem seleção: mostra as propriedades da **vista** ativa. Várias seleções: só campos comuns; diferentes = "variados".
Busca de parâmetros aparece quando passa de ~15 campos.

## 4. Diálogo do tipo

```
┌ Propriedades do tipo · "Alvenaria 14 + reboco" ───────────────┐
│ [Duplicar] [Renomear] [Excluir]            usado em 23 paredes│
│ Abas:  Estrutura | Gráficos | Identidade                      │
│                                                                │
│ ┌ Camadas ─────────────────────────┐ ┌ Seção ao vivo ─┐        │
│ │ # função   material   esp. envolve│ │  externo        │        │
│ │ 1 acab. 1  Pintura    0,1   ☐     │ │  ▒▒ ░░░░░░ ▒▒   │        │
│ │ 2 subs.    Reboco     2,0   ☑     │ │  interno        │        │
│ │ 3 estrut.  Bloco 14   14,0  ☐     │ └─────────────────┘        │
│ │ 4 subs.    Reboco     2,0   ☑     │                            │
│ │ [Inserir][Remover][Subir][Descer] │  espessura total: 18,1 cm │
│ └───────────────────────────────────┘                            │
│ Retorno: nas extremidades ☐  nos vãos ☑                        │
│                                         [Cancelar]  [OK]        │
└────────────────────────────────────────────────────────────────┘
```

- **Estrutura**: tabela de camadas + seção ao vivo + espessura total + opções de retorno.
- **Gráficos**: hachura de corte, peso de linha, cor por categoria.
- **Identidade**: nome, descrição, código, fabricante, custo.
- Alterar o tipo afeta **todas** as instâncias; o diálogo mostra quantas.
- "Duplicar" é o caminho padrão para variações. Nunca configurar camadas por instância.

## 5. Editor de camadas

Linha com 4 colunas visíveis: **função · material · espessura · envolve**. Avançado atrás de "mais" por linha
(prioridade de junção substituída, camada de espessura variável). Marca de **limite do núcleo** entre as camadas.
Soma de espessuras e validação em linha (espessura 0 só para membrana).

## 6. Navegador de materiais

Único e reutilizável: abre de qualquer campo "material" (camada, piso, telhado, componente).

- Esquerda: bibliotecas (projeto, usuário), busca, pastas.
- Direita, abas do material: **Aparência** (cor, textura, brilho, escala) · **Gráficos** (hachura/cor de corte e de
  superfície) · **Físico** (densidade, custo, unidade de quantitativo).
- Alterar um material avisa quantos elementos o usam. "Duplicar" cria variação sem afetar o original.

## 7. Parâmetros por elemento (classificação)

### Parede
| Escopo | Parâmetros |
|---|---|
| Barra de opções | tipo, linha de localização, altura/até nível, encadear, raio |
| Instância | nível base, deslocamento da base, restrição de topo, deslocamento do topo, linha de localização, inversão de lado, comprimento¹, área¹, volume¹, marca, comentários, fase |
| Tipo | camadas, núcleo, retorno nas extremidades/vãos, hachura de corte, nome, código, custo |
| Camada | função, material, espessura, envolve, prioridade (avançado) |
| Material | aparência, gráficos, físico |

### Piso
| Escopo | Parâmetros |
|---|---|
| Barra de opções | tipo, nível, deslocamento, método de contorno |
| Instância | nível, deslocamento, inclinação/ponto de queda, permeável, ambiente associado, área¹, perímetro¹, fase, marca |
| Tipo | camadas (contrapiso, argamassa, revestimento), hachura, nome, código |
| Camada/Material | como em parede |

### Laje (estrutural)
| Escopo | Parâmetros |
|---|---|
| Instância | nível, deslocamento, direção do vão, aberturas (shafts), borda, área¹, volume¹, fase |
| Tipo | camadas estruturais e capas, espessura estrutural, hachura |

### Telhado
| Escopo | Parâmetros |
|---|---|
| Barra de opções | tipo, beiral padrão, inclinação padrão |
| Instância | nível base, deslocamento (*plate offset*), por lado: define inclinação · inclinação · beiral; vazios, platibanda, área¹ |
| Tipo | camadas (estrutura, ripamento, telha), hachura, nome, código |

### Porta e janela
| Escopo | Parâmetros |
|---|---|
| Instância | parede anfitriã, deslocamento ao longo da parede, peitoril, lado de abertura, inversão, marca |
| Tipo | largura, altura, folhas, material, retorno no vão (*wall closure*), símbolo 2D |

¹ somente leitura (calculado).

## 8. Regras

1. Um parâmetro, um lugar.
2. Divulgação progressiva: básico visível, avançado recolhido.
3. Modal só para editar tipo e material; nunca antes de desenhar.
4. Mesmo padrão em todo elemento (seletor de tipo → painel → diálogo do tipo → material).
5. Unidade sempre visível; campo numérico aceita expressão (`3,50+0,15`).
6. Dica de contexto em cada campo; mensagem clara quando o valor for rejeitado.
7. Favoritos e recentes no seletor de tipo.
8. Pintura de uma face é **ferramenta** (aplica material à superfície), não parâmetro de camada.
9. Parede diferente em um trecho = novo tipo (duplicar) ou dividir a parede.
10. Todo novo parâmetro precisa declarar o escopo na revisão; sem escopo, não entra.

## 9. Estados e validação

- Mostrar valor herdado do tipo com ícone de cadeado (somente leitura).
- Campos obrigatórios marcados; erro em linha, sem bloquear o resto do diálogo.
- Desfazer vale para edições de tipo e material, como qualquer comando.
- Pré-visualização em tempo real (seção, textura) sem aplicar até clicar OK.
