# Testes e2e de navegador

## Regressão visual (`npm run test:visual`)

Roda `escadas.mjs`, `vista-planta.mjs` e `escadas-closeup.mjs` em sequência. Cada captura determinística é comparada pixel a pixel com `tests/e2e/baseline/<nome>.png` (helper `visual.mjs`). A captura passa quando no máximo 0,5% dos pixels diferem; um pixel conta como diferente quando algum canal se afasta mais de 10% do valor da baseline.

- Antes: `npm run build` (os scripts usam `apps/web/dist/index.html`). O script npm não faz build.
- Falha: a mensagem indica a fração de pixels diferentes. Em `$SHOTS` (padrão `test-results/<roteiro>`) ficam `<nome>.actual.png` e `diff/<nome>.diff.png` (vermelho = diferente).
- Sem baseline: a falha diz `baseline ausente: rode com UPDATE_BASELINE=1`.

### Atualizar a baseline

Só quando a mudança visual for intencional. Depois do build:

```
UPDATE_BASELINE=1 npm run test:visual
```

Os três scripts gravam as baselines e passam. Revise os PNG alterados antes de commitar. Os nomes são exclusivos: não reutilize o nome de uma captura de outro roteiro.

### Capturas que não são comparadas

Ficam só como imagem para inspeção, porque mostram barra de status, relógio ou painéis que variam: `croqui-andamento`, `croqui-erro`, `propriedades-escada`, `tabela-escadas` e, em `escadas-closeup.mjs`, os close-ups `c`, `e` e `g`, e as capturas que vêm depois da troca para o tema escuro.

### Limitações

- A baseline depende do Chromium do sistema (`/opt/pw-browsers`) e do SwiftShader (WebGL por software). Outro ambiente pode gerar outros pixels.
- O helper decodifica PNG de 8 bits sem entrelaçamento, o formato que o Chromium grava.
