# Continuidade da coleta 2 e opt-in de candidatura

**Data:** 16 de Novembro de 2026  ·  **Escopo:** distribuição pública JobRelay 1.6.x  ·  **Estado:** concluída no recorte de implementação local; sem publicação.

## Propósito

Fechar a continuidade entre coleta e aplicação sem pedir uma segunda autorização para as vagas encontradas pela coleta 2. Esta nota passa a ser a fonte pública para esse comportamento. As specs privadas 015/016 não existem neste clone e não foram copiadas; nenhum dado, autorização ou configuração pessoal foi importado.

## Regra

1. A coleta 2 continua desligada por padrão e exige aceite explícito da pessoa para iniciar a janela assistida.
2. O aceite da coleta 2 também autoriza aplicar as novas vagas confirmadas daquele lote, sem uma segunda pergunta, desde que a aplicação esteja configurada nesta instalação.
3. A aplicação pública exige simultaneamente `local/data/politica-autonomia.json#modoCandidatura === "chrome_assistido"` e `local/config/perfil-candidatura.json#autorizado === true`. Os caminhos físicos pertencem a `local/`; aliases legados não criam outra base. O modo isolado, perfil isolado ou aceite da coleta 2 nunca substituem o outro controle.
4. Antes de iniciar ou retomar a passagem, reler os dois controles e confirmar que cada vaga está integrada, elegível e presente na fila atual. A revisão da candidatura e a confirmação por vaga mantêm o contrato existente.
5. Sem opt-in válido, concluir a rodada e manter as vagas novas visíveis na fila em `nao_percorrida`. Não abrir formulário, preencher ou transmitir candidatura. Quando a pessoa configurar a aplicação em uma rodada futura, a leitura confirmada da fila as recoloca como trabalho inicial, sem inferir candidatura enviada.
6. A autorização durável da passagem referencia o mesmo `aceiteRef` que iniciou a coleta 2 e só cobre vagas novas confirmadas por ela. Estado legado sem essa referência não ganha autorização inferida. Mensagens para recrutadores continuam sujeitas à revisão e confirmação individual já previstas nos runbooks.

## Critérios de aceite

- A ordem observável é aplicação principal, perguntas pendentes dessa etapa, pergunta da coleta 2, captura e resumo, e aplicação automática das novas elegíveis quando os dois controles estiverem ativos.
- A segunda pergunta sobre aplicar não aparece.
- Com modo `mapear` ou perfil não autorizado, as vagas permanecem na fila e comandos de candidatura para elas são recusados.
- Fila inicial existente também não bloqueia a pergunta da coleta 2 quando modo ou perfil deixam a aplicação inativa.
- Sem opt-in, a rodada fecha automaticamente depois do resumo, sem ação manual de adiamento; em uma rodada futura com opt-in, as vagas voltam à fila normal com status não percorrido.
- Retomada revalida controles e fila; nenhuma coleta ou candidatura é repetida apenas porque o processo reiniciou.
- A cópia pública conserva opt-ins desligados por padrão e não recebe credenciais, tokens, perfis preenchidos, Notion ou dados privados.

## Arquivos donos

- Sequência da rodada: [`docs/core/FLUXO-DA-RODADA.md`](../../core/FLUXO-DA-RODADA.md)
- Coordenação: [`docs/core/COORDENACAO-FRENTES.md`](../../core/COORDENACAO-FRENTES.md)
- Coleta 2: [`coleta/LINKEDIN-FEED.md`](../../coleta/LINKEDIN-FEED.md)
- Configuração: [`docs/configuracao-tecnica.md`](../../configuracao-tecnica.md)

## Limites desta entrega

A implementação local não prova login real, captura real do LinkedIn, candidatura enviada, nem manutenção de sessão em reinício. A distribuição não foi publicada.


## Conferência de 16 de Novembro de 2026

Revisão independente aprovou o recorte técnico para commit sem push. Testes focados de controle, coleta 2 e quadro: 61/61, zero falhas. Checagem pública: nenhum dado pessoal encontrado e todos os scripts resolvem. Contratos agora obtêm o runId real antes de persistir a decisão e antes da captura. Fixtures declaram explicitamente o opt-in sintético, sem alterar a configuração padrão da instalação. Operação real e publicação não foram executadas.

## Encerramento em 17 de Novembro de 2026

A revisão independente reconferiu os critérios no código e nos testes atuais e liberou o encerramento local. Os links e os caminhos físicos foram reconciliados após a migração de layout. Os limites de operação real e publicação acima permanecem.
