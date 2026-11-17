# Mensagens claras acompanham o fluxo

As mensagens humanas têm uma fonte executável: `core/src/mensagens-operacao.js`, pelo formatador `formatarMensagemOperacao(evento, contexto)`. Use o texto renderizado, sem criar uma tabela paralela de frases. O módulo apresenta evidências recebidas do chamador; não executa nem comprova ações por si.

## Emitir no momento correto

- Download e instalação: anunciar somente depois de conferir cada etapa. Instalação concluída encaminha para configurar o JobRelay.
- Onboarding: apresentar a configuração inicial, confirmar que os campos foram salvos e mostrar o resumo real. A pessoa precisa confirmar antes da operação; salvar não ativa essa confirmação.
- Coleta: anunciar início e usar `resumoColeta` no encerramento, com contagens reais do mesmo lote e gravação conferida. A mudança de linguagem dos envios não remove os números da coleta.
- Envios: anunciar a passagem pela fila, retomar pendências que possam avançar e seguir nas demais. Usar `resumoAplicacao` e o fechamento da rodada sem contagens ou tabelas de envios. A validação interna mantém os totais e os recibos; não transcrever esses números no chat por outra rota.
- Pendência pessoal: persistir o motivo antes de comunicar. Uma vaga bloqueada continua pendente e não impede o trabalho nas demais.
- Recebimento: anunciar inscrição recebida somente com prova real. Mencionar registro atualizado e aba fechada apenas quando cada ação foi conferida.
- Contatos: apresentar destinatário, contexto e cada rascunho no fechamento. Mensagens e e-mails dependem da autorização de envio.

## A atualização concluída inclui sua nota

Depois de conferir a versão e a identidade efetivamente instaladas, o layout e a preservação, apresentar a mensagem de conclusão e a nota integral da release correspondente em bloco de citação Markdown. O formatador exige nota, versão, pós-checagem confirmada e preservação; não busca uma nota fixa de outra versão nem transforma instalação de arquivos em conclusão.

A fonte deve estar ligada à release verificada. Não mostrar `DATA_PUBLICACAO` de um rascunho como data publicada. Se faltar nota ou a conferência falhar, informar a etapa pendente, sem inventar um sucesso. O atualizador público conserva seu resultado técnico em JSON; o assistente usa a mensagem humana verificada no chat.

Nomes de comandos, campos JSON e arquivos podem continuar usando os identificadores técnicos existentes. O padrão muda a comunicação com a pessoa, sem alterar métricas, autorizações ou o histórico efetivamente enviado.

## Usar os eventos nos pontos reais

O assistente usa `node scripts/mensagem-operacao.mjs <evento>` na pasta `core/`, passando o contexto como JSON pela entrada padrão. Copiar o texto renderizado para o chat somente depois de conferir a evidência indicada. Esta é uma etapa dos procedimentos, não um anúncio automático de ações ainda não executadas.

| Ponto do procedimento | Evento | Conferência antes de apresentar |
|---|---|---|
| Arquivo baixado e conferido | `download_concluido` | Download efetivamente presente |
| Instalação e verificações terminadas | `instalacao_concluida` | Instalação validada; não confundir com configuração humana |
| Abrir a configuração inicial | `onboarding_inicio` | Fluxo de configuração iniciado |
| Campos gravados, antes da confirmação | `configuracao_salva` | Gravação conferida; anexar o resumo real das escolhas |
| Pessoa confirmou o resumo | `configuracao_confirmada` | Confirmação humana registrada; não inferir pelo formulário salvo |
| Antes da primeira busca autorizada | `coleta_inicio` | Escopo da coleta autorizado |
| Antes de percorrer a fila autorizada | `envios_inicio` | Modo e autorização ativos; priorizar pendências que possam avançar |
| Bloqueio pessoal persistido | `pendencia_pessoal` ou `pendencia_video` | Pendência salva e próxima ação identificada |
| Recebimento observado por vaga | `envio_confirmado` | `recebimentoConfirmado`; `cargo` e `empresa` reais; registro e aba somente se conferidos |
| Final da passagem pela fila | `resumoAplicacao` / `resumoRodada` | Classificação e cobertura internas conferidas, sem publicar as contagens de envios |
| Rascunhos prontos no fechamento | `contatos_final` | Há textos reais com destinatário e contexto para autorização |
| Arquivos instalados, pós-checagem pendente | `update_pendente` | Não anunciar atualização concluída nesta etapa |
| Pós-checagem efetivamente concluída | `update_confirmado` | Versão verificada, dados preservados e nota integral ligada à release |

Os contextos e nomes técnicos seguem o módulo executável. Para o recebimento, `registroAtualizado` e `abaFechada` só recebem `true` após a conferência correspondente. Para a atualização, o assistente não preenche booleans de sucesso para contornar uma checagem que falhou. O encerramento de envios usa os formatadores da rodada, que mantêm as validações internas; não montar outro resumo com números.
