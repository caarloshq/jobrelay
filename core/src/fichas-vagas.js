// O índice identifica as fichas. O estado de cada vaga fica em seu Markdown.
import { CAMPO_PROTEGIDO, VALOR_PROTEGIDO } from './dados-protegidos.js';
import { lstatSync, unlinkSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { lerJsonComHash, lerJsonSeguro, lerTextoComHash, gravarJsonAtomico, gravarTextoAtomico } from './persistencia.js';

const PASTAS = new Set(['fila', 'pendentes', 'concluidas', 'excluidas']);
const BLOQUEIOS = new Set(['pendente', 'realizada_aguardando_conferencia']);
const APLICADAS = new Set(['Já apliquei', 'Entrevista', 'Aplicado por IA']);
const META_PROTEGIDA = new Set(['pergunta', 'rotulo', 'label', 'nome', 'name', 'tipo', 'type', 'referenciaPrivada']);
const digest = texto => createHash('sha256').update(texto).digest('hex');
const erro = codigo => { throw new Error(codigo); };
const objeto = x => x && typeof x === 'object' && !Array.isArray(x);
const idValido = x => typeof x === 'string' && x.trim() === x && x.length > 0 &&
  !/[\x00-\x1f]/.test(x) && !['__proto__', 'prototype', 'constructor'].includes(x);

export function pastaAplicacao(dirDados) {
  return resolve(dirDados, '../aplicacao');
}

function arquivos(dirDados) {
  const raiz = pastaAplicacao(dirDados);
  return {
    raiz,
    indice: join(raiz, '.fichas-vagas.json'),
    diario: join(raiz, '.fichas-transacao.json'),
    restauro: join(raiz, '.fichas-restauracao.json'),
    revertida: join(raiz, '.fichas-restauradas.json'),
    quadro: join(dirDados, 'quadro.json'),
    lote: join(dirDados, 'rodada-lote.json'),
    pendencias: join(dirDados, 'pendencias-candidaturas.json'),
  };
}

export function usaFichas(dirDados) {
  const a = arquivos(dirDados);
  if (lerJsonSeguro(join(dirDados, 'fonte-estado.json'), { fonte: 'local' })?.fonte !== 'local') return false;
  return Boolean(lstatSync(a.indice, { throwIfNoEntry: false }) || lstatSync(a.diario, { throwIfNoEntry: false }) || lstatSync(a.restauro, { throwIfNoEntry: false }));
}

export function sanearFicha(valor) {
  if (Array.isArray(valor)) return valor.map(sanearFicha);
  if (typeof valor === 'string') {
    if (VALOR_PROTEGIDO.test(valor)) return '[dado protegido]';
    if (!/^https?:\/\//i.test(valor)) return valor;
    try {
      const url = new URL(valor);
      if (url.username || url.password) return '[endereço protegido]';
      const protegidos = [...url.searchParams.keys()].filter(k => CAMPO_PROTEGIDO.test(k) || /(?:token|password|senha|session|credential|signature)/i.test(k));
      for (const chave of protegidos) url.searchParams.delete(chave);
      return protegidos.length ? url.href : valor;
    } catch { return valor; }
  }
  if (!objeto(valor)) return valor;
  const protegido = [valor.tipo, valor.type].some(tipo => /^password$/i.test(tipo ?? '')) ||
    [valor.pergunta, valor.rotulo, valor.label, valor.nome, valor.name].some(campo => typeof campo === 'string' && CAMPO_PROTEGIDO.test(campo));
  return Object.fromEntries(Object.entries(valor).filter(([chave]) =>
    idValido(chave) && !CAMPO_PROTEGIDO.test(chave) &&
    (!protegido || META_PROTEGIDA.has(chave)),
  ).map(([chave, dado]) => [chave, sanearFicha(dado)]));
}

function pastaDaFicha(ficha) {
  if (ficha.quadro?.status === 'Cancelada') return 'excluidas';
  if (ficha.pendencias.some(p => BLOQUEIOS.has(p.estado)) ||
      ficha.etapas?.[ficha.rodadaAtual]?.estado === 'aguardando_pessoa' ||
      ficha.tentativas.some(t => t.desfecho !== 'confirmado')) return 'pendentes';
  if (APLICADAS.has(ficha.quadro?.status) ||
      ficha.tentativas.some(t => t.desfecho === 'confirmado' && t.provaRef)) return 'concluidas';
  return 'fila';
}

function caminho(a, entrada) {
  if (!PASTAS.has(entrada.pasta) || !Number.isSafeInteger(entrada.numero) || entrada.numero < 1) erro('FICHA_INDICE_INVALIDO');
  return join(a.raiz, entrada.pasta, String(entrada.numero).padStart(4, '0') + '.md');
}

const linha = valor => String(valor ?? '').replace(/[\r\n]+/g, ' ').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]).replace(/[\\`*_{}\[\]()#+.!|>~-]/g, '\\$&');
function markdown(ficha) {
  const v = ficha.quadro ?? {};
  const nome = v.titulo ?? ficha.aparicoes?.titulo ?? ficha.pendencias[0]?.cargo ?? ficha.respostas[0]?.contexto?.vaga ?? ficha.id;
  const empresa = v.empresa ?? ficha.aparicoes?.empresa ?? ficha.pendencias[0]?.empresa ?? ficha.respostas[0]?.contexto?.empresa;
  const linhas = [`# ${ficha.numero} · ${linha(nome)}${empresa ? ' · ' + linha(empresa) : ''}`, '',
    `**${linha(v.status ?? 'Sem situação no quadro')}**`, '', '## Anúncio e triagem', '',
    `- Identificador: ${linha(ficha.id)}`];
  for (const [rotulo, valor] of [['Link', v.url], ['Fonte', v.fonte], ['Compatibilidade', v.compatibilidade], ['Descrição', v.descricao]]) {
    if (valor != null) linhas.push(`- ${rotulo}: ${linha(valor)}`);
  }
  linhas.push('', '## Histórico', '');
  for (const estado of v.historico ?? []) linhas.push(`- ${linha(estado.em)} · ${linha(estado.para)} · ${linha(estado.por)}`);
  if (ficha.aparicoes?.dias?.length) linhas.push(`- Aparições: ${ficha.aparicoes.dias.map(linha).join(', ')}`);
  linhas.push('', '## Respostas', '');
  for (const pacote of ficha.respostas) {
    linhas.push(`- ${linha(pacote.contexto.data)} · ${linha(pacote.contexto.estado)}`);
    for (const c of pacote.campos) linhas.push(`  - ${linha(c.pergunta)} — ${linha(c.resposta ?? c.referenciaPrivada ?? '[dado protegido]')}`);
  }
  linhas.push('', '## Pendências', '');
  const etapa = ficha.etapas?.[ficha.rodadaAtual];
  if (etapa?.estado === 'aguardando_pessoa') linhas.push(`- Rodada · aguardando resposta · ${linha(etapa.provaRef)}`);
  for (const p of ficha.pendencias) linhas.push(`- ${linha(p.etapa)} · ${linha(p.estado)} · ${linha(p.proximaAcao)}`);
  linhas.push('', '## Arquivos e comprovantes', '');
  for (const ref of [v.curriculoCaminho, v.curriculo, v.carta].filter(ref => typeof ref === 'string')) linhas.push(`- ${linha(ref)}`);
  for (const r of ficha.respostas) if (r.contexto.evidenciaEnvio) linhas.push(`- ${linha(r.contexto.evidenciaEnvio)}`);
  for (const t of ficha.tentativas) {
    const tipo = t.origem === 'lote' ? 'referência registrada no lote' : t.provaRef ? 'comprovante' : 'tentativa';
    linhas.push(`- ${linha(t.tentativaId)} · ${tipo} · ${linha(t.desfecho ?? 'aguardando conferência')}${t.provaRef ? ' · ' + linha(t.provaRef) : ''}`);
  }
  linhas.push('', '```json jobrelay-ficha', JSON.stringify(ficha, null, 2), '```', '');
  return linhas.join('\n');
}

