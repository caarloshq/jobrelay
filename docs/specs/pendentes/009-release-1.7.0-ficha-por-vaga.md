# JobRelay 1.7.0 · Uma ficha por vaga

Status da spec: implementação local autorizada e validação da candidata em curso.

Destino: próxima release estável do JobRelay público, operada pelo assistente.

Referência de atualização: [v1.6.0](../../releases/v1.6.0.md), commit `3f19c58df1017e0d9ba609c71650e49935942f0c`.

Base examinada para implementar: `main` público, commit `f03688467ddc8111e4811f19ad74ea807a18362f`. Verificar mudanças na base antes de começar.

## Decisões

- A 1.7.0 sai como versão estável. A validação usa instalações isoladas com dados fictícios e passa pelo processo normal de release.
- Quem usa o quadro local passa a ter uma ficha Markdown como fonte do estado e do histórico de cada vaga. A ficha reúne anúncio, triagem, respostas, pendências, mudanças de situação e referências a arquivos e comprovantes. Perfil e currículo base continuam nas pastas da instalação.
- Quem usa o Notion mantém a fonte, o fluxo e as preferências atuais. A migração de fichas é exclusiva do modo local. Em instalações que já passaram pela migração, trocar a fonte não importa nem mescla estados automaticamente.
- A operação segue pelo Codex ou por outro assistente instalado com acesso à pasta. A release mantém as entradas públicas atuais, inclusive o quadro web opcional. O desktop privado fica fora do pacote.

## Plano

| # | O que vai mudar | O que a pessoa pode conferir | Onde |
|---|---|---|---|
| 1 | Gravação e leitura de fichas, identidade por vaga e regras para dados sensíveis | O anúncio, as respostas e o histórico aparecem juntos. Uma nova fonte do mesmo anúncio localiza a ficha existente. | `local/aplicacao/` |
| 2 | Migração do quadro local e restauração | A pessoa abre a 1.7.0 com as mesmas vagas, situações, pendências e configurações. O relatório identifica conflitos antes da troca. | Atualização de uma instalação 1.6.0 |
| 3 | Integração das entradas usuais com a ficha | Coletar, triar, registrar respostas, resolver pendências e marcar recebimento salvam na ficha certa. O Notion continua seguindo suas entradas atuais. | Chat, comandos e quadro opcional |
| 4 | Empacotamento e validação da candidata | O mesmo ZIP que será distribuído instala do zero e atualiza uma cópia da 1.6.0, com dados fictícios e rechecagem do resultado. | CI, ZIP e roteiro de atualização |
| 5 | Revisão independente e nota da versão | A nota descreve apenas o que o pacote passou a fazer. O pacote, a nota e o relatório ficam prontos para a decisão de publicar. | GitHub Releases e documentação |

Execução no checkout público isolado. A revisão de migração, comportamento e material de release fica com um agente diferente de quem implementou.

## Ficha e autoridade no modo local

O instalador da 1.6 já cria `local/aplicacao/` para os dados da pessoa. Criar ali as pastas de fichas. Começar a integração por `core/src/fonte-estado.js`, `core/src/estado-central.js` e `core/src/registro-md.js`, incluindo no inventário os demais consumidores e escritores que esses módulos revelarem.

Uma ficha por requisição, com número estável e IDs alternativos verificados. Organizar o registro em `fila/`, `pendentes/`, `concluidas/` ou `excluidas/` por situação. A ficha muda de pasta com o mesmo número. Anexos específicos usam a mesma referência, em `anexos/<número>/`. A ficha mostra ligações relativas e aceita referências a artefatos antigos que permanecem no lugar.

O motor escreve seções para leitura humana e um bloco estruturado versionado no mesmo arquivo. Alterações de estado passam por comandos que conferem a versão da ficha e gravam de forma atômica. Uma única operação guarda a transição e seu registro no histórico. Publicar a mudança de pasta sob a mesma trava, com recuperação após interrupção. Um conflito mantém a versão salva e indica a ficha afetada.

Inventariar os leitores e escritores de quadro, histórico e pendências antes da troca. Após a migração, os formatos antigos que ainda abastecem comandos ou o quadro passam a ser projeções reconstruíveis. A escolha de fonte prevalece em todas as entradas. No modo Notion, manter os leitores e escritores atuais e pular a migração das fichas.

