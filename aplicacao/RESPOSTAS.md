<!-- jobrelay-fontes-v1:respostas -->
# Respostas profissionais

```jobrelay-banco
{
  "total": 0,
  "metadados": {
    "_nota": "Banco de perguntas e respostas de candidatura. Chega vazio. Protocolo: RESPOSTAS.md. Aprovação se aplica ao conteúdo e ao escopo, nunca a qualquer pergunta parecida.",
    "_como_funciona": [
      "Ler pergunta, contexto, idioma e alternativas reais.",
      "Usar resposta direta aprovada somente dentro do escopo e com fonte.",
      "Resposta contextual exige composição e conferência para aquela candidatura.",
      "Resposta ausente ou não aprovada não autoriza envio; instrução não é texto de formulário.",
      "Executar scripts/validar-respostas.mjs e guardar o texto final conforme RESPOSTAS.md."
    ],
    "_por_que_vai_no_git": "Como o semantico.json: o custo aqui é você ler e responder cada pergunta uma vez, e isso não se reconstrói rodando de novo.",
    "_tipos": {
      "objetiva": "Resposta curta e factual. Vira resposta pronta fácil.",
      "dissertativa": "Texto livre. Pode virar resposta pronta se for genérica; se citar a empresa, nunca.",
      "autodeclaracao": "Somente atributo declarado e autorizado por você; fonte privada. Não inferir outros atributos.",
      "consentimento": "Respeitar escopo da autorização em config/perfil-candidatura.json; opcionais precisam decisão própria."
    },
    "_formato_de_cada_entrada": {
      "pergunta": "o texto exato como apareceu na tela",
      "normalizada": "chave sem acento, minúscula e sem pontuação, para casar variações da mesma pergunta",
      "ats": "onde ela apareceu",
      "campo": "o name do campo no formulário, quando existir",
      "tipo": "objetiva, dissertativa, autodeclaracao ou consentimento",
      "resposta": "o que responder. null quer dizer que ninguém respondeu ainda",
      "aprovada": "false até você conferir. Só true preenche sem parar",
      "vezes_vista": "quantas vezes apareceu, para saber qual responder primeiro",
      "primeira_vez": "data",
      "ultima_vez": "data",
      "uso": "direta, contextual, pessoal ou documento",
      "escopo": "contexto para o qual a resposta se aplica: geral, nome da empresa, país, regime ou moeda",
      "fonte": "origem factual: caminho de arquivo, URL, ou confirmação sua com data"
    },
    "atualizadoEm": null
  }
}
```

## Respostas pendentes


## Respostas disponíveis


# Arsenal de entrevista

Base de respostas de entrevista e de perguntas abertas de candidatura: trajetória, projetos, forma de trabalhar e motivação. Junto com o currículo, é daqui que saem as respostas abertas das candidaturas. Pergunta aberta sem resposta é registrada no banco e aparece em Respostas pendentes, no topo deste arquivo. Quando você responde, a resposta é gravada nesse registro pelo fluxo normal, e a versão em fala entra no fim desta seção, depois da última pergunta numerada (a primeira vai logo após Regras de uso). Dados objetivos, como pretensão, data de início e respostas de sim ou não, ficam no Perfil.

Formato de cada pergunta:

- Título `## N. <pergunta>`, com a pergunta como um entrevistador faria.
- Resposta em fala, em primeira pessoa, num bloco de citação (`> `). Parágrafos curtos.
- Escrita a partir das suas palavras e passada pela revisão de escrita (Skills/review-escrita) antes de ser usada.
- Se já existe uma pergunta equivalente, completar a resposta dela em vez de criar outra.
- Não use blocos de código com etiqueta `jobrelay` nesta seção: eles são reservados aos dados do arquivo.

## Regras de uso

Restrições factuais que valem para todas as respostas, como números que podem ou não ser citados.
