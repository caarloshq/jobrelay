# Interface do quadro JobRelay

Frontend Astro com ilha React, iniciado pelo comando autorizado `pnpm dlx shadcn@latest init --preset bIkfnxQ --template astro --name interface --no-monorepo --yes`. Componentes reais `base-vega` do shadcn usam Base UI e Phosphor; não editar os componentes do registry para aplicar o tema do produto. A composição e as variantes ficam em `src/components/job-board.tsx` e `src/styles/global.css`. Fonte Montserrat local via fontsource.

## Entradas

- `src/pages/index.astro`: página do quadro e ilha React.
- `src/components/job-board.tsx`: Kanban, tabela e detalhes; dnd-kit coordena arraste pelo card inteiro, mouse, toque e teclado. A coluna inteira é droppable. Movimentos aguardam confirmação da API antes de atualizar o estado exibido.
- `src/lib/jobs.ts`: contrato da interface e faixas de compatibilidade existentes.
- `src/lib/server-store.ts`: exemplos em memória por padrão; proxy opcional para backend local com origem loopback validada.
- `src/pages/api/vagas.ts` e `status.ts`: GET e POST compatíveis com o backend existente. Alterar fase não inicia coleta nem candidatura.

## Modos

Sem `JOBRELAY_API_URL`, a interface usa cinco exemplos fictícios. A fase muda em memória no processo local e volta ao estado inicial quando esse processo reinicia. Nenhuma gravação operacional no disco ou Notion. O cabeçalho fica enxuto conforme pedido da pessoa usuária; a identificação do ambiente está nesta documentação e na origem da configuração.

Com `JOBRELAY_API_URL=http://127.0.0.1:4182`, as duas rotas fazem proxy somente aos endpoints existentes. Essa conexão depende do backend estar acessível, configurado e com persistência válida; falha não troca silenciosamente para exemplos. Não contornar validações do backend. A instalação real ainda tem impedimento de hard links no arquivo de estado, registrado na spec 006. Não afirmar persistência real validada.

## Executar e verificar

`pnpm dev --host 127.0.0.1 --port 4185` abre a prévia. Para o build: `pnpm build`; para executar o servidor produzido: `HOST=127.0.0.1 PORT=4186 node dist/server/entry.mjs`.

`pnpm typecheck`, `pnpm exec eslint src/components/job-board.tsx src/lib/jobs.ts src/lib/server-store.ts src/pages/api`, `node --test src/lib/jobs.test.ts` e `pnpm build` verificam o recorte. Interações e responsividade também exigem navegador.

## Estado de versionamento

A pasta interface/ está integrada como código normal no repositório pai, sem repositório Git aninhado ou submódulo. Antes da integração, o histórico do scaffold foi preservado em cópia e bundle privados de revisão. O commit e o push desta entrega seguem o fechamento autorizado e precisam de verificação própria.

## Protótipo com cópia privada

`JOBRELAY_PROTOTYPE_FILE` seleciona explicitamente um arquivo privado isolado para testar vagas copiadas. Tem prioridade sobre o proxy e exige caminho absoluto sem links. O store relê antes de alterar, valida ID/status, preserva metadados/histórico e usa lock wx + temporário exclusivo + fsync + rename. A API só retorna sucesso após a leitura da versão gravada. Notion e registro operacional não são alterados. `scripts/serve.mjs` carrega `.env.local`, ignorado pelo Git. Reinício normal conserva o arquivo. Queda abrupta durante transação pode deixar lock órfão; recuperação dessa falha fica fora do protótipo.

## Detalhes no padrão do Notion

O Sheet mantém Confiança percentual com barra verde no topo. Os grupos seguem Sobre a vaga (Status primeiro), Próxima ação, Datas e Candidatura. Resumo e Gaps continuam como textos separados. Histórico e dados técnicos ficam recolhidos em Candidatura. Campos desconhecidos ficam vazios, incluindo Salário; o detalhe só mostra um logo disponível, sem gerar iniciais de substituição. Ações e histórico permanecem no fluxo existente. O GET do backend projeta os campos opcionais já existentes, sem deduzir datas de envio ou criar informações.
