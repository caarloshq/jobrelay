---
name: aplicar
description: Retomar candidaturas da fila existente do JobRelay conforme as autorizações da instalação, sem iniciar coleta.
---

# Retomar candidaturas da fila

Antes de operar, cumpra a [regra de onboarding humano obrigatório](../../AGENTS.md#o-formulário-html-é-obrigatório-e-pertence-ao-humano). Rode `cd vagas && npm run onboarding`; sem registro humano, aguarde a pessoa concluir o HTML. Não preencha nem contorne por ela.

Leia as [instruções da instalação](../../AGENTS.md), carregue a skill [apply-jobs](../apply-jobs/SKILL.md) e siga o runbook de [aplicação](../../aplicacao/README.md). Esses procedimentos são os donos das fontes de respostas, revisão, cobertura da fila, registros e critérios de encerramento.

Reutilize a fila, o estado e as abas existentes. Preserve o opt-in e confira as autorizações antes de preencher ou enviar; invocar esta skill não altera a política local. Não inicie coleta, Apify ou rodada de busca. Para buscar vagas use [coletar](../coletar/SKILL.md); o [ciclo completo](../../vagas/RODADA-DIARIA.md) só entra quando esse escopo foi pedido.
