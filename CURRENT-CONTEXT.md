# Contexto atual do JobRelay

## Candidata 1.4.0 preparada para revisão

A revisão para lançamento corrigiu a origem das mudanças de status no quadro operacional e o caminho de atualização desde a release estável v1.3.0, preservando as proteções de dados. Metadados e nota estão preparados para 1.4.0. Os commits de correção ficam separados da preparação da versão, sem reescrever histórico publicado. Evidências, testes e limites estão na [spec 007](specs/pendentes/007-release-1.4.0.md); a nota curta fica em [docs/releases/v1.4.0.md](docs/releases/v1.4.0.md).

Atualização automática ativa por padrão e confirmação humana obrigatória permanecem critérios da release. O quadro Astro continua experimental e separado da entrada operacional. Nenhuma tag, release ou mudança de visibilidade foi publicada nesta preparação; a estratégia comercial está em uma frente separada. As seções abaixo preservam o registro das rodadas anteriores.

## Revisão para publicação, 11 de Novembro

Commit e push autorizados nesta continuação. O pacote público exclui perfis preenchidos, materiais pessoais e o arquivo de vagas do protótipo. O scaffold Astro foi integrado como código normal; o histórico Git original foi preservado em cópia e bundle locais ignorados. A interface continua um protótipo, com exemplos fictícios por padrão ou arquivo privado explicitamente configurado; isso não comprova integração operacional com Notion.

O detalhe Astro segue o modelo Puxa Vagas: Confiança percentual com barra no topo; Sobre a vaga, Próxima ação, Datas e Candidatura; Status no primeiro grupo, campos técnicos e histórico recolhidos, logo disponível como ícone e salário desconhecido oculto. Resumo e Gaps permanecem em blocos próprios. A API apenas projeta metadados existentes, sem inferir datas, pendências ou currículo.

Revisão independente reconferiu o detalhe, a projeção e a correção de substituição dos materiais. PDF ilegível retorna erro e preserva o material ativo; versões substituídas ficam em histórico fora da extração ativa. No candidato limpo, 509 testes passaram e a checagem pública não encontrou dados pessoais. Tipos, lint, build e oito testes da interface passaram. Conferência no navegador confirmou o painel com logo, Confiança, ordem dos grupos e copy final. Login real no transporte headless e a barra nativa do modelo Notion continuam pendentes, conforme os limites abaixo. Push não cria release.

## Onboarding local em revisão

Alterações em andamento, ainda sem commit, push ou release. Plano e decisões em [spec 005](specs/pendentes/005-onboarding-visual-materiais-conclusao.md).

Abertura ilustrada com candidatura opcional explícita e botão centralizado. Cabeçalho reduzido ao nome. Currículo obrigatório PDF/DOCX, LinkedIn e adicional opcionais; adicional aceita TXT. Profissão repetida removida; níveis em duas colunas, salários em linhas separadas. Ícones, switches de recorrência e atualização, Notion sem pedir ID, resumo separado de sucesso com instruções/download. A regra de preenchimento humano permanece.

Modelo portável Puxa Vagas em docs/modelo-notion/ contém 19 campos, quatro grupos, cinco visualizações e um exemplo fictício excluído do snapshot operacional. O onboarding cria a página e o quadro na conta da pessoa, sem IDs ou dados do mantenedor. Confiança usa porcentagem; a barra e outros detalhes de layout exigem conferência e ajuste manual se a conexão não expuser esses controles. O bundle declara a configuração desejada, sem afirmar importação nativa ou paridade visual automática.

Navegador headless genérico com agent-browser 0.42.0 fixado, painel local para login humano e bloqueio de comandos do assistente durante esse acesso. Procedimento em docs/navegador.md. Dados e sessões reais não devem ser copiados da instalação do mantenedor.

46 testes técnicos passaram; seis testes ligados à última revisão de copy também passaram. Evidências locais ignoradas pelo Git em revisoes/onboarding-2026-11-11/. A revisão de escrita foi solicitada e aplicada. Gate visual completo e logins reais ainda não realizados. Abrir a prévia com npm start em vagas/.

## Branches

Após pedido explícito, codex/operacao-multiagente foi removida do remoto, pois já era ancestral da main e não tinha commits exclusivos. A consulta remota confirmou somente main. Essa operação não publicou as alterações do onboarding.

Diagnóstico real do wrapper: dependência instalada localmente, mas Chrome/Chromium não encontrado neste computador. Não houve download de navegador; teste de login real depende de configurar um executável compatível. Erro e saída em revisoes/onboarding-2026-11-11/diagnostico-navegador.txt.


## Tema e quadro local em avaliação, 11 de Novembro

Spec [006](specs/pendentes/006-tema-quadro-onboarding-notion.md), implementação autorizada pela pessoa usuária, sem commit/push. Tema neutro do preset, Montserrat preservada; onboarding só recebeu CSS. Kanban inspirado no Todoist e painel lateral no Midday; busca/tabela/arraste mantidos. API transporta logo/localização/modelo/senioridade quando existem na fonte. Logos ausentes usam iniciais.

