# JobRelay: tema compartilhado, Kanban e detalhes laterais

Data: 11 de Novembro de 2026.

## Autorização e decisões

O usuário pediu spec e implementação já autorizada neste chat. Publicação será progressiva após aprovação; não inclui commit, push, release ou novas candidaturas. Preservar configurações, confirmações humanas e alterações locais pré-existentes. O onboarding já foi alterado pela spec 005; esta rodada estende somente sua apresentação.

- Kanban inspirado no Todoist; painel lateral inspirado no Midday.
- Preset shadcn bIkfnxQ como fonte de tema e arredondamentos, sem instalar Next ou incorporar a biblioteca. Manter Montserrat.
- Cards: logo, cargo, empresa, salário quando disponível, localização, senioridade, porcentagem de compatibilidade. Sem resumo no card.
- Detalhes abrem na lateral ao selecionar um card. Resumo, análise, lacunas, histórico e mudança de fase pertencem ao painel.
- Dashboard pessoal significa o quadro de candidaturas no Notion. Usar opções nativas; CSS personalizado não se aplica ao Notion.

## Plano

1. Capturar tokens do preset e documentar tema sem trocar stack.
2. Aplicar tema ao onboarding preservando conteúdo e validação humana.
3. Atualizar cards e metadados do quadro local, preservando arrastar, busca, tabela e persistência.
4. Implementar painel lateral responsivo com teclado e retorno de foco.
5. Ajustar visualização nativa do Notion conforme capacidades verificadas, sem inventar informação ausente.
6. Conferir fluxos locais, abrir prévias e registrar limites.

## Critérios observáveis

- Cards sem summary; campos ausentes não são inventados. Logo real apenas se fornecida pela fonte, com fallback de iniciais explícito.
- A porcentagem usa o índice existente; não significa probabilidade de contratação. Nota parcial é identificada.
- Clique/Enter abre detalhes; Escape/fechar retorna foco. Mobile mantém Kanban horizontal e painel legível.
- Mover status conserva API e histórico existentes; carregamento, vazio, busca sem resultado e erro têm retorno visível.
- Onboarding mantém sete passos, uploads, preferências e confirmação humana; nenhuma simulação da passagem do usuário.
- Notion preserva filtros, ordenação, propriedades e conteúdo não afetados. Configurações não expostas pela conexão serão relatadas.
- Nenhum pacote shadcn/Next adicionado. Fonte de tokens: https://ui.shadcn.com/init?preset=bIkfnxQ .

## Coordenação

Chat principal: tema, quadro/API, Notion e integração. Frente independente: CSS do onboarding, com backup anterior e sem tocar JS, servidor ou configuração.

## Estado

Implementação local autorizada e em andamento. Gate completo ainda não executado.

## Evidência e limites da rodada

- 20 testes de quadro/onboarding: zero falhas, revisoes/tema-2026-11-11/testes.txt. TMPDIR local evita a recusa esperada ao symlink /var do macOS.
- Detector: [] em revisoes/tema-2026-11-11/detector.json.
- Playwright: desktop/mobile, abrir/fechar por Escape, foco, busca e tabela; nenhum POST ou automação da confirmação humana.
- Prévia usa cópia isolada dos exemplos, pois quadro.json original tem hard links e a leitura é recusada pela proteção existente. Nenhuma alteração desse arquivo ou enfraquecimento da proteção.
- Notion: view Radar atualizada somente em displayProperties (adicionada Senioridade) e layout compact já existente; filtros, ordenação e grupos preservados. Logo/localização e abertura em side peek não foram implementados pela conexão.
- Fonte real de logo depende de metadados da coleta; iniciais são fallback, não logo real.
- Implementação entregue para avaliação; gate completo e aprovação visual pendentes. Sem publicação.

