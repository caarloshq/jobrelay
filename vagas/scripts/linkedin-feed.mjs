#!/usr/bin/env node
// Ferramenta do agente: captura assistida, tratamento local e confirmação da fila.
// Não controla navegador, não chama MCP e não transmite candidaturas.
import { existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { DIR_DADOS, RAIZ, perfil, palavras } from '../src/config.js';
import { planejarConsultasLinkedin, conferirConsultaLinkedin } from '../src/linkedin-consultas.js';
import { configuracaoFeed } from '../src/linkedin-feed-config.js';
import { planejar, consultar, executar, META_SEGUNDOS } from '../src/linkedin-feed-sessao.js';
import { prepararLote } from '../src/linkedin-feed.js';
import { lerJsonSeguro } from '../src/persistencia.js';
import { lerEstado, salvarEstado } from '../src/estado-central.js';
import * as cache from '../src/cache.js';
import * as arquivo from '../src/arquivo.js';
import * as semantico from '../src/semantico.js';
import { normalizarLink } from '../src/util.js';

const hash = valor => createHash('sha256').update(JSON.stringify(valor)).digest('hex');
const fuso = () => process.env.VAGAS_FUSO || Intl.DateTimeFormat().resolvedOptions().timeZone;
const falha = mensagem => { throw new Error(mensagem); };
function entrada(nome) {
  if (typeof nome !== 'string' || !nome) falha('ARQUIVO_OBRIGATORIO');
  const caminho = resolve(nome), rel = relative(resolve(RAIZ, '..'), caminho);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) falha('ARQUIVO_FORA_DO_PROJETO');
  return lerJsonSeguro(caminho);
}
function guardar(caminho, valor) {
  const atual = lerEstado(caminho, {});
  Object.keys(atual).forEach(k => delete atual[k]);
  Object.assign(atual, valor);
  salvarEstado(caminho, atual, DIR_DADOS);
}
async function fonte() {
  const modulo = join(RAIZ, 'src/fonte-estado.js');
  return existsSync(modulo) ? (await import(pathToFileURL(modulo).href)).configuracao().fonte : 'notion';
}
function estadoConsultado(nome, agora) {
  const estado = entrada(nome);
  const idade = agora - Date.parse(estado?.consultadoEm);
  if (estado?.fonte !== 'notion' || !estado.provaRef || !Number.isFinite(idade) || idade < 0 || idade > 300000 ||
      !estado.vagas || typeof estado.vagas !== 'object' || Array.isArray(estado.vagas)) {
    falha('ESTADO_NOTION_DESATUALIZADO: forneça consulta MCP documentada feita nos últimos cinco minutos.');
  }
  for (const [id, linha] of Object.entries(estado.vagas)) {
    if (!id || ['__proto__', 'constructor', 'prototype'].includes(id) ||
        !['Avaliar', 'Aplicar', 'Já apliquei', 'Entrevista', 'Cancelada', 'Aplicado por IA', 'Revisar'].includes(linha?.status) ||
        typeof linha.paginaId !== 'string' || !linha.paginaId.trim() || (linha.url != null && typeof linha.url !== 'string')) {
      falha('ESTADO_NOTION_INVALIDO: cada linha exige identidade, página e status reconhecido. URL desconhecida permanece nula.');
    }
  }
  // É evidência fornecida pelo agente. O Node valida forma/recência, não comprova a consulta externa.
  return estado;
}
function observacoesRevisadas(sessao, revisoes) {
  if (!Array.isArray(revisoes)) falha('REVISOES_INVALIDAS: use uma lista com idObservacao.');
  const ids = new Set(sessao.observacoes.map(o => o.id));
  const mapa = new Map();
  for (const r of revisoes) {
    if (!r || !ids.has(r.idObservacao) || mapa.has(r.idObservacao)) falha('REVISAO_SEM_OBSERVACAO_OU_REPETIDA');
    mapa.set(r.idObservacao, r);
  }
  return sessao.observacoes.map(o => {
    const r = mapa.get(o.id) || {};
    return { ...r, vagaRevisada: r.vagaRevisada ? { ...r.vagaRevisada, revisao: r.revisao || r.vagaRevisada.revisao } : undefined,
      chave: o.id, titulo: o.cargo, empresa: o.empresa, postOriginal: o.url,
      urlCandidatura: o.linkCandidatura, origem: o.origem, evidencia: o.referencia };
  });
}
function sessaoCapturada(dono) {
  const s = consultar({ dirDados: DIR_DADOS, fuso: fuso() });
  if (!s || s.estado !== 'capturada' || s.segundosAtivos < META_SEGUNDOS) falha('CAPTURA_AINDA_NAO_CONCLUIDA');
  if (!dono || s.dono !== dono) falha('POSSE_NEGADA: assuma a integração pelo protocolo antes de gravar.');
  return s;
}
function provaNoEstado(vaga, estado) {
  const linhas = Object.entries(estado.vagas || {});
  return linhas.find(([id, linha]) => id === vaga.idExterno &&
    normalizarLink(linha.url || linha.link) === normalizarLink(vaga.link));
}
function guardarConfirmada(vaga, linha, provaRef, modo) {
  const c = cache.carregar();
  const anterior = c.vagas[vaga.idExterno] || {};
  const v = { ...anterior, ...vaga, noNotion: true, statusNotion: linha.status,
    concluida: arquivo.CONCLUIDOS.includes(linha.status),
    origemFeed: [...new Set([...(anterior.origemFeed || []), ...(vaga.origemFeed || [])])],
    confirmacaoFila: { fonte: modo, referencia: linha.paginaId || provaRef, conferidaEm: new Date().toISOString() } };
  // A gravação semântica usa o contrato existente e preserva julgamento de outras vagas.
  if (Number.isFinite(vaga.semantico)) semantico.registrar(vaga.idExterno,
    { nota: vaga.semantico, resumo: vaga.resumo, gaps: vaga.gaps, descricao: vaga.descricao, lidoEm: vaga.lidoEm });
  const seguro = vaga.idExterno.replace(/[^a-zA-Z0-9_-]/g, '-');
  guardar(join(DIR_DADOS, 'leituras', `${seguro}-feed.json`), { idExterno: vaga.idExterno, titulo: vaga.titulo,
    link: vaga.link, descricao: vaga.descricao, resumo: vaga.resumo, gaps: vaga.gaps,
    eixos: vaga.revisao?.eixos, nota: vaga.semantico, total: vaga.compatibilidade, lidoEm: vaga.lidoEm,
    origemFeed: vaga.origemFeed, consultaRef: provaRef });
  c.vagas[v.idExterno] = v;
  cache.salvar(c);
  if (modo === 'notion' && !existsSync(join(RAIZ, 'src/fonte-estado.js'))) {
    // Atualização pontual: não avança sincronizadoEm nem substitui o espelho por consulta parcial.
    const caminho = join(DIR_DADOS, 'notion.json');
    const espelho = lerEstado(caminho, { versao: 1, sincronizadoEm: null, vagas: {} });
    espelho.vagas[v.idExterno] = { ...(espelho.vagas[v.idExterno] || {}), ...linha,
      titulo: v.titulo, empresa: v.empresa, url: v.link, confianca: v.compatibilidade / 100, fonte: v.fonte };
    salvarEstado(caminho, espelho, DIR_DADOS);
  }
  if (cache.carregar().vagas[v.idExterno]?.confirmacaoFila?.fonte !== modo) falha('CACHE_NAO_CONFIRMADO');
}

