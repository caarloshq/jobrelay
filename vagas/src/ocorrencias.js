// Registro das ocorrências de uma rodada e a conta final em linguagem de gente (spec 016).
// Erro técnico que a rodada resolveu sozinha não conta. Só pede a pessoa candidata o que é ato ou decisão pessoal.
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DIR_DADOS } from './config.js';
import { lerEstado, salvarEstado, herdarVersao as herdar } from './estado-central.js';

const arquivoPadrao = () => join(DIR_DADOS, 'ocorrencias-rodada.json');
const inicial = () => ({ versao: 1, ocorrencias: [] });
const vagaTxt = v => (v ? ` (${v})` : '');

// O que só uma pessoa resolve. Qualquer outro código é problema técnico.
const PESSOAIS = Object.freeze({
  RESPOSTA_PESSOAL: v => `Responder uma pergunta pessoal da vaga${vagaTxt(v) ? ` ${v}` : ''}`,
  VIDEO: v => `Gravar um vídeo pedido pela vaga${vagaTxt(v) ? ` ${v}` : ''}`,
  CAPTCHA: v => `Resolver uma verificação de segurança (CAPTCHA) na vaga${vagaTxt(v) ? ` ${v}` : ''}`,
  LOGIN: (v, d) => `Entrar de novo na conta${d ? ` de ${d}` : ''}${vagaTxt(v)}`,
  TESTE: v => `Fazer um teste pedido pela vaga${vagaTxt(v) ? ` ${v}` : ''}`,
  DECISAO: (v, d) => d || `Tomar uma decisão sobre a vaga${vagaTxt(v) ? ` ${v}` : ''}`,
  MENSAGEM_RECRUTADOR: (v, d) => d || `Autorizar uma mensagem a um recrutador${vagaTxt(v)}`,
  RASCUNHOS_PERDIDOS: (v, d) => `Reabrir ${d || 'os'} rascunho(s) que se perderam quando o computador reiniciou`,
  ANEXO_MANUAL: (v, d) => `Anexar o currículo e enviar a candidatura da vaga${vagaTxt(v) ? ` ${v}` : ''}${d ? ` (${d})` : ''}`,
  CAPTURA_PARCIAL: () => 'Dizer se quer retomar a busca no LinkedIn que ficou pela metade',
});
export const CODIGOS_PESSOAIS = Object.freeze(Object.keys(PESSOAIS));

export const ehPessoal = codigo => Object.hasOwn(PESSOAIS, codigo);

export function frasePedido(o) {
  const f = PESSOAIS[o.codigo];
  const texto = f ? f(o.vaga || null, o.detalhe || null) : null;
  if (!texto) return null;
  // Nome de vaga vem do anúncio e pode trazer travessão; o texto que a pessoa lê não usa.
  return texto.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

/** Guarda uma ocorrência. `chave` evita contar duas vezes o mesmo fato (ex.: o mesmo aviso de reinício). */
export function registrar({ codigo, vaga = null, detalhe = null, resolvida = false, resolucao = null, chave = null, derivada = false }, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  if (typeof codigo !== 'string' || !/^[A-Z][A-Z0-9_]+$/.test(codigo)) throw new Error('CODIGO_INVALIDO');
  if (ehPessoal(codigo) && resolvida) throw new Error('PESSOAL_NAO_SE_RESOLVE_SOZINHO');
  const dados = lerEstado(arquivo, inicial());
  const id = chave || `${codigo}|${vaga || ''}|${detalhe || ''}`;
  const existente = dados.ocorrencias.find(o => o.id === id);
  if (existente) {
    if (resolvida && !existente.resolvida) { existente.resolvida = true; existente.resolucao = resolucao; existente.resolvidaEm = agora.toISOString(); }
  } else dados.ocorrencias.push({ id, codigo, vaga, detalhe, resolvida, resolucao, derivada, em: agora.toISOString(), ...(resolvida ? { resolvidaEm: agora.toISOString() } : {}) });
  mkdirSync(dirname(arquivo), { recursive: true });
  salvarEstado(arquivo, dados, dirname(arquivo));
  return dados.ocorrencias.length;
}

/** Dá por resolvidas as ocorrências derivadas de um código que a fonte viva já não confirma. */
export function resolverDerivadasForaDe(codigo, idsVivos, resolucao, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, inicial());
  let n = 0;
  for (const o of dados.ocorrencias) {
    if (o.codigo === codigo && o.derivada && !o.resolvida && !idsVivos.has(o.id)) { o.resolvida = true; o.resolucao = resolucao; o.resolvidaEm = agora.toISOString(); n++; }
  }
  if (n) salvarEstado(arquivo, dados, dirname(arquivo));
  return n;
}

/** Dá a ocorrência por resolvida (a pessoa agiu, ou o retry funcionou). */
export function resolver(id, resolucao, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, inicial());
  const o = dados.ocorrencias.find(x => x.id === id);
  if (!o) throw new Error('OCORRENCIA_AUSENTE');
  o.resolvida = true; o.resolucao = resolucao; o.resolvidaEm = agora.toISOString();
  salvarEstado(arquivo, dados, dirname(arquivo));
}

export function listar({ arquivo = arquivoPadrao() } = {}) { return lerEstado(arquivo, inicial()).ocorrencias; }

/** Zera o registro no início de uma rodada, guardando o anterior em `anterior`. */
export function novaRodada({ arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  const atual = lerEstado(arquivo, inicial());
  // O que o preparo da rodada deriva de fontes vivas (fila, contatos, operação) é recalculado a cada rodada.
  // Ficam só as ocorrências registradas à mão que ainda estão abertas.
  const abertas = atual.ocorrencias.filter(o => !o.resolvida && !o.derivada);
  const dados = herdar(atual, { versao: 1, rodadaIniciadaEm: agora.toISOString(), ocorrencias: abertas, anterior: { descartadas: atual.ocorrencias.length - abertas.length } });
  salvarEstado(arquivo, dados, dirname(arquivo));
}

/**
 * Junta tudo o que a rodada registrou numa conta de quatro coisas:
 * `comErro` (técnicos que ficaram sem solução, por vaga ou por fato), `resolvidasSozinhas`,
 * `precisaDeVoce` (frases) e `ocorrencias` para consulta.
 */
export function consolidar({ arquivo = arquivoPadrao(), extras = [] } = {}) {
  const todas = [...listar({ arquivo }), ...extras];
  const abertas = todas.filter(o => !o.resolvida);
  const tecnicas = abertas.filter(o => !ehPessoal(o.codigo));
  const unicos = new Set(tecnicas.map(o => o.vaga || o.id));
  const frases = [...new Set(abertas.filter(o => ehPessoal(o.codigo)).map(frasePedido))];
  return { comErro: unicos.size, resolvidasSozinhas: todas.filter(o => o.resolvida && !ehPessoal(o.codigo)).length,
    precisaDeVoce: frases, tecnicasAbertas: tecnicas.map(o => ({ codigo: o.codigo, vaga: o.vaga, detalhe: o.detalhe })) };
}
