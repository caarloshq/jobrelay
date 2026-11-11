# Receba avisos de versões e preserve seus dados ao atualizar

Para o pedido curto “atualiza aí”, comece pela entrada [ATUALIZAR.md](../ATUALIZAR.md), na raiz. Ela identifica a origem do produto e encaminha o assistente para os procedimentos deste guia.

As versões publicadas ficam em Releases, com acesso pelo [README](../README.md#receba-e-instale-atualizações). Cada release identifica uma tag, mudanças, limites e o código disponível para download. A versão 1.2.0 separa coleta e aplicação, organiza as fontes de respostas e incorpora revisão editorial independente. A validação desta distribuição usa testes locais e dados fictícios; não comprova candidaturas reais nem aumento de contratações.

## Lançamento público v1.3.0

A v1.3.0 reúne o README simplificado, a instalação guiada, as entradas de onboarding, coleta e aplicação e a checagem periódica de releases. As publicações de release anteriores foram substituídas por este lançamento; as tags e o histórico Git foram preservados. A numeração continua para distinguir instalações antigas. A migração de versões anteriores à v1.2.0 continua exigindo os cuidados abaixo.

O download em Releases corresponde à tag publicada, incluindo as skills e o guia da raiz. No Claude Code, as entradas são `/onboarding`, `/coletar` e `/aplicar`; no Codex, escolha a skill no menu ou use `$onboarding`, `$coletar` e `$aplicar` onde houver suporte à menção. Os adaptadores são arquivos comuns para funcionar também em ZIP, sem depender de links simbólicos.

## Migração da v1.3.0 e de commits intermediários

A transição da release estável v1.3.0 para o candidato da v1.4.0 foi testada com o atualizador real em uma instalação fictícia local. O teste preservou perfis, dados, configurações próprias, confirmação humana do onboarding e a opção de desligar a atualização. Isso não dispensa os demais bloqueios do atualizador na instalação de cada pessoa.

Quem instalou um commit intermediário de `main` pode ter `vagas/config/navegador.json` ou `interface/.env.example` rastreados pelo Git. A nova distribuição mantém esses ajustes como arquivos locais e coloca os modelos em `docs/`. A retirada de um arquivo rastreado em caminho protegido pode produzir `RELEASE_ALTERA_DADOS_PROTEGIDOS`. Não há garantia de atualização automática desses checkouts intermediários.

Se esse bloqueio ocorrer, siga a migração assistida de [ATUALIZAR.md](../ATUALIZAR.md): pare a operação, faça uma cópia datada das configurações e dados dentro do projeto e compare o commit instalado com a tag estável escolhida. Preserve os arquivos locais ao ajustar o rastreamento e reconciliar o código. Não apague configurações, não substitua dados pelos exemplos e não enfraqueça as proteções para forçar o avanço. Confira o resultado antes de retomar a operação.

## Ao atualizar para a v1.2.0

Esta versão altera modelos de perfil e fontes de respostas. Por isso, o atualizador automático recusa a transição de uma instalação anterior, preservando seus arquivos. Peça ao assistente para fazer a migração com a instalação parada, uma cópia dos dados dentro do projeto e a comparação das suas alterações locais. Preserve também `aplicacao/`, além dos dados e materiais listados neste guia.

Depois de portar o código, confira os Markdown de `aplicacao/RESPOSTAS.md` e `aplicacao/PERFIL.md` e os JSONs existentes. Se o diagnóstico indicar `MIGRACAO_PENDENTE` porque há modelos neutros junto de JSONs personalizados, a importação explícita é `npm run respostas -- --importar-legado`, dentro de `vagas/`. O comando preserva o opt-in e recusa sobrescrever Markdown já editado; nesse caso, reconcilie o conteúdo com o assistente.

Se houver histórico preenchido em `revisoes/respostas.md`, preserve a cópia e execute `npm run registrar:respostas -- --migrar-historico`, dentro de `vagas/`, antes de novos registros. A migração conserva o conteúdo e deixa um ponteiro para o novo destino. Se o destino já contiver outra história, o comando recusa a mistura; reconcilie os dois arquivos sem sobrescrevê-los. Sem histórico legado, essa etapa não é necessária.

Conclua conferindo as projeções com `npm run respostas -- --conferir-projecoes` e as respostas com `npm run validar:respostas`. Confira a conexão Notion quando configurada antes de retomar candidaturas. A migração não autoriza novo preenchimento, consentimento ou envio.

## Como saber de uma versão nova

No GitHub, abra **Watch → Custom → Releases** para acompanhar publicações, conforme suas preferências de notificação da conta. Consulte a página de Releases para pré-releases; elas não devem ser tratadas como a versão estável mais recente. Uma release não instala atualizações no computador. As entradas `npm run rodada`, `apify` e `enriquecer` tentam aplicar a release estável antes de importar o código da operação. O atualizador usa origem e tag conferidas, avanço linear e exclusão com a operação. Código local alterado, operação ativa, origem divergente ou release que toca dados protegidos impedem a atualização sem apagar arquivos. Consulte [os detalhes e bloqueios](atualizacao-automatica.md). Não há atualização automática a partir de ZIP; o caminho recomendado é instalação por Git com o assistente.

`npm run verificar:versao`, dentro de `vagas/`, compara commits do branch acompanhado com o remoto. Esse comando não consulta releases, não atualiza arquivos e pode informar versão desconhecida numa pasta baixada por ZIP ou num checkout de tag.

## Se você instalou antes da mudança para JobRelay

Faça esta primeira atualização com o assistente. As versões 1.1.0 e 1.1.1 consultam a API pelo nome antigo e recusam redirecionamentos. Depois da renomeação no GitHub, esse endereço devolve um redirecionamento; por isso, essas versões não conseguem instalar a nova release sozinhas. O projeto continua sendo o mesmo repositório, com o mesmo histórico.

Peça ao assistente:

> Atualize minha instalação para JobRelay. Confira a origem e a versão, preserve meus dados e configurações e compare minhas alterações locais. Use https://github.com/caarloshq/jobrelay.git como origem. Aplique a release estável compatível sem apagar arquivos ou substituir meus dados pelos exemplos. Se houver conflito ou histórico divergente, pare e me mostre o que precisa ser resolvido.

Consulte a última release estável do original e confirme sua tag e commit antes de trocar arquivos. Prepare uma cópia dessa tag dentro do projeto, compare as alterações e porte o código compatível com a migração assistida. Preserve os dados e configurações da instalação. Não use `git pull origin main` como substituto da release escolhida.

Se a instalação for um clone reconhecido do original antigo, o assistente pode atualizar a URL do remote para a origem canônica depois dessa conferência. Em um fork, preserve os remotes da pessoa. O atualizador novo aceita também a URL Git antiga exata por compatibilidade; não aceita outros repositórios.

## Se você clonou com Git

Peça ao assistente para conferir origem, branch, versão instalada e alterações locais antes de atualizar. Ele deve fazer cópia dos dados, perfis, credenciais e configurações personalizadas e comparar o código de destino. Use uma pasta de cópia dentro do seu projeto e mantenha-a fora de commits públicos. Não use reset, limpeza ou substituição de dados como atualização.

Para consultar tags sem trocar seus arquivos:

```bash
git fetch origin --tags
git tag --list 'v*'
```

Para instalar a release estável, confirme a tag e o commit no original e siga o atualizador ou a migração compatível a partir dessa tag. Atualizar pelo branch `main` é uma operação diferente: pode trazer código posterior à release e não comprova instalação da versão estável. Para avaliar um RC, o assistente deve preparar uma cópia isolada da tag escolhida, comparar as diferenças e portar o código compatível sem substituir os dados da instalação. Nunca iniciar duas operações apontando para os mesmos dados.

## Se você baixou um ZIP

O ZIP não acompanha atualizações do Git. Baixe a versão escolhida em outra pasta e compare antes de migrar. O assistente pode ajudar; você também pode fazer a atualização manualmente. Preserve `.env`, perfis, currículo-base e materiais, `vagas/data/` inteiro e `revisoes/`. Dentro de `data/`, perguntas, histórico por vaga, pendências, quadro, gerações e tentativas de envio não são cache descartável. Não os substitua pelos exemplos do download.

Depois da atualização, confira a configuração e os registros com os comandos de diagnóstico e validação antes de rodar busca ou retomar candidaturas. Um envio incerto permanece bloqueado mesmo depois de atualizar.

## Publicar uma versão deste projeto

O mantenedor escolhe um commit revisado, confere os checks, define a tag e escreve notas com mudanças, validação, instruções de atualização e limites. RCs são marcados como pré-release e não como `latest`. Uma release pode apontar para um commit de uma PR sem fundi-la em `main`; nesse caso, as notas precisam informar isso. O pacote é o código público daquela tag: dados de uma instalação nunca são anexados. Gere `jobrelay.zip` com `git archive` a partir do commit exato da tag e anexe-o antes de publicar a release; o botão de download do README usa esse nome fixo em `releases/latest/download/jobrelay.zip`. Confira o conteúdo e o hash do ZIP publicado.

Referência: [GitHub Docs: releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
