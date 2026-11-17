import { formatarMensagemOperacao } from './mensagens-operacao.js';
// Cobertura da rodada e aceite de pacotes. Não preenche formulários nem autoriza Submit.
import path from 'node:path';
import crypto from 'node:crypto';
import { lerJsonSeguro, gravarJsonAtomico } from './persistencia.js';
import { comEscritaCentral } from './operacao.js';
import { lerPendencias } from './pendencias-candidaturas.js';

const erro = codigo => { throw new Error(codigo); };
const texto = (v, codigo) => typeof v === 'string' && v.trim() ? v.trim() : erro(codigo);
const sha = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hash = v => /^[a-f0-9]{64}$/.test(v) ? v : erro('HASH_INVALIDO');
const id = v => /^[a-zA-Z][a-zA-Z0-9_-]*:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(v) ? v : erro('IDENTIDADE_FORTE_OBRIGATORIA');
const arquivo = dir => path.join(path.resolve(dir), 'rodada-lote.json');
const ler = dir => {
  const s = lerJsonSeguro(arquivo(dir));
  if (s.contrato !== 1 || !s.rodadaId || !s.vagas || !Array.isArray(s.frentes)) erro('LOTE_INVALIDO');
  // Lote anterior à spec 015: lido como sem coleta 2, só em memória. A primeira gravação o persiste.
  if (!s.coleta2) s.coleta2 = { estado: 'dispensada', motivo: 'lote_anterior' };
  if (!s.origem) s.origem = 'manual';
  return s;
};
function fila(valor) {
  if (!valor || !Array.isArray(valor.ids)) erro('FILA_ATUAL_OBRIGATORIA');
  return { ids: [...new Set(valor.ids.map(id))], provaRef: texto(valor.provaRef, 'PROVA_FILA_OBRIGATORIA') };
}
function consultar(deps) {
  if (typeof deps.consultarFila !== 'function') erro('CONSULTA_FILA_OBRIGATORIA');
  return fila(deps.consultarFila());
}
function integracaoColeta2(dirDados, args) {
  const runId = texto(args.runId, 'RUN_COLETA2_OBRIGATORIO');
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(runId) || !/^[0-9a-f-]+$/.test(runId)) erro('RUN_COLETA2_INVALIDO');
  const relatorioPath = path.join(path.resolve(dirDados), 'linkedin-feed', runId, 'integracao.json');
  if (typeof args.integracaoRef !== 'string' || path.resolve(args.integracaoRef) !== relatorioPath) erro('RELATORIO_COLETA2_DIVERGENTE');
  const relatorio = lerJsonSeguro(relatorioPath, null);
  if (!relatorio || relatorio.runId !== runId || relatorio.concluida !== true ||
      !Array.isArray(relatorio.confirmadas) || !Array.isArray(relatorio.pendentes) || relatorio.pendentes.length !== 0 ||
      !Array.isArray(relatorio.falhas) || relatorio.falhas.length !== 0 || relatorio.triagemPendente !== 0) erro('INTEGRACAO_COLETA2_NAO_CONCLUIDA');
  const ids = relatorio.confirmadas.map(item => {
    if (!item || typeof item !== 'object') erro('INTEGRACAO_COLETA2_INVALIDA');
    return id(item.idExterno);
  });
  if (new Set(ids).size !== ids.length) erro('IDS_INTEGRACAO_COLETA2_DUPLICADOS');
  return { runId, relatorioPath, ids };
}
function acrescentar(s, ids, origem, provaRef) {
  for (const identidade of ids) {
    if (!Object.hasOwn(s.vagas, identidade)) s.vagas[identidade] = { id: identidade, estado: 'nao_percorrida', origem, provaRef, versao: 0, pacote: null, revisao: null, aceite: null };
    else if (origem === 'filaInicial' && s.vagas[identidade].origem === 'coleta2' && s.vagas[identidade].estado === 'nao_percorrida') {
      // A pessoa pode ativar a aplicação em outra rodada; a leitura atual da fila
      // então a recoloca como trabalho inicial, sem herdar aceite ou envio.
      s.vagas[identidade] = { ...s.vagas[identidade], origem: 'filaInicial', provaRef };
    }
  }
}
function coletaLiberada(s) {
  return !s.frentes.includes('coleta') || (s.captura.estado === 'encerrada' &&
    Boolean(s.captura.provaRef && s.captura.filaConferidaRef && s.captura.integracaoRef && s.captura.arquivosRef));
}
// Coleta 2 pendente de uma rodada agendada nunca terá resposta: vale sem_resposta.
const coleta2Efetiva = s => s.coleta2.estado === 'pendente' && s.origem === 'agendada' ? { ...s.coleta2, estado: 'sem_resposta', provaRef: 'origem:agendada' } : s.coleta2;
function vagaConfirmada(v, atual) {
  return ['filaInicial', 'novaConfirmada', 'filaConferida', 'coleta2'].includes(v.origem) && atual.ids.includes(v.id);
}
function plano(s, atual, dependencias = {}) {
  const pendenciasPessoais = (dependencias.consultarPendencias?.() || []).filter(p => ['pendente', 'realizada_aguardando_conferencia'].includes(p.estado));
  const bloqueados = new Set(pendenciasPessoais.map(p => p.idCanonico));
  const desconhecidas = atual.ids.filter(i => !Object.hasOwn(s.vagas, i));
  const vagas = Object.values(s.vagas);
  const aplicacaoAtiva = s.frentes.includes('aplicacao') && dependencias.modoCandidatura === 'chrome_assistido' && dependencias.autorizadoCandidatura === true;
  const autorizouNovas = Boolean(s.coleta2.aplicarNovas?.provaRef) &&
    aplicacaoAtiva;
  const naoPercorridas = aplicacaoAtiva ? [...new Set([...desconhecidas, ...vagas.filter(v => v.estado === 'nao_percorrida' &&
    (v.origem !== 'coleta2' || autorizouNovas)).map(v => v.id)])].filter(i => !bloqueados.has(i)) : [];
  const independentes = aplicacaoAtiva ? vagas.filter(v => ['preparando', 'aguardando_revisao', 'revisada', 'liberada'].includes(v.estado) && !bloqueados.has(v.id)).map(v => ({ id: v.id, estado: v.estado })) : [];
  const capturaPendente = !coletaLiberada(s);
  const acionaveis = aplicacaoAtiva ? vagas.filter(v => !['enviada', 'descartada', 'adiada'].includes(v.estado) && vagaConfirmada(v, atual) && (v.origem !== 'coleta2' || autorizouNovas)) : [];
  const acionaveisSemPendencia = acionaveis.filter(v => !bloqueados.has(v.id));
  const retomadas = acionaveisSemPendencia.filter(v => v.origem === 'filaInicial' || v.estado !== 'nao_percorrida');
  const novasConfirmadas = acionaveisSemPendencia.filter(v => !retomadas.includes(v));
  const podePerguntar = s.estado === 'ativa' && naoPercorridas.length === 0 && independentes.length === 0;
  const fronteiraColetaPronta = podePerguntar && coletaLiberada(s);
  const perguntasConcluidas = !aplicacaoAtiva || !s.houvePerguntas || ['encerrada', 'impedida'].includes(s.perguntas?.estado);
  const fronteiraOperacionalPronta = fronteiraColetaPronta && perguntasConcluidas;
  const coleta2 = coleta2Efetiva(s);
  const coleta2Resolvida = !['pendente', 'aceita'].includes(coleta2.estado);
  const podeOferecerColeta2 = s.estado === 'ativa' && s.frentes.includes('coleta') && s.coleta2.estado === 'pendente' &&
    s.origem !== 'agendada' && fronteiraOperacionalPronta;
  // Motivos que impedem a pergunta enquanto valem; a rodada pode continuar e a pergunta voltar.
  const motivoPendente = coleta2.estado !== 'pendente' ? null : !coletaLiberada(s) ? 'coleta_principal_nao_encerrada'
    : aplicacaoAtiva && !(podePerguntar && perguntasConcluidas) ? 'aplicacao_nao_concluida' : null;
  const novasColeta2 = vagas.filter(v => v.origem === 'coleta2' && !['descartada', 'adiada'].includes(v.estado)).map(v => v.id);
  return { rodadaId: s.rodadaId, estado: s.estado, filaAtualRef: atual.provaRef, naoPercorridas, trabalhoIndependente: independentes,
    capturaPendente, podeAplicar: s.estado === 'ativa' && aplicacaoAtiva && acionaveisSemPendencia.length > 0,
    pendenciasPessoais, resumoPendenciasPessoais: { quantidade: pendenciasPessoais.length }, ordemAplicacao: [...retomadas, ...novasConfirmadas].map(v => ({ id: v.id, estado: v.estado, origem: v.origem })), podePerguntar, perguntas: s.perguntas, fronteiraOperacionalPronta, origem: s.origem, coleta2: { ...coleta2, motivoPendente }, podeOferecerColeta2, novasColeta2, podeEncerrar: fronteiraOperacionalPronta && coleta2Resolvida && s.melhorias.estado !== 'aceita', perguntasPendentes: podePerguntar ? vagas.filter(v => v.estado === 'aguardando_pessoa' && !bloqueados.has(v.id)).map(v => ({ id: v.id, provaRef: v.provaRef })) : [],
    podeOferecerMelhorias: s.estado !== 'encerrada' && aplicacaoAtiva && fronteiraOperacionalPronta && coleta2Resolvida && s.melhorias.estado === 'nao_oferecida', melhorias: s.melhorias, liberadoSubmit: false };
}
export function planejarLote(dirDados, dependencias = {}) { return plano(ler(dirDados), consultar(dependencias), { ...dependencias, consultarPendencias: () => lerPendencias(dirDados) }); }

