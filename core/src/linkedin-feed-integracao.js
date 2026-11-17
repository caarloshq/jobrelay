// Integração do lote do LinkedIn sem depender de leitura do Notion nem de uma pessoa (spec 016).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const IDADE_MAXIMA_LOTE_MS = 86_400_000;

/** Procura a vaga no quadro pelo identificador principal ou por qualquer identificador alternativo. */
export function linhaNoQuadro(estado, atualizacao) {
  const vagas = estado?.vagas || {};
  const id = [atualizacao?.idExterno, ...(atualizacao?.idsAlternativos || [])].filter(Boolean).find(i => Object.hasOwn(vagas, i));
  return id ? { id, linha: vagas[id] } : null;
}

const unir = (a = [], b = []) => [...new Set([...a, ...b])];

/**
 * Anexa a proveniência do feed às vagas do cache. Vaga que já está no quadro e não tem cópia
 * no cache (expurgada) vira `semCache` e não bloqueia o fechamento: não há onde anexar, e o
 * quadro já a conhece. Vaga que não está nem no cache nem no quadro continua falhando.
 */
export function aplicarProveniencia({ cache, atualizacoes, estado }) {
  const falhas = [], semCache = [];
  let mudou = false;
  for (const a of atualizacoes || []) {
    const v = cache.vagas[a.idExterno] || Object.values(cache.vagas).find(x => (x.idsAlternativos || []).includes(a.idExterno));
    if (!v) {
      if (linhaNoQuadro(estado, a)) semCache.push(a.idExterno);
      else falhas.push({ idExterno: a.idExterno, erro: 'PROVENIENCIA_CACHE_AUSENTE: reconciliar identidade antes de encerrar.' });
      continue;
    }
    v.origemFeed = unir(v.origemFeed, a.origemFeed);
    v.idsAlternativos = unir(v.idsAlternativos, a.idsAlternativos).filter(id => id !== v.idExterno);
    mudou = true;
  }
  return { mudou, falhas, semCache };
}

/** Relê o cache salvo e confirma que cada origem chegou. */
export function conferirProvenienciaSalva({ salvo, atualizacoes, semCache = [] }) {
  const falhas = [];
  for (const a of atualizacoes || []) {
    if (semCache.includes(a.idExterno)) continue;
    const v = salvo.vagas[a.idExterno] || Object.values(salvo.vagas).find(x => (x.idsAlternativos || []).includes(a.idExterno));
    if (v && (a.origemFeed || []).some(origem => !v.origemFeed?.includes(origem))) falhas.push({ idExterno: a.idExterno, erro: 'PROVENIENCIA_NAO_CONFIRMADA' });
  }
  return falhas;
}

const dia = (data, fuso) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);

/** Lote de um dia anterior, ou parado há mais de 24 horas. */
export function loteAntigo(sessao, { agora = new Date(), fuso }) {
  if (!sessao) return false;
  const base = Date.parse(sessao.capturadaEm || sessao.iniciadaEm);
  return sessao.dia < dia(agora, fuso) || (Number.isFinite(base) && agora.getTime() - base > IDADE_MAXIMA_LOTE_MS);
}

/**
 * O que fazer com o lote que sobrou de uma rodada anterior, antes de abrir outro.
 *  nada                 não há lote pendente
 *  captura_parcial      a janela ficou no meio; só a pessoa autoriza voltar ao LinkedIn
 *  integrar             há leituras revisadas: integrar
 *  encerrar_antigo      lote antigo e sem leitura: fechar com registro
 *  precisa_leitura      lote de hoje sem leitura: trabalho do agente, não de código
 */
export function decidirLotePendente(sessao, { agora = new Date(), fuso, temRevisoes = false } = {}) {
  if (!sessao || sessao.estado === 'integrada') return { acao: 'nada' };
  if (sessao.estado !== 'capturada') return { acao: 'captura_parcial', runId: sessao.runId, requerAceite: true };
  if (temRevisoes) return { acao: 'integrar', runId: sessao.runId };
  if (loteAntigo(sessao, { agora, fuso })) return { acao: 'encerrar_antigo', runId: sessao.runId, motivo: 'lote_antigo_sem_leitura' };
  return { acao: 'precisa_leitura', runId: sessao.runId, observacoes: sessao.observacoes.length };
}

export const arquivoRevisoes = (dirDados, runId) => join(dirDados, 'linkedin-feed', runId, 'revisoes.json');
export const temRevisoes = (dirDados, runId) => existsSync(arquivoRevisoes(dirDados, runId));

/**
 * Vaga que entrou no espelho local e não chegou a ser confirmada (a gravação do cache falhou) volta como nova
 * na preparação seguinte, em vez de virar "já publicada" e nunca ser lida de novo. Só vale para o mesmo lote.
 */
export function reaproveitarNaoConfirmadas(lote, pacoteAnterior, { cache, runId, observacoesHash }) {
  if (!pacoteAnterior || pacoteAnterior.runId !== runId || pacoteAnterior.observacoesHash !== observacoesHash) return lote;
  const ja = new Set(lote.novas.map(v => v.idExterno));
  const voltam = (pacoteAnterior.novas || []).filter(v => !ja.has(v.idExterno) && !cache.vagas[v.idExterno]?.confirmacaoFila);
  if (!voltam.length) return lote;
  const observacoes = new Set(voltam.map(v => v.idObservacao).filter(Boolean));
  const duplicatas = lote.duplicatas.filter(d => !observacoes.has(d.idObservacao));
  const contagem = lote.contagem ? { ...lote.contagem, novas: lote.novas.length + voltam.length, duplicatas: duplicatas.length } : lote.contagem;
  return { ...lote, novas: [...lote.novas, ...voltam], duplicatas, contagem };
}
