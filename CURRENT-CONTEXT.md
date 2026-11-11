# Contexto atual: JobRelay

> Última atualização: 2026-11-09

## Coleta e aplicação são independentes

`coleta/README.md` busca e avalia vagas. `aplicacao/README.md` usa a fila existente sem coletar. O ciclo completo continua em `vagas/RODADA-DIARIA.md`, com subagentes e controles preservados.

Respostas e Perfil são Markdown editáveis, com pendências na primeira seção. Respostas preenchidas é histórico literal separado. Migração explícita preserva dados e opt-in de instalações existentes; o público mantém modelos neutros e histórico vazio.

## Preferência das respostas

Markdown está sempre presente e é o padrão. Onboarding pergunta somente local ou local + Notion, separadamente do quadro. O agente atualiza e compara o conteúdo remoto; os comandos Node registram apenas configuração, hashes e pendências. A conferência global deve cobrir ambos os Markdown antes de encerrar uma chave específica.

## Verificação e limites

A revisão encontrou e levou à correção de truncamento de fontes, chaves JSON duplicadas, importação parcial e confirmação de hash além do alcance conferido. Suíte integrada 468/468 e checker público executados; a publicação integra também a revisão de escrita recebida de outra sessão. Nenhuma nova release, automação, coleta ou candidatura pertence a esta mudança.

## Fontes

[Spec da estrutura](specs/concluidas/004-estrutura-coleta-aplicacao.md), [aplicação](aplicacao/README.md) e [revisão de escrita](Skills/review-escrita/SKILL.md).

## O onboarding público exige preenchimento humano

A regra pública em `AGENTS.md` exige preenchimento e confirmação humanos do HTML, para instalações novas e existentes sem registro. As entradas de coleta e candidatura e a conclusão da configuração recusam ausência do registro. A frase de recusa pedida pelo mantenedor fica na regra canônica. A revisão corrigiu o carregamento de módulos antes da atualização e a navegação durante gravação. A validação usa fixtures isoladas; configurações preenchidas na prévia ficam fora do commit. Sem push ou release nesta rodada. O registro não é prova de identidade contra alteração do código local.
