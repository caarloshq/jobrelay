import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { lerJsonSeguro, gravarJsonAtomico } from './persistencia.js';
import { comEscritaCentral } from './operacao.js';

export const ROTAS_CAPTURA = Object.freeze([
  Object.freeze({ rota: 'jobs', metaSegundos: 900 }),
  Object.freeze({ rota: 'postagens', metaSegundos: 720 }),
  Object.freeze({ rota: 'feed', metaSegundos: 180 }),
]);
export const META_SEGUNDOS = ROTAS_CAPTURA.reduce((total, item) => total + item.metaSegundos, 0);

// Sessões anteriores sem contrato de rotas preservam a janela total original.
function progressoRotas(sessao) {
  if (!Object.hasOwn(sessao, 'rotasCaptura')) return { legado: true, rotaAtual: null, rotas: [] };
  if (JSON.stringify(sessao.rotasCaptura) !== JSON.stringify(ROTAS_CAPTURA)) falhar('ROTAS_CAPTURA_INVALIDAS');
  const rotas = ROTAS_CAPTURA.map(item => {
    const segundosAtivos = sessao.intervalos.filter(i => i.rota === item.rota).reduce((total, i) => total + Math.round(i.segundos * 1000), 0) / 1000;
    return { ...item, segundosAtivos, restantes: Math.max(0, item.metaSegundos * 1000 - Math.round(segundosAtivos * 1000)) / 1000 };
  });
  if (sessao.intervalos.some(i => !ROTAS_CAPTURA.some(r => r.rota === i.rota)) ||
      rotas.some(r => r.segundosAtivos > r.metaSegundos) ||
      rotas.reduce((total, r) => total + Math.round(r.segundosAtivos * 1000), 0) !== Math.round(sessao.segundosAtivos * 1000)) falhar('ROTAS_CAPTURA_DIVERGENTES');
  return { legado: false, rotaAtual: rotas.find(r => r.restantes > 0)?.rota || null, rotas };
}
const falhar = (codigo) => { throw new Error(codigo); };
const texto = (valor, campo) => {
  if (typeof valor !== 'string' || !valor.trim()) falhar(`CAMPO_INVALIDO:${campo}`);
  return valor.trim();
};
const instante = (valor) => {
  const data = valor === undefined ? new Date() : new Date(valor);
  if (!Number.isFinite(data.getTime())) falhar('DATA_INVALIDA');
  return data;
};
const iso = (valor) => {
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime()) || data.toISOString() !== valor) falhar('DATA_INVALIDA');
  return data;
};
function diaEm(data, fuso) {
  texto(fuso, 'fuso');
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(data).reduce((acc, item) => { if (['year', 'month', 'day'].includes(item.type)) acc[item.type] = item.value; return acc; }, {});
  } catch { falhar('FUSO_INVALIDO'); }
}
function chaveDia(data, fuso) {
  const p = diaEm(data, fuso);
  return `${p.year}-${p.month}-${p.day}`;
}
function caminhos(dirDados) {
  const dados = path.resolve(texto(dirDados, 'dirDados'));
  if (!fs.existsSync(dados) || !fs.lstatSync(dados).isDirectory() || fs.realpathSync(dados) !== dados) falhar('DADOS_INSEGUROS');
  const base = path.join(dados, 'linkedin-feed');
  return { base, controle: path.join(base, 'controle.json') };
}
function validarRunId(runId) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(runId) || !/^[0-9a-f-]+$/.test(runId)) falhar('RUN_INVALIDO');
}
function arquivoSessao(p, runId) {
  validarRunId(runId);
  return path.join(p.base, runId, 'sessao.json');
}
function lerControle(p) {
  const controle = lerJsonSeguro(p.controle, { contrato: 1, dias: {}, pendenteRunId: null, sessoes: {} });
  if (controle.contrato !== 1 || !controle.dias || typeof controle.dias !== 'object' || Array.isArray(controle.dias) ||
    !controle.sessoes || typeof controle.sessoes !== 'object' || Array.isArray(controle.sessoes)) falhar('CONTROLE_INVALIDO');
  for (const runId of Object.values(controle.dias)) if (!controle.sessoes[runId]) falhar('CONTROLE_DIVERGENTE');
  if (controle.pendenteRunId && !controle.sessoes[controle.pendenteRunId]) falhar('CONTROLE_DIVERGENTE');
  return controle;
}
function lerSessao(controle, runId) {
  validarRunId(runId);
  const sessao = controle.sessoes[runId];
  if (!sessao) falhar('SESSAO_AUSENTE');
  if (sessao.contrato !== 1 || sessao.runId !== runId || !['ativa', 'parcial', 'capturada', 'integrada'].includes(sessao.estado)) falhar('SESSAO_INVALIDA');
  progressoRotas(sessao);
  return sessao;
}
function salvar(p, controle, sessao) {
  // Fonte única primeiro. Se cair ao projetar, a próxima ação ainda lê o lote completo.
  gravarJsonAtomico(p.controle, controle);
  gravarJsonAtomico(arquivoSessao(p, sessao.runId), sessao);
}
function comEscrita(p, fn) {
  // A exclusão pertence ao guarda central; aqui só preparamos e validamos a pasta.
  fs.mkdirSync(p.base, { recursive: true });
  lerJsonSeguro(p.controle, { contrato: 1, dias: {}, pendenteRunId: null }); // valida ancestrais
  return fn();
}
function acaoPlanejada(controle, dia) {
  if (controle.pendenteRunId) {
    const sessao = lerSessao(controle, controle.pendenteRunId);
    if (sessao.estado === 'integrada') falhar('CONTROLE_DIVERGENTE');
    return { acao: sessao.estado === 'capturada' ? 'integrar' : 'retomar', runId: sessao.runId, dia: sessao.dia, segundosAtivos: sessao.segundosAtivos, restantes: Math.max(0, META_SEGUNDOS - sessao.segundosAtivos), dono: sessao.dono, ...progressoRotas(sessao) };
  }
  if (controle.dias[dia]) return { acao: 'dispensar', runId: controle.dias[dia], dia };
  return { acao: 'iniciar', dia, metaSegundos: META_SEGUNDOS, ...progressoRotas({ rotasCaptura: ROTAS_CAPTURA, intervalos: [], segundosAtivos: 0 }) };
}