function lerFicha(a, id, entrada) {
  const { dados, hash } = lerTextoComHash(caminho(a, entrada), null);
  if (dados === null || hash !== entrada.hash) erro('FICHA_AUSENTE_OU_ALTERADA');
  const bloco = dados.match(/\n```json jobrelay-ficha\n([\s\S]+)\n```\n$/);
  if (!bloco) erro('FICHA_MARKDOWN_INVALIDO');
  const ficha = JSON.parse(bloco[1]);
  if (ficha.id !== id || ficha.numero !== entrada.numero || ficha.versao !== 1 || pastaDaFicha(ficha) !== entrada.pasta) erro('FICHA_IDENTIDADE_DIVERGENTE');
  return ficha;
}

function lerIndice(a) {
  const atual = lerJsonComHash(a.indice, null);
  const indice = atual.dados;
  if (indice && (indice.versao !== 1 || !objeto(indice.fichas) || !Number.isSafeInteger(indice.proximo))) erro('FICHA_INDICE_INVALIDO');
  return atual;
}

function lerInventario(a, indice) {
  const fichas = new Map();
  const numeros = new Set();
  for (const [id, entrada] of Object.entries(indice.fichas)) {
    if (!idValido(id) || numeros.has(entrada.numero)) erro('FICHA_IDENTIDADE_DUPLICADA');
    numeros.add(entrada.numero);
    fichas.set(id, lerFicha(a, id, entrada));
  }
  return fichas;
}

