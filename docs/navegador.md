# Entre nos portais sem sair do navegador do JobRelay

O JobRelay usa agent-browser 0.42.0 em modo headless, com um perfil próprio desta instalação. Para o login humano, o painel local mostra e controla **a mesma sessão**. Não é preciso copiar cookies, usar o Chrome pessoal ou reiniciar o navegador para exibir uma janela.

## Antes de abrir

O comando requer Node.js 22 ou superior, a dependência local fixada pelo projeto e Chrome ou Chromium instalado. Instale as dependências da instalação com `npm ci` dentro de `vagas/`. O comando não baixa um navegador nem instala dependências globais. Confira:

```sh
cd vagas
npm run navegador -- diagnostico
```

Se o diagnóstico não encontrar o Chrome, configure o caminho absoluto em `vagas/config/navegador.json`, campo `executavelChrome`, ou na variável `JOBRELAY_CHROME_EXECUTAVEL`. O diagnóstico confere versões e caminhos; não comprova autenticação em nenhum portal.

## A pessoa faz o login, o assistente aguarda

Primeiro, a pessoa preenche e confirma o onboarding HTML. O comando de login recusa uma instalação sem esse registro humano. Não use o navegador para preencher o onboarding nem fabricar seu registro.

Depois da confirmação, o assistente explica que LinkedIn e Gupy usam sessões próprias do navegador do JobRelay. A conexão permite ler páginas autenticadas quando o portal a aceita; entrar na conta não inicia uma candidatura.

1. O assistente executa:

   ```sh
   npm run navegador -- login linkedin
   ```

2. O comando abre uma **nova aba**, preserva outras abas e retorna `urlAcessoHumano`. Abra esse endereço no navegador comum. O padrão é [http://localhost:4849](http://localhost:4849). No painel, escolha a sessão **jobrelay** e use a página exibida para entrar no LinkedIn.
3. Faça o login diretamente no portal. Senha, código e verificações ficam com a pessoa, fora do chat. O assistente deve aguardar, sem capturar a tela, ler campos ou controlar a sessão durante esse acesso.
4. Avise no chat quando terminar. Somente depois desse aviso, o assistente executa:

   ```sh
   npm run navegador -- retomar --confirmado-pela-pessoa
   ```

5. O assistente confere a página retornada. A retomada não declara que o login deu certo: uma tela de login, erro ou desafio ainda visível continua pendente.

Se a pessoa quiser candidaturas na Gupy, o assistente repete os passos com:

```sh
npm run navegador -- login gupy
```

Sugira usar a mesma identidade profissional do LinkedIn. Use “Entrar com LinkedIn” na Gupy **somente quando essa opção estiver disponível na página**. Se não estiver, a pessoa escolhe um dos métodos oferecidos pelo portal. Não prometa que todos os portais tenham login pelo LinkedIn.

O acesso pelo painel continua headless. O fluxo não alterna para modo visível, fecha rascunhos nem usa o perfil em dois processos. O retorno ao assistente mantém a mesma sessão. Depois de retomar, a pessoa deve parar de interagir no painel enquanto o assistente estiver usando o navegador.

## Enquanto a pessoa estiver no controle

O comando conserva um registro local de posse humana e recusa navegação, snapshot, preenchimento e fechamento pelo assistente até a retomada explícita. O diagnóstico permanece disponível, sem acesso ao conteúdo da página. Uma trava de comando impede duas chamadas simultâneas; timeout não transfere a posse.

Se o painel falhar ao iniciar, a sessão continua reservada para a pessoa. Confira a porta configurada e a saída do comando; não apague o perfil, reinicie o navegador ou tome a posse para contornar a falha. A porta pode ser alterada em `portaAcessoHumano` antes de uma nova sessão; não encerre uma sessão com rascunhos para trocar a porta.

O painel e o stream ficam em loopback, acessíveis no próprio computador. O comando não permite configurar origens externas, proxy, CDP ou serviço remoto. Não exponha essas portas por túnel ou encaminhamento. Outros processos do mesmo computador ainda podem acessar os serviços locais.

## Operação depois do acesso

```sh
npm run navegador -- tab list
npm run navegador -- open 'https://pagina-oficial-da-vaga/'
npm run navegador -- snapshot -i
npm run navegador -- campos
npm run navegador -- screenshot conferencia-01.png --full
```

Use referências do snapshot atual. A troca de página, um upload e a mudança dos controles exigem nova observação. A entrada por stdin está disponível para dados que não devem ficar no histórico do shell:

```text
npm run navegador -- --stdin-json
```

O comando recebe um array JSON pela entrada padrão, por exemplo `["fill", "#nome", "Pessoa Fictícia"]`. Nunca coloque senha ou código em comandos ou nessa entrada: o login pertence à pessoa no painel. O wrapper não registra os argumentos em mensagens de erro.

O modo `mapear` continua impedindo ações de escrita; `chrome_assistido` é o nome legado da autorização assistida, independente do transporte. Perfil aprovado, respostas revisadas, currículo pela skill, conferência dos anexos, consentimentos e recibo do portal continuam exigidos pelo procedimento de aplicação.

O runtime não expõe JavaScript arbitrário, cookies, troca de perfil, conexão externa ou flags de evasão. `campos` é uma leitura fixa de metadados, sem exportar os valores pessoais. Capturas ficam em `vagas/data/navegador/capturas/` e exigem nome novo, sem sobrescrever evidência anterior. O perfil e os demais dados do runtime ficam em `vagas/data/navegador/`, ignorados pelo Git. Não publique esses arquivos.

## O que foi comprovado nesta integração

Os testes offline exercitam o planejamento de comandos com uma CLI simulada, isolamento, posse humana, falhas e recusa de opções. Nenhum login real, candidatura, instalação global ou download de Chrome faz parte desses testes. O aceite de LinkedIn/Gupy e o acesso interativo no computador da pessoa precisam de conferência real após a instalação.

A sessão não expira por inatividade. Isso não garante restaurar rascunhos depois de crash ou reinício. Preserve checkpoints de URL, aba, etapa e próxima ação, sem registrar credenciais.

## Fontes do transporte

Conferidas em 11 de Novembro de 2026: o pacote npm **0.42.0** inclui os comandos de dashboard e a referência de stream interativo. As fontes oficiais da mesma tag mostram o [painel em loopback](https://github.com/vercel-labs/agent-browser/blob/v0.42.0/cli/src/native/stream/dashboard.rs), o [stream em 127.0.0.1](https://github.com/vercel-labs/agent-browser/blob/v0.42.0/cli/src/native/stream/mod.rs) e os [eventos de teclado e mouse do painel](https://github.com/vercel-labs/agent-browser/blob/v0.42.0/packages/dashboard/src/components/viewport.tsx). Consulte também a [documentação de streaming](https://agent-browser.dev/streaming), o [dashboard](https://agent-browser.dev/dashboard) e a [referência de comandos](https://agent-browser.dev/commands). O [guia oficial da Gupy](https://www.gupy.io/blog-do-emprego/curriculo-gupy) aponta o acesso de candidatos em `login.gupy.io/candidate`; os métodos de login devem ser conferidos na tela atual.
