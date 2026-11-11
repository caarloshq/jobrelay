# Atualize esta instalação pelo repositório original

Quando a pessoa pedir **“atualiza aí”**, **“atualize o projeto”** ou **“instale a versão mais recente”**, siga esta entrada antes de iniciar onboarding, coleta ou candidaturas. O pedido inicia a consulta. Antes de baixar ou instalar, apresente a release e aguarde o aceite explícito dessa versão, preservando os dados e escolhas da instalação.

## Origem e créditos

| Referência | Fonte |
|---|---|
| Repositório original | [JobRelay no GitHub](https://github.com/caarloshq/jobrelay) |
| Releases estáveis | [Última release](https://github.com/caarloshq/jobrelay/releases/latest) |
| Consulta da release pelo assistente | [API de releases/latest](https://api.github.com/repos/caarloshq/jobrelay/releases/latest) |
| Autoria | [Autor e créditos no README](README.md#créditos), com aviso preservado na licença |
| Licença | [MIT e aviso de autoria](LICENSE) |

Essa é a origem do produto mesmo quando a pasta tiver outro nome ou a instalação for um fork. `origin` pode apontar para a cópia da pessoa; confira os remotes sem substituí-los automaticamente. O [endereço Git legado](https://github.com/caarloshq/job-scrapper.git) pertence ao mesmo projeto e redireciona para o original.

## O que o assistente deve fazer

1. **Identificar a instalação.** Leia as instruções locais e confira raiz Git, remotes, branch, versão em `vagas/package.json`, alterações locais e operação ativa. Em ZIP, registre que não há histórico Git. Não toque na instalação enquanto outro processo estiver escrevendo nela; resolva a coordenação antes da atualização.
2. **Consultar a release estável original.** Use a API acima ou `gh release view --repo https://github.com/caarloshq/jobrelay`. Leia `tag_name`, notas e instruções da versão; confira que não é rascunho nem pré-release. Não confunda o HEAD de `main`, a release do fork ou uma tag local com a última release estável do original. Se a consulta falhar, informe a falha sem afirmar que está atualizado.
3. **Confirmar e preservar a instalação.** Apresente tag, identidade da tag, notas e, no ZIP, digest do asset. Aguarde o aceite específico antes de buscar código ou baixar o pacote. Faça uma cópia datada dos dados e personalizações dentro do projeto, fora de commits públicos. Preserve perfis, respostas, histórico, currículos, materiais, credenciais, quadro, pendências, opt-in e configurações. Mantenha os créditos e a licença. Compare o destino com as alterações locais antes de substituir arquivos.
4. **Aplicar o caminho compatível.** Use o [atualizador com confirmação](docs/atualizacao-automatica.md). A primeira chamada consulta; a segunda recebe o aceite específico da release. Em Git, exige a origem original ou legada exata e avanço linear. Em ZIP, exige o asset canônico com digest verificável e faz staging, backup e substituição apenas da allowlist, preservando configurações, dados, regras locais e histórico. Se houver bloqueio, mudança de dependências ou necessidade de remover arquivos, siga a [migração assistida](docs/atualizacao.md). Em fork ou projeto embutido em outro repositório, prepare uma cópia separada da tag dentro do projeto e porte apenas as mudanças compatíveis. Não mescle o histórico público na raiz de outro projeto e não substitua a tag por `main`.
5. **Conferir e relatar.** Siga os diagnósticos e migrações da versão, confira as fontes de respostas e rode os testes aplicáveis. Informe versão anterior, tag e commit de destino, versão efetivamente instalada, o que foi preservado e o que ficou pendente. Se houver porte parcial, diga “núcleo adaptado da release”, sem declarar a instalação inteira idêntica à tag.

Um bloqueio do atualizador pede análise e migração; não autoriza reset, descarte, force-push, mudança de opt-in ou substituição de dados pelos exemplos. Atualizar não inicia candidatura, gasto, novo agendamento ou publicação de um fork.

## Confira releases a cada três dias pelo assistente

Quando a instalação seguir o prompt do README que autoriza criar a tarefa, o assistente deve configurar uma checagem no agendador nativo disponível no ambiente. Essa autorização vale para a checagem de releases e independe da escolha de autonomia de candidaturas. Em clones ou instalações feitos por outro caminho, confirme somente a autorização para essa tarefa antes de criá-la; o pedido de atualizar o produto, sozinho, não autoriza um agendamento.

1. **Confira a ferramenta e evite duplicatas.** Descubra o agendador nativo e consulte as tarefas existentes antes de criar. Identifique a tarefa pela instalação local e pelo repositório original; atualize uma tarefa equivalente em vez de criar outra. Se não conseguir consultar as tarefas, não suponha que nenhuma existe. Não configure cron, daemon ou outro agendador como alternativa silenciosa.
2. **Configure o intervalo real.** Use uma recorrência a cada três dias a partir da primeira execução, no fuso da pessoa. Confira a recorrência e as próximas datas: executar nos dias 1, 4 e 7 de cada mês, por exemplo, não garante esse intervalo na virada do mês. Se a ferramenta não suportar a recorrência solicitada, informe a limitação sem substituir por outra frequência.
3. **Consulte, sem instalar.** A tarefa consulta somente a última release estável do repositório original indicado acima, confere tag e commit e compara com a versão e o commit locais. Leia os arquivos necessários; não faça pull, checkout, merge, instalação de dependências ou atualização do núcleo. Nunca execute `npm run atualizar`, `npm run rodada`, coleta ou candidatura durante essa checagem; não mude o opt-in. Em ZIP, fork ou porte parcial, considere as diferenças registradas e informe incerteza quando não for possível comprovar equivalência com a tag. O número do pacote, sozinho, não basta.
4. **Avise somente quando houver ação.** Avise quando uma release estável ainda não instalada for identificada, com versão, link e necessidade de migração, e quando uma falha nova impedir a verificação e exigir intervenção. Fique em silêncio sem novidade ou diante da mesma pendência já avisada. Não repita o aviso da mesma release a cada execução. Uma consulta que falhou nunca comprova que a instalação está atualizada.
5. **Preserve a identidade e o último aviso.** Quando necessário, registre o identificador da tarefa, a tag e o commit conferidos, o último aviso e a pendência técnica em `revisoes/checagem-releases.json`, que fica ignorado pelo Git. Não inclua perfil, respostas, currículos, credenciais ou outros dados pessoais nesse registro. Antes de usar outro destino, confira que ele está ignorado. Esse estado permite retomar a checagem sem duplicar tarefas ou avisos.
6. **Comprove a criação.** Só informe que a tarefa está criada ou atualizada depois da confirmação da ferramenta, apresentando seu identificador, intervalo, fuso e próxima execução confirmada. Sem ferramenta disponível, acesso ou confirmação, informe a pendência e diga que a tarefa não foi criada. Ter escrito a instrução neste arquivo não cria uma automação.

O aviso de release convida a pessoa a pedir a atualização. A checagem agendada não autoriza a instalação automática; o procedimento de atualização continua sendo o da seção anterior.

## Se esta entrada não existir na versão antiga

O assistente pode recuperar as instruções atuais pelo repositório original identificado no README ou nos créditos. Para iniciar essa descoberta em uma instalação antiga, a pessoa pode dizer:

> Atualiza esta instalação pela última release estável de https://github.com/caarloshq/jobrelay. Leia ATUALIZAR.md no repositório original e as notas da release, preserve meus dados e configurações e faça as migrações necessárias. Mantenha os créditos e me informe a versão instalada ao terminar.

Instalações antigas não recebem este arquivo retroativamente. Depois da primeira atualização compatível, o pedido curto “atualiza aí” encontra esta orientação na raiz.