export function operarLote(dirDados, acao, args = {}, dependencias = {}) {
  if (acao === 'planejar') return planejarLote(dirDados, dependencias);
  const destino = arquivo(dirDados);
  return comEscritaCentral(dirDados, () => {
    let s;
    if (acao === 'iniciar') {
      const anterior = lerJsonSeguro(destino, null);
      if (anterior && (anterior.contrato !== 1 || anterior.estado !== 'encerrada')) erro('LOTE_EXISTENTE');
      const frentes = [...new Set(args.frentes || [])];
      if (!frentes.length || frentes.some(f => !['coleta', 'aplicacao'].includes(f))) erro('FRENTES_INVALIDAS');
      const inicial = fila(args.filaInicial);
      const origem = args.origem === undefined ? 'manual' : ['manual', 'agendada'].includes(args.origem) ? args.origem : erro('ORIGEM_INVALIDA');
      const coleta2 = !frentes.includes('coleta') ? { estado: 'dispensada', motivo: 'frente_coleta_ausente' }
        : args.coleta2Habilitada === true ? { estado: 'pendente' } : { estado: 'dispensada', motivo: 'linkedin_desligado' };
      s = { contrato: 1, origem, coleta2, estado: 'ativa', historico: anterior ? [...(anterior.historico || []), Object.fromEntries(Object.entries(anterior).filter(([k]) => k !== 'historico'))] : [], rodadaId: crypto.randomUUID(), frentes, leituraRegrasRef: texto(args.leituraRegrasRef, 'LEITURA_REGRAS_OBRIGATORIA'),
        captura: { estado: frentes.includes('coleta') ? 'pendente' : 'dispensada', provaRef: null }, vagas: {}, houvePerguntas: false, perguntas: { estado: 'pendente', provaRef: null }, melhorias: { estado: 'nao_oferecida', provaRef: null } };
      acrescentar(s, inicial.ids, 'filaInicial', inicial.provaRef);
    } else {
      s = ler(dirDados);
      if (args.rodadaId !== s.rodadaId) erro('RODADA_DIVERGENTE');
      if (s.estado === 'encerrada') erro('RODADA_ENCERRADA');
      if (acao === 'encerrar') {
        if (!plano(s, consultar(dependencias), { ...dependencias, consultarPendencias: () => lerPendencias(dirDados) }).podeEncerrar) erro('FECHAMENTO_PENDENTE');
        s.coleta2 = coleta2Efetiva(s);
        s.estado = 'encerrada'; s.encerramentoRef = texto(args.provaRef, 'PROVA_ENCERRAMENTO_OBRIGATORIA');
      } else if (acao === 'integrar') {
        const atual = consultar(dependencias);
        const confirmadas = fila(args.confirmadas);
        if (confirmadas.ids.some(i => !atual.ids.includes(i))) erro('INTEGRACAO_NAO_CONFIRMADA_NA_FILA');
        acrescentar(s, confirmadas.ids, 'novaConfirmada', confirmadas.provaRef);
      } else if (acao === 'captura') {
        if (!s.frentes.includes('coleta') || !['encerrada', 'impedida'].includes(args.estado)) erro('CAPTURA_INVALIDA');
        const atual = consultar(dependencias);
        const registro = { estado: args.estado, provaRef: texto(args.provaRef, 'PROVA_CAPTURA_OBRIGATORIA'), filaConferidaRef: atual.provaRef };
        if (args.estado === 'encerrada') {
          registro.integracaoRef = texto(args.integracaoRef, 'PROVA_INTEGRACAO_OBRIGATORIA');
          registro.arquivosRef = texto(args.arquivosRef, 'PROVA_ARQUIVOS_OBRIGATORIA');
          registro.cobertura = args.cobertura || 'completa';
          if (!['completa', 'parcial'].includes(registro.cobertura)) erro('COBERTURA_INVALIDA');
          if (registro.cobertura === 'parcial') registro.limiteRef = texto(args.limiteRef, 'LIMITE_COBERTURA_OBRIGATORIO');
        }
        s.captura = registro;
        acrescentar(s, atual.ids, 'filaConferida', atual.provaRef);
      } else if (acao === 'coleta2_decidir') {
        if (!s.frentes.includes('coleta')) erro('COLETA2_NAO_APLICAVEL');
        if (s.coleta2.estado !== 'pendente') erro('COLETA2_JA_DECIDIDA');
        if (!['aceita', 'recusada', 'sem_resposta', 'dispensada'].includes(args.decisao)) erro('DECISAO_COLETA2_INVALIDA');
        // Rodada agendada não tem quem responda: a única decisão válida é sem_resposta (ou janela já feita hoje).
        if (s.origem === 'agendada' && !['sem_resposta', 'dispensada'].includes(args.decisao)) erro('DECISAO_INVALIDA_NA_AGENDADA');
        const provaRef = texto(args.provaRef, 'PROVA_DECISAO_OBRIGATORIA');
        const feedRunId = args.decisao === 'aceita' ? texto(args.feedRunId, 'RUN_COLETA2_OBRIGATORIO') : null;
        if (feedRunId && (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(feedRunId) || !/^[0-9a-f-]+$/.test(feedRunId))) erro('RUN_COLETA2_INVALIDO');
        const filaAntes = args.decisao === 'aceita' ? consultar(dependencias) : null;
        if (args.decisao === 'aceita' && !plano(s, filaAntes, dependencias).podeOferecerColeta2) erro('COLETA2_NAO_DEVIDA');
        if (args.decisao === 'dispensada') {
          if (args.motivo !== 'ja_feita_hoje') erro('MOTIVO_COLETA2_INVALIDO');
          s.coleta2 = { estado: 'dispensada', motivo: 'ja_feita_hoje', provaRef };
        } else s.coleta2 = { estado: args.decisao, provaRef, ...(args.decisao === 'aceita' ? {
          aceiteRef: provaRef, feedRunId, filaAntes: { ids: filaAntes.ids, provaRef: filaAntes.provaRef },
        } : {}) };
      } else if (acao === 'coleta2_captura') {
        if (!['aceita', 'impedida'].includes(s.coleta2.estado)) erro('COLETA2_NAO_ACEITA');
        if (!['encerrada', 'impedida'].includes(args.estado)) erro('CAPTURA_INVALIDA');
        const atual = consultar(dependencias);
        const aceiteRef = s.coleta2.aceiteRef;
        const registro = { estado: args.estado, provaRef: texto(args.provaRef, 'PROVA_CAPTURA_OBRIGATORIA'), filaConferidaRef: atual.provaRef,
          ...(aceiteRef ? { aceiteRef } : {}), ...(s.coleta2.feedRunId ? { feedRunId: s.coleta2.feedRunId } : {}), ...(s.coleta2.filaAntes ? { filaAntes: s.coleta2.filaAntes } : {}) };
        if (args.estado === 'encerrada') {
          if (!aceiteRef || !s.coleta2.filaAntes) erro('ACEITE_OU_SNAPSHOT_COLETA2_AUSENTE');
          registro.arquivosRef = texto(args.arquivosRef, 'PROVA_ARQUIVOS_OBRIGATORIA');
          const integracao = integracaoColeta2(dirDados, args);
          if (integracao.runId !== s.coleta2.feedRunId) erro('RUN_COLETA2_DIVERGENTE_DO_ACEITE');
          const antes = new Set(s.coleta2.filaAntes.ids);
          const novas = integracao.ids.filter(identidade => !antes.has(identidade));
          const naFila = new Set(atual.ids);
          if (novas.some(identidade => !naFila.has(identidade))) erro('NOVA_COLETA2_FORA_DA_FILA');
          registro.integracaoRef = integracao.relatorioPath;
          registro.integracaoRunId = integracao.runId;
          registro.cobertura = args.cobertura || 'completa';
          if (!['completa', 'parcial'].includes(registro.cobertura)) erro('COBERTURA_INVALIDA');
          if (registro.cobertura === 'parcial') registro.limiteRef = texto(args.limiteRef, 'LIMITE_COBERTURA_OBRIGATORIO');
          registro.idsIntegrados = novas;
          acrescentar(s, novas, 'coleta2', atual.provaRef);
        } else {
          registro.motivo = 'impedida';
          registro.acaoRef = texto(args.acaoRef, 'ACAO_NECESSARIA_OBRIGATORIA');
        }
        // O aceite da coleta 2 autoriza a passagem das vagas novas somente quando
        // os dois opt-ins desta instalação continuam ativos no momento da captura.
        const podeAplicar = dependencias.modoCandidatura === 'chrome_assistido' && dependencias.autorizadoCandidatura === true;
        s.coleta2 = { ...registro, ...(args.estado === 'encerrada' && podeAplicar && aceiteRef
          ? { aplicarNovas: { decisao: 'sim', provaRef: aceiteRef, origem: 'aceite_coleta2' } } : {}) };
      } else if (acao === 'coleta2_integrar') {
        // Captura de outro dia que só esperava integração: trabalho local, sem pergunta, também na rodada agendada.
        if (!s.frentes.includes('coleta') || s.coleta2.estado !== 'pendente') erro('COLETA2_NAO_PENDENTE');
        if (!coletaLiberada(s)) erro('COLETA_PRINCIPAL_NAO_ENCERRADA');
        const atual = consultar(dependencias);
        s.coleta2 = { estado: 'encerrada', motivo: 'so_integracao', provaRef: texto(args.provaRef, 'PROVA_INTEGRACAO_OBRIGATORIA'), filaConferidaRef: atual.provaRef,
          integracaoRef: texto(args.integracaoRef, 'PROVA_INTEGRACAO_OBRIGATORIA'), arquivosRef: texto(args.arquivosRef, 'PROVA_ARQUIVOS_OBRIGATORIA'), cobertura: 'completa' };
        acrescentar(s, atual.ids, 'coleta2', atual.provaRef);
      } else if (acao === 'aplicar_novas') {
        if (s.coleta2.estado !== 'encerrada') erro('COLETA2_NAO_ENCERRADA');
        if (dependencias.modoCandidatura !== 'chrome_assistido' || dependencias.autorizadoCandidatura !== true) erro('APLICACAO_NAO_AUTORIZADA');
        if (s.coleta2.aplicarNovas?.provaRef) erro('NOVAS_JA_AUTORIZADAS');
        const aceiteRef = s.coleta2.aceiteRef;
        if (!aceiteRef) erro('ACEITE_COLETA2_AUSENTE');
        s.coleta2 = { ...s.coleta2, aplicarNovas: { decisao: 'sim', provaRef: aceiteRef, origem: 'aceite_coleta2' } };
      } else if (acao === 'adiar') {
        if (s.coleta2.estado !== 'encerrada') erro('COLETA2_NAO_ENCERRADA');
        if (s.coleta2.aplicarNovas) erro('NOVAS_JA_AUTORIZADAS');
        const provaRef = texto(args.provaRef, 'PROVA_ADIAMENTO_OBRIGATORIA');
        let n = 0;
        for (const v of Object.values(s.vagas)) if (v.origem === 'coleta2' && v.estado === 'nao_percorrida') { v.estado = 'adiada'; v.provaRef = provaRef; n++; }
        s.coleta2 = { ...s.coleta2, adiadas: (s.coleta2.adiadas || 0) + n };
      } else if (acao === 'perguntas') {
        if (!plano(s, consultar(dependencias), { ...dependencias, consultarPendencias: () => lerPendencias(dirDados) }).podePerguntar) erro('TRABALHO_INDEPENDENTE_PENDENTE');
        if (!['apresentada', 'encerrada', 'impedida'].includes(args.estado)) erro('FASE_PERGUNTAS_INVALIDA');
        if (args.estado !== 'apresentada' && s.perguntas?.estado !== 'apresentada') erro('PERGUNTAS_NAO_APRESENTADAS');
        if (args.estado === 'encerrada' && Object.values(s.vagas).some(v => v.estado === 'aguardando_pessoa')) erro('RESPOSTAS_PESSOAIS_PENDENTES');
        s.perguntas = { estado: args.estado, provaRef: texto(args.provaRef, 'PROVA_PERGUNTAS_OBRIGATORIA') };
      } else if (acao === 'melhorias') {
        if (!s.frentes.includes('aplicacao')) erro('MELHORIAS_SOMENTE_APLICACAO');
        if (s.melhorias.estado !== 'nao_oferecida' || typeof args.aceite !== 'boolean') erro('ACEITE_MELHORIAS_INVALIDO');
        if (!plano(s, consultar(dependencias), { ...dependencias, consultarPendencias: () => lerPendencias(dirDados) }).podeOferecerMelhorias) erro('TRABALHO_INDEPENDENTE_PENDENTE');
        s.melhorias = { estado: args.aceite ? 'aceita' : 'recusada', provaRef: texto(args.provaRef, 'PROVA_ACEITE_OBRIGATORIA') };
      } else if (acao === 'concluir_melhorias') {
        if (!plano(s, consultar(dependencias), { ...dependencias, consultarPendencias: () => lerPendencias(dirDados) }).fronteiraOperacionalPronta) erro('TRABALHO_INDEPENDENTE_PENDENTE');
        if (s.melhorias.estado !== 'aceita' || !['concluida', 'impedida'].includes(args.estado)) erro('CONCLUSAO_MELHORIAS_INVALIDA');
        s.melhorias = { ...s.melhorias, estado: args.estado, conclusaoRef: texto(args.provaRef, 'PROVA_MELHORIAS_OBRIGATORIA') };
      } else {
        const identidade = id(args.id);
        const v = Object.hasOwn(s.vagas, identidade) ? s.vagas[identidade] : null;
        if (!v) erro('VAGA_FORA_DO_LOTE');
        if (['enviada', 'descartada'].includes(v.estado)) erro('VAGA_TERMINAL');
        if (v.estado === 'adiada') erro('VAGA_ADIADA');
        if (v.origem === 'coleta2' && (!s.coleta2.aplicarNovas?.provaRef ||
            dependencias.modoCandidatura !== 'chrome_assistido' || dependencias.autorizadoCandidatura !== true) &&
            ['fixar', 'revisar', 'liberar_envio', 'confirmar_envio', 'atualizar'].includes(acao)) erro('APLICAR_NOVAS_NAO_AUTORIZADO');
        if (['fixar', 'revisar', 'liberar_envio', 'confirmar_envio', 'atualizar'].includes(acao) &&
            (dependencias.modoCandidatura !== 'chrome_assistido' || dependencias.autorizadoCandidatura !== true || !s.frentes.includes('aplicacao'))) erro('APLICACAO_NAO_AUTORIZADA');
        if ((['fixar', 'liberar_envio', 'revisar'].includes(acao) ||
              (acao === 'atualizar' && ['preparando', 'aguardando_pessoa'].includes(args.estado))) && !vagaConfirmada(v, consultar(dependencias))) erro('VAGA_NAO_CONFIRMADA_NA_FILA');
        if (acao === 'atualizar') {
          if (['preparando', 'aguardando_pessoa'].includes(args.estado) && !s.frentes.includes('aplicacao')) erro('APLICACAO_NAO_SELECIONADA');
          if (!['preparando', 'aguardando_pessoa', 'bloqueada', 'descartada'].includes(args.estado)) erro('ESTADO_INVALIDO');
          if (args.estado === 'aguardando_pessoa') { s.houvePerguntas = true; s.perguntas = { estado: 'pendente', provaRef: null }; }
          v.estado = args.estado; v.provaRef = texto(args.provaRef, 'PROVA_ETAPA_OBRIGATORIA');
          v.pacote = null; v.revisao = null; v.aceite = null;
        } else if (acao === 'fixar') {
          if (!s.frentes.includes('aplicacao')) erro('APLICACAO_NAO_SELECIONADA');
          const fontes = args.fontes;
          if (!Array.isArray(fontes) || !fontes.length) erro('FONTES_OBRIGATORIAS');
          const pacote = { pacoteHash: hash(args.pacoteHash), fontes: fontes.map(f => ({ ref: texto(f.ref, 'FONTE_REF_OBRIGATORIA'), hash: hash(f.hash) })),
            autor: texto(args.autor, 'AUTOR_OBRIGATORIO'), observacaoAlvoRef: texto(args.observacaoAlvoRef, 'OBSERVACAO_ALVO_OBRIGATORIA') };
          v.versao++; v.pacote = { ...pacote, versao: v.versao, hash: sha({ rodadaId: s.rodadaId, id: v.id, ...pacote, versao: v.versao }) };
          v.revisao = null; v.aceite = null; v.estado = 'aguardando_revisao';
        } else if (acao === 'revisar') {
          if (!v.pacote || args.pacoteHash !== v.pacote.hash || args.observacaoAlvoRef !== v.pacote.observacaoAlvoRef) erro('PACOTE_DIVERGENTE');
          const revisor = texto(args.revisor, 'REVISOR_OBRIGATORIO');
          if (revisor === v.pacote.autor) erro('REVISAO_INDEPENDENTE_OBRIGATORIA');
          if (typeof args.aprovada !== 'boolean') erro('PARECER_OBRIGATORIO');
          v.revisao = { pacoteHash: v.pacote.hash, revisor, aprovada: args.aprovada, provaRef: texto(args.provaRef, 'PROVA_REVISAO_OBRIGATORIA') };
          v.aceite = null; v.estado = args.aprovada ? 'revisada' : 'preparando';
        } else if (acao === 'liberar_envio') {
          if (lerPendencias(dirDados).some(p => p.idCanonico === v.id && ['pendente', 'realizada_aguardando_conferencia'].includes(p.estado))) erro('ACAO_PESSOAL_PENDENTE');
          if (!v.pacote || args.pacoteHash !== v.pacote.hash || !v.revisao?.aprovada || v.revisao.pacoteHash !== v.pacote.hash) erro('REVISAO_EXATA_OBRIGATORIA');
          if (typeof dependencias.gateEnvio !== 'function') erro('GATE_ENVIO_OBRIGATORIO');
          const aceite = dependencias.gateEnvio(structuredClone({ rodadaId: s.rodadaId, id: v.id, pacote: v.pacote, revisao: v.revisao }));
          if (aceite?.aceito !== true) erro('GATE_ENVIO_RECUSADO');
          v.aceite = { pacoteHash: v.pacote.hash, provaRef: texto(aceite.provaRef, 'PROVA_ACEITE_OBRIGATORIA') }; v.estado = 'liberada';
        } else if (acao === 'confirmar_envio') {
          if (lerPendencias(dirDados).some(p => p.idCanonico === v.id && ['pendente', 'realizada_aguardando_conferencia'].includes(p.estado))) erro('ACAO_PESSOAL_PENDENTE');
          if (v.estado !== 'liberada' || args.pacoteHash !== v.aceite?.pacoteHash) erro('ACEITE_EXATO_OBRIGATORIO');
          v.provaRef = texto(args.provaRef, 'CONFIRMACAO_EXTERNA_OBRIGATORIA'); v.estado = 'enviada';
        } else erro('ACAO_DESCONHECIDA');
      }
    }
    gravarJsonAtomico(destino, s);
    return { rodadaId: s.rodadaId,
      ...(args.id ? { vaga: s.vagas[args.id] } : {}),
      ...(acao === 'coleta2_captura' && s.coleta2.estado === 'encerrada' ? {
        coleta2: { runId: s.coleta2.integracaoRunId, novasIntegradas: s.coleta2.idsIntegrados.length },
      } : {}),
      liberadoSubmit: false };
  }, [destino]);
}

