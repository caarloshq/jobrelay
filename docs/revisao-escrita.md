# Revisar o texto que a pessoa vai ler

O JobRelay escreve resumos, lacunas, currículos adaptados e respostas de candidatura. Antes de publicar ou enviar qualquer um desses textos, siga [`Skills/review-escrita/SKILL.md`](../Skills/review-escrita/SKILL.md). A revisão compara o rascunho com o pedido, a voz aprovada e as fontes de cada fato.

Use o verificador como primeira passada:

```bash
cd vagas
npm run revisar:escrita -- caminho/para/rascunho.md
```

O comando lê arquivos locais, não consulta rede e não envia o texto. Saída 1 indica expressões para examinar; saída 0 indica apenas que esses padrões não apareceram; saída 2 é erro de uso ou leitura. Um achado pode ser citação legítima. O revisor decide pelo contexto e documenta a razão quando o mantém.

Para resumos e gaps, confira o anúncio oficial e a base de currículo antes de registrar a nota semântica. Para currículo, leia a cópia por vaga, extraia somente as frases autorais alteradas para um texto dentro de `builds/<empresa>/` e revise esse texto; não passe o JSON bruto ao script. A base continua sob `Skills/adapt-resume/SKILL.md`. Para respostas abertas, revise antes de sugerir, preencher ou enviar; confira que toda experiência e todo número pertencem à pessoa. Perguntas e opções do formulário permanecem literais. Dados, opinião pessoal ou consentimentos ausentes continuam pendentes.

A fonte de tom muda por instalação. Use materiais e exemplos aprovados pela pessoa em `Skills/adapt-resume/materiais-fonte/` ou uma orientação explícita da conversa; registre qual fonte guiou a revisão. Se não houver fonte, escreva de modo direto e neutro, sem atribuir uma voz particular. O banco `data/perguntas.json` guarda textos reutilizáveis com escopo; históricos de respostas efetivamente enviadas preservam o texto que saiu. Aprendizados de revisão corrigem o padrão futuro, nunca reconstroem nem substituem a resposta histórica.

O pacote é genérico: não contém perfil, currículo, respostas, métricas, credenciais ou exemplos de pessoas reais. `vagas/scripts/sincronizar-fontes.mjs` tem um manifesto restrito ao núcleo das fontes de coleta; ele não distribui esta skill editorial. Uma publicação do repositório precisa incluir os arquivos desta skill, o script, o teste e as referências no runbook e na skill de currículo.
