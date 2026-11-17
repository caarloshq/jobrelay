// O leitor do estado das vagas. O padrão é o quadro local (data/quadro.json).
// A instalação pode escolher Notion; nesse modo o leitor usa data/notion.json,
// importado pelo agente, sem misturar status ou escrita com o quadro local.
//
// O nome `noNotion` ficou por compatibilidade: significa "ja esta no quadro".
//
// A primeira versao disto era um "arquivadas.json" que voce teria que
// alimentar rodando um comando a cada vaga que aplicasse. Era um segundo banco
// guardando o que o Notion ja guardava — complicacao inventada por mim, e ele
// cortou. O estado mora num lugar so.
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, copyFileSync, constants } from 'node:fs';
import { DIR_DADOS } from './config.js';
import { lerEstado, salvarEstado } from './estado-central.js';
import { comEscritaCentral } from './operacao.js';
import { carregarFonte, exigirLocal } from './fonte-estado.js';
import { normalizarLink } from './util.js';
import { chaveAnuncio, chaveRequisicao, idCanonico, requisicoesConflitam } from './dedupe.js';

const ARQ = join(DIR_DADOS, 'quadro.json');

/**
 * Status que tiram a vaga do radar: ela ja virou decisao tomada.
 *
 * `Aplicado por IA` entrou em 2026-08-25: e candidatura que o piloto preencheu
 * e voce enviou. Vale como concluida igual a `Ja apliquei` — o que muda e
 * so quem digitou. ESQUECER esta linha faz a vaga voltar ao radar amanha e
 * ganhar um segundo curriculo, que e exatamente o defeito que o rename de
 * `Sem retorno` para `Cancelada` causou em agosto.
 *
 * `Cancelada` e `Revisar` sao os nomes atuais das opcoes do Notion — o
 * voce renomeou (nao recriou) `Sem retorno` -> `Cancelada` e
 * `Descartada` -> `Revisar` em 2026-08-05. So `Cancelada` entra aqui:
 * `Revisar` e fila de triagem (link morto? duplicata?), a vaga continua
 * ativa ate alguem resolver, senao ela some da vista antes de ser checada.
 */
export const CONCLUIDOS = ['Já apliquei', 'Entrevista', 'Cancelada', 'Aplicado por IA'];
// `Avaliar`, `Aplicar` e `Revisar` sao ativos: continuam no radar.

export function carregar() {
  return carregarFonte();
}

/**
 * Compatibilidade legada local: regrava linhas no quadro local. No modo Notion
 * a importação completa passa por fonte-estado.js e nunca escreve aqui.
 * @param {Array<{idExterno:string, status:string, empresa?:string, titulo?:string, url?:string}>} linhas
 */
export function espelhar(linhas) {
  exigirLocal();
  // Preserva historico e retrato de quem ja esta no quadro: espelhar nunca apaga.
  const antes = carregar();
  const d = antes;
  d.versao = 2;
  d.sincronizadoEm = new Date().toISOString();
  for (const l of linhas) {
    if (!l?.idExterno) continue;
    d.vagas[l.idExterno] = {
      ...(antes.vagas[l.idExterno] || {}),
      status: l.status || 'Avaliar',
      empresa: l.empresa || antes.vagas[l.idExterno]?.empresa || null,
      titulo: l.titulo || antes.vagas[l.idExterno]?.titulo || null,
      url: l.url || antes.vagas[l.idExterno]?.url || null,
    };
  }
  salvarEstado(ARQ, d, DIR_DADOS);
  return d;
}

/**
 * Marca a vaga com o que o Notion sabe dela.
 *
 * - `noNotion`  ja foi publicada, entao nao e novidade
 * - `concluida` decisao tomada: sai do radar e da fila de leitura
 *
 * Procura por todos os ids que a vaga ja teve, porque o dedupe troca o
 * vencedor quando entra fonte nova.
 *
 * O LINK e a ultima tentativa, e ela salvou cinco linhas em 2026-07-30: ao
 * publicar a primeira leva eu inventei ids em estilo slug
 * (`vagasremotas:codepath-senior-product-designer`) em vez de copiar o
 * `idExterno` do coletor. Id inventado nunca casa com nada, e as cinco vagas
 * iam virar pagina duplicada. O link e o mesmo dado nos dois lados, entao ele
 * cura a deriva sozinho — inclusive a que ainda vai acontecer.
 *
 * QUARTA TENTATIVA, empresa+titulo: o link so ajuda quando os dois lados
 * apontam pro mesmo sistema. FCamara publicada direto no Gupy e espelhada no
 * LinkedIn nao tem nada em comum no link — gupy.io de um lado, linkedin.com
 * do outro — e a vaga ia entrar duas vezes no board. Mesma chave fraca que
 * `dedupe.chaveAnuncio()` usa entre fontes desta rodada; herda a mesma
 * ressalva: nao vale para agregador cujo campo empresa e o intermediario
 * (Jobgether etc.), porque ai duas vagas reais dividem o rotulo.
 */
