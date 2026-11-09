# Coleta e aplicação têm entradas independentes

**Data:** 2026-11-09. Implementação e publicação autorizadas pelo mantenedor.

## Decisões

- Coleta busca e avalia vagas; aplicação retoma a fila sem disparar coleta. Ciclo completo e subagentes preservados.
- Markdown existe sempre e é o padrão. Onboarding pergunta somente local ou local + Notion para respostas, separadamente da escolha do quadro. No modo combinado, o agente atualiza e compara os dois; falha conserva pendência.
- Fontes editáveis: `aplicacao/RESPOSTAS.md` e `PERFIL.md`, com pendências na primeira seção. JSON é projeção técnica.
- Histórico literal: `aplicacao/RESPOSTAS-PREENCHIDAS.md`. Migração explícita preserva bytes e deixa ponteiro; rascunho e envio confirmado são distintos.
- Instalação antiga importa somente modelos intocados ou ausentes, sem substituir conteúdo editado, opt-in ou configuração pessoal.

## Prova e revisão

464 testes passaram com TMPDIR dentro do projeto. Checker público validou os modelos neutros e histórico vazio; fontes e diff-check passaram. Revisão independente encontrou e levou à correção de importação parcial sem recuperação e confirmação de hash fora do alcance conferido. O fluxo global de configuração exige comparação dos dois Markdown antes de confirmar uma chave individual. Nenhum serviço MCP, navegador ou candidatura foi executado pelos novos comandos Node.

## Limites

Notion é sincronizado pelo agente pela conexão da instalação. Estado, hashes e pendências não provam uma edição remota por si. A aplicação visual da instalação é independente dos testes locais; não há nova release ou agendamento implícito nesta mudança.
