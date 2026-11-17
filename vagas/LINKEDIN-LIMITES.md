# Respeitar os limites de consulta do LinkedIn

Este procedimento vale para leitura, triagem, coleta e candidatura quando a operação usa o site do LinkedIn. O transporte continua sendo o configurado e autorizado em cada instalação. Esta documentação não instala um limitador no código nem autoriza coleta ou candidatura por si só.

## Consultar primeiro o que já existe

Antes de abrir um anúncio, consultar o quadro, os IDs alternativos, o histórico de candidatura e a descrição já coletada. Não reabrir páginas resolvidas apenas para percorrer uma lista. Quando houver um link oficial de candidatura já identificado, conferir a requisição no portal da empresa, preservando o vínculo com o anúncio original. Um destino parecido não comprova a identidade.

## Manter uma única sequência de navegação

Somente um controlador pode navegar no LinkedIn por instalação. Auxiliares trabalham com as evidências salvas; não abrem páginas em paralelo. Todas as frentes compartilham a mesma cadência, inclusive leitura e candidatura.

Como limite operacional conservador do projeto, deixar no mínimo 30 segundos entre aberturas de anúncios e, após cinco anúncios, pausar a navegação no LinkedIn por no mínimo cinco minutos. Usar esse tempo para ler, registrar e revisar o material obtido ou trabalhar em fontes independentes. Não usar loops que abrem o próximo anúncio assim que a página anterior responde.

Esses tempos são uma escolha local para reduzir consultas repetidas, sem medição de eficácia. Não são uma cota oficial, uma autorização da plataforma nem garantia de evitar restrições. A leitura e a conferência da página continuam obrigatórias; esperar não comprova carregamento nem validade.

## Interromper ao primeiro limite

Ao observar HTTP 429, aviso de excesso de consultas, atividade automatizada ou restrição de conta:

1. Interromper imediatamente a navegação no LinkedIn de todas as frentes. Não completar o lote, recarregar em sequência nem fazer tentativas de teste.
2. Registrar hora com fuso, domínio, URL da vaga sem parâmetros sensíveis, mensagem literal, último anúncio conferido e os IDs ainda pendentes. Não registrar cookies, credenciais ou estado de autenticação.
3. Respeitar o prazo indicado pela plataforma ou Retry-After, quando disponível. Sem prazo, não tentar novamente no mesmo ciclo; preservar o checkpoint para o próximo ciclo ou orientação humana. O fim da espera não dispara uma tentativa automática nem comprova liberação.
4. Continuar apenas trabalho independente: leitura de evidências salvas e consulta aos portais oficiais previamente identificados. Não usar outro navegador, perfil, conta, IP, proxy, sessão ou hostname para tentar acessar o mesmo recurso limitado.
5. Retomar somente depois de conferir a mensagem e a condição de acesso disponíveis, dentro das autorizações da instalação. Restrição de conta ou pedido de intervenção humana permanece pendente até resolução pelo titular.

Não usar stealth, troca de identidade, rotação de IP, cópia de cookies, limpeza de perfil ou nova sessão para contornar o limite. Preservar rascunhos e abas necessários.

## Tratar limite como cobertura pendente

HTTP 429 não prova vaga encerrada, zero resultados ou bloqueio permanente da conta. Não cancelar uma vaga por esse erro. Separar no resumo: anúncio confirmado aberto, inscrição já enviada, incompatibilidade comprovada, duplicata comprovada e validade ainda não conferida. O encerramento de um anúncio do LinkedIn não prova encerramento de outro canal oferecido pela empresa.

Se outro domínio também limitar a consulta, aplicar a mesma interrupção àquele domínio. Não atribuir a origem do erro a uma conta ou plataforma sem evidência.

## Referências da plataforma

O LinkedIn informa que restringe atividade automatizada. As fontes abaixo não oferecem uma cadência que garanta acesso sem limitação:

- [Atividade automatizada no LinkedIn](https://www.linkedin.com/help/linkedin/answer/a1341543).
- [Contrato do usuário](https://www.linkedin.com/legal/user-agreement).

Pausas e consulta ao cache reduzem requisições; não tornam um método automaticamente permitido pela plataforma.
