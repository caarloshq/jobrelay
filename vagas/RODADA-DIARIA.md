# Rodada diária — ciclo completo

Este é o ponto de entrada da tarefa agendada. A tarefa não contém lógica: ela aponta para este arquivo. A instalação pode executar o ciclo completo ou chamar cada frente de modo independente.

1. Consulte a política local em data/politica-autonomia.json e a operação atual antes de começar. Se outro dono estiver ativo ou desconhecido, preserve abas e estado e aguarde retomada explícita. O modo mapear só busca, lê, pontua e atualiza o quadro; chrome depende da conexão autorizada, do perfil e das autorizações por candidatura. A tarefa opcional de quatro em quatro horas depende do computador e das conexões disponíveis.
2. Siga [Coleta e preparação](../coleta/README.md) para buscar, avaliar e preparar vagas. O quadro local é o padrão; Notion exige a conexão autorizada e um snapshot completo da própria instalação. Apify paga é limitada a uma tentativa por dia, controlada por src/cota-apify.js; uma resposta incerta consome a tentativa e as rodadas seguintes reutilizam o último run.
3. Siga [Aplicação](../aplicacao/README.md) somente nas vagas elegíveis e autorizadas. O maestro/aplicador mantém o navegador e o registro; auxiliares de busca e preparação conservam seus papéis, e a revisão independente confere o pacote. Salve campos efetivamente preenchidos em ../aplicacao/RESPOSTAS-PREENCHIDAS.md com npm run registrar:respostas. Falha de registro bloqueia a transmissão daquela candidatura; rascunho não é envio.
4. Feche a rodada com os estados e evidências previstos nos dois runbooks. Não commite nem publique por efeito automático da candidatura.

Leia também [as regras do subsistema](AGENTS.md) e [as instruções da raiz](../AGENTS.md). Alterar este ciclo significa editar os runbooks, sem mudar a tarefa agendada.