function quadroDoIndice(indice, fichas) {
  return {
    ...indice.quadro,
    vagas: Object.fromEntries([...fichas].filter(([, ficha]) => ficha.quadro).map(([id, ficha]) => [id, ficha.quadro])),
  };
}

// Uma leitura entre duas gravações poderá ser refeita após o término da escrita.
export function lerFichas(dirDados) {
  const a = arquivos(dirDados);
  const { dados: indice, hash } = lerIndice(a);
  if (lerJsonSeguro(a.diario, null) || lerJsonSeguro(a.restauro, null)) erro('FICHAS_TRANSACAO_PENDENTE: use npm run fichas -- recuperar');
  if (!indice) erro('FICHAS_NAO_ATIVADAS');
  const fichas = lerInventario(a, indice);
  if (lerIndice(a).hash !== hash || lerJsonSeguro(a.diario, null) || lerJsonSeguro(a.restauro, null)) erro('FICHAS_CONFLITO_LEITURA');
  return { fichas, hash, quadro: quadroDoIndice(indice, fichas), backup: indice.backup };
}

function publicar(a, diario) {
  const atual = lerIndice(a);
  const novoHash = digest(JSON.stringify(diario.indice, null, 2) + '\n');
  if (atual.hash !== diario.base && atual.hash !== novoHash) erro('FICHAS_TRANSACAO_DIVERGENTE');
  for (const ficha of diario.alteradas) {
    const destino = caminho(a, diario.indice.fichas[ficha.id]);
    const anterior = diario.anteriores[ficha.id];
    const conteudo = markdown(ficha);
    const atualDestino = lerTextoComHash(destino, null);
    if (atualDestino.hash === digest(conteudo)) continue;
    if (atualDestino.hash !== (anterior && caminho(a, anterior) === destino ? anterior.hash : null)) erro('FICHA_DESTINO_EM_CONFLITO');
    gravarTextoAtomico(destino, conteudo);
  }
  for (const ficha of diario.alteradas) {
    const anterior = diario.anteriores[ficha.id];
    if (!anterior) continue;
    const origem = caminho(a, anterior);
    if (origem === caminho(a, diario.indice.fichas[ficha.id])) continue;
    const velho = lerTextoComHash(origem, null);
    if (velho.hash === null) continue;
    if (velho.hash !== anterior.hash) erro('FICHA_ORIGEM_EM_CONFLITO');
    unlinkSync(origem);
  }
  if (diario.lote) {
    const atualLote = lerJsonComHash(a.lote, null).hash;
    const novo = digest(JSON.stringify(diario.lote.valor, null, 2) + '\n');
    if (atualLote !== diario.lote.base && atualLote !== novo) erro('FICHA_LOTE_DIVERGENTE');
    if (atualLote !== novo) gravarJsonAtomico(a.lote, diario.lote.valor);
  }
  gravarJsonAtomico(a.indice, diario.indice);
  const fichas = lerInventario(a, diario.indice);
  gravarJsonAtomico(a.quadro, quadroDoIndice(diario.indice, fichas));
  gravarJsonAtomico(a.pendencias, { versao: 1, pendencias: [...fichas.values()].flatMap(ficha => ficha.pendencias) });
  unlinkSync(a.diario);
}

