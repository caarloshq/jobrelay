// Cobertura da rodada e aceite de pacotes. Não preenche formulários nem autoriza Submit.
import path from 'node:path';
import crypto from 'node:crypto';
import { lerJsonSeguro, gravarJsonAtomico } from './persistencia.js';
import { comEscritaCentral } from './operacao.js';

const erro = codigo => { throw new Error(codigo); };
const texto = (v, codigo) => typeof v === 'string' && v.trim() ? v.trim() : erro(codigo);
const sha = v => crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const hash = v => /^[a-f0-9]{64}$/.test(v) ? v : erro('HASH_INVALIDO');
const id = v => /^[a-zA-Z][a-zA-Z0-9_-]*:[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(v) ? v : erro('IDENTIDADE_FORTE_OBRIGATORIA');
const arquivo = dir => path.join(path.resolve(dir), 'rodada-lote.json');
const ler = dir => {
  const s = lerJsonSeguro(arquivo(dir));
  if (s.contrato !== 1 || !s.rodadaId || !s.vagas || !Array.isArray(s.frentes)) erro('LOTE_INVALIDO');
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
function acrescentar(s, ids, origem, provaRef) {
  for (const identidade of ids) if (!Object.hasOwn(s.vagas, identidade)) s.vagas[identidade] = { id: identidade, estado: 'nao_percorrida', origem, provaRef, versao: 0, pacote: null, revisao: null, aceite: null };
}
function coletaLiberada(s) {
  return !s.frentes.includes('coleta') || (s.captura.estado === 'encerrada' &&
    Boolean(s.captura.provaRef && s.captura.filaConferidaRef && s.captura.integracaoRef && s.captura.arquivosRef));
}
function plano(s, atual) {
  const desconhecidas = atual.ids.filter(i => !Object.hasOwn(s.vagas, i));
  const vagas = Object.values(s.vagas);
  const naoPercorridas = s.frentes.includes('aplicacao') ? [...new Set([...desconhecidas, ...vagas.filter(v => v.estado === 'nao_percorrida').map(v => v.id)])] : [];
  const independentes = vagas.filter(v => ['preparando', 'aguardando_revisao', 'revisada', 'liberada'].includes(v.estado)).map(v => ({ id: v.id, estado: v.estado }));
  const capturaPendente = !coletaLiberada(s);
  const podePerguntar = s.estado === 'ativa' && naoPercorridas.length === 0 && independentes.length === 0 && !capturaPendente && coletaLiberada(s);
  const perguntasConcluidas = !s.houvePerguntas || ['encerrada', 'impedida'].includes(s.perguntas?.estado);
  return { rodadaId: s.rodadaId, estado: s.estado, filaAtualRef: atual.provaRef, naoPercorridas, trabalhoIndependente: independentes,
    capturaPendente, podeAplicar: s.estado === 'ativa' && s.frentes.includes('aplicacao') && coletaLiberada(s), podePerguntar, perguntas: s.perguntas, fronteiraOperacionalPronta: podePerguntar && perguntasConcluidas, podeEncerrar: podePerguntar && perguntasConcluidas && s.melhorias.estado !== 'aceita', perguntasPendentes: podePerguntar ? vagas.filter(v => v.estado === 'aguardando_pessoa').map(v => ({ id: v.id, provaRef: v.provaRef })) : [],
    podeOferecerMelhorias: s.estado !== 'encerrada' && s.frentes.includes('aplicacao') && podePerguntar && perguntasConcluidas && s.melhorias.estado === 'nao_oferecida', melhorias: s.melhorias, liberadoSubmit: false };
}
export function planejarLote(dirDados, dependencias = {}) { return plano(ler(dirDados), consultar(dependencias)); }

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
      s = { contrato: 1, estado: 'ativa', historico: anterior ? [...(anterior.historico || []), Object.fromEntries(Object.entries(anterior).filter(([k]) => k !== 'historico'))] : [], rodadaId: crypto.randomUUID(), frentes, leituraRegrasRef: texto(args.leituraRegrasRef, 'LEITURA_REGRAS_OBRIGATORIA'),
        captura: { estado: frentes.includes('coleta') ? 'pendente' : 'dispensada', provaRef: null }, vagas: {}, houvePerguntas: false, perguntas: { estado: 'pendente', provaRef: null }, melhorias: { estado: 'nao_oferecida', provaRef: null } };
      acrescentar(s, inicial.ids, 'filaInicial', inicial.provaRef);
    } else {
      s = ler(dirDados);
      if (args.rodadaId !== s.rodadaId) erro('RODADA_DIVERGENTE');
      if (s.estado === 'encerrada') erro('RODADA_ENCERRADA');
      if (acao === 'encerrar') {
        if (!plano(s, consultar(dependencias)).podeEncerrar) erro('FECHAMENTO_PENDENTE');
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
      } else if (acao === 'perguntas') {
        if (!plano(s, consultar(dependencias)).podePerguntar) erro('TRABALHO_INDEPENDENTE_PENDENTE');
        if (!['apresentada', 'encerrada', 'impedida'].includes(args.estado)) erro('FASE_PERGUNTAS_INVALIDA');
        if (args.estado !== 'apresentada' && s.perguntas?.estado !== 'apresentada') erro('PERGUNTAS_NAO_APRESENTADAS');
        if (args.estado === 'encerrada' && Object.values(s.vagas).some(v => v.estado === 'aguardando_pessoa')) erro('RESPOSTAS_PESSOAIS_PENDENTES');
        s.perguntas = { estado: args.estado, provaRef: texto(args.provaRef, 'PROVA_PERGUNTAS_OBRIGATORIA') };
      } else if (acao === 'melhorias') {
        if (!s.frentes.includes('aplicacao')) erro('MELHORIAS_SOMENTE_APLICACAO');
        if (s.melhorias.estado !== 'nao_oferecida' || typeof args.aceite !== 'boolean') erro('ACEITE_MELHORIAS_INVALIDO');
        if (!plano(s, consultar(dependencias)).podeOferecerMelhorias) erro('TRABALHO_INDEPENDENTE_PENDENTE');
        s.melhorias = { estado: args.aceite ? 'aceita' : 'recusada', provaRef: texto(args.provaRef, 'PROVA_ACEITE_OBRIGATORIA') };
      } else if (acao === 'concluir_melhorias') {
        if (!plano(s, consultar(dependencias)).fronteiraOperacionalPronta) erro('TRABALHO_INDEPENDENTE_PENDENTE');
        if (s.melhorias.estado !== 'aceita' || !['concluida', 'impedida'].includes(args.estado)) erro('CONCLUSAO_MELHORIAS_INVALIDA');
        s.melhorias = { ...s.melhorias, estado: args.estado, conclusaoRef: texto(args.provaRef, 'PROVA_MELHORIAS_OBRIGATORIA') };
      } else {
        const identidade = id(args.id);
        const v = Object.hasOwn(s.vagas, identidade) ? s.vagas[identidade] : null;
        if (!v) erro('VAGA_FORA_DO_LOTE');
        if (['enviada', 'descartada'].includes(v.estado)) erro('VAGA_TERMINAL');
        if (s.frentes.includes('coleta') && !coletaLiberada(s) &&
            (['fixar', 'liberar_envio', 'confirmar_envio', 'revisar'].includes(acao) ||
              (acao === 'atualizar' && ['preparando', 'aguardando_pessoa'].includes(args.estado)))) erro('COLETA_ANTES_APLICACAO');
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
          if (!v.pacote || args.pacoteHash !== v.pacote.hash || !v.revisao?.aprovada || v.revisao.pacoteHash !== v.pacote.hash) erro('REVISAO_EXATA_OBRIGATORIA');
          if (typeof dependencias.gateEnvio !== 'function') erro('GATE_ENVIO_OBRIGATORIO');
          const aceite = dependencias.gateEnvio(structuredClone({ rodadaId: s.rodadaId, id: v.id, pacote: v.pacote, revisao: v.revisao }));
          if (aceite?.aceito !== true) erro('GATE_ENVIO_RECUSADO');
          v.aceite = { pacoteHash: v.pacote.hash, provaRef: texto(aceite.provaRef, 'PROVA_ACEITE_OBRIGATORIA') }; v.estado = 'liberada';
        } else if (acao === 'confirmar_envio') {
          if (v.estado !== 'liberada' || args.pacoteHash !== v.aceite?.pacoteHash) erro('ACEITE_EXATO_OBRIGATORIO');
          v.provaRef = texto(args.provaRef, 'CONFIRMACAO_EXTERNA_OBRIGATORIA'); v.estado = 'enviada';
        } else erro('ACAO_DESCONHECIDA');
      }
    }
    gravarJsonAtomico(destino, s);
    return { rodadaId: s.rodadaId, ...(args.id ? { vaga: s.vagas[args.id] } : {}), liberadoSubmit: false };
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
export function resumoColeta(entrada) {
  const campos = somenteCampos(entrada, ['encontradas', 'compativeis', 'descartadas', 'pendentesGravacao']);
  const { encontradas, compativeis, descartadas, pendentesGravacao = 0 } = campos;
  if (![encontradas, compativeis, descartadas, pendentesGravacao].every(contagem) ||
      compativeis + pendentesGravacao + descartadas !== encontradas) erro('CONTAGENS_INCOMPATIVEIS');
  const titulo = pendentesGravacao ? 'Coleta com gravação pendente ⚠️' : 'Coleta concluída ✅';
  const tabela = `| Resultado | Vagas |\n|---|---:|\n| 🔎 Encontradas | ${encontradas} |\n| 🎯 Compatíveis (adicionadas à fila) | ${compativeis} |\n| 🗑️ Descartadas (fora do perfil, encerradas, duplicadas ou já conhecidas) | ${descartadas} |`;
  const aviso = pendentesGravacao ? `\n\n${pendentesGravacao === 1 ? '1 vaga compatível aguarda' : `${pendentesGravacao} vagas compatíveis aguardam`} gravação na fila.` : '';
  return `${titulo}\n\n${tabela}${aviso}`;
}

