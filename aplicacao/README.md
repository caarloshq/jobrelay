# Aplicação em vagas

Esta é a entrada independente para preparar, preencher e acompanhar candidaturas já selecionadas. Leia [as regras de respostas](#protocolo-de-respostas), [o perfil](PERFIL.md), [as respostas abertas](RESPOSTAS.md) e [o histórico literal](RESPOSTAS-PREENCHIDAS.md). A [coleta](../coleta/README.md) é uma frente separada; a aplicação não dispara fontes, Apify nem uma rodada.

O maestro/aplicador mantém o navegador e o registro; o preparador devolve rascunho e lacunas; o revisor confere o pacote e devolve falhas. O modo padrão é só mapear. Preenchimento e envio exigem o opt-in e as autorizações locais já definidos na instalação.

## Fontes locais e espelho Notion opcional

O Markdown local é sempre a fonte para preencher. Consulte a preferência de respostas com `cd ../vagas && npm run fonte:respostas -- --estado`; ela é independente da escolha de quadro local ou Notion para vagas. Se o modo for local + Notion, o agente usa a conexão autorizada da própria pessoa para atualizar e conferir a página depois de alterar os Markdown. Antes da alteração, marque a chave do campo com `npm run fonte:respostas -- --pendente <ID>` e marque também `--pendente configuracao`. Depois de espelhar no Notion, compare o conteúdo e o escopo de **ambos** os Markdown com as páginas correspondentes. Somente depois dessa conferência marque `--conferida configuracao` e então `--conferida <ID>`. A primeira confirmação registra os hashes dos dois arquivos; a segunda encerra a pendência específica sem avançar hashes. Se a conexão falhar ou os textos divergirem, mantenha as pendências; não use a resposta afetada. Diferença entre hashes sem chave registrada exige localizar os campos alterados antes de aplicar.

Markdown editado é a fonte editorial. O JSON em `../vagas/data/perguntas.json` e `../vagas/config/perfil-candidatura.json` é projeção técnica, atualizada por `cd ../vagas && npm run respostas -- --exportar`. Se a instalação antiga tem JSON personalizado e recebeu modelos Markdown vazios numa atualização, execute `npm run respostas -- --importar-legado` antes de usar candidaturas. O importador só substitui modelos neutros intactos ou retoma arquivos com bytes idênticos aos gerados do mesmo JSON; recusa Markdown editado à mão. Arquivo ausente, incompleto ou inválido bloqueia o uso, sem voltar silenciosamente ao JSON.

## Candidatar

**Meta e saldo:** consultar `../vagas/data/candidaturas.json`. Priorizar vagas elegíveis e
compatíveis; volume não libera resposta sem fonte ou aprovação. O que depender do
Você vira pendência específica, sem bloquear o trabalho independente nas demais.

### Antes de abrir o navegador

1. Ler o perfil e o banco segundo `RESPOSTAS.md`. Campo conhecido é reutilizado
   apenas dentro de seu contexto; `aprovada: true` não basta sem texto final,
   fonte e escopo compatíveis. Rodar `node ../vagas/scripts/validar-respostas.mjs`.
2. Conferir a vaga viva no anúncio de origem: modalidade, país, idioma,
   obrigatórios e remuneração quando declarada. Conflito de modalidade pede
   resolução na fonte; não aplicar apenas porque o índice é alto.
3. Gerar ou revalidar o currículo pela skill `adapt-resume`, com a descrição da
   vaga e as regras atuais. Nome e idioma de um PDF antigo não comprovam sua
   adequação. Não usar versão que falhe na revisão atual.
4. Preparar as respostas com fontes e registrar o texto exato localmente conforme
   `RESPOSTAS.md`. Pergunta sobre a empresa pode ser pesquisada e rascunhada para
   você conferir; não inventar opinião pessoal. Reunir dúvidas necessárias.

### 🔴 O que a rodada de 2026-08-26 pagou caro para descobrir

**Tecla de verdade chega no Chrome. Setar `.value` por código, não.**
A sequência que funciona é `triple_click` → `Backspace` repetido → `type`. Foi ela
que destravou máscara de moeda, telefone e combobox do React, que estavam paradas
desde a rodada anterior. Setar `.value` com o setter nativo pinta o valor na tela e
o site continua achando que o campo está **vazio**: o envio volta com "campo
obrigatório" embaixo de um campo visivelmente preenchido.

**A máscara de moeda lê os dígitos como reais inteiros, não como centavos.**
Digitar `12000` dá **R$ 12.000,00**. Digitar `1200000` dá R$ 1.200.000,00 e a
o formulário devolve "The value must be less than R$ 300,000.00". Nunca digite ponto,
vírgula ou `R$`: só os dígitos da parte inteira.

**O primeiro clique numa aba recém-navegada é comido pelo foco.**
Depois de `navigate`, o primeiro `left_click` só ativa a aba e não aciona nada.
Dê um clique de aquecimento no mesmo ponto, espere, e clique de novo. Sem isso a
sequência inteira desanda e você acha que a vaga está quebrada.

**Combobox do React não aceita texto colado: aceita filtro e Enter.**
Escrever o valor inteiro no campo faz a lista responder "No options", porque o
texto vira filtro. Limpe, digite um pedaço que só case com uma opção, e pressione
Enter. Clicar na opção por coordenada é o que trocou a faixa salarial de
R$ 10.000 a R$ 15.000 para R$ 8.000 a R$ 9.000: a página rolou entre a leitura e o
clique.

**O Greenhouse pede código de 8 caracteres por e-mail antes de enviar.**
O formulário parece completo, o botão responde, e nada acontece até o código ser
digitado. Ele chega de `no-reply@us.greenhouse-mail.io` com o assunto "Security
code for your application to <empresa>".

**A InHire apaga a página quando a vaga fecha, e o portão de vida não vê isso.**
Oito das oito vagas da InHire vindas do estoque anterior responderam *"Oops, looks
like the link you accessed isn't valid"*. Não existe rótulo de encerrada para o
coletor ler: a URL simplesmente morre. Enquanto o portão não tratar 404 de SPA como
morte, **abra a vaga da InHire antes de contar com ela.**

**O índice não lê presencial nem faixa salarial que está no corpo do anúncio.**
Uma vaga saiu com 79% e era híbrida presencial em São Paulo. Outra
saiu com 44% e paga por demanda UST, R$ 30 a unidade, média de 200 por
mês: bem abaixo da pretensão declarada no perfil. As duas passaram pelo filtro de
remoto. **Confira modelo de trabalho e remuneração na página antes de preencher.**

**Vaga de consultoria costuma ter eliminatória de diploma.**
Uma consultoria reprovou na hora, com `/reproved` na URL, na pergunta de formação
superior. A escolaridade é a declarada no perfil, e isso não muda. Vale conferir a
primeira pergunta antes de investir o preenchimento inteiro.

**Botão que abre a candidatura precisa de dois cliques na Gupy.**
O primeiro `left_click` depois de `navigate` é consumido pelo foco da aba. O segundo
é o que abre `/candidates/applications/...`. Vale para o `Candidatar-se` do topo e
para qualquer botão logo depois de trocar de página.

**O link `Candidatar-se à vaga` do rodapé só rola a página.**
Ele não abre o fluxo: leva até o botão do topo. Clique sempre no do cabeçalho.

**Perfil da Gupy já carrega currículo, nome e telefone.**
Vaga sem pergunta da empresa fecha em seis cliques, sem preencher nada:
Candidatar-se, Continuar, Salvar e continuar, Responder agora, Salvar e continuar,
Finalizar candidatura.

**A tela `Apresente-se!` é opcional e vale a pena.**
Até 1.500 caracteres mais três habilidades escolhidas da lista do currículo. A lista
reflui a cada escolha, então releia as posições entre um clique e outro. O texto
segue `RESPOSTAS.md`: responder ao desafio com experiências pertinentes e prova
concreta. Número não é obrigatório. Responder lacunas quando perguntadas, sem
abrir toda apresentação com uma lista de deficiências.

**A BairesDev não é candidatura, é cadastro de talento.**
Depois do `Apply` ela abre um onboarding de seis passos: experiência com data por
calendário (digitar no campo não funciona), último salário, pretensão, inglês, um
áudio de apresentação em inglês e um teste de raciocínio. Enquanto o áudio e o teste
não forem feitos, o perfil fica `Incomplete profile` e não entra no matching. O áudio
depende de microfone e o teste é avaliativo: **os dois são seu, não do piloto.**

**Chrome bloqueia microfone e câmera por padrão nessa origem.**
A BairesDev responde "Microphone/Camera access denied" e oferece `I'll do it later`,
que preserva o resto do cadastro. Use esse caminho em vez de tentar liberar
permissão de dispositivo.

**A digitação só entra com o Chrome em primeiro plano no sistema.**
Não basta a aba estar selecionada: se outra janela do macOS estiver na frente,
`computer:type` roda, reporta sucesso, e o campo continua vazio. Isso queimou
dois preenchimentos inteiros em 2026-08-31. Antes de cada lote de digitação:

```bash
osascript -e 'tell application "Google Chrome" to activate'
```

**O formulário da Revolut trava no seletor de país, e isso já é padrão.**
Aconteceu em 2026-08-27 e de novo em 2026-08-31, com recarga limpa no meio. O
dropdown de `Current country` monta um `[role=dialog]` que renderiza vazio e
engole todo clique da página; depois de mexer nele, nem mouse nem teclado
passam, e o `Runtime.evaluate` chega a estourar o timeout. Desligar o
`pointer-events` do overlay não resolve. **Não insista: preencha o que dá,
deixe a aba aberta e mande para você.**

**Agregador que exige conta não é caminho de candidatura.** WeWorkRemotely,
Arc e Jobicy escondem o link real atrás de cadastro ou de uma aba que abre
fora do grupo controlado. Quando o anúncio vier de um deles, **procure o board
oficial da empresa** (`jobs.ashbyhq.com/<slug>`, `job-boards.greenhouse.io/<slug>`,
`jobs.lever.co/<slug>`) antes de desistir: foi assim que a Rho foi enviada em
2026-08-31, e foi assim que se descobriu que a vaga da Ingenious.build já
tinha saído do ar.

### Limites e autorizações

- Nunca inventar fato, resposta negativa, experiência ou motivo pessoal. Não
  citar o conteúdo proibido na base de currículo, conforme a skill de adaptação.
- Documentos seguem as fontes privadas e autorizações do perfil, conforme [Dados já existentes e perguntas pendentes](#dados-já-existentes-e-perguntas-pendentes). Não registrar valores em logs, Markdown ou histórico público.
- Antes de usar LinkedIn ou Candidatura Simplificada, conferir a política local, o
  opt-in e a autorização da pessoa para a candidatura. Selecionar o currículo pelo
  idioma e adequação atual à vaga, não apenas pelo nome do arquivo.
- Autodeclaração e consentimento seguem os respectivos blocos do perfil, que
  guardam o alcance autorizado. Consultar somente o atributo perguntado; não
  inferir pronomes ou necessidade de acessibilidade de outro atributo. A
  reutilização de decisões anteriores segue [Dados já existentes e perguntas pendentes](#dados-já-existentes-e-perguntas-pendentes).
- Para “por que esta empresa?”, consultar a permissão de rascunho no perfil e a
  fonte oficial. A pesquisa não comprova motivação pessoal nem autoriza preencher,
  consentir ou enviar; a pessoa confere o texto para cada candidatura.

### Mecânica que já custou erro, e não é opcional

| Regra | Por quê |
|---|---|
| **Uma aba por vez, e ela em primeiro plano** | A digitação vai para a aba **selecionada** no Chrome, não para a do `tabId`. Focar o campo por JS devolve `true` e mesmo assim o texto não entra. Custou dois preenchimentos perdidos |
| **`navigate` sempre com `tabId` explícito** | Sem ele, pega a primeira aba do grupo e destrói o formulário que estava lá |
| **Radio e checkbox por referência, nunca por coordenada** | Coordenada de screenshot envelhece quando a página rola. Foi assim que uma candidatura foi enviada como CLT quando você tinha escolhido PJ |
| **Campo de moeda recebe só os dígitos** | Digitar `12.000,00` na máscara da InHire produz **R$ 1.200.000,00**. Digitar `12000` produz o valor certo |
| **Máscara que embaralha o que foi digitado: pressione `End` entre um dígito e outro** | Em um formulário, a máscara devolvia o cursor ao começo a cada tecla e deslocava os dígitos de telefone e CEP. Digite um dígito, pressione `End` e siga até conferir o valor visível. |
| **Campo com máscara não limpa com Ctrl+A** | O valor antigo fica e o novo concatena. Limpar com `focus()` mais `setSelectionRange` e um Backspace |
| **Recusar o banner de cookies antes de clicar em Continuar** | Cada domínio da Gupy tem o seu, e ele intercepta o clique **sem dar erro**: a página só não avança |
| **Trocar o país do telefone ANTES de digitar o número** | O padrão é `Estados Unidos +1`, e digitar `+55` junto duplica o prefixo |
| **Upload por `file_upload` apontando o input** | Clicar no botão de anexo abre o diálogo nativo do sistema, que não se dirige |

### 🔴 Conte os campos de nome antes de preencher

**Regra registrada em 2026-09-07, na segunda vez que o erro aconteceu** (a primeira
foi em 25/08). Um formulário tinha Primeiro Nome, Nome do Meio e Último Sobrenome,
e o perfil antigo do ATS trazia só o primeiro nome e um sobrenome. O agente aceitou
o que estava lá, e isso manda um nome que não é o da pessoa.

| A tela tem | O que entra |
|---|---|
| Um campo de nome completo | `identidade.nome_completo` do perfil de candidatura |
| Três campos separados | `nome_primeiro` · `nome_do_meio` · `nome_ultimo_sobrenome` |
| Assinatura do currículo | `identidade.nome_profissional` |

**Perfil de ATS que já vem preenchido se corrige, não se aceita.** Campo preenchido
não é campo conferido: o valor pode ter vindo errado de uma candidatura antiga.

### 🔴 Conferência obrigatória antes de clicar em enviar

**Regra registrada em 2026-08-25**, nascida de um erro real: eu declarei a
candidatura da alt.bank pronta com o **currículo não anexado** e a **formação em
branco**.

**A causa não foi desatenção, foi conferir a coisa errada.** Eu validei os campos
que *eu* tinha preenchido, em vez de perguntar ao formulário o que ainda faltava.
E campo atrás de botão `+ Add` **não existe no DOM até alguém clicar**, então
seções inteiras (Formação, Idiomas, Redes) eram invisíveis para a varredura.

Antes de qualquer envio, nesta ordem:

1. Listar os campos **obrigatórios ainda vazios**, nunca os preenchidos.
2. Listar as **seções** da página (`h2`, `h3`, `legend`) e conferir uma a uma.
3. Procurar botão **`+ Add`**: cada um esconde uma seção que pode ser obrigatória.
4. Conferir o currículo por `files.length > 0`, não pela existência do campo.
5. **Tirar screenshot e olhar a página inteira**, rolando se precisar.
6. Validar o registro de respostas pelo comando de `RESPOSTAS.md` e comparar
   com o formulário. Respostas pendentes e autorização de envio ausente bloqueiam.
7. Só então clicar em enviar; registrar sucesso apenas com confirmação da plataforma.

⚠️ **A leitura por código mente sobre upload.** Na alt.bank o input do currículo
reportava `files.length` igual a zero enquanto a tela mostrava o PDF anexado. Foi
o screenshot que desempatou.

### 🔴 Campo com máscara não se preenche por código

**O achado mais caro do dia.** Campo de data, moeda, telefone ou CEP guarda o
estado **dentro da biblioteca de máscara**, não no atributo `value` do HTML.

| Tentativa | O que acontece |
|---|---|
| Setar `.value` com o setter nativo mais eventos | A tela mostra o valor e **o site continua achando que está vazio**. O envio é rejeitado com *"Required field"* embaixo de um campo visivelmente preenchido |
| `KeyboardEvent` sintético, caractere a caractere | A máscara **rejeita e limpa** o campo |
| `computer:type`, teclado de verdade | Funciona, mas exige o **Chrome em primeiro plano no sistema**, e ele perde o foco a cada chamada de ferramenta |

**Como isso apareceu:** na alt.bank, seis campos de data (nascimento e o início
das cinco formações) passaram em toda a conferência por código e foram reprovados
pelo servidor no clique de enviar.

**O que fazer:** usar interação suportada para cada campo e conferir o valor
visível; quando a máscara não funcionar, deixar o campo para você e dizer qual
falhou. Não clicar em enviar só para testar um rascunho sem autorização. Após um
envio autorizado, a confirmação da plataforma decide se a candidatura foi enviada.

### 🔴 Leia o arquivo antes de dizer que falta dado

**Mesmo dia, mesmo tipo de erro:** eu disse a você que não sabia o nome da
escola dele com a formação inteira listada em `base_content_pt.json`, arquivo que
eu já tinha lido na mesma sessão.

Antes de afirmar que um dado falta, procurar nos três:

| O dado | Onde está |
|---|---|
| Formação, certificações, idiomas, experiência | `Skills/adapt-resume/base_content_pt.json` |
| Contato, cidade, LinkedIn, pretensão | `PERFIL.md` |
| Nascimento, endereço, autodeclaração | `../vagas/data/dados-pessoais.json` (fora do git) |

E um detalhe que muda o preenchimento: **curso e bootcamp não são "ensino
médio"**. No formulário eles entram como `Certification`; `High school` fica só
para o ensino médio de verdade.

### Depois que a candidatura é enviada

1. Status no quadro vira **`Aplicado por IA`** (`quadro.mover(id, 'Aplicado por IA', { por: 'agente' })`). Ele é terminal em
   `../vagas/src/arquivo.js`, então a vaga não volta ao radar.
2. `Currículo (caminho)` recebe o PDF usado.
3. `Gaps` recebe o que foi respondido, **em especial o que não pode ser editado
   depois**, que é o caso das perguntas de empresa da Gupy.
4. O `ID externo` entra em `../vagas/data/candidaturas.json`.
5. Guardar a resposta exata e a confirmação em `../vagas/data/respostas-enviadas/`, como
   define `RESPOSTAS.md`. Pergunta nova entra no banco antes de ser usada; aprovação
   posterior não é autorização retroativa para enviar um rascunho.

### O relatório final

Além do de sempre, dizer: **quantas foram enviadas, quantas ficaram em aba, e o
que falta em cada uma para você fechar.**


## Registrar respostas antes de retomar

O maestro/aplicador salva no histórico literal somente perguntas e valores efetivamente preenchidos, inclusive em candidaturas em rascunho. Perguntas profissionais pendentes ficam na primeira seção de [RESPOSTAS.md](RESPOSTAS.md); campos objetivos pendentes ficam na primeira seção de [PERFIL.md](PERFIL.md), junto de fonte, escopo e estado. Não crie um terceiro arquivo editável de pendências. O revisor aponta lacunas antes da liberação; falha de registro bloqueia somente a candidatura afetada. A comparação com o formulário é responsabilidade do agente e não é automatizada pelo validador.

---

## Protocolo de respostas

Este protocolo decide como transformar fatos em respostas. O perfil guarda fatos e autorizações; o banco
guarda perguntas, textos e o alcance de cada aprovação.

## O registro obrigatório é o Markdown do que foi preenchido

Depois de preencher e conferir um campo, o maestro/aplicador salva a pergunta e o texto literal em `RESPOSTAS-PREENCHIDAS.md`, inclusive quando a candidatura continua em rascunho. Use `cd ../vagas && npm run registrar:respostas` com o pacote por stdin ou `--arquivo`, conforme o protocolo operacional. `preenchida:true` significa que o aplicador conferiu o valor no formulário; o comando não captura o Chrome. Se a gravação falhar, não avançar para transmissão da candidatura até resolver.

Esse é o único novo registro obrigatório do preenchimento. Não criar outro banco ou JSON por causa desse passo. Bancos, perfis, filas e históricos já existentes continuam preservados para fatos, autorizações, retomada e validações das candidaturas que já os usam. O Markdown guarda texto exato e não substitui autorização, prova de envio nem a fonte dos fatos. Não criar `vagas/respostas.md`, que pode colidir com este arquivo em sistemas sem distinção de caixa.

Entrada do comando: `contexto` com empresa, vaga, id e data YYYY-MM-DD; `campos` com pergunta, texto e `preenchida:true`. Campos não preenchidos ficam fora do texto dado. Respostas multilinha são preservadas integralmente; repetição idêntica não duplica; correção posterior acrescenta histórico. Documento e autodeclaração sensível usam somente `referenciaPrivada`, sem copiar valor. As pendências existentes continuam em seus controles, sem inventar resposta no Markdown.

## Fontes e limites

- Trajetória: `../Skills/adapt-resume/base_content_*.json` e materiais-fonte.
- Preferências, remuneração, autorizações: `PERFIL.md`.
- Dados pessoais: `../vagas/data/dados-pessoais.json`, fora do git. Não copiar esse
  conteúdo para relatórios, exemplos nem para o banco de perguntas.
- Texto aprovado: `RESPOSTAS.md`, somente dentro de seu `escopo`.
- Empresa e desafio: anúncio completo e página oficial, com URL e data de consulta.

Ausência no currículo significa **não confirmado**. Não demonstra ausência de
parentesco, participação societária, experiência anterior, idioma ou contribuição
open source. Um vínculo confirmado para uma empresa não responde sobre outra.
Cargo anterior não é empresa atual; último salário não é remuneração atual.

## Dados já existentes e perguntas pendentes

O perfil continua sendo a fonte dos fatos e autorizações. O banco e os históricos estruturados já usados pela instalação podem ser preservados e consultados; eles não são um novo requisito para salvar o que foi preenchido. O maestro mantém os bloqueios de perguntas sem resposta e distingue pendente, respondida e aplicada. Omissão numa lista nova não resolve uma pendência. A confirmação de envio exige prova externa; não é inferida de um Markdown ou JSON.

Antes de perguntar por um dado pessoal, documento ou consentimento, consultar as fontes privadas e as decisões já registradas nesta instalação ou na conversa ativa. Verificar o dado ou texto aprovado, sua origem, validade, escopo, finalidade e destinatário. Se a decisão anterior ainda cobre o uso presente, reutilizá-la sem pedir confirmação idêntica; o valor sensível continua fora dos registros públicos. Se faltar o dado ou a autorização, ou se o formulário pedir outro uso, destinatário ou alcance, deixar a pendência específica para a pessoa. Uma preferência reutilizável não substitui a confirmação que a ferramenta exige no momento da ação: ler novos termos legais, aceitar uma nova versão, autenticar-se ou resolver CAPTCHA continuam no fluxo próprio. Não contornar essas etapas nem inferir aceite de uma autorização parecida. O opt-in local e a autorização de envio permanecem necessários.

O registrador Markdown não captura o navegador nem descobre campo omitido pelo aplicador. Cabe ao revisor comparar as perguntas e textos com os campos visíveis. Bancos, perfis e quadro de exemplo são versionados na distribuição; revise arquivos personalizados antes de publicar sua cópia. O histórico literal de aplicação é local.

Depois de concluir o trabalho independente nas candidaturas autorizadas, reúna as perguntas pendentes para confirmação. Cada cartão interativo trata de um único assunto ou decisão, com opções clicáveis quando couber; não peça várias respostas no mesmo cartão. O bloco final pode organizar os cartões por candidatura. Mostre a pergunta e as alternativas literais, apresente uma sugestão apoiada nas fontes e mantenha a pendência até a pessoa confirmar. A sugestão não substitui as permissões da instalação para preencher ou enviar.

## O que se reutiliza

| `uso` no banco | Procedimento |
|---|---|
| `direta` | Usar o texto final somente com `aprovada: true`, fonte e escopo compatíveis. |
| `contextual` | Ler anúncio, pergunta e opções. Compor resposta para essa candidatura; conferir antes de enviar. |
| `pessoal` | Usar apenas declaração ou autorização explícita sua, nunca dedução de outro atributo. |
| `documento` | Consultar a fonte privada e a autorização compatível conforme [Dados já existentes e perguntas pendentes](#dados-já-existentes-e-perguntas-pendentes); sem elas, deixar para você. |

`resposta` contém apenas o que alguém poderia ler no formulário. Orientações
ficam em `instrucao`; relatos antigos, em `registro_anterior`. Texto alterado que
mude conteúdo ou sentido volta para conferência. Aprovação de uma estrutura não
aprova automaticamente a resposta nova. `aprovada: false` nunca autoriza envio.

Pergunta nova factual: procurar primeiro nas fontes. Se o fato estiver confirmado,
preparar a resposta e registrar a origem; se depender de opinião, decisão ou dado
ausente, perguntar. Não interromper por informação já confirmada no mesmo contexto.

## Como escrever sem um roteiro fixo

1. Identificar o que a pergunta quer avaliar e o que a vaga pede. Distinguir
   requisito obrigatório, desejável e contexto da empresa.
2. Selecionar uma ou duas experiências que respondem a isso. Cada afirmação deve
   apontar para uma fonte do perfil; fatos da empresa apontam para a fonte oficial.
3. Responder a pergunta na primeira frase. Descrever ação, contexto e efeito
   comprovado. Número só entra com origem e crédito correto, nunca por obrigação.
4. Ajustar tamanho ao campo. Resposta binária pode ser só “Sim” ou “Não”; campo
   condicionado pode ser “Não se aplica”. Não acrescentar uma defesa desnecessária.
5. Conferir idioma, limite de caracteres e alternativas reais. Não traduzir nem
   reescrever rótulos de alternativas. Campo livre usa português com acentos ou o
   idioma solicitado pela vaga.

Apresentação livre não tem parágrafo obrigatório sobre a sua empresa atual. A
experiência vem da pergunta, e não de uma sequência universal. Se trocar o nome
da empresa não muda nada no argumento, conferir se faltou uma conexão real.

Não esconder lacuna perguntada nem iniciar toda apresentação por uma lista de
deficiências. Experiência transferível não vira experiência direta. Um resultado
da plataforma ou da equipe não vira resultado individual seu.

### Por que esta empresa?

Com `rascunho.pode_rascunhar` incluindo "por que esta empresa" no perfil, o agente
pode pesquisar e preparar um rascunho para conferência. Ler a vaga e ao menos uma página oficial pertinente. Registrar a URL,
o fato observado e sua ligação com uma experiência confirmada. Não inventar
admiração, uso do produto, afinidade cultural nem motivação pessoal. Se não houver
evidência suficiente, fazer uma pergunta específica. O texto fica pendente até
você conferir aquela candidatura. Teste pessoal, vídeo e proibição expressa de
IA no processo continuam fora dessa autorização.

## Antes de preencher e enviar

1. Executar `node ../vagas/scripts/validar-respostas.mjs` para conferir a integridade do banco.
2. Para cada resposta efetivamente preenchida, salvar o texto exato no Markdown pelo comando acima. Se a candidatura já usa registro em `../vagas/data/respostas-enviadas/`, mantê-lo coerente sem alterar o que foi enviado; não criar novo JSON apenas para cumprir o salvamento em MD. Excluir documentos
   e autodeclarações sensíveis do registro; guardar somente a indicação de que
   foram tratados no perfil privado.
3. Quando houver registro estruturado da candidatura, executar `node ../vagas/scripts/validar-respostas.mjs --candidatura <arquivo.json>`.
   Esse comando verifica estrutura e bloqueios conhecidos, não comprova os fatos
   nem substitui a leitura editorial e a conferência no formulário.
4. Comparar o texto registrado com o campo preenchido; conferir currículo, opções,
   moeda, regime, nome e seções obrigatórias. Verificar autorização de envio e
   resolver qualquer resposta que ainda aguarde você.
5. Só registrar `enviada` depois da confirmação da plataforma. Guardar data e
   evidência da confirmação. Formulário preenchido é rascunho, não candidatura enviada.

O comando com `--modelo` imprime o formato do registro sem criar candidatura.
Relatos históricos resumidos permanecem históricos; não reconstruir uma frase e
afirmar que foi exatamente a enviada. Antes de reutilizar PDF do acervo, executar
o verificador atual e conferir a adaptação à vaga.

## Revisão de escrita antes do uso

Antes de apresentar uma sugestão, responder em campo aberto ou preencher o formulário, aplicar [review-escrita](../Skills/review-escrita/SKILL.md) ao texto autoral. Conferir voz, clareza e cada afirmação com as fontes. O verificador mecânico lê um arquivo de texto local; perguntas, alternativas literais, metadados e respostas históricas não são rascunhos para reescrita. A revisão não aprova opinião, declaração pessoal nem consentimento.

Se uma resposta enviada revelar atribuição indevida, promessa sem prova ou texto genérico, preservar o histórico efetivo e a confirmação. Corrigir a versão reutilizável em Respostas ou Perfil dentro do alcance aprovado, com fonte e nova revisão. A correção não altera o que foi enviado nem amplia autorização.


A revisão editorial das respostas usa o agente independente e o parecer descritos em [Revisor de respostas](../docs/revisor-respostas.md).
