---
name: review-escrita
description: Revise textos que uma pessoa vai ler no JobRelay, como resumos de vaga, gaps, currículo adaptado e respostas de candidatura.
user-invocable: false
---

# Revisão de escrita

Use esta passada depois de conferir os fatos e antes de publicar um resumo, entregar um currículo ou preencher uma resposta aberta. Ela avalia clareza, prova e adequação à voz de quem assina. Não substitui a verificação técnica do PDF, a leitura da vaga nem a autorização para candidatura.

## Fontes e limites

1. Siga o pedido atual e o tom aprovado pela pessoa usuária.
2. Confira cada fato na base de currículo, nos materiais que a pessoa forneceu ou na descrição oficial da vaga. A vaga prova o requisito; não prova que a pessoa o atende. Não atribua à pessoa QA, validação, pesquisa, entrevista, liderança ou outra atividade apenas porque o anúncio a pede.
3. Preserve idioma, cargo, datas, empresas, números e termos técnicos verdadeiros. Não acrescente experiência para preencher lacunas.
4. Quando faltar prova, registre o requisito em `gaps` ou peça a informação. Não converta ausência de prova em uma frase plausível.

Não analise como texto autoral a descrição copiada do empregador, código, JSON de configuração, perguntas e alternativas literais do formulário ou registros internos. Revise apenas o texto que o JobRelay escreveu para alguém ler. Para currículo, leia `content.json` como fonte e extraia **somente** as frases autorais alteradas (`summary`, `headline`, linhas de skills/ferramentas e bullets) para um arquivo de revisão dentro de `builds/<empresa>/`; passe esse arquivo ao verificador. Não rode o verificador no JSON bruto nem copie metadados, contatos ou perguntas.

## Passada

1. **Delimite o texto e seu leitor.** Diga se revisa card, currículo, campo aberto ou outra peça. Leia a voz e o idioma já escolhidos pela pessoa. A fonte da voz pertence à instalação: materiais e exemplos aprovados pela pessoa em `Skills/adapt-resume/materiais-fonte/` ou instrução explícita da conversa. Sem fonte de voz, use linguagem direta e neutra; não invente uma personalidade.
2. **Faça a varredura mecânica.** A partir da raiz do repositório, rode `cd vagas && npm run revisar:escrita -- <arquivo>`. Para vários arquivos, acrescente os caminhos. O comando retorna achados com linha e sugestão. Ele não avalia verdade, autoria ou qualidade do texto.
3. **Leia como editor.** A primeira frase entrega o fato ou a decisão? Cada frase acrescenta informação? O texto diz quem fez o quê, com qual resultado observável? Resultado, comparação e número têm fonte? A voz pertence a esta pessoa? A última frase traz informação ou uma próxima ação específica? Em interface, o rótulo diz o efeito e o erro diz como recuperar?
4. **Reescreva a unidade de sentido.** Trocar um adjetivo por outro não resolve uma afirmação vazia. Preserve o que a fonte comprova e deixe a lacuna visível. Um achado mecânico pode ser legítimo em nome próprio, citação ou termo técnico; registre a justificativa quando o mantiver.
5. **Revise de novo.** Rode a varredura após a edição e confira manualmente prova, voz, ritmo e sentido. Um resultado sem achados do script não aprova o texto por si. Em resposta de candidatura, conclua esta passada antes de apresentar a sugestão, preencher o campo ou salvar o texto como resposta final.

## Saída para revisão

| Onde | Trecho atual | Reescrita | Prova ou lacuna |
|---|---|---|---|
| Resumo, primeira frase | “Solução robusta para qualquer equipe” | “O quadro mostra as vagas que aguardam leitura” | Confirmar que o quadro tem esse estado |

Use `Bloqueia` para fato inventado, requisito omitido ou afirmação sem fonte que mude a decisão; `Deveria` para clareza, repetição ou voz que prejudique a leitura; `Considera` para melhoria opcional. Se não houver alteração, diga quais itens foram verificados. Não invente uma falha para preencher a tabela.

No currículo, a cópia `builds/<empresa>/content.json` continua sob a skill `Skills/adapt-resume/SKILL.md`, dona da base, do gerador e do verificador final. Histórico de respostas enviadas registra o que de fato saiu; revisão posterior corrige padrões reutilizáveis sem reescrever esse histórico.
