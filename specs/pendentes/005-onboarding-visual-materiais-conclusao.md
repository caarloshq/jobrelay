# Onboarding explica o produto e termina com a passagem ao assistente

**Data:** 2026-11-11 · **Projeto:** JobRelay

## Objetivo e autorização

A pessoa usuária aprovou no chat o plano de sete etapas e a remoção de “sua área em uma frase”. Confirmou currículo obrigatório, LinkedIn e adicional opcionais. Implementação local, sem commit, push, release, criação de database ou agendamento real nesta rodada. Preservar os dados preenchidos pelo humano. O formulário continua obrigatório e pessoal; não simular seu preenchimento.

## Plano aprovado

1. Abertura visual ilustrada explica busca, avaliação e preparação com assistente antes do formulário.
2. Materiais: currículo obrigatório e LinkedIn opcional aceitam PDF/DOCX. Adicional opcional aceita PDF/DOCX/TXT; exibir PDF ou DOCX como formatos principais. Descrições enxutas. Validar e extrair no servidor, além da tela.
3. Retirar profissão repetida, reutilizar cargo e mostrar senioridades em duas colunas.
4. Salários em linhas separadas, com descrições curtas.
5. Ícones nas opções; Notion sem ID/link e com criação assistida posterior. Switch de recorrência (4h, desligado por padrão) e atualização automática (recomendada), respeitando a preferência na operação. Não confundir com checagem agendada de releases.
6. Resumo sem instruções; confirmação bem-sucedida abre sucesso com copiar/baixar instruções para o assistente que aguarda.
7. Conferir integração, formatos, escolhas persistidas, falhas recuperáveis e documentação do runbook.

## Critérios e limites

- Todos os formatos suportados têm validação real e extração de texto, sem gravar arquivo inválido silenciosamente.
- Currículo sozinho permite seguir; falta dele impede avanço com orientação curta.
- Notion pode ficar pendente de criação sem fabricar database; operação aguarda a conexão real e o ID gravado pelo assistente.
- Switch de atualização controla a consulta automática antes da rodada, preservando atualizações manuais e proteções existentes.
- Sucesso só aparece após resposta positiva de confirmação humana. Erros não avançam a tela.
- Não mostrar mensagens cruas de rede; orientar abertura pelo servidor local e recarga quando necessário.
- Verificação técnica usa fixtures separadas; não preencher o onboarding da pessoa usuária via API ou navegador automatizado.

## Fontes e reuso

Estender onboarding/index.html, vagas/scripts/onboarding.mjs, onboarding-autonomia.js, fonte-estado.js e entrada executar.mjs. Preservar Montserrat, tokens e controles existentes documentados em DESIGN.md. Ilustração vetorial explicativa nova, autorizada pelo pedido. Updater existente já consulta releases antes da operação; falta preferência explícita.

## Estado

Plano aprovado; implementação em andamento. Gate visual/review ainda não executado.

## Ampliação aprovada no chat

8. Exportar modelo do quadro Notion: somente propriedades, opções, visualizações e uma vaga fictícia, sem IDs privados ou vagas reais. O bundle consolidado define 19 propriedades operacionais, quatro grupos internos e cinco visualizações. Confiança usa porcentagem; a barra nativa segue pendente de ajuste pela interface quando a conexão não expõe esse controle. Fórmulas e botão legados ficam fora do modelo novo, sem autorizar exclusão em quadros pessoais existentes.
9. Portar ao público o navegador headless isolado adotado em 10/11 no privado e implementar intervenção humana para login no mesmo perfil. A pessoa usuária aprovou explicitamente o porte e acesso humano após esclarecimento da restrição anterior. LinkedIn e Gupy opcional; login social apenas se disponível na página. Não executar logins reais nesta implementação.

### Coordenação

Subagente interno `localizar_navegador`: primeiro investigou a fonte privada e agora implementa somente wrapper genérico, CLI, documentação própria e testes novos de navegador. Integração em package, onboarding e runbooks pelo chat principal. Sem novo chat e sem commit/push.

## Operação de branches autorizada separadamente

A pessoa usuária pediu avaliar, integrar e remover branches sem utilidade. `codex/operacao-multiagente` (af48295) era ancestral da main e32a205, com zero commits exclusivos. Removida do remoto após inspeção. `git ls-remote --heads origin` confirmou somente main. Nenhum conteúdo local do onboarding foi publicado.

### Ajuste de texto aprovado

Na introdução, explicar explicitamente que o assistente pode se candidatar pela pessoa, se ela quiser e autorizar. Pedido da pessoa usuária durante a implementação.

Botão Começar configuração centralizado na barra inferior da introdução, conforme ajuste da pessoa usuária durante a implementação.


## Revisão de escrita solicitada

A pessoa usuária pediu retirar a frase técnica do cabeçalho e aplicar review-escrita em todo o onboarding. A frase saiu; a regra de preenchimento humano permanece funcional. Revisados títulos, descrições, campos, erros, resumo, sucesso, instruções e documentação alterada. Removidas repetições da abertura, jargão de releases da interface, instrução de voltar inexistente na tela de sucesso e afirmação prematura de quadro Notion criado. Os prompts técnicos para o assistente mantêm comandos e salvaguardas; ficam fora da varredura editorial mecânica conforme a skill.


## Evidências atuais

- 46 testes de materiais, onboarding, HTTP isolado, fonte de estado, atualização e navegador: zero falhas em revisoes/onboarding-2026-11-11/testes-conjunto.txt.
- Após os últimos ajustes de copy e remoção do cabeçalho, seis testes de sintaxe/escolhas e integração HTTP passaram; arquivo testes-final-copy.txt.
- Detector estático da interface: lista vazia, detector.json. Não equivale ao gate visual completo.
- Review-escrita autorizado pela pessoa usuária: leitura editorial aplicada em toda a interface e documentação alterada. Varredura final sem achados na interface; um falso positivo na documentação, pois o regex de gerúndio identifica o substantivo “comando” como verbo. Registro em review-escrita-depois.txt; não alterar o script para mascarar o resultado.
- Abertura renderizada no navegador local, com botão centralizado. Materiais/senioridade/salário/quadro/sucesso ainda precisam de conferência visual conjunta.
- Testes HTTP usam instalação fictícia separada dentro do projeto; nenhum registro humano foi criado na instalação usada pela pessoa usuária.
- Nenhuma criação real de database, tarefa, login ou candidatura foi executada.

## Pendências de revisão

Conferência visual das etapas internas e login real no dashboard após confirmação humana. O modelo Notion consolidado contém 19 campos, quatro grupos e cinco visualizações. O JSON descreve a barra desejada, mas o source nativo confirma somente o formato percentual; o ajuste da barra continua manual e sem comprovação visual. Sem alegação de paridade nativa integral.

Diagnóstico real: npm ci instalou a dependência local; wrapper recusou iniciar porque Chrome/Chromium não está instalado nos caminhos suportados. Nenhum browser foi baixado. O painel e os logins reais permanecem sem teste nesta máquina; informar esse limite na entrega.
