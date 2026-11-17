# Testar a captura Beta do LinkedIn com os títulos do seu perfil

**Beta:** captura assistida experimental, opcional e desligada por padrão. Faça primeiro uma rodada de teste e confira os resultados, limites e tempo observado antes de adotá-la. O recurso pode encontrar login, CAPTCHA ou bloqueio e não garante cobertura. A escolha não inicia busca nem autoriza candidaturas.

Fonte opcional, desligada por padrão em `local/config/linkedin-feed.json`. A pessoa pode ativá-la no onboarding, separadamente da Apify. Exige navegador autorizado e login feito pela pessoa no próprio site. Não pedir senha, importar cookies ou contornar bloqueios. A seleção de aplicação isolada não inicia captura.

Na coleta 2, abrir os anúncios um por vez, sem disparar todas as abas juntas. Seguir a [cadência e a interrupção por limites](../core/LINKEDIN-LIMITES.md), inclusive na conferência dos links depois da captura. Ao surgir limite, interromper a navegação e salvar as vagas restantes no checkpoint.

## A pergunta antes da coleta 2

A captura é a **coleta 2**: vem depois da coleta principal e da aplicação, e só começa com o sim da pessoa. Antes de abrir o LinkedIn, o assistente faz uma pergunta clicável com o texto exato "Quer continuar com a coleta 2 (LinkedIn assistido)?" e duas opções, "Sim, continuar" e "Não, fechar sem a coleta 2". O sim vale só para a janela assistida: não autoriza Apify, preenchimento nem envio.

| Situação | O que fazer |
|---|---|
| Aplicação terminou, mesmo com pendências | Perguntar |
| Aplicação ainda aberta ou coleta principal não encerrada | Não perguntar; o resumo diz por quê |
| Sem aplicação instalada ou em modo mapear | Perguntar logo depois da coleta principal |
| Rodada agendada ou sem ferramenta de pergunta | Não perguntar nem rodar; registrar `sem_resposta` |
| LinkedIn desligado em `local/config/linkedin-feed.json` | Não existe coleta 2: sem pergunta e sem linha no resumo |
| `planejar` devolve `dispensar` | Janela de hoje já feita; sem pergunta |
| `planejar` devolve `integrar` | Trabalho local: rodar sem pergunta, também na rodada agendada |
| `planejar` devolve `iniciar` ou `retomar` | Perguntar |

Depois do sim humano, iniciar a sessão `linkedin:feed` com a referência em `aceiteRef`, sem capturar. Ler o `runId` gerado e registrar a resposta com `npm run rodada:lote -- coleta2_decidir`, passando esse ID em `feedRunId`. Só então iniciar a captura; em retomadas, preservar a referência e o run existentes. A referência é um registro: quem garante o sim é o assistente. Recusar não reserva a janela do dia. Terminada a captura, registrar `coleta2_captura` (ou `coleta2_integrar` para captura antiga que só esperava integração). Se houver vaga nova gravada, a mesma referência do aceite inicia a aplicação apenas quando `data/politica-autonomia.json#modoCandidatura` for `chrome_assistido` e `config/perfil-candidatura.json#autorizado` for `true`. Não se pergunta uma segunda vez. Sem os dois controles, manter as vagas em `nao_percorrida`, encerrar a rodada e retomá-las numa rodada futura após reler a fila com o opt-in ativo. Não inferir envio da candidatura.

## Distribuição e links da janela

Novos lotes usam 30 minutos de atividade: Jobs 15 minutos, busca de postagens 12 minutos e feed 3 minutos, nessa ordem. Jobs usa rota `jobs`, postagens `postagens` e feed `feed`. O plano usa `cargo_alvo` e `profissao` do onboarding desta instalação, sem profissão fixa no código. Termos de `consultas_estreitas` e `titulo_aceito` só ampliam as pesquisas depois de confirmar a profissão e ajustar o arquivo de palavras-chave; não herde exemplos de outra pessoa. `planejar` e `status` mostram `consultasPerfil`, com URLs de Jobs e postagens que preservam os títulos por encoding. Configure localização, período e senioridade pela interface conforme o perfil desta instalação. O feed não oferece filtro por esses termos: sua composição depende da conta, e não se promete pesquisa por profissão nessa rota. Use https://www.linkedin.com/jobs/, https://www.linkedin.com/search/results/content/ e https://www.linkedin.com/feed/ como entradas, ajustando os filtros pela interface.

