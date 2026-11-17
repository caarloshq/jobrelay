// Posts do LinkedIn que pedem comentário ou mensagem (decisão de a pessoa candidata, 16 de Novembro de 2026,
// `aplicacao/README.md#vagas-que-pedem-comentário-ou-mensagem`).
//   Nunca comentar. Conexão depende da autorização da pessoa nesta instalação.
//   Mensagem só sai depois de uma pergunta por mensagem, ligada ao texto exato que foi mostrado.
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { DIR_DADOS } from './config.js';
import { lerEstado, salvarEstado } from './estado-central.js';

export const PEDIDOS = Object.freeze(['comentario', 'mensagem', 'email', 'nenhum']);
const hash = valor => createHash('sha256').update(String(valor)).digest('hex');
const falha = codigo => { throw new Error(codigo); };
const texto = valor => typeof valor === 'string' && valor.trim() ? valor.trim() : null;
const arquivoPadrao = () => join(DIR_DADOS, 'contatos-posts.json');
const inicial = () => ({ versao: 1, contatos: {} });

const PERFIL = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^\s/?#]+\/?$/i;
const POST = /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/(feed\/update\/[^\s?#]+|posts\/[^\s?#]+)\/?$/i;

/** Valida e limpa o contato extraído de um post. Query e fragmento saem; o resto que não for LinkedIn é recusado. */
export function normalizarContato(contato) {
  if (!contato || typeof contato !== 'object' || Array.isArray(contato)) falha('CONTATO_INVALIDO');
  const limpo = url => { if (url == null) return null; try { const u = new URL(String(url)); u.search = ''; u.hash = ''; return u.toString(); } catch { return falha('CONTATO_INVALIDO'); } };
  const perfil = limpo(contato.perfil), postLink = limpo(contato.postLink);
  if (perfil && !PERFIL.test(perfil)) falha('CONTATO_PERFIL_INVALIDO');
  if (postLink && !POST.test(postLink)) falha('CONTATO_POST_INVALIDO');
  const pedido = contato.pedido ?? 'nenhum';
  if (!PEDIDOS.includes(pedido)) falha('CONTATO_PEDIDO_INVALIDO');
  const nome = texto(contato.nome);
  if (!perfil && !nome) falha('CONTATO_SEM_AUTOR');
  return { nome, perfil, postLink, pedido };
}

const chaveDe = (contato, cargo) => hash(`${contato.postLink || contato.perfil || contato.nome}|${(cargo || '').toLowerCase()}`).slice(0, 16);

/** Traz para a lista os contatos das observações da captura. Idempotente. */
export function ingerirDaSessao(sessao, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, inicial());
  let novos = 0;
  for (const o of sessao?.observacoes || []) {
    if (!o.contato || o.contato.pedido === 'nenhum') continue;
    const id = chaveDe(o.contato, o.cargo);
    if (dados.contatos[id]) continue;
    dados.contatos[id] = { id, estado: 'a_conectar', contato: o.contato, vaga: { cargo: o.cargo || null, empresa: o.empresa || null, post: o.url || o.contato.postLink || null },
      observacaoId: o.id, criadoEm: agora.toISOString(), historico: [] };
    novos++;
  }
  if (novos) salvarEstado(arquivo, dados, join(arquivo, '..'));
  return { novos, total: Object.keys(dados.contatos).length };
}

function mexer(arquivo, id, fn, agora) {
  const dados = lerEstado(arquivo, inicial());
  const lead = dados.contatos[id];
  if (!lead) falha('CONTATO_AUSENTE');
  fn(lead);
  lead.historico.push({ estado: lead.estado, em: agora.toISOString() });
  salvarEstado(arquivo, dados, join(arquivo, '..'));
  return lead;
}

/** Comentário é proibido em qualquer forma. Qualquer pedido de ação pública é recusado aqui. */
export function exigirAcaoPermitida(tipo) {
  if (/coment|comment|interested|responder.?publica|reply.?publico/i.test(String(tipo))) falha('COMENTARIO_PROIBIDO');
  if (!['conectar', 'preparar_mensagem', 'perguntar', 'enviar_mensagem'].includes(tipo)) falha('ACAO_DESCONHECIDA');
  return tipo;
}

export function registrarConexao(id, { provaRef }, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  exigirAcaoPermitida('conectar');
  return mexer(arquivo, id, lead => {
    if (lead.estado !== 'a_conectar') falha('ESTADO_INVALIDO');
    lead.conexao = { provaRef: texto(provaRef) || falha('PROVA_OBRIGATORIA'), em: agora.toISOString() };
    lead.estado = 'conectado';
  }, agora);
}

/** O texto vai para a pergunta e fica preso a ela pelo hash. */
export function prepararMensagem(id, { texto: corpo, canal, anexo = null, revisaoRef }, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  exigirAcaoPermitida('preparar_mensagem');
  return mexer(arquivo, id, lead => {
    if (!['conectado', 'aguardando_autorizacao', 'mensagem_autorizada'].includes(lead.estado)) falha('ESTADO_INVALIDO');
    if (!['linkedin', 'email'].includes(canal)) falha('CANAL_INVALIDO');
    lead.mensagem = { texto: texto(corpo) || falha('TEXTO_OBRIGATORIO'), canal, anexo, revisaoRef: texto(revisaoRef) || falha('REVISAO_OBRIGATORIA'),
      hash: hash(`${canal}|${corpo}|${anexo || ''}`), preparadaEm: agora.toISOString() };
    delete lead.autorizacao;
    lead.estado = 'aguardando_autorizacao';
  }, agora);
}

export function perguntaDeAutorizacao(lead) {
  if (lead?.estado !== 'aguardando_autorizacao' || !lead.mensagem) falha('ESTADO_INVALIDO');
  const quem = lead.contato.nome || 'o recrutador';
  const vaga = [lead.vaga.cargo, lead.vaga.empresa].filter(Boolean).join(' · ') || 'vaga do post';
  return `Você autoriza o envio da mensagem para ${quem}, referente à vaga ${vaga}?\nCanal: ${lead.mensagem.canal === 'email' ? 'e-mail' : 'LinkedIn'}\nTexto: ${lead.mensagem.texto}${lead.mensagem.anexo ? `\nAnexo: ${lead.mensagem.anexo}` : ''}`;
}

/** Só o "sim" de a pessoa candidata para este texto, neste canal, libera o envio. */
export function registrarAutorizacao(id, { autorizacaoRef, hashMostrado }, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  return mexer(arquivo, id, lead => {
    if (lead.estado !== 'aguardando_autorizacao') falha('ESTADO_INVALIDO');
    if (hashMostrado !== lead.mensagem.hash) falha('AUTORIZACAO_DE_OUTRO_TEXTO');
    lead.autorizacao = { ref: texto(autorizacaoRef) || falha('AUTORIZACAO_SEM_REFERENCIA'), hash: hashMostrado, em: agora.toISOString() };
    lead.estado = 'mensagem_autorizada';
  }, agora);
}

export function registrarEnvio(id, { provaRef }, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  exigirAcaoPermitida('enviar_mensagem');
  return mexer(arquivo, id, lead => {
    if (lead.estado !== 'mensagem_autorizada' || !lead.autorizacao) falha('ENVIO_SEM_AUTORIZACAO');
    if (lead.autorizacao.hash !== lead.mensagem.hash) falha('AUTORIZACAO_DE_OUTRO_TEXTO');
    lead.envio = { provaRef: texto(provaRef) || falha('PROVA_OBRIGATORIA'), em: agora.toISOString() };
    lead.estado = 'mensagem_enviada';
  }, agora);
}

export function listar({ arquivo = arquivoPadrao() } = {}) {
  return Object.values(lerEstado(arquivo, inicial()).contatos);
}

/** O que o agente pode fazer agora, sem perguntar, e o que depende de a pessoa candidata. */
export function proximasAcoes({ arquivo = arquivoPadrao() } = {}) {
  const livres = [], precisaDeVoce = [];
  for (const lead of listar({ arquivo })) {
    const base = { exigeAutorizacaoInstalacao: true, id: lead.id, nome: lead.contato.nome, perfil: lead.contato.perfil, vaga: lead.vaga };
    if (lead.estado === 'a_conectar' && lead.contato.perfil) livres.push({ ...base, acao: 'conectar', observacao: 'Verificar autorização desta instalação antes de conectar. Convite sem nota; nunca comentar o post.' });
    else if (lead.estado === 'a_conectar') livres.push({ ...base, acao: 'achar_perfil' });
    else if (lead.estado === 'conectado') livres.push({ ...base, acao: 'preparar_mensagem', observacao: 'Texto passa pela revisão de escrita antes da pergunta.' });
    else if (lead.estado === 'aguardando_autorizacao') {
      precisaDeVoce.push({ ...base, acao: 'perguntar', pergunta: perguntaDeAutorizacao(lead), hashMostrado: lead.mensagem.hash,
        resumo: `Autorizar uma mensagem para ${lead.contato.nome || 'o recrutador'}, sobre a vaga ${[lead.vaga.cargo, lead.vaga.empresa].filter(Boolean).join(' · ')}` });
    } else if (lead.estado === 'mensagem_autorizada') livres.push({ ...base, acao: 'enviar_mensagem', observacao: 'Somente o texto autorizado.' });
  }
  return { livres, precisaDeVoce };
}
