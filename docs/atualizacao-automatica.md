# Consulte a release e confirme antes de instalar

O nome histórico `atualizarAutomaticamente` identifica a API de pré-checagem. Ela consulta a última release estável do repositório original e exige confirmação específica antes de buscar objetos Git ou baixar o ZIP. Consultar não instala. A opção `atualizarAutomaticamente: false` continua desligando essa pré-checagem nas entradas operacionais; ela não muda a autorização de candidaturas.

A entrada operacional primeiro verifica a confirmação humana do onboarding. Depois chama a pré-checagem, antes de importar os módulos da operação e de adquirir sua posse. Somente os resultados `atualizado`, `sem_atualizacao` ou `desativada`, sem falha de registro ou trava, permitem continuar. Falha de rede, bloqueio e `aguardando_confirmacao` interrompem a entrada. A pessoa pode confirmar a atualização ou desligar a checagem nas preferências; o assistente não escolhe por ela.

```js
import { atualizarAutomaticamente, podeIniciarOperacao } from './vagas/src/atualizacao.js';
const resultado = await atualizarAutomaticamente({ raiz }); // raiz absoluta
// aguardando_confirmacao: apresentar tag, identidade e notas; aguardar a pessoa.
// Após aceite explícito dessa release, em outra chamada:
const instalado = await atualizarAutomaticamente({
  raiz, confirmacao: { aceita: true, ...resultado.confirmacao_necessaria },
});
if (!podeIniciarOperacao(instalado)) throw new Error('Atualização pendente');
// Só agora importar dinamicamente o módulo da operação.
```

Não transforme esse exemplo em aceite automático: a segunda chamada depende da resposta humana. A aprovação não fica salva para releases futuras. A API consulta novamente os metadados e recusa um aceite cuja tag, identidade da tag ou digest do ZIP tenham mudado.

## Use o comando em duas etapas

Na raiz da instalação, `node vagas/scripts/atualizar.mjs` consulta e imprime JSON. Código de saída 3 indica confirmação pendente; 2 indica bloqueio. Depois do aceite da pessoa, use os valores exatos de `confirmacao_necessaria`:

```bash
# Git
node vagas/scripts/atualizar.mjs --confirmar v1.5.0 --sha IDENTIDADE_DA_TAG
# ZIP: acrescentar o digest exibido na consulta
node vagas/scripts/atualizar.mjs --confirmar v1.5.0 --sha IDENTIDADE_DA_TAG --asset-sha256 DIGEST_SHA256
```

Os identificadores acima são espaços para os valores consultados, não argumentos prontos. A próxima operação faz sua pré-checagem novamente. Nenhum comando de atualização inicia coleta, candidatura ou envio.

## Git exige avanço linear e preserva a árvore local

O atualizador aceita somente `origin` igual a `https://github.com/caarloshq/jobrelay.git` ou ao endereço legado exato `https://github.com/caarloshq/job-scrapper.git`. Usa a API e a origem canônicas do JobRelay. Não altera remotes, não aceita forks nesse caminho e não usa `main` como substituto da release estável.

Após o aceite, busca a tag em uma referência temporária, confere sua identidade, exige que o commit instalado seja ancestral do destino e executa somente `git merge --ff-only`. Código local alterado, histórico divergente, links, submódulos, filtros locais ou mudanças de atributos impedem a instalação. Não há `stash`, `reset`, `force` ou retomada por prazo. Mudanças da release em caminhos pessoais protegidos são recusadas, inclusive remoções. Alterações locais nesses caminhos podem permanecer se a release não os altera.

## ZIP usa digest, staging e backup dentro da instalação

O número da versão sozinho não comprova equivalência. Depois de instalar, o atualizador registra a identidade da release e os hashes dos arquivos geridos em `vagas/data/atualizacao-instalacao.json`. A próxima consulta só reconhece a mesma release como instalada se esse registro e os arquivos conferirem. Sem esse registro, a mesma versão também exige aceite e verificação do pacote.