export function recuperarFichas(dirDados) {
  const a = arquivos(dirDados);
  const restauro = lerJsonSeguro(a.restauro, null);
  if (restauro) {
    publicarRestauro(a, dirDados, restauro);
    return true;
  }
  const diario = lerJsonSeguro(a.diario, null);
  if (!diario) return false;
  publicar(a, diario);
  return true;
}

function atualizar(dirDados, alterar, { hashEsperado, ativar = false, prever = false, lote } = {}) {
  const a = arquivos(dirDados);
  const { dados: anterior, hash } = lerIndice(a);
  if (lerJsonSeguro(a.diario, null) || lerJsonSeguro(a.restauro, null)) erro('FICHAS_TRANSACAO_PENDENTE: use npm run fichas -- recuperar');
  if (hashEsperado !== undefined && hashEsperado !== hash) erro('Conflito de versão: recarregue o estado antes de salvar.');
  if (!anterior && !ativar) erro('FICHAS_NAO_ATIVADAS');
  const indice = anterior ? structuredClone(anterior) : { versao: 1, revisao: 0, proximo: 1, quadro: {}, fichas: {} };
  const fichas = anterior ? lerInventario(a, anterior) : new Map();
  const pendentes = new Map();
  const idsConhecidos = new Map();
  function indexar(ficha) {
    for (const id of [ficha.id, ...ficha.aliases]) {
      if (idsConhecidos.has(id) && idsConhecidos.get(id) !== ficha) erro('FICHA_IDENTIDADE_AMBIGUA');
      idsConhecidos.set(id, ficha);
    }
  }
  for (const ficha of fichas.values()) indexar(ficha);
  function obter(id, aliases = [], criar = true) {
    if (!idValido(id) || !Array.isArray(aliases) || aliases.some(alias => !idValido(alias))) erro('FICHA_IDENTIDADE_INVALIDA');
    const ids = new Set([id, ...aliases]);
    const encontradas = [...new Set([...ids].map(id => idsConhecidos.get(id)).filter(Boolean))];
    if (encontradas.length > 1) erro('FICHA_IDENTIDADE_AMBIGUA');
    if (!criar && !encontradas.length) return null;
    const ficha = encontradas[0] ?? { versao: 1, id, aliases: [], numero: indice.proximo++, quadro: null,
      aparicoes: null, aparicoesPorId: {}, pendencias: [], respostas: [], tentativas: [], etapas: {} };
    ficha.aliases = [...new Set([...ficha.aliases, ...ids])].filter(alias => alias !== ficha.id);
    indexar(ficha);
    fichas.set(ficha.id, ficha);
    pendentes.set(ficha.id, ficha);
    return ficha;
  }
  alterar(indice, fichas, obter);
  const alteradas = [];
  const anteriores = {};
  for (const [id, ficha] of pendentes) {
    const entrada = { numero: ficha.numero, pasta: pastaDaFicha(ficha), hash: digest(markdown(ficha)) };
    if (indice.fichas[id]?.hash === entrada.hash) continue;
    anteriores[id] = indice.fichas[id] ?? null;
    indice.fichas[id] = entrada;
    alteradas.push(ficha);
  }
  if (prever) {
    for (const ficha of alteradas) {
      const destino = caminho(a, indice.fichas[ficha.id]);
      if (lerTextoComHash(destino, null).hash !== null) erro('FICHA_DESTINO_EM_CONFLITO');
    }
    return { fichas: fichas.size };
  }
  if (!lote && anterior && JSON.stringify(anterior) === JSON.stringify(indice)) return hash;
  if (anterior) indice.revisao = (anterior.revisao ?? 0) + 1;
  if (lote && JSON.stringify(lote) !== JSON.stringify(sanearFicha(lote))) erro('FICHA_LOTE_DADO_PROTEGIDO');
  const projecao = lote ? { base: lerJsonComHash(a.lote, null).hash, valor: lote } : null;
  const diario = { base: hash, indice, alteradas, anteriores, lote: projecao };
  gravarJsonAtomico(a.diario, diario);
  publicar(a, diario);
  return lerIndice(a).hash;
}

