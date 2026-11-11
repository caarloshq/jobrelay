---
name: apply-jobs
description: Conduzir candidaturas da fila existente do JobRelay. Use quando a pessoa pedir para aplicar às vagas ou continuar candidaturas; retoma o estado e o objetivo sem iniciar coleta.
---

# Aplicar às vagas da fila

Antes de operar, cumpra a [regra de onboarding humano obrigatório](../../AGENTS.md#o-formulário-html-é-obrigatório-e-pertence-ao-humano). Rode `cd vagas && npm run onboarding`; sem registro humano, aguarde a pessoa concluir o HTML. Não preencha nem contorne por ela.

O procedimento e seus critérios de encerramento vivem em
[Aplicação](../../aplicacao/README.md#objetivo-e-encerramento-da-fila). Leia essa
seção antes de começar: ela define o objetivo, a cobertura da fila por
prioridade, a meta diária configurada, a preservação das pendências no Chrome
e as perguntas ao final do trabalho independente.

Use [Respostas](../../aplicacao/RESPOSTAS.md) e
[Perfil](../../aplicacao/PERFIL.md) como fontes humanas; registre o preenchimento
efetivo pelo procedimento da Aplicação. A [revisão de escrita](../review-escrita/SKILL.md)
e a revisão independente valem antes do uso. Currículos passam por
[adapt-resume](../adapt-resume/SKILL.md).

O [runbook](../../vagas/RODADA-DIARIA.md) coordena o ciclo completo e a
[operação multiagente](../../vagas/OPERACAO-MULTIAGENTE.md) distribui o
trabalho. Retome a operação existente e suas abas; esta skill não concede nova
autorização de envio, coleta ou uso de dados.
