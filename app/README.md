# Quadro JobRelay em Astro

Kanban, tabela e painel lateral com componentes shadcn do preset `bIkfnxQ`. Cards com altura uniforme, título truncado em uma linha, logos, metadados e compatibilidade. Arraste o card ou use o seletor de fase nos detalhes.

```sh
pnpm install
pnpm dev --host 127.0.0.1 --port 4185
```

A configuração padrão usa cinco vagas fictícias. Movimentos ficam na memória do servidor e não alteram candidaturas reais. Modos, contrato de dados e verificação em [architecture.md](architecture.md).

A avaliação visual está vinculada à [spec 006](../specs/pendentes/006-tema-quadro-onboarding-notion.md). A migração do onboarding para Astro não foi realizada nesta rodada; o formulário existente foi preservado.

## Testar uma cópia persistente

Configure `JOBRELAY_PROTOTYPE_FILE` em `.env.local` com caminho absoluto para um JSON privado no formato BoardPayload (`vagas`, `status`, `contagem`, `demo`). Execute `pnpm build` e `pnpm start`. O servidor lê esse arquivo a cada requisição e grava os movimentos com histórico. O arquivo não deve estar no checkout público; não publique dados reais. Isso é uma cópia de teste, sem sincronização ou mudança de fonte operacional. Sem essa variável, continuam valendo o proxy configurado ou os cinco exemplos em memória. Não configure o protótipo e o proxy ao mesmo tempo.

O quadro requer Node.js 22.23.4 ou mais recente. O modelo de variáveis fica em [docs/interface-ambiente.exemplo](../docs/interface-ambiente.exemplo); copie seu conteúdo para `.env.local` apenas se precisar configurar proxy ou cópia privada. Esse arquivo local não é distribuído nem substituído por atualizações.
