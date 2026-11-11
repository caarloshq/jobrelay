# Coletar e salvar antes de aplicar

Coleta e aplicação são frentes independentes. Uma seleção isolada executa somente a frente escolhida. Com ambas selecionadas, o maestro conclui toda a coleta aplicável, salva e relê os destinos configurados, organiza os arquivos e apresenta o resumo. Só então inicia a aplicação. Esta é a diretriz vigente; substitui o paralelo da spec 008.

A escolha fica em `data/politica-autonomia.json`, campo `frentes`: `["coleta"]`, `["aplicacao"]` ou `["coleta","aplicacao"]`. Instalação antiga sem esse campo mantém o ciclo completo em sequência. Modo `mapear` não autoriza candidaturas. Pedido de uma única frente não altera a preferência salva por associação.

`npm run coordenar:frentes -- --capacidade 4` somente planeja. Informe a capacidade operacional realmente disponível de 1 a 4. Cada frente usa até duas posições: responsável e auxiliar de triagem na coleta; Aplicador e Revisor de candidatura na aplicação. O maestro que executa ocupa posição. A limitação menor do runtime prevalece. Sem posição de revisão disponível, aguardar; não aprovar o próprio trabalho.

O Aplicador aciona a skill de currículo. Currículo, atualização, dedup e registro são ferramentas, sem agentes extras. O Agente de melhorias, quando aceito depois da aplicação, reutiliza uma posição liberada.

## Uma operação e um controlador

Conferir posse e chats concorrentes antes de operar. Auxiliares recebem somente arquivos e permissões necessárias, nunca o token principal. Uma única pessoa/agente controla o navegador; revisão e preparação podem trabalhar sobre evidências sem disputar a UI. Conferir vaga, aba, etapa, fontes e checkpoint antes de agir. Não tomar sessão de outro dono por timeout.

Captura LinkedIn vem depois das fontes padrão e complementares aplicáveis. Contar somente atividade observada: Jobs 15min, Postagens 12min, Feed 3min. Login, pausas e espera não somam. O opt-in é separado da Apify; sem token Apify, as demais fontes não param.

## Fronteira entre coleta e aplicação

`src/coordenacao-frentes.js` mantém o orçamento e serializa o navegador. `executarFrentes` executa callbacks em sequência. O callback de coleta só termina após gravação, releitura e organização e devolve `{localConfirmado:true,destinoConfirmado:true,arquivosOrganizados:true,provaRef}`. No modo só local, destinoConfirmado refere-se à releitura local; com Notion, exige a conferência de ambos. O recibo é um atestado do adaptador, não uma consulta feita por Node ao Notion.

Sem esse recibo, a aplicação não inicia. Fonte individual indisponível pode gerar coleta parcial verdadeira; divergência ou escrita incerta nos destinos exige reconciliação. Rascunhos existentes são preservados. `CoordenadorFrentes.concluirColeta` protege a mesma fronteira para o despacho nativo. A aplicação isolada dispensa nova coleta e revalida a fila existente.

Na aplicação, preparar o rascunho e entregar a versão exata ao Revisor. Enquanto ele confere A, o Aplicador pode preparar B. Apenas um aceite válido da vaga, fontes e versão libera o envio correspondente; recibo do portal é obrigatório para contar candidatura. Pendência pessoal não para a passagem nas outras vagas.

O controle `npm run rodada:lote` registra cobertura, fase de perguntas, aceites e encerramento. Seus JSON de entrada são atestados do chamador; não substituem leitura de regras, fonte atual, observação de formulário ou prova externa. Depois de esgotar trabalho independente, apresentar perguntas pessoais, retomar as vagas liberadas e fechar com provas. Só então oferecer o Agente de melhorias, com aceite próprio. Não oferecer melhorias da coleta.