Prévia em localhost:4184 usa cópia isolada dos cinco exemplos fictícios em revisoes/tema-2026-11-11/demo-data. A fonte original quadro.json tem dois hard links e a proteção de persistência recusa a leitura; ela não foi alterada nem a proteção contornada. localhost:4181 continua o onboarding original. Vinte testes passaram com TMPDIR dentro do projeto (o caminho macOS /var é symlink e é recusado pela validação). Detector: lista vazia. Conferência com navegador inclui abrir/fechar painel, foco, busca e tabela, sem POST ou preenchimento de onboarding.

Radar Notion recebeu Senioridade nos cards e ordem Vaga/Empresa/Salário/Senioridade/Confiança/Link/Concluir. Agrupamento e ordenação preservados. Não há campos nativos de logo/localização e a conexão não expõe abertura em painel lateral: essa parte permanece pendente. Não afirmar paridade visual com o HTML. Gate visual completo ainda não autorizado.

A prévia final é um sandbox visual sem persistência: cinco exemplos fictícios e logos vetoriais fictícias em memória, servidor revisoes/tema-2026-11-11/preview.mjs. Nenhuma ação da prévia altera candidaturas. O arquivo original com hard links continua pendente de investigação; não enfraquecer a proteção. A tentativa pelo navegador de acessar Notion retornou tela vazia, sem controles disponíveis; abertura em painel permanece pendente.

## Quadro Astro em avaliação, continuação de 11 de Novembro

Entrada visual atual: interface/, executando build servidor em http://127.0.0.1:4186 . Astro, componentes shadcn/Base UI do preset bIkfnxQ, Phosphor, dnd-kit. Cards com contorno cinza1px, altura224px e título truncado em uma linha; tabela equivalente; Sheet/Select; score com indicadores; timeline com autor/data/transição. Cabeçalho sem contagens ou explicações. Escrita revisada e frase óbvia da compatibilidade removida.

Review solicitado passou no recorte visual/interativo; evidências em revisoes/tema-2026-11-11/review-astro.md. Tipos, lint, build e cinco testes passaram. Mouse, teclado, Select, tabela, busca, foco e painel390px exercitados em navegador; logs finais sem erro. O quadro usa exemplos em memória; não afirmar gravação real em disco. Botão para iniciar rodada não foi solicitado para implementação. Onboarding existente e Notion preservam seus estados anteriores. O scaffold Git foi preservado em cópia e bundle privados; interface/ está integrada como código normal ao repositório pai, sem Git aninhado. Spec006 permanece pendente pelas frentes de integração real/Notion.

### Refinamentos do card e status

O card inteiro é arrastável, sem alça; clique/Enter abre detalhes e Espaço inicia movimento por teclado. Rodapé sem divisória, texto “92% compatibilidade” à esquerda e barra à direita. Status usam StageLabel compartilhado nas colunas e Selects da tabela/painel, com ícones Phosphor e cores conferidas no Notion. Trocas Avaliar→Aplicar pelo painel e Aplicar→Avaliar pela tabela verificadas na prévia 4186. Estado continua apenas na memória do servidor de demonstração. Astro allowedDomains mantém os hosts/portas locais explícitos para preservar a checagem de Origin no build.

### Protótipo com20 vagas reais copiadas

A pessoa usuária esclareceu que o quadro é teste visual, não final. A prévia4186 passou a exibir20 vagas copiadas da consulta MCP ao Notion, selecionadas por compatibilidade entre Avaliar/Aplicar/Revisar. Dataset/histórico do teste ficam em arquivo privado externo ao checkout público, configurado em interface/.env.local. Arraste e Select persistem nesse arquivo; nenhuma sincronização com Notion, fonte operacional ou candidatura. Não apresentar o protótipo como integração real. Sete testes passaram e build/check passaram; revisão independente sem bloqueios para reinício normal.

Prova final: arrasteLocalizaAvaliar→Aplicar, servidor reiniciado e navegador recarregado mantiveramstatus/histórico. Cards reais20medidos302x224px, truncados e semsobreposição. Corrigido agrupamento legado deAplicadoporIA para evitar duplicação quando existe coluna própria. Selectexercitado; consolelimpo. Captura em revisoes/tema-2026-11-11/vinte-vagas-prototipo.png.

### Logos e densidade do protótipo

Cards compactados para 176 px, com padding de 16 px e metadados sem altura reservada. As 20 vagas foram medidas com a mesma altura, sem sobreposição entre metadados e compatibilidade. Logos oficiais adicionadas a 19 cards no dataset privado; fonte de cada imagem registrada em logoFonte. Cliente não revelado permanece sem logo. CompanyLogo compartilhado na tabela e no painel; navegador confirmou 19 imagens carregadas, 19 na tabela e logo no painel. Typecheck, lint, build e detector passaram; revisão independente sem bloqueios. Captura: revisoes/tema-2026-11-11/logos-cards-compactos.png.