O controle exige a rota em cada intervalo e confere as três metas. Um intervalo não atravessa a troca de rota. Pausas, análise e espera por UI não contam. O agente registra provas e métricas por rota; tempo declarado não comprova atividade real. Lotes antigos sem metas por rota conservam o contrato original, sem reinterpretar o passado.

## Capturar primeiro, conferir depois

Seguir [Coordenação das frentes](../core/COORDENACAO-FRENTES.md) quando ambas estiverem selecionadas. Um único controlador opera o navegador compartilhado. A coleta 2 só começa depois da aplicação, então não disputa o navegador com ela. Preservar o lote nas pausas e retomadas.

Executar os comandos em `vagas/`. `npm run linkedin:feed -- planejar` informa se deve iniciar, retomar, integrar ou dispensar a janela diária. `status` consulta o lote. `iniciar`, `observar`, `intervalo`, `pausar`, `liberar`, `retomar` e `concluir` recebem `--dono` e, quando exigido, `--arquivo` com o JSON da ação. Não usar credenciais ou dados pessoais nos argumentos. O comando não controla navegador ou chama MCP.

Um intervalo usa `inicioEm`, `fimEm`, `evidenciaInicio`, `evidenciaFim`, `provaRef` e `rota`; tem no máximo 60 segundos de atividade observada. Salvar cada achado com título, empresa quando identificada, URL/post de origem, link de candidatura e referência da captura. Link desconhecido permanece pista; não inventar requisição ou elegibilidade. CAPTCHA, login e outras decisões pessoais mantêm a etapa pendente.

Depois de concluir a captura, conferir anúncio, país, modelo, identidade e adequação, usando as fontes desta instalação e a revisão prevista na coleta. Os comandos `preparar`, `publicar` e `confirmar` tratam o lote e sua integração; não publicar durante a captura. O quadro local é o padrão. Notion requer MCP e consulta recente completa para deduplicar, com página/status/URL relidos para confirmar cada escrita. Publicação incerta exige consulta antes de repetir. A aplicação das vagas da coleta 2 só começa depois de confirmar a integração e reler os dois controles de aplicação desta instalação. Pista não confirmada não entra.

`integrado` só encerra lote capturado com prova e zero pendências. Preservar estado parcial para retomada; não criar nova janela para escapar de uma integração pendente. O comando não envia candidaturas nem altera as aprovações. A aplicação revalida quadro, fontes e autorizações antes de preencher e transmitir. Registrar tempo ativo, ocorrências, duplicatas, novas confirmadas e pendências por rota. Não tratar número de links como candidaturas ou vagas elegíveis.

Ao terminar cada frente, apresente seu resumo observado antes de passar à próxima: na coleta, encontradas, compatíveis adicionadas e descartadas; na aplicação, confirmações reais, pendências e impedimentos. A captura Beta bloqueada não conta como cobertura concluída. Teste de URLs sem login prova acesso ou bloqueio observado, não vagas compatíveis nem candidaturas.

## Descartes e pistas com motivo

Depois da janela, conferir cada observação antes de integrar. Resolver links curtos e conferir a página de candidatura, abertura e elegibilidade; página inacessível não prova encerramento em todos os canais. Não inventar empresa, remoto, país ou remuneração.

A identidade da ATS ou do LinkedIn Jobs é da vaga; a rota de descoberta é proveniência. `share` e `activity` não são intercambiáveis nem identificam uma requisição. O normalizador reconhece os destinos cobertos por `busca/extrair-id.js`, incluindo LinkedIn Jobs e SmartRecruiters. Outros destinos ficam como pistas até suporte e identidade comprovados.

A revisão do agente usa julgamento com evidência: descrição integral, resumo, gaps, quatro eixos de zero a dez, justificativa, evidência e fonte de cada eixo. A soma forma `semantico`, de zero a quarenta. A nota prioriza e não cria veto numérico de candidatura. Modelo e país compatíveis, abertura e canal são conferências factuais explícitas.

O arquivo de revisões é uma lista. Cada item usa o `id` real retornado em `observacoes` como `idObservacao` e inclui:

- `vagaRevisada`: título, empresa, descrição, `validada`, modalidade, país, resumo, gaps e `semantico` numérico, conforme o contrato de vaga existente.
- `revisao`: `aberta: true`, `canal: "link"`, `paisCompativel: true`, `modeloCompativel: true` e `eixos`, com quatro objetos `{nota, justificativa, evidencia, fonte}`.
- Quando houver redirecionamento: `urlResolvida` e `evidenciaResolucao`. Outros vínculos comprovados usam `vinculos: [{urlA, urlB, evidencia}]`. Aliases soltos não comprovam equivalência.