const contagem = n => Number.isSafeInteger(n) && n >= 0;
// Só objeto simples, lido por campos próprios: protótipo herdado não vira contagem.
const somenteCampos = (obj, campos) => {
  if (!obj || typeof obj !== 'object' || Object.getPrototypeOf(obj) !== Object.prototype) erro('ENTRADA_INVALIDA');
  if (!Object.keys(obj).every(k => campos.includes(k))) erro('CAMPO_DESCONHECIDO');
  return Object.fromEntries(campos.filter(k => Object.hasOwn(obj, k)).map(k => [k, obj[k]]));
};
const linhaUnica = (v, codigo) => typeof v === 'string' && v.trim() && !/[\u0000-\u001f\u007f]/.test(v) ? v.trim() : erro(codigo);

// Texto aprovado na spec 010. Contagens em vagas únicas do mesmo lote:
// encontradas = compatíveis gravadas na fila + compatíveis aguardando gravação + descartadas.
const fase = valor => valor === undefined || valor === 'principal' ? 'principal' : valor === 'coleta2' ? 'coleta2' : erro('FASE_INVALIDA');
export function resumoColeta(entrada) {
  const campos = somenteCampos(entrada, ['encontradas', 'compativeis', 'descartadas', 'pendentesGravacao', 'fase', 'erros', 'precisaDeVoce']);
  const { encontradas, compativeis, descartadas, pendentesGravacao = 0 } = campos;
  const nome = fase(campos.fase) === 'coleta2' ? 'Coleta 2 (LinkedIn assistido)' : 'Coleta';
  if (![encontradas, compativeis, descartadas, pendentesGravacao].every(contagem) ||
      compativeis + pendentesGravacao + descartadas !== encontradas) erro('CONTAGENS_INCOMPATIVEIS');
  const titulo = pendentesGravacao ? `${nome} com gravação pendente ⚠️` : `${nome} concluída ✅`;
  const tabela = `| Resultado | Vagas |\n|---|---:|\n| 🔎 Encontradas | ${encontradas} |\n| 🎯 Compatíveis (adicionadas à fila) | ${compativeis} |\n| 🗑️ Descartadas (fora do perfil, encerradas, duplicadas ou já conhecidas) | ${descartadas} |`;
  const aviso = pendentesGravacao ? `\n\n${pendentesGravacao === 1 ? '1 vaga compatível aguarda' : `${pendentesGravacao} vagas compatíveis aguardam`} gravação na fila.` : '';
  return `${titulo}\n\n${tabela}${aviso}${rodape(campos)}`;
}