### Compatibilidade próxima dos metadados e modelo explícito

A pessoa usuária apontou o vão entre tags e compatibilidade e a ausência de Remoto nos títulos Work From Home. Rodapé passou de margin-top:auto para8px fixos; cards uniformes de148px com padding12px e metadados em linha com quebra. No protótipo de20 vagas, medição final confirmou148px em todos,8px entre tags e rodapé, sem sobreposição de cabeçalho/metadados/compatibilidade e sem corte do rodapé.

locationLabel usa modelo explícito primeiro e, se ausente, mostra Remoto quando o próprio título diz Remote, Remoto/Remota ou Work From Home. Não infere país; evita repetir Remoto se já estiver no campo Local e modelo. Seis testes passaram, lint/build/detector sem achados. Revisão independente confirmou a lógica e apontou conferir limites de espaço; os20 casos reais foram medidos no navegador. Não há prova para combinações sintéticas com todos os campos em duas linhas fora deste protótipo. Print: revisoes/tema-2026-11-11/cards-sem-vao-remoto.png.

### Divisória e respiros finais dos cards

A pessoa usuária pediu divisória entre empresa e atributos, respiro nas logos e remoção da sobra inferior. O ajuste vigente usa padding interno de 4 px em todas as logos, distância de 2 px entre título e empresa e 16 px de respiro acima e abaixo da divisória. Cards uniformes de 148 px, com hover cinza e clique em toda a superfície. Conferência no navegador cobriu imagens PNG e ICO, clique na logo, no título e no espaço vazio, além de arraste sem abrir detalhes. Build/lint/detector passaram. Captura: revisoes/tema-2026-11-11/cards-hover-clique.png.

A prévia voltou a falhar porque uma cópia externa passou a compartilhar o inode do JSON de teste. Corrigido exclusivamente no store do protótipo: leitura aceita arquivo regular com hardlink, ainda com realpath/O_NOFOLLOW/inode/dev; toda escrita usa novo temporário e rename, preservando a cópia vinculada. Teste confirma backup intacto e destino novo com um link após mover. Oito testes passaram; revisão independente sem bloqueios. A proteção do backend operacional permanece intacta.


### Ordem final dos detalhes e critérios da release

Confiança permanece no topo. O painel segue Sobre a vaga, Resumo, Gaps, Candidatura, Datas, Próxima ação e Histórico. O último bloco permanece expandido e reúne timeline e notas anteriores. Gaps têm subtítulos em negrito e indicadores ✅/🚫 para confirmação ou pendência explícita; referências e frases futuras não geram confirmação. A apresentação preserva o texto e não decide descarte de vagas.

Atualização automática fica ativa por padrão, respeitando desligamento explícito. O registro humano do onboarding é obrigatório antes da operação, inclusive nas instalações existentes sem recibo. Esses são critérios obrigatórios da próxima release.

Reconferência independente aprovada no delta. Candidato isolado: 15 testes da interface passaram, tipos sem erros/avisos/hints, lint e build passaram. Conferência visual confirmou a ordem dos blocos e Gaps com negrito e ícones. O login real headless e a barra do modelo Notion continuam nos limites já documentados. A auditoria de status do Notion foi transferida a outro chat e não integra estes commits.

Últimos ajustes de logos, divisória, hover e clique no card inteiro foram conferidos no navegador. Evidência vigente no fim de revisoes/tema-2026-11-11/review-astro.md; captura cards-hover-clique.png.

Painel ajustado com Próxima ação perto do fim e Histórico único, aberto e por último. Os gaps estruturados e as próximas ações preparados na outra sessão foram aplicados à cópia de teste, preservando status e timeline. Prova no fim de revisoes/tema-2026-11-11/review-astro.md; captura painel-historico-unico.png.


### Gaps compara requisitos e experiência

A checklist do detalhe contém somente comparações curtas com evidência literal: atendido, lacuna comprovada ou não comprovado. O frontend não interpreta texto operacional como qualificação. Ações ficam em Próxima ação; anotações originais continuam em Dados técnicos. Histórico é o último bloco e fica expandido. O contrato opcional itensCompatibilidade é transportado pelo GET quando existe; o motor operacional ainda não produz esses itens.

A prévia usa cópia privada curada de 20 vagas e 42 itens; a revisão independente conferiu os trechos e a preservação dos campos/históricos originais. Nenhum dado pessoal, dataset ou configuração da prévia entra no commit. Candidato seletivo sobre a55e55e exclui alterações de outras frentes em logo, cards e store. Passaram 11 testes da interface, 14 de modelo/quadro, tipos, lint e build; conferência visual confirmou a checklist e o Histórico aberto. Commit solicitado; nenhum novo push solicitado.
