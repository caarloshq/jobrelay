// Preparacao pura de observacoes capturadas pelo agente depois da janela do feed.
// Nao navega, nao consulta Notion e nao grava cache ou quadro.
import { extrair } from './busca/extrair-id.js';
import { juntar, chaveAnuncio, requisicoesConflitam, prioridade } from './dedupe.js';
import { normalizarLink } from './util.js';
import { aplicar as aplicarArquivo } from './arquivo.js';
import { avaliar as avaliarFiltro } from './filtro.js';
import { calcular, compatibilidade, faixa } from './score.js';
import { perfil } from './config.js';

const texto = (v) => typeof v === 'string' && v.trim().length > 0;
const unico = (xs) => [...new Set(xs.filter(Boolean))];
const urlValida = (s) => {
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u : null; }
  catch { return null; }
};
const ehPost = (s) => {
  const u = urlValida(s);
  return u && /(^|\.)linkedin\.com$/.test(u.hostname)
    && (/^\/(posts|feed|pulse)\//.test(u.pathname) || /\/(activity|share)[:-]/.test(u.pathname));
};
const entradasCache = (cache) => Array.isArray(cache) ? cache : Object.values(cache?.vagas || {});

function identidades(vaga) {
  return unico([
    vaga.idExterno, vaga.idCanonico, ...(vaga.idsAlternativos || []),
    extrair(vaga.link)?.idExterno, ...(vaga.linksAlternativos || []).map((l) => extrair(l)?.idExterno),
  ]);
}

function links(vaga) {
  return unico([vaga.link, ...(vaga.linksAlternativos || [])].map(normalizarLink));
}

function forte(a, b) {
  const idsB = new Set(identidades(b));
  if (identidades(a).some((id) => idsB.has(id))) return true;
  const urlsB = new Set(links(b));
  if (links(a).some((l) => urlsB.has(l))) return true;
  // Divergencia de numero no titulo protege somente a comparacao fraca.
  // ID/URL da requisicao prevalecem quando o rotulo foi editado.
  return false;
}

function referencia(observacao) {
  return { chave: observacao.chave || null, postOriginal: observacao.postOriginal || null,
    evidencia: observacao.evidencia || null, origem: observacao.origem || 'LinkedIn feed' };
}

function problema(observacao, motivo, vaga = null) {
  return { ...referencia(observacao), motivo, ...(vaga ? { vaga } : {}) };
}

function destino(observacao) {
  const original = observacao.urlCandidatura || observacao.vagaRevisada?.link;
  if (!texto(original) || !urlValida(original) || ehPost(original)) return null;
  const resolvida = observacao.urlResolvida;
  if (texto(resolvida) && urlValida(resolvida) && observacao.evidenciaResolucao && !ehPost(resolvida)) return resolvida;
  return original;
}

function revisaoCompleta(vaga, revisao) {
  const r = revisao || {};
  const eixos = Array.isArray(r.eixos) ? r.eixos : Object.values(r.eixos || {});
  const notas = eixos.map((e) => e?.nota);
  const semanticoValido = typeof vaga.semantico === 'number' && Number.isFinite(vaga.semantico)
    && vaga.semantico >= 0 && vaga.semantico <= perfil.pesos.semantico_max
    && notas.length === 4 && eixos.every((e) => e && texto(e.evidencia)
      && texto(e.justificativa) && texto(e.fonte))
    && notas.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10)
    && Math.abs(notas.reduce((a, b) => a + b, 0) - vaga.semantico) < 0.001;
  return vaga.validada === true && texto(vaga.descricao) && texto(vaga.resumo)
    && (texto(vaga.gaps) || Array.isArray(vaga.gaps))
    && semanticoValido
    && r.aberta === true && r.canal === 'link'
    && r.paisCompativel === true && r.modeloCompativel === true;
}

/**
 * @param {object} args observacoes: capturas; cache: cache.carregar();
 * estado: arquivo.carregar() atualizado. A observacao so vira `novas` com
 * vagaRevisada e revisao factual explicita. `novas` ainda requer escrita e
 * releitura pelo adaptador da instalacao. Nunca altera os argumentos.
 */
