# Instale e configure o JobRelay com um assistente

Para começar, copie o [prompt de instalação do README](../README.md#instale-com-um-prompt) no Claude Code ou no Codex. Ele autoriza a checagem periódica de releases definida em [ATUALIZAR.md](../ATUALIZAR.md#confira-releases-a-cada-três-dias-pelo-assistente), separada da autonomia para buscar vagas e candidatar. O assistente deve usar esse contrato ao criar a tarefa, consultar o que já existe para não duplicar e confirmar a próxima execução. Sem agendador disponível, informa a pendência.

## Pelo terminal

Este caminho é opcional. Você precisa de Node.js 20 ou mais recente, Python 3 e Git. O assistente pode verificar e ajudar a preparar o ambiente antes da instalação.

```bash
git clone https://github.com/caarloshq/jobrelay.git jobrelay
cd jobrelay/vagas
npm run setup
```

A instalação verifica o ambiente e abre o formulário no navegador. Se aparecer um erro, copie a mensagem para o assistente antes de continuar. As dependências e os diagnósticos estão no [guia técnico](configuracao-tecnica.md).

## Conclua a configuração com o assistente

Você deve ler, preencher e confirmar o formulário pessoalmente. A IA deve aguardar e não pode automatizar nem simular essa etapa. A exigência também vale para instalações existentes sem registro humano. O formulário local abre com `cd vagas && npm start`. Ele grava respostas e arquivos nesta instalação. Na tela final, copie a instrução específica das escolhas feitas e envie ao assistente. Se escolher Notion, informe o ID da database no formulário e conecte o Notion na ferramenta do assistente. A escolha do Chrome apenas pede a configuração posterior de candidaturas assistidas; ela não autoriza o envio de formulários.

Se ativar a autonomia, a instrução final pede ao **agendador nativo do assistente** uma tarefa a cada 4 horas, usando `vagas/RODADA-DIARIA.md` como fonte do processo e limitando a Apify a uma execução por dia. O Node não cria agendamento. A tarefa depende da disponibilidade do computador, do assistente e das conexões. Confirme que ela foi criada e confira o próximo horário mostrado pelo assistente.

Sem autonomia, execute `cd vagas && npm run rodada` quando quiser. Sem token da Apify, a busca continua nas outras fontes.

## Conecte o navegador somente se for usar candidaturas

No Claude Code, siga a [configuração oficial da extensão Claude no Chrome](https://code.claude.com/docs/en/chrome) e confira a conexão com `/chrome`. No Codex desktop, siga a [configuração oficial do navegador](https://learn.chatgpt.com/docs/chrome-extension) nas configurações de uso do computador; instale a extensão indicada pelo aplicativo e selecione o navegador na conversa. Disponibilidade depende da versão e das permissões da ferramenta. Não confunda a extensão do editor de código com a conexão do navegador, nem prometa essa conexão no Codex CLI ou na extensão de IDE.

Use o perfil do navegador onde a pessoa fez login. Quando uma etapa exigir LinkedIn ou outro portal, peça que a pessoa faça o login diretamente no site. Nunca peça senha ou código de autenticação no chat. Confira se o agente consegue ler a página autorizada antes de preencher qualquer campo. A conexão não concede autorização de envio. Sem ela, preserve a fila e continue com os materiais que puder preparar sem navegador.
