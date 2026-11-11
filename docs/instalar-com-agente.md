# Instale e configure o JobRelay com um assistente

Para começar, copie o [prompt de instalação do README](../README.md#instale-com-um-prompt) no Claude Code ou no Codex. Ele autoriza a checagem periódica de releases definida em [ATUALIZAR.md](../ATUALIZAR.md#confira-releases-a-cada-três-dias-pelo-assistente), separada da autonomia para buscar vagas e candidatar. O assistente deve usar esse contrato ao criar a tarefa, consultar o que já existe para não duplicar e confirmar a próxima execução. Sem agendador disponível, informa a pendência.

## Pelo terminal

Este caminho é opcional. Recomendamos Node.js 22.23.4 ou mais recente, Python 3 e Git para o pacote completo. O núcleo de coleta e o onboarding aceitam Node.js 20; o navegador assistido exige Node.js 22 e o quadro experimental Astro exige 22.23.4. O assistente pode verificar e ajudar a preparar o ambiente antes da instalação.

```bash
git clone https://github.com/caarloshq/jobrelay.git jobrelay
cd jobrelay/vagas
npm run setup
```

A instalação verifica o ambiente e abre o formulário no navegador. Se aparecer um erro, copie a mensagem para o assistente antes de continuar. As dependências e os diagnósticos estão no [guia técnico](configuracao-tecnica.md).

## Conclua a configuração com o assistente

Você deve ler, preencher e confirmar o formulário pessoalmente. A IA deve aguardar e não pode automatizar nem simular essa etapa. A exigência também vale para instalações existentes sem registro humano. O formulário local abre com `cd vagas && npm start`. Ele grava respostas e arquivos nesta instalação. Após Salvar e confirmar, a tela de sucesso oferece download e cópia das instruções específicas para enviar ao assistente. O resumo mostra somente as escolhas. Se escolher Notion, conecte sua conta na ferramenta do assistente. Ele cria a página Puxa Vagas e seu quadro a partir do bundle saneado em docs/modelo-notion/README.md, sem copiar dados do mantenedor; o formulário não pede ID ou link. A escolha do Chrome apenas pede a configuração posterior de candidaturas assistidas; ela não autoriza o envio de formulários.

Se ativar a autonomia, a instrução final pede ao **agendador nativo do assistente** uma tarefa a cada 4 horas, usando `vagas/RODADA-DIARIA.md` como fonte do processo e limitando a Apify a uma execução por dia. O Node não cria agendamento. A tarefa depende da disponibilidade do computador, do assistente e das conexões. Confirme que ela foi criada e confira o próximo horário mostrado pelo assistente.

Sem autonomia, execute `cd vagas && npm run rodada` quando quiser. Sem token da Apify, a busca continua nas outras fontes.

## Conecte o navegador somente se for usar candidaturas

Depois da confirmação humana do HTML, siga [o navegador isolado](navegador.md). O assistente abre o acesso humano à mesma sessão headless, explica para que serve e aguarda a pessoa concluir o login diretamente no LinkedIn. Para candidaturas Gupy, ofereça também esse acesso; sugira a opção LinkedIn somente quando o portal a apresentar.

Nunca peça senha, código ou cookies na conversa. O assistente retoma somente quando a pessoa disser que terminou e confere a página antes de continuar. Login não autoriza candidaturas por si só. Quem escolheu só mapear não precisa conectar o navegador para a coleta pública.