function incorporarQuadro(indice, fichas, obter, quadro, aparicoes = {}) {
  if (!objeto(quadro) || !objeto(quadro.vagas)) erro('FICHAS_QUADRO_INVALIDO');
  const { vagas, ...meta } = quadro;
  indice.quadro = sanearFicha(meta);
  for (const [id, linha] of Object.entries(vagas)) {
    if (!objeto(linha) || typeof linha.status !== 'string') erro('FICHAS_QUADRO_INVALIDO');
    const ficha = obter(id, linha.idsAlternativos ?? []);
    if (ficha.id !== id && (ficha.quadro || Object.hasOwn(vagas, ficha.id))) erro('FICHA_IDENTIDADE_AMBIGUA');
    ficha.quadro = sanearFicha(linha);
    for (const chave of [ficha.id, ...ficha.aliases]) {
      if (Object.hasOwn(aparicoes, chave)) inserirAparicao(ficha, chave, aparicoes[chave]);
    }
  }
  for (const ficha of fichas.values()) if (ficha.quadro && !Object.hasOwn(vagas, ficha.id) &&
    !ficha.aliases.some(alias => Object.hasOwn(vagas, alias))) erro('FICHA_QUADRO_NAO_PODE_APAGAR_VAGA');
}

export function salvarQuadroEmFichas(dirDados, quadro, hashEsperado) {
  const aparicoes = lerJsonSeguro(join(dirDados, 'historico.json'), { vagas: {} }).vagas;
  return atualizar(dirDados, (i, f, obter) => incorporarQuadro(i, f, obter, quadro, aparicoes), { hashEsperado });
}

function inserir(lista, dado, chave) {
  const indice = lista.findIndex(item => chave(item) === chave(dado));
  if (indice < 0) lista.push(dado);
  else lista[indice] = dado;
}

export function ativarFichas(dirDados, { quadro, aparicoes, pendencias, respostas, tentativas, rodadas, backup }, { prever = false } = {}) {
  return atualizar(dirDados, (i, f, obter) => {
    i.backup = backup;
    incorporarQuadro(i, f, obter, quadro);

    for (const p of pendencias) inserir(obter(p.idCanonico).pendencias, sanearFicha(p), x => x.id);
    for (const r of respostas) inserir(obter(r.contexto.id).respostas, sanearFicha(r), JSON.stringify);
    for (const t of tentativas) inserir(obter(t.chave, t.aliases ?? []).tentativas, tentativaSegura(t), x => x.tentativaId);
    for (const rodada of rodadas ?? []) {
      for (const vaga of Object.values(rodada.vagas)) {
        if (vaga.estado !== 'nao_percorrida' && vaga.id) inserirEtapa(obter(vaga.id), rodada.rodadaId, vaga);
      }
    }
    for (const [id, v] of Object.entries(aparicoes)) {
      const ficha = obter(id, [], false);
      if (ficha) inserirAparicao(ficha, id, v);
    }
  }, { ativar: true, hashEsperado: null, prever });
}

function tentativaSegura(tentativa) {
  const { tentativaId, intencaoEm, desfecho, provaRef, confirmadaEm, reconciliadaEm } = tentativa;
  const prova = sanearFicha(provaRef);
  const doLote = tentativa.origem === 'lote';
  return sanearFicha({ tentativaId, intencaoEm, desfecho,
    provaRef: typeof prova === 'string' && !prova.startsWith('[') ? prova : undefined, confirmadaEm, reconciliadaEm,
    ...(doLote ? { origem: 'lote', idLote: tentativa.idLote } : {}) });
}

export function gravarRespostaFicha(dirDados, pacote) {
  return atualizar(dirDados, (_i, _f, obter) => inserir(obter(pacote.contexto.id).respostas, sanearFicha(pacote), JSON.stringify));
}

export function gravarPendenciasFichas(dirDados, pendencias) {
  return atualizar(dirDados, (_i, _f, obter) => {
    for (const p of pendencias) inserir(obter(p.idCanonico).pendencias, sanearFicha(p), x => x.id);
  });
}