A prévia final é um sandbox visual sem persistência: cinco exemplos fictícios e logos vetoriais fictícias em memória, servidor revisoes/tema-2026-11-11/preview.mjs. Nenhuma ação da prévia altera candidaturas. O arquivo original com hard links continua pendente de investigação; não enfraquecer a proteção. A tentativa pelo navegador de acessar Notion retornou tela vazia, sem controles disponíveis; abertura em painel permanece pendente.

## Refinamento autorizado na continuação

O usuário pediu cards mais largos e com altura idêntica, título em uma linha truncada, tabela no mesmo padrão, compatibilidade com indicadores de cor, ícones nos títulos/metadados e histórico em timeline detalhada. Impeccable/review explicitamente solicitados para essa versão. Não altera Notion, onboarding ou armazenamento nesta continuação. Cores reaproveitam as faixas de prioridade existentes (75 e 55), sem critério eliminatório. Histórico usa somente registros reais do payload: transição, autor, data/hora; não fabrica eventos para preencher a timeline.

## Astro e componentes autorizados

O usuário pediu explicitamente componentes e comando `pnpm dlx shadcn@latest init --preset bIkfnxQ --template astro`, substituindo a restrição anterior de não incorporar biblioteca nesta frente. Implementação autorizada no mesmo recorte. Criar `interface/` como frontend Astro dentro do repositório público; preservar backend e onboarding existentes, sem reinicializar a raiz. Usar componentes reais do preset, não apenas imitar CSS. Escopo: cards fixos, título truncado em uma linha; tabela equivalente; painel/Select acessíveis; drag com zona de coluna inteira e feedback; copy curta, sem frase explicando o óbvio da compatibilidade. Corrigir ícones. Preservar os metadados e histórico. Prévia de demonstração pode mover exemplos só em memória, com identificação de demonstração e sem acesso a dados reais. Integração real usa o contrato GET /api/vagas e POST /api/status; não alterar nem contornar a proteção de persistência. Sem commit/push/publicação.

## Versão Astro entregue para avaliação

Frontend em interface/, com componentes reais Base UI/shadcn base-vega e Phosphor do preset. Cards têm altura224px e borda real1px #dedede; título de uma linha com ellipsis. Tabela usa os mesmos componentes, Sheet reúne detalhes, Select substitui dropdown nativo e dnd-kit usa alça + coluna inteira. Fonte Montserrat local mantida. Cabeçalho sem contagens/texto de demonstração; frase explicativa da compatibilidade removida conforme correção explícita do usuário. Timeline só usa transições existentes.

Review de escrita + Impeccable audit/polish + revisão de código/interação executados sob pedido explícito. Achados corrigidos e evidências em revisoes/tema-2026-11-11/review-astro.md. Build, tipos, lint e cinco testes passaram. Preview final: http://127.0.0.1:4186 . Movimentos de exemplos ficam em memória, não no disco. Não foi criado botão de rodada; O usuário perguntou apenas sobre viabilidade.

Permanecem pendentes: conexão operacional real de persistência, limitações nativas do Notion e integração do scaffold Git ao repositório pai antes de publicar. Não mover esta spec para concluídas enquanto essas frentes continuarem no escopo. Nenhum push/release nesta rodada.

### Continuação: arraste pelo card inteiro

O usuário pediu arrastar sem alça/pontinhos, removê-los, retirar a divisória do rodapé e inverter a compatibilidade: texto “92% compatibilidade” à esquerda e barra à direita. Clique continua abrindo detalhes; Enter abre, Espaço inicia arraste por teclado. Mesma altura e contorno preservados.

### Status com ícone e cor, continuação de 11 de Novembro

Aplicar o mesmo StageLabel aos títulos das colunas e ao Select da tabela e dos detalhes. Fonte consultada: Status do Quadro de Vagas, fonte privada consultada, sem identificador no artefato público: Avaliar azul, Aplicar vermelho, Aplicado por IA laranja, Já apliquei verde, Entrevista roxo, Cancelada cinza, Revisar vermelho. Ícones distinguem as fases sem depender apenas de cor. Priorizar recebe bandeira laranja caso a API o forneça; não criar status nem alterar opções no Notion. Critérios: mesmos ícones no trigger e nas opções, texto acessível preservado, mudança de fase funcional.