## Migração e dados protegidos

1. Fazer a prévia local com inventário de IDs, aliases, status, pendências, respostas e recibos. Conservar separadas as requisições ambíguas. Uma ausência de dados continua visível no relatório.
2. Fazer backup datado e conferir os hashes dos arquivos. Preparar fichas em área local de acesso restrito e comparar os resultados antes de ativá-las como fonte. Interromper diante de operação ativa, conflito de identidade ou arquivo ilegível. Durante backup, migração e restauração, manter a trava sobre todos os escritores e bloquear envios.
3. Registrar o ponto de troca sob a mesma trava. Até esse ponto, a fonte anterior é a autoridade. Depois dele, as fichas recebem as atualizações e as projeções recebem somente a gravação do projetor. Executar a mesma migração novamente no ensaio e conferir números, arquivos e histórico. Ensaiar interrupção e restauração. Se a restauração ocorrer depois de novas ações, preservar o snapshot das fichas e conciliar essas ações antes de reabrir a operação.
4. Preservar perfil, respostas de referência, currículos, configurações, preferências e registro do onboarding. O histórico da instalação anterior permanece disponível localmente. Importar para a ficha só os registros que puderem ser vinculados à mesma requisição.
5. Filtrar dados pessoais protegidos antes de persistir, usando o tipo, o rótulo e as referências privadas dos campos. Incluir casos com RG e campo `password` de rótulo genérico. O filtro vale para seções legíveis, bloco estruturado, versões anteriores transportadas para a ficha, projeções, saída dos comandos e relatório de conflitos. Usar referências seguras quando necessárias. Os originais ficam em backup local com acesso restrito.

O estado de envio continua sujeito às autorizações vigentes. Recibo só conta quando a prova corresponde à requisição. Uma ficha legada já aplicada sem recibo conserva a situação registrada, fica fora da contagem de recebimentos comprovados e bloqueia reenvio até conciliação. Ficha ausente, corrompida ou ambígua impede nova tentativa até conferência. Uma etapa adicional do portal e um clique sem retorno são estados distintos de recebimento confirmado.

## Critérios antes da publicação

- **Instalação limpa.** O ZIP extraído em pasta nova abre as entradas normais, preserva o onboarding humano e começa com candidatura automática desativada. O fluxo local com dados fictícios percorre coleta, triagem, pendência, atualização da ficha e recibo. Um caso sem recibo permanece em conferência.
- **Atualização da 1.6.0.** Ensaiar pelo atualizador público nos caminhos Git e ZIP. Conferir a versão efetiva, quadros de estados e hashes dos dados preservados. Incluir aliases, histórico, fichas com anexos, vaga já concluída, estado incerto, retomada após falha e restauração.
- **Regressão Notion.** Abrir uma instalação 1.6.0 configurada para Notion e atualizar. Conferir que preservou fonte, dados e entradas operacionais e que nenhuma ficha foi ativada como fonte local.
- **Compatibilidade existente.** Rodar os testes do núcleo, da interface web e da ponte de atualização legada. Conferir que coleta principal e assistida, comandos do chat e quadro usam a fonte esperada.
- **Pacote e privacidade.** Empacotar o conteúdo aprovado pelo materializador oficial. Fixar o commit, conferir SHA-256, manifesto e integridade do `jobrelay.zip`. Inspecionar também o conteúdo canônico dentro da ponte. Somente código, guias e exemplos fictícios entram no ZIP. Os dados em `local/` são gerados na instalação e ficam fora do pacote. Rodar a verificação pública e os testes de dados protegidos após a última edição.
- **Nota e publicação.** Conferir cada frase da [nota de release](../../releases/v1.7.0.md) contra a candidata aprovada. O publicador aplica a data real. Guardar o resultado do CI e conferir que a automação publica os mesmos bytes do ZIP que testou. Obter autorização antes de enviar a tag `v1.7.0` ao remoto, pois o envio da tag dispara a publicação.

Se qualquer critério de preservação, privacidade ou envio falhar, a candidata permanece local até a correção e a reconferência.