// Rodapé opcional dos resumos (spec 016): erros e o que precisa de a pessoa candidata, em linguagem de gente.
const MAX_PEDIDOS = 6;
function rodape(campos, semQuantidades = false) {
  const partes = [];
  if (campos.erros !== undefined) {
    if (!contagem(campos.erros)) erro('CONTAGENS_INCOMPATIVEIS');
    partes.push(`⚠️ Com erro: ${campos.erros}`);
  }
  if (campos.precisaDeVoce !== undefined) {
    if (!Array.isArray(campos.precisaDeVoce)) erro('PRECISA_DE_VOCE_INVALIDO');
    const itens = campos.precisaDeVoce.map(t => linhaUnica(t, 'PRECISA_DE_VOCE_INVALIDO'));
    if (itens.some(t => /[—–]/.test(t))) erro('TRAVESSAO_NAO_PERMITIDO');
    if (itens.length) {
      const mostrados = itens.slice(0, MAX_PEDIDOS).map(t => `- ${t}`);
      if (itens.length > MAX_PEDIDOS) mostrados.push(semQuantidades ? '- Há outras pendências no quadro.' : `- e mais ${itens.length - MAX_PEDIDOS}`);
      partes.push(`Precisa de você\n${mostrados.join('\n')}`);
    }
  }
  return partes.length ? `\n\n${partes.join('\n\n')}` : '';
}

