# Configure sua busca de vagas

Você vai informar o que procura e adicionar seu currículo em um formulário no navegador. Depois, o Claude Code ou o Codex ajuda a preparar seu currículo base e concluir a configuração.

Tenha seu currículo em PDF ou DOCX e acesso a um desses assistentes. A captura assistida do LinkedIn é beta e opcional; se escolher testá-la, será obrigatório entrar no LinkedIn pelo painel do navegador antes de começar. Se preferir que o assistente faça a instalação e acompanhe a configuração desde o começo, use o [guia de instalação com agente](docs/instalar-com-agente.md).

## Abra o formulário

Se ainda não instalou o projeto, siga o [guia de instalação](docs/instalar-com-agente.md#pelo-terminal). Para retomar a configuração, abra o terminal na pasta `vagas` e execute:

```bash
npm start
```

Cada etapa salva suas respostas neste computador quando você continua. O formulário não envia suas respostas nem seus arquivos a um servidor externo. Você pode fechar a página e voltar depois.

O preenchimento do HTML é obrigatório e deve ser feito por você, inclusive em instalações antigas sem esse registro. Leia e preencha os sete passos e confirme o resumo. A IA pode ajudar com a instalação e explicar campos; suas escolhas e a confirmação ficam com você. Reiniciar o servidor mantém os dados salvos, mas exige percorrer os passos novamente antes de confirmar.

## 1. Informe o cargo que procura

Preencha seu nome, o cargo desejado e o país onde mora. Use o nome de cargo que você costuma encontrar nos anúncios.

## 2. Escolha onde buscar

Selecione vagas no Brasil, no exterior ou nos dois mercados. Se escolher os dois, indique qual tem prioridade. Essa preferência orienta a busca e o idioma do currículo que o assistente preparará primeiro.

As fontes internacionais atuais procuram oportunidades que aceitam candidaturas da América Latina. Se você mora fora dessa região, informe isso ao assistente antes da primeira busca.

## 3. Adicione seu currículo

Envie seu currículo mais recente em PDF ou DOCX, com até 15 MB. Ele é obrigatório. LinkedIn e material adicional são opcionais. O adicional também aceita TXT em UTF-8.

O assistente usará esses materiais como referência e perguntará o que precisar esclarecer. Você poderá conferir o currículo preparado antes de usá-lo.

## 4. Escolha os níveis de vaga

Selecione os níveis que aceita. O cargo informado no início orienta os termos de busca; você não precisa repeti-lo. Nesta versão, estágio e trainee ficam fora da seleção.

## 5. Defina salário e modelo de trabalho

Informe o menor valor mensal que você considera, em reais, e sua remuneração atual. O primeiro valor ajuda a filtrar anúncios com salário informado; o segundo participa da comparação de vagas de níveis diferentes.

Escolha se aceita trabalho remoto, híbrido ou presencial. Para as duas últimas opções, informe a cidade. Anúncios sem salário podem continuar na seleção para você avaliar.

## 6. Escolha quadro, candidaturas e autonomia

Escolha o **quadro local** ou uma **database do Notion** como fonte do estado das vagas. O quadro local é o padrão. Para Notion, o assistente cria a página **Puxa Vagas** e seu quadro usando o [modelo local](docs/modelo-notion/README.md) na sua conexão. O modelo inclui um exemplo fictício, excluído das buscas e candidaturas, e não copia dados do mantenedor. Você não precisa informar ID ou link de database no formulário. Não envie credenciais no chat.

Em candidaturas, o padrão é **só mapear e avaliar**. Se escolher candidaturas com o assistente, o assistente ainda precisará revisar seu perfil, suas respostas e as autorizações necessárias. Após confirmar o onboarding, o assistente orienta o [acesso humano ao navegador isolado](docs/navegador.md). Você faz o login no LinkedIn; se quiser vagas da Gupy, também entra nela. Use “Entrar com LinkedIn” na Gupy se a página oferecer essa opção. Essa escolha não libera preenchimento ou envio. Em instalação nova, o campo `autorizado` começa em `false`. Reabrir o formulário não muda uma autorização já configurada; a revisão do perfil continua necessária.

As **fontes de respostas** têm uma escolha separada do quadro de vagas. O assistente perguntará se você quer guardar as respostas somente nos Markdown locais (padrão) ou também numa página sua do Notion. Na segunda opção, os Markdown continuam obrigatórios e o assistente atualiza e confere os dois lugares. A conexão Notion é configurada na ferramenta do assistente, sem token no chat. Divergência pendente bloqueia apenas a resposta ou campo afetado até a conferência. Para conferir a preferência local: `cd vagas && npm run fonte:respostas -- --estado`.

A rodada recorrente começa **desligada**. Se você a escolher, a tela de sucesso entregará as instruções ao assistente que crie uma tarefa no agendador nativo a cada 4 horas. A Apify deve executar no máximo uma vez por dia, mesmo que haja mais rodadas. O formulário grava a política local em `vagas/data/politica-autonomia.json`, mas não cria a tarefa. Ela depende de o computador e as conexões estarem disponíveis.

A opção **Verificar atualizações ao iniciar**, recomendada, tem um switch próprio. Quando ativada, consulta a versão estável antes de começar e pede sua confirmação antes de baixar e instalar, respeitando as proteções. Desligada, não consultam nem instalam releases nesse fluxo. A checagem agendada de releases é uma escolha separada.

Você pode escolher buscar vagas, trabalhar na fila existente ou fazer os dois em sequência. Com as duas frentes, o assistente conclui a busca, salva e confere seu quadro antes de iniciar candidaturas.

A opção **Testar captura do LinkedIn (beta)** vem desligada. As consultas usam seus cargos e sua profissão. O percurso leva 15 minutos em Vagas, 12 em Postagens e 3 no Feed, contando atividade observada. O login no LinkedIn é obrigatório para os três métodos: entre diretamente no painel local e avise quando terminar. O assistente confere a sessão e o filtro antes de iniciar. Sem login, a captura aguarda e as demais fontes continuam. O Feed depende da sua conta e não oferece filtro por cargo.

## 7. Inclua vagas do LinkedIn pela Apify, se quiser

Essa conexão usa a Apify, um serviço externo de coleta de vagas. Confira os custos na sua conta antes de usá-la. Sem essa conexão, a busca usa as outras fontes.

A tela mostra onde copiar a chave de acesso, chamada de token, e onde colá-la. Cole apenas no campo indicado, nunca na conversa com a IA. Você pode deixar o campo vazio e configurar depois.

## Termine a configuração com o assistente

Confira o resumo e clique em **Salvar e confirmar**. Na tela de sucesso, baixe o arquivo ou copie as instruções para o assistente que está aguardando. Abra a pasta do projeto no Claude Code ou no Codex e cole o texto em uma conversa.

O assistente vai:

- Ler seu material e esclarecer informações que faltarem.
- Preparar o currículo no idioma escolhido para você conferir.
- Ajustar a busca à sua profissão e verificar se a configuração está completa.
- Configurar a fonte de estado, a fonte de respostas e o modo de candidatura escolhidos, sem inferir consentimento.
- Se você ativou a autonomia, criar e confirmar no chat a tarefa recorrente de 4 horas no agendador nativo do assistente.
- Se você usou o prompt de instalação do README, configurar também a [checagem de releases](ATUALIZAR.md#confira-releases-a-cada-três-dias-pelo-assistente), independente da autonomia de candidaturas, e conferir sua criação na ferramenta.

Ao terminar o formulário, tudo está salvo neste computador. A configuração fica concluída depois que o assistente prepara o currículo e ajusta a busca. Aguarde essa confirmação antes de iniciar a primeira busca.

## Faça a primeira busca

Depois da confirmação, execute na pasta `vagas`:

```bash
npm run rodada
npm run quadro
```

No assistente, peça:

> Leia as vagas pendentes contra meu currículo e me ajude a avaliar as oportunidades.

O quadro mostra as vagas por fase. Abra uma para consultar o anúncio e a avaliação; mova-a conforme avançar na candidatura.

## Se precisar retomar ou corrigir

- **O formulário não abriu:** execute `npm start` na pasta `vagas`. Mantenha o terminal aberto enquanto preenche.
- **Quer mudar uma resposta:** volte à etapa correspondente e continue para salvar.
- **Já preencheu, mas ainda não vê vagas:** conclua a parte do assistente e execute a primeira busca.
- **Apareceram vagas de outra profissão:** peça ao assistente para revisar os termos de busca.
- **Deu erro:** copie a mensagem e diga ao assistente em qual etapa aconteceu. Não inclua tokens na mensagem.

Comandos de diagnóstico, campos de configuração e verificações para o agente estão no [guia técnico](docs/configuracao-tecnica.md).