export function aplicar(vaga, dados = carregar(), { identidadeEstrita = false } = {}) {
  // `idCanonico` calculado na hora, nao so o campo gravado: entrada que veio do
  // cache antigo nao tem o campo, e sem ele a vaga da Gupy espelhada na Remotar
  // (mesmo jobId dentro do link base64) reaparecia como novidade.
  const ids = [vaga.idExterno, vaga.idCanonico, idCanonico(vaga), ...(vaga.idsAlternativos || [])].filter(Boolean);
  for (const id of ids) {
    const n = dados.vagas[id];
    if (n) return marcar(vaga, n);
  }

  const link = normalizarLink(vaga.link);
  if (link) {
    const n = indicePorLink(dados).get(link);
    if (n) return marcar(vaga, n);
  }

  // O link do Notion tambem passa pelo idCanonico: a linha ja aplicada pode ter
  // sido publicada com a URL do agregador e a vaga de hoje com a da ATS.
  const canon = idCanonico(vaga);
  if (canon) {
    const n = indicePorCanonico(dados).get(canon);
    if (n) return marcar(vaga, n);
  }

  const requisicao = chaveRequisicao(vaga);
  if (requisicao) {
    const n = indicePorRequisicao(dados).get(requisicao);
    if (n) return marcar(vaga, n);
  }

  const anuncio = chaveAnuncio(vaga);
  if (anuncio) {
    const n = indicePorAnuncio(dados).get(anuncio);
    // Numero de requisicao diferente dos dois lados = vaga diferente, mesmo com
    // titulo igual. A Nortal tem a 1520 e a 1552 com o mesmo cargo.
    if (n && !requisicoesConflitam(vaga, n)) {
      if (!identidadeEstrita) return marcar(vaga, n);
      vaga.conflitoIdentidade = true;
      vaga.possivelDuplicataQuadro = n.status;
    }
  }

  vaga.noNotion = false;
  vaga.concluida = false;
  return vaga;
}

/**
 * Indice link -> linha, montado uma vez por objeto de dados.
 * A varredura ingenua era O(linhas) por vaga; com 69 dos dois lados ja sao
 * 4.761 comparacoes por rodada, e cresce quadrado. Alem do custo, ela devolvia
 * a PRIMEIRA da iteracao quando duas linhas dividiam o link — sem criterio.
 * O Map colapsa isso de forma explicita: a ultima linha vence, sempre a mesma.
 */
const INDICES = new WeakMap();
function indicePorLink(dados) {
  let m = INDICES.get(dados);
  if (m) return m;
  m = new Map();
  for (const n of Object.values(dados.vagas)) {
    const l = n.url && normalizarLink(n.url);
    if (l) m.set(l, n);
  }
  INDICES.set(dados, m);
  return m;
}

const INDICES_CANONICO = new WeakMap();
function indicePorCanonico(dados) {
  let m = INDICES_CANONICO.get(dados);
  if (m) return m;
  m = new Map();
  for (const n of Object.values(dados.vagas)) {
    const c = idCanonico({ link: n.url, idExterno: null });
    if (c) m.set(c, n);
  }
  INDICES_CANONICO.set(dados, m);
  return m;
}

const INDICES_REQUISICAO = new WeakMap();
function indicePorRequisicao(dados) {
  let m = INDICES_REQUISICAO.get(dados);
  if (m) return m;
  m = new Map();
  for (const n of Object.values(dados.vagas)) {
    const r = chaveRequisicao({ empresa: n.empresa, titulo: n.titulo });
    if (r) m.set(r, n);
  }
  INDICES_REQUISICAO.set(dados, m);
  return m;
}

const INDICES_ANUNCIO = new WeakMap();
function indicePorAnuncio(dados) {
  let m = INDICES_ANUNCIO.get(dados);
  if (m) return m;
  m = new Map();
  for (const n of Object.values(dados.vagas)) {
    const a = chaveAnuncio(n);
    if (a) m.set(a, n);
  }
  INDICES_ANUNCIO.set(dados, m);
  return m;
}

function marcar(vaga, n) {
  vaga.noNotion = true;
  vaga.statusNotion = n.status;
  vaga.concluida = CONCLUIDOS.includes(n.status);
  return vaga;
}

export function resumo(dados = carregar()) {
  const por = {};
  for (const v of Object.values(dados.vagas)) por[v.status] = (por[v.status] || 0) + 1;
  const concluidas = Object.values(dados.vagas).filter((v) => CONCLUIDOS.includes(v.status)).length;
  return { total: Object.keys(dados.vagas).length, concluidas, por, sincronizadoEm: dados.sincronizadoEm };
}


