# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Repositório público. O núcleo de coleta e o onboarding aceitam Node.js 20; o navegador assistido usa a dependência opcional agent-browser e exige Node.js 22. O pacote completo, incluindo a interface Astro, requer Node.js 22.23.4 ou mais recente. Python 3 lê os materiais e gera o currículo. O onboarding continua HTML autocontido, servido por Node. A interface do quadro em `interface/` usa Astro + React e componentes shadcn/Base UI do preset bIkfnxQ por pedido explícito de Carlos em 11 de Novembro. A versão HTML anterior permanece preservada até a integração. Rodam em `localhost`, no navegador de quem usa, com internet disponível (fonte pode vir do Google Fonts, com fallback de sistema).

## Users

Uma pessoa procurando emprego remoto, que sabe usar um terminal o bastante pra rodar `npm run`, e que tem o Claude Code ou o Codex instalado. Designer, engenheira de software, produto: a profissão varia, o fluxo não. Ela chega pelo README do GitHub, sozinha, sem ninguém pra perguntar, e quer sair da primeira sessão com o sistema configurado pra ela e o primeiro radar rodando.

Situação de uso: sentada no computador, uma tarde, com o currículo em PDF e o LinkedIn à mão. Não é uma decisão de compra: é uma configuração que ela quer fazer uma vez e esquecer.

**Suposição (brief curto, 2026-09-14):** o leitor padrão é brasileiro e lê português; o mercado alvo pode ser nacional, internacional ou ambos.

## Product Purpose

Buscar vagas em portais, ATS e LinkedIn, avaliar a compatibilidade com o currículo real e os critérios escolhidos e organizar oportunidades no quadro. Quando a pessoa desejar candidatar-se e conceder as autorizações necessárias, preparar respostas, adaptar o currículo e operar os formulários, com prova de recebimento para contar um envio. O onboarding existe pra trocar a configuração de exemplo pela dela sem ela editar um JSON.

Sucesso do onboarding: ela termina o formulário, abre o agente, e a primeira rodada traz vaga da profissão dela, no mercado que ela escolheu, com o currículo dela na base. O formulário salva os dados nesta instalação. O assistente pode transmitir materiais e respostas para Notion ou sites de candidatura conforme a autorização da pessoa.

## Positioning

O assistente compara os anúncios com o perfil e os critérios da pessoa, mantém uma fila entre sessões e prepara materiais a partir de fatos verificados. Modelo de trabalho, mercado e piso salarial vêm da configuração da instalação. Não inventa experiência para preencher exigências da vaga.

## Operating Context

O fluxo do primeiro uso, e a ordem é fixa:

```
Introdução → Formulário (7 passos, salva local) → Resumo → Confirmação humana → Sucesso com instruções → Agente monta o currículo base e os termos de busca → Primeira rodada → Quadro
```

O formulário grava em arquivos do próprio repositório: `vagas/config/perfil.json`, `vagas/config/linkedin.json`, `vagas/.env`, `Skills/adapt-resume/materiais-fonte/`. O agente lê esses arquivos; nunca repergunta o que o formulário já gravou.

## Capabilities and Constraints

- **Formulário salvo localmente.** O formulário grava respostas e arquivos nesta instalação. A operação do assistente pode usar Apify, Notion e sites de candidatura conforme as conexões e autorizações da pessoa; esse fluxo pode transmitir dados aos respectivos serviços.
- **Token nunca aparece de volta na tela** depois de salvo: o formulário mostra "presente" e oferece trocar.
- **Sem conta, sem login, sem cadastro.** A página abre em `localhost` e pronto.
- **Candidatura automática chega desligada** e só liga por decisão explícita da pessoa.
- **A introdução usa uma ilustração vetorial do fluxo; não há imagem de produto nem marca própria.** O que assina é o nome do projeto. Os outros assets são três prints da Apify, em `docs/img/apify/`.

## Brand Commitments

- **Light mode.** Direção do Carlos, 2026-09-14.
- **Tema neutro do preset shadcn bIkfnxQ.** Direção de Carlos em 11 de Novembro de 2026: botões neutros, Montserrat preservada, sem instalar shadcn/Next. Substitui a direção anterior de botões azuis.
- Texto sem travessão. Mês, dia e período com inicial maiúscula.
- Tom: direto, em português, sem jargão de recrutamento e sem promessa de emprego.


## Product Principles

Coleta e aplicação são frentes independentes. Buscar não concede envio de candidaturas; trabalhar na fila existente não inicia coleta por associação. O ciclo completo respeita a escolha e as autorizações da pessoa.

O Aplicador usa `Skills/adapt-resume/SKILL.md` para adaptar uma cópia da base à descrição real. O arquivo precisa de texto extraível, ordem de leitura e conferência após a importação no portal. Cobertura de termos não é nota de ATS nem garantia de aprovação.

As regras de cada instalação ficam em `REGRAS-DO-PROJETO.md` e são consultadas no início e nas tarefas delegadas. Atualizações pedem confirmação antes de baixar e instalar e preservam dados e regras locais. Após a aplicação, perguntas e retomadas concluídas ou impedimento real registrado, o assistente oferece o Agente de melhorias; com aceite, ele executa correções enxutas apoiadas em problemas registrados.

A próxima integração está documentada em `vagas/FLUXO-DA-RODADA.md`. Código e testes sintéticos não provam login, recebimento de candidatura nem recuperação de DOM em sites reais.

A captura assistida do LinkedIn é beta e opcional. As consultas usam a profissão e os cargos da pessoa; perfil pendente não recebe um título de exemplo por fallback. O login no LinkedIn é obrigatório para Vagas, Postagens e Feed nesta captura assistida. A pessoa entra no painel local e o assistente confere a sessão após seu aviso. O Feed depende da conta e não é filtrado por cargo pelo produto. Ao final de cada frente, o assistente mostra seu resumo: vagas encontradas/adicionadas/descartadas na coleta; envios confirmados/pendências/não enviadas na aplicação.
