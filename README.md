# JobRelay

Busque vagas em vários sites, organize as oportunidades em um quadro e use seu assistente de IA para preparar as candidaturas.

**[Instalar com um prompt](#instale-com-um-prompt)** · **[Baixar a última versão](https://github.com/caarloshq/jobrelay/releases/latest/download/jobrelay.zip)** · [Ver todas as releases](https://github.com/caarloshq/jobrelay/releases)

## O que ele faz por você

- **Busca vagas** em diferentes fontes, de acordo com seu perfil e o que você procura.
- **Organiza as oportunidades** em um quadro no seu computador ou no Notion.
- **Adapta seu currículo** para cada vaga, usando sua experiência e seus materiais.
- **Pode se candidatar por você** pelo navegador, se você autorizar. Você também pode usar só a busca e o quadro.

## Instale com um prompt

Abra o **Claude Code ou o Codex** e cole:

```text
Instale https://github.com/caarloshq/jobrelay em uma pasta própria, sem sobrescrever meus projetos. Leia AGENTS.md e me acompanhe na configuração: meu currículo, as vagas que procuro e onde quero acompanhar as oportunidades. Pergunte se quero só buscar vagas ou também autorizar candidaturas. Crie uma tarefa para checar atualizações a cada três dias, seguindo ATUALIZAR.md, e confirme a próxima execução. Se não houver agendador disponível, me avise. Use meus dados sem inventar informações, não peça senhas ou chaves de acesso no chat e me avise antes de usar serviços pagos.
```

O assistente guia o onboarding, que é a configuração inicial da sua busca. Tenha seu currículo em PDF. Você escolhe as conexões e confere os materiais antes de usá-los.

Prefere baixar a pasta? [Baixe o ZIP](https://github.com/caarloshq/jobrelay/releases/latest/download/jobrelay.zip), extraia e abra a pasta no assistente. Peça para seguir o `AGENTS.md`. O download corresponde à [última release publicada](https://github.com/caarloshq/jobrelay/releases/latest).

## Três comandos para começar

No Claude Code, use os atalhos abaixo. No Codex, selecione a skill de mesmo nome no menu de skills ou faça o pedido por escrito.

| Comando | O que faz |
|---|---|
| `/onboarding` | Guia a configuração com você, prepara o currículo base e ajusta a busca. |
| `/coletar` | Busca, avalia e organiza vagas no seu quadro. |
| `/aplicar` | Retoma as vagas da fila e conduz as candidaturas que você autorizar. |

## Quer que ele se candidate por você?

Para candidaturas no navegador, instale e conecte a extensão do seu assistente: [Claude no Chrome](https://code.claude.com/docs/en/chrome) ou [conexão de navegador para o Codex](https://learn.chatgpt.com/docs/chrome-extension). Essa conexão é opcional para quem só quer buscar vagas, organizar o quadro e adaptar currículos.

Se a candidatura exigir, entre no LinkedIn ou no portal da vaga nesse navegador. Faça o login diretamente no site. O assistente guia a conexão e pede as autorizações necessárias para candidatar. Serviços externos podem ter custos; ele deve avisar antes de usá-los.

## Receba e instale atualizações

Na instalação pelo prompt, o assistente configura uma checagem **a cada três dias** e avisa quando houver uma nova versão. A tarefa depende do agendador e do computador disponíveis. Para instalar a atualização, peça **“atualize para a versão mais recente”**.

O [guia de atualização na raiz](ATUALIZAR.md) identifica o repositório original, a [última release estável](https://github.com/caarloshq/jobrelay/releases/latest) e o caminho para preservar seus dados, inclusive em versões antigas.

## Se precisar de ajuda

[Configurar ou retomar](ONBOARDING.md) · [Instalação e detalhes técnicos](docs/instalar-com-agente.md) · [Fontes de vagas](docs/fontes-e-criterios.md)

## Créditos

Criado por [Carlos Henrique](https://www.linkedin.com/in/caarloshq), Product Designer, a partir da própria busca de trabalho. [Repositório original](https://github.com/caarloshq/jobrelay).

[Ferramentas e fontes utilizadas](docs/CREDITOS.md) · [Licença MIT](LICENSE)