// API operacional de coleta: não altera carregarFonte/exigirLocal nem a seleção da GUI.
export function carregarOperacional({ arquivo = ARQ } = {}) {
  const local = lerEstado(arquivo, { versao: 2, sincronizadoEm: null, vagas: {} });
  const remoto = lerEstado(join(dirname(arquivo), 'notion.json'), { vagas: {} });
  const vagas = { ...local.vagas };
  const conflitosStatus = [];
  for (const [id, linha] of Object.entries(remoto.vagas || {})) {
    const encontrada = Object.entries(vagas).find(([chave, anterior]) => mesmaLinha(chave, anterior, id, linha));
    const chave = encontrada?.[0] || id;
    const anterior = encontrada?.[1];
    if (anterior && CONCLUIDOS.includes(anterior.status)) {
      if (CONCLUIDOS.includes(linha.status) && anterior.status !== linha.status) conflitosStatus.push({ id: chave, idRemoto: id, local: anterior.status, remoto: linha.status, motivo: 'RECONCILIACAO_OBRIGATORIA' });
      continue;
    }
    if (!anterior || CONCLUIDOS.includes(linha.status)) vagas[chave] = { ...anterior, ...linha,
      historico: anterior?.historico || linha.historico || [] };
  }
  return { ...local, vagas, conflitosStatus };
}
function urlOperacional(valor) {
  try {
    const u = new URL(valor);
    if (!['https:', 'http:'].includes(u.protocol)) return null;
    for (const chave of [...u.searchParams.keys()]) if (/^(?:utm_|source$|ref$|fbclid$|gclid$|gh_src$)/i.test(chave)) u.searchParams.delete(chave);
    u.searchParams.sort();
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}${u.hash}`;
  } catch { return null; }
}
function mesmaLinha(id, linha, idNovo, nova) {
  const ids = new Set([id, ...(linha.idsAlternativos || [])]);
  return [idNovo, ...(nova.idsAlternativos || [])].some(chave => ids.has(chave)) ||
    Boolean(urlOperacional(linha.url) && urlOperacional(linha.url) === urlOperacional(nova.url || nova.link));
}
export function concluidaOperacional(vaga, estado = carregarOperacional()) {
  return Object.entries(estado.vagas).some(([id, linha]) => CONCLUIDOS.includes(linha.status) && mesmaLinha(id, linha, vaga.idExterno, vaga));
}
export function mesclar(linhas, { arquivo = ARQ, origem = 'local', pendenteNotion = false, agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, { versao: 2, sincronizadoEm: null, vagas: {} });
  const conhecidos = carregarOperacional({ arquivo });
  for (const linha of linhas) {
    if (!linha?.idExterno || ['__proto__', 'constructor', 'prototype'].includes(linha.idExterno)) throw new Error('VAGA_SEM_IDENTIDADE');
    const similares = Object.entries(conhecidos.vagas).filter(([id, anterior]) => mesmaLinha(id, anterior, linha.idExterno, linha));
    const terminal = similares.find(([, anterior]) => CONCLUIDOS.includes(anterior.status));
    const alvo = similares.find(([id]) => Object.hasOwn(dados.vagas, id)) || terminal;
    const id = alvo?.[0] || linha.idExterno;
    const anterior = dados.vagas[id] || alvo?.[1] || {};
    const status = terminal?.[1].status || anterior.status || linha.status || 'Avaliar';
    const campos = Object.fromEntries(Object.entries(linha).filter(([k, v]) => k !== 'idExterno' && v !== null && v !== undefined));
    const nova = { ...anterior, ...campos, status,
      url: linha.url || linha.link || anterior.url || null,
      idsAlternativos: [...new Set([...(anterior.idsAlternativos || []), ...(linha.idsAlternativos || []), ...(id !== linha.idExterno ? [linha.idExterno] : [])])],
      registradaEm: anterior.registradaEm || agora.toISOString(),
      historico: anterior.historico || [{ em: agora.toISOString(), de: null, para: status, por: 'rodada' }] };
    if (linha.confianca != null) nova.compatibilidade = linha.confianca * 100;
    if (origem === 'notion') delete nova.pendenteNotion;
    else if (pendenteNotion && !CONCLUIDOS.includes(status)) nova.pendenteNotion = true;
    dados.vagas[id] = nova;
  }
  mkdirSync(dirname(arquivo), { recursive: true });
  if (existsSync(arquivo)) {
    const backups = join(dirname(arquivo), 'backups');
    mkdirSync(backups, { recursive: true });
    const copia = join(backups, `quadro-${agora.toISOString().slice(0, 10)}.json`);
    comEscritaCentral(dirname(arquivo), () => {
      try { copyFileSync(arquivo, copia, constants.COPYFILE_EXCL); }
      catch (erro) { if (erro.code !== 'EEXIST') throw erro; }
    }, [copia]);
  }
  dados.versao = 2;
  dados.sincronizadoEm = agora.toISOString();
  salvarEstado(arquivo, dados, dirname(arquivo));
  return dados;
}