### Vinte vagas reais no protótipo visual

O usuário pediu 20 vagas reais e persistência do arraste. Após esclarecer fonte local/Notion, confirmou que este quadro é somente teste visual, não a implementação final, e pediu não avançar detalhes de integração. Escopo final: copiar 20 vagas consultadas no Notion para dataset privado isolado; persistir apenas os movimentos do protótipo, sem alterar Notion, fonte operacional ou espelho das candidaturas. Seleção: 20 IDs únicos em Avaliar/Aplicar/Revisar, ordem Confiança decrescente e createdTime decrescente. Consulta MCP feita em 11/11/2026; todas as 20 retornaram Avaliar. Campos ausentes permanecem ausentes, sem logos inventadas.

Implementação: JOBRELAY_PROTOTYPE_FILE escolhe arquivo privado externo ao checkout público; readBoard/moveJob usam createFileStore. Leitura a cada requisição, lock exclusivo, temporário+fsync+rename, histórico por movimento. .env.local ignorado carregado por pnpm start. Não há conexão runtime com Notion, token ou fila de sincronização. Esta é uma cópia para teste.

Verificação:7 testes passaram, incluindo abertura em novo processo, preservação de histórico e metadados, idempotência, IDs/status inválidos, trava concorrente e hard links. Astro check sem erros/avisos/hints e build passou. Revisão independente do protótipo sem bloqueios para reinício normal. Limite: queda abrupta durante escrita pode deixar lock órfão; recuperação automática dessa falha não foi implementada neste protótipo.


### Detalhes alinhados ao modelo Notion e fechamento autorizado

A pessoa usuária pediu alinhar o painel de detalhes local ao modelo Notion: Confiança no topo, quatro grupos (Sobre a vaga, Próxima ação, Datas e Candidatura), Resumo e Gaps próprios, dados técnicos discretos e campos vazios preservados sem invenção. A implementação está com responsável separado; a revisão independente reconfere a versão final antes do aceite.

A pessoa usuária autorizou review, commit e push nesta continuação. A autorização de push não equivale a release ou publicação de serviço. O fechamento depende das revisões independentes e da conferência dos arquivos preparados. O Git aninhado de interface/ foi preservado em cópia e bundle privados e retirado da pasta integrada; o frontend será versionado como código normal no repositório pai.

### Logos e cards compactos

Ajuste autorizado: incluir logos confirmadas nas fontes das empresas e reduzir o espaço vazio, preservando altura uniforme. Resultado: 19 logos para 20 vagas; empregador não revelado sem logo. Cards com 176 px, padding de 16 px e metadados sem altura reservada. Evidência e limites em revisoes/tema-2026-11-11/review-astro.md.

### Compatibilidade próxima dos metadados e modelo explícito

A pessoa usuária apontou o vão entre tags e compatibilidade e a ausência de Remoto nos títulos Work From Home. Rodapé passou de margin-top:auto para8px fixos; cards uniformes de148px com padding12px e metadados em linha com quebra. No protótipo de20 vagas, medição final confirmou148px em todos,8px entre tags e rodapé, sem sobreposição de cabeçalho/metadados/compatibilidade e sem corte do rodapé.

locationLabel usa modelo explícito primeiro e, se ausente, mostra Remoto quando o próprio título diz Remote, Remoto/Remota ou Work From Home. Não infere país; evita repetir Remoto se já estiver no campo Local e modelo. Seis testes passaram, lint/build/detector sem achados. Revisão independente confirmou a lógica e apontou conferir limites de espaço; os20 casos reais foram medidos no navegador. Não há prova para combinações sintéticas com todos os campos em duas linhas fora deste protótipo. Print: revisoes/tema-2026-11-11/cards-sem-vao-remoto.png.
