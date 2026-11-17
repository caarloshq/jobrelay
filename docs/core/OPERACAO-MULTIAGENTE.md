# O maestro distribui trabalho e preserva a autorização da instalação

O processo Node guarda posse exclusiva, identidade de vaga, reservas, fontes, entregas imutáveis, pareceres, estoque pronto e tentativas de transmissão. Ele não inicia agentes nem arbitra o navegador. O assistente distribui os papéis de busca, preparação, revisão e aplicação conforme o plano retornado por `npm run operacao -- planejar`.

Na aplicação, o preparador compõe o pacote e o revisor independente usa o slot existente de revisão para conferir o texto. A fila `revisaoEscrita` separa candidaturas que precisam desse parecer; ela não acrescenta um agente por campo ou por critério. Consulte [Revisor de respostas](../docs/revisor-respostas.md) para fontes, critérios e comandos.

O aplicador confere texto efetivo, estado atual do quadro, anúncio, autorização e formulário. Aprovação editorial não substitui opt-in nem autorização da pessoa. O quadro continua local quando essa for a configuração escolhida. O núcleo retorna `liberadoUI: false` e `liberadoClique: false`; intenção registrada não autoriza clique. Sem confirmação visível da plataforma, não conte envio.
