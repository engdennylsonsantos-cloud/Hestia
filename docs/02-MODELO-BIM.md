# 02 · Modelo BIM: como cada elemento funciona

> **Status de verificação:** este documento é o desenho geral. O comportamento exato de cada ferramenta só vale
> quando confirmado em [05-REFERENCIA-REVIT-ARCHICAD.md](05-REFERENCIA-REVIT-ARCHICAD.md), que traz a fonte de cada
> regra. Onde os dois divergirem, **o 05 vence**. Pontos já corrigidos pela pesquisa: prioridade de junção (função da
> camada no Revit, material no ArchiCAD), retorno no vão (depende do tipo de parede **e** da família da abertura, e não
> existe em piso/telhado), linha de localização com 6 opções, beiral e inclinação **por linha** no telhado.

Base comum, copiada do modelo mental do Revit/ArchiCAD: **categoria → família → tipo → instância**.

- **Tipo** define o que é comum (camadas, perfil, material). **Instância** define onde está e os parâmetros próprios.
- Trocar o tipo troca todas as instâncias. Duplicar o tipo cria variações sem tocar nas existentes.
- **Parâmetros**: tipo (compartilhado) e instância (individual). Tabelas e etiquetas leem parâmetros.
- **Nível**: referência vertical. Elementos guardam `nível + deslocamento`, nunca cota absoluta.
- **Hospedagem**: porta/janela têm `paredeAnfitria`; forro e piso têm `nível`. Mover o anfitrião move o hospedado.
- **Restrições**: topo preso a nível/telhado, alinhamento travado, cota que comanda.
- **Fase** e **opção de projeto** são atributos do elemento.

## 1. Parede composta

Tipo de parede = **lista ordenada de camadas**, da face externa para a interna.

```
Camada { função, material, espessura, envolveNoVão?, ladoDeCorte? }
funções: estrutura | substrato | isolamento | membrana | acabamento1 | acabamento2
```

Exemplo: `reboco 2 cm · bloco 14 cm · reboco 2 cm · pintura 0,1 cm`.

Instância de parede:
- caminho (linha, arco ou polilinha), nível base, deslocamento da base, topo (nível ou altura), deslocamento do topo;
- **linha de localização**: eixo, face externa, face interna, face externa/interna do núcleo (a parede é desenhada por ela);
- inversão (qual lado é o externo); aberturas hospedadas; perfil editado (opcional).

Junções (o motor decide, o usuário não desenha):
- Cada junção usa a **prioridade de função**: a camada de estrutura de uma parede atravessa a da outra;
  acabamentos ligam-se pelo lado correspondente.
- Em L, T e X o motor resolve contornos camada a camada. O usuário só escolhe, quando quiser, **"não unir"** ou
  **"juntar por topo/esquadria"**.
- Unir com outra de **tipo diferente** funciona pela mesma regra de prioridade.

Aberturas: cortam todas as camadas. Cada camada pode ter **retorno no vão** (reboco que entra na janela).

**Acabamento é camada.** Pintura/revestimento de uma face é a camada mais externa. Para pintar só parte,
usa-se **dividir face** + **pintar região** (particiona a superfície, não cria elemento novo). Revestimento por
altura (barra, azulejo até 1,50 m) é um **perfil de camada** no tipo, com altura e topo definidos.

Edição de tipo: duplicar, adicionar camada, mover camada, trocar material, espessura total calculada.
Pré-visualização da seção em tempo real no editor de tipo.

Quantitativos: por camada (área, volume, comprimento), agrupados por material.

## 2. Piso (acabamento de piso, por ambiente)

Tipo de piso = **lista de camadas**, como parede (contrapiso, argamassa, revestimento). Instância: contorno,
nível, deslocamento, inclinação opcional (ponto de queda/ralo).

Formas de definir o contorno:
1. **Selecionar ambiente** (contorno vem do ambiente).
2. **Selecionar faces de parede** que fecham o circuito.
3. **Croqui** livre (polilinha, retângulo, arco).

Propriedades: tipo, nível, deslocamento, **permeável** (para zoneamento), ambiente associado, fase, inclinação.
Furos automáticos para abertura de escada e poço. Edição de forma: arrastar vértices e lados.

## 3. Laje (estrutural)

Mesmo modelo de camadas (estrutura + capas), com **direção da armação** e **espessura estrutural** separadas.
Contorno por croqui ou paredes. Abertura (shaft) como recorte hospedado. Apoia em paredes/vigas.
Bordas com perfil (platibanda, pingadeira) como elemento hospedado depois.

## 4. Telhado

Duas formas, como no Revit:
- **Por contorno (footprint):** polilinha com **inclinação por lado** e beiral por lado. É o caminho principal.
- **Por extrusão:** perfil extrudado, para formas especiais.

Tipo de telhado = camadas (estrutura, ripamento, telha). Instância: contorno, nível, deslocamento, inclinação por
lado, beiral, **platibanda/tabeira**, águas furtadas (recorte), vazios.

Regras: paredes **anexam o topo ao telhado** (a altura resolvida é derivada, nunca gravada). Cumeeira, espigão e rincão
são calculados pelo motor, não desenhados. Tesoura/caibro/ripa gerados da camada de estrutura quando houver.

## 5. Aberturas: porta e janela

Família com tipo (largura, altura, peitoril, folhas, material) e instância hospedada na parede, com offset ao longo
da parede e inversão de lado de abertura. Símbolo 2D (arco de giro) vem da família. Corte nas camadas via motor.
Existe também **abertura pura** (vão sem elemento) e **vão por croqui** (não retangular).

## 6. Escada

Por **corrimão/trajetória** (patamares, degraus iguais) e por **croqui** (limites, espelhos). Tipo define piso,
espelho, largura mínima, corrimão. Regra de Blondel como aviso, nunca bloqueio. Gera abertura na laje do nível acima.

## 7. Pilar, viga, sapata

Elementos estruturais com perfil retangular/circular, nível base e topo. "Lançar estrutura" lê as paredes e propõe
um esqueleto — é pré-lançamento, não dimensionamento.

## 8. Ambiente (room)

Criado ao **fechar um circuito** de paredes ou por clique dentro dele. Mantém nome, número, área, perímetro,
acabamentos padrão (piso, forro, rodapé, parede) que geram os elementos derivados. É a base de quadros de áreas
e zoneamento.

## 9. Forro, guarda-corpo, cortina de vidro

Forro: por ambiente, com altura e tipo (camadas). Guarda-corpo: por trajetória com baluste/montante. Cortina de vidro:
grade de painéis e montantes sobre uma linha.

## 10. Lote e zoneamento (módulo opcional)

Lote como camada com divisas classificadas, recuos por divisa, TO/CA/permeabilidade calculados da envoltória.
Catálogo de zoneamento do escritório, com cópia (snapshot) no projeto. **Só avisa, nunca bloqueia.**

## 11. Cotas, texto, anotações

Cota associativa (segue o elemento), cota automática de parede/abertura, nível/cota de piso, etiquetas que leem parâmetros.
Anotações pertencem à vista, não ao modelo.