export function prepararLote({ observacoes = [], cache = { vagas: {} }, estado = { vagas: {} }, agora = new Date() } = {}) {
  const resultado = { novas: [], duplicatas: [], pistas: [], descartadas: [], pendencias: [], atualizacoesOrigem: [] };
  const existentes = entradasCache(cache).map((v) => ({ ...v, idsAlternativos: [...(v.idsAlternativos || [])] }));
  const quadro = estado?.vagas || {};
  const data = agora instanceof Date ? agora : new Date(agora);

  for (const obs of observacoes) {
    if (!obs || typeof obs !== 'object') { resultado.pistas.push({ motivo: 'observacao invalida' }); continue; }
    const link = destino(obs);
    if (!link) { resultado.pistas.push(problema(obs, 'sem link de candidatura verificavel')); continue; }
    if (texto(obs.urlResolvida) && (!obs.evidenciaResolucao || !urlValida(obs.urlResolvida) || ehPost(obs.urlResolvida))) {
      resultado.pendencias.push(problema(obs, 'resolucao de URL sem evidencia valida')); continue;
    }
    const id = extrair(link);
    if (!id) { resultado.pistas.push(problema(obs, 'destino sem identidade reconhecida')); continue; }

    const revisada = obs.vagaRevisada || {};
    // IDs/links alternativos soltos nao provam equivalencia. So aceitamos
    // o par observado no redirecionamento ou pares URL A/B com evidencia
    // especifica e uma ponta igual ao destino desta observacao.
    const linksVinculados = [];
    if (texto(obs.urlResolvida) && texto(obs.evidenciaResolucao)
      && texto(obs.urlCandidatura) && normalizarLink(obs.urlCandidatura) !== normalizarLink(link)) {
      linksVinculados.push(obs.urlCandidatura);
    }
    for (const vinculo of Array.isArray(obs.vinculos) ? obs.vinculos : []) {
      if (!texto(vinculo?.evidencia) || !urlValida(vinculo.urlA) || !urlValida(vinculo.urlB)) continue;
      const a = normalizarLink(vinculo.urlA);
      const b = normalizarLink(vinculo.urlB);
      if (a === normalizarLink(link) && b !== a) linksVinculados.push(vinculo.urlB);
      else if (b === normalizarLink(link) && a !== b) linksVinculados.push(vinculo.urlA);
    }
    const aliases = linksVinculados.map((l) => extrair(l)?.idExterno);
    const vaga = {
      ...revisada,
      idExterno: id.idExterno,
      fonte: id.fonte,
      titulo: revisada.titulo || obs.titulo,
      empresa: revisada.empresa || obs.empresa || id.empresa,
      link,
      idsAlternativos: unico(aliases).filter((x) => x !== id.idExterno),
      linksAlternativos: unico(linksVinculados),
      origemFeed: unico([...(revisada.origemFeed || []), obs.postOriginal]),
      evidenciaFeed: obs.evidencia || null,
    };
    // A identidade do destino e sempre canônica; um ID social só é alias
    // quando o agente forneceu vínculo entre anúncio e ATS.
    const anteriorNovo = resultado.novas.find((e) => forte(vaga, e));
    const anteriorCache = existentes.find((e) => forte(vaga, e));
    if (anteriorNovo) {
      const origens = unico([...(anteriorNovo.origemFeed || []), ...vaga.origemFeed]);
      const aliasesUnidos = unico([...identidades(anteriorNovo), ...identidades(vaga)]);
      if (prioridade(vaga.fonte) > prioridade(anteriorNovo.fonte)) {
        // O segundo destino comprovado pode ser a ATS. Mantem a leitura ja
        // feita e troca a identidade publica pelo canal mais direto.
        const promovida = { ...anteriorNovo, idExterno: vaga.idExterno, fonte: vaga.fonte,
          link: vaga.link, origemFeed: origens,
          idsAlternativos: aliasesUnidos.filter((x) => x !== vaga.idExterno),
          linksAlternativos: unico([...anteriorNovo.linksAlternativos, ...vaga.linksAlternativos]) };
        promovida.compatibilidade = compatibilidade(promovida, promovida.semantico);
        promovida.faixa = faixa(promovida.compatibilidade);
        resultado.novas[resultado.novas.indexOf(anteriorNovo)] = promovida;
      } else {
        anteriorNovo.origemFeed = origens;
        anteriorNovo.idsAlternativos = aliasesUnidos.filter((x) => x !== anteriorNovo.idExterno);
      }
      resultado.duplicatas.push({ ...problema(obs, 'repetida no lote', vaga), existente: anteriorNovo.idExterno,
        publicacaoPendente: true });
      continue;
    }
    if (anteriorCache) {
      const quadroAnterior = aplicarArquivo({ ...vaga }, estado, { identidadeEstrita: true });
      if (quadroAnterior.noNotion) {
        resultado.atualizacoesOrigem.push({ idExterno: anteriorCache.idExterno,
          origemFeed: unico([...(anteriorCache.origemFeed || []), ...vaga.origemFeed]),
          idsAlternativos: unico([...identidades(anteriorCache), ...identidades(vaga)]) });
        resultado.duplicatas.push({ ...problema(obs, quadroAnterior.concluida ? 'ja concluida no quadro' : 'ja publicada no quadro', vaga),
          existente: anteriorCache.idExterno, publicacaoPendente: false });
        continue;
      }
      // Cache nao comprova publicacao. A leitura atual completa permite
      // retomar a escrita pendente sem abrir uma segunda identidade.
      const idsDoMesmoAnuncio = unico([...identidades(anteriorCache), ...identidades(vaga)]);
      if (prioridade(anteriorCache.fonte) >= prioridade(vaga.fonte)) vaga.idExterno = anteriorCache.idExterno;
      vaga.idsAlternativos = idsDoMesmoAnuncio
        .filter((x) => x !== vaga.idExterno);
      vaga.origemFeed = unico([...(anteriorCache.origemFeed || []), ...vaga.origemFeed]);
      vaga.publicacaoPendente = true;
    }

    aplicarArquivo(vaga, estado, { identidadeEstrita: true });
    if (vaga.noNotion) {
      resultado.atualizacoesOrigem.push({ idExterno: vaga.idExterno, origemFeed: vaga.origemFeed,
        idsAlternativos: identidades(vaga), status: vaga.statusNotion });
      resultado.duplicatas.push({ ...problema(obs, vaga.concluida ? 'ja concluida no quadro' : 'ja publicada no quadro', vaga),
        status: vaga.statusNotion, publicacaoPendente: false });
      continue;
    }
    const fracos = [...existentes, ...resultado.novas].filter((e) => e !== anteriorCache &&
      chaveAnuncio(vaga) && chaveAnuncio(vaga) === chaveAnuncio(e) && !requisicoesConflitam(vaga, e));
    if (fracos.length || vaga.conflitoIdentidade) {
      resultado.pendencias.push({ ...problema(obs, 'empresa e titulo exigem conferencia de identidade', vaga),
        possiveisDuplicatas: unico([...fracos.map((v) => v.idExterno), ...(vaga.possiveisDuplicatas || [])]) });
      continue;
    }
    if (!texto(vaga.titulo) || !texto(vaga.empresa)) {
      resultado.pistas.push(problema(obs, 'titulo ou empresa ausente', vaga)); continue;
    }
    if (!revisaoCompleta(vaga, obs.revisao || revisada.revisao)) {
      resultado.pendencias.push(problema(obs, 'leitura factual ou elegibilidade incompleta', vaga)); continue;
    }
    const filtro = avaliarFiltro(vaga, data);
    if (!filtro.passa) { resultado.descartadas.push(problema(obs, filtro.motivo, vaga)); continue; }
    vaga.score = calcular(vaga, data);
    vaga.senioridade = vaga.score.nivel;
    vaga.lida = true;
    vaga.lidoEm = (obs.revisao || revisada.revisao)?.lidoEm || data.toISOString().slice(0, 10);
    vaga.compatibilidade = compatibilidade(vaga, vaga.semantico);
    vaga.faixa = faixa(vaga.compatibilidade);
    const aliasesFinais = [...vaga.idsAlternativos];
    const linksOriginais = [...vaga.linksAlternativos];
    const agrupadas = juntar([vaga], { identidadeEstrita: true }).vagas;
    agrupadas[0].idsAlternativos = aliasesFinais;
    agrupadas[0].linksAlternativos = linksOriginais;
    resultado.novas.push(agrupadas[0]);
  }
  resultado.novas.sort((a, b) => b.compatibilidade - a.compatibilidade);
  resultado.contagem = Object.fromEntries(['novas', 'duplicatas', 'pistas', 'descartadas', 'pendencias']
    .map((k) => [k, resultado[k].length]));
  resultado.contagem.capturadas = observacoes.length;
  resultado.contagem.comDestino = observacoes.filter((o) => o && destino(o)).length;
  return resultado;
}
