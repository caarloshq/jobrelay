# Coleta e preparação de vagas

Leia o [fluxo vigente da rodada](../vagas/FLUXO-DA-RODADA.md): regras no início, confirmação de atualização, coleta salva/conferida antes de aplicar, revisor por candidatura e melhorias opcionais somente após a aplicação. O fluxo governa a sequência; este documento conserva os procedimentos especializados.

Esta é a entrada independente para buscar, avaliar e preparar vagas. Execute os comandos dentro de `vagas/`. A aplicação tem [runbook próprio](../aplicacao/README.md); o [ciclo completo](../vagas/RODADA-DIARIA.md) encadeia ambos quando autorizado. Leia também [as regras do subsistema](../vagas/AGENTS.md).

A coleta conserva os papéis de busca, preparação, maestro e revisão. Ela atualiza o quadro local por padrão; Notion é opcional e exige a conexão e o snapshot da própria instalação. Nenhuma coleta autoriza o preenchimento ou envio de candidatura.

## 1. O quadro é o estado

Desde 2026-09-14 o estado das vagas mora em `../vagas/data/quadro.json`, o quadro local (`cd ../vagas && npm run quadro` abre no navegador). A rodada lê esse arquivo sozinha: não existe passo de espelhar. Vaga com status `Já apliquei`, `Entrevista` ou `Cancelada` está **concluída**: sai do radar e da fila de leitura, e continua no quadro com o histórico. `Avaliar` e `Aplicar` seguem ativas.

Quem escolhe Notion usa `cd ../vagas && npm run estado -- --fonte notion --database-id <id>` e consulta a database completa via conexão autorizada do agente. O snapshot normalizado é importado por `cd ../vagas && npm run estado -- --importar <arquivo.json>` para `../vagas/data/notion.json`. Não chamar `arquivo.espelhar()` em modo Notion. O quadro local fica preservado e não é uma fonte alternativa de status. Antes de preencher ou enviar, reconsultar o Notion; o verificador recusa snapshot com mais de cinco minutos, futuro ou sem Gaps.

**Nunca edite o `quadro.json` à mão nem apague uma vaga dele.** Pra mover por código, `quadro.mover(id, status, { por: 'agente' })`: fica no histórico.