export async function main(argv = process.argv.slice(2), { saida = valor => process.stdout.write(`${JSON.stringify(valor, null, 2)}\n`) } = {}) {
  const args = [...argv], acao = args.shift() || 'planejar';
  const opcoes = {};
  while (args.length) {
    const nome = args.shift(), valor = args.shift();
    if (!['--dono', '--arquivo', '--revisoes', '--estado', '--frente', '--run'].includes(nome) || !valor || valor.startsWith('--') || opcoes[nome]) falha('ARGUMENTO_INVALIDO');
    opcoes[nome] = valor;
  }
  const guardHumano = join(RAIZ, 'src/onboarding-humano.js');
  if (!['planejar', 'status'].includes(acao) && existsSync(guardHumano)) {
    const { exigirOnboardingHumano } = await import(pathToFileURL(guardHumano).href);
    exigirOnboardingHumano(DIR_DADOS);
  }
  const frente = opcoes['--frente'] || 'coleta';
  const cfg = configuracaoFeed();
  if (acao === 'planejar') { const r = { ...planejar({ dirDados: DIR_DADOS, frente, habilitado: cfg.habilitado, fuso: fuso() }), consultasPerfil: planejarConsultasLinkedin(perfil, palavras) }; saida(r); return r; }
  if (acao === 'status') { const sessao = consultar({ dirDados: DIR_DADOS, runId: opcoes['--run'], fuso: fuso() }); const r = sessao ? { ...sessao, consultasPerfil: planejarConsultasLinkedin(perfil, palavras) } : null; saida(r); return r; }
  if (!cfg.habilitado) falha('LINKEDIN_FEED_DESABILITADO: confirme o opt-in desta instalação antes de ativar.');
  if (frente !== 'coleta') falha('FRENTE_INVALIDA: aplicação isolada não inicia nem altera o feed.');
  const dono = opcoes['--dono'];
  if (!dono) falha('DONO_OBRIGATORIO');
  if (['iniciar', 'retomar', 'observar', 'intervalo', 'pausar', 'liberar', 'concluir'].includes(acao)) {
    const dados = opcoes['--arquivo'] ? entrada(opcoes['--arquivo']) : {};
    if (dados.agora !== undefined || dados.dirDados !== undefined || dados.fuso !== undefined || dados.dono !== undefined || dados.acao !== undefined) falha('OPCOES_RESERVADAS: o comando usa relógio real e a instalação corrente.');
    const planoConsultas = planejarConsultasLinkedin(perfil, palavras);
    if (acao === 'iniciar' && planoConsultas.estado !== 'pronto') falha('PERFIL_CONSULTA_PENDENTE: conclua o onboarding antes da captura Beta.');
    let consultaConferida;
    if (acao === 'intervalo' && ['jobs', 'postagens'].includes(dados.rota)) {
      if (!dados.consulta || typeof dados.consulta.provaRef !== 'string' || !dados.consulta.provaRef.trim()) falha('CONSULTA_UI_OBRIGATORIA');
      consultaConferida = conferirConsultaLinkedin(planoConsultas, { ...dados.consulta, rota: dados.rota });
      if (consultaConferida.estado !== 'confirmada') falha('CONSULTA_NAO_CONFIRMADA: preserve a sessão; confira URL e termo na interface antes de contar atividade.');
      if (typeof dados.provaRef !== 'string' || !dados.provaRef.trim()) falha('PROVA_INTERVALO_OBRIGATORIA');
      dados.provaRef = `${dados.provaRef.trim()} | consulta-interface:${dados.consulta.provaRef.trim()}`;
    }
    const sessao = executar({ ...dados, dirDados: DIR_DADOS, acao, dono, frente, fuso: fuso() });
    const r = consultaConferida ? { ...sessao, consultaConferida } : sessao; saida(r); return r;
  }
  const s = sessaoCapturada(dono), modo = await fonte(), agora = new Date();
  const arqPacote = join(DIR_DADOS, 'linkedin-feed', s.runId, 'publicacao.json');
  if (acao === 'preparar' || acao === 'publicar') {
    const revisoes = opcoes['--revisoes'] ? entrada(opcoes['--revisoes']) : [];
    const obs = observacoesRevisadas(s, revisoes);
    const estado = modo === 'local' ? arquivo.carregar() : estadoConsultado(opcoes['--estado'], agora);
    if (modo === 'notion' && estado.completo !== true) falha('CONSULTA_INCOMPLETA: deduplicação exige quadro completo atual.');
    const lote = prepararLote({ observacoes: obs, cache: cache.carregar(), estado, agora });
    const pacote = { versao: 1, runId: s.runId, fonteEstado: modo, observacoesHash: hash(s.observacoes),
      preparadoEm: agora.toISOString(), consultaRef: estado.provaRef || 'quadro-local-relido', ...lote };
    guardar(arqPacote, pacote);
    if (acao === 'publicar' && modo === 'local') {
      const quadro = await import(pathToFileURL(join(RAIZ, 'src/quadro.js')).href);
      quadro.registrar(lote.novas);
      // O caminho comum de confirmação relê o quadro depois da escrita.
      return main(['confirmar', '--dono', dono], { saida });
    }
    const r = { ...pacote, gravacao: 'pendente', proximoPasso: modo === 'notion'
      ? 'O agente consulta o schema e publica as novas via MCP; relê as páginas e executa confirmar com novo estado documentado. Não alterar selects. Fonte não disponível no schema pode ficar sem valor; preservar fonte original e proveniência no registro da página.'
      : 'Execute publicar com as mesmas revisões para registrar no quadro local.' };
    saida(r); return r;
  }
  if (acao !== 'confirmar') falha('ACAO_DESCONHECIDA');
  const p = lerJsonSeguro(arqPacote);
  if (p.versao !== 1 || p.runId !== s.runId || p.observacoesHash !== hash(s.observacoes) || p.fonteEstado !== modo || !Array.isArray(p.novas) || !Array.isArray(p.pendencias)) falha('PACOTE_DESATUALIZADO: prepare novamente.');
  const estado = modo === 'local' ? arquivo.carregar() : estadoConsultado(opcoes['--estado'], agora);
  // No público, o agente importa o snapshot completo pelo adaptador existente.
  const espelhoPublico = modo === 'notion' && existsSync(join(RAIZ, 'src/fonte-estado.js')) ? arquivo.carregar() : null;
  const confirmadas = [], pendentes = [], falhas = [];
  for (const vaga of p.novas) {
    const prova = provaNoEstado(vaga, estado);
    if (!prova || (espelhoPublico && !provaNoEstado(vaga, espelhoPublico))) { pendentes.push(vaga.idExterno); continue; }
    try {
      guardarConfirmada(vaga, prova[1], estado.provaRef || 'quadro-local-relido', modo);
      confirmadas.push({ idExterno: vaga.idExterno, referencia: prova[1].paginaId || 'quadro-local-relido', status: prova[1].status });
    } catch (erro) { falhas.push({ idExterno: vaga.idExterno, erro: erro.message }); }
  }
  if (Array.isArray(p.atualizacoesOrigem) && p.atualizacoesOrigem.length) {
    const c = cache.carregar(); let mudou = false;
    for (const a of p.atualizacoesOrigem) {
      const v = c.vagas[a.idExterno] || Object.values(c.vagas).find(v => (v.idsAlternativos || []).includes(a.idExterno));
      if (!v) { falhas.push({ idExterno: a.idExterno, erro: 'PROVENIENCIA_CACHE_AUSENTE: reconciliar identidade antes de encerrar.' }); continue; }
      v.origemFeed = [...new Set([...(v.origemFeed || []), ...(a.origemFeed || [])])];
      v.idsAlternativos = [...new Set([...(v.idsAlternativos || []), ...(a.idsAlternativos || [])])].filter(id => id !== v.idExterno);
      mudou = true;
    }
    if (mudou) {
      cache.salvar(c);
      const salvo = cache.carregar();
      for (const a of p.atualizacoesOrigem) {
        const v = salvo.vagas[a.idExterno] || Object.values(salvo.vagas).find(v => (v.idsAlternativos || []).includes(a.idExterno));
        if (v && (a.origemFeed || []).some(origem => !v.origemFeed?.includes(origem))) falhas.push({ idExterno: a.idExterno, erro: 'PROVENIENCIA_NAO_CONFIRMADA' });
      }
    }
  }
  const r = { runId: s.runId, fonte: modo, em: agora.toISOString(), confirmadas, pendentes, falhas,
    triagemPendente: p.pendencias.length, contagem: p.contagem, concluida: !pendentes.length && !falhas.length && !p.pendencias.length };
  const relatorio = join(DIR_DADOS, 'linkedin-feed', s.runId, 'integracao.json'); guardar(relatorio, r);
  if (r.concluida) executar({ dirDados: DIR_DADOS, acao: 'integrado', dono, fuso: fuso(), referencia: relatorio,
    integracao: { pendentes: 0, confirmadas, relatorioRef: relatorio } });
  saida(r); return r;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(erro => { process.stderr.write(`${JSON.stringify({ ok: false, erro: erro.message })}\n`); process.exitCode = 1; });
}
