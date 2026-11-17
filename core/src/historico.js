// Histórico permanente das aparições; cache e histórico têm retenções distintas.
// Apoia conferência de recorrência e intermediários sem decidir candidatura.
import { join } from 'node:path';
import { DIR_DADOS } from './config.js';
import { viaIntermediario } from './intermediario.js';
import { tituloComparavel } from './dedupe.js';
import { lerEstado, salvarEstado } from './estado-central.js';

const ARQ = join(DIR_DADOS, 'historico.json');
const APLICADAS = ['Já apliquei', 'Aplicado por IA', 'Entrevista'];

export function carregar() {
  return lerEstado(ARQ, { versao: 1, vagas: {} });
}

export function salvar(h) {
  return salvarEstado(ARQ, h, DIR_DADOS);
}

export function atualizarHistorico(historico, vagas, dia) {
  const h = historico?.vagas ? historico : { versao: 1, vagas: {} };
  for (const v of vagas) {
    if (!v?.idExterno) continue;
    const atual = h.vagas[v.idExterno];
    if (!atual) {
      h.vagas[v.idExterno] = {
        primeiraVez: dia, ultimaVez: dia, dias: [dia],
        empresa: v.empresa || null, titulo: v.titulo || null, fonte: v.fonte || null,
      };
    } else {
      // Não apaga uma data anterior inválida/futura: ela exige reconciliação.
      if (!atual.ultimaVez || (dataValida(atual.ultimaVez, Infinity) != null && dataValida(dia, Infinity) != null && dia > atual.ultimaVez)) atual.ultimaVez = dia;
      atual.dias = atual.dias || [atual.primeiraVez];
      if (!atual.dias.includes(dia)) atual.dias.push(dia);
    }
  }
  return h;
}

/** Jobgether e parecidos: marca para a leitura obrigatoria antes de aplicar. */
export function marcarIntermediarias(vagas) {
  for (const v of vagas) v.intermediario = viaIntermediario(v.empresa);
  return vagas;
}

// Palavra que todo cargo da area tem nao diz se e a mesma vaga: "Content Designer"
// nao e parecida com "Senior Product Designer" so por dividir "designer".
const GENERICAS = new Set(['designer', 'design', 'senior', 'pleno', 'junior', 'lead', 'staff', 'principal', 'remote', 'remoto', 'pessoa', 'the', 'and', 'for']);
const palavras = (t) => new Set(tituloComparavel(t).split(' ').filter((p) => p.length > 2 && !GENERICAS.has(p)));

/**
 * Candidaturas ja enviadas com cargo parecido, da mais parecida para a menos.
 * E apoio para a leitura, nao veredito: quem decide se e a mesma vaga le o anuncio.
 */
export function parecidasJaAplicadas(vaga, quadro) {
  const minhas = palavras(vaga.titulo);
  const lista = [];
  for (const [idExterno, q] of Object.entries(quadro || {})) {
    if (!APLICADAS.includes(q.status)) continue;
    const delas = palavras(q.titulo);
    const comuns = [...minhas].filter((p) => delas.has(p)).length;
    if (!comuns) continue;
    lista.push({ idExterno, empresa: q.empresa, titulo: q.titulo, status: q.status, comuns: comuns / Math.max(minhas.size, delas.size) });
  }
  return lista.sort((a, b) => b.comuns - a.comuns);
}


const identidade = valor => String(valor || '').normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
function dataValida(valor, limite) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const n = Date.parse(`${valor}T00:00:00Z`);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === valor && n <= limite ? n : null;
}
function contratante(empresa) {
  const nome = identidade(empresa);
  return nome && !viaIntermediario(nome) && !/^(?:empresa|desconhecid[ao]|empresa desconhecida|unknown(?: company)?|empresa n[ãa]o informada|confidencial|confidential|n[ãa]o informad[ao]|n[ãa]o divulgad[ao]|n\/?a|sem empresa)$/.test(nome) && !/confidencial|confidential|intermedi[áa]ri/.test(nome);
}

/** Aviso factual, sem inferir fraude, identidade da vaga ou alterar pontuação. */
export function avisarReaparecimento(vagas, historico, dia) {
  const limite = dataValida(dia, Infinity);
  if (limite == null) return vagas;
  for (const vaga of vagas) {
    if (!contratante(vaga.empresa) || vaga.intermediario || !identidade(vaga.titulo)) continue;
    const datas = [];
    for (const linha of Object.values(historico?.vagas || {})) {
      if (identidade(linha.empresa) !== identidade(vaga.empresa) || identidade(linha.titulo) !== identidade(vaga.titulo)) continue;
      const primeira = dataValida(linha.primeiraVez, limite), ultima = dataValida(linha.ultimaVez, limite);
      if (primeira == null || ultima == null || primeira > ultima) continue;
      datas.push(primeira, ultima);
    }
    if (!datas.length) continue;
    const primeira = Math.min(...datas), ultima = Math.max(...datas);
    const dias = Math.floor((ultima - primeira) / 86400000);
    if (dias < 90) continue;
    const aviso = `Reaparecimento: mesma empresa e cargo registrados por ${dias} dias, de ${new Date(primeira).toISOString().slice(0, 10)} a ${new Date(ultima).toISOString().slice(0, 10)} (fonte: historico.json desta instalação). Conferir a recorrência; o intervalo não comprova irregularidade.`;
    vaga.gaps = Array.isArray(vaga.gaps) ? vaga.gaps : vaga.gaps ? [vaga.gaps] : [];
    vaga.gaps = vaga.gaps.filter(g => !(typeof g === 'string' && g.startsWith('Reaparecimento: mesma empresa e cargo registrados por ') && g.includes('(fonte: historico.json desta instalação)')));
    if (!vaga.gaps.includes(aviso)) vaga.gaps.push(aviso);
  }
  return vagas;
}