/** Consulta sem criar arquivo ou adquirir posse. Não reserva navegador. */
export function planejar({ dirDados, frente = 'coleta', habilitado = true, fuso, agora } = {}) {
  if (frente !== 'coleta' || habilitado !== true) return { acao: 'desabilitada' };
  const data = instante(agora);
  const p = caminhos(dirDados);
  return acaoPlanejada(lerControle(p), chaveDia(data, fuso));
}

export function consultar({ dirDados, runId, fuso, agora } = {}) {
  const p = caminhos(dirDados);
  const controle = lerControle(p);
  const escolhido = runId || controle.pendenteRunId || controle.dias[chaveDia(instante(agora), fuso)];
  return escolhido ? lerSessao(controle, escolhido) : null;
}

/** Registra apenas evidência da captura. `agora` injetado serve a simulação/teste. */
export function executar({ dirDados, acao, dono, frente = 'coleta', fuso, agora, ...args } = {}) {
  if (frente !== 'coleta') falhar('FRENTE_INVALIDA');
  if (args.token !== undefined) falhar('TOKEN_EXPLICITO_NAO_ACEITO');
  const quem = texto(dono, 'dono');
  const momento = instante(agora);
  const dia = chaveDia(momento, fuso);
  const p = caminhos(dirDados);
  return comEscritaCentral(dirDados, () => comEscrita(p, () => {
    const controle = lerControle(p);
    const plano = acaoPlanejada(controle, dia);
    if (acao === 'iniciar') {
      if (plano.acao !== 'iniciar') falhar('JANELA_JA_RESERVADA');
      const browserLiberadoRef = texto(args.browserLiberadoRef, 'browserLiberadoRef');
      const runId = crypto.randomUUID();
      const sessao = { contrato: 1, runId, dia, fuso, estado: 'ativa', dono: quem, browserLiberadoRef, iniciadaEm: momento.toISOString(), segmentoInicioEm: momento.toISOString(), segundosAtivos: 0, rotasCaptura: ROTAS_CAPTURA, intervalos: [], pausas: [], observacoes: [], capturadaEm: null, integradaEm: null };
      controle.sessoes[runId] = sessao;
      controle.dias[dia] = runId;
      controle.pendenteRunId = runId;
      salvar(p, controle, sessao);
      return sessao;
    }
    if (!controle.pendenteRunId) falhar('SESSAO_AUSENTE');
    const sessao = lerSessao(controle, controle.pendenteRunId);
    if (args.runId !== undefined && args.runId !== sessao.runId) falhar('RUN_DIVERGENTE');
    if (acao === 'retomar') {
      if (!['ativa', 'parcial', 'capturada'].includes(sessao.estado)) falhar('RETOMADA_INVALIDA');
      if (sessao.dono && sessao.dono !== quem) falhar('POSSE_NEGADA');
      if (sessao.estado === 'ativa') return sessao;
      if (sessao.estado === 'capturada') {
        if (!sessao.dono) {
          sessao.dono = quem;
          sessao.handoffRef = texto(args.handoffRef, 'handoffRef');
          salvar(p, controle, sessao);
        }
        return sessao;
      }
      if (momento < iso(sessao.pausas.at(-1)?.em || sessao.iniciadaEm)) falhar('RELOGIO_REGREDIU');
      const browserLiberadoRef = texto(args.browserLiberadoRef, 'browserLiberadoRef');
      const handoffRef = sessao.dono === null ? texto(args.handoffRef, 'handoffRef') : null;
      sessao.dono = quem;
      sessao.estado = 'ativa';
      sessao.segmentoInicioEm = momento.toISOString();
      sessao.browserLiberadoRef = browserLiberadoRef;
      if (handoffRef) sessao.handoffRef = handoffRef;
      // Um lote atravessando meia-noite consome a janela do dia em que é retomado.
      if (!controle.dias[dia]) controle.dias[dia] = sessao.runId;
    } else {
      if (sessao.dono !== quem) falhar('POSSE_NEGADA');
      if (sessao.estado === 'ativa' && ['observar', 'intervalo', 'concluir'].includes(acao) && !controle.dias[dia]) {
        controle.dias[dia] = sessao.runId;
      }
      if (acao === 'observar') {
        if (sessao.estado !== 'ativa') falhar('CAPTURA_INATIVA');
        const observacao = args.observacao;
        if (!observacao || typeof observacao !== 'object' || Array.isArray(observacao)) falhar('OBSERVACAO_INVALIDA');
        const campo = (nome) => observacao[nome] == null ? null : texto(observacao[nome], nome);
        const item = { id: crypto.randomUUID(), cargo: campo('cargo'), empresa: campo('empresa'), url: campo('url'), origem: campo('origem'), linkCandidatura: campo('linkCandidatura'), referencia: campo('referencia'), observadaEm: momento.toISOString() };
        if (!item.url && !item.referencia) falhar('REFERENCIA_OBRIGATORIA');
        sessao.observacoes.push(item);
      } else if (acao === 'intervalo') {
        if (sessao.estado !== 'ativa') falhar('CAPTURA_INATIVA');
        const inicio = iso(args.inicioEm);
        const fim = iso(args.fimEm);
        if (inicio < iso(sessao.segmentoInicioEm) || fim <= inicio || fim > momento || (sessao.intervalos.at(-1) && inicio < iso(sessao.intervalos.at(-1).fimEm))) falhar('INTERVALO_INVALIDO');
        const evidenciaInicio = texto(args.evidenciaInicio, 'evidenciaInicio');
        const evidenciaFim = texto(args.evidenciaFim, 'evidenciaFim');
        const segundos = (fim - inicio) / 1000;
        if (segundos > 60) falhar('CHECKPOINT_LONGO');
        const provaRef = texto(args.provaRef, 'provaRef');
        const progresso = progressoRotas(sessao);
        if (!progresso.legado) {
          if (!ROTAS_CAPTURA.some(r => r.rota === args.rota)) falhar('ROTA_OBRIGATORIA');
          if (args.rota !== progresso.rotaAtual) falhar('ROTA_FORA_DE_ORDEM');
          if (segundos > progresso.rotas.find(r => r.rota === args.rota).restantes) falhar('TEMPO_ROTA_EXCEDIDO');
        }
        sessao.intervalos.push({ ...(progresso.legado ? {} : { rota: args.rota }), inicioEm: inicio.toISOString(), fimEm: fim.toISOString(), evidenciaInicio, evidenciaFim, provaRef, segundos });
        sessao.segundosAtivos = (Math.round(sessao.segundosAtivos * 1000) + Math.round(segundos * 1000)) / 1000;
      } else if (acao === 'pausar' || acao === 'liberar') {
        if (!['ativa', 'parcial'].includes(sessao.estado) && !(acao === 'liberar' && sessao.estado === 'capturada')) falhar('PAUSA_INVALIDA');
        const ultimo = sessao.intervalos.at(-1)?.fimEm || sessao.segmentoInicioEm || sessao.capturadaEm;
        if (momento < iso(ultimo)) falhar('RELOGIO_REGREDIU');
        const referencia = texto(args.referencia, 'referencia');
        if (sessao.estado === 'capturada') sessao.handoffRef = referencia;
        else {
          sessao.pausas.push({ em: momento.toISOString(), referencia });
          sessao.estado = 'parcial';
          sessao.segmentoInicioEm = null;
        }
        if (acao === 'liberar') sessao.dono = null;
      } else if (acao === 'concluir') {
        if (sessao.estado !== 'ativa' || sessao.segundosAtivos < META_SEGUNDOS) falhar('TEMPO_INSUFICIENTE');
        if (progressoRotas(sessao).rotas.some(r => r.restantes > 0)) falhar('TEMPO_ROTA_INSUFICIENTE');
        sessao.estado = 'capturada';
        sessao.capturadaEm = momento.toISOString();
        sessao.referenciaConclusao = texto(args.referencia, 'referencia');
      } else if (acao === 'integrado') {
        if (sessao.estado !== 'capturada') falhar('INTEGRACAO_INVALIDA');
        const integracao = args.integracao;
        if (!integracao || !Number.isInteger(integracao.pendentes) || integracao.pendentes !== 0 ||
          !Array.isArray(integracao.confirmadas) ||
          !integracao.confirmadas.every(item => item && typeof item.idExterno === 'string' && item.idExterno.trim() && typeof item.referencia === 'string' && item.referencia.trim())) falhar('INTEGRACAO_SEM_PROVA');
        sessao.integracao = { pendentes: 0, confirmadas: integracao.confirmadas, relatorioRef: texto(integracao.relatorioRef, 'relatorioRef') };
        sessao.estado = 'integrada';
        sessao.integradaEm = momento.toISOString();
        sessao.referenciaIntegracao = texto(args.referencia, 'referencia');
        controle.pendenteRunId = null;
      } else falhar('ACAO_DESCONHECIDA');
    }
    salvar(p, controle, sessao);
    return sessao;
  }), []);
}