// `enviadas` vem do chamador somente após recibos reais; o formatador não verifica portais.
export function resumoAplicacao(entrada) {
  const campos = somenteCampos(entrada, ['total', 'enviadas', 'pendentes', 'naoEnviadas']);
  const { total, enviadas, pendentes, naoEnviadas } = campos;
  if (![total, enviadas, pendentes, naoEnviadas].every(contagem) || enviadas + pendentes + naoEnviadas !== total) erro('CONTAGENS_INCOMPATIVEIS');
  const titulo = pendentes ? 'Aplicação encerrada com pendências ⏳' : 'Aplicação concluída ✅';
  return `${titulo}\n\n| Resultado | Vagas |\n|---|---:|\n| 📨 Enviadas (recebimento confirmado) | ${enviadas} |\n| ⏳ Pendentes (aguardando você ou o site) | ${pendentes} |\n| 🚫 Não enviadas (encerradas, fora do perfil ou impedidas) | ${naoEnviadas} |`;
}

// Uma linha por vaga no terminal, sem etapas internas (spec 010 substitui "Aplicando à vaga").
export function linhaProgressoAplicacao(entrada) {
  const campos = somenteCampos(entrada, ['numero', 'vaga', 'empresa']);
  const { numero, vaga, empresa } = campos;
  if (!Number.isSafeInteger(numero) || numero < 1) erro('NUMERO_VAGA_INVALIDO');
  const limpo = v => v.replace(/\s+/g, ' ');
  const nome = limpo(linhaUnica(vaga, 'NOME_VAGA_INVALIDO'));
  const daEmpresa = empresa === undefined || empresa === null || empresa === '' ? '' : ` · ${limpo(linhaUnica(empresa, 'EMPRESA_INVALIDA'))}`;
  return `Aplicando na vaga ${numero}: ${nome}${daEmpresa}`;
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