Uma instalação sem `.git` precisa ter `vagas/package.json` identificando `jobrelay` e uma versão estável. O atualizador aceita somente o asset `jobrelay.zip` da release canônica, com `digest` SHA-256 publicado pela API do GitHub. Se o digest não estiver disponível, bloqueia: não substitui essa prova por tamanho, ETag ou confiança no nome. Depois do aceite, aceita redirecionamento HTTPS somente para `release-assets.githubusercontent.com` e confere os bytes antes de abrir o pacote.

O leitor recusa caminhos que escapem de `jobrelay/`, aliases de caixa, duplicatas, links, volumes múltiplos, ZIP64, métodos desconhecidos e limites de tamanho excedidos. Confere tamanho e CRC de cada entrada. O pacote precisa identificar o produto e a versão de destino. Uma mudança de dependências declaradas exige migração assistida; o atualizador não executa scripts do pacote nem instala dependências.

A allowlist instala código e testes de `vagas/src`, `vagas/scripts` e `vagas/test`, skills, adaptadores, documentação, onboarding, quadro, fontes e assets da interface e arquivos de produto explicitamente listados em `permitidoZip`. Ela exclui dados pessoais, configurações locais, diretórios de dependências, Git e automações de publicação. Recusa caminhos desconhecidos fora da allowlist, mantendo fora da substituição as configurações da interface, histórico de contexto, specs e workflows de publicação. Quando há manifesto de uma atualização anterior, também recusa a remoção de um arquivo gerido. Não remove arquivos antigos desconhecidos. Uma release que dependa de remoções ou de caminhos fora dessa lista exige migração assistida; esse caminho não comprova igualdade byte a byte de toda a pasta com a tag.

Os arquivos escolhidos passam primeiro pelo staging em `vagas/data/atualizacao-backups/<id>/staging`. A mesma pasta guarda um manifesto e a cópia dos arquivos substituídos. Cada destino é conferido contra alterações concorrentes antes da troca. Se uma gravação falhar, o atualizador tenta restaurar os arquivos já trocados e remove os recém-criados por ele. Os backups permanecem para inspeção. Se a reversão não puder ser comprovada, a trava permanece e impede nova operação.

## Dados e regras locais ficam protegidos

São protegidos `.env` e variantes, `config/`, `data/`, `vagas/config/`, `vagas/data/`, revisões, currículos, fontes e builds do currículo, bases de currículo, perfis, respostas e histórico. `REGRAS-DO-PROJETO.md` e nomes de backup iniciados por `REGRAS-DO-PROJETO` também ficam protegidos. O ZIP ignora essas entradas do pacote; o Git recusa uma release que as altere. Não há substituição de fontes pessoais pelos exemplos públicos.

Nesta versão, a atualização só coordena o destino padrão `vagas/data`. Se `VAGAS_DIR_DADOS` apontar para outro destino, a checagem ativa retorna `DADOS_OPERACAO_DIVERGENTES` antes da consulta. A opção de desligar a checagem continua permitindo usar o destino configurável sob as guardas normais da operação.

A trava exclusiva `vagas/data/operacao/.atualizacao.lock` coordena a atualização com a operação. Uma operação ativa, lock de escrita/recuperação, estado inválido ou controle legado sem reconciliação bloqueia a atualização. O acesso humano ativo e os locks de comando, controlador e recuperação do navegador também bloqueiam; a verificação se repete antes de trocar código. PID files do runtime, checkpoint sem encerramento deliberado ou bloqueio pendente também impedem a troca, mesmo sem comando em execução. O atualizador não sonda nem fecha o browser para liberar esse estado. Não há expiração nem tomada de posse automática. O resultado fica em `vagas/data/atualizacao.json`, sem credenciais. Se o Git iniciar a aplicação e não confirmar o destino, ou se houver reversão ZIP incerta ou falha ao registrar o resultado, a trava pede revisão manual. Pare os processos e reconcilie código, dados e manifesto antes de mantê-la ou removê-la deliberadamente.

Os testes do atualizador usam repositórios e ZIPs fictícios locais. Eles não consultam releases reais e não comprovam atualização de uma instalação externa. Instalações antigas podem precisar primeiro da [migração assistida](atualizacao.md).
