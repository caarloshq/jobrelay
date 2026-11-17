# A candidata 1.4.0 preserva dados e exige onboarding humano

## Objetivo e limite

Preparar os commits e testar a próxima release. A preparação não publica tag, release, pacote remoto nem altera a visibilidade do repositório. Perfis preenchidos, sessões, materiais pessoais e datasets de teste ficam fora dos commits e do ZIP.

## Organização

1. Preservar os commits funcionais já revisados e o histórico publicado.
2. Separar correções de segurança e compatibilidade de atualização dos metadados da versão.
3. Validar o pacote limpo e produzir o artefato local para revisão antes do lançamento.

## Correções verificadas

- O POST de status aceita JSON e rejeita origem externa ou `null` antes de alterar o quadro. O proxy Node local permanece compatível.
- Modelos de configuração ficam em `docs/`; configurações locais são opcionais e não são substituídas. O delta desde a release estável v1.3.0 não toca caminhos pessoais protegidos.
- Atualização automática permanece ativa por padrão e respeita o desligamento explícito. Sem confirmação humana válida do onboarding, a operação é bloqueada.
- A documentação distingue o quadro operacional da prévia Astro experimental e identifica as limitações do navegador e do Notion.

## Provas locais

| Verificação | Resultado |
|---|---|
| Backend em Node 20.20.2 | 501 passaram, nenhuma falha, 12 testes condicionais não executados |
| Backend em Node 22.23.4 | 511 passaram, nenhuma falha, 2 testes condicionais não executados |
| Backend em Node 24.14.0 | 511 passaram, nenhuma falha, 2 testes condicionais não executados |
| Upgrade real offline da v1.3.0 | Merge até o commit candidato, preservação byte a byte e bloqueio ao retirar o recibo da fixture |
| Interface | 11 testes, tipos, lint e build passaram; instalação pelo lockfile congelado |
| Currículo | 4 testes e geração/verificação dos dois PDFs fictícios passaram |
| Pacote público | Checagem de dados pessoais e caminhos dos comandos passou |

Os testes do navegador que exigem Node 22 não rodam em Node 20; existe uma verificação específica de recusa nesse runtime. A suíte padrão deixa a prova de upgrade condicionada a um SHA explícito. O upgrade foi executado separadamente e a CI possui um job próprio contra o SHA do evento, com histórico completo. O teste de requisito exclusivo de Node 20 não roda em Node 22/24.

No navegador, a cópia isolada com vagas fictícias permitiu alternar tabela, buscar, recuperar a busca vazia, abrir detalhes e fechar por Escape com retorno do foco. O painel foi conferido em largura de 390 px. Não houve erro ou aviso no console dessa sessão. O detector retornou uma lista vazia. A revisão independente conferiu os patches e as evidências da versão candidata.

## Limites mantidos

- A execução remota da CI ainda depende do envio dos commits.
- Login real no LinkedIn/Gupy e interação humana pelo painel headless não foram comprovados nesta preparação.
- O quadro Astro continua experimental e separado da entrada operacional; não há claim de sincronização operacional com Notion ou geração automática da checklist de compatibilidade.
- A barra nativa no Notion depende das capacidades da conexão e pode exigir ajuste manual.
- A prova de upgrade parte da release estável v1.3.0. Checkouts intermediários de `main` com configurações rastreadas podem exigir a migração assistida documentada em `docs/atualizacao.md`.

## Próximo estado

Revisar o ZIP local e as [notas da versão](../../docs/releases/v1.4.0.md), então decidir o lançamento. Publicação e mudança de visibilidade são estados separados desta preparação.
