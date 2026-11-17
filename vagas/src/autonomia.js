// Rodada autônoma (spec 016): o que se resolve antes de começar, e a conta de fechamento.
// Erro técnico se resolve com retry, alternativa ou reconciliação. Só vira pedido a a pessoa candidata o que é ato ou decisão pessoal.
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { consultarOperacao, comEscritaCentral, diagnosticarOperacaoOrfa } from './operacao.js';
import { resumoFila } from './fila-notion.js';
import { proximasAcoes } from './contatos-posts.js';
import { registrar, consolidar, novaRodada, frasePedido, resolverDerivadasForaDe } from './ocorrencias.js';
import { resumoRodada } from './rodada-lote.js';

const codigoDe = erro => (String(erro?.message || '').match(/^[A-Z][A-Z0-9_]+/) || ['ERRO_DESCONHECIDO'])[0];

/**
 * Antes da coleta: resolve o que dá sozinho e devolve o que sobrou.
 * `integrarLote(dono)` é o `linkedin-feed integrar-pendente`, injetado para não acoplar o núcleo ao navegador.
 */
export async function prepararRodada({ dirDados, dono, linkedinHabilitado = false, integrarLote, controleNavegador = null, arquivos = {}, agora = new Date() }) {
  const resolvidosSozinhos = [], informacoes = {};
  const ledger = arquivos.ocorrencias ? { arquivo: arquivos.ocorrencias, agora } : { agora };
  // 1. Operação que ficou "ativa" de um processo morto. Vem antes de qualquer gravação, porque a própria
  //    gravação central já a recupera, e a rodada precisa saber que isso aconteceu.
  const ocorrenciasDoPasso1 = [];
  try {
    const { estado } = consultarOperacao(dirDados);
    if (estado.status === 'ativa') {
      const d = diagnosticarOperacaoOrfa(estado);
      if (d.orfa) {
        comEscritaCentral(dirDados, () => null);
        if (consultarOperacao(dirDados).estado.status === 'ativa') ocorrenciasDoPasso1.push({ codigo: 'OPERACAO_ORFA_PRESA', detalhe: d.motivo, derivada: true });
        else resolvidosSozinhos.push('Uma rodada anterior que tinha ficado aberta foi encerrada');
      } else informacoes.operacaoEmAndamento = true;
    }
  } catch (erro) { ocorrenciasDoPasso1.push({ codigo: codigoDe(erro), detalhe: 'operação', derivada: true }); }
  novaRodada(ledger);
  for (const o of ocorrenciasDoPasso1) registrar(o, ledger);

  // 2. Lote do LinkedIn que ficou sem entrar no quadro.
  if (linkedinHabilitado && integrarLote) {
    try {
      const r = await integrarLote(dono);
      informacoes.loteLinkedin = r.acao;
      if (r.acao === 'integrada') resolvidosSozinhos.push(`Um grupo de ${r.confirmadas} vaga(s) do LinkedIn que estava parado entrou no quadro`);
      else if (r.acao === 'encerrado_antigo') resolvidosSozinhos.push(`Um grupo antigo de ${r.observacoes} vaga(s) do LinkedIn, sem leitura, foi encerrado com registro`);
      else if (r.acao === 'captura_parcial') registrar({ codigo: 'CAPTURA_PARCIAL', chave: `CAPTURA_PARCIAL|${r.runId}`, derivada: true }, ledger);
      else if (r.acao === 'precisa_leitura') informacoes.vagasDoLinkedinParaLer = r.observacoes;
    } catch (erro) { registrar({ codigo: codigoDe(erro), detalhe: 'lote do LinkedIn', derivada: true }, ledger); }
  }

  // 3 e 4. Fila de gravação no Notion e mensagens a recrutadores: pendente comum é normal; parada de verdade é erro.
  const vivo = sincronizarDerivadas({ arquivos, ledger, agora });
  informacoes.filaNotion = { pendentes: vivo.fila.pendentes, maisAntigoHoras: vivo.fila.maisAntigoHoras };
  informacoes.contatosLivres = vivo.contatos.livres.length;
  const aviso = controleNavegador && join(controleNavegador, 'aviso-reinicio.json');
  if (aviso && existsSync(aviso)) {
    const a = JSON.parse(readFileSync(aviso, 'utf8'));
    if (a.rascunhosPerdidos > 0) registrar({ codigo: 'RASCUNHOS_PERDIDOS', detalhe: String(a.rascunhosPerdidos), chave: `RASCUNHOS|${a.em}`, derivada: true }, ledger);
  }

  const c = consolidar(ledger);
  return { resolvidosSozinhos, precisaDeVoce: c.precisaDeVoce, comErro: c.comErro, informacoes };
}