function registrarTentativa(ficha, tentativa) {
  const segura = tentativaSegura(tentativa);
  inserir(ficha.tentativas, segura, x => x.tentativaId);
  if (!ficha.quadro || segura.desfecho !== 'confirmado' || !segura.provaRef || APLICADAS.has(ficha.quadro.status) ||
      ficha.quadro.status === 'Cancelada') return;
  const de = ficha.quadro.status;
  ficha.quadro.status = 'Aplicado por IA';
  ficha.quadro.historico ??= [];
  ficha.quadro.historico.push({ em: segura.confirmadaEm ?? segura.reconciliadaEm ?? new Date().toISOString(),
    de, para: ficha.quadro.status, por: segura.origem === 'lote' ? 'lote' : 'comprovante' });
}

export function gravarTentativaFicha(dirDados, tentativa) {
  return atualizar(dirDados, (_i, _f, obter) => {
    registrarTentativa(obter(tentativa.chave, tentativa.aliases ?? []), tentativa);
  });
}

export function localizarFicha(dirDados, id) {
  const { fichas } = lerFichas(dirDados);
  const ficha = fichas.get(id) ?? [...fichas.values()].find(f => f.aliases.includes(id));
  return ficha ? { ficha, arquivo: caminho(arquivos(dirDados), { numero: ficha.numero, pasta: pastaDaFicha(ficha) }) } : null;
}

export function arquivoDoQuadro(arquivo) {
  return basename(arquivo) === 'quadro.json';
}


function inserirAparicao(ficha, id, registro) {
  ficha.aparicoesPorId ??= {};
  ficha.aparicoesPorId[id] = sanearFicha(registro);
  ficha.aparicoes = ficha.aparicoesPorId[ficha.id] ?? Object.values(ficha.aparicoesPorId)[0] ?? null;
}

export function gravarAparicoesFichas(dirDados, aparicoes) {
  return atualizar(dirDados, (_i, _f, obter) => {
    for (const [id, registro] of Object.entries(aparicoes)) {
      const ficha = obter(id, [], false);
      if (ficha) inserirAparicao(ficha, id, registro);
    }
  });
}

function inserirEtapa(ficha, rodadaId, vaga, mudarSituacao = false) {
  if (!idValido(rodadaId)) erro('FICHA_RODADA_INVALIDA');
  ficha.etapas ??= {};
  ficha.rodadaAtual = rodadaId;
  // idLote guarda a chave com que o lote registrou esta requisição.
  ficha.etapas[rodadaId] = sanearFicha({ estado: vaga.estado, provaRef: vaga.provaRef, idLote: vaga.id });
  if (vaga.estado === 'enviada') {
    // Uma tentativa por ficha e rodada: outro alias da mesma requisição não cria um segundo envio.
    // A referência vem da confirmação registrada no lote, não de uma conferência própria no portal.
    const tentativa = { tentativaId: `lote:${rodadaId}:${ficha.id}`, desfecho: 'confirmado', provaRef: vaga.provaRef,
      origem: 'lote', idLote: vaga.id };
    if (mudarSituacao) registrarTentativa(ficha, tentativa);
    else inserir(ficha.tentativas, tentativaSegura(tentativa), x => x.tentativaId);
  }
}

export function gravarEtapaFicha(dirDados, lote, vaga) {
  return atualizar(dirDados, (_i, _f, obter) => inserirEtapa(obter(vaga.id), lote.rodadaId, vaga, true), { lote });
}

export function reconciliarTentativasFichas(dirDados, tentativas) {
  return atualizar(dirDados, (_i, _f, obter) => {
    for (const t of tentativas) {
      const ficha = obter(t.chave, t.aliases ?? []);
      const anterior = ficha.tentativas.find(item => item.tentativaId === t.tentativaId);
      if (JSON.stringify(anterior) !== JSON.stringify(tentativaSegura(t))) registrarTentativa(ficha, t);
    }
  });
}

export function restauracaoAtiva(dirDados) {
  return Boolean(lerJsonSeguro(arquivos(dirDados).revertida, null));
}

function caminhoDoBackup(dirDados, nome) {
  if (typeof nome !== 'string' || !/^fichas-[0-9TZ-]+-[a-f0-9-]+$/.test(nome)) erro('FICHAS_BACKUP_INVALIDO');
  return join(dirDados, 'backups', nome);
}

