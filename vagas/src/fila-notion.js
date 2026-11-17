// Fila de gravação pendente no Notion (spec 016, incidente 5 de 16 de Novembro de 2026).
// O plano do Notion de a pessoa candidata permite cerca de 9 consultas por hora. O quadro local é a fonte
// de estado da rodada; o Notion é um destino. Toda vaga nova entra aqui e no espelho local,
// e a fila se esvazia quando o agente grava a página (o Node não fala com o Notion).
import { join, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DIR_DADOS } from './config.js';
import { lerEstado, salvarEstado } from './estado-central.js';
import * as espelhoLocal from './arquivo.js';

// A instalação pública tem o seu próprio leitor de estado (quadro local) e pode não ter `mesclar`.
const mesclar = (...a) => espelhoLocal.mesclar(...a);

export const TENTATIVAS_ATE_ERRO = 3;
export const ATRASO_ATE_ERRO_HORAS = 72;
const arquivoPadrao = () => join(DIR_DADOS, 'fila-notion.json');
const inicial = () => ({ versao: 1, itens: {} });
const falha = codigo => { throw new Error(codigo); };
const horas = (de, ate) => (ate - Date.parse(de)) / 3_600_000;

function gravar(arquivo, dados) {
  mkdirSync(dirname(arquivo), { recursive: true });
  salvarEstado(arquivo, dados, dirname(arquivo));
}

const campos = v => ({ titulo: v.titulo || null, empresa: v.empresa || null, link: v.link || v.url || null, fonte: v.fonte || null,
  compatibilidade: Number.isFinite(v.compatibilidade) ? v.compatibilidade : null, status: v.status || 'Avaliar', origemFeed: v.origemFeed || [] });

/** Coloca vagas novas na fila e no espelho local, marcadas como pendentes de Notion. */
export function enfileirar(vagas, { arquivo = arquivoPadrao(), espelho, agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, inicial());
  const conhecido = espelhoLocal.carregarOperacional(espelho ? { arquivo: espelho } : {});
  const linhas = [];
  let novos = 0;
  for (const v of vagas) {
    if (!v?.idExterno) falha('VAGA_SEM_IDENTIDADE');
    if (espelhoLocal.concluidaOperacional(v, conhecido)) continue;
    const existente = dados.itens[v.idExterno];
    if (existente?.estado === 'gravado') continue;
    if (!existente) { novos++; dados.itens[v.idExterno] = { idExterno: v.idExterno, estado: 'pendente', criadoEm: agora.toISOString(), tentativas: 0, ...campos(v) }; }
    else Object.assign(existente, campos(v));
    linhas.push({ idExterno: v.idExterno, status: v.status || 'Avaliar', empresa: v.empresa, titulo: v.titulo, url: v.link || v.url,
      confianca: Number.isFinite(v.compatibilidade) ? v.compatibilidade / 100 : null, fonte: v.fonte });
  }
  // Local primeiro: se o espelho não gravar, a fila não promete o que o estado local não tem.
  if (linhas.length) mesclar(linhas, { ...(espelho ? { arquivo: espelho } : {}), pendenteNotion: true, agora });
  gravar(arquivo, dados);
  return { novos, pendentes: Object.values(dados.itens).filter(i => i.estado === 'pendente').length };
}

export function pendentes({ arquivo = arquivoPadrao(), limite = 20 } = {}) {
  return Object.values(lerEstado(arquivo, inicial()).itens).filter(i => i.estado === 'pendente')
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).slice(0, limite);
}

/** O agente criou a página no Notion: o item sai da fila e o espelho perde a marca de pendente. */
export function marcarGravado(idExterno, paginaId, { arquivo = arquivoPadrao(), espelho, agora = new Date(), provaRef } = {}) {
  if (typeof provaRef !== 'string' || !provaRef.startsWith(`${idExterno}|${paginaId}|`) || !provaRef.slice(`${idExterno}|${paginaId}|`.length).trim()) falha('RELEITURA_NOTION_OBRIGATORIA');
  if (typeof paginaId !== 'string' || !paginaId.trim()) falha('PAGINA_OBRIGATORIA');
  const dados = lerEstado(arquivo, inicial());
  const item = dados.itens[idExterno];
  if (!item) falha('ITEM_AUSENTE');
  item.estado = 'gravado'; item.paginaId = paginaId.trim(); item.gravadoEm = agora.toISOString(); item.provaRef = provaRef; delete item.ultimoErro;
  mesclar([{ idExterno, empresa: item.empresa, titulo: item.titulo, url: item.link, paginaId: item.paginaId }],
    { ...(espelho ? { arquivo: espelho } : {}), origem: 'notion', agora });
  gravar(arquivo, dados);
  return item;
}

export function registrarFalha(idExterno, motivo, { arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, inicial());
  const item = dados.itens[idExterno];
  if (!item) falha('ITEM_AUSENTE');
  item.tentativas += 1; item.ultimoErro = String(motivo || 'falha sem detalhe').slice(0, 300); item.ultimaTentativaEm = agora.toISOString();
  gravar(arquivo, dados);
  return item;
}

/** Descarta da fila o que foi gravado há mais de 14 dias, para o arquivo não crescer para sempre. */
export function compactar({ arquivo = arquivoPadrao(), dias = 14, agora = new Date() } = {}) {
  const dados = lerEstado(arquivo, inicial());
  let removidos = 0;
  for (const [id, item] of Object.entries(dados.itens)) {
    if (item.estado === 'gravado' && horas(item.gravadoEm, agora.getTime()) > dias * 24) { delete dados.itens[id]; removidos++; }
  }
  if (removidos) gravar(arquivo, dados);
  return { removidos };
}

/** Pendente comum não é erro. Vira erro com três falhas de gravação ou três dias parado. */
export function resumoFila({ arquivo = arquivoPadrao(), agora = new Date() } = {}) {
  const itens = Object.values(lerEstado(arquivo, inicial()).itens);
  const abertos = itens.filter(i => i.estado === 'pendente');
  const comErro = abertos.filter(i => i.tentativas >= TENTATIVAS_ATE_ERRO || horas(i.criadoEm, agora.getTime()) > ATRASO_ATE_ERRO_HORAS);
  return { pendentes: abertos.length, gravados: itens.length - abertos.length, comErro: comErro.length,
    idsComErro: comErro.map(i => i.idExterno), maisAntigoHoras: abertos.length ? Math.round(Math.max(...abertos.map(i => horas(i.criadoEm, agora.getTime())))) : 0 };
}