/** Fecha a rodada: os quatro números e a lista. `mapeadas` e `aplicadas` vêm dos recibos da própria rodada. */
export function fecharRodada({ mapeadas, aplicadas, arquivos = {}, agora = new Date() }) {
  const ledger = arquivos.ocorrencias ? { arquivo: arquivos.ocorrencias, agora } : { agora };
  const vivo = sincronizarDerivadas({ arquivos, ledger, agora });
  const c = consolidar(ledger);
  const texto = resumoRodada({ mapeadas, aplicadas, comErro: c.comErro, precisaDeVoce: c.precisaDeVoce });
  return { texto, mapeadas, aplicadas, comErro: c.comErro, precisaDeVoce: c.precisaDeVoce, resolvidasSozinhas: c.resolvidasSozinhas, filaNotionPendente: vivo.fila.pendentes };
}

/**
 * Alinha as ocorrências derivadas com as fontes vivas: registra o que continua valendo e dá por resolvido o que
 * deixou de valer durante a rodada (item da fila gravado, mensagem já autorizada). Roda no preparo e no fechamento.
 */
function sincronizarDerivadas({ arquivos, ledger, agora }) {
  const fila = resumoFila({ ...(arquivos.fila ? { arquivo: arquivos.fila } : {}), agora });
  const contatos = proximasAcoes(arquivos.contatos ? { arquivo: arquivos.contatos } : {});
  const idsFila = new Set();
  for (const id of fila.idsComErro) { registrar({ codigo: 'GRAVACAO_NOTION_PARADA', vaga: id, derivada: true }, ledger); idsFila.add(`GRAVACAO_NOTION_PARADA|${id}|`); }
  const idsMsg = new Set();
  for (const c of contatos.precisaDeVoce) { registrar({ codigo: 'MENSAGEM_RECRUTADOR', detalhe: c.resumo, chave: `MENSAGEM|${c.id}`, derivada: true }, ledger); idsMsg.add(`MENSAGEM|${c.id}`); }
  resolverDerivadasForaDe('GRAVACAO_NOTION_PARADA', idsFila, 'fila esvaziada', ledger);
  resolverDerivadasForaDe('MENSAGEM_RECRUTADOR', idsMsg, 'mensagem tratada', ledger);
  return { fila, contatos };
}

export { frasePedido };

/**
 * Fallback seguro quando o formulário não aceita o anexo pelo navegador: a vaga fica pronta para um clique de a pessoa candidata,
 * com o arquivo e o link já separados. Nunca se escolhe outro currículo salvo na conta no lugar do revisado.
 */
export function prepararAnexoManual({ vaga, link, arquivo, arquivos = {}, agora = new Date() }) {
  if (!existsSync(arquivo)) throw new Error('ARQUIVO_AUSENTE');
  const nome = arquivo.split('/').pop();
  if (!/^https:\/\//.test(link || '')) throw new Error('LINK_INVALIDO');
  registrar({ codigo: 'ANEXO_MANUAL', vaga, detalhe: `arquivo: ${nome}; link: ${link}`, derivada: false }, { ...(arquivos.ocorrencias ? { arquivo: arquivos.ocorrencias } : {}), agora });
  return { vaga, arquivo, link };
}
