# Testar a captura Beta do LinkedIn com os títulos do seu perfil

**Beta:** captura assistida experimental, opcional e desligada por padrão. Faça primeiro uma rodada de teste e confira os resultados, limites e tempo observado antes de adotá-la. O recurso pode encontrar login, CAPTCHA ou bloqueio e não garante cobertura. A escolha não inicia busca nem autoriza candidaturas.

Fonte opcional, desligada por padrão em `vagas/config/linkedin-feed.json`. A pessoa pode ativá-la no onboarding, separadamente da Apify. Exige navegador autorizado e login feito pela pessoa no próprio site. Não pedir senha, importar cookies ou contornar bloqueios. A seleção de aplicação isolada não inicia captura.

## Distribuição e links da janela

Novos lotes usam 30 minutos de atividade: Jobs 15 minutos, busca de postagens 12 minutos e feed 3 minutos, nessa ordem. Jobs usa rota `jobs`, postagens `postagens` e feed `feed`. O plano usa `cargo_alvo` e `profissao` do onboarding desta instalação, sem profissão fixa no código. Termos de `consultas_estreitas` e `titulo_aceito` só ampliam as pesquisas depois de confirmar a profissão e ajustar o arquivo de palavras-chave; não herde exemplos de outra pessoa. `planejar` e `status` mostram `consultasPerfil`, com URLs de Jobs e postagens que preservam os títulos por encoding. Configure localização, período e senioridade pela interface conforme o perfil desta instalação. O feed não oferece filtro por esses termos: sua composição depende da conta, e não se promete pesquisa por profissão nessa rota. Use https://www.linkedin.com/jobs/, https://www.linkedin.com/search/results/content/ e https://www.linkedin.com/feed/ como entradas, ajustando os filtros pela interface.

O controle exige a rota em cada intervalo e confere as três metas. Um intervalo não atravessa a troca de rota. Pausas, análise e espera por UI não contam. O agente registra provas e métricas por rota; tempo declarado não comprova atividade real. Lotes antigos sem metas por rota conservam o contrato original, sem reinterpretar o passado.

## Capturar primeiro, conferir depois

Seguir [Coordenação das frentes](../vagas/COORDENACAO-FRENTES.md) quando ambas estiverem selecionadas. Um único controlador opera o navegador compartilhado; a aplicação começa somente depois da coleta concluída, salva e conferida. Preservar o lote nas pausas e retomadas.

Executar os comandos em `vagas/`. `npm run linkedin:feed -- planejar` informa se deve iniciar, retomar, integrar ou dispensar a janela diária. `status` consulta o lote. `iniciar`, `observar`, `intervalo`, `pausar`, `liberar`, `retomar` e `concluir` recebem `--dono` e, quando exigido, `--arquivo` com o JSON da ação. Não usar credenciais ou dados pessoais nos argumentos. O comando não controla navegador ou chama MCP.

Um intervalo usa `inicioEm`, `fimEm`, `evidenciaInicio`, `evidenciaFim`, `provaRef` e `rota`; tem no máximo 60 segundos de atividade observada. Salvar cada achado com título, empresa quando identificada, URL/post de origem, link de candidatura e referência da captura. Link desconhecido permanece pista; não inventar requisição ou elegibilidade. CAPTCHA, login e outras decisões pessoais mantêm a etapa pendente.

Depois de concluir a captura, conferir anúncio, país, modelo, identidade e adequação, usando as fontes desta instalação e a revisão prevista na coleta. Os comandos `preparar`, `publicar` e `confirmar` tratam o lote e sua integração; não publicar durante a captura. O quadro local é o padrão. Notion requer MCP e consulta recente completa para deduplicar, com página/status/URL relidos para confirmar cada escrita. Publicação incerta exige consulta antes de repetir. Somente depois de encerrar toda a coleta e conferir a integração do lote iniciar aplicação. Pista não confirmada não entra.

`integrado` só encerra lote capturado com prova e zero pendências. Preservar estado parcial para retomada; não criar nova janela para escapar de uma integração pendente. O comando não envia candidaturas nem altera as aprovações. A aplicação revalida quadro, fontes e autorizações antes de preencher e transmitir. Registrar tempo ativo, ocorrências, duplicatas, novas confirmadas e pendências por rota. Não tratar número de links como candidaturas ou vagas elegíveis.

Ao terminar cada frente, apresente seu resumo observado antes de passar à próxima: na coleta, encontradas, compatíveis adicionadas e descartadas; na aplicação, confirmações reais, pendências e impedimentos. A captura Beta bloqueada não conta como cobertura concluída. Teste de URLs sem login prova acesso ou bloqueio observado, não vagas compatíveis nem candidaturas.

## Confira o termo na interface antes de contar atividade

Em Jobs e postagens, cada `intervalo` exige `consulta` com `titulo` selecionado no plano, `urlObservada`, `termoObservado`, `bloqueada: false` e `provaRef` não vazio. A URL deve usar o host/caminho LinkedIn planejado e o mesmo parâmetro keywords. Confira também o termo exibido no campo/filtro da interface: o título para Jobs, ou título seguido de “ vagas” em postagens. URL ou HTTP 200 sozinhos não comprovam que a pesquisa foi aplicada. A referência deve apontar à observação dessa interface, além da atividade registrada no intervalo.

O comando compara esse atestado com o plano antes de executar o intervalo. Busca bloqueada, termo divergente ou observação ausente recusam avanço do tempo e preservam a sessão pendente. Não abra outro browser, repita a janela ou contorne login/CAPTCHA para produzir cobertura. O atestado ainda não é prova independente da página; a pessoa/agente deve guardar a observação real na referência. Feed não oferece filtro por termo e não exige essa conferência textual. `iniciar` recusa perfil de consulta pendente.
