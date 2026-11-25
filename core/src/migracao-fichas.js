import { lstatSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ativarFichas, lerFichas, pastaAplicacao, reconciliarTentativasFichas, recuperarFichas, restauracaoAtiva, restaurarFichas, usaFichas } from './fichas-vagas.js';
import { comEscritaCentral } from './operacao.js';
import { lerPendenciasLegadas, validarPendenciasParaFicha } from './pendencias-candidaturas.js';
import { lerTextoComHash, lerJsonSeguro, gravarTextoAtomico, gravarJsonAtomico } from './persistencia.js';

const fmtVazio = { versao: 2, sincronizadoEm: null, vagas: {} };
const erro = codigo => { throw new Error(codigo); };
const desescapar = texto => texto.replace(/\\([\\`*_{}\[\]()#+.!|>~-])/g, '$1');

function separarTitulo(linha) {
  const partes = [];
  let inicio = 0;
  for (let i = 0; i < linha.length; i++) {
    if (linha[i] === '\\') { i++; continue; }
    if (linha.slice(i, i + 3) !== ' | ') continue;
    partes.push(desescapar(linha.slice(inicio, i)));
    inicio = i += 3;
    i--;
  }
  partes.push(desescapar(linha.slice(inicio)));
  return partes;
}

// Lê o formato emitido por registrar:respostas. Seções sem ID continuam no original e no backup.
function respostasLegadas(conteudo) {
  const pacotes = [];
  let naoVinculadas = 0;
  let atual = null;
  let pergunta = null;
  let cerca = null;
  let resposta = [];
  const persistir = () => { if (atual?.campos.length) pacotes.push(atual); };
  for (const linha of conteudo.split('\n')) {
    if (cerca) {
      if (linha === cerca) {
        if (atual && pergunta) atual.campos.push({ pergunta, resposta: resposta.join('\n') });
        cerca = null;
        resposta = [];
      } else resposta.push(linha);
      continue;
    }
    const abertura = linha.match(/^(~{3,})text$/);
    if (abertura) { cerca = abertura[1]; continue; }
    if (linha.startsWith('## ')) {
      persistir();
      pergunta = null;
      const partes = separarTitulo(linha.slice(3));
      if (partes.length !== 4 || !/^\d{4}-\d{2}-\d{2}$/.test(partes[3])) {
        naoVinculadas++;
        atual = null;
        continue;
      }
      const [empresa, vaga, id, data] = partes;
      atual = { contexto: { empresa, vaga, id, data, estado: 'rascunho' }, campos: [] };
    } else if (atual && linha.startsWith('Estado: ')) {
      atual.contexto.estado = linha === 'Estado: enviada' ? 'enviada' : 'rascunho';
    } else if (atual && linha.startsWith('Evidência de envio: ')) {
      atual.contexto.evidenciaEnvio = desescapar(linha.slice('Evidência de envio: '.length));
    } else if (atual && linha.startsWith('### ')) {
      pergunta = desescapar(linha.slice(4));
    } else if (atual && pergunta && /^Referência privada: ref:[\w.:-]+$/.test(linha)) {
      atual.campos.push({ pergunta, referenciaPrivada: linha.slice('Referência privada: '.length) });
    }
  }
  if (cerca) erro('FICHAS_HISTORICO_INCOMPLETO');
  persistir();
  return { pacotes, naoVinculadas };
}

function inventario(dirDados) {
  const aplicacao = pastaAplicacao(dirDados);
  return Object.fromEntries([
    ['quadro', join(dirDados, 'quadro.json')],
    ['historico', join(dirDados, 'historico.json')],
    ['pendencias', join(aplicacao, 'PENDENCIAS-CANDIDATURAS.md')],
    ['pendenciasJson', join(dirDados, 'pendencias-candidaturas.json')],
    ['respostas', join(aplicacao, 'RESPOSTAS-PREENCHIDAS.md')],
    ['tentativas', join(dirDados, 'tentativas-envio.json')],
    ['lote', join(dirDados, 'rodada-lote.json')],
  ].map(([chave, arquivo]) => [chave, { arquivo, ...lerTextoComHash(arquivo, null) }]));
}

function lerMapa(fonte, chave, inicial) {
  if (!fonte.dados) return inicial;
  const dado = JSON.parse(fonte.dados);
  if (!dado?.[chave] || typeof dado[chave] !== 'object' || Array.isArray(dado[chave])) erro('FICHAS_FONTE_LEGADA_INVALIDA');
  return dado;
}

function coletar(dirDados) {
  const entrada = inventario(dirDados);
  const quadro = lerMapa(entrada.quadro, 'vagas', fmtVazio);
  const aparicoes = lerMapa(entrada.historico, 'vagas', { vagas: {} }).vagas;
  const pendencias = validarPendenciasParaFicha(lerPendenciasLegadas(dirDados));
  const { pacotes: respostas, naoVinculadas } = respostasLegadas(entrada.respostas.dados ?? '');
  const tentativas = Object.values(lerMapa(entrada.tentativas, 'tentativas', { tentativas: {} }).tentativas);
  const lote = lerMapa(entrada.lote, 'vagas', { vagas: {} });
  const rodadas = [...(lote.historico ?? []), lote].filter(r => r.rodadaId);
  const contagem = { quadro: Object.keys(quadro.vagas).length, aparicoes: Object.keys(aparicoes).length,
    pendencias: pendencias.length, respostas: respostas.length, respostasSemVinculo: naoVinculadas, tentativas: tentativas.length };
  return { entrada, quadro, aparicoes, pendencias, respostas, tentativas, rodadas, contagem };
}

function fazerBackup(dirDados, entrada, contagem) {
  const pasta = join(dirDados, 'backups', `fichas-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  const itens = {};
  for (const [chave, { arquivo, dados, hash }] of Object.entries(entrada)) {
    itens[chave] = { nome: basename(arquivo), hash };
    if (hash === null) continue;
    const copia = join(pasta, basename(arquivo));
    gravarTextoAtomico(copia, dados);
    if (lerTextoComHash(copia).hash !== hash) erro('FICHAS_BACKUP_DIVERGENTE');
  }
  gravarJsonAtomico(join(pasta, 'inventario.json'), { versao: 1, arquivos: itens, contagem });
  return pasta;
}

export function migrarFichas(dirDados, acao = 'migrar') {
  if (lerJsonSeguro(join(dirDados, 'fonte-estado.json'), { fonte: 'local' })?.fonte !== 'local') {
    return { estado: 'notion' };
  }
  if (acao === 'prever') {
    if (usaFichas(dirDados)) return { estado: 'ja_ativa', fichas: lerFichas(dirDados).fichas.size };
    const dados = coletar(dirDados);
    return { estado: 'previa', contagem: dados.contagem, ...ativarFichas(dirDados, dados, { prever: true }) };
  }
  return comEscritaCentral(dirDados, token => {
    if (token.dono !== `legado:${process.pid}` || process.env.VAGAS_OPERACAO_TOKEN) erro('FICHAS_RODADA_ATIVA');
    const recuperada = recuperarFichas(dirDados);
    if (acao === 'restaurar') return restaurarFichas(dirDados);
    if (acao === 'recuperar' && usaFichas(dirDados)) {
      const ledger = lerJsonSeguro(join(dirDados, 'tentativas-envio.json'), { tentativas: {} });
      reconciliarTentativasFichas(dirDados, Object.values(ledger.tentativas));
    }
    if (acao === 'recuperar' || usaFichas(dirDados)) {
      return { estado: recuperada ? 'recuperada' : usaFichas(dirDados) ? 'ja_ativa' : 'sem_transacao' };
    }
    const dados = coletar(dirDados);
    ativarFichas(dirDados, dados, { prever: true });
    const backup = fazerBackup(dirDados, dados.entrada, dados.contagem);
    for (const { arquivo, hash } of Object.values(dados.entrada)) {
      if (lerTextoComHash(arquivo, null).hash !== hash) erro('FICHAS_FONTE_MUDOU');
    }
    ativarFichas(dirDados, { ...dados, backup: basename(backup) });
    return { estado: 'ativada', fichas: lerFichas(dirDados).fichas.size, contagem: dados.contagem, backup };
  });
}

export function garantirFichas(dirDados) {
  if (!lstatSync(dirDados, { throwIfNoEntry: false })) return;
  if (usaFichas(dirDados) || restauracaoAtiva(dirDados)) return;
  if (lerJsonSeguro(join(dirDados, 'fonte-estado.json'), { fonte: 'local' })?.fonte !== 'local') return;
  if (!process.env.VAGAS_OPERACAO_TOKEN) migrarFichas(dirDados);
}
