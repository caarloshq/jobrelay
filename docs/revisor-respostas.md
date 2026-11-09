# Um revisor independente confere cada resposta antes do preenchimento

O maestro mantém a responsabilidade pela candidatura e usa a posição de revisão existente para um agente cuja única tarefa é revisar o texto. Preparador escreve; revisor lê e aprova ou devolve achados; aplicador confere o campo efetivo e a autorização. Não crie um agente por critério. O Node valida os registros e não inicia agentes sozinho.

O revisor lê `aplicacao/RESPOSTAS.md`, `aplicacao/PERFIL.md`, as fontes factuais de cada campo e `Skills/review-escrita/SKILL.md`. Leia a fonte de voz aprovada da instalação, quando existir. Sem essa fonte, use a linguagem direta e neutra da skill de escrita; nesse caso a mesma skill ocupa os papéis `voz` e `escrita`. Não importe exemplos ou orientações pessoais do mantenedor.

Dentro de `vagas/`, rode `npm run validar:respostas -- --preparar-revisao caminho.json` para produzir `fontesEscrita`, `pacoteRespostas` e `hashPacote`, sem aprovação. Os caminhos das fontes factuais e `fonteVoz`, quando informada, são relativos a `vagas/` ou absolutos dentro desta instalação. Copie `fontesEscrita` para a candidatura e informe `autorRespostas`. Vetos específicos da pessoa podem constar em `vetosEscrita`; não são regras globais.

O parecer em `revisaoEscrita` registra `revisor`, `hashPacote`, `decisao` (`aprovado` ou `reprovado`), `achados` e `criterios`. Cada eixo `pergunta`, `clareza`, `fatos`, `voz` e `escopo` contém `{ "ok": true, "evidencia": "explicação específica do trecho e da fonte conferidos" }`. O revisor deve ter identidade diferente do autor. Evidência aponta literalmente a pergunta, o texto ou a fonte, ou cita um trecho exato. O conjunto de evidências precisa cobrir todas as perguntas ou textos do lote; para campos literais curtos, identifique o índice com `[campo:0]`. Flags e uma frase genérica não substituem a leitura editorial. A guarda de completude não comprova que um agente leu nem mede qualidade por regex.

Na operação, entregue `tipo: candidatura` com `pacoteRespostas` e as fontes fixadas. O plano encaminha à posição `revisaoEscrita`; a ação `revisar` exige o parecer estruturado além da revisão do manifesto. Um parecer aprovado precisa ter todos os critérios aprovados e `achados: []`. Edição de pergunta, texto, contexto, limite, opções, vetos ou fontes invalida o hash e exige nova revisão. A CLI também recalcula os hashes das fontes da instalação. Histórico efetivamente enviado permanece literal.

Rode `npm run validar:respostas -- --candidatura caminho.json` antes do próximo uso. Formulário sem respostas não exige parecer fictício. Aprovação editorial não concede consentimento, não resolve pendência pessoal, não autoriza envio e não libera controle do navegador. Opt-in, autorização da pessoa, estado do quadro, preflight e prova da plataforma continuam obrigatórios.

Veja [aplicação](../aplicacao/README.md) e [operação multiagente](../vagas/OPERACAO-MULTIAGENTE.md).