Quando a observação não é uma vaga nova elegível, registrar `desfecho` **na revisão ligada ao `idObservacao` original**. O preparador só aceita `pistas` e `descartadas` com esse registro; ausência de leitura, rótulo genérico ou prova incompleta permanece em `pendencias`. A classificação exige conferência humana da fonte: o Node valida forma e coerência dos campos, não a verdade da página.

```json
{
  "idObservacao": "id-real-da-observacao",
  "revisao": { "modeloCompativel": false },
  "desfecho": {
    "idObservacao": "id-real-da-observacao",
    "tipo": "descartada",
    "criterio": "modalidade_incompativel",
    "motivo": "A página informa trabalho híbrido",
    "evidencia": "Trecho ou referência específica conferida",
    "fonte": "URL ou referência da leitura",
    "verificadoEm": "2026-11-13",
    "alcance": "esta requisição neste canal"
  }
}
```

`tipo: "descartada"` aceita `modalidade_incompativel` com `revisao.modeloCompativel: false`, `inscricoes_encerradas` com `revisao.aberta: false`, `pais_incompativel` com `revisao.paisCompativel: false`, `canal_indisponivel` com `revisao.canal: "indisponivel"`, `nivel_excluido` ou `fora_perfil` com rejeição real do filtro. Escopo factual incompatível que o filtro automático não reconhece usa `escopo_incompativel`, `revisao.escopoCompativel: false` e `desfecho.regraRef` apontando para a orientação de área já vigente; exige prova específica do trabalho descrito, não cria veto novo. `decisao_rodada` exige `alcance: "rodada"` e `decisaoPor: "pessoa"` dentro de `desfecho`; não altera filtros de outras rodadas. Fechamento de um canal não afirma fechamento de todos.

`tipo: "pista"` aceita `sem_destino`, `ats_sem_suporte`, `identidade_nao_comprovada`, `conflito_factual`, `fonte_inacessivel`, `canal_incompleto` ou `dados_incompletos`. Além dos campos comuns, exige `lacuna` concreta e `proximaAcao` verificável. Uma pista conserva o limite da leitura e não conta como vaga nova, publicação ou candidatura. Uma ATS sem extrator e um post sem canal podem ser pistas; não criar ID de requisição nem inserir função retroativamente na captura.

A identidade forte já conhecida e o histórico do quadro prevalecem antes de qualquer novo desfecho. Cada resultado conserva o `idObservacao`; ID ausente, repetido ou estranho à sessão é recusado. `confirmar` exige cobertura de todas as observações do pacote, sem pendências de triagem, escrita ou proveniência, e relê ID e URL exatos das novas páginas.

A captura continua intacta. A revisão só complementa observações existentes; não pode inserir uma função nova no lote por meio do arquivo de revisões. O script compara por identidade forte e URL, mantém requisições distintas e marca semelhança fraca para conferência. Vaga somente no cache continua pendente de publicação; uma concluída na fila não reabre por reaparecer no feed.

```bash
npm run linkedin:feed -- preparar --dono coletor-da-execucao --revisoes data/revisoes-feed.json
```

O modo Notion exige também `--estado data/consulta-feed.json`, descrito abaixo. `preparar` salva `publicacao.json` no lote e separa novas, duplicatas, pistas, descartadas e pendências; não afirma gravação. Sem leitura completa, a vaga fica pendente. O agente corrige a revisão e prepara novamente antes de publicar.

## Confira o termo na interface antes de contar atividade

Em Jobs e postagens, cada `intervalo` exige `consulta` com `titulo` selecionado no plano, `urlObservada`, `termoObservado`, `bloqueada: false` e `provaRef` não vazio. A URL deve usar o host/caminho LinkedIn planejado e o mesmo parâmetro keywords. Confira também o termo exibido no campo/filtro da interface: o título para Jobs, ou título seguido de “ vagas” em postagens. URL ou HTTP 200 sozinhos não comprovam que a pesquisa foi aplicada. A referência deve apontar à observação dessa interface, além da atividade registrada no intervalo.

O comando compara esse atestado com o plano antes de executar o intervalo. Busca bloqueada, termo divergente ou observação ausente recusam avanço do tempo e preservam a sessão pendente. Não abra outro browser, repita a janela ou contorne login/CAPTCHA para produzir cobertura. O atestado ainda não é prova independente da página; a pessoa/agente deve guardar a observação real na referência. Feed não oferece filtro por termo e não exige essa conferência textual. `iniciar` recusa perfil de consulta pendente.