Ao usar Notion, preencher `Salário` conforme a [regra do subsistema](../vagas/AGENTS.md#regras-invioláveis), inclusive quando o anúncio não informa remuneração.

## 2. Coletar

```bash
cd ../vagas && npm run rodada
```

Roda camadas 1, 3 e 4. Expurga do cache o que não passa mais no filtro atual — apertar uma regra em `../vagas/config/` tem efeito aqui, sem precisar refetch.

Na agenda de quatro em quatro horas, usar `cd ../vagas && npm run rodada -- --forcar` para atualizar as outras fontes no mesmo dia. `--forcar` só libera a repetição da rodada local; a cota paga do Apify continua limitada a uma tentativa diária.

## 2.5. Camada 4 — LinkedIn

A primeira rodada do dia com Apify configurada pode disparar o Actor ou a Task paga, após gravar a intenção em `../vagas/data/cota-apify.json`. As rodadas seguintes consultam a cota e reutilizam o último run por GET, sem novo POST. Se o POST teve resposta incerta, manter a cota consumida e conferir o run existente; não repetir o disparo.

Sem `APIFY_TOKEN` em `../vagas/.env`, a camada 4 não entra e as outras seguem normalmente. Com o token, a primeira tentativa paga usa o Actor de `../vagas/config/linkedin.json` com a busca de lá; com `APIFY_TASK` também no `.env`, a Task manda e o arquivo é ignorado. As consultas seguintes do dia usam o último run por GET.

Para reimportar o último dataset sem gastar crédito também fora da rodada:

```bash
cd ../vagas && npm run apify -- --ultimo
```

## 3. Camada 2 — só se a 1 vier fraca

Não é todo dia. Se a camada 1 trouxe pouca vaga nova, rodar os dorks de `../vagas/config/dorks.json` com `WebSearch` (o do Node rate-limita, ver `../vagas/AGENTS.md`), jogar as URLs num arquivo e:

```bash
cd ../vagas && npm run enriquecer -- --arquivo ../vagas/data/urls-camada2.txt
```

## 4. Ler a fila

```bash
cd ../vagas && npm run pendentes
```

A fila já reflete o filtro de hoje, os julgamentos de hoje e o quadro de hoje — ela não confia no veredito congelado no cache.

Ordenada por **teto**: quanto a vaga chegaria se a leitura fosse ótima. **Ler vaga com teto abaixo de 65% não muda decisão nenhuma** — deixar para depois é escolha legítima quando a fila está grande.

```bash
cd ../vagas && npm run pendentes -- --ler 12
```

Para cada vaga lida, registrar o julgamento contra `../Skills/adapt-resume/base_content_pt.json`:

```js
import { registrar } from './src/semantico.js';
registrar('<id externo>', { nota: 0..40, resumo: '...', gaps: '...', descricao: '<texto lido>' });
```

Passar `descricao` grava a impressão digital do texto. Se o anúncio for reeditado depois, a vaga volta para a fila marcada — a nota antiga falava de outro texto.

O `resumo` **descreve a vaga primeiro e fecha com o encaixe**. Todo fato de encaixe citado tem que existir no `base_content`.

### Julgamento semântico com evidência

Distribuir os 40 pontos em quatro eixos de 0 a 10: trabalho exigido, experiência
no domínio, métodos/ferramentas e escopo/senioridade. Em cada eixo, usar 0 quando
não há evidência ou há incompatibilidade; 5 quando há experiência transferível ou
cobertura parcial; 10 quando os requisitos centrais têm prova direta. Valores
intermediários precisam justificativa. Registrar a decomposição e a evidência em
`../vagas/data/leituras/<id-seguro>.json` e manter em `semantico.json` a parcela total no
formato que o código já consome. Não reescrever julgamentos antigos sem reler.

O idioma já recebe desconto na parcela determinística, então não descontar duas
vezes. Remoto, país elegível e inscrição aberta são conferências de elegibilidade,
não pontos que uma competência compensa. Falta de dado não equivale a requisito
atendido; deve aparecer no resumo/gaps e ser resolvida antes de candidatura.

## 5. O quadro já recebeu as novas

A coleta registra toda vaga aprovada no quadro, em `Avaliar`, com o retrato dela (título, empresa, link, nota). Não há o que publicar. O que a leitura semântica muda (nota, resumo, gaps) aparece no card na hora, porque o quadro lê o cache hidratado com as regras de hoje.

Vaga sem julgamento aparece no card com `~` e não passa de 60%: isso é informação, não erro.

## 6. Currículo das vagas acima do corte

**Corte: 75%** (`../vagas/config/perfil.json` → `curriculo.gerar_instrucao_acima_de`). Abaixo disso não se gera nada — nem `.md`, nem arquivo.

```bash
cd ../vagas && npm run instrucoes          # usa o corte do perfil
```

Isso escreve `Skills/adapt-resume/builds/<empresa>/instrucao.md`, que diz quais baldes de ênfase a vaga acionou. **O `.md` é insumo, não entrega.**

O script imprime "Confira os .md e me diga quais aprovar" — isso é resíduo de modo interativo. **Na rodada agendada não existe aprovação a esperar: gerar o currículo de toda vaga do corte, sempre, sem pausar.** Decidido em 2026-08-03, depois que uma rodada parou nesse passo esperando um "sim" que nunca vem porque você não está olhando às 09:05.

Em seguida, para cada vaga do corte, rodar a skill `../Skills/adapt-resume/SKILL.md`:

1. Copiar `base_content_pt.json` (ou `_en` se a vaga for em inglês) para `builds/<empresa>/content.json`
2. Adaptar **só a cópia**, seguindo as regras invioláveis da skill: reordenar e realçar, nunca inventar
3. Gerar o arquivo:

```bash
python3 generate_resume.py builds/<empresa>/content.json "../../Curriculo/<Seu Nome> - <cargo atual em experience[0].role> - <Empresa>.pdf"
```

**PDF ou DOCX sai da extensão.** PDF é o padrão; usar `.docx` quando o formulário da vaga recusa PDF e só aceita Word — informação que só aparece na página de candidatura, então na dúvida gerar PDF.

4. Conferir antes de dar como pronto: ≤ 2 páginas, texto selecionável, **zero travessão**, números travados conferidos.
5. O caminho do arquivo fica em `Skills/adapt-resume/builds/<empresa>/`; o card do quadro mostra o resumo e os gaps.

⚠️ **Anexar o arquivo no campo `Currículo` exige o token de File Upload**, que só você cria e põe em `../vagas/.env`. Enquanto ele não existir, preencher só `Currículo (caminho)` e dizer que o anexo ficou pendente. Não fingir que anexou.

## 7. Fechar

Guardar os materiais e registros da rodada. Não commitar nem publicar como efeito
automático da candidatura; seguir a autorização de versionamento do workspace.

O resto não vai pro git de propósito, e não é esquecimento:

| | Por que fica de fora |
|---|---|
| `../vagas/data/vagas.json` | cache, reconstruído a cada rodada |
| `../vagas/data/quadro.json` | **o quadro**: estado e histórico de cada vaga. Nunca se apaga; cópia diária em `../vagas/data/backups/` |
| `Skills/adapt-resume/builds/` | rascunho de trabalho da skill; o entregável é o PDF |

Relatar a você, curto: quantas novas, quantas lidas, o topo da lista, e o que ficou pendente.

---

## Ordem, e por que ela é essa

Conferir a fonte de estado antes de coletar, porque coletar sem saber o que está concluído reoferta vagas já resolvidas. Ler antes de publicar, porque vaga sem nota entra no board com número incompleto. Publicar só as novas, porque o board é radar, não histórico. Currículo por último, porque ele depende da nota final estar fechada.

## O que a tarefa agendada NÃO faz

- **Não gera currículo abaixo de 75%.** Nem `.md`. Vaga de 74% que virar interessante se pede na mão, com `cd ../vagas && npm run instrucoes -- --id <id>`.
- **Não muda status sem evento comprovado.** Candidatura confirmada pode receber o
  status previsto acima; intenção de aplicar não equivale a envio.
- **Não inventa nada no currículo.** A skill parte do `base_content` verificado e só reordena e realça. Vaga pede skill que você não tem: a skill não entra, vira linha em `Gaps`.
- **Não edita `../vagas/data/quadro.json` à mão.**

## Revisar os textos da triagem

Antes de registrar resumo e gaps, aplicar [review-escrita](../Skills/review-escrita/SKILL.md) ao texto autoral. A varredura mecânica ajuda a encontrar frases vazias; a leitura editorial confere cada afirmação contra anúncio e currículo. Não varrer a descrição copiada do empregador como texto autoral. Requisito sem prova permanece em gaps.
