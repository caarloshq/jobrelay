# Crie a página Puxa Vagas na sua conta

`quadro.json` define a página, as 19 propriedades, os quatro grupos internos e as cinco visualizações do modelo Puxa Vagas. Inclui um único exemplo fictício, `exemplo:vaga-001`, sem currículo, dados pessoais ou oportunidade real. O bundle é a fonte padrão para criação assistida e não exige acesso ao Notion do mantenedor.

Depois de a pessoa confirmar o formulário humano, se escolheu Notion:

1. Use a conexão Notion da própria pessoa. Descubra um destino acessível; se houver mais de um possível, pergunte onde criar. Não peça tokens no chat.
2. Crie a página **Puxa Vagas**, com ícone 💼, as instruções curtas de `pagina.instructions` e a database **Quadro de Vagas**. Use os nomes, tipos e opções de `propriedades`, traduzindo o contrato para a ferramenta disponível. Gere IDs novos. Não copie páginas, vagas, currículos ou IDs do mantenedor. Duplicar um modelo saneado só é alternativa quando ele estiver acessível à conta da pessoa.
3. Configure o layout: somente **Confiança** fixada no topo; depois **Sobre a vaga** com Status primeiro, **Próxima ação**, **Datas** e **Candidatura**. Resumo e Gaps aparecem em blocos próprios. O JSON indica campos vazios a ocultar e campos técnicos ocultos. Não crie uma quinta categoria.
4. Configure **Confiança** como porcentagem de 0 a 1 e barra verde com valor visível: `0.78` deve aparecer como **78%**. Crie as cinco visualizações do JSON, com **Quadro** como entrada de trabalho recomendada. O modelo criado lista Todas as vagas primeiro; reordene apenas se a ferramenta permitir, sem criar uma sexta view. Confira os filtros, não apenas os títulos. O Quadro inclui seis status; Revisar permanece na fonte e em Precisa de atenção. A exibição de colunas vazias depende dos controles da conexão e requer conferência na interface.
5. Crie somente o exemplo fictício indicado e aplique o logo público em `page.icon`, sem capa. Nunca colete, pontue, adapte currículo ou candidate o ID `exemplo:vaga-001`. A importação do snapshot também exclui esse ID do estado operacional. Nas vagas reais, use somente logo oficial comprovado na fonte ou no anúncio. Sem fonte confirmada, deixe sem ícone e registre a limitação no relatório técnico do assistente, sem preencher Pendência operacional, descartar a vaga ou bloquear candidatura; não invente um substituto.
6. Confira o que foi criado. Registre o ID real com `cd vagas && npm run estado -- --fonte notion --database-id ID`. Consulte a database inteira, incluindo o exemplo na consulta, e importe o snapshot pelo procedimento da fonte de estado. A paginação precisa estar completa; a exclusão operacional do exemplo acontece depois da validação. Só então retome a operação.

O salário só recebe valor ou intervalo divulgado no anúncio. Sem informação, use `null`, nunca hífen ou estimativa. A regra completa pertence a [vagas/AGENTS.md](../../vagas/AGENTS.md).

## Confira o suporte da conexão

Este arquivo é um contrato declarativo para o assistente, não um backup nativo importável pelo Notion. Nomes de campos substituem os IDs privados. Filtros, layout, visibilidade e `show_as` precisam ser traduzidos para os controles da ferramenta atual.

Algumas conexões permitem criar porcentagem, mas não configurar a barra, os grupos internos ou todos os detalhes das views. Verifique a capacidade e o resultado antes de anunciar conclusão. Quando faltar suporte, explique o item pendente e oriente o ajuste na interface do Notion: Confiança em porcentagem, exibição em barra, máximo 1 e valor visível; quatro grupos na ordem do JSON; campos técnicos ocultos. Não substitua a barra silenciosamente nem declare paridade visual sem conferência.

O modelo usa 19 campos operacionais. Não transporta as fórmulas legadas Estrelas e Idade nem o botão Concluir. Isso não autoriza excluir propriedades de quadros pessoais existentes. Não altere configurações de candidatura, opt-in ou registros de onboarding ao criar o quadro.