// Fechamento da rodada autônoma: os quatro números e a lista. Cada número é de vagas únicas.
export function resumoRodada(entrada) {
  const { mapeadas, aplicadas, comErro, precisaDeVoce = [] } = somenteCampos(entrada, ['mapeadas', 'aplicadas', 'comErro', 'precisaDeVoce']);
  if (![mapeadas, aplicadas, comErro].every(contagem)) erro('CONTAGENS_INCOMPATIVEIS');
  // As métricas continuam no estado; a mensagem humana de envio não repete quantidades.
  return formatarMensagemOperacao('envios_fim', { pendentes: precisaDeVoce.length > 0 }) + rodape({ precisaDeVoce }, true);
}

// `enviadas` vem do chamador somente após recibos reais; o formatador não verifica portais.
export function resumoAplicacao(entrada) {
  const campos = somenteCampos(entrada, ['total', 'enviadas', 'pendentes', 'naoEnviadas', 'fase', 'erros', 'precisaDeVoce']);
  const { total, enviadas, pendentes, naoEnviadas } = campos;
  fase(campos.fase);
  if (![total, enviadas, pendentes, naoEnviadas].every(contagem) || enviadas + pendentes + naoEnviadas !== total) erro('CONTAGENS_INCOMPATIVEIS');
  if (campos.erros !== undefined && !contagem(campos.erros)) erro('CONTAGENS_INCOMPATIVEIS');
  return formatarMensagemOperacao('envios_fim', { pendentes: pendentes > 0 }) + rodape({ precisaDeVoce: campos.precisaDeVoce }, true);
}