function publicarRestauro(a, dirDados, plano) {
  const { dados: indice, hash } = lerIndice(a);
  const backup = caminhoDoBackup(dirDados, plano.backup);
  const arquivoIndice = join(backup, 'fichas-restauradas', 'indice.json');
  if (indice) {
    if (hash !== plano.hash || indice.backup !== plano.backup) erro('FICHAS_RESTAURACAO_DIVERGENTE');
    gravarJsonAtomico(arquivoIndice, indice);
  } else if (lerJsonComHash(arquivoIndice, null).hash !== plano.hash) {
    erro('FICHAS_RESTAURACAO_DIVERGENTE');
  }
  const arquivado = indice ?? lerJsonSeguro(arquivoIndice);
  for (const entrada of Object.values(arquivado.fichas)) {
    const origem = caminho(a, entrada);
    const destino = caminho({ raiz: join(backup, 'fichas-restauradas') }, entrada);
    const atual = lerTextoComHash(origem, null);
    const salvo = lerTextoComHash(destino, null);
    if ((atual.hash !== null && atual.hash !== entrada.hash) || (salvo.hash !== null && salvo.hash !== entrada.hash) ||
        (atual.hash === null && salvo.hash === null)) erro('FICHA_RESTAURACAO_DIVERGENTE');
    if (salvo.hash === null) gravarTextoAtomico(destino, atual.dados);
    if (atual.hash !== null) unlinkSync(origem);
  }
  for (const [chave, projecao] of Object.entries(plano.projecoes)) {
    const original = lerJsonSeguro(join(backup, 'inventario.json')).arquivos[chave];
    const origem = lerTextoComHash(join(backup, original.nome), null);
    if (original.hash !== origem.hash) erro('FICHAS_BACKUP_DIVERGENTE');
    const destino = a[projecao.alvo];
    const atual = lerTextoComHash(destino, null);
    if (atual.hash === origem.hash) continue;
    if (atual.hash !== projecao.hash) erro('FICHAS_PROJECAO_MUDOU');
    if (origem.hash === null) unlinkSync(destino);
    else gravarTextoAtomico(destino, origem.dados);
  }
  gravarJsonAtomico(a.revertida, { backup: plano.backup });
  if (indice) unlinkSync(a.indice);
  unlinkSync(a.restauro);
}

// A restauração automática é reversão da migração, antes da primeira ação nova.
export function restaurarFichas(dirDados) {
  const a = arquivos(dirDados);
  const { dados: indice, hash } = lerIndice(a);
  if (!indice || (indice.revisao ?? 0) !== 0) erro('FICHAS_RESTAURACAO_EXIGE_CONCILIACAO');
  if (lerJsonSeguro(a.diario, null) || lerJsonSeguro(a.restauro, null)) erro('FICHAS_TRANSACAO_PENDENTE');
  const fichas = lerInventario(a, indice);
  const projecoes = {};
  const valores = [
    ['quadro', 'quadro', quadroDoIndice(indice, fichas)],
    ['pendenciasJson', 'pendencias', { versao: 1, pendencias: [...fichas.values()].flatMap(ficha => ficha.pendencias) }],
  ];
  for (const [chave, alvo, valor] of valores) {
    const esperado = digest(JSON.stringify(valor, null, 2) + '\n');
    if (lerTextoComHash(a[alvo], null).hash !== esperado) erro('FICHAS_PROJECAO_MUDOU');
    projecoes[chave] = { alvo, hash: esperado };
  }
  const plano = { backup: indice.backup, hash, projecoes };
  const backup = caminhoDoBackup(dirDados, plano.backup);
  const inventario = lerJsonSeguro(join(backup, 'inventario.json'));
  for (const { nome, hash } of Object.values(inventario.arquivos)) {
    if (basename(nome) !== nome || lerTextoComHash(join(backup, nome), null).hash !== hash) erro('FICHAS_BACKUP_DIVERGENTE');
  }
  gravarJsonAtomico(a.restauro, plano);
  publicarRestauro(a, dirDados, plano);
  return { estado: 'restaurada', backup };
}
