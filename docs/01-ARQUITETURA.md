# 01 · Arquitetura

## 1. Camadas e fronteiras

```
apps/web         casca React: layout, painéis, atalhos        (TypeScript)
packages/tools   ferramentas de interação, contrato único     (TypeScript)
packages/render  renderizadores 2D e 3D (WebGPU / WebGL2)     (TypeScript + WGSL/GLSL)
packages/model   dados do projeto, tipos, comandos, histórico (TypeScript)
packages/engine  regras BIM: junções, camadas, telhado, etc.  (Rust → WASM)
packages/geom    geometria robusta: booleanas, triangulação   (Rust → WASM)
packages/io      arquivo nativo, IFC, DXF, PDF                (TypeScript)
```

Dependências só descem: `apps → tools → model → engine → geom`. `render` lê `model`, nunca escreve.
Regra de lint impede importação contrária. `geom`, `engine` e `model` não conhecem DOM nem React.

## 2. GPU primeiro, CPU como fallback

| Tarefa | Onde roda | Observação |
|---|---|---|
| Desenho 3D | GPU (WebGPU, fallback WebGL2) | instanciamento por tipo de peça; materiais PBR simples |
| Desenho 2D (planta, corte, elevação) | GPU | linhas e preenchimentos como geometria instanciada, espessura em espaço de tela |
| Seleção por clique (picking) | GPU | buffer de IDs, leitura de 1 pixel |
| Oclusão em corte/elevação | GPU (compute) com contorno final em CPU | profundidade por vista; contorno exato vem do vetor |
| Sombras, ambient occlusion, luz solar | GPU | |
| Junção de paredes, camadas, aberturas | CPU (Rust/WASM, em worker) | decisões lógicas e precisão numérica |
| Booleanas, offset de polígono, triangulação | CPU (Rust/WASM, em worker) | exatidão importa mais que velocidade bruta |
| Quantitativos | CPU | lê o modelo resolvido |

Regra: **GPU desenha e consulta em massa; CPU decide a geometria.** Forçar decisão geométrica para a GPU
traz fragilidade numérica sem ganho.

Detecção na inicialização: `navigator.gpu` → WebGPU; senão WebGL2; senão modo reduzido (2D sem sombras, 3D simplificado).
O mesmo modelo alimenta todos os caminhos. Só `render` tem implementações paralelas.

## 3. Núcleo em Rust/WASM

- `geom`: polígonos com furos, booleanas (união, interseção, diferença), offset, triangulação, predicados robustos.
- `engine`: recebe o modelo mínimo (paredes, camadas, aberturas, níveis) e devolve a **geometria resolvida**
  (contornos por camada, junções, recortes, malhas).
- Comunicação por arrays tipados (`Float64Array`, `Uint32Array`), nunca por objetos aninhados.
- Roda em Web Worker. A interface nunca espera o cálculo.
- `cargo test` valida o núcleo sem navegador. Os mesmos casos viram testes dourados.
- Plano B: começar o núcleo em TypeScript atrás da mesma interface e migrar os pontos quentes para Rust.
  A fronteira (entrada mínima, saída resolvida) não muda.

## 4. Modelo de dados

- Cada elemento tem **ID estável** (UUID).
- Guarda só **decisões do usuário**: pontos, tipo, nível, deslocamentos, parâmetros.
- **Nada derivado é persistido**: altura final, contorno de junção, área, volume.
- Esquema com **versão**; cada mudança de esquema traz uma função de migração testada.
- Estrutura: `Projeto → Níveis, Tipos (famílias), Instâncias, Vistas, Pranchas, Materiais, Fases`.

## 5. Comandos e histórico

- Única forma de escrever no modelo: `executar(comando)`.
- Comando = dados serializáveis + `aplicar` + `reverter`. Isso entrega desfazer, refazer, log e, no futuro, colaboração.
- Transações: uma ação do usuário (arrastar) vira um comando composto, um único passo de desfazer.

## 6. Recálculo incremental

- Grafo de dependências entre elementos (parede ← abertura, piso ← parede, telhado ← nível).
- Alterar um elemento marca seus dependentes como sujos; o `engine` recalcula só eles.
- Resultado guardado em cache por (elemento, versão). Sem isso o desempenho cai com o tamanho do projeto.

## 7. Contrato de ferramenta

```ts
interface Ferramenta {
  iniciar(ctx): void
  moverCursor(pt, inferencia): Previa   // sempre mostra o que vai acontecer
  clicar(pt, inferencia): void
  digitar(valor): void                   // medida numérica a qualquer momento
  confirmar(): Comando | null            // devolve um comando, nunca altera o modelo
  cancelar(): void
}
```

Esc, Enter, Tab (alternar opção), entrada numérica, snap e pré-visualização são iguais em todas as ferramentas.

## 8. Motor de inferência

Função pura: `inferir(cursor, contexto) → candidatos[]` (extremidade, ponto médio, interseção, perpendicular,
paralelo, alinhamento, eixo, grade, guia temporária). Todas as ferramentas consomem o mesmo motor.

## 9. Regras de código (aplicadas no CI)

- TypeScript `strict`; typecheck sem erros; Rust com `clippy` sem avisos.
- Arquivos até ~400 linhas; lint de importação entre camadas.
- Testes de unidade no núcleo e nos comandos; testes dourados (projeto de entrada → áreas/volumes/contornos esperados);
  2–3 fluxos ponta a ponta com Playwright.
- Cada decisão estrutural vira um documento curto em `docs/decisoes/`.

## 10. Interoperabilidade

- Arquivo nativo `.hestia`: JSON versionado (zip com texturas depois).
- IFC desde cedo: parede → `IfcWall` + `IfcMaterialLayerSetUsage`; laje → `IfcSlab`; telhado → `IfcRoof`.
- DXF/PDF de pranchas. Importador do formato do Hestia 1.