// Coleta 2 que não rodou ou parou (spec 015). Sem travessão; motivos sem resumo são recusados.
const FRASES_COLETA2 = Object.freeze({
  recusada: 'Você escolheu fechar a rodada sem ela.',
  sem_resposta: 'A rodada agendada não tinha ninguém para responder, e a coleta 2 só roda com o seu aceite.',
  ja_feita_hoje: 'A janela de hoje já foi feita e integrada em outra rodada.',
  aplicacao_nao_concluida: 'A aplicação ainda não terminou, então a pergunta não foi feita.',
  coleta_principal_nao_encerrada: 'A coleta principal não fechou, e a coleta 2 grava no mesmo quadro.',
});
export function resumoColeta2Fora(entrada) {
  const { motivo, acao } = somenteCampos(entrada, ['motivo', 'acao']);
  if (['linkedin_desligado', 'lote_anterior', 'frente_coleta_ausente'].includes(motivo)) erro('MOTIVO_SEM_RESUMO');
  if (motivo === 'impedida') return `Coleta 2 (LinkedIn assistido) parou ⚠️\n\n${linhaUnica(acao, 'ACAO_NECESSARIA_INVALIDA')}`;
  if (!Object.hasOwn(FRASES_COLETA2, motivo)) erro('MOTIVO_COLETA2_INVALIDO');
  if (acao !== undefined) erro('ACAO_SOMENTE_IMPEDIDA');
  return `Coleta 2 (LinkedIn assistido) ficou de fora ⏭️\n\n${FRASES_COLETA2[motivo]}`;
}

// Uma linha por vaga no terminal, sem etapas internas (spec 010 substitui "Aplicando à vaga").
export function linhaProgressoAplicacao(entrada) {
  const campos = somenteCampos(entrada, ['numero', 'vaga', 'empresa']);
  const { numero, vaga, empresa } = campos;
  if (!Number.isSafeInteger(numero) || numero < 1) erro('NUMERO_VAGA_INVALIDO');
  const limpo = v => v.replace(/\s+/g, ' ');
  const nome = limpo(linhaUnica(vaga, 'NOME_VAGA_INVALIDO'));
  const daEmpresa = empresa === undefined || empresa === null || empresa === '' ? '' : ` · ${limpo(linhaUnica(empresa, 'EMPRESA_INVALIDA'))}`;
  return `Preparando envio para ${nome}${daEmpresa}`;
}

// Passes de melhorias (spec 010): a coleta registra achados sem perguntar nem alterar
// arquivos; a aplicação reúne os achados das duas frentes e só corrige com aceite.
const POLITICA_MELHORIAS = Object.freeze({
  coleta: Object.freeze({ fase: 'coleta', registraAchados: true, ofereceAPessoa: false, alteraArquivos: false, exigeAceite: false, levaAchadosPara: 'aplicacao' }),
  aplicacao: Object.freeze({ fase: 'aplicacao', registraAchados: true, ofereceAPessoa: true, alteraArquivos: 'somente_com_aceite', exigeAceite: true, levaAchadosPara: null }),
});
export function politicaMelhorias(fase) {
  return Object.hasOwn(POLITICA_MELHORIAS, String(fase)) ? POLITICA_MELHORIAS[fase] : erro('FASE_MELHORIAS_INVALIDA');
}
